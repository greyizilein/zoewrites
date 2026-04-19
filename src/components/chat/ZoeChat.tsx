import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, useMotionValue } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Plus, Trash2, Minus, X, Send, Paperclip, History, Search, MessageSquare, Loader2, ChevronDown, Lock, ArrowUpRight, Settings, ChevronRight, Copy, Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { readContentAndToolStream } from "@/lib/sseStream";
import { loadPaystackScript, openPaystackPopup } from "@/lib/paystack";

// ─────────────────────────── Types ───────────────────────────────────────────

interface Attachment { name: string; url: string; type: string; }

type UploadStatus = "uploading" | "done" | "error";
interface PendingUpload {
  id: string;
  name: string;
  type: string;
  progress: number; // 0–100
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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  chart?: ChartData;
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

// ─────────────────────────── Model options ───────────────────────────────────

interface ModelOption {
  id: string;
  label: string;
  badge: string;
  minTier: string[];
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: "google/gemini-3-flash-preview",  label: "Gemini 3 Flash",    badge: "Flash",    minTier: ["hello","regular","professional","unlimited","custom"] },
  { id: "google/gemini-2.5-flash",        label: "Gemini 2.5 Flash",  badge: "Flash 2.5",minTier: ["regular","professional","unlimited","custom"] },
  { id: "google/gemini-2.5-pro",          label: "Gemini 2.5 Pro",    badge: "2.5 Pro",  minTier: ["regular","professional","unlimited","custom"] },
  { id: "google/gemini-2.5-flash-lite",   label: "Flash Lite",        badge: "Lite",     minTier: ["professional","unlimited","custom"] },
  { id: "openai/gpt-5",                   label: "GPT-5",             badge: "GPT-5",    minTier: ["professional","unlimited","custom"] },
  { id: "openai/gpt-5.2",                label: "GPT-5.2",           badge: "GPT-5.2",  minTier: ["professional","unlimited","custom"] },
];

// ─────────────────────────── Writing settings ────────────────────────────────

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
const CHART_COLORS = ["#c87a55", "#5c8671", "#7e68a8", "#436fa3", "#c49a30", "#c8556f"];

const QUICK_ACTIONS = [
  { icon: "✍️", label: "Write", prompt: "I need help writing an academic assignment." },
  { icon: "✏️", label: "Edit", prompt: "Can you edit and improve my work?" },
  { icon: "📋", label: "Outline", prompt: "Help me create an outline for my assignment." },
  { icon: "💡", label: "Brainstorm", prompt: "Let us brainstorm ideas for my topic." },
  { icon: "⚙️", label: "Settings", prompt: "What can you help me with?" },
];

const SK = (uid: string) => `zoe_sessions_${uid}`;

