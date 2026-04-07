import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Plus, Trash2, Minus, X, Send, Paperclip, ChevronLeft, Search, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { readContentAndToolStream } from "@/lib/sseStream";

interface Attachment { name: string; url: string; type: string; }
interface Message { id: string; role: "user" | "assistant"; content: string; timestamp: number; attachments?: Attachment[]; }
interface ChatSession { id: string; title: string; messages: Message[]; createdAt: number; updatedAt: number; }

const QUICK_ACTIONS = [
  { icon: "✍️", label: "Write", prompt: "I need help writing an academic assignment." },
  { icon: "✏️", label: "Edit", prompt: "Can you edit and improve my work?" },
  { icon: "📋", label: "Outline", prompt: "Help me create an outline for my assignment." },
  { icon: "💡", label: "Brainstorm", prompt: "Let us brainstorm ideas for my topic." },
  { icon: "⚙️", label: "Settings", prompt: "What can you help me with?" },
];

const SK = (uid: string) => `zoe_sessions_${uid}`;

function loadSessions(uid: string): ChatSession[] {
  try { return JSON.parse(localStorage.getItem(SK(uid)) || "[]"); }
  catch { return []; }
}

function saveSessions(uid: string, sessions: ChatSession[]) {
  try { localStorage.setItem(SK(uid), JSON.stringify(sessions.slice(0, 50))); }
  catch { /* quota exceeded */ }
}

function mkSession(): ChatSession {
  return { id: crypto.randomUUID(), title: "New Chat", messages: [], createdAt: Date.now(), updatedAt: Date.now() };
}

