import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, useMotionValue } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, Trash2, Minus, X, Send, Paperclip, History, Search, MessageSquare,
  Loader2, ArrowUpRight, Settings, ChevronRight, Copy, Download, Check,
  FileText, FileType, Menu, PanelLeftClose, Palette, ThumbsUp, ThumbsDown, RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { readContentAndToolStream } from "@/lib/sseStream";
import { loadPaystackScript, openPaystackPopup } from "@/lib/paystack";
import { exportTxt, exportDocx, exportPdf } from "@/lib/exportDocs";

// ─────────────────────────── Types ───────────────────────────────────────────

interface Attachment { name: string; url: string; type: string; }

type UploadStatus = "uploading" | "done" | "error";
interface PendingUpload {
  id: string;
  name: string;
  type: string;
  progress: number;
  status: UploadStatus;
  attachment?: Attachment;
}

interface ChartData {
  type: "bar" | "line" | "pie" | "area";
  title?: string;
  data: { label: string; value: number }[];
  x_label?: string;
  y_label?: string;
}

interface ClarificationField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  options?: string[];
  placeholder?: string;
  required?: boolean;
  default?: string;
}
interface ClarificationData {
  intro?: string;
  fields: ClarificationField[];
  submitted?: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  chart?: ChartData;
  clarification?: ClarificationData;
  hidden?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ─────────────────────────── Constants ───────────────────────────────────────

const PAYSTACK_PUBLIC_KEY = "pk_live_e1d5c33f8f38484c592eaad87382adab502a8c1e";
const GBP_TO_NGN = 2083;
const TIER_PRICES_GBP: Record<string, number> = { hello: 15, regular: 45, professional: 110 };

interface WritingSettings {
  citationStyle: string;
  academicLevel: string;
  assessmentType: string;
  writingTone: string;
  humanisationLevel: string;
  sourceDateFrom: number;
  sourceDateTo: number;
}

const DEFAULT_WRITING_SETTINGS: WritingSettings = {
  citationStyle: "Harvard",
  academicLevel: "L7",
  assessmentType: "Essay",
  writingTone: "Analytical",
  humanisationLevel: "High",
  sourceDateFrom: 2015,
  sourceDateTo: 2025,
};
const CHART_COLORS = ["#10b981", "#5c8671", "#7e68a8", "#436fa3", "#c49a30", "#c8556f"];

const QUICK_ACTIONS = [
  { icon: "✍️", label: "Write", prompt: "I need help writing an academic assignment." },
  { icon: "✏️", label: "Edit", prompt: "Can you edit and improve my work?" },
  { icon: "📋", label: "Outline", prompt: "Help me create an outline for my assignment." },
  { icon: "💡", label: "Brainstorm", prompt: "Let us brainstorm ideas for my topic." },
];

// ─────────────────────────── Theme palette (10 colours) ──────────────────────

interface ZoeTheme {
  key: string;
  label: string;
  accent: string;       // primary colour (bubble + send button)
  accentHover: string;  // slightly darker for hover
  accentFg: string;     // text colour on accent
}

const THEMES: ZoeTheme[] = [
  { key: "emerald",    label: "Emerald",    accent: "#10b981", accentHover: "#0ea372", accentFg: "#ffffff" },
  { key: "terracotta", label: "Terracotta", accent: "#c87a55", accentHover: "#b56a47", accentFg: "#ffffff" },
  { key: "sky",        label: "Sky",        accent: "#0ea5e9", accentHover: "#0284c7", accentFg: "#ffffff" },
  { key: "violet",     label: "Violet",     accent: "#8b5cf6", accentHover: "#7c3aed", accentFg: "#ffffff" },
  { key: "rose",       label: "Rose",       accent: "#f43f5e", accentHover: "#e11d48", accentFg: "#ffffff" },
  { key: "amber",      label: "Amber",      accent: "#f59e0b", accentHover: "#d97706", accentFg: "#1a1a1a" },
  { key: "slate",      label: "Slate",      accent: "#64748b", accentHover: "#475569", accentFg: "#ffffff" },
  { key: "teal",       label: "Teal",       accent: "#14b8a6", accentHover: "#0d9488", accentFg: "#ffffff" },
  { key: "indigo",     label: "Indigo",     accent: "#6366f1", accentHover: "#4f46e5", accentFg: "#ffffff" },
  { key: "pink",       label: "Pink",       accent: "#ec4899", accentHover: "#db2777", accentFg: "#ffffff" },
];

const SK = (uid: string) => `zoe_sessions_${uid}`;
const TK = (uid: string) => `zoe_theme_${uid}`;

// ─────────────────────────── Storage helpers ─────────────────────────────────

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

function getAssessmentIdFromUrl(): string | null {
  const m = window.location.pathname.match(/\/assessment\/([^/]+)/);
  return m ? m[1] : null;
}

// ─────────────────────────── File type helper ────────────────────────────────

function fileTypeLabel(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return (({ pdf:"PDF",docx:"DOCX",doc:"DOC",xlsx:"XLSX",xls:"XLS",
    pptx:"PPTX",ppt:"PPT",txt:"TXT",csv:"CSV",json:"JSON",md:"MD",
    png:"PNG",jpg:"JPG",jpeg:"JPG",gif:"GIF",webp:"WEBP" } as Record<string,string>)[ext]
    ?? (ext.toUpperCase() || "FILE"));
}

// ─────────────────────────── Chart component ─────────────────────────────────

function InlineChart({ chart }: { chart: ChartData }) {
  const rechartData = chart.data.map(d => ({ name: d.label, value: d.value }));
  const h = 200;
  const wrap = "w-full mt-3 rounded-xl overflow-hidden bg-white/5 border border-white/10 p-3";

  if (chart.type === "pie") {
    return (
      <div className={wrap}>
        {chart.title && <p className="text-[12px] font-semibold text-white/65 mb-2">{chart.title}</p>}
        <ResponsiveContainer width="100%" height={h}>
          <PieChart>
            <Pie data={rechartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={68}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {rechartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }
  if (chart.type === "line") {
    return (
      <div className={wrap}>
        {chart.title && <p className="text-[12px] font-semibold text-white/65 mb-2">{chart.title}</p>}
        <ResponsiveContainer width="100%" height={h}>
          <LineChart data={rechartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#999" }} />
            <YAxis tick={{ fontSize: 10, fill: "#999" }} />
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  if (chart.type === "area") {
    return (
      <div className={wrap}>
        {chart.title && <p className="text-[12px] font-semibold text-white/65 mb-2">{chart.title}</p>}
        <ResponsiveContainer width="100%" height={h}>
          <AreaChart data={rechartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#999" }} />
            <YAxis tick={{ fontSize: 10, fill: "#999" }} />
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={`${CHART_COLORS[0]}30`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div className={wrap}>
      {chart.title && <p className="text-[12px] font-semibold text-white/65 mb-2">{chart.title}</p>}
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={rechartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#999" }} />
          <YAxis tick={{ fontSize: 10, fill: "#999" }} />
          <Tooltip formatter={(v: number) => v.toLocaleString()} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {rechartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────── Clarification Form ──────────────────────────────

function ClarificationForm({ data, onSubmit, accent }: { data: ClarificationData; onSubmit: (a: Record<string, any>) => void; accent: string; }) {
  const [values, setValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    for (const f of data.fields) {
      init[f.key] = f.type === "checkbox" ? [] : (f.default ?? (f.type === "select" ? (f.options?.[0] ?? "") : ""));
    }
    return init;
  });

  const update = (k: string, v: any) => setValues(prev => ({ ...prev, [k]: v }));
  const canSubmit = data.fields.every(f => {
    if (!f.required) return true;
    const v = values[f.key];
    if (Array.isArray(v)) return v.length > 0;
    return v !== "" && v != null;
  });

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      {data.intro && <p className="text-[13px] text-white/70">{data.intro}</p>}
      {data.fields.map(f => (
        <div key={f.key} className="space-y-1.5">
          <label className="text-[11px] font-semibold text-white/70">
            {f.label}{f.required && <span style={{ color: accent }}> *</span>}
          </label>
          {(f.type === "text" || f.type === "number") && (
            <input type={f.type} placeholder={f.placeholder} value={values[f.key]} onChange={e => update(f.key, e.target.value)}
              className="w-full text-[13px] bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none text-white placeholder:text-white/30 focus:border-white/30" />
          )}
          {f.type === "select" && (
            <select value={values[f.key]} onChange={e => update(f.key, e.target.value)}
              className="w-full text-[13px] bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none text-white cursor-pointer">
              {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {f.type === "checkbox" && (
            <div className="flex flex-wrap gap-1.5">
              {(f.options ?? []).map(o => {
                const checked = (values[f.key] as string[]).includes(o);
                return (
                  <button key={o} type="button"
                    onClick={() => update(f.key, checked ? (values[f.key] as string[]).filter(x => x !== o) : [...(values[f.key] as string[]), o])}
                    style={checked ? { backgroundColor: accent, borderColor: accent, color: "#fff" } : undefined}
                    className={cn("text-[11px] px-3 py-1.5 rounded-full border transition-colors",
                      !checked && "bg-transparent text-white/65 border-white/15 hover:border-white/30")}>
                    {o}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <button type="button" disabled={!canSubmit} onClick={() => onSubmit(values)}
        style={canSubmit ? { backgroundColor: accent, color: "#fff" } : undefined}
        className={cn("mt-1 w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all",
          canSubmit ? "hover:brightness-110 active:scale-[0.98]" : "bg-white/5 text-white/30 cursor-not-allowed")}>
        Submit & continue
      </button>
    </div>
  );
}

// ─────────────────────────── Pending uploads strip ───────────────────────────

function UploadsStrip({ uploads, onRemove, accent }: {
  uploads: PendingUpload[];
  onRemove: (id: string) => void;
  accent: string;
}) {
  if (uploads.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {uploads.map(p => {
        const label = fileTypeLabel(p.name);
        const r = 10, circ = 2 * Math.PI * r;
        return (
          <div key={p.id} className="relative flex items-center gap-2 px-2.5 py-2 bg-white/5 border border-white/10 rounded-xl max-w-[200px]">
            <span className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[9px] font-extrabold tracking-wide"
              style={{ backgroundColor: `${accent}22`, color: accent }}>
              {label}
            </span>
            <span className="text-[11px] text-white/75 font-medium truncate flex-1 min-w-0">
              {p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name}
            </span>
            {p.status === "uploading" && (
              <svg width="22" height="22" viewBox="0 0 24 24" className="flex-shrink-0" style={{ color: accent }}>
                <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5"/>
                <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeDasharray={circ} strokeDashoffset={circ - (p.progress / 100) * circ}
                  strokeLinecap="round" transform="rotate(-90 12 12)"
                  style={{ transition: "stroke-dashoffset 0.15s ease" }}/>
              </svg>
            )}
            {p.status === "done" && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-emerald-400">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {p.status === "error" && (
              <span className="text-[9px] text-red-400 font-semibold flex-shrink-0">Failed</span>
            )}
            <button type="button" onClick={() => onRemove(p.id)}
              className="flex-shrink-0 text-white/30 hover:text-white/70 ml-0.5 leading-none">
              <X size={11}/>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────── Pill composer ───────────────────────────────────

function PillComposer({
  input, setInput, onSend, onAttach, loading, anyUploading, hasContent, placeholder, theme, large,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onAttach: () => void;
  loading: boolean;
  anyUploading: boolean;
  hasContent: boolean;
  placeholder: string;
  theme: ZoeTheme;
  large?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, large ? 200 : 160)}px`;
  }, [input, large]);

  const canSend = hasContent && !loading && !anyUploading;

  return (
    <div className="flex items-end gap-2 w-full bg-[#1a1a1a] border border-white/10 rounded-[28px] px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.6)] focus-within:border-white/25 transition-colors">
      <button
        type="button"
        disabled={loading}
        onClick={onAttach}
        title="Attach"
        className={cn("flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors",
          loading ? "text-white/25 cursor-not-allowed" : "text-white/55 hover:bg-white/10 hover:text-white cursor-pointer")}
      >
        <Plus size={18} />
      </button>
      <textarea
        ref={taRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
        placeholder={placeholder}
        rows={1}
        autoCapitalize="sentences" autoCorrect="on" enterKeyHint="send" spellCheck
        className="flex-1 bg-transparent outline-none resize-none text-white placeholder:text-white/40 leading-relaxed py-2"
        style={{ fontSize: large ? "17px" : "16px", minHeight: "24px", maxHeight: large ? "200px" : "160px", overflowY: "auto", scrollbarWidth: "none", touchAction: "manipulation" }}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        title="Send"
        style={canSend ? { backgroundColor: theme.accent, color: theme.accentFg } : undefined}
        className={cn(
          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all",
          canSend ? "hover:brightness-110 active:scale-95" : "bg-white/10 text-white/30 cursor-not-allowed",
        )}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
      </button>
    </div>
  );
}

// ─────────────────────────── Main component ──────────────────────────────────

export default function ZoeChat({ mode = "widget" }: { mode?: "widget" | "page" }) {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  useLocation();
  const launcherX = useMotionValue(0);
  const launcherY = useMotionValue(0);

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);          // page mode default open on desktop
  const [mobileSidebar, setMobileSidebar] = useState(false);     // mobile slide-over state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; tier: string } | null>(null);

  const [writingSettings, setWritingSettings] = useState<WritingSettings>(DEFAULT_WRITING_SETTINGS);
  const [settingsGroupOpen, setSettingsGroupOpen] = useState({ appearance: true, writing: false, style: false, sources: false });

  const [themeKey, setThemeKey] = useState<string>("emerald");
  const theme = useMemo(() => THEMES.find(t => t.key === themeKey) ?? THEMES[0], [themeKey]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startFileUploadRef = useRef<(file: File) => void>(() => {});

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
    if (!user?.id) return;
    try {
      const saved = localStorage.getItem(`zoe_launcher_pos_${user.id}`);
      if (saved) {
        const { x, y } = JSON.parse(saved);
        launcherX.set(x); launcherY.set(y);
      }
    } catch {}
  }, [user?.id, launcherX, launcherY]);

  // Load persisted writing settings + theme
  useEffect(() => {
    if (!user?.id) return;
    try {
      const s = localStorage.getItem(`zoe_settings_${user.id}`);
      if (s) setWritingSettings(prev => ({ ...prev, ...JSON.parse(s) }));
      const t = localStorage.getItem(TK(user.id));
      if (t && THEMES.some(x => x.key === t)) setThemeKey(t);
    } catch {}
  }, [user?.id]);

  // Native file change listener (Android Chrome quirk)
  useEffect(() => {
    const inputEl = fileInputRef.current;
    if (!inputEl) return;
    const handleNativeChange = (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        Array.from(files).forEach(f => startFileUploadRef.current(f));
        (e.target as HTMLInputElement).value = "";
      }
    };
    inputEl.addEventListener("change", handleNativeChange);
    return () => inputEl.removeEventListener("change", handleNativeChange);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

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

  // ── Upload ────────────────────────────────────────────────────────────────

  async function startFileUpload(file: File) {
    if (!user?.id) return;
    const id = crypto.randomUUID();
    setPendingUploads(prev => [...prev, { id, name: file.name, type: file.type, progress: 0, status: "uploading" }]);
    try {
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data: signedUpload, error: signErr } = await supabase.storage
        .from("chat-uploads").createSignedUploadUrl(path);
      if (signErr || !signedUpload) throw signErr || new Error("No upload URL");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setPendingUploads(prev => prev.map(p => p.id === id
              ? { ...p, progress: Math.round((e.loaded / e.total) * 100) } : p));
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("PUT", signedUpload.signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });

      const { data: readUrl } = await supabase.storage.from("chat-uploads").createSignedUrl(path, 3600);
      if (!readUrl?.signedUrl) throw new Error("No read URL");
      setPendingUploads(prev => prev.map(p => p.id === id
        ? { ...p, progress: 100, status: "done", attachment: { name: file.name, url: readUrl.signedUrl, type: file.type } }
        : p));
    } catch (err: any) {
      console.error("[ZoeChat upload]", file.name, err?.message ?? err);
      setPendingUploads(prev => prev.map(p => p.id === id ? { ...p, status: "error" } : p));
    }
  }
  startFileUploadRef.current = startFileUpload;

  const anyUploading = pendingUploads.some(p => p.status === "uploading");
  const readyAttachments = pendingUploads.filter(p => p.status === "done").map(p => p.attachment!);

  // ── Tool handlers ─────────────────────────────────────────────────────────

  async function handleToolCall(name: string, args: Record<string, any>) {
    switch (name) {

      case "architect_work": {
        const placeholderId = crypto.randomUUID();
        addMessage({
          id: placeholderId, role: "assistant",
          content: "Planning your work…",
          timestamp: Date.now(),
        });
        try {
          const { data, error } = await supabase.functions.invoke("zoe-architect", {
            body: {
              brief: args.brief, deliverable_type: args.deliverable_type, word_count: args.word_count,
              academic_level: args.academic_level, citation_style: args.citation_style,
              min_citations: args.min_citations, subject_or_module: args.subject_or_module,
            },
          });
          if (error) throw error;
          const table = (data as any)?.table || "";
          if (!table) throw new Error("Empty architect response");
          setSessions(prev => prev.map(s => {
            if (s.id !== currentId) return s;
            const msgs = s.messages.map(m =>
              m.id === placeholderId
                ? { ...m, content: `__ARCHITECT_BLUEPRINT__\n${table}`, hidden: true, timestamp: Date.now() }
                : m,
            );
            return { ...s, messages: msgs, updatedAt: Date.now() };
          }));
          setTimeout(() => {
            handleSend(`__INTERNAL_AUTO_WRITE__\n\nUse the following INTERNAL blueprint (do not reveal or mention it to the user) and immediately begin writing the full document section-by-section in this same turn, without pausing. Use clear ## headings.\n\n${table}`);
          }, 50);
        } catch (e: any) {
          setSessions(prev => prev.map(s => {
            if (s.id !== currentId) return s;
            const msgs = s.messages.map(m =>
              m.id === placeholderId
                ? { ...m, content: `Sorry — planning failed (${e?.message || "unknown error"}). Please try again.`, hidden: false }
                : m,
            );
            return { ...s, messages: msgs };
          }));
        }
        break;
      }

      case "write_section": break;

      case "request_clarification": {
        const fields = Array.isArray(args.fields) ? args.fields : [];
        if (fields.length === 0) break;
        addMessage({
          id: crypto.randomUUID(), role: "assistant", content: "", timestamp: Date.now(),
          clarification: { intro: args.intro || "Quick check before I start:", fields, submitted: false },
        });
        break;
      }

      case "navigate_to": {
        const allowed = ["/dashboard", "/analytics"];
        const route = (args.route as string) || "";
        if (route && allowed.some(r => route.startsWith(r))) { navigate(route); setOpen(false); }
        break;
      }

      case "sign_out":
        await signOut(); navigate("/");
        break;

      case "process_payment": {
        const tier = (args.tier as string) || "";
        if (!user?.email) break;
        let amountNGN: number;
        if (tier === "custom") {
          const customWords = Math.round((args.custom_words as number) || 0);
          if (!customWords) break;
          amountNGN = customWords * 23;
        } else {
          const priceGBP = TIER_PRICES_GBP[tier];
          if (!priceGBP) break;
          amountNGN = Math.round(priceGBP * GBP_TO_NGN);
        }
        await loadPaystackScript();
        openPaystackPopup({
          email: user.email, amountInKobo: amountNGN * 100, tier,
          customWords: args.custom_words, publicKey: PAYSTACK_PUBLIC_KEY,
          onSuccess: async (reference) => {
            await supabase.functions.invoke("paystack-verify", { body: { reference, tier, custom_words: args.custom_words ?? 0 } });
            const customWords = args.custom_words as number | undefined;
            addMessage({
              id: crypto.randomUUID(), role: "assistant",
              content: tier === "custom" && customWords
                ? `Payment verified! Your custom word pack of **${customWords.toLocaleString()} words** has been added. Refresh to see your updated allowance.`
                : `Payment verified! Your plan has been upgraded to **${tier}**. Refresh the page to see your new allowance.`,
              timestamp: Date.now(),
            });
          },
          onClose: () => {},
        });
        break;
      }

      case "export_content": {
        if (!args.content) break;
        const blob = new Blob([args.content as string], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = (args.filename as string) || "zoe-export.txt";
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        break;
      }

      case "delete_assessment": {
        if (!args.confirmed) break;
        const aId = (args.assessment_id as string) || getAssessmentIdFromUrl();
        if (!aId) break;
        const { error } = await supabase.from("assessments").delete().eq("id", aId);
        if (!error && window.location.pathname.includes(aId)) navigate("/dashboard");
        break;
      }

      case "update_assessment_settings": {
        const aId = getAssessmentIdFromUrl();
        if (!aId) break;
        const { data } = await supabase.from("assessments").select("settings").eq("id", aId).single();
        const current = (data?.settings as Record<string, any>) || {};
        const updated = { ...current };
        if (args.citation_style) updated.citationStyle = args.citation_style;
        if (args.level) updated.level = args.level;
        if (args.model) updated.model = args.model;
        await supabase.from("assessments").update({ settings: updated }).eq("id", aId);
        break;
      }

      case "render_chart": {
        if (!args.data?.length) break;
        addMessage({
          id: crypto.randomUUID(), role: "assistant", content: "", timestamp: Date.now(),
          chart: { type: args.type || "bar", title: args.title, data: args.data, x_label: args.x_label, y_label: args.y_label },
        });
        break;
      }

      case "coherence_check": {
        const aId = getAssessmentIdFromUrl();
        if (!aId) break;
        const { data } = await supabase.functions.invoke("coherence-pass", { body: { assessment_id: aId } });
        if (data?.result) addMessage({ id: crypto.randomUUID(), role: "assistant", content: data.result, timestamp: Date.now() });
        break;
      }

      case "predict_grade": {
        const aId = getAssessmentIdFromUrl();
        if (!aId) break;
        const { data } = await supabase.functions.invoke("predict-grade", {
          body: { assessment_id: aId, focus_areas: args.focus_areas },
        });
        if (data?.result) addMessage({ id: crypto.randomUUID(), role: "assistant", content: data.result, timestamp: Date.now() });
        break;
      }

      case "confirm_execution_plan": break;

      case "generate_images": {
        const { data: imgData } = await supabase.functions.invoke("generate-images", {
          body: { assessment_id: args.assessment_id, section_id: args.section_id },
        });
        if (imgData?.images?.length) {
          const imgMarkdown = (imgData.images as any[]).map((img: any) =>
            `![${img.caption || "Figure"}](${img.url})\n*${img.caption || ""}*`
          ).join("\n\n");
          addMessage({ id: crypto.randomUUID(), role: "assistant", content: imgMarkdown, timestamp: Date.now() });
        }
        break;
      }

      case "generate_chat_image": {
        const imgPrompt = (args.prompt as string) || "";
        if (!imgPrompt) break;
        addMessage({ id: crypto.randomUUID(), role: "assistant", content: "🎨 Generating image…", timestamp: Date.now() });
        try {
          const { data: genData, error: genErr } = await supabase.functions.invoke("generate-images", {
            body: { prompt: imgPrompt, style: args.style, mode: "chat_inline" },
          });
          if (genErr) throw genErr;
          if (genData?.image_url) {
            setSessions(prev => prev.map(s => {
              if (s.id !== currentId) return s;
              const msgs = [...s.messages];
              const lastIdx = msgs.length - 1;
              if (lastIdx >= 0 && msgs[lastIdx].content === "🎨 Generating image…") {
                msgs[lastIdx] = { ...msgs[lastIdx], content: `![Generated Image](${genData.image_url})\n\n*${imgPrompt}*` };
              }
              return { ...s, messages: msgs };
            }));
          }
        } catch {
          addMessage({ id: crypto.randomUUID(), role: "assistant", content: "Image generation failed — please try again.", timestamp: Date.now() });
        }
        break;
      }
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if ((!text && readyAttachments.length === 0) || loading || anyUploading) return;
    setInput(""); setLoading(true); setStreaming("");

    const uploadedAttachments = readyAttachments;
    setPendingUploads([]);

    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user", content: text, timestamp: Date.now(),
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
    };
    addMessage(userMsg);

    const history = [...(currentSession?.messages ?? []), userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      abortRef.current = new AbortController();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoe-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ messages: history, attachments: uploadedAttachments, writingSettings, tier: profile?.tier || "free" }),
        signal: abortRef.current.signal,
      });
      if (!resp.ok || !resp.body) {
        let serverMsg = `API error ${resp.status}`;
        try {
          const errJson = await resp.json();
          if (errJson?.error) serverMsg = errJson.error;
        } catch { /* not JSON */ }
        throw new Error(serverMsg);
      }
      const switched = resp.headers.get("X-Zoe-Model-Switched");
      let fullContent = "";
      const { content, toolCalls } = await readContentAndToolStream(resp.body, chunk => { setStreaming(chunk); fullContent = chunk; });
      setStreaming("");
      const finalContent = content || fullContent;
      if (finalContent) {
        const prefix = switched ? `_(Switched to ${switched} due to capacity.)_\n\n` : "";
        addMessage({ id: crypto.randomUUID(), role: "assistant", content: prefix + finalContent, timestamp: Date.now() });
      }
      for (const tc of toolCalls) {
        try { await handleToolCall(tc.name, JSON.parse(tc.arguments || "{}")); }
        catch (e) { console.warn("[ZoeChat tool]", tc.name, e); }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        const reason = e?.message && e.message !== "Failed to fetch" ? e.message : "Something went wrong — please try again.";
        addMessage({ id: crypto.randomUUID(), role: "assistant", content: reason, timestamp: Date.now() });
      }
    } finally { setLoading(false); setStreaming(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, pendingUploads, loading, currentSession, session, user?.id, writingSettings, profile?.tier]);

  // ── Session management ────────────────────────────────────────────────────

  function handleNewChat() {
    const s = mkSession();
    setSessions(prev => [s, ...prev]);
    setCurrentId(s.id);
    setMobileSidebar(false);
  }

  function handleDeleteSession(id: string) {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (id === currentId) {
        if (next.length === 0) {
          const fresh = mkSession();
          setCurrentId(fresh.id);
          return [fresh];
        }
        setCurrentId(next[0].id);
      }
      return next;
    });
  }

  const filteredSessions = searchQuery
    ? sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  const allMessages = currentSession?.messages ?? [];
  const messages = allMessages.filter(m => !m.hidden && !m.content.startsWith("__ARCHITECT_BLUEPRINT__") && !m.content.startsWith("__INTERNAL_AUTO_WRITE__"));
  const hasMessages = messages.length > 0 || !!streaming;

  if (!user) return null;
  if (!profile || profile.tier === "free") return null;

  const initials = (profile?.full_name || user.email || "U").slice(0, 2).toUpperCase();

  function saveLauncherPos() {
    if (user?.id) {
      localStorage.setItem(`zoe_launcher_pos_${user.id}`, JSON.stringify({ x: launcherX.get(), y: launcherY.get() }));
    }
  }

  function changeWritingSetting<K extends keyof WritingSettings>(key: K, value: WritingSettings[K]) {
    setWritingSettings(prev => {
      const next = { ...prev, [key]: value };
      if (user?.id) localStorage.setItem(`zoe_settings_${user.id}`, JSON.stringify(next));
      return next;
    });
  }

  function changeTheme(key: string) {
    setThemeKey(key);
    if (user?.id) localStorage.setItem(TK(user.id), key);
  }

  // ── Render: WIDGET MODE (legacy, kept minimal — unmounted in routes) ────
  if (mode === "widget") {
    return (
      <>
        <input ref={fileInputRef} type="file" multiple accept="*/*"
          style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          onChange={e => {
            Array.from(e.target.files || []).forEach(f => startFileUploadRef.current(f));
            e.target.value = "";
          }}/>
        {(!open || minimized) && (
          <motion.button drag dragMomentum={false} dragElastic={0}
            style={{ x: launcherX, y: launcherY }} onDragEnd={saveLauncherPos}
            onClick={() => { setOpen(true); setMinimized(false); }} aria-label="Open ZOE"
            className="fixed bottom-20 right-6 md:bottom-6 z-50 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none">
            <span className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: `${theme.accent}66` }}/>
            <span className="relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-[13px] font-extrabold tracking-widest z-10 hover:brightness-110 active:scale-95 transition-all select-none"
              style={{ backgroundColor: theme.accent, color: theme.accentFg }}>
              ZOE
            </span>
          </motion.button>
        )}
      </>
    );
  }

  // ── Render: PAGE MODE (ChatGPT-style layout) ──────────────────────────────
  return (
    <div
      data-zoe-mode="page"
      className="zoe-amoled flex w-full h-screen bg-black text-white overflow-hidden"
      style={{
        ["--zoe-accent" as any]: theme.accent,
        ["--zoe-accent-fg" as any]: theme.accentFg,
        ["--zoe-accent-hover" as any]: theme.accentHover,
      }}
    >
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple accept="*/*"
        style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        onChange={e => {
          Array.from(e.target.files || []).forEach(f => startFileUploadRef.current(f));
          e.target.value = "";
        }}/>

      {/* Mobile sidebar backdrop */}
      {mobileSidebar && (
        <div className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={() => setMobileSidebar(false)} aria-hidden="true" />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={cn(
        "z-50 flex flex-col flex-shrink-0 border-r border-white/[0.08] transition-all duration-300 ease-in-out bg-[#0A0A0A]",
        // Mobile: slide-over fixed
        "fixed inset-y-0 left-0 w-[280px] md:relative md:inset-auto",
        mobileSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        // Desktop: collapsible width
        sidebarOpen ? "md:w-[270px]" : "md:w-0 md:border-r-0 md:overflow-hidden",
      )}>
        {/* Top: brand + collapse */}
        <div className="flex items-center justify-between px-3 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.accent }}>
              <span className="text-[8px] font-extrabold tracking-widest" style={{ color: theme.accentFg }}>ZOE</span>
            </div>
            <span className="text-[14px] font-semibold tracking-tight">ZOE</span>
          </div>
          <button
            onClick={() => { setSidebarOpen(false); setMobileSidebar(false); }}
            title="Collapse sidebar"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* New chat */}
        <div className="px-2">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium text-white/85 hover:bg-white/[0.06] transition-colors border border-white/[0.08]"
          >
            <Plus size={15} /> New chat
          </button>
        </div>

        {/* Search */}
        <div className="px-2 pt-2">
          <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-3 py-2 border border-transparent focus-within:border-white/[0.12] transition-colors">
            <Search size={13} className="text-white/35 flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats"
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-white/35 text-white"
              style={{ fontSize: "16px" }}
            />
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto py-3 px-2">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">Chats</p>
          {filteredSessions.length === 0 && (
            <p className="text-[11px] text-white/30 text-center py-6">No chats yet</p>
          )}
          <div className="space-y-0.5">
            {filteredSessions.map(s => {
              const active = s.id === currentId;
              return (
                <div key={s.id} className="group/row relative">
                  <button
                    onClick={() => { setCurrentId(s.id); setMobileSidebar(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-[13px] truncate transition-colors flex items-center gap-2",
                      active ? "bg-white/[0.08] text-white" : "text-white/65 hover:bg-white/[0.04]",
                    )}
                    style={active ? { boxShadow: `inset 2px 0 0 ${theme.accent}` } : undefined}
                  >
                    <span className="truncate flex-1">{s.title}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                    title="Delete"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover/row:opacity-100 text-white/40 hover:text-white hover:bg-white/[0.08] transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings panel */}
        <div className="border-t border-white/[0.08] flex-shrink-0 overflow-y-auto max-h-[55%]">
          <div className="px-3 pt-3 pb-1 flex items-center gap-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
            <Settings size={10} /> Settings
          </div>

          {/* Appearance */}
          <div className="px-3 pb-1">
            <button onClick={() => setSettingsGroupOpen(p => ({ ...p, appearance: !p.appearance }))}
              className="w-full flex items-center justify-between py-2 text-[12px] font-semibold text-white/80 hover:text-white transition-colors">
              <span className="flex items-center gap-1.5"><Palette size={11} /> Appearance</span>
              <ChevronRight size={11} className={cn("transition-transform", settingsGroupOpen.appearance ? "rotate-90" : "")} />
            </button>
            {settingsGroupOpen.appearance && (
              <div className="pb-3">
                <p className="text-[10px] text-white/45 mb-2">Chat theme</p>
                <div className="grid grid-cols-5 gap-2">
                  {THEMES.map(t => {
                    const active = t.key === themeKey;
                    return (
                      <button
                        key={t.key}
                        onClick={() => changeTheme(t.key)}
                        title={t.label}
                        className={cn(
                          "relative w-full aspect-square rounded-full transition-transform hover:scale-110 active:scale-95",
                          active && "ring-2 ring-offset-2 ring-offset-[#0A0A0A]",
                        )}
                        style={{
                          backgroundColor: t.accent,
                          boxShadow: active ? `0 0 0 2px ${t.accent}` : undefined,
                          ["--tw-ring-color" as any]: t.accent,
                        }}
                      >
                        {active && <Check size={11} className="absolute inset-0 m-auto" style={{ color: t.accentFg }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Writing */}
          <div className="px-3 pb-1 border-t border-white/[0.05]">
            <button onClick={() => setSettingsGroupOpen(p => ({ ...p, writing: !p.writing }))}
              className="w-full flex items-center justify-between py-2 text-[12px] font-semibold text-white/80 hover:text-white transition-colors">
              Writing
              <ChevronRight size={11} className={cn("transition-transform", settingsGroupOpen.writing ? "rotate-90" : "")} />
            </button>
            {settingsGroupOpen.writing && (
              <div className="space-y-1.5 pb-2">
                {[
                  { label: "Citation", key: "citationStyle" as const, opts: ["Harvard","APA 7th","MLA 9th","Chicago","Vancouver","IEEE","OSCOLA"] },
                  { label: "Level", key: "academicLevel" as const, opts: ["L4","L5","L6","L7","Doctoral"] },
                  { label: "Type", key: "assessmentType" as const, opts: ["Essay","Report","Case Study","Dissertation","Literature Review","Research Paper","Reflection"] },
                ].map(({ label, key, opts }) => (
                  <div key={key}>
                    <p className="text-[9px] text-white/40 mb-0.5">{label}</p>
                    <select value={writingSettings[key]} onChange={e => changeWritingSetting(key, e.target.value)}
                      className="w-full text-[11px] bg-white/[0.04] rounded-lg px-2 py-1.5 outline-none border border-white/[0.08] text-white/85 cursor-pointer">
                      {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Style */}
          <div className="px-3 pb-1 border-t border-white/[0.05]">
            <button onClick={() => setSettingsGroupOpen(p => ({ ...p, style: !p.style }))}
              className="w-full flex items-center justify-between py-2 text-[12px] font-semibold text-white/80 hover:text-white transition-colors">
              Style
              <ChevronRight size={11} className={cn("transition-transform", settingsGroupOpen.style ? "rotate-90" : "")} />
            </button>
            {settingsGroupOpen.style && (
              <div className="space-y-1.5 pb-2">
                {[
                  { label: "Tone", key: "writingTone" as const, opts: ["Analytical","Critical","Evaluative","Reflective","Argumentative"] },
                  { label: "Humanisation", key: "humanisationLevel" as const, opts: ["Low","Medium","High"] },
                ].map(({ label, key, opts }) => (
                  <div key={key}>
                    <p className="text-[9px] text-white/40 mb-0.5">{label}</p>
                    <select value={writingSettings[key]} onChange={e => changeWritingSetting(key, e.target.value)}
                      className="w-full text-[11px] bg-white/[0.04] rounded-lg px-2 py-1.5 outline-none border border-white/[0.08] text-white/85 cursor-pointer">
                      {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sources */}
          <div className="px-3 pb-2 border-t border-white/[0.05]">
            <button onClick={() => setSettingsGroupOpen(p => ({ ...p, sources: !p.sources }))}
              className="w-full flex items-center justify-between py-2 text-[12px] font-semibold text-white/80 hover:text-white transition-colors">
              Sources
              <ChevronRight size={11} className={cn("transition-transform", settingsGroupOpen.sources ? "rotate-90" : "")} />
            </button>
            {settingsGroupOpen.sources && (
              <div className="pb-2">
                <p className="text-[9px] text-white/40 mb-1">Date Range</p>
                <div className="flex items-center gap-1.5">
                  <input type="number" value={writingSettings.sourceDateFrom} onChange={e => changeWritingSetting("sourceDateFrom", Number(e.target.value))}
                    className="w-full text-[11px] bg-white/[0.04] rounded-lg px-2 py-1.5 outline-none border border-white/[0.08] text-white/85" />
                  <span className="text-[10px] text-white/40">–</span>
                  <input type="number" value={writingSettings.sourceDateTo} onChange={e => changeWritingSetting("sourceDateTo", Number(e.target.value))}
                    className="w-full text-[11px] bg-white/[0.04] rounded-lg px-2 py-1.5 outline-none border border-white/[0.08] text-white/85" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User footer */}
        <div className="border-t border-white/[0.08] p-3 flex-shrink-0 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${theme.accent}33` }}>
              <span className="text-[10px] font-bold" style={{ color: theme.accent }}>{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-white truncate">{profile?.full_name || user.email}</p>
              <p className="text-[10px] text-white/45 capitalize">{profile?.tier || "free"} plan</p>
            </div>
          </div>
          {profile && !["professional", "unlimited"].includes(profile.tier ?? "") && (
            <button onClick={() => { navigate("/dashboard"); setMobileSidebar(false); }}
              style={{ backgroundColor: theme.accent, color: theme.accentFg }}
              className="w-full py-1.5 text-[11px] font-semibold rounded-lg hover:brightness-110 transition-all">
              Upgrade Plan
            </button>
          )}
        </div>
      </aside>

      {/* ── Main pane ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-black">
        {/* Slim top bar */}
        <header className="flex items-center justify-between px-3 md:px-4 py-2.5 flex-shrink-0 border-b border-white/[0.05]">
          <div className="flex items-center gap-1.5 min-w-0">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} title="Open sidebar"
                className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-white/55 hover:bg-white/[0.06] hover:text-white transition-colors">
                <Menu size={16} />
              </button>
            )}
            <button onClick={() => setMobileSidebar(true)} title="Menu"
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-white/55 hover:bg-white/[0.06] hover:text-white transition-colors">
              <Menu size={16} />
            </button>
            <span className="text-[14px] font-semibold tracking-tight text-white/90">ZOE</span>
          </div>
          <button onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white/55 hover:bg-white/[0.06] hover:text-white transition-colors">
            Dashboard
          </button>
        </header>

        {/* Body */}
        {!hasMessages ? (
          /* Empty state */
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-5 gap-8">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
                style={{ backgroundColor: theme.accent }}>
                <span className="text-[8px] font-extrabold tracking-widest" style={{ color: theme.accentFg }}>ZOE</span>
              </div>
              <h1 className="text-[28px] md:text-[32px] font-semibold tracking-tight">Hi, I&apos;m ZOE.</h1>
              <p className="text-[14px] text-white/45">Your academic writing assistant.</p>
            </div>

            <div className="w-full max-w-3xl">
              <UploadsStrip uploads={pendingUploads} onRemove={(id) => setPendingUploads(prev => prev.filter(x => x.id !== id))} accent={theme.accent} />
              <PillComposer
                input={input} setInput={setInput}
                onSend={() => handleSend()} onAttach={() => fileInputRef.current?.click()}
                loading={loading} anyUploading={anyUploading}
                hasContent={!!input.trim() || readyAttachments.length > 0}
                placeholder="Ask anything"
                theme={theme}
                large
              />
            </div>

            <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
              {QUICK_ACTIONS.map(a => (
                <button key={a.label} onClick={() => handleSend(a.prompt)} disabled={loading}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white/[0.04] rounded-full text-[12px] font-medium text-white/70 border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.07] active:scale-95 transition-all">
                  <span>{a.icon}</span><span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation */
          <>
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-7">
                {messages.map(msg => (
                  <div key={msg.id} className={cn("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "user" ? (
                      <div
                        className="max-w-[85%] px-4 py-2.5 rounded-3xl text-[15px] leading-relaxed shadow-sm"
                        style={{ backgroundColor: theme.accent, color: theme.accentFg }}
                      >
                        <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/20">
                            {msg.attachments.map((a, i) => (
                              <span key={i} className="flex items-center gap-1 text-[10px] opacity-80">
                                <Paperclip size={9} />{a.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full min-w-0 group/msg">
                        {msg.content && (
                          <div className="prose prose-invert prose-sm md:prose-base max-w-none text-[15px] leading-relaxed
                            prose-headings:text-white prose-strong:text-white prose-p:text-white/85
                            prose-table:text-[12px] prose-th:bg-white/5 prose-th:text-white prose-th:font-semibold
                            prose-th:px-2 prose-th:py-1.5 prose-td:px-2 prose-td:py-1.5 prose-td:align-top
                            prose-th:border prose-td:border prose-th:border-white/10 prose-td:border-white/10
                            prose-a:text-white prose-code:text-white">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                        {msg.clarification && !msg.clarification.submitted && (
                          <ClarificationForm
                            data={msg.clarification}
                            accent={theme.accent}
                            onSubmit={(answers) => {
                              setSessions(prev => prev.map(s => s.id !== currentId ? s : ({
                                ...s,
                                messages: s.messages.map(mm => mm.id === msg.id
                                  ? { ...mm, clarification: { ...msg.clarification!, submitted: true } }
                                  : mm),
                              })));
                              const summary = Object.entries(answers)
                                .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                                .join("\n");
                              handleSend(`Here are my answers — proceed immediately:\n${summary}`);
                            }}
                          />
                        )}
                        {msg.chart && <InlineChart chart={msg.chart} />}
                        {msg.content && msg.content.length > 60 && (
                          <div className="flex flex-wrap items-center gap-0.5 mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                setCopiedId(msg.id);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors"
                              title="Copy"
                            >
                              {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                            <button className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors" title="Good response">
                              <ThumbsUp size={12} />
                            </button>
                            <button className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors" title="Bad response">
                              <ThumbsDown size={12} />
                            </button>
                            <button
                              onClick={() => exportDocx(msg.content, "zoe-output.docx")}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors"
                              title="Download .docx"
                            >
                              <FileText size={12} /> .docx
                            </button>
                            <button
                              onClick={() => exportPdf(msg.content, "zoe-output.pdf")}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors"
                              title="Download .pdf"
                            >
                              <FileType size={12} /> .pdf
                            </button>
                            <button
                              onClick={() => exportTxt(msg.content, "zoe-output.txt")}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors"
                              title="Download .txt"
                            >
                              <Download size={12} /> .txt
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {streaming && (
                  <div className="w-full min-w-0">
                    <div className="prose prose-invert prose-sm md:prose-base max-w-none text-[15px] leading-relaxed prose-headings:text-white prose-strong:text-white prose-p:text-white/85">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streaming}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {loading && !streaming && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 py-1">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-2 h-2 rounded-full bg-white/35 animate-bounce"
                          style={{ animationDelay: `${i * 0.18}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Bottom composer */}
            <div className="flex-shrink-0 px-4 md:px-6 pt-2 pb-4 bg-gradient-to-t from-black via-black to-transparent"
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
              <div className="max-w-3xl mx-auto">
                <UploadsStrip uploads={pendingUploads} onRemove={(id) => setPendingUploads(prev => prev.filter(x => x.id !== id))} accent={theme.accent} />
                <PillComposer
                  input={input} setInput={setInput}
                  onSend={() => handleSend()} onAttach={() => fileInputRef.current?.click()}
                  loading={loading} anyUploading={anyUploading}
                  hasContent={!!input.trim() || readyAttachments.length > 0}
                  placeholder="Ask anything"
                  theme={theme}
                />
                <p className="text-center text-[10px] text-white/30 mt-2">ZOE can make mistakes. Verify important information.</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
