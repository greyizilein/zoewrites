// ── Imports ────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  MessageCircle, X, Send, Paperclip, Trash2, Copy,
  CheckCircle, AlertCircle, Loader2, ChevronRight, Wand2,
  ShieldCheck, Download, Plus,
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
  learning_outcomes?: string | null;
  a_plus_criteria?: string | null;
  constraints_text?: string | null;
}

interface ChartConfig {
  type: "bar" | "line" | "pie" | "area";
  title?: string;
  data: { label: string; value: number; [key: string]: any }[];
  x_label?: string;
  y_label?: string;
}

interface ZoeChatMsg {
  id: string;
  role: "user" | "assistant" | "action";
  content: string;
  streaming?: boolean;
  actionType?: ActionType;
  ts: number;
  chartData?: ChartConfig;
}

interface ZoeDashboardChatProps {
  assessments?: Assessment[];
  profile?: {
    full_name: string | null;
    tier: string;
    words_used: number;
    word_limit: number;
  } | null;
  userName?: string;
  onRefresh?: () => void;
}

export type { ZoeDashboardChatProps };

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

// ── Dynamic greetings ───────────────────────────────────────────────────────
const getGreeting = (name: string): string => {
  const hour = new Date().getHours();
  const n = name || "there";
  const greetings =
    hour < 12
      ? [
          `Good morning ${n}, what are we working on?`,
          `Morning ${n}! What do you have in mind?`,
          `Rise and write, ${n}. How can I help?`,
          `Hey ${n}, ready to start the day strong?`,
          `Good morning ${n}! What's on the agenda today?`,
          `Morning ${n} — what are we building today?`,
        ]
      : hour < 17
      ? [
          `Hey ${n}, what do you have in mind?`,
          `Afternoon ${n}! What shall we tackle?`,
          `Hey ${n}, ready to get some writing done?`,
          `What can I help you with, ${n}?`,
          `Hey there ${n} — what are we working on?`,
          `Afternoon ${n}! Let's make some progress.`,
        ]
      : [
          `Evening ${n}, how can I help tonight?`,
          `Hey ${n}, what are we working on?`,
          `Good evening ${n}! What's on the agenda?`,
          `Hey ${n} — let's get something done tonight.`,
          `Evening ${n}! What do you need?`,
          `Hey there ${n}, what do you have in mind?`,
        ];
  return greetings[Math.floor(Math.random() * greetings.length)];
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

// ── Chart colours ────────────────────────────────────────────────────────────
const CHART_COLORS = ["#c0654a", "#6ba58b", "#4a7ec0", "#c0a44a", "#8b4ac0", "#4ac0b8"];

// ── ChartBlock ───────────────────────────────────────────────────────────────
const ChartBlock: React.FC<{ config: ChartConfig }> = ({ config }) => {
  const { type, title, data, x_label, y_label } = config;

  const renderChart = () => {
    if (type === "pie") {
      return (
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: any) => v.toLocaleString()} />
        </PieChart>
      );
    }
    const commonProps = { data, margin: { top: 8, right: 16, left: 0, bottom: x_label ? 20 : 8 } };
    const axisProps = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} label={x_label ? { value: x_label, position: "insideBottom", offset: -10, fontSize: 10 } : undefined} />
        <YAxis tick={{ fontSize: 10 }} label={y_label ? { value: y_label, angle: -90, position: "insideLeft", fontSize: 10 } : undefined} />
        <Tooltip formatter={(v: any) => v.toLocaleString()} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
      </>
    );
    if (type === "line") {
      return (<LineChart {...commonProps}>{axisProps}<Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} /></LineChart>);
    }
    if (type === "area") {
      return (<AreaChart {...commonProps}>{axisProps}<Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={`${CHART_COLORS[0]}30`} strokeWidth={2} /></AreaChart>);
    }
    return (
      <BarChart {...commonProps}>
        {axisProps}
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    );
  };

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-border/40 bg-white shadow-sm">
      {title && (
        <div className="px-4 py-2.5 border-b border-border/30">
          <p className="text-[12px] font-semibold text-foreground">{title}</p>
        </div>
      )}
      <div className="p-3">
        <ResponsiveContainer width="100%" height={220}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ── MsgBubble ────────────────────────────────────────────────────────────────
