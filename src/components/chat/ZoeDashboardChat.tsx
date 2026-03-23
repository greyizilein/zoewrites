// ── Imports ────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  MessageCircle, X, ArrowLeft, Search, Send,
  Plus, FileText, Zap, BarChart3, Settings, CreditCard,
  CheckCircle, AlertCircle, Loader2, ChevronRight, Wand2,
  Sparkles, ShieldCheck, Download, Image, BookOpen,
  AlignLeft, Target, Brain, Quote, SlidersHorizontal, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { readContentAndToolStream } from "@/lib/sseStream";
import { loadPaystackScript, openPaystackPopup } from "@/lib/paystack";

// ── Constants ───────────────────────────────────────────────────────────────
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const PAYSTACK_KEY = "pk_live_e1d5c33f8f38484c592eaad87382adab502a8c1e";
const NGN_PER_WORD = 23;

const TIER_PLANS = [
  { id: "hello",        label: "Hello",        gbp: 15,  words: 1500,  popular: false },
  { id: "regular",      label: "Regular",      gbp: 45,  words: 5000,  popular: false },
  { id: "professional", label: "Professional", gbp: 110, words: 15000, popular: true  },
] as const;

// ── Types ───────────────────────────────────────────────────────────────────
type ActionType =
  | "writing" | "critiquing" | "humanising" | "exporting"
  | "processing" | "navigating" | "payment" | "generating"
  | "checking" | "success" | "error";

type TabId = "chats" | "write" | "status" | "tools";

// ── Interfaces ──────────────────────────────────────────────────────────────
interface Assessment {
  id: string;
  title: string;
  type: string | null;
  word_current: number;
  word_target: number;
  status: string;
  updated_at: string;
}

interface Section {
  id: string;
  title: string;
  word_target: number;
  word_current: number;
  status: string;
  content: string | null;
  sort_order: number;
}

interface ZoeChatMsg {
  id: string;
  role: "user" | "assistant" | "action";
  content: string;
  streaming?: boolean;
  actionType?: ActionType;
  ts: number;
}

interface ZoeDashboardChatProps {
  assessments: Assessment[];
  profile: {
    full_name: string | null;
    tier: string;
    words_used: number;
    word_limit: number;
  } | null;
  userName: string;
  onRefresh: () => void;
}

// ── Action display metadata ─────────────────────────────────────────────────
const ACTION_META: Record<ActionType, { label: string; bg: string; text: string }> = {
  writing:    { label: "Writing…",    bg: "bg-terracotta/10",   text: "text-terracotta" },
  critiquing: { label: "Critiquing…", bg: "bg-blue-500/10",     text: "text-blue-600" },
  humanising: { label: "Humanising…", bg: "bg-purple-500/10",   text: "text-purple-600" },
  exporting:  { label: "Exporting…",  bg: "bg-muted/60",        text: "text-muted-foreground" },
  processing: { label: "Processing…", bg: "bg-muted/60",        text: "text-muted-foreground" },
  navigating: { label: "Navigating…", bg: "bg-muted/60",        text: "text-muted-foreground" },
  payment:    { label: "Payment…",    bg: "bg-yellow-500/10",   text: "text-yellow-600" },
  generating: { label: "Generating…", bg: "bg-green-500/10",    text: "text-green-600" },
  checking:   { label: "Checking…",   bg: "bg-blue-500/10",     text: "text-blue-600" },
  success:    { label: "Done ✓",      bg: "bg-green-500/10",    text: "text-green-600" },
  error:      { label: "Error",       bg: "bg-destructive/10",  text: "text-destructive" },
};

// ── Helpers ─────────────────────────────────────────────────────────────────
const uid = () => crypto.randomUUID();

const fmt = (n: number): string => {
  if (n >= 1_000_000_000) return "∞";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
};

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en", { month: "short", day: "numeric" });
};

// ── ReactMarkdown component overrides ───────────────────────────────────────
const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  table: ({ children }) => (
    <div className="overflow-x-auto my-2 rounded-lg border border-border/40">
      <table className="w-full text-[11px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-foreground border-b border-border/40">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-b border-border/20 text-muted-foreground">{children}</td>
  ),
  tr: ({ children }) => <tr className="hover:bg-muted/20 transition-colors">{children}</tr>,
  code: ({ className, children, ...props }: any) => {
    const isBlock = Boolean(className);
    if (!isBlock) {
      return (
        <code className="px-1 py-0.5 rounded bg-terracotta/10 font-mono text-[11px] text-terracotta" {...props}>
          {children}
        </code>
      );
    }
    return (
      <div className="my-2 rounded-lg overflow-hidden border border-border/40">
        <div className="bg-[hsl(24,14%,12%)] px-3 py-1.5">
          <span className="text-[9px] text-white/40 font-mono uppercase tracking-wider">
            {className?.replace("language-", "") || "code"}
          </span>
        </div>
        <pre className="p-3 bg-[hsl(24,14%,10%)] overflow-x-auto">
          <code className="text-[11px] font-mono text-white/90 leading-relaxed">{children}</code>
        </pre>
      </div>
    );
  },
  h1: ({ children }) => <h1 className="text-[15px] font-bold text-foreground mt-3 mb-1.5 leading-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="text-[14px] font-bold text-foreground mt-2.5 mb-1 leading-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[13px] font-semibold text-foreground mt-2 mb-1">{children}</h3>,
  ul: ({ children }) => <ul className="my-1.5 space-y-0.5 pl-4 list-disc marker:text-terracotta">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 space-y-0.5 pl-4 list-decimal marker:text-terracotta">{children}</ol>,
  li: ({ children }) => <li className="text-[13px] leading-relaxed">{children}</li>,
  p: ({ children }) => <p className="text-[13px] leading-relaxed mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-muted-foreground/90">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 pl-3 border-l-2 border-terracotta/60 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-border/40" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-terracotta underline underline-offset-2 hover:text-terracotta/80">
      {children}
    </a>
  ),
};