export default function ZoeChat() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profile, setProfile] = useState<{ full_name: string | null; tier: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentSession = useMemo(() => sessions.find(s => s.id === currentId) ?? null, [sessions, currentId]);

  useEffect(() => {
    if (!user?.id) return;
    const stored = loadSessions(user.id);
    if (stored.length > 0) { setSessions(stored); setCurrentId(stored[0].id); }
    else { const s = mkSession(); setSessions([s]); setCurrentId(s.id); }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("full_name, tier").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data as any); });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || sessions.length === 0) return;
    saveSessions(user.id, sessions);
  }, [sessions, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages, streaming]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  function updateSession(id: string, updater: (s: ChatSession) => ChatSession) {
    setSessions(prev => prev.map(s => s.id === id ? updater(s) : s));
  }

  function addMessage(msg: Message) {
    setSessions(prev => prev.map(s => {
      if (s.id !== currentId) return s;
      const msgs = [...s.messages, msg];
      return {
        ...s, messages: msgs,
        title: s.messages.length === 0 && msg.role === "user"
          ? msg.content.slice(0, 40) + (msg.content.length > 40 ? "…" : "")
          : s.title,
        updatedAt: Date.now(),
      };
    }));
  }

  async function handleToolCall(name: string, args: Record<string, any>) {
    switch (name) {
      case "navigate_to": if (args.route) { navigate(args.route); setOpen(false); } break;
      case "create_assessment": navigate("/assessment/new"); setOpen(false); break;
      case "open_assessment": if (args.assessment_id) { navigate(`/assessment/${args.assessment_id}`); setOpen(false); } break;
      case "sign_out": await signOut(); navigate("/"); break;
    }
  }

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if ((!text && attachedFiles.length === 0) || loading) return;
    setInput(""); setLoading(true); setStreaming("");

    let uploadedAttachments: Attachment[] = [];
    if (attachedFiles.length > 0 && user?.id) {
      setUploadingFiles(true);
      for (const file of attachedFiles) {
        try {
          const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { error: upErr } = await supabase.storage.from("chat-uploads").upload(path, file);
          if (upErr) throw upErr;
          const { data: signed } = await supabase.storage.from("chat-uploads").createSignedUrl(path, 3600);
          if (signed?.signedUrl) uploadedAttachments.push({ name: file.name, url: signed.signedUrl, type: file.type });
        } catch (err: any) { console.error("[ZoeChat upload]", file.name, err?.message ?? err); }
      }
      setAttachedFiles([]); setUploadingFiles(false);
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text, timestamp: Date.now(), attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined };
    addMessage(userMsg);

    const history = [...(currentSession?.messages ?? []), userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      abortRef.current = new AbortController();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoe-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ messages: history, attachments: uploadedAttachments }),
        signal: abortRef.current.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`API error ${resp.status}`);
      let fullContent = "";
      const { content, toolCalls } = await readContentAndToolStream(resp.body, chunk => { setStreaming(chunk); fullContent = chunk; });
      setStreaming("");
      addMessage({ id: crypto.randomUUID(), role: "assistant", content: content || fullContent, timestamp: Date.now() });
      for (const tc of toolCalls) {
        try { await handleToolCall(tc.name, JSON.parse(tc.arguments || "{}")); }
        catch (e) { console.warn("[ZoeChat tool]", tc.name, e); }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") addMessage({ id: crypto.randomUUID(), role: "assistant", content: "Something went wrong — please try again.", timestamp: Date.now() });
    } finally { setLoading(false); setStreaming(""); }
  }, [input, attachedFiles, loading, currentSession, session, user?.id]);

  function handleNewChat() {
    const s = mkSession();
    setSessions(prev => [s, ...prev]);
    setCurrentId(s.id);
    setSidebarOpen(false);
  }

  function handleDeleteMessages() {
    updateSession(currentId, s => ({ ...s, messages: [], title: "New Chat", updatedAt: Date.now() }));
  }

  const filteredSessions = searchQuery
    ? sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  const messages = currentSession?.messages ?? [];
  const hasMessages = messages.length > 0 || !!streaming;

  if (!user) return null;

  const initials = (profile?.full_name || user.email || "U").slice(0, 2).toUpperCase();

  return (
    <>
      {/* Launcher */}
      {(!open || minimized) && (
        <button
          onClick={() => { setOpen(true); setMinimized(false); }}
          aria-label="Open ZOE"
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center"
        >
          <span className="absolute inset-0 rounded-full bg-terracotta/40 animate-ping" />
          <span className="relative w-14 h-14 rounded-full bg-terracotta shadow-lg flex items-center justify-center text-white text-[13px] font-extrabold tracking-widest z-10 hover:brightness-110 active:scale-95 transition-all select-none">
            ZOE
          </span>
        </button>
      )}

      {/* Mobile backdrop */}
      {open && !minimized && (
        <div className="fixed inset-0 bg-black/40 z-[55] md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Chat panel */}
      <div className={cn(
        "fixed z-[60] flex flex-col bg-[#F5F0EB] shadow-2xl transition-all duration-300 ease-in-out",
        "inset-0 md:inset-auto md:top-0 md:right-0 md:h-screen md:w-[420px] md:border-l md:border-black/10",
        open && !minimized
          ? "translate-y-0 md:translate-x-0 opacity-100"
          : "translate-y-full md:translate-y-0 md:translate-x-full opacity-0 pointer-events-none",
      )}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="hidden md:flex w-7 h-7 rounded-lg items-center justify-center text-foreground/50 hover:bg-black/8 transition-colors"
              title="Chat history"
            >
              <ChevronLeft size={15} className={cn("transition-transform duration-300", sidebarOpen && "rotate-180")} />
            </button>
            <div className="w-6 h-6 rounded-full bg-terracotta flex items-center justify-center">
              <span className="text-white text-[7px] font-extrabold tracking-widest">ZOE</span>
            </div>
            <span className="text-[15px] font-bold text-foreground">ZOE</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={handleNewChat} title="New Chat" className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground/50 hover:bg-black/8 hover:text-foreground transition-colors">
              <Plus size={16} />
            </button>
            <button onClick={handleDeleteMessages} title="Clear chat" className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground/50 hover:bg-black/8 hover:text-foreground transition-colors">
              <Trash2 size={14} />
            </button>
            <button onClick={() => setMinimized(true)} title="Minimize" className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-foreground/50 hover:bg-black/8 hover:text-foreground transition-colors">
              <Minus size={15} />
            </button>
            <button onClick={() => { setOpen(false); setMinimized(false); }} title="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground/50 hover:bg-black/8 hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden relative">

          {/* Desktop sidebar */}
          <div className={cn(
            "absolute inset-y-0 left-0 z-20 w-[270px] flex flex-col bg-[#EDE8E2] border-r border-black/10 shadow-xl transition-transform duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}>
            <div className="p-3 border-b border-black/8 flex-shrink-0">
              <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2 border border-black/10">
                <Search size={13} className="text-foreground/40 flex-shrink-0" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search chats…"
                  className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-foreground/40" style={{ fontSize: "16px" }} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
              {filteredSessions.length === 0 && <p className="text-[11px] text-foreground/40 text-center py-8">No chats yet</p>}
              {filteredSessions.map(s => (
                <button key={s.id} onClick={() => { setCurrentId(s.id); setSidebarOpen(false); }}
                  className={cn("w-full text-left px-3 py-2.5 rounded-xl text-[12px] transition-colors flex items-center gap-2",
                    s.id === currentId ? "bg-terracotta/15 text-terracotta font-semibold" : "text-foreground/65 hover:bg-black/5")}>
                  <MessageSquare size={11} className="flex-shrink-0 opacity-50" />
                  <span className="truncate flex-1">{s.title}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-black/8 p-3 flex-shrink-0 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-terracotta/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-terracotta">{initials}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-foreground truncate">{profile?.full_name || user.email}</p>
                  <p className="text-[10px] text-foreground/50 capitalize">{profile?.tier || "free"} plan</p>
                </div>
              </div>
              {profile && !["professional", "unlimited"].includes(profile.tier ?? "") && (
                <button onClick={() => { navigate("/dashboard"); setSidebarOpen(false); }}
                  className="w-full py-1.5 text-[11px] font-semibold text-white bg-terracotta rounded-lg hover:brightness-110 transition-all">
                  Upgrade Plan
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 min-w-0" style={{ scrollbarWidth: "thin" }}>
            {!hasMessages ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-8">
                <div className="w-12 h-12 rounded-full bg-terracotta flex items-center justify-center mb-4 shadow-md">
                  <span className="text-white text-[9px] font-extrabold tracking-widest">ZOE</span>
                </div>
                <p className="text-[18px] font-semibold text-foreground mb-1">Hi, I&#39;m ZOE.</p>
                <p className="text-[14px] text-foreground/55 mb-6 italic">What are we writing today?</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_ACTIONS.map(a => (
                    <button key={a.label} onClick={() => handleSend(a.prompt)} disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-full text-[12px] font-medium text-foreground/75 border border-black/10 hover:border-terracotta/40 hover:bg-terracotta/5 active:scale-95 transition-all shadow-sm">
                      <span>{a.icon}</span><span>{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5 pb-2">
                {messages.map(msg => (
                  <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "user" ? (
                      /* User bubble */
                      <div className="max-w-[82%] px-4 py-2.5 bg-terracotta text-white rounded-2xl rounded-br-sm text-[14px] leading-relaxed">
                        {msg.content}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/20">
                            {msg.attachments.map((a, i) => (
                              <span key={i} className="flex items-center gap-1 text-[10px] text-white/80">
                                <Paperclip size={9} />{a.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ZOE response — on the page surface, no bubble */
                      <div className="w-full min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-5 h-5 rounded-full bg-terracotta flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-[6px] font-extrabold tracking-widest">ZOE</span>
                          </div>
                          <span className="text-[11px] font-semibold text-foreground/45 tracking-wide">ZOE</span>
                        </div>
                        <div className="prose prose-sm prose-stone max-w-none text-[14px] leading-relaxed">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Streaming */}
                {streaming && (
                  <div className="w-full min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-terracotta flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[6px] font-extrabold tracking-widest">ZOE</span>
                      </div>
                      <span className="text-[11px] font-semibold text-foreground/45 tracking-wide">ZOE</span>
                    </div>
                    <div className="prose prose-sm prose-stone max-w-none text-[14px] leading-relaxed">
                      <ReactMarkdown>{streaming}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Typing dots */}
                {loading && !streaming && (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-terracotta flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-[6px] font-extrabold tracking-widest">ZOE</span>
                    </div>
                    <div className="flex gap-1 py-1">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-foreground/25 animate-bounce"
                          style={{ animationDelay: `${i * 0.18}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 border-t border-black/8 px-3 py-3 bg-[#F5F0EB]"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>

          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachedFiles.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-terracotta/10 text-terracotta text-[11px] font-medium rounded-full">
                  <Paperclip size={9} />
                  {f.name.length > 22 ? f.name.slice(0, 20) + "…" : f.name}
                  <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="ml-0.5 hover:opacity-70">
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* File attach */}
            <label className={cn(
              "relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors overflow-hidden",
              loading || uploadingFiles ? "bg-black/5 text-foreground/25 pointer-events-none" : "bg-black/8 text-foreground/55 hover:bg-black/12 hover:text-foreground cursor-pointer",
            )}>
              <input type="file" multiple accept="*/*" disabled={loading || uploadingFiles}
                onChange={e => { setAttachedFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ""; }}
                style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }} />
              {uploadingFiles ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
            </label>

            {/* Textarea */}
            <div className="flex-1 flex items-end bg-white rounded-2xl border border-black/12 focus-within:border-terracotta/50 transition-colors px-3 py-2.5 min-h-[44px]">
              <textarea ref={textareaRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message ZOE…" rows={1}
                autoCapitalize="sentences" autoCorrect="on" enterKeyHint="send" spellCheck
                className="flex-1 bg-transparent outline-none resize-none text-foreground placeholder:text-foreground/38 leading-5 max-h-[120px] w-full"
                style={{ fontSize: "16px", overflowY: "auto", scrollbarWidth: "none", WebkitUserSelect: "text", touchAction: "manipulation" }}
              />
            </div>

            {/* Send */}
            <button type="button" onClick={() => handleSend()}
              disabled={(!input.trim() && attachedFiles.length === 0) || loading}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                (input.trim() || attachedFiles.length > 0) && !loading
                  ? "bg-terracotta text-white hover:brightness-110 active:scale-95 shadow-sm"
                  : "bg-black/8 text-foreground/25 cursor-not-allowed",
              )}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