const MsgBubble: React.FC<{
  msg: ZoeChatMsg;
  onDelete?: (id: string) => void;
}> = ({ msg, onDelete }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleDownload = () => {
    const text = msg.content;
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ZOE-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-1 group">
        <div className="flex items-end gap-1.5 max-w-[82%]">
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-end mb-1 flex-shrink-0">
            <button onClick={handleCopy} className="w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center hover:bg-muted" title="Copy">
              {copied ? <CheckCircle size={10} className="text-sage" /> : <Copy size={10} className="text-muted-foreground" />}
            </button>
            {onDelete && (
              <button onClick={() => onDelete(msg.id)} className="w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center hover:bg-destructive/20" title="Delete">
                <Trash2 size={10} className="text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-terracotta text-white text-[13px] leading-relaxed shadow-sm whitespace-pre-wrap">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = !msg.content && msg.streaming;
  return (
    <div className="flex items-end gap-2 mb-1 group max-w-[88%]">
      <div className="w-6 h-6 rounded-full bg-terracotta flex items-center justify-center flex-shrink-0 self-end mb-0.5">
        <span className="text-white text-[7px] font-extrabold">Z</span>
      </div>
      <div className="flex-1">
        <div className={cn(
          "px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-white border border-border/40 shadow-sm text-[13px] leading-relaxed text-foreground min-w-[60px]",
          msg.streaming && "opacity-90",
        )}>
          {isEmpty ? (
            <span className="flex gap-1 py-0.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          ) : (
            <>
              {msg.chartData && <ChartBlock config={msg.chartData} />}
              {msg.content && <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>}
              {msg.streaming && <span className="inline-block w-0.5 h-3.5 bg-terracotta animate-pulse ml-0.5 align-middle" />}
            </>
          )}
        </div>
        {!msg.streaming && !isEmpty && (
          <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
            <button onClick={handleCopy} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/70 text-[10px] text-muted-foreground hover:bg-muted" title="Copy">
              {copied ? <><CheckCircle size={9} className="text-sage" /> Copied</> : <><Copy size={9} /> Copy</>}
            </button>
            {msg.content && msg.content.length > 80 && (
              <button onClick={handleDownload} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/70 text-[10px] text-muted-foreground hover:bg-muted" title="Download as .txt">
                <Download size={9} /> Download
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(msg.id)} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/70 text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                <Trash2 size={9} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────
const ZoeDashboardChat: React.FC<ZoeDashboardChatProps> = ({
  assessments = [], profile = null, userName = "there", onRefresh = () => {},
}) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── Panel state — auto-open on desktop, closed on mobile until FAB tapped ──
  const [open, setOpen] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= 768
  );

  // ── Chat state — single "dashboard" chat, no tabs ─────────────────────────
  const [msgs, setMsgs] = useState<ZoeChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Active assessment context (set via tool calls) ─────────────────────────
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);

  // ── Payment state ──────────────────────────────────────────────────────────
  const [gbpToNgn, setGbpToNgn] = useState(2083);
  const [payLoading, setPayLoading] = useState<string | null>(null);
  const [customWords, setCustomWords] = useState(500);

  // ── File upload state ──────────────────────────────────────────────────────
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Dynamic greeting (stable per session open) ─────────────────────────────
  const greeting = useMemo(() => getGreeting(userName), [userName]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentAssessment = activeAssessmentId
    ? assessments.find(a => a.id === activeAssessmentId) || null
    : null;

  // ── Message helpers ────────────────────────────────────────────────────────
  const chatId = "dashboard";

  const addMsg = useCallback((msg: Omit<ZoeChatMsg, "id" | "ts">): string => {
    const id = uid();
    setMsgs(prev => [...prev, { ...msg, id, ts: Date.now() }]);
    if (!msg.streaming && user?.id) {
      const persistContent = msg.chartData
        ? `__chart__:${JSON.stringify(msg.chartData)}\n${msg.content}`
        : msg.content;
      supabase.from("chat_messages" as any).insert({
        id, user_id: user.id, chat_id: chatId,
        role: msg.role, content: persistContent,
        action_type: msg.actionType ?? null,
      }).then(() => {});
    }
    return id;
  }, [user]);

  const updateMsg = useCallback((msgId: string, patch: Partial<ZoeChatMsg>) => {
    setMsgs(prev => prev.map(m => m.id === msgId ? { ...m, ...patch } : m));
    if (patch.streaming === false && user?.id) {
      supabase.from("chat_messages" as any).upsert({
        id: msgId, user_id: user.id, chat_id: chatId,
        role: "assistant", content: patch.content ?? "",
        action_type: null,
      }).then(() => {});
    }
  }, [user]);

  const deleteMsg = useCallback((msgId: string) => {
    setMsgs(prev => prev.filter(m => m.id !== msgId));
    supabase.from("chat_messages" as any).delete().eq("id", msgId).then(() => {});
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Load chat history from DB on mount (once user is available)
  useEffect(() => {
    if (!user?.id) return;
    if (msgs.length > 0) return;
    supabase.from("chat_messages" as any)
      .select("id, role, content, action_type, created_at")
      .eq("user_id", user.id).eq("chat_id", chatId)
      .order("created_at", { ascending: true }).limit(120)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const loaded: ZoeChatMsg[] = (data as any[]).map(r => {
          const raw: string = r.content || "";
          let content = raw;
          let chartData: ChartConfig | undefined;
          if (raw.startsWith("__chart__:")) {
            const nl = raw.indexOf("\n");
            try { chartData = JSON.parse(raw.slice(10, nl === -1 ? undefined : nl)); } catch { /* ignore */ }
            content = nl === -1 ? "" : raw.slice(nl + 1);
          }
          return { id: r.id, role: r.role as ZoeChatMsg["role"], content, chartData, actionType: r.action_type ?? undefined, ts: new Date(r.created_at).getTime() };
        });
        setMsgs(loaded);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Fetch live GBP→NGN rate once on mount
  useEffect(() => {
    supabase.functions.invoke("currency-rate").then(({ data }) => {
      if (data?.gbp_to_ngn) setGbpToNgn(data.gbp_to_ngn);
    });
  }, []);

  // Load sections whenever activeAssessmentId changes
  useEffect(() => {
    if (!activeAssessmentId) { setSections([]); return; }
    supabase
      .from("sections")
      .select("id, title, word_target, word_current, status, content, sort_order, learning_outcomes, a_plus_criteria, constraints_text")
      .eq("assessment_id", activeAssessmentId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => { setSections((data || []) as Section[]); });
  }, [activeAssessmentId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 150);
  }, [open]);

  // ── executePipeline ────────────────────────────────────────────────────────
  const executePipeline = useCallback(async (
    toolName: string,
    args: Record<string, any>,
  ) => {
    // Many tools need an assessment — use activeAssessmentId or infer from args
    const assId = args.assessment_id || activeAssessmentId;

    switch (toolName) {

      case "navigate_to": {
        addMsg({ role: "action", content: `Navigating to ${args.route}…`, actionType: "navigating" });
        setTimeout(() => { navigate(args.route); setOpen(false); }, 500);
        break;
      }

      case "create_assessment": {
        addMsg({ role: "action", content: "Opening new assessment…", actionType: "navigating" });
        setTimeout(() => { navigate("/assessment/new"); setOpen(false); }, 500);
        break;
      }

      case "open_assessment": {
        const target = assessments.find(a => a.id === args.assessment_id);
        addMsg({ role: "action", content: `Opening "${target?.title || args.assessment_id}"…`, actionType: "navigating" });
        setActiveAssessmentId(args.assessment_id);
        setTimeout(() => { navigate(`/assessment/${args.assessment_id}`); setOpen(false); }, 500);
        break;
      }

      case "process_payment": {
        const { tier, custom_words } = args;
        if (!user?.email) { addMsg({ role: "action", content: "Not signed in.", actionType: "error" }); break; }
        setPayLoading(tier);
        addMsg({ role: "action", content: `Preparing ${tier} plan…`, actionType: "payment" });
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
              addMsg({ role: "action", content: "Verifying payment…", actionType: "processing" });
              const { data, error } = await supabase.functions.invoke("paystack-verify", {
                body: { reference, tier, custom_words: wordsCount, user_id: user.id },
              });
              if (error || !data?.word_limit) {
                addMsg({ role: "action", content: "Verification failed. Contact support.", actionType: "error" });
              } else {
                addMsg({ role: "action", content: `Payment successful! Plan: ${tier} · ${fmt(data.word_limit)} words.`, actionType: "success" });
                onRefresh();
              }
              setPayLoading(null);
            },
            onClose: () => { addMsg({ role: "action", content: "Payment cancelled.", actionType: "error" }); setPayLoading(null); },
          });
        } catch (e: any) {
          addMsg({ role: "action", content: `Payment error: ${e.message}`, actionType: "error" });
          setPayLoading(null);
        }
        break;
      }

      case "write_all": {
        if (!assId) { addMsg({ role: "action", content: "No assessment selected. Tell me which assessment to work on.", actionType: "error" }); break; }
        setActiveAssessmentId(assId);
        let liveSections = sections;
        if (liveSections.length === 0 || liveSections[0]?.sort_order === undefined) {
          const { data } = await supabase.from("sections")
            .select("id, title, word_target, word_current, status, content, sort_order")
            .eq("assessment_id", assId).order("sort_order", { ascending: true });
          liveSections = (data || []) as Section[];
          if (liveSections.length) setSections(liveSections);
        }
        const pending = liveSections.filter(s => s.status !== "complete");
        if (pending.length === 0) { addMsg({ role: "action", content: "All sections already complete.", actionType: "success" }); break; }
        addMsg({ role: "action", content: `Writing ${pending.length} section${pending.length > 1 ? "s" : ""}…`, actionType: "writing" });
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
          } catch { /* skip */ }
        }
        addMsg({ role: "action", content: `Written ${done}/${pending.length} sections.`, actionType: done > 0 ? "success" : "error" });
        onRefresh();
        break;
      }

      case "write_section": {
        if (!assId) { addMsg({ role: "action", content: "No assessment selected.", actionType: "error" }); break; }
        setActiveAssessmentId(assId);
        let liveSections = sections;
        if (liveSections.length === 0) {
          const { data } = await supabase.from("sections")
            .select("id, title, word_target, word_current, status, content, sort_order")
            .eq("assessment_id", assId).order("sort_order", { ascending: true });
          liveSections = (data || []) as Section[];
          if (liveSections.length) setSections(liveSections);
        }
        const needle = (args.section_title || "").toLowerCase();
        const sec = liveSections.find(s => s.title.toLowerCase() === needle) || liveSections.find(s => s.title.toLowerCase().includes(needle));
        if (!sec) { addMsg({ role: "action", content: `Section "${args.section_title}" not found.`, actionType: "error" }); break; }
        addMsg({ role: "action", content: `Writing "${sec.title}"…`, actionType: "writing" });
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
          addMsg({ role: "action", content: `"${sec.title}" written — ${wc} words.`, actionType: "success" });
          onRefresh();
        } catch {
          addMsg({ role: "action", content: `Failed to write "${sec.title}".`, actionType: "error" });
        }
        break;
      }

      case "apply_revision":
      case "revise_section": {
        if (!assId) break;
        setActiveAssessmentId(assId);
        let liveSections = sections;
        if (liveSections.length === 0) {
          const { data } = await supabase.from("sections")
            .select("id, title, word_target, word_current, status, content, sort_order")
            .eq("assessment_id", assId).order("sort_order", { ascending: true });
          liveSections = (data || []) as Section[];
          if (liveSections.length) setSections(liveSections);
        }
        const needle = (args.section_title || "").toLowerCase();
        const sec = liveSections.find(s => s.title.toLowerCase().includes(needle));
        if (!sec?.content) { addMsg({ role: "action", content: `Section not found or not written.`, actionType: "error" }); break; }
        addMsg({ role: "action", content: `Revising "${sec.title}"…`, actionType: "writing" });
        const { data: revData, error: revErr } = await supabase.functions.invoke("section-revise", {
          body: { content: sec.content, feedback: args.feedback || "Improve quality", word_target: sec.word_target, model: "google/gemini-2.5-flash" },
        });
        if (revErr || !revData?.content) { addMsg({ role: "action", content: "Revision failed.", actionType: "error" }); break; }
        const wc = revData.content.split(/\s+/).filter(Boolean).length;
        await supabase.from("sections").update({ content: revData.content, word_current: wc }).eq("id", sec.id);
        setSections(prev => prev.map(s => s.id === sec.id ? { ...s, content: revData.content, word_current: wc } : s));
        addMsg({ role: "action", content: `"${sec.title}" revised — ${wc} words.`, actionType: "success" });
        onRefresh();
        break;
      }

      case "run_critique":
      case "quality_critique": {
        if (!assId) break;
        setActiveAssessmentId(assId);
        addMsg({ role: "action", content: "Running quality critique…", actionType: "critiquing" });
        const { data, error } = await supabase.functions.invoke("quality-pass", {
          body: { assessment_id: assId, model: "google/gemini-2.5-flash" },
        });
        if (error) { addMsg({ role: "action", content: "Critique failed.", actionType: "error" }); break; }
        addMsg({ role: "action", content: "Critique complete.", actionType: "success" });
        if (data?.recommendations) {
          const summary = (data.recommendations as any[]).slice(0, 3).map((r: any) => `- ${r.description}`).join("\n");
          addMsg({ role: "assistant", content: `**Critique Summary**\n\n${summary}` });
        }
        break;
      }

      case "humanise_all": {
        if (!assId) break;
        setActiveAssessmentId(assId);
        let liveSections = sections;
        if (liveSections.length === 0) {
          const { data } = await supabase.from("sections")
            .select("id, title, word_target, word_current, status, content, sort_order")
            .eq("assessment_id", assId).order("sort_order", { ascending: true });
          liveSections = (data || []) as Section[];
          if (liveSections.length) setSections(liveSections);
        }
        const complete = liveSections.filter(s => s.status === "complete" && s.content);
        if (!complete.length) { addMsg({ role: "action", content: "No completed sections to humanise.", actionType: "error" }); break; }
        addMsg({ role: "action", content: `Humanising ${complete.length} section${complete.length > 1 ? "s" : ""}…`, actionType: "humanising" });
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
        addMsg({ role: "action", content: `Humanised ${ok}/${complete.length} sections.`, actionType: ok > 0 ? "success" : "error" });
        onRefresh();
        break;
      }

      case "edit_proofread": {
        if (!assId) break;
        addMsg({ role: "action", content: "Running edit & proofread…", actionType: "processing" });
        const { error } = await supabase.functions.invoke("edit-proofread", { body: { assessment_id: assId, model: "google/gemini-2.5-flash" } });
        addMsg({ role: "action", content: error ? "Proofread failed." : "Edit & proofread complete.", actionType: error ? "error" : "success" });
        break;
      }

      case "generate_images": {
        if (!assId) break;
        let liveSections = sections;
        if (liveSections.length === 0) {
          const { data } = await supabase.from("sections")
            .select("id, title, word_target, word_current, status, content, sort_order")
            .eq("assessment_id", assId).order("sort_order", { ascending: true });
          liveSections = (data || []) as Section[];
          if (liveSections.length) setSections(liveSections);
        }
        const withContent = liveSections.filter(s => s.content);
        if (!withContent.length) { addMsg({ role: "action", content: "No written sections to generate images for.", actionType: "error" }); break; }
        addMsg({ role: "action", content: "Generating academic images…", actionType: "generating" });
        const { error } = await supabase.functions.invoke("generate-images", { body: { assessment_id: assId, sections: withContent.map(s => ({ id: s.id, title: s.title, content: s.content })) } });
        addMsg({ role: "action", content: error ? "Image generation failed." : "Images attached to sections.", actionType: error ? "error" : "success" });
        break;
      }

      case "coherence_check": {
        if (!assId) break;
        addMsg({ role: "action", content: "Running coherence analysis…", actionType: "checking" });
        const { data, error } = await supabase.functions.invoke("coherence-pass", { body: { assessment_id: assId, model: "google/gemini-2.5-flash" } });
        if (error) { addMsg({ role: "action", content: "Coherence check failed.", actionType: "error" }); break; }
        addMsg({ role: "action", content: "Coherence analysis complete.", actionType: "success" });
        if (data?.report) addMsg({ role: "assistant", content: `**Coherence Report**\n\n${data.report}` });
        break;
      }

      case "export_document": {
        if (!assId) break;
        if (!args.confirmed) {
          addMsg({ role: "assistant", content: "Are you sure you want to export as **.docx**? Reply **yes, export** to confirm." });
          break;
        }
        addMsg({ role: "action", content: "Generating .docx file…", actionType: "exporting" });
        const { data: exportData, error: exportError } = await supabase.functions.invoke("export-docx", { body: { assessment_id: assId } });
        if (exportError || !exportData?.url) {
          addMsg({ role: "action", content: "Export failed.", actionType: "error" });
        } else {
          window.open(exportData.url, "_blank");
          addMsg({ role: "action", content: "Document exported — download started.", actionType: "success" });
        }
        break;
      }

      case "delete_assessment": {
        const target = args.assessment_id
          ? assessments.find(a => a.id === args.assessment_id)
          : currentAssessment;
        if (!target) { addMsg({ role: "action", content: "No assessment specified.", actionType: "error" }); break; }
        if (!args.confirmed) {
          addMsg({ role: "assistant", content: `Are you sure you want to delete **${target.title}**? Reply **yes, delete** to confirm.` });
          break;
        }
        addMsg({ role: "action", content: `Deleting "${target.title}"…`, actionType: "processing" });
        const { error: delError } = await supabase.from("assessments").delete().eq("id", target.id);
        if (delError) {
          addMsg({ role: "action", content: "Delete failed.", actionType: "error" });
        } else {
          if (activeAssessmentId === target.id) setActiveAssessmentId(null);
          addMsg({ role: "action", content: `"${target.title}" has been deleted.`, actionType: "success" });
          onRefresh();
        }
        break;
      }

      // restore_assessment and view_trash removed — no soft-delete column exists

      case "get_recommendations": {
        if (!assId) break;
        let liveSections = sections;
        if (liveSections.length === 0) {
          const { data } = await supabase.from("sections")
            .select("id, title, word_target, word_current, status, content, sort_order")
            .eq("assessment_id", assId).order("sort_order", { ascending: true });
          liveSections = (data || []) as Section[];
          if (liveSections.length) setSections(liveSections);
        }
        const needle = (args.section_title || "").toLowerCase();
        const recSec = needle
          ? liveSections.find(s => s.title.toLowerCase().includes(needle))
          : liveSections.find(s => s.content);
        if (!recSec?.content) { addMsg({ role: "action", content: "No written section found to analyse.", actionType: "error" }); break; }
        addMsg({ role: "action", content: `Getting recommendations for "${recSec.title}"…`, actionType: "checking" });
        const { data: recData, error: recError } = await supabase.functions.invoke("zoe-recommend", { body: { section_id: recSec.id, content: recSec.content } });
        if (recError || !recData) {
          addMsg({ role: "action", content: "Recommendations unavailable.", actionType: "error" });
        } else {
          addMsg({ role: "action", content: "Recommendations ready.", actionType: "success" });
          if (recData.recommendations) {
            const text = (recData.recommendations as string[]).map((r: string) => `- ${r}`).join("\n");
            addMsg({ role: "assistant", content: `**Recommendations for "${recSec.title}"**\n\n${text}` });
          }
        }
        break;
      }

      case "update_assessment_title": {
        if (!assId || !args.new_title) break;
        const { error: titleError } = await supabase.from("assessments").update({ title: args.new_title }).eq("id", assId);
        if (titleError) {
          addMsg({ role: "action", content: "Rename failed.", actionType: "error" });
        } else {
          addMsg({ role: "action", content: `Assessment renamed to "${args.new_title}".`, actionType: "success" });
          onRefresh();
        }
        break;
      }

      case "adjust_word_target": {
        const sec = sections.find(s => s.id === args.section_id || s.title.toLowerCase().includes((args.section_title || "").toLowerCase()));
        if (!sec) break;
        const { error } = await supabase.from("sections").update({ word_target: args.new_target }).eq("id", sec.id);
        if (!error) {
          setSections(prev => prev.map(s => s.id === sec.id ? { ...s, word_target: args.new_target } : s));
          addMsg({ role: "action", content: `Word target for "${sec.title}" updated to ${args.new_target}.`, actionType: "success" });
        }
        break;
      }

      case "sign_out": {
        addMsg({ role: "action", content: "Signing out…", actionType: "navigating" });
        setTimeout(async () => { await signOut(); navigate("/"); setOpen(false); }, 600);
        break;
      }

      case "read_analytics": {
        addMsg({ role: "action", content: "Reading your analytics…", actionType: "processing" });
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: allAssessments } = await supabase.from("assessments")
          .select("id, title, type, status, word_current, word_target, created_at, updated_at")
          .eq("user_id", user?.id || "").order("updated_at", { ascending: false });
        const assessmentIds = (allAssessments || []).map(a => a.id);
        const [{ data: recentSections }, { data: profileData }] = await Promise.all([
          assessmentIds.length > 0
            ? supabase.from("sections").select("status, word_current, word_target, citation_count, updated_at")
                .in("assessment_id", assessmentIds).gte("updated_at", twoWeeksAgo)
            : Promise.resolve({ data: [] as any[] }),
          supabase.from("profiles").select("tier, words_used, word_limit").eq("user_id", user?.id || "").single(),
        ]);
        const all = allAssessments || [];
        const totalWords = all.reduce((s, a) => s + (a.word_current || 0), 0);
        const complete = all.filter(a => a.status === "complete").length;
        const inProgress = all.filter(a => a.status !== "complete").length;
        const secData = recentSections || [];
        const citations = secData.reduce((s, s2) => s + (s2.citation_count || 0), 0);
        const pd = profileData as any;
        const wordsLeft = pd ? Math.max(0, (pd.word_limit || 500) - (pd.words_used || 0)) : "unknown";
        const summary = [
          `**Your ZOE Analytics Summary**`,
          ``,
          `📊 **Assessments:** ${all.length} total · ${complete} complete · ${inProgress} in progress`,
          `✍️ **Words written:** ${totalWords.toLocaleString()} across all assessments`,
          `📚 **Citations found:** ${citations} in recent sections`,
          `💳 **Plan:** ${pd?.tier || "free"} · ${typeof wordsLeft === "number" ? wordsLeft.toLocaleString() : wordsLeft} words remaining`,
          all.length > 0 ? `\n**Recent assessments:**\n${all.slice(0, 5).map(a => `- **${a.title}** — ${a.status} · ${(a.word_current || 0).toLocaleString()}/${(a.word_target || 0).toLocaleString()}w`).join("\n")}` : "",
        ].filter(Boolean).join("\n");
        addMsg({ role: "action", content: "Analytics loaded.", actionType: "success" });
        addMsg({ role: "assistant", content: summary });
        break;
      }

      case "create_full_assessment": {
        if (!user?.id) { addMsg({ role: "action", content: "Not signed in.", actionType: "error" }); break; }
        const { topic_or_brief, word_count = 2000, type = "Essay", citation_style = "Harvard", level = "Undergraduate L6", model = "google/gemini-2.5-flash" } = args;
        if (!topic_or_brief) { addMsg({ role: "action", content: "Please provide a brief or topic.", actionType: "error" }); break; }
        addMsg({ role: "action", content: "Parsing brief…", actionType: "processing" });
        const parseResp = await supabase.functions.invoke("brief-parse", {
          body: { brief_text: topic_or_brief, type, word_count, citation_style, level, model },
        });
        if (parseResp.error) { addMsg({ role: "action", content: "Brief parsing failed.", actionType: "error" }); break; }
        const parsedBrief = parseResp.data?.brief_text || topic_or_brief;
        addMsg({ role: "action", content: "Building execution plan…", actionType: "processing" });
        const planResp = await supabase.functions.invoke("execution-table", {
          body: { brief_text: parsedBrief, type, word_count, citation_style, level, model },
        });
        if (planResp.error || !planResp.data?.sections) { addMsg({ role: "action", content: "Execution plan failed.", actionType: "error" }); break; }
        const planSections: { title: string; word_target: number; framework?: string }[] = planResp.data.sections;
        const totalTarget = planSections.reduce((s, sec) => s + (sec.word_target || 0), 0) || word_count;
        const title = parsedBrief.slice(0, 80).replace(/\n/g, " ").trim() || `${type} — ${level}`;
        const { data: newAssessment, error: assError } = await supabase.from("assessments").insert({
          user_id: user.id, title, type, brief_text: parsedBrief,
          word_target: totalTarget, word_current: 0, status: "planning",
          settings: { citation_style, level, model },
          execution_plan: planResp.data,
        }).select("id").single();
        if (assError || !newAssessment) { addMsg({ role: "action", content: "Failed to create assessment.", actionType: "error" }); break; }
        const sectionRows = planSections.map((sec, i) => ({
          assessment_id: newAssessment.id,
          title: sec.title,
          word_target: sec.word_target || Math.round(totalTarget / planSections.length),
          word_current: 0, status: "pending", sort_order: i,
          framework: sec.framework || null,
        }));
        await supabase.from("sections").insert(sectionRows);
        onRefresh();
        setActiveAssessmentId(newAssessment.id);
        addMsg({ role: "action", content: `Assessment "${title}" created with ${planSections.length} sections.`, actionType: "success" });
        addMsg({ role: "assistant", content: `I've created your assessment **"${title}"** with ${planSections.length} sections:\n\n${planSections.map((s, i) => `${i + 1}. **${s.title}** — ${s.word_target}w`).join("\n")}\n\nTotal: ${totalTarget.toLocaleString()} words. Say **"write all"** to begin writing, or open the assessment to review the plan first.` });
        break;
      }

      case "confirm_execution_plan": {
        if (!assId) { addMsg({ role: "action", content: "No assessment selected.", actionType: "error" }); break; }
        const { data: assData } = await supabase.from("assessments")
          .select("execution_plan, title, word_target, settings").eq("id", assId).single();
        if (!assData?.execution_plan) { addMsg({ role: "action", content: "No execution plan found.", actionType: "error" }); break; }
        const plan = assData.execution_plan as any;
        const planSecs: { title: string; word_target: number; framework?: string }[] = plan.sections || [];
        if (!planSecs.length) { addMsg({ role: "action", content: "Execution plan has no sections.", actionType: "error" }); break; }
        const { data: existingSecs } = await supabase.from("sections").select("id").eq("assessment_id", assId).limit(1);
        if (existingSecs && existingSecs.length > 0) {
          addMsg({ role: "action", content: "Sections already exist for this assessment.", actionType: "success" });
          break;
        }
        addMsg({ role: "action", content: "Confirming plan and creating sections…", actionType: "processing" });
        const secRows = planSecs.map((sec, i) => ({
          assessment_id: assId,
          title: sec.title,
          word_target: sec.word_target || Math.round((assData.word_target || 2000) / planSecs.length),
          word_current: 0, status: "pending", sort_order: i,
          framework: sec.framework || null,
        }));
        await supabase.from("sections").insert(secRows);
        await supabase.from("assessments").update({ status: "writing" }).eq("id", assId);
        const { data: freshSecs } = await supabase.from("sections")
          .select("id, title, word_target, word_current, status, content, sort_order")
          .eq("assessment_id", assId).order("sort_order", { ascending: true });
        if (freshSecs) setSections(freshSecs as Section[]);
        onRefresh();
        addMsg({ role: "action", content: `${planSecs.length} sections created. Ready to write.`, actionType: "success" });
        break;
      }

      case "read_section": {
        if (!assId) { addMsg({ role: "action", content: "No assessment open.", actionType: "error" }); break; }
        const needle = (args.section_title || "").toLowerCase();
        let readSec = sections.find(s => s.title.toLowerCase().includes(needle));
        if (!readSec || !readSec.content) {
          const { data: dbSec } = await supabase.from("sections")
            .select("id, title, content, word_current, word_target, status, sort_order")
            .eq("assessment_id", assId).ilike("title", `%${needle}%`).limit(1).single();
          if (dbSec) readSec = dbSec as Section;
        }
        if (!readSec) { addMsg({ role: "action", content: `Section "${args.section_title}" not found.`, actionType: "error" }); break; }
        if (!readSec.content) { addMsg({ role: "action", content: `"${readSec.title}" hasn't been written yet.`, actionType: "error" }); break; }
        addMsg({ role: "assistant", content: `**${readSec.title}** _(${readSec.word_current}/${readSec.word_target} words · ${readSec.status})_\n\n---\n\n${readSec.content}` });
        break;
      }

      case "read_assessment": {
        if (!assId) { addMsg({ role: "action", content: "No assessment open.", actionType: "error" }); break; }
        addMsg({ role: "action", content: "Loading document…", actionType: "processing" });
        const { data: allSecs } = await supabase.from("sections")
          .select("id, title, content, word_current, word_target, status, sort_order")
          .eq("assessment_id", assId).order("sort_order", { ascending: true });
        const secs = (allSecs || []) as Section[];
        const assessment = assessments.find(a => a.id === assId);
        if (!secs.length) { addMsg({ role: "action", content: "No sections found.", actionType: "error" }); break; }
        const written = secs.filter(s => s.content);
        if (!written.length) {
          const structure = secs.map(s => `- **${s.title}** — ${s.word_target}w (${s.status})`).join("\n");
          addMsg({ role: "assistant", content: `**${assessment?.title || "Assessment"} — Structure**\n\n${structure}\n\nNo sections written yet. Say **"write all"** to begin.` });
          break;
        }
        const fullDoc = written.map(s => `## ${s.title}\n\n${s.content}`).join("\n\n---\n\n");
        const totalWords = written.reduce((sum, s) => sum + (s.word_current || 0), 0);
        addMsg({ role: "assistant", content: `**${assessment?.title || "Assessment"}** — ${written.length}/${secs.length} sections · ${totalWords.toLocaleString()} words\n\n---\n\n${fullDoc}` });
        break;
      }

      case "web_search": {
        if (!args.query) { addMsg({ role: "action", content: "No search query provided.", actionType: "error" }); break; }
        addMsg({ role: "action", content: `Searching the web for "${args.query}"…`, actionType: "processing" });
        const { data: searchData, error: searchErr } = await supabase.functions.invoke("web-search", { body: { query: args.query } });
        if (searchErr || !searchData?.results?.length) {
          addMsg({ role: "action", content: "Web search returned no results.", actionType: "error" });
          break;
        }
        const results = (searchData.results as { title: string; url: string; snippet: string }[])
          .map(r => `**[${r.title}](${r.url})**\n${r.snippet}`).join("\n\n");
        addMsg({ role: "assistant", content: `**Web Results: "${args.query}"**\n\n${results}` });
        break;
      }

      case "render_chart": {
        if (!args.data?.length) { addMsg({ role: "action", content: "No data provided for chart.", actionType: "error" }); break; }
        const chartConfig: ChartConfig = {
          type: args.type || "bar", title: args.title, data: args.data,
          x_label: args.x_label, y_label: args.y_label,
        };
        addMsg({ role: "assistant", content: args.title ? `Here's your **${args.title}** chart:` : "Here's your chart:", chartData: chartConfig });
        break;
      }

      case "update_assessment_settings": {
        if (!assId) { addMsg({ role: "action", content: "No assessment open.", actionType: "error" }); break; }
        const { data: currentAss } = await supabase.from("assessments").select("settings").eq("id", assId).single();
        const existing = (currentAss as any)?.settings || {};
        const updated = {
          ...existing,
          ...(args.citation_style ? { citation_style: args.citation_style } : {}),
          ...(args.level ? { level: args.level } : {}),
          ...(args.model ? { model: args.model } : {}),
        };
        const { error: settingsErr } = await supabase.from("assessments").update({ settings: updated }).eq("id", assId);
        if (settingsErr) {
          addMsg({ role: "action", content: "Settings update failed.", actionType: "error" });
        } else {
          const changes = [
            args.citation_style ? `Citation style → **${args.citation_style}**` : "",
            args.level ? `Academic level → **${args.level}**` : "",
            args.model ? `AI model → **${args.model}**` : "",
          ].filter(Boolean).join(" · ");
          addMsg({ role: "action", content: `Settings updated: ${changes}`, actionType: "success" });
        }
        break;
      }

      case "export_content": {
        const content = args.content || "";
        if (!content) { addMsg({ role: "action", content: "No content to export.", actionType: "error" }); break; }
        const filename = args.filename || "ZOE-output.txt";
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addMsg({ role: "action", content: `Downloaded "${filename}".`, actionType: "success" });
        break;
      }

      case "find_sources": {
        if (!args.topic) { addMsg({ role: "action", content: "No topic specified.", actionType: "error" }); break; }
        addMsg({ role: "action", content: `Searching Semantic Scholar for "${args.topic}"…`, actionType: "processing" });
        const { data: srcData, error: srcErr } = await supabase.functions.invoke("web-search", {
          body: { query: `${args.topic} academic research paper site:semanticscholar.org OR site:scholar.google.com` },
        });
        try {
          const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(args.topic)}&limit=${Math.min(args.count || 5, 8)}&fields=title,authors,year,journal,externalIds,citationCount`;
          const ssResp = await fetch(ssUrl, { headers: { "User-Agent": "ZOEWrites/1.0" } });
          if (ssResp.ok) {
            const ssJson = await ssResp.json();
            const papers = (ssJson.data || []) as any[];
            if (papers.length) {
              const style = args.citation_style || "Harvard";
              const formatted = papers.map((p: any) => {
                const authors = (p.authors || []).slice(0, 3).map((a: any) => {
                  const parts = a.name.split(" ");
                  return style === "Harvard" || style === "APA"
                    ? `${parts[parts.length - 1]}, ${parts.slice(0, -1).map((n: string) => n[0]).join(". ")}.`
                    : a.name;
                }).join(style === "Harvard" ? ", " : " and ");
                const doi = p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : "";
                const journal = p.journal?.name || "Unpublished";
                const year = p.year || "n.d.";
                const citations = p.citationCount ? ` _(cited ${p.citationCount}×)_` : "";
                if (style === "Harvard") {
                  return `- ${authors} (${year}) '${p.title}', _${journal}_${doi ? `. Available at: ${doi}` : ""}${citations}`;
                } else if (style === "APA") {
                  return `- ${authors} (${year}). ${p.title}. _${journal}_${doi ? `. ${doi}` : ""}${citations}`;
                } else {
                  return `- ${p.title} — ${authors} (${year})${doi ? ` · [DOI](${doi})` : ""}${citations}`;
                }
              }).join("\n");
              addMsg({ role: "assistant", content: `**Real Academic Sources for "${args.topic}"** (via Semantic Scholar)\n\n${formatted}\n\n_These are verified papers. Always check the original source before citing._` });
              break;
            }
          }
        } catch { /* fallthrough */ }
        if (!srcErr && srcData?.results?.length) {
          const results = (srcData.results as { title: string; url: string; snippet: string }[])
            .map(r => `- **[${r.title}](${r.url})**\n  ${r.snippet}`).join("\n\n");
          addMsg({ role: "assistant", content: `**Sources for "${args.topic}"**\n\n${results}\n\n_Verify all sources before citing._` });
        } else {
          addMsg({ role: "action", content: "Could not retrieve live sources.", actionType: "error" });
        }
        break;
      }

      case "predict_grade": {
        addMsg({ role: "action", content: "Grade prediction is on the way — this feature is coming soon.", actionType: "processing" });
        break;
      }

      case "format_citation": {
        // The AI handles citation formatting in its text response; no client action needed.
        break;
      }

      case "topic_to_brief":
      case "analyse_brief": {
        // Brief analysis is handled entirely by the AI's text response.
        break;
      }

      case "get_section_context": {
        // Section context is already injected via sections_summary in the API call.
        break;
      }

      default:
        console.warn("Unknown tool:", toolName, args);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAssessmentId, sections, assessments, user, signOut, navigate, gbpToNgn, customWords, onRefresh, addMsg, toast]);

  // ── handleSend ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if ((!text && attachedFiles.length === 0) || loading) return;
    setInput("");
    setLoading(true);

    // Upload any attached files first
    let uploadedAttachments: { name: string; url: string; type: string }[] = [];
    if (attachedFiles.length > 0) {
      if (!user?.id) {
        toast({ title: "Not signed in", description: "You must be logged in to attach files.", variant: "destructive" });
        setLoading(false);
        return;
      }
      setUploadingFiles(true);
      let uploadFailed = false;
      for (const file of attachedFiles) {
        try {
          const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { error: uploadError } = await supabase.storage.from("chat-uploads").upload(path, file);
          if (uploadError) throw uploadError;
          const { data: signedData, error: signError } = await supabase.storage
            .from("chat-uploads").createSignedUrl(path, 3600);
          if (signError) throw signError;
          if (signedData?.signedUrl) {
            uploadedAttachments.push({ name: file.name, url: signedData.signedUrl, type: file.type });
            await supabase.from("chat_uploads" as any).insert({
              user_id: user.id, assessment_id: activeAssessmentId || null,
              file_name: file.name, file_size: file.size,
              file_type: file.type, storage_path: path,
            });
          }
        } catch (err: any) {
          uploadFailed = true;
          console.error("[ZOE upload] failed for", file.name, err?.message ?? err);
        }
      }
      if (uploadFailed) {
        toast({ title: "Upload failed", description: "One or more files could not be uploaded. Check the console for details. Your message will still be sent.", variant: "destructive" });
      }
      setAttachedFiles([]);
      setUploadingFiles(false);
    }

    const fileNames = uploadedAttachments.map(f => f.name).join(", ");
    const userContent = [text, fileNames ? `📎 ${fileNames}` : ""].filter(Boolean).join("\n");
    addMsg({ role: "user", content: userContent });

    // Build history (last 20 user/assistant messages)
    const history = msgs
      .filter(m => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
    history.push({ role: "user", content: text });

    // Context for the edge function
    const sectionsSummary = sections.length > 0
      ? sections.map(s => [
          `${s.title}: ${s.word_current}/${s.word_target}w [${s.status}]`,
          s.learning_outcomes  ? `  Outcomes: ${s.learning_outcomes}`   : "",
          s.a_plus_criteria    ? `  A+ Criteria: ${s.a_plus_criteria}`  : "",
          s.constraints_text   ? `  Constraints: ${s.constraints_text}` : "",
        ].filter(Boolean).join("\n")).join("\n\n")
      : undefined;

    const assistantId = addMsg({ role: "assistant", content: "", streaming: true });

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
          attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
          model: "google/gemini-2.5-flash",
        }),
      });

      if (!resp.ok || !resp.body) {
        const errMsg = resp.status === 429 ? "Rate limited — please wait."
          : resp.status === 402 ? "Word credits exhausted — please top up."
          : "ZOE is unavailable right now.";
        updateMsg(assistantId, { content: errMsg, streaming: false });
        setLoading(false);
        return;
      }

      const { content, toolCalls } = await readContentAndToolStream(resp.body, partial => {
        updateMsg(assistantId, { content: partial, streaming: true });
      });

      if (!content && toolCalls.length > 0) {
        setMsgs(prev => prev.filter(m => m.id !== assistantId));
      } else {
        updateMsg(assistantId, { content, streaming: false });
      }

      for (const tc of toolCalls) {
        let args: Record<string, any> = {};
        try {
          args = JSON.parse(tc.arguments);
        } catch {
          addMsg({ role: "action", content: `Could not parse arguments for "${tc.name}".`, actionType: "error" });
          continue;
        }
        try {
          await executePipeline(tc.name, args);
        } catch (toolErr: any) {
          addMsg({ role: "action", content: `"${tc.name}" failed: ${toolErr?.message || "unknown error"}`, actionType: "error" });
        }
      }

    } catch {
      updateMsg(assistantId, { content: "Connection error. Check your network and try again.", streaming: false });
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, loading, msgs, sections, currentAssessment, attachedFiles, user, activeAssessmentId, addMsg, updateMsg, executePipeline]);

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating ZOE button */}
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
            className="fixed bottom-[74px] right-4 z-50 md:hidden w-14 h-14 rounded-full bg-terracotta text-white shadow-xl flex items-center justify-center"
            style={{ boxShadow: "0 4px 24px hsl(18 50% 53% / 0.45)" }}
          >
            <motion.span
              className="absolute inset-0 rounded-full bg-terracotta"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative z-10 text-[11px] font-extrabold tracking-widest">ZOE</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile backdrop (only on mobile when open) */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[59] bg-black/40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Panel:
          Desktop — permanent right column, part of layout flow (always visible)
          Mobile  — fixed full-screen overlay, shown only when open             */}
      <div
        className={cn(
          "flex flex-col bg-[hsl(220,20%,96%)]",
          // Desktop: always-visible layout column
          "md:flex md:relative md:inset-auto md:z-auto md:h-full md:w-[440px] md:flex-shrink-0 md:border-l md:border-border",
          // Mobile: overlay when open, hidden otherwise
          open ? "fixed inset-0 z-[60]" : "hidden",
        )}
      >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(24,14%,10%)] text-white flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">
                  ZOE
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold leading-none truncate">ZOE</p>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    {currentAssessment ? `Working on: ${currentAssessment.title}` : "Your AI assistant"}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="md:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1"
                style={{ backgroundColor: "hsl(30,20%,93%)" }}>
                {/* Empty state with greeting + suggestions */}
                {msgs.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full px-4">
                    <div className="w-16 h-16 rounded-full bg-terracotta flex items-center justify-center mb-4 shadow-md">
                      <span className="text-[13px] font-extrabold text-white tracking-widest">ZOE</span>
                    </div>
                    <p className="text-[15px] font-bold text-foreground text-center">{greeting}</p>
                  </div>
                )}

                {msgs.map(msg => (
                  <MsgBubble
                    key={msg.id}
                    msg={msg}
                    onDelete={id => deleteMsg(id)}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div
                className="flex-shrink-0 bg-white border-t border-border/40"
                style={{ padding: "10px 12px", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
              >
                {/* Attached file chips */}
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {attachedFiles.map((file, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-terracotta/10 text-terracotta text-[11px] font-medium rounded-full">
                        <Paperclip size={10} />
                        {file.name.length > 20 ? file.name.slice(0, 18) + "…" : file.name}
                        <button
                          type="button"
                          onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}
                          className="hover:opacity-70"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  {/* File attach — use <label> for reliable mobile file picker trigger */}
                  <input
                    id="zoe-file-input"
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="*/*"
                    className="hidden"
                    disabled={loading || uploadingFiles}
                    onChange={e => {
                      setAttachedFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || uploadingFiles}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border border-border/50 cursor-pointer transition-colors active:scale-90 select-none",
                      loading || uploadingFiles
                        ? "bg-muted/40 text-muted-foreground/40 pointer-events-none"
                        : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                    title="Attach files"
                  >
                    {uploadingFiles ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={15} />}
                  </button>

                  {/* Text input — white background, clear border, iOS-safe */}
                  <div className="flex-1 flex items-end bg-white rounded-2xl border-2 border-border/80 hover:border-terracotta/30 focus-within:border-terracotta/60 transition-colors px-3 py-2 min-h-[44px]">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Message ZOE…"
                      rows={1}
                      autoCapitalize="sentences"
                      autoCorrect="on"
                      enterKeyHint="send"
                      spellCheck={true}
                      className="flex-1 bg-transparent outline-none resize-none text-[14px] text-foreground placeholder:text-muted-foreground/60 leading-5 max-h-[120px] overflow-y-auto w-full"
                      style={{ scrollbarWidth: "none" }}
                    />
                  </div>

                  {/* Send */}
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={(!input.trim() && attachedFiles.length === 0) || loading}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                      (input.trim() || attachedFiles.length > 0) && !loading
                        ? "bg-terracotta text-white shadow-md active:scale-95"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              </div>
      </div>
    </>
  );
};

export default ZoeDashboardChat;