// Marker prefix used by the zoe-architect edge function. Messages whose content
// begins with this token are rendered as architect-table cards with a CTA.
const ARCHITECT_TABLE_MARKER = "<!--ZOE_ARCHITECT_TABLE-->";

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
  const h = 180;

  if (chart.type === "pie") {
    return (
      <div className="w-full mt-3 rounded-xl overflow-hidden bg-white/60 border border-black/8 p-3">
        {chart.title && <p className="text-[12px] font-semibold text-foreground/65 mb-2">{chart.title}</p>}
        <ResponsiveContainer width="100%" height={h}>
          <PieChart>
            <Pie data={rechartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={68} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
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
      <div className="w-full mt-3 rounded-xl overflow-hidden bg-white/60 border border-black/8 p-3">
        {chart.title && <p className="text-[12px] font-semibold text-foreground/65 mb-2">{chart.title}</p>}
        <ResponsiveContainer width="100%" height={h}>
          <LineChart data={rechartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        {chart.x_label && <p className="text-[10px] text-foreground/40 text-center mt-1">{chart.x_label}</p>}
      </div>
    );
  }

  if (chart.type === "area") {
    return (
      <div className="w-full mt-3 rounded-xl overflow-hidden bg-white/60 border border-black/8 p-3">
        {chart.title && <p className="text-[12px] font-semibold text-foreground/65 mb-2">{chart.title}</p>}
        <ResponsiveContainer width="100%" height={h}>
          <AreaChart data={rechartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={`${CHART_COLORS[0]}30`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
        {chart.x_label && <p className="text-[10px] text-foreground/40 text-center mt-1">{chart.x_label}</p>}
      </div>
    );
  }

  // Default: bar
  return (
    <div className="w-full mt-3 rounded-xl overflow-hidden bg-white/60 border border-black/8 p-3">
      {chart.title && <p className="text-[12px] font-semibold text-foreground/65 mb-2">{chart.title}</p>}
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={rechartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: number) => v.toLocaleString()} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {rechartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {chart.x_label && <p className="text-[10px] text-foreground/40 text-center mt-1">{chart.x_label}</p>}
    </div>
  );
}

// ─────────────────────────── Main component ──────────────────────────────────

export default function ZoeChat({ mode = "widget" }: { mode?: "widget" | "page" }) {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  useLocation(); // keep router context fresh
  const launcherX = useMotionValue(0);
  const launcherY = useMotionValue(0);

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; tier: string } | null>(null);

  // Model + writing settings state
  const [selectedModel, setSelectedModel] = useState("google/gemini-3-flash-preview");
  const [writingSettings, setWritingSettings] = useState<WritingSettings>(DEFAULT_WRITING_SETTINGS);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [settingsGroupOpen, setSettingsGroupOpen] = useState({ writing: true, style: false, sources: false });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Callback ref so the stable native event listener can always call the latest version
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
        launcherX.set(x);
        launcherY.set(y);
      }
    } catch {}
  }, [user?.id]);

  // Load persisted model + writing settings
  useEffect(() => {
    if (!user?.id) return;
    try {
      const m = localStorage.getItem(`zoe_model_${user.id}`);
      if (m) setSelectedModel(m);
      const s = localStorage.getItem(`zoe_settings_${user.id}`);
      if (s) setWritingSettings(prev => ({ ...prev, ...JSON.parse(s) }));
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  // Native change listener — Android Chrome sometimes doesn't fire React's
  // synthetic onChange on programmatically triggered file inputs; this catches it.
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    const handleNativeChange = (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        Array.from(files).forEach(f => startFileUploadRef.current(f));
        (e.target as HTMLInputElement).value = "";
      }
    };
    input.addEventListener("change", handleNativeChange);
    return () => input.removeEventListener("change", handleNativeChange);
  }, []); // startFileUploadRef is a stable ref; callback is updated every render

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

  // ── Upload on file-select ─────────────────────────────────────────────────

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

  // Keep the ref current so the stable native event listener always calls the latest closure
  startFileUploadRef.current = startFileUpload;

  // Derived upload state
  const anyUploading = pendingUploads.some(p => p.status === "uploading");
  const readyAttachments = pendingUploads.filter(p => p.status === "done").map(p => p.attachment!);

  // ── Tool handlers ─────────────────────────────────────────────────────────

  async function handleToolCall(name: string, args: Record<string, any>) {
    switch (name) {

      case "architect_work": {
        // Phase 1 of the writing doctrine.
        // Show a placeholder while the architect runs (it can take 30–60 s).
        const placeholderId = crypto.randomUUID();
        addMessage({
          id: placeholderId,
          role: "assistant",
          content: "🧱 Architecting the work… analysing the brief and producing the execution table. This usually takes 30–60 seconds.",
          timestamp: Date.now(),
        });

        try {
          const { data, error } = await supabase.functions.invoke("zoe-architect", {
            body: {
              brief: args.brief,
              deliverable_type: args.deliverable_type,
              word_count: args.word_count,
              academic_level: args.academic_level,
              citation_style: args.citation_style,
              min_citations: args.min_citations,
              subject_or_module: args.subject_or_module,
              tier: profile?.tier || "free",
            },
          });
          if (error) throw error;
          const table = (data as any)?.table || "";
          if (!table) throw new Error("Empty architect response");

          // Replace the placeholder with the real table
          setSessions(prev => prev.map(s => {
            if (s.id !== currentId) return s;
            const msgs = s.messages.map(m =>
              m.id === placeholderId
                ? { ...m, content: table, timestamp: Date.now() }
                : m,
            );
            return { ...s, messages: msgs, updatedAt: Date.now() };
          }));
        } catch (e: any) {
          setSessions(prev => prev.map(s => {
            if (s.id !== currentId) return s;
            const msgs = s.messages.map(m =>
              m.id === placeholderId
                ? { ...m, content: `The architect phase failed: ${e?.message || "unknown error"}. Please try again.` }
                : m,
            );
            return { ...s, messages: msgs };
          }));
        }
        break;
      }

      case "write_section": {
        // Phase 2 marker — the actual prose comes streamed in the assistant message.
        // No client-side action needed; the model writes the section inline.
        break;
      }

      case "navigate_to": {
        const allowed = ["/dashboard", "/analytics"];
        const route = (args.route as string) || "";
        if (route && allowed.some(r => route.startsWith(r))) {
          navigate(route); setOpen(false);
        }
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
          amountNGN = customWords * 23; // ₦23/word
        } else {
          const priceGBP = TIER_PRICES_GBP[tier];
          if (!priceGBP) break;
          amountNGN = Math.round(priceGBP * GBP_TO_NGN);
        }
        await loadPaystackScript();
        openPaystackPopup({
          email: user.email,
          amountInKobo: amountNGN * 100,
          tier,
          customWords: args.custom_words,
          publicKey: PAYSTACK_PUBLIC_KEY,
          onSuccess: async (reference) => {
            await supabase.functions.invoke("paystack-verify", {
              body: { reference, tier, custom_words: args.custom_words ?? 0 },
            });
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
        if (!error) {
          if (window.location.pathname.includes(aId)) navigate("/dashboard");
        }
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
          chart: {
            type: args.type || "bar",
            title: args.title,
            data: args.data,
            x_label: args.x_label,
            y_label: args.y_label,
          },
        });
        break;
      }

      case "coherence_check": {
        const aId = getAssessmentIdFromUrl();
        if (!aId) break;
        const { data } = await supabase.functions.invoke("coherence-pass", { body: { assessment_id: aId } });
        if (data?.result) {
          addMessage({ id: crypto.randomUUID(), role: "assistant", content: data.result, timestamp: Date.now() });
        }
        break;
      }

      case "predict_grade": {
        const aId = getAssessmentIdFromUrl();
        if (!aId) break;
        const { data } = await supabase.functions.invoke("predict-grade", {
          body: { assessment_id: aId, focus_areas: args.focus_areas },
        });
        if (data?.result) {
          addMessage({ id: crypto.randomUUID(), role: "assistant", content: data.result, timestamp: Date.now() });
        }
        break;
      }

      case "confirm_execution_plan":
        // Acknowledged inline by ZOE's text response; no additional action needed
        break;

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
            // Replace the "Generating…" message with the actual image
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

  // ── Send message ──────────────────────────────────────────────────────────

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
        body: JSON.stringify({ messages: history, attachments: uploadedAttachments, model: selectedModel, writingSettings, tier: profile?.tier || "free" }),
        signal: abortRef.current.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`API error ${resp.status}`);
      let fullContent = "";
      const { content, toolCalls } = await readContentAndToolStream(resp.body, chunk => { setStreaming(chunk); fullContent = chunk; });
      setStreaming("");
      if (content || fullContent) {
        addMessage({ id: crypto.randomUUID(), role: "assistant", content: content || fullContent, timestamp: Date.now() });
      }
      for (const tc of toolCalls) {
        try { await handleToolCall(tc.name, JSON.parse(tc.arguments || "{}")); }
        catch (e) { console.warn("[ZoeChat tool]", tc.name, e); }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        addMessage({ id: crypto.randomUUID(), role: "assistant", content: "Something went wrong — please try again.", timestamp: Date.now() });
      }
    } finally { setLoading(false); setStreaming(""); }
  }, [input, pendingUploads, loading, currentSession, session, user?.id]);

  // ── Session management ────────────────────────────────────────────────────

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

  // Only render for subscribed users (free tier does not get ZoeChat)
  if (!user) return null;
  if (!profile || profile.tier === "free") return null;

  const initials = (profile?.full_name || user.email || "U").slice(0, 2).toUpperCase();

  function saveLauncherPos() {
    if (user?.id) {
      localStorage.setItem(
        `zoe_launcher_pos_${user.id}`,
        JSON.stringify({ x: launcherX.get(), y: launcherY.get() })
      );
    }
  }

  function changeModel(id: string) {
    setSelectedModel(id);
    setShowModelPicker(false);
    if (user?.id) localStorage.setItem(`zoe_model_${user.id}`, id);
  }

  function changeWritingSetting<K extends keyof WritingSettings>(key: K, value: WritingSettings[K]) {
    setWritingSettings(prev => {
      const next = { ...prev, [key]: value };
      if (user?.id) localStorage.setItem(`zoe_settings_${user.id}`, JSON.stringify(next));
      return next;
    });
  }

  const currentModelBadge = MODEL_OPTIONS.find(m => m.id === selectedModel)?.badge ?? "Flash";
  const tierAllowed = (minTier: string[]) => profile ? minTier.includes(profile.tier) : false;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Hidden file input — 1×1px at top-left corner (NOT off-viewport, NOT display:none)
          so both iOS Safari and Android Chrome open the native file picker on .click() */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        style={{ position: "fixed", top: "0", left: "0", width: "1px", height: "1px", opacity: 0, pointerEvents: "none" }}
        onChange={e => {
          Array.from(e.target.files || []).forEach(f => startFileUploadRef.current(f));
          e.target.value = "";
        }}
      />

      {/* Launcher — widget mode only */}
      {mode === "widget" && (!open || minimized) && (
        <motion.button
          drag
          dragMomentum={false}
          dragElastic={0}
          style={{ x: launcherX, y: launcherY }}
          onDragEnd={saveLauncherPos}
          onClick={() => { setOpen(true); setMinimized(false); }}
          aria-label="Open ZOE"
          className="fixed bottom-20 right-6 md:bottom-6 z-50 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        >
          <span className="absolute inset-0 rounded-full bg-terracotta/40 animate-ping" />
          <span className="relative w-14 h-14 rounded-full bg-terracotta shadow-lg flex items-center justify-center text-white text-[13px] font-extrabold tracking-widest z-10 hover:brightness-110 active:scale-95 transition-all select-none">
            ZOE
          </span>
        </motion.button>
      )}

      {/* Mobile backdrop — widget mode only */}
      {mode === "widget" && open && !minimized && (
        <div className="fixed inset-0 bg-black/40 z-[55] md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Chat panel */}
      <div className={cn(
        "flex flex-col bg-[#F5F0EB]",
        mode === "page"
          ? "w-full h-screen"
          : cn(
              "fixed z-[60] shadow-2xl transition-all duration-300 ease-in-out",
              "inset-0 md:inset-auto md:top-0 md:right-0 md:h-screen md:w-[420px] md:border-l md:border-black/10",
              open && !minimized
                ? "translate-y-0 md:translate-x-0 opacity-100"
                : "translate-y-full md:translate-y-0 md:translate-x-full opacity-0 pointer-events-none",
            ),
      )}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className={cn(
                "flex w-8 h-8 rounded-lg items-center justify-center transition-colors",
                sidebarOpen ? "bg-terracotta/15 text-terracotta" : "text-foreground/50 hover:bg-black/8",
              )}
              title="Chat history"
              aria-label="Toggle chat history"
              aria-pressed={sidebarOpen}
            >
              <History size={15} />
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
            {mode === "widget" && (
              <button onClick={() => { navigate("/chat"); setOpen(false); }} title="Open full chat" className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground/50 hover:bg-black/8 hover:text-foreground transition-colors">
                <ArrowUpRight size={15} />
              </button>
            )}
            {mode === "page" && (
              <button onClick={() => navigate("/dashboard")} title="Dashboard" className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-foreground/50 hover:bg-black/8 hover:text-foreground transition-colors">
                Dashboard
              </button>
            )}
            {mode === "widget" && (
              <button onClick={() => setMinimized(true)} title="Minimize" className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-foreground/50 hover:bg-black/8 hover:text-foreground transition-colors">
                <Minus size={15} />
              </button>
            )}
            {mode === "widget" && (
              <button onClick={() => { setOpen(false); setMinimized(false); }} title="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground/50 hover:bg-black/8 hover:text-foreground transition-colors">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden relative">

          {/* Sidebar backdrop (mobile only) */}
          {sidebarOpen && (
            <div className="absolute inset-0 z-10 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          )}

          {/* Sidebar */}
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
            {/* ── Settings panel ── */}
            <div className="border-t border-black/8 flex-shrink-0 overflow-y-auto max-h-[40%]">
              <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5 text-[10px] font-semibold text-foreground/40 uppercase tracking-wider">
                <Settings size={10} /> Settings
              </div>

              {/* Writing group */}
              <div className="px-3 pb-1">
                <button onClick={() => setSettingsGroupOpen(p => ({ ...p, writing: !p.writing }))}
                  className="w-full flex items-center justify-between py-1.5 text-[11px] font-semibold text-foreground/70 hover:text-foreground transition-colors">
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
                        <p className="text-[9px] text-foreground/40 mb-0.5">{label}</p>
                        <select value={writingSettings[key]} onChange={e => changeWritingSetting(key, e.target.value)}
                          className="w-full text-[11px] bg-black/5 rounded-lg px-2 py-1 outline-none border border-black/8 text-foreground/80 cursor-pointer">
                          {opts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Style group */}
              <div className="px-3 pb-1 border-t border-black/6">
                <button onClick={() => setSettingsGroupOpen(p => ({ ...p, style: !p.style }))}
                  className="w-full flex items-center justify-between py-1.5 text-[11px] font-semibold text-foreground/70 hover:text-foreground transition-colors">
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
                        <p className="text-[9px] text-foreground/40 mb-0.5">{label}</p>
                        <select value={writingSettings[key]} onChange={e => changeWritingSetting(key, e.target.value)}
                          className="w-full text-[11px] bg-black/5 rounded-lg px-2 py-1 outline-none border border-black/8 text-foreground/80 cursor-pointer">
                          {opts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sources group */}
              <div className="px-3 pb-1 border-t border-black/6">
                <button onClick={() => setSettingsGroupOpen(p => ({ ...p, sources: !p.sources }))}
                  className="w-full flex items-center justify-between py-1.5 text-[11px] font-semibold text-foreground/70 hover:text-foreground transition-colors">
                  Sources
                  <ChevronRight size={11} className={cn("transition-transform", settingsGroupOpen.sources ? "rotate-90" : "")} />
                </button>
                {settingsGroupOpen.sources && (
                  <div className="pb-2">
                    <p className="text-[9px] text-foreground/40 mb-1">Date Range</p>
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={writingSettings.sourceDateFrom} onChange={e => changeWritingSetting("sourceDateFrom", Number(e.target.value))}
                        className="w-full text-[11px] bg-black/5 rounded-lg px-2 py-1 outline-none border border-black/8 text-foreground/80" />
                      <span className="text-[10px] text-foreground/40">–</span>
                      <input type="number" value={writingSettings.sourceDateTo} onChange={e => changeWritingSetting("sourceDateTo", Number(e.target.value))}
                        className="w-full text-[11px] bg-black/5 rounded-lg px-2 py-1 outline-none border border-black/8 text-foreground/80" />
                    </div>
                  </div>
                )}
              </div>
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

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {!hasMessages ? (
              /* ── Empty state: centered large input ── */
              <div className="flex-1 overflow-y-auto flex flex-col items-center px-5 gap-6" style={{ paddingTop: "18%", paddingBottom: "8%" }}>
                <div className="text-center space-y-1.5">
                  <div className="w-11 h-11 rounded-full bg-terracotta mx-auto mb-3 flex items-center justify-center shadow-md">
                    <span className="text-white text-[8px] font-extrabold tracking-widest">ZOE</span>
                  </div>
                  <p className="text-[22px] font-semibold text-foreground tracking-tight">Hi, I&apos;m ZOE.</p>
                  <p className="text-[14px] text-foreground/50 italic">Your academic writing assistant.</p>
                </div>

                {/* Large input card — inlined to avoid unmount/remount on every keystroke */}
                <div className="w-full max-w-[360px]">
                  {pendingUploads.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {pendingUploads.map(p => {
                        const label = fileTypeLabel(p.name);
                        const r = 10, circ = 2 * Math.PI * r;
                        return (
                          <div key={p.id} className="relative flex items-center gap-2 px-2.5 py-2 bg-white border border-black/10 rounded-xl shadow-sm max-w-[190px]">
                            <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-terracotta/10 flex items-center justify-center text-[9px] font-extrabold text-terracotta tracking-wide">
                              {label}
                            </span>
                            <span className="text-[11px] text-foreground/70 font-medium truncate flex-1 min-w-0">
                              {p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name}
                            </span>
                            {p.status === "uploading" && (
                              <svg width="22" height="22" viewBox="0 0 24 24" className="flex-shrink-0 text-terracotta">
                                <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5"/>
                                <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="2.5"
                                  strokeDasharray={circ} strokeDashoffset={circ - (p.progress / 100) * circ}
                                  strokeLinecap="round" transform="rotate(-90 12 12)"
                                  style={{ transition: "stroke-dashoffset 0.15s ease" }}/>
                              </svg>
                            )}
                            {p.status === "done" && (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-green-500">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                            {p.status === "error" && (
                              <span className="text-[9px] text-red-500 font-semibold flex-shrink-0">Failed</span>
                            )}
                            <button type="button"
                              onClick={() => setPendingUploads(prev => prev.filter(x => x.id !== p.id))}
                              className="flex-shrink-0 text-foreground/30 hover:text-foreground/60 ml-0.5 leading-none">
                              <X size={11}/>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="bg-white border border-black/12 focus-within:border-terracotta/50 transition-colors overflow-hidden rounded-2xl shadow-lg shadow-black/5">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="What are we writing today?"
                      rows={1}
                      autoCapitalize="sentences" autoCorrect="on" enterKeyHint="send" spellCheck
                      className="w-full bg-transparent outline-none resize-none text-foreground placeholder:text-foreground/35 leading-relaxed"
                      style={{ fontSize: "18px", minHeight: "96px", maxHeight: "220px", padding: "18px 18px 10px", overflowY: "auto", scrollbarWidth: "none", WebkitUserSelect: "text", touchAction: "manipulation" }}
                    />
                    <div className="flex items-center justify-between px-3 pb-3 pt-1">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", loading ? "text-foreground/25 cursor-not-allowed" : "text-foreground/40 hover:bg-black/6 hover:text-foreground/65 cursor-pointer")}
                      >
                        <Paperclip size={15} />
                      </button>
                      {/* Model picker */}
                      <div className="relative">
                        <button type="button" onClick={() => setShowModelPicker(v => !v)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-foreground/45 hover:bg-black/6 hover:text-foreground/70 transition-colors">
                          {currentModelBadge} <ChevronDown size={10} />
                        </button>
                        {showModelPicker && (
                          <div className="absolute bottom-full mb-1 right-0 z-50 w-48 bg-white rounded-xl shadow-xl border border-black/10 py-1 overflow-hidden">
                            {MODEL_OPTIONS.map(m => {
                              const allowed = tierAllowed(m.minTier);
                              return (
                                <button key={m.id} type="button"
                                  onClick={() => allowed && changeModel(m.id)}
                                  className={cn("w-full flex items-center justify-between px-3 py-2 text-[12px] transition-colors text-left",
                                    selectedModel === m.id ? "bg-terracotta/10 text-terracotta font-semibold" : allowed ? "text-foreground/80 hover:bg-black/5" : "text-foreground/30 cursor-not-allowed")}>
                                  <span>{m.label}</span>
                                  {!allowed && <Lock size={10} className="text-foreground/25" />}
                                  {allowed && selectedModel === m.id && <span className="w-1.5 h-1.5 rounded-full bg-terracotta" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => handleSend()} disabled={(!input.trim() && readyAttachments.length === 0) || loading || anyUploading}
                        className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all", (input.trim() || readyAttachments.length > 0) && !loading && !anyUploading ? "bg-terracotta text-white hover:brightness-110 active:scale-95 shadow-sm" : "bg-black/8 text-foreground/25 cursor-not-allowed")}>
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_ACTIONS.map(a => (
                    <button key={a.label} onClick={() => handleSend(a.prompt)} disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-full text-[12px] font-medium text-foreground/70 border border-black/10 hover:border-terracotta/40 hover:bg-terracotta/5 active:scale-95 transition-all shadow-sm">
                      <span>{a.icon}</span><span>{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* ── Messages ── */}
                <div className="flex-1 overflow-y-auto px-4 py-4 min-w-0" style={{ scrollbarWidth: "thin" }}>
                  <div className="space-y-5 pb-2">
                    {messages.map(msg => (
                      <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                        {msg.role === "user" ? (
                          <div className="max-w-[82%] px-4 py-2.5 bg-terracotta text-white rounded-2xl rounded-br-sm text-[15px] leading-relaxed">
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
                          <div className="w-full min-w-0 group/msg">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div className="w-5 h-5 rounded-full bg-terracotta flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-[6px] font-extrabold tracking-widest">ZOE</span>
                              </div>
                              <span className="text-[11px] font-semibold text-foreground/45 tracking-wide">ZOE</span>
                            </div>
                            {msg.content && (() => {
                              const isArchitect = msg.content.startsWith(ARCHITECT_TABLE_MARKER);
                              const display = isArchitect
                                ? msg.content.slice(ARCHITECT_TABLE_MARKER.length).trimStart()
                                : msg.content;
                              return (
                                <>
                                  {isArchitect && (
                                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-terracotta">
                                      <span className="w-1.5 h-1.5 rounded-full bg-terracotta" />
                                      Execution Blueprint
                                    </div>
                                  )}
                                  <div className={cn(
                                    "prose prose-sm prose-stone max-w-none text-[15px] leading-relaxed",
                                    "prose-table:text-[12px] prose-th:bg-terracotta/10 prose-th:text-foreground prose-th:font-semibold prose-th:px-2 prose-th:py-1.5 prose-td:px-2 prose-td:py-1.5 prose-td:align-top prose-th:border prose-td:border prose-th:border-black/10 prose-td:border-black/10",
                                    isArchitect && "rounded-xl border border-terracotta/25 bg-white/60 p-3 shadow-sm",
                                  )}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{display}</ReactMarkdown>
                                  </div>
                                  {isArchitect && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      <button
                                        onClick={() => handleSend("Begin writing. Start with the first section, write it section by section, and pause until I say next.")}
                                        disabled={loading}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-terracotta text-white text-[12px] font-semibold hover:brightness-110 active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <ChevronRight size={14} />
                                        Begin writing
                                      </button>
                                      <button
                                        onClick={() => handleSend("Revise the execution blueprint — keep the structure but tighten anything that is generic or under-specified.")}
                                        disabled={loading}
                                        className="px-3 py-2 rounded-xl bg-white border border-black/10 text-foreground/70 text-[12px] font-medium hover:bg-black/5 transition-colors disabled:opacity-40"
                                      >
                                        Refine blueprint
                                      </button>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            {msg.chart && <InlineChart chart={msg.chart} />}
                            {/* Copy / Download actions */}
                            {msg.content && msg.content.length > 20 && (
                              <div className="flex items-center gap-1 mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    const text = msg.content.startsWith(ARCHITECT_TABLE_MARKER)
                                      ? msg.content.slice(ARCHITECT_TABLE_MARKER.length).trimStart()
                                      : msg.content;
                                    navigator.clipboard.writeText(text);
                                    setCopiedId(msg.id);
                                    setTimeout(() => setCopiedId(null), 2000);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-foreground/40 hover:bg-black/6 hover:text-foreground/70 transition-colors"
                                  title="Copy"
                                >
                                  {copiedId === msg.id ? <Check size={11} /> : <Copy size={11} />}
                                  {copiedId === msg.id ? "Copied" : "Copy"}
                                </button>
                                <button
                                  onClick={() => {
                                    const text = msg.content.startsWith(ARCHITECT_TABLE_MARKER)
                                      ? msg.content.slice(ARCHITECT_TABLE_MARKER.length).trimStart()
                                      : msg.content;
                                    const blob = new Blob([text], { type: "text/plain" });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url; a.download = "zoe-output.txt";
                                    document.body.appendChild(a); a.click();
                                    document.body.removeChild(a); URL.revokeObjectURL(url);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-foreground/40 hover:bg-black/6 hover:text-foreground/70 transition-colors"
                                  title="Download"
                                >
                                  <Download size={11} /> Download
                                </button>
                              </div>
                            )}
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
                        <div className="prose prose-sm prose-stone max-w-none text-[15px] leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{streaming}</ReactMarkdown>
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
                </div>

                {/* ── Bottom input bar (active chat) — inlined to avoid unmount/remount ── */}
                <div className="flex-shrink-0 border-t border-black/8 px-4 py-3 bg-[#F5F0EB]" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
                  {pendingUploads.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {pendingUploads.map(p => {
                        const label = fileTypeLabel(p.name);
                        const r = 10, circ = 2 * Math.PI * r;
                        return (
                          <div key={p.id} className="relative flex items-center gap-2 px-2.5 py-2 bg-white border border-black/10 rounded-xl shadow-sm max-w-[190px]">
                            <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-terracotta/10 flex items-center justify-center text-[9px] font-extrabold text-terracotta tracking-wide">
                              {label}
                            </span>
                            <span className="text-[11px] text-foreground/70 font-medium truncate flex-1 min-w-0">
                              {p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name}
                            </span>
                            {p.status === "uploading" && (
                              <svg width="22" height="22" viewBox="0 0 24 24" className="flex-shrink-0 text-terracotta">
                                <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5"/>
                                <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="2.5"
                                  strokeDasharray={circ} strokeDashoffset={circ - (p.progress / 100) * circ}
                                  strokeLinecap="round" transform="rotate(-90 12 12)"
                                  style={{ transition: "stroke-dashoffset 0.15s ease" }}/>
                              </svg>
                            )}
                            {p.status === "done" && (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-green-500">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                            {p.status === "error" && (
                              <span className="text-[9px] text-red-500 font-semibold flex-shrink-0">Failed</span>
                            )}
                            <button type="button"
                              onClick={() => setPendingUploads(prev => prev.filter(x => x.id !== p.id))}
                              className="flex-shrink-0 text-foreground/30 hover:text-foreground/60 ml-0.5 leading-none">
                              <X size={11}/>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="bg-white border border-black/12 focus-within:border-terracotta/50 transition-colors overflow-hidden rounded-2xl">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Message ZOE…"
                      rows={1}
                      autoCapitalize="sentences" autoCorrect="on" enterKeyHint="send" spellCheck
                      className="w-full bg-transparent outline-none resize-none text-foreground placeholder:text-foreground/35 leading-relaxed"
                      style={{ fontSize: "18px", minHeight: "52px", maxHeight: "160px", padding: "14px 16px 10px", overflowY: "auto", scrollbarWidth: "none", WebkitUserSelect: "text", touchAction: "manipulation" }}
                    />
                    <div className="flex items-center justify-between px-3 pb-3 pt-1">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", loading ? "text-foreground/25 cursor-not-allowed" : "text-foreground/40 hover:bg-black/6 hover:text-foreground/65 cursor-pointer")}
                      >
                        <Paperclip size={15} />
                      </button>
                      {/* Model picker */}
                      <div className="relative">
                        <button type="button" onClick={() => setShowModelPicker(v => !v)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-foreground/45 hover:bg-black/6 hover:text-foreground/70 transition-colors">
                          {currentModelBadge} <ChevronDown size={10} />
                        </button>
                        {showModelPicker && (
                          <div className="absolute bottom-full mb-1 right-0 z-50 w-48 bg-white rounded-xl shadow-xl border border-black/10 py-1 overflow-hidden">
                            {MODEL_OPTIONS.map(m => {
                              const allowed = tierAllowed(m.minTier);
                              return (
                                <button key={m.id} type="button"
                                  onClick={() => allowed && changeModel(m.id)}
                                  className={cn("w-full flex items-center justify-between px-3 py-2 text-[12px] transition-colors text-left",
                                    selectedModel === m.id ? "bg-terracotta/10 text-terracotta font-semibold" : allowed ? "text-foreground/80 hover:bg-black/5" : "text-foreground/30 cursor-not-allowed")}>
                                  <span>{m.label}</span>
                                  {!allowed && <Lock size={10} className="text-foreground/25" />}
                                  {allowed && selectedModel === m.id && <span className="w-1.5 h-1.5 rounded-full bg-terracotta" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => handleSend()} disabled={(!input.trim() && readyAttachments.length === 0) || loading || anyUploading}
                        className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all", (input.trim() || readyAttachments.length > 0) && !loading && !anyUploading ? "bg-terracotta text-white hover:brightness-110 active:scale-95 shadow-sm" : "bg-black/8 text-foreground/25 cursor-not-allowed")}>
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