// ── MsgBubble ────────────────────────────────────────────────────────────────
const MsgBubble: React.FC<{ msg: ZoeChatMsg }> = ({ msg }) => {
  // Action pill — centered status indicator
  if (msg.role === "action") {
    const meta = ACTION_META[msg.actionType || "processing"];
    return (
      <div className="flex justify-center my-1">
        <span className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium",
          meta.bg, meta.text,
        )}>
          {(msg.actionType === "processing" || msg.actionType === "writing" ||
            msg.actionType === "humanising" || msg.actionType === "critiquing" ||
            msg.actionType === "generating" || msg.actionType === "checking" ||
            msg.actionType === "payment" || msg.actionType === "exporting") && (
            <Loader2 size={10} className="animate-spin flex-shrink-0" />
          )}
          {msg.actionType === "success" && <CheckCircle size={10} className="flex-shrink-0" />}
          {msg.actionType === "error" && <AlertCircle size={10} className="flex-shrink-0" />}
          {msg.actionType === "navigating" && <ChevronRight size={10} className="flex-shrink-0" />}
          {msg.content || meta.label}
        </span>
      </div>
    );
  }

  // User bubble — right aligned, terracotta
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-1">
        <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-terracotta text-white text-[13px] leading-relaxed shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  // Assistant bubble — left aligned, white card with ZOE avatar
  const isEmpty = !msg.content && msg.streaming;
  return (
    <div className="flex items-end gap-2 mb-1 max-w-[88%]">
      {/* ZOE avatar dot */}
      <div className="w-6 h-6 rounded-full bg-terracotta flex items-center justify-center flex-shrink-0 self-end mb-0.5">
        <span className="text-white text-[7px] font-extrabold">Z</span>
      </div>
      <div className={cn(
        "px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-white border border-border/40 shadow-sm text-[13px] leading-relaxed text-foreground min-w-[60px]",
        msg.streaming && "opacity-90",
      )}>
        {isEmpty ? (
          /* Typing indicator — 3 bouncing dots */
          <span className="flex gap-1 py-0.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        ) : (
          <>
            <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
            {msg.streaming && (
              <span className="inline-block w-0.5 h-3.5 bg-terracotta animate-pulse ml-0.5 align-middle" />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────
const ZoeDashboardChat: React.FC<ZoeDashboardChatProps> = ({
  assessments, profile, userName, onRefresh,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── Panel state ────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("chats");
  const [chatOpen, setChatOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [msgsMap, setMsgsMap] = useState<Record<string, ZoeChatMsg[]>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Sections (loaded per open assessment) ──────────────────────────────────
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  // ── Payment state ──────────────────────────────────────────────────────────
  const [gbpToNgn, setGbpToNgn] = useState(2083);
  const [payLoading, setPayLoading] = useState<string | null>(null);
  const [customWords, setCustomWords] = useState(500);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Fetch live GBP→NGN rate once on first open
  useEffect(() => {
    if (!open) return;
    supabase.functions.invoke("currency-rate").then(({ data }) => {
      if (data?.gbp_to_ngn) setGbpToNgn(data.gbp_to_ngn);
    });
  }, [open]);

  // Load sections whenever the user enters an assessment chat
  useEffect(() => {
    if (!chatOpen) { setSections([]); return; }
    setSectionsLoading(true);
    supabase
      .from("sections")
      .select("id, title, word_target, word_current, status, content, sort_order")
      .eq("assessment_id", chatOpen)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setSections(data || []);
        setSectionsLoading(false);
      });
  }, [chatOpen]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgsMap, chatOpen]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  // Focus textarea when entering a chat
  useEffect(() => {
    if (chatOpen && open) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [chatOpen, open]);

  // ── Message helpers ────────────────────────────────────────────────────────
  const addMsg = useCallback((
    chatId: string,
    msg: Omit<ZoeChatMsg, "id" | "ts">,
  ): string => {
    const id = uid();
    setMsgsMap(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), { ...msg, id, ts: Date.now() }],
    }));
    return id;
  }, []);

  const updateMsg = useCallback((chatId: string, msgId: string, patch: Partial<ZoeChatMsg>) => {
    setMsgsMap(prev => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map(m => m.id === msgId ? { ...m, ...patch } : m),
    }));
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const chatId = chatOpen || "dashboard";
  const currentMsgs = msgsMap[chatId] || [];
  const currentAssessment = chatOpen ? assessments.find(a => a.id === chatOpen) : null;
  const filteredAssessments = assessments.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  // ── executePipeline ────────────────────────────────────────────────────────
  const executePipeline = useCallback(async (
    toolName: string,
    args: Record<string, any>,
    forChatId?: string,
  ) => {
    const activeChatId = forChatId || chatId;
    const activeAssessmentId = forChatId || chatOpen;

    switch (toolName) {

      case "navigate_to": {
        addMsg(activeChatId, { role: "action", content: `Navigating to ${args.route}…`, actionType: "navigating" });
        setTimeout(() => { navigate(args.route); setOpen(false); }, 500);
        break;
      }

      case "create_assessment": {
        addMsg(activeChatId, { role: "action", content: "Opening new assessment…", actionType: "navigating" });
        setTimeout(() => { navigate("/assessment/new"); setOpen(false); }, 500);
        break;
      }

      case "open_assessment": {
        const target = assessments.find(a => a.id === args.assessment_id);
        addMsg(activeChatId, { role: "action", content: `Opening "${target?.title || args.assessment_id}"…`, actionType: "navigating" });
        setTimeout(() => { navigate(`/assessment/${args.assessment_id}`); setOpen(false); }, 500);
        break;
      }

      case "process_payment": {
        const { tier, custom_words } = args;
        if (!user?.email) { addMsg(activeChatId, { role: "action", content: "Not signed in.", actionType: "error" }); break; }
        setPayLoading(tier);
        addMsg(activeChatId, { role: "action", content: `Preparing ${tier} plan…`, actionType: "payment" });
        try {
          await loadPaystackScript();
          const plan = TIER_PLANS.find(p => p.id === tier);
          const wordsCount = tier === "custom" ? (custom_words || customWords) : 0;
          const amountKobo = tier === "custom"
            ? wordsCount * NGN_PER_WORD * 100
            : plan ? Math.round(plan.gbp * gbpToNgn * 100) : 0;
          if (!amountKobo) throw new Error(`Unknown tier: ${tier}`);
          openPaystackPopup({
            email: user.email,
            amountInKobo: amountKobo,
            tier,
            customWords: wordsCount,
            publicKey: PAYSTACK_KEY,
            onSuccess: async (reference) => {
              addMsg(activeChatId, { role: "action", content: "Verifying payment…", actionType: "processing" });
              const { data, error } = await supabase.functions.invoke("paystack-verify", {
                body: { reference, tier, custom_words: wordsCount, user_id: user.id },
              });
              if (error || !data?.word_limit) {
                addMsg(activeChatId, { role: "action", content: "Verification failed. Contact support.", actionType: "error" });
              } else {
                addMsg(activeChatId, { role: "action", content: `Payment successful! Plan: ${tier} · ${fmt(data.word_limit)} words.`, actionType: "success" });
                onRefresh();
              }
              setPayLoading(null);
            },
            onClose: () => { addMsg(activeChatId, { role: "action", content: "Payment cancelled.", actionType: "error" }); setPayLoading(null); },
          });
        } catch (e: any) {
          addMsg(activeChatId, { role: "action", content: `Payment error: ${e.message}`, actionType: "error" });
          setPayLoading(null);
        }
        break;
      }

      case "write_all": {
        if (!activeAssessmentId) { addMsg(activeChatId, { role: "action", content: "No assessment selected.", actionType: "error" }); break; }
        const pending = sections.filter(s => s.status !== "complete");
        if (pending.length === 0) { addMsg(activeChatId, { role: "action", content: "All sections already complete.", actionType: "success" }); break; }
        addMsg(activeChatId, { role: "action", content: `Writing ${pending.length} section${pending.length > 1 ? "s" : ""}…`, actionType: "writing" });
        let done = 0;
        for (const sec of pending) {
          try {
            const resp = await fetch(`${CHAT_URL}/section-generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
              body: JSON.stringify({ section: { title: sec.title, word_target: sec.word_target }, model: "google/gemini-2.5-flash" }),
            });
            if (!resp.ok || !resp.body) continue;
            let fullContent = "";
            await readContentAndToolStream(resp.body, p => { fullContent = p; });
            const wc = fullContent.split(/\s+/).filter(Boolean).length;
            await supabase.from("sections").update({ content: fullContent, word_current: wc, status: "complete" }).eq("id", sec.id);
            setSections(prev => prev.map(s => s.id === sec.id ? { ...s, content: fullContent, word_current: wc, status: "complete" } : s));
            done++;
          } catch { /* skip failed section */ }
        }
        addMsg(activeChatId, { role: "action", content: `Written ${done}/${pending.length} sections.`, actionType: done > 0 ? "success" : "error" });
        onRefresh();
        break;
      }

      case "write_section": {
        if (!activeAssessmentId) { addMsg(activeChatId, { role: "action", content: "No assessment selected.", actionType: "error" }); break; }
        const needle = (args.section_title || "").toLowerCase();
        const sec = sections.find(s => s.title.toLowerCase() === needle) || sections.find(s => s.title.toLowerCase().includes(needle));
        if (!sec) { addMsg(activeChatId, { role: "action", content: `Section "${args.section_title}" not found.`, actionType: "error" }); break; }
        addMsg(activeChatId, { role: "action", content: `Writing "${sec.title}"…`, actionType: "writing" });
        try {
          const resp = await fetch(`${CHAT_URL}/section-generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({ section: { title: sec.title, word_target: sec.word_target }, model: "google/gemini-2.5-flash" }),
          });
          if (!resp.ok || !resp.body) throw new Error("Stream failed");
          let fullContent = "";
          await readContentAndToolStream(resp.body, p => { fullContent = p; });
          const wc = fullContent.split(/\s+/).filter(Boolean).length;
          await supabase.from("sections").update({ content: fullContent, word_current: wc, status: "complete" }).eq("id", sec.id);
          setSections(prev => prev.map(s => s.id === sec.id ? { ...s, content: fullContent, word_current: wc, status: "complete" } : s));
          addMsg(activeChatId, { role: "action", content: `"${sec.title}" written — ${wc} words.`, actionType: "success" });
          onRefresh();
        } catch (e: any) {
          addMsg(activeChatId, { role: "action", content: `Failed: ${e.message}`, actionType: "error" });
        }
        break;
      }

      case "apply_revision": {
        if (!activeAssessmentId) break;
        const needle = (args.section_title || "").toLowerCase();
        const sec = sections.find(s => s.title.toLowerCase().includes(needle));
        if (!sec?.content) { addMsg(activeChatId, { role: "action", content: `Section "${args.section_title}" not found or empty.`, actionType: "error" }); break; }
        addMsg(activeChatId, { role: "action", content: `Revising "${sec.title}"…`, actionType: "writing" });
        try {
          const resp = await fetch(`${CHAT_URL}/section-revise`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({ section_id: sec.id, assessment_id: activeAssessmentId, feedback: args.feedback, model: "google/gemini-2.5-flash" }),
          });
          if (!resp.ok || !resp.body) throw new Error("Revision stream failed");
          let revised = "";
          await readContentAndToolStream(resp.body, p => { revised = p; });
          const wc = revised.split(/\s+/).filter(Boolean).length;
          await supabase.from("sections").update({ content: revised, word_current: wc }).eq("id", sec.id);
          setSections(prev => prev.map(s => s.id === sec.id ? { ...s, content: revised, word_current: wc } : s));
          addMsg(activeChatId, { role: "action", content: `"${sec.title}" revised.`, actionType: "success" });
        } catch (e: any) {
          addMsg(activeChatId, { role: "action", content: `Revision failed: ${e.message}`, actionType: "error" });
        }
        break;
      }

      case "run_critique": {
        if (!activeAssessmentId) break;
        addMsg(activeChatId, { role: "action", content: "Running quality critique…", actionType: "critiquing" });
        const { data, error } = await supabase.functions.invoke("quality-pass", { body: { assessment_id: activeAssessmentId, model: "google/gemini-2.5-flash" } });
        if (error) { addMsg(activeChatId, { role: "action", content: "Critique failed.", actionType: "error" }); break; }
        addMsg(activeChatId, { role: "action", content: "Quality critique complete.", actionType: "success" });
        if (data?.recommendations?.length) {
          const summary = (data.recommendations as any[]).slice(0, 3).map((r: any) => `- ${r.description}`).join("\n");
          addMsg(activeChatId, { role: "assistant", content: `**Critique Summary**\n\n${summary}` });
        }
        break;
      }

      case "humanise_all": {
        if (!activeAssessmentId) break;
        const complete = sections.filter(s => s.status === "complete" && s.content);
        if (!complete.length) { addMsg(activeChatId, { role: "action", content: "No completed sections to humanise.", actionType: "error" }); break; }
        addMsg(activeChatId, { role: "action", content: `Humanising ${complete.length} section${complete.length > 1 ? "s" : ""}…`, actionType: "humanising" });
        let ok = 0;
        for (const sec of complete) {
          const { data, error } = await supabase.functions.invoke("humanise", { body: { content: sec.content, word_target: sec.word_target, mode: "full", model: "google/gemini-2.5-flash" } });
          if (!error && data?.content) {
            const wc = data.content.split(/\s+/).filter(Boolean).length;
            await supabase.from("sections").update({ content: data.content, word_current: wc }).eq("id", sec.id);
            setSections(prev => prev.map(s => s.id === sec.id ? { ...s, content: data.content, word_current: wc } : s));
            ok++;
          }
        }
        addMsg(activeChatId, { role: "action", content: `Humanised ${ok}/${complete.length} sections.`, actionType: ok > 0 ? "success" : "error" });
        onRefresh();
        break;
      }

      case "edit_proofread": {
        if (!activeAssessmentId) break;
        addMsg(activeChatId, { role: "action", content: "Running edit & proofread…", actionType: "processing" });
        const { error } = await supabase.functions.invoke("edit-proofread", { body: { assessment_id: activeAssessmentId, model: "google/gemini-2.5-flash" } });
        addMsg(activeChatId, { role: "action", content: error ? "Proofread failed." : "Edit & proofread complete.", actionType: error ? "error" : "success" });
        break;
      }

      case "generate_images": {
        if (!activeAssessmentId) break;
        const withContent = sections.filter(s => s.content);
        if (!withContent.length) { addMsg(activeChatId, { role: "action", content: "No written sections to generate images for.", actionType: "error" }); break; }
        addMsg(activeChatId, { role: "action", content: "Generating academic images…", actionType: "generating" });
        const { error } = await supabase.functions.invoke("generate-images", { body: { assessment_id: activeAssessmentId, sections: withContent.map(s => ({ id: s.id, title: s.title, content: s.content })) } });
        addMsg(activeChatId, { role: "action", content: error ? "Image generation failed." : "Images attached to sections.", actionType: error ? "error" : "success" });
        break;
      }

      case "coherence_check": {
        if (!activeAssessmentId) break;
        addMsg(activeChatId, { role: "action", content: "Running coherence analysis…", actionType: "checking" });
        const { data, error } = await supabase.functions.invoke("coherence-pass", { body: { assessment_id: activeAssessmentId, model: "google/gemini-2.5-flash" } });
        if (error) { addMsg(activeChatId, { role: "action", content: "Coherence check failed.", actionType: "error" }); break; }
        addMsg(activeChatId, { role: "action", content: "Coherence analysis complete.", actionType: "success" });
        if (data?.report) addMsg(activeChatId, { role: "assistant", content: `**Coherence Report**\n\n${data.report}` });
        break;
      }

      case "export_document": {
        if (!activeAssessmentId) break;
        if (!args.confirmed) {
          addMsg(activeChatId, { role: "assistant", content: "Are you sure you want to export as **.docx**? Reply **yes, export** to confirm." });
          break;
        }
        addMsg(activeChatId, { role: "action", content: "Opening export…", actionType: "exporting" });
        setTimeout(() => { navigate(`/assessment/${activeAssessmentId}`); setOpen(false); }, 500);
        break;
      }

      case "adjust_word_target": {
        const sec = sections.find(s => s.id === args.section_id || s.title.toLowerCase().includes((args.section_title || "").toLowerCase()));
        if (!sec) break;
        const { error } = await supabase.from("sections").update({ word_target: args.new_target }).eq("id", sec.id);
        if (!error) {
          setSections(prev => prev.map(s => s.id === sec.id ? { ...s, word_target: args.new_target } : s));
          addMsg(activeChatId, { role: "action", content: `Word target for "${sec.title}" updated to ${args.new_target}.`, actionType: "success" });
        }
        break;
      }

      // Conversational tools — ZOE's text response carries the result, no side effects needed
      case "predict_grade":
      case "find_sources":
      case "format_citation":
      case "topic_to_brief":
      case "analyse_brief":
        break;

      default:
        console.warn("Unknown tool:", toolName, args);
    }
  }, [chatId, chatOpen, sections, assessments, user, navigate, gbpToNgn, customWords, onRefresh, addMsg]);

  // ── handleSend ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    addMsg(chatId, { role: "user", content: text });

    // Build history (last 20 user/assistant messages)
    const history = (msgsMap[chatId] || [])
      .filter(m => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
    history.push({ role: "user", content: text });

    // Context for the edge function
    const sectionsSummary = sections.length > 0
      ? sections.map(s => `${s.title}: ${s.word_current}/${s.word_target}w [${s.status}]`).join("\n")
      : undefined;

    // Streaming placeholder
    const assistantId = addMsg(chatId, { role: "assistant", content: "", streaming: true });

    try {
      const resp = await fetch(`${CHAT_URL}/zoe-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: history,
          assessment_title: currentAssessment?.title,
          sections_summary: sectionsSummary,
          model: "google/gemini-2.5-flash",
        }),
      });

      if (!resp.ok || !resp.body) {
        const errMsg = resp.status === 429 ? "Rate limited — please wait."
          : resp.status === 402 ? "Word credits exhausted — please top up."
          : "ZOE is unavailable right now.";
        updateMsg(chatId, assistantId, { content: errMsg, streaming: false });
        setLoading(false);
        return;
      }

      const { content, toolCalls } = await readContentAndToolStream(resp.body, partial => {
        updateMsg(chatId, assistantId, { content: partial, streaming: true });
      });

      // If ZOE only called tools with no text, remove the empty placeholder
      if (!content && toolCalls.length > 0) {
        setMsgsMap(prev => ({
          ...prev,
          [chatId]: (prev[chatId] || []).filter(m => m.id !== assistantId),
        }));
      } else {
        updateMsg(chatId, assistantId, { content, streaming: false });
      }

      for (const tc of toolCalls) {
        let args: Record<string, any> = {};
        try { args = JSON.parse(tc.arguments); } catch { /* malformed JSON */ }
        await executePipeline(tc.name, args, chatOpen || undefined);
      }

    } catch {
      updateMsg(chatId, assistantId, { content: "Connection error. Check your network and try again.", streaming: false });
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, loading, chatId, chatOpen, msgsMap, sections, currentAssessment, addMsg, updateMsg, executePipeline]);

  // ── Tab: Chats ─────────────────────────────────────────────────────────────
  const renderChatsTab = () => (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 bg-white rounded-full px-3 py-2 border border-border/50">
          <Search size={13} className="text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search assessments…"
            className="flex-1 text-[12px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch("")}><X size={11} className="text-muted-foreground" /></button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredAssessments.length === 0 && (
          <div className="text-center py-14 px-6">
            <MessageCircle size={32} className="mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-[13px] font-semibold text-foreground mb-1">
              {search ? "No matches" : "No assessments yet"}
            </p>
            <p className="text-[11px] text-muted-foreground mb-4">
              {search ? "Try a different search." : "Create your first assessment to start chatting with ZOE."}
            </p>
            {!search && (
              <button
                onClick={() => { navigate("/assessment/new"); setOpen(false); }}
                className="px-4 py-2 bg-terracotta text-white text-[12px] font-bold rounded-xl"
              >
                New Assessment
              </button>
            )}
          </div>
        )}
        {filteredAssessments.map(a => {
          const pct = a.word_target > 0 ? Math.round((a.word_current / a.word_target) * 100) : 0;
          const done = a.status === "complete";
          const lastMsg = (msgsMap[a.id] || []).slice(-1)[0];
          return (
            <button
              key={a.id}
              onClick={() => setChatOpen(a.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/60 active:bg-white/80 transition-colors border-b border-border/30 text-left"
            >
              {/* Avatar — shows % */}
              <div className={cn(
                "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold",
                done ? "bg-sage" : "bg-terracotta",
              )}>
                {pct}%
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[13px] font-semibold text-foreground truncate">{a.title}</p>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(a.updated_at)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {lastMsg
                    ? lastMsg.content.slice(0, 45) + (lastMsg.content.length > 45 ? "…" : "")
                    : `${fmt(a.word_current)}/${fmt(a.word_target)}w · ${a.status}`}
                </p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Tab: Write ─────────────────────────────────────────────────────────────
  const renderWriteTab = () => (
    <div className="overflow-y-auto h-full px-3 py-3 space-y-4">
      {/* New assessment CTA */}
      <button
        onClick={() => { navigate("/assessment/new"); setOpen(false); }}
        className="w-full flex items-center gap-3 p-4 bg-terracotta text-white rounded-2xl shadow-md active:scale-[0.98] transition-transform"
      >
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Plus size={20} />
        </div>
        <div className="text-left flex-1">
          <p className="text-[14px] font-bold">New Assessment</p>
          <p className="text-[11px] text-white/70">Start from a brief or topic</p>
        </div>
        <ChevronRight size={18} className="opacity-70" />
      </button>

      {/* Recent assessments */}
      {assessments.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent</p>
          <div className="space-y-2">
            {assessments.slice(0, 4).map(a => {
              const pct = a.word_target > 0 ? Math.round((a.word_current / a.word_target) * 100) : 0;
              return (
                <div key={a.id} className="flex items-center gap-2.5 p-3 bg-white rounded-xl border border-border/40 shadow-sm">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0",
                    a.status === "complete" ? "bg-sage" : "bg-terracotta")}>
                    {pct}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground truncate">{a.title}</p>
                    <p className="text-[10px] text-muted-foreground">{fmt(a.word_current)}/{fmt(a.word_target)}w</p>
                  </div>
                  <button
                    onClick={() => { setChatOpen(a.id); handleSend(`Write all pending sections`); }}
                    className="flex-shrink-0 px-2.5 py-1.5 bg-terracotta/10 text-terracotta text-[11px] font-semibold rounded-lg hover:bg-terracotta/20 transition-colors"
                  >
                    Write All
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions grid */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Write Section",    icon: AlignLeft,         prompt: "Which section would you like me to write?" },
            { label: "Run Critique",     icon: ShieldCheck,       prompt: "Run a quality critique on my assessment." },
            { label: "Humanise All",     icon: Wand2,             prompt: "Humanise all completed sections." },
            { label: "Edit & Proofread", icon: Sparkles,          prompt: "Run an edit and proofread pass." },
            { label: "Generate Images",  icon: Image,             prompt: "Generate academic images for my assessment." },
            { label: "Coherence Check",  icon: Brain,             prompt: "Run a coherence check across all sections." },
            { label: "Predict Grade",    icon: Target,            prompt: "Predict my current grade based on content so far." },
            { label: "Find Sources",     icon: BookOpen,          prompt: "Suggest relevant academic sources for my assessment." },
          ].map(({ label, icon: Icon, prompt }) => (
            <button
              key={label}
              onClick={() => handleSend(prompt)}
              className="flex items-center gap-2 p-3 bg-white rounded-xl border border-border/40 text-left hover:border-terracotta/30 hover:bg-terracotta/5 transition-colors active:scale-[0.97] shadow-sm"
            >
              <Icon size={14} className="text-terracotta flex-shrink-0" />
              <span className="text-[11px] font-medium text-foreground leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Tab: Status ────────────────────────────────────────────────────────────
  const renderStatusTab = () => {
    const wordsUsed = profile?.words_used || 0;
    const wordLimit = profile?.word_limit || 500;
    const isUnlimited = wordLimit >= 1_000_000_000;
    const wordsLeft = isUnlimited ? Infinity : Math.max(0, wordLimit - wordsUsed);
    const quotaPct = isUnlimited ? 100 : Math.min(100, (wordsUsed / wordLimit) * 100);
    const completed = assessments.filter(a => a.status === "complete").length;
    const inProgress = assessments.filter(a => !["complete", "draft"].includes(a.status)).length;
    const totalWritten = assessments.reduce((s, a) => s + a.word_current, 0);

    return (
      <div className="overflow-y-auto h-full px-3 py-3 space-y-3">
        {/* Greeting */}
        <div className="text-center py-2">
          <p className="text-[15px] font-bold text-foreground">Hey, {userName}</p>
          <p className="text-[11px] text-muted-foreground">Here's your progress overview</p>
        </div>

        {/* Quota card */}
        <div className="bg-white rounded-2xl p-4 border border-border/40 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-bold text-foreground">Word Quota</p>
            <span className="text-[10px] font-semibold text-terracotta capitalize px-2 py-0.5 bg-terracotta/10 rounded-full">
              {profile?.tier || "free"}
            </span>
          </div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-2xl font-extrabold text-foreground tabular-nums">
                {isUnlimited ? "∞" : fmt(wordsLeft as number)}
              </p>
              <p className="text-[10px] text-muted-foreground">words remaining</p>
            </div>
            <p className="text-[10px] text-muted-foreground">{fmt(wordsUsed)} used</p>
          </div>
          {!isUnlimited && (
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-terracotta rounded-full transition-all duration-500" style={{ width: `${quotaPct}%` }} />
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Complete",    value: completed,        color: "text-sage",             bg: "bg-sage/10" },
            { label: "In Progress", value: inProgress,       color: "text-terracotta",       bg: "bg-terracotta/10" },
            { label: "Total Words", value: fmt(totalWritten), color: "text-muted-foreground", bg: "bg-muted/30" },
          ].map(s => (
            <div key={s.label} className={cn("rounded-xl p-3 text-center", s.bg)}>
              <p className={cn("text-xl font-extrabold tabular-nums", s.color)}>{s.value}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Activity feed */}
        {assessments.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Activity</p>
            <div className="space-y-1.5">
              {assessments.slice(0, 5).map(a => {
                const pct = a.word_target > 0 ? Math.round((a.word_current / a.word_target) * 100) : 0;
                return (
                  <button
                    key={a.id}
                    onClick={() => setChatOpen(a.id)}
                    className="w-full flex items-center gap-2.5 p-2.5 bg-white rounded-xl border border-border/40 text-left hover:bg-muted/20 transition-colors"
                  >
                    <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", a.status === "complete" ? "bg-sage" : "bg-terracotta")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">{a.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", a.status === "complete" ? "bg-sage" : "bg-terracotta")}
                            style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{pct}%</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(a.updated_at)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Tab: Tools ─────────────────────────────────────────────────────────────
  const renderToolsTab = () => (
    <div className="overflow-y-auto h-full px-3 py-3 space-y-4">
      {/* Pipeline tools */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pipeline Tools</p>
        <div className="space-y-1.5">
          {[
            { label: "Quality Critique",   icon: ShieldCheck,       desc: "AI review of all sections",          prompt: "Run a quality critique on my current assessment." },
            { label: "Coherence Analysis", icon: Brain,             desc: "Check argument flow & consistency",   prompt: "Run a coherence analysis." },
            { label: "Edit & Proofread",   icon: Sparkles,          desc: "Grammar, style, references",         prompt: "Run an edit and proofread pass." },
            { label: "Humanise Writing",   icon: Wand2,             desc: "Remove AI detection markers",        prompt: "Humanise all completed sections." },
            { label: "Generate Images",    icon: Image,             desc: "Academic charts & diagrams",         prompt: "Generate academic images for my sections." },
            { label: "Export Document",    icon: Download,          desc: "Export as .docx",                    prompt: "Export my document." },
            { label: "Find Sources",       icon: BookOpen,          desc: "Suggest academic references",        prompt: "Suggest relevant academic sources." },
            { label: "Format Citation",    icon: Quote,             desc: "Format a reference correctly",       prompt: "Help me format a citation." },
            { label: "Predict Grade",      icon: Target,            desc: "Estimate current grade band",        prompt: "Predict my current grade." },
            { label: "Topic to Brief",     icon: SlidersHorizontal, desc: "Generate full brief from a topic",   prompt: "Generate a full assessment brief from my topic." },
          ].map(({ label, icon: Icon, desc, prompt }) => (
            <button
              key={label}
              onClick={() => handleSend(prompt)}
              className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-border/40 text-left hover:border-terracotta/30 hover:bg-terracotta/5 transition-colors active:scale-[0.98] shadow-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-terracotta/10 flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-terracotta" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Plans</p>
        <div className="space-y-2">
          {TIER_PLANS.map(plan => {
            const ngnAmount = Math.round(plan.gbp * gbpToNgn);
            const isCurrent = profile?.tier === plan.id;
            return (
              <div key={plan.id} className={cn(
                "relative p-3.5 rounded-xl border-2 transition-colors",
                plan.popular ? "border-terracotta bg-terracotta/5" : "border-border/40 bg-white",
              )}>
                {plan.popular && (
                  <span className="absolute -top-2.5 left-3 text-[10px] font-bold text-white bg-terracotta px-2 py-0.5 rounded-full">Popular</span>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-bold text-foreground">{plan.label}</p>
                    <p className="text-[10px] text-muted-foreground">{fmt(plan.words)} words</p>
                    <p className="text-[10px] text-muted-foreground">£{plan.gbp} · ₦{fmt(ngnAmount)}</p>
                  </div>
                  {isCurrent ? (
                    <span className="text-[10px] font-semibold text-sage bg-sage/10 px-2 py-1 rounded-lg flex-shrink-0">Current</span>
                  ) : (
                    <button
                      onClick={() => executePipeline("process_payment", { tier: plan.id })}
                      disabled={payLoading !== null}
                      className={cn(
                        "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex-shrink-0",
                        plan.popular ? "bg-terracotta text-white hover:bg-terracotta/90" : "bg-muted/60 text-foreground hover:bg-muted",
                        payLoading === plan.id && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      {payLoading === plan.id ? <Loader2 size={12} className="animate-spin" /> : "Upgrade"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Custom words */}
          <div className="p-3.5 bg-white rounded-xl border border-border/40">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[12px] font-bold text-foreground">Custom Words</p>
                <p className="text-[10px] text-muted-foreground">₦{NGN_PER_WORD}/word · +1,000 bonus</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" min={100} step={100}
                value={customWords}
                onChange={e => setCustomWords(Number(e.target.value))}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-[hsl(220,20%,96%)] text-sm text-foreground outline-none"
              />
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">₦{fmt(customWords * NGN_PER_WORD)}</span>
            </div>
            <button
              onClick={() => executePipeline("process_payment", { tier: "custom", custom_words: customWords })}
              disabled={payLoading !== null || customWords < 100}
              className="mt-2 w-full py-2.5 bg-terracotta text-white text-[12px] font-bold rounded-xl hover:bg-terracotta/90 transition-colors disabled:opacity-50"
            >
              {payLoading === "custom" ? <Loader2 size={14} className="animate-spin mx-auto" /> : `Buy ${fmt(customWords)} words`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Bottom tab bar ─────────────────────────────────────────────────────────
  const TABS: { id: TabId; label: string; Icon: React.FC<any> }[] = [
    { id: "chats",  label: "Chats",  Icon: MessageCircle },
    { id: "write",  label: "Write",  Icon: AlignLeft },
    { id: "status", label: "Status", Icon: BarChart3 },
    { id: "tools",  label: "Tools",  Icon: Settings },
  ];

  // ── Chat view (when assessment open) ───────────────────────────────────────
  const renderChatView = () => (
    <div className="flex flex-col h-full">
      {/* Section chips */}
      {!sectionsLoading && sections.length > 0 && (
        <div className="flex-shrink-0 flex gap-2 px-3 py-2 overflow-x-auto bg-white/50 border-b border-border/30"
          style={{ scrollbarWidth: "none" }}>
          {sections.map(sec => (
            <button
              key={sec.id}
              onClick={() => handleSend(`Write the ${sec.title} section`)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap",
                sec.status === "complete"
                  ? "bg-sage/10 text-sage border-sage/20"
                  : sec.status === "writing"
                  ? "bg-terracotta/10 text-terracotta border-terracotta/20 animate-pulse"
                  : "bg-muted/60 text-muted-foreground border-border/50 hover:bg-muted",
              )}
            >
              {sec.title.length > 18 ? sec.title.slice(0, 15) + "…" : sec.title}
              <span className="opacity-50 ml-1">{sec.word_current}w</span>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1"
        style={{ backgroundColor: "hsl(30,20%,93%)" }}>
        {currentMsgs.length === 0 && (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-full bg-terracotta/10 flex items-center justify-center mx-auto mb-3">
              <Brain size={20} className="text-terracotta" />
            </div>
            <p className="text-[13px] font-semibold text-foreground">ZOE is ready</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px] mx-auto">
              Ask me to write, critique, humanise, or improve anything.
            </p>
          </div>
        )}
        {currentMsgs.map(msg => <MsgBubble key={msg.id} msg={msg} />)}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-3 py-2.5 bg-white border-t border-border/40">
        <div className="flex items-end gap-2">
          <div className="flex-1 flex items-end bg-[hsl(220,20%,96%)] rounded-2xl border border-border/50 px-3 py-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Message ZOE…"
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent outline-none resize-none text-[13px] text-foreground placeholder:text-muted-foreground leading-5 max-h-[120px] overflow-y-auto"
              style={{ scrollbarWidth: "none" }}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
              input.trim() && !loading
                ? "bg-terracotta text-white shadow-md active:scale-95"
                : "bg-muted text-muted-foreground",
            )}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating ZOE button — hidden when panel is open */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            onClick={() => setOpen(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.08 }}
            className="fixed bottom-[74px] right-4 z-50 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-terracotta text-white shadow-xl flex items-center justify-center"
            style={{ boxShadow: "0 4px 24px hsl(18 50% 53% / 0.45)" }}
          >
            {/* Pulsing ring */}
            <motion.span
              className="absolute inset-0 rounded-full bg-terracotta"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative z-10 text-[11px] font-extrabold tracking-widest">ZOE</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Overlay */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop (mobile only) */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-[59] bg-black/40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              className="fixed inset-0 z-[60] flex flex-col bg-[hsl(220,20%,96%)] md:inset-auto md:right-4 md:bottom-[88px] md:w-[400px] md:h-[600px] md:rounded-2xl md:shadow-2xl md:overflow-hidden"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(24,14%,10%)] text-white flex-shrink-0">
                {chatOpen ? (
                  <button
                    onClick={() => setChatOpen(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
                  >
                    <ArrowLeft size={18} />
                  </button>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">
                    ZOE
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold leading-none truncate">
                    {currentAssessment ? currentAssessment.title : "ZOE"}
                  </p>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    {currentAssessment
                      ? `${currentAssessment.status} · ${currentAssessment.type || "Assessment"}`
                      : "Academic Writing Assistant"}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                  {chatOpen ? (
                    <motion.div
                      key="chat"
                      className="absolute inset-0 flex flex-col"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: "100%", opacity: 0 }}
                      transition={{ type: "spring", damping: 30, stiffness: 320 }}
                    >
                      {renderChatView()}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="tabs"
                      className="absolute inset-0 flex flex-col"
                      initial={{ x: "-15%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: "-15%", opacity: 0 }}
                      transition={{ type: "spring", damping: 30, stiffness: 320 }}
                    >
                      {/* Tab content */}
                      <div className="flex-1 overflow-hidden relative">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeTab}
                            className="absolute inset-0"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                          >
                            {activeTab === "chats"  && renderChatsTab()}
                            {activeTab === "write"  && renderWriteTab()}
                            {activeTab === "status" && renderStatusTab()}
                            {activeTab === "tools"  && renderToolsTab()}
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {/* Bottom tab bar */}
                      <div className="flex-shrink-0 flex items-center bg-white border-t border-border/40">
                        {TABS.map(({ id, label, Icon }) => (
                          <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={cn(
                              "flex-1 flex flex-col items-center gap-0.5 py-2.5 relative transition-colors",
                              activeTab === id ? "text-terracotta" : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <Icon size={18} strokeWidth={activeTab === id ? 2.2 : 1.8} />
                            <span className="text-[9px] font-medium">{label}</span>
                            {activeTab === id && (
                              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-terracotta rounded-full" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default ZoeDashboardChat;
