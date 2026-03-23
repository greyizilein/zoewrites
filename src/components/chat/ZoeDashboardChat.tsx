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

  return null; // layout added next
};

export default ZoeDashboardChat;
