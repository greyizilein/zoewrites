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

  return null; // layout added next
};

export default ZoeDashboardChat;
