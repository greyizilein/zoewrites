import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Paperclip, ArrowUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { readContentAndToolStream, type ToolCall } from "@/lib/sseStream";
import { loadPaystackScript, openPaystackPopup } from "@/lib/paystack";

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoe-chat`;

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const GREETINGS = [
  { time: "morning", texts: ["Good morning {name}, ready to write?", "Morning {name}! What shall we work on?", "Rise and shine {name} ☀️ What's on today?"] },
  { time: "afternoon", texts: ["Hey {name}, what do you have in mind?", "Afternoon {name}! How can I help?", "What are we working on, {name}?"] },
  { time: "evening", texts: ["Evening {name}, let's get some work done", "Hey {name}, burning the midnight oil?", "Good evening {name}! What can I do?"] },
];

function getGreeting(name: string): string {
  const h = new Date().getHours();
  const bucket = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  const group = GREETINGS.find(g => g.time === bucket)!;
  const text = group.texts[Math.floor(Math.random() * group.texts.length)];
  return text.replace("{name}", name);
}

interface Props {
  refreshData?: () => void;
}

export default function ZoeFloatingChat({ refreshData }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [greeting] = useState(() => getGreeting(user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there"));
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Load history
  useEffect(() => {
    if (!user || !open) return;
    supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", user.id)
      .eq("chat_id", "dashboard")
      .order("created_at", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) setMessages(data as ChatMsg[]);
      });
  }, [user, open]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  const executeToolCall = useCallback(async (tc: ToolCall) => {
    try {
      const args = tc.arguments ? JSON.parse(tc.arguments) : {};
      switch (tc.name) {
        case "navigate_to":
          navigate(args.route);
          break;
        case "create_assessment":
          navigate("/assessment/new");
          break;
        case "open_assessment":
          navigate(`/assessment/${args.assessment_id}`);
          break;
        case "sign_out":
          await supabase.auth.signOut();
          navigate("/");
          break;
        case "process_payment": {
          await loadPaystackScript();
          const tiers: Record<string, number> = { hello: 2000000, regular: 6000000, professional: 15000000 };
          const amt = args.tier === "custom" ? Math.ceil((args.custom_words || 1000) * 2300) : (tiers[args.tier] || 2000000);
          openPaystackPopup({
            email: user?.email || "",
            amountInKobo: amt,
            tier: args.tier,
            customWords: args.custom_words,
            publicKey: "pk_live_b1f5e4e53d89b28c5013041dbc090912907b2899",
            onSuccess: async (ref) => {
              await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack-verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
                body: JSON.stringify({ reference: ref }),
              });
              refreshData?.();
            },
            onClose: () => {},
          });
          break;
        }
        case "delete_assessment":
          if (args.confirmed && args.assessment_id) {
            await supabase.from("assessments").delete().eq("id", args.assessment_id);
            refreshData?.();
          }
          break;
        default:
          break;
      }
    } catch (e) {
      console.warn("[ZoeChat] tool exec error:", e);
    }
  }, [navigate, user, refreshData]);

  const send = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading || !user) return;

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    // Persist user message
    supabase.from("chat_messages").insert({ user_id: user.id, chat_id: "dashboard", role: "user", content: msg }).then();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Get context for ZOE
      const [{ data: assessments }, { data: profile }] = await Promise.all([
        supabase.from("assessments").select("id, title, status, word_current, word_target").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("tier, words_used, word_limit, full_name").eq("user_id", user.id).single(),
      ]);

      const history = messages.slice(-20).map(m => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: msg });

      const resp = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: history,
          sections_summary: assessments?.map(a => `${a.title} (${a.status}, ${a.word_current}/${a.word_target}w) [id:${a.id}]`).join("\n") || "No assessments yet",
          user_tier: profile?.tier || "free",
          user_name: profile?.full_name || user.email?.split("@")[0] || "User",
          words_used: profile?.words_used || 0,
          word_limit: profile?.word_limit || 500,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Request failed");

      const assistantId = crypto.randomUUID();
      const { content, toolCalls } = await readContentAndToolStream(resp.body, (text) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantId) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: text } : m);
          }
          return [...prev, { id: assistantId, role: "assistant", content: text, created_at: new Date().toISOString() }];
        });
      });

      // Persist assistant message
      if (content) {
        supabase.from("chat_messages").insert({ user_id: user.id, chat_id: "dashboard", role: "assistant", content }).then();
      }

      for (const tc of toolCalls) {
        await executeToolCall(tc);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: `Sorry, something went wrong: ${e?.message}`, created_at: new Date().toISOString() }]);
    }

    setLoading(false);
  }, [input, loading, user, messages, executeToolCall]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }, [send]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";

    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("chat-uploads").upload(path, file);
    if (error) return;

    await supabase.from("chat_uploads").insert({
      user_id: user.id,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      storage_path: path,
    });

    send(`[Uploaded file: ${file.name}]`);
  }, [user, send]);

  const suggestions = useMemo(() => [
    { label: "New Assessment", msg: "Create a new assessment for me" },
    { label: "Check My Stats", msg: "Show me my writing analytics" },
    { label: "Upgrade Plan", msg: "What subscription plans are available?" },
  ], []);

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={() => setOpen(true)}
            className="fixed z-50 bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-terracotta text-white shadow-lg flex items-center justify-center hover:bg-terracotta/90 active:scale-95 transition-colors animate-pulse-glow"
            aria-label="Open ZOE chat"
          >
            <Sparkles size={22} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-50 inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[600px] flex flex-col bg-card sm:rounded-2xl sm:shadow-2xl sm:border sm:border-border/50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-terracotta to-terracotta/85 text-white flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none">ZOE</p>
                  <p className="text-[10px] opacity-80">AI Assistant</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-terracotta/10 flex items-center justify-center mb-3">
                    <Sparkles size={20} className="text-terracotta" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">{greeting}</p>
                  <p className="text-xs text-muted-foreground mb-4">I can write, analyse, export, and manage everything for you.</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestions.map(s => (
                      <button
                        key={s.label}
                        onClick={() => send(s.msg)}
                        className="px-3 py-1.5 rounded-full border border-border text-xs font-medium text-foreground hover:bg-muted/50 active:scale-95 transition-all"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(m => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-terracotta text-white rounded-br-md"
                        : "bg-muted/50 text-foreground rounded-bl-md"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-li:my-0.5 prose-headings:mb-1 prose-headings:mt-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span>{m.content}</span>
                    )}
                  </div>
                </div>
              ))}

              {loading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="bg-muted/50 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* Input bar */}
            <div className="flex-shrink-0 border-t border-border bg-card px-3 py-2.5">
              <div className="flex items-end gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors mb-0.5"
                >
                  <Paperclip size={16} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.docx,.doc,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp"
                />
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Message ZOE…"
                  rows={1}
                  enterKeyHint="send"
                  autoCapitalize="sentences"
                  className="flex-1 resize-none bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-terracotta/50 max-h-[120px]"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-terracotta text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-terracotta/90 active:scale-95 transition-all mb-0.5"
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
