import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Menu, ChevronLeft, ChevronRight, Sparkles, X, Send, Loader2, MessageCircle, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import ReactMarkdown from "react-markdown";
import WriterSidebar from "@/components/writer/WriterSidebar";
import StageBriefIntake from "@/components/writer/StageBriefIntake";
import StageExecutionTable from "@/components/writer/StageExecutionTable";
import StageWriteHumanise from "@/components/writer/StageWriteHumanise";
import StageSelfCritique from "@/components/writer/StageSelfCritique";
import StageEditProofread from "@/components/writer/StageEditProofread";
import StageRevise from "@/components/writer/StageRevise";
import StageWriterSlate from "@/components/writer/StageWriterSlate";
import StageFinalScan from "@/components/writer/StageFinalScan";
import StageSubmissionPrep, { SubmissionDetails } from "@/components/writer/StageSubmissionPrep";
import StageManualSubmission from "@/components/writer/StageManualSubmission";
import DraggableChatFab from "@/components/writer/DraggableChatFab";
import ProgressBanner from "@/components/writer/ProgressBanner";
import { EditDiff } from "@/components/writer/StageEditProofread";
import { Section, Recommendation, WriterSettings, defaultSettings, stageLabels } from "@/components/writer/types";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const WriterEngine = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [stage, setStage] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [isProcessing, setIsProcessing] = useState(false);

  const [assessment, setAssessment] = useState<any>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [executionPlan, setExecutionPlan] = useState<any>(null);
  const [settings, setSettings] = useState<WriterSettings>({ ...defaultSettings });
  const [qualityReport, setQualityReport] = useState<any>(null);
  const [editReport, setEditReport] = useState<any>(null);
  const [scanReport, setScanReport] = useState<any>(null);
  const [revisionFeedback, setRevisionFeedback] = useState<string>("");
  const [editDiffs, setEditDiffs] = useState<EditDiff[]>([]);
  const [priorSections, setPriorSections] = useState<Section[]>([]);
  const [progressMessage, setProgressMessage] = useState("");
  const [submissionDetails, setSubmissionDetails] = useState<SubmissionDetails | undefined>();
  const [selectedFont, setSelectedFont] = useState("Calibri 12pt");
  const [briefText, setBriefText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [activeIntakeMode, setActiveIntakeMode] = useState<"paste" | "upload" | "url" | "fields">("paste");

  const [generating, setGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [streamContent, setStreamContent] = useState("");
  const [writingAll, setWritingAll] = useState(false);
  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const autopilotCancelRef = useRef(false);

  const [assessmentImages, setAssessmentImages] = useState<any[]>([]);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [recentAssessments, setRecentAssessments] = useState<{ id: string; title: string; status: string }[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null; tier: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user) return;
      const [{ data: aData }, { data: sData }, { data: profileData }, { data: recentData }, { data: imgData }] = await Promise.all([
        supabase.from("assessments").select("*").eq("id", id).single(),
        supabase.from("sections").select("*").eq("assessment_id", id).order("sort_order", { ascending: true }),
        supabase.from("profiles").select("full_name, tier").eq("user_id", user.id).single(),
        supabase.from("assessments").select("id, title, status").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(5),
        supabase.from("assessment_images").select("*").in("section_id", (await supabase.from("sections").select("id").eq("assessment_id", id)).data?.map(s => s.id) || []),
      ]);
      if (aData) {
        setAssessment(aData);
        setExecutionPlan(aData.execution_plan);
        if (aData.settings) setSettings(prev => ({ ...prev, ...(aData.settings as Record<string, any>) }));
        setBriefText(aData.brief_text || "");
        if (sData && sData.length > 0) {
          const allComplete = sData.every(s => s.status === "complete");
          setStage(allComplete ? 3 : 2);
        } else if (aData.execution_plan) {
          setStage(1);
        }
      }
      setSections((sData || []).map((s: any) => ({ ...s, suggested_frameworks: Array.isArray(s.suggested_frameworks) ? s.suggested_frameworks : [] })));
      setAssessmentImages(imgData || []);
      setProfile(profileData);
      setRecentAssessments((recentData || []).filter(r => r.id !== id));
      setLoading(false);
    };
    if (id) fetchData();
    else {
      const loadContext = async () => {
        if (!user) return;
        const [{ data: profileData }, { data: recentData }] = await Promise.all([
          supabase.from("profiles").select("full_name, tier").eq("user_id", user.id).single(),
          supabase.from("assessments").select("id, title, status").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(5),
        ]);
        setProfile(profileData);
        setRecentAssessments(recentData || []);
      };
      loadContext();
    }
  }, [id, user]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const selectedModel = settings.model || "google/gemini-2.5-flash";
  const userName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const initials = userName.slice(0, 2).toUpperCase();
  const totalWords = sections.reduce((a, s) => a + s.word_current, 0);
  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0);

  // ─── STAGE 0: Analyse Brief ───
  const handleAnalyseBrief = async () => {
    const hasContent =
      (activeIntakeMode === "paste" && briefText.trim()) ||
      (activeIntakeMode === "upload" && uploadedFiles.length > 0) ||
      (activeIntakeMode === "url" && urlInput.trim()) ||
      (activeIntakeMode === "fields" && briefText.trim());

    if (!hasContent) {
      toast({ title: "No content", description: "Please provide a brief.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    toast({ title: "Analysing brief…" });

    try {
      let body: any = {};
      if (activeIntakeMode === "upload" && uploadedFiles.length > 0) {
        const filesPayload = await Promise.all(
          uploadedFiles.map(async (f) => {
            const buffer = await f.arrayBuffer();
            const base64 = arrayBufferToBase64(buffer);
            return { base64, type: f.type || f.name.split(".").pop() || "", name: f.name };
          })
        );
        body = { files: filesPayload, model: selectedModel, topic: settings.topic || undefined };
      } else if (activeIntakeMode === "url" && urlInput.trim()) {
        body = { url: urlInput.trim(), model: selectedModel, topic: settings.topic || undefined };
      } else {
        body = { text: briefText, model: selectedModel, topic: settings.topic || undefined };
      }

      const { data: parseData, error: parseError } = await supabase.functions.invoke("brief-parse", { body });
      if (parseError) throw parseError;

      const brief = parseData?.brief || { title: settings.type + " Assessment", type: settings.type, raw_text: briefText };
      if (brief.word_count && !settings.wordCount) setSettings(prev => ({ ...prev, wordCount: String(brief.word_count) }));
      if (brief.type && !settings.type) setSettings(prev => ({ ...prev, type: brief.type }));

      toast({ title: "Generating plan…" });

      const { data: planData, error: planError } = await supabase.functions.invoke("execution-table", {
        body: { brief, settings, model: selectedModel },
      });
      if (planError) throw planError;

      setExecutionPlan(planData?.plan);
      setStage(1);
      toast({ title: "Plan ready" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── STAGE 1: Confirm Plan ───
  const handleConfirmPlan = async () => {
    if (!user || !executionPlan) return;
    setIsProcessing(true);
    try {
      let assessmentId = assessment?.id;

      if (assessmentId) {
        await supabase.from("assessments").update({
          execution_plan: executionPlan as any,
          settings: settings as any,
          word_target: Math.round(executionPlan.total_words || parseInt(settings.wordCount) || 3000),
          status: "writing",
        }).eq("id", assessmentId);
        await supabase.from("sections").delete().eq("assessment_id", assessmentId);
      } else {
        const { data: newAssessment, error: aErr } = await supabase.from("assessments").insert({
          user_id: user.id,
          title: executionPlan.title || settings.type + " Assessment",
          type: settings.type,
          brief_text: briefText || "",
          settings: settings as any,
          execution_plan: executionPlan as any,
          word_target: Math.round(executionPlan.total_words || parseInt(settings.wordCount) || 3000),
          status: "writing",
        }).select().single();
        if (aErr || !newAssessment) throw aErr || new Error("Failed to create assessment");
        setAssessment(newAssessment);
        assessmentId = newAssessment.id;
        navigate(`/assessment/${newAssessment.id}`, { replace: true });
      }

      const sectionInserts = (executionPlan.sections || []).map((s: any, i: number) => ({
        assessment_id: assessmentId,
        title: s.title,
        word_target: Math.round(Number(s.word_target)) || 0,
        framework: s.framework || null,
        citation_count: Math.round(Number(s.citation_count)) || 0,
        sort_order: s.sort_order ?? i,
        status: "pending",
        purpose_scope: s.purpose_scope || null,
        learning_outcomes: s.learning_outcomes || null,
        required_inputs: s.required_inputs || null,
        structure_formatting: s.structure_formatting || null,
        constraints_text: s.constraints || s.constraints_text || null,
        a_plus_criteria: s.a_plus_criteria || null,
        suggested_frameworks: s.suggested_frameworks || [],
      }));

      const { data: newSections, error: sErr } = await supabase.from("sections").insert(sectionInserts).select();
      if (sErr) throw sErr;
      setSections((newSections || []).map((s: any) => ({ ...s, suggested_frameworks: Array.isArray(s.suggested_frameworks) ? s.suggested_frameworks : [] })));

      setStage(2);
      toast({ title: "Plan confirmed" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── STAGE 2: Stream section ───
  const streamSection = useCallback(async (sectionId: string, isRevision = false, feedback = "") => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    setGenerating(true);
    setGeneratingId(sectionId);
    setStreamContent("");
    setProgressMessage(`Writing ${section.title}…`);

    await supabase.from("sections").update({ status: "writing" }).eq("id", sectionId);
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, status: "writing" } : s));

    const priorSections = sections.filter(s => s.sort_order < section.sort_order && s.content);
    const priorSummary = priorSections.map(s => `${s.title}: ${(s.content || "").slice(0, 200)}...`).join("\n");

    const endpoint = isRevision ? "section-revise" : "section-generate";
    const body = isRevision
      ? { content: section.content, feedback, word_target: section.word_target, section_title: section.title, model: selectedModel, settings }
      : {
          section: {
            title: section.title, word_target: section.word_target, framework: section.framework,
            citation_count: section.citation_count, a_plus_criteria: section.a_plus_criteria || "",
            purpose_scope: section.purpose_scope || "", learning_outcomes: section.learning_outcomes || "",
            required_inputs: section.required_inputs || "", structure_formatting: section.structure_formatting || "",
            constraints: section.constraints_text || "",
          },
          execution_plan: assessment?.execution_plan || executionPlan,
          prior_sections_summary: priorSummary,
          citation_style: settings.citationStyle || "Harvard",
          academic_level: settings.level || "Postgraduate L7",
          model: selectedModel, settings,
        };

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${CHAT_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("Rate limited. Please wait.");
        if (resp.status === 402) throw new Error("Credits exhausted.");
        throw new Error(`Stream failed: ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { fullContent += content; setStreamContent(fullContent); }
          } catch { /* partial */ }
        }
      }

      // Hard word count cap: truncate at sentence boundaries if over 1% of target
      let finalContent = fullContent;
      const ceiling = Math.ceil(section.word_target * 1.01);
      let wordCount = finalContent.split(/\s+/).filter(Boolean).length;
      if (wordCount > ceiling) {
        const sentences = finalContent.match(/[^.!?]+[.!?]+/g) || [finalContent];
        let trimmed = "";
        let wc = 0;
        for (const sent of sentences) {
          const sWc = sent.trim().split(/\s+/).filter(Boolean).length;
          if (wc + sWc > ceiling) break;
          trimmed += sent;
          wc += sWc;
        }
        if (trimmed.trim()) {
          finalContent = trimmed.trim();
          wordCount = wc;
        }
      }

      // Harvard citation post-processing: replace & with "and" inside citation parentheses
      if ((settings.citationStyle || "Harvard") === "Harvard") {
        finalContent = finalContent.replace(/\(([A-Z][^)]*?)&([^)]*?\d{4}[a-z]?)\)/g, "($1and$2)");
      }

      await supabase.from("sections").update({ content: finalContent, word_current: wordCount, status: "complete" }).eq("id", sectionId);
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, content: finalContent, word_current: wordCount, status: "complete" } : s));

      const newTotal = sections.reduce((a, s) => a + (s.id === sectionId ? wordCount : s.word_current), 0);
      if (assessment?.id) await supabase.from("assessments").update({ word_current: newTotal }).eq("id", assessment.id);

      // Auto-humanise
      if (settings.humanisation === "High" || settings.humanisation === "Maximum") {
        setProgressMessage(`Humanising ${section.title}…`);
        try {
          const { data: hData, error: hErr } = await supabase.functions.invoke("humanise", {
            body: { content: finalContent, word_target: section.word_target, mode: "full", model: selectedModel, voice_perspective: settings.firstPerson ? "first" : "third" },
          });
          if (!hErr && hData?.humanised_content) {
            const hWc = hData.word_count || hData.humanised_content.split(/\s+/).filter(Boolean).length;
            await supabase.from("sections").update({ content: hData.humanised_content, word_current: hWc }).eq("id", sectionId);
            setSections(prev => prev.map(s => s.id === sectionId ? { ...s, content: hData.humanised_content, word_current: hWc } : s));
          }
        } catch { /* optional */ }
      }

      // Word count enforcement: auto-trim if over 1% of target (reads fresh from DB)
      {
        const latestData = await supabase.from("sections").select("content, word_current").eq("id", sectionId).single();
        const currentContent = latestData.data?.content || fullContent;
        const currentWc = currentContent.split(/\s+/).filter(Boolean).length;
        const ceiling = Math.ceil(section.word_target * 1.01);
        if (currentWc > ceiling) {
          const trimFeedback = `Trim this section to exactly ${section.word_target} words. Remove redundant phrases, tighten prose. Do NOT add new content.`;
          try {
            toast({ title: "Trimming to target…", description: section.title });
            const session2 = await supabase.auth.getSession();
            const at2 = session2.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
            const trimResp = await fetch(`${CHAT_URL}/section-revise`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${at2}` },
              body: JSON.stringify({
                content: currentContent, feedback: trimFeedback,
                word_target: section.word_target, section_title: section.title,
                model: selectedModel, settings,
              }),
            });
            if (trimResp.ok && trimResp.body) {
              const trimReader = trimResp.body.getReader();
              const trimDecoder = new TextDecoder();
              let trimBuffer = "";
              let trimContent = "";
              while (true) {
                const { done: tDone, value: tValue } = await trimReader.read();
                if (tDone) break;
                trimBuffer += trimDecoder.decode(tValue, { stream: true });
                let tIdx: number;
                while ((tIdx = trimBuffer.indexOf("\n")) !== -1) {
                  let tLine = trimBuffer.slice(0, tIdx);
                  trimBuffer = trimBuffer.slice(tIdx + 1);
                  if (tLine.endsWith("\r")) tLine = tLine.slice(0, -1);
                  if (!tLine.startsWith("data: ")) continue;
                  const tJson = tLine.slice(6).trim();
                  if (tJson === "[DONE]") break;
                  try {
                    const tParsed = JSON.parse(tJson);
                    const tc = tParsed.choices?.[0]?.delta?.content;
                    if (tc) trimContent += tc;
                  } catch { /* partial */ }
                }
              }
              if (trimContent) {
                const trimWc = trimContent.split(/\s+/).filter(Boolean).length;
                await supabase.from("sections").update({ content: trimContent, word_current: trimWc }).eq("id", sectionId);
                setSections(prev => prev.map(s => s.id === sectionId ? { ...s, content: trimContent, word_current: trimWc } : s));
              }
            }
          } catch { /* word count adjustment is best-effort */ }
        }
      }

      toast({ title: "Section complete", description: `${section.title} — ${wordCount} words.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      await supabase.from("sections").update({ status: "pending" }).eq("id", sectionId);
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, status: "pending" } : s));
    } finally {
      setGenerating(false);
      setGeneratingId(null);
      setStreamContent("");
      setProgressMessage("");
    }
  }, [sections, assessment, executionPlan, settings, selectedModel, toast]);

  const handleWriteAll = async () => {
    const pending = sections.filter(s => s.status === "pending" || !s.content);
    if (pending.length === 0) { toast({ title: "All sections already written" }); return; }
    setWritingAll(true);
    for (const s of pending) {
      await streamSection(s.id);
      await new Promise(r => setTimeout(r, 1000));
    }
    setWritingAll(false);
    toast({ title: "All sections complete!" });
  };

  // ─── STAGE 3: Quality check ───
  const handleQualityCheck = async () => {
    const allContent = sections.filter(s => s.content).map(s => `## ${s.title}\n${s.content}`).join("\n\n");
    if (!allContent) { toast({ title: "No content to check", variant: "destructive" }); return; }

    const briefData = assessment?.execution_plan || executionPlan;
    const parsedBrief = briefData ? {
      brief_text: assessment?.brief_text || briefText || "",
      requirements: briefData.requirements || [],
      marking_criteria: briefData.marking_criteria || [],
      learning_outcomes: briefData.learning_outcomes || [],
    } : {};

    try {
      const { data, error } = await supabase.functions.invoke("quality-pass", {
        body: {
          content: allContent, execution_plan: executionPlan, word_target: totalTarget, model: selectedModel,
          brief_text: parsedBrief.brief_text || assessment?.brief_text || briefText || "",
          requirements: parsedBrief.requirements, marking_criteria: parsedBrief.marking_criteria, learning_outcomes: parsedBrief.learning_outcomes,
        },
      });
      if (error) throw error;
      setQualityReport(data);
      return data;
    } catch (e: any) {
      toast({ title: "Quality check failed", description: e.message, variant: "destructive" });
      throw e;
    }
  };

  // ─── STAGE 4: Edit & Proofread (per-section) ───
  const handleEditProofread = async () => {
    const contentSections = sections.filter(s => s.content);
    if (contentSections.length === 0) { toast({ title: "No content", variant: "destructive" }); return; }

    try {
      const diffs: EditDiff[] = [];
      let totalCorrections = 0;

      for (const section of contentSections) {
        const { data, error } = await supabase.functions.invoke("edit-proofread", {
          body: { content: section.content, model: selectedModel },
        });
        if (error) throw error;

        const corrected = data?.corrected_content || section.content;
        totalCorrections += data?.corrections_count || 0;

        if (corrected !== section.content) {
          diffs.push({
            sectionId: section.id,
            sectionTitle: section.title,
            original: section.content!,
            corrected,
            accepted: null,
          });
        }
      }

      setEditReport({ corrections_count: totalCorrections, summary: `${totalCorrections} corrections across ${diffs.length} sections` });
      setEditDiffs(diffs);
      return { corrections_count: totalCorrections };
    } catch (e: any) {
      toast({ title: "Edit failed", description: e.message, variant: "destructive" });
      throw e;
    }
  };

  const handleAcceptEdits = async (sectionIds: string[]) => {
    for (const sid of sectionIds) {
      const diff = editDiffs.find(d => d.sectionId === sid);
      if (!diff) continue;
      const wc = diff.corrected.split(/\s+/).filter(Boolean).length;
      await supabase.from("sections").update({ content: diff.corrected, word_current: wc }).eq("id", sid);
      setSections(prev => prev.map(s => s.id === sid ? { ...s, content: diff.corrected, word_current: wc } : s));
    }
    setEditDiffs(prev => prev.map(d => sectionIds.includes(d.sectionId) ? { ...d, accepted: true } : d));
    toast({ title: `${sectionIds.length} edit(s) accepted` });
  };

  const handleDenyEdits = (sectionIds: string[]) => {
    setEditDiffs(prev => prev.map(d => sectionIds.includes(d.sectionId) ? { ...d, accepted: false } : d));
    toast({ title: `${sectionIds.length} edit(s) denied` });
  };

  // ─── STAGE 4: Apply revisions (was stage 5) ───
  const handleApplyRevisions = async (feedback: string) => {
    if (!feedback.trim()) return;
    setIsProcessing(true);
    // Snapshot sections before revisions for Writer Slate comparison
    setPriorSections(sections.map(s => ({ ...s })));
    try {
      for (const s of sections.filter(s => s.content)) {
        await streamSection(s.id, true, feedback);
      }
      toast({ title: "Revisions applied" });
      setStage(5); // advance to Edit & Proofread
    } catch (e: any) {
      toast({ title: "Revision failed", description: e.message, variant: "destructive" });
    }
    setIsProcessing(false);
  };

  // ─── STAGE 6: Writer Slate actions ───
  const handleAcceptAll = async () => {
    // Update assessment word count in DB
    const newTotal = sections.reduce((a, s) => a + s.word_current, 0);
    if (assessment?.id) {
      await supabase.from("assessments").update({ word_current: newTotal }).eq("id", assessment.id);
    }
    setPriorSections([]); // Clear prior — changes are now canonical
    toast({ title: "All changes accepted" });
  };

  const handleDenyAll = async () => {
    if (priorSections.length === 0) { toast({ title: "No prior version to revert to" }); return; }
    for (const prior of priorSections) {
      if (prior.content) {
        await supabase.from("sections").update({ content: prior.content, word_current: prior.word_current }).eq("id", prior.id);
      }
    }
    setSections(priorSections.map(s => ({ ...s })));
    toast({ title: "All changes denied — reverted to previous version" });
  };

  const handleAcceptSection = (_sectionId: string) => {
    // Current content is already the accepted version — no-op on data
  };

  const handleDenySection = async (sectionId: string) => {
    const prior = priorSections.find(p => p.id === sectionId);
    if (!prior || !prior.content) return;
    await supabase.from("sections").update({ content: prior.content, word_current: prior.word_current }).eq("id", sectionId);
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, content: prior.content!, word_current: prior.word_current } : s));
  };

  // Dedicated trim function for Writer Slate — trim only, no humanise, no backward nav
  const handleTrimToTarget = async (trimTargets?: Record<string, number>) => {
    setIsProcessing(true);
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const contentSections = sections.filter(s => s.content);
    const currentTotal = contentSections.reduce((a, s) => a + s.word_current, 0);
    const excess = currentTotal - totalTarget;
    if (excess <= 0) { setIsProcessing(false); toast({ title: "Already within target" }); return; }

    for (const s of contentSections) {
      // Calculate how many words to trim from this section
      const customTrim = trimTargets?.[s.id];
      const proportionalTrim = Math.ceil(excess * (s.word_current / currentTotal));
      const wordsToRemove = customTrim ?? proportionalTrim;
      if (wordsToRemove <= 0) continue;

      const targetWc = Math.max(s.word_current - wordsToRemove, Math.floor(s.word_target * 0.95));
      const trimFeedback = `Trim this section from ${s.word_current} to exactly ${targetWc} words. Remove redundant phrases and tighten prose. Do NOT add new content. Do NOT humanise. Preserve all citations exactly.`;

      try {
        const trimResp = await fetch(`${CHAT_URL}/section-revise`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            content: s.content, feedback: trimFeedback,
            word_target: targetWc, section_title: s.title,
            model: selectedModel, settings,
          }),
        });
        if (trimResp.ok && trimResp.body) {
          const trimReader = trimResp.body.getReader();
          const trimDecoder = new TextDecoder();
          let trimBuffer = "";
          let trimContent = "";
          while (true) {
            const { done: tDone, value: tValue } = await trimReader.read();
            if (tDone) break;
            trimBuffer += trimDecoder.decode(tValue, { stream: true });
            let tIdx: number;
            while ((tIdx = trimBuffer.indexOf("\n")) !== -1) {
              let tLine = trimBuffer.slice(0, tIdx);
              trimBuffer = trimBuffer.slice(tIdx + 1);
              if (tLine.endsWith("\r")) tLine = tLine.slice(0, -1);
              if (!tLine.startsWith("data: ")) continue;
              const tJson = tLine.slice(6).trim();
              if (tJson === "[DONE]") break;
              try {
                const tParsed = JSON.parse(tJson);
                const tc = tParsed.choices?.[0]?.delta?.content;
                if (tc) trimContent += tc;
              } catch { /* partial */ }
            }
          }
          if (trimContent) {
            const trimWc = trimContent.split(/\s+/).filter(Boolean).length;
            await supabase.from("sections").update({ content: trimContent, word_current: trimWc }).eq("id", s.id);
            setSections(prev => prev.map(x => x.id === s.id ? { ...x, content: trimContent, word_current: trimWc } : x));
          }
        }
      } catch { /* best-effort trim */ }
    }

    // Check if within 5% — auto-accept if so
    const newTotal = sections.reduce((a, s) => a + s.word_current, 0);
    if (assessment?.id) await supabase.from("assessments").update({ word_current: newTotal }).eq("id", assessment.id);
    setIsProcessing(false);
    toast({ title: "Word count trimmed" });
  };

  // ─── STAGE 7: Final Scan ───
  const handleFinalScan = async () => {
    // Reuse quality-pass for final scan
    const data = await handleQualityCheck();
    setScanReport(data);
    return data;
  };

  // ─── STAGE 8: Export ───
  const triggerDownload = (blobOrUrl: string | Blob, filename: string) => {
    const href = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); if (typeof blobOrUrl !== "string") URL.revokeObjectURL(href); }, 200);
  };

  const handleExport = async (details?: SubmissionDetails, font?: string) => {
    if (details) setSubmissionDetails(details);
    if (font) setSelectedFont(font);
    setIsProcessing(true);
    setProgressMessage("Exporting document…");
    const assessmentId = assessment?.id || id;
    const fallbackName = `${(assessment?.title || "Assessment").replace(/[^a-zA-Z0-9\s_-]/g, "").replace(/\s+/g, "_")}_FINAL.docx`;
    const mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const attemptExport = async (preferInline = false) => {
      const { data, error } = await supabase.functions.invoke("export-docx", {
        body: {
          assessment_id: assessmentId,
          prefer_inline: preferInline,
          submission_details: details || submissionDetails,
          font: font || selectedFont,
        },
      });
      if (error) throw new Error(error.message || "Export failed");
      if (data?.success === false) throw new Error(data.error || "Export failed");
      return data;
    };

    try {
      let data = await attemptExport(false);
      const dl = data?.download;
      const url = dl?.url || data?.url;
      const b64 = dl?.base64 || data?.base64;
      const fname = dl?.filename || data?.filename || fallbackName;

      if (url) { triggerDownload(url, fname); toast({ title: "Export downloaded!" }); }
      else if (b64) { triggerDownload(base64ToBlob(b64, mime), fname); toast({ title: "Export downloaded!" }); }
      else {
        data = await attemptExport(true);
        const retryB64 = data?.download?.base64 || data?.base64;
        const retryFname = data?.download?.filename || data?.filename || fallbackName;
        if (retryB64) { triggerDownload(base64ToBlob(retryB64, mime), retryFname); toast({ title: "Export downloaded!" }); }
        else throw new Error("No downloadable data.");
      }
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    }
    setIsProcessing(false);
    setProgressMessage("");
  };

  // ─── Image Generation ───
  const handleGenerateImages = async () => {
    if (!assessment?.id) return;
    toast({ title: "Generating images…" });
    try {
      const { data, error } = await supabase.functions.invoke("generate-images", {
        body: { assessment_id: assessment.id, sections: sections.filter(s => s.content) },
      });
      if (error) throw error;
      setAssessmentImages(data?.images || []);
      toast({ title: `${data?.count || 0} images generated!` });
    } catch (e: any) {
      toast({ title: "Image generation failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDownloadImagesZip = async () => {
    if (assessmentImages.length === 0) { toast({ title: "No images" }); return; }
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      for (const img of assessmentImages) {
        if (img.url) {
          try {
            if (img.url.startsWith("data:")) {
              const [header, b64] = img.url.split(",");
              const mimeMatch = header.match(/data:([^;]+)/);
              const ext = mimeMatch ? mimeMatch[1].split("/")[1] : "png";
              zip.file(`Figure_${img.figure_number || "X"}.${ext}`, base64ToBlob(b64, mimeMatch?.[1] || "image/png"));
            } else {
              const resp = await fetch(img.url);
              const blob = await resp.blob();
              zip.file(`Figure_${img.figure_number || "X"}.${blob.type.split("/")[1] || "png"}`, blob);
            }
          } catch { /* skip */ }
        }
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      triggerDownload(zipBlob, `${assessment?.title?.replace(/\s+/g, "_") || "Assessment"}_Images.zip`);
      toast({ title: "Images ZIP downloaded!" });
    } catch (e: any) {
      toast({ title: "ZIP failed", description: e.message, variant: "destructive" });
    }
    setIsProcessing(false);
  };

  // ─── STAGE 9: Manual corrections ───
  const handleManualCorrections = async (corrections: string) => {
    if (!corrections.trim()) return;
    setIsProcessing(true);
    try {
      for (const s of sections.filter(s => s.content)) {
        await streamSection(s.id, true, corrections);
      }
      toast({ title: "Corrections applied" });
    } catch (e: any) {
      toast({ title: "Corrections failed", description: e.message, variant: "destructive" });
    }
    setIsProcessing(false);
  };

  // ─── AUTOPILOT ───
  const handleAutopilot = async () => {
    if (autopilotRunning) { autopilotCancelRef.current = true; return; }
    autopilotCancelRef.current = false;
    setAutopilotRunning(true);

    try {
      toast({ title: "Autopilot: Writing…" });
      const pending = sections.filter(s => s.status === "pending" || !s.content);
      for (const s of pending) {
        if (autopilotCancelRef.current) break;
        await streamSection(s.id);
        await new Promise(r => setTimeout(r, 1000));
      }
      if (autopilotCancelRef.current) { setAutopilotRunning(false); return; }

      toast({ title: "Autopilot: Self-critique…" });
      setStage(3);
      await handleQualityCheck();
      if (autopilotCancelRef.current) { setAutopilotRunning(false); return; }

      toast({ title: "Autopilot: Edit & proofread…" });
      setStage(5);
      await handleEditProofread();
      if (autopilotCancelRef.current) { setAutopilotRunning(false); return; }

      if (settings.autoImages) {
        toast({ title: "Autopilot: Generating figures…" });
        await handleGenerateImages();
      }

      toast({ title: "Autopilot: Exporting…" });
      setStage(8);
      await handleExport();
      toast({ title: "🎉 Autopilot complete!" });
    } catch (e: any) {
      toast({ title: "Autopilot error", description: e.message, variant: "destructive" });
    } finally {
      setAutopilotRunning(false);
    }
  };

  // ─── Chat with tool-calling ───
  const executeChatAction = async (toolName: string, args: any) => {
    const destructiveActions = ["export_document"];

    if (destructiveActions.includes(toolName) && !args.confirmed) {
      setChatMessages(prev => [...prev, { role: "assistant", content: `⚠️ Confirm export? Reply "yes".` }]);
      return;
    }

    switch (toolName) {
      case "analyse_brief":
        if (args.brief_text) setBriefText(args.brief_text);
        setChatMessages(prev => [...prev, { role: "assistant", content: "📝 Analysing brief…" }]);
        setStage(0);
        await handleAnalyseBrief();
        break;
      case "write_all":
        setChatMessages(prev => [...prev, { role: "assistant", content: "✍️ Writing all sections…" }]);
        setStage(2);
        await handleWriteAll();
        break;
      case "write_section":
        const sec = sections.find(s => s.title.toLowerCase().includes((args.section_title || "").toLowerCase()));
        if (sec) {
          setChatMessages(prev => [...prev, { role: "assistant", content: `✍️ Writing "${sec.title}"…` }]);
          setStage(2);
          await streamSection(sec.id);
        } else {
          setChatMessages(prev => [...prev, { role: "assistant", content: `❌ Section "${args.section_title}" not found.` }]);
        }
        break;
      case "run_critique":
        setChatMessages(prev => [...prev, { role: "assistant", content: "🔍 Running critique…" }]);
        setStage(3);
        await handleQualityCheck();
        break;
      case "humanise_all":
        setChatMessages(prev => [...prev, { role: "assistant", content: "🎭 Humanising…" }]);
        setStage(2);
        for (const s of sections.filter(s => s.content)) {
          try {
            const { data } = await supabase.functions.invoke("humanise", {
              body: { content: s.content, word_target: s.word_target, mode: "full", model: selectedModel, voice_perspective: settings.firstPerson ? "first" : "third" },
            });
            if (data?.humanised_content) {
              const wc = data.humanised_content.split(/\s+/).filter(Boolean).length;
              await supabase.from("sections").update({ content: data.humanised_content, word_current: wc }).eq("id", s.id);
              setSections(prev => prev.map(x => x.id === s.id ? { ...x, content: data.humanised_content, word_current: wc } : x));
            }
          } catch { /* skip */ }
        }
        break;
      case "export_document":
        setChatMessages(prev => [...prev, { role: "assistant", content: "📥 Exporting…" }]);
        setStage(8);
        await handleExport();
        break;
      case "apply_revision":
        const revSec = sections.find(s => s.title.toLowerCase().includes((args.section_title || "").toLowerCase()));
        if (revSec) {
          setChatMessages(prev => [...prev, { role: "assistant", content: `📝 Revising "${revSec.title}"…` }]);
          setStage(4);
          await streamSection(revSec.id, true, args.feedback);
        }
        break;
      case "generate_images":
        setChatMessages(prev => [...prev, { role: "assistant", content: "🖼️ Generating images…" }]);
        setStage(2);
        await handleGenerateImages();
        break;
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user" as const, content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    let assistantSoFar = "";
    let toolCallsBuffer: any[] = [];

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${CHAT_URL}/zoe-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg],
          section_content: sections.find(s => s.content)?.content || "",
          assessment_title: assessment?.title || "",
          sections_summary: sections.map(s => `${s.title} (${s.status}, ${s.word_current}w)`).join(", "),
          model: selectedModel,
        }),
      });
      if (!resp.ok || !resp.body) throw new Error("Chat failed");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
            const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
            if (toolCalls) {
              for (const tc of toolCalls) {
                if (tc.index !== undefined) {
                  if (!toolCallsBuffer[tc.index]) toolCallsBuffer[tc.index] = { name: "", arguments: "" };
                  if (tc.function?.name) toolCallsBuffer[tc.index].name = tc.function.name;
                  if (tc.function?.arguments) toolCallsBuffer[tc.index].arguments += tc.function.arguments;
                }
              }
            }
          } catch { /* partial */ }
        }
      }

      for (const tc of toolCallsBuffer) {
        if (tc.name) {
          try {
            const args = tc.arguments ? JSON.parse(tc.arguments) : {};
            await executeChatAction(tc.name, args);
          } catch { /* ignore */ }
        }
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, an error occurred." }]);
    }
    setChatLoading(false);
  };

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFiles(prev => [...prev, file]);
    setActiveIntakeMode("upload");
    setChatMessages(prev => [...prev, { role: "user", content: `📎 Uploaded: ${file.name}` }]);
    setChatMessages(prev => [...prev, { role: "assistant", content: `Received "${file.name}". Say "analyse my brief" to process it.` }]);
  };

  const canAdvance = (targetStage: number) => {
    if (targetStage <= stage) return true;
    if (targetStage === 1 && !executionPlan) return false;
    if (targetStage === 2 && sections.length === 0) return false;
    if (targetStage >= 3 && !sections.some(s => s.content)) return false;
    return true;
  };

  const handleStageChange = (newStage: number) => {
    if (newStage > stage && !canAdvance(newStage)) {
      toast({ title: "Complete current stage first", variant: "destructive" });
      return;
    }
    setStage(newStage);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta" />
      </div>
    );
  }

  const maxStage = stageLabels.length - 1;

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-background">
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-[199] md:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed left-0 top-0 w-[280px] h-full bg-muted border-r border-border flex flex-col z-[200] transition-transform duration-200 md:static md:w-[240px] md:translate-x-0 ${
        sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      }`}>
        <WriterSidebar
          currentStage={stage}
          onStageChange={handleStageChange}
          onClose={() => setSidebarOpen(false)}
          userName={userName}
          userTier={profile?.tier || "free"}
          initials={initials}
          recentAssessments={recentAssessments}
        />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <div className="h-12 border-b border-border flex items-center justify-between px-3 md:px-5 gap-1.5 flex-shrink-0 bg-card">
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden flex-1">
            <button onClick={() => setSidebarOpen(true)} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0 md:hidden">
              <Menu size={16} />
            </button>
            <div className="flex items-center gap-[3px]">
              <button onClick={() => stage > 0 && handleStageChange(stage - 1)} disabled={stage === 0} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-all disabled:opacity-30 flex-shrink-0">
                <ChevronLeft size={13} />
              </button>
              <button onClick={() => stage < maxStage && handleStageChange(stage + 1)} disabled={stage === maxStage} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-all disabled:opacity-30 flex-shrink-0">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {/* Stage pills — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-[3px] md:gap-[5px] overflow-x-auto flex-shrink-0 scrollbar-hide">
            {stageLabels.map((label, i) => (
              <button
                key={i}
                onClick={() => handleStageChange(i)}
                className={`flex items-center gap-1 px-1.5 sm:px-2 py-[3px] rounded-full text-[11px] font-medium transition-all border whitespace-nowrap flex-shrink-0 ${
                  i === stage ? "bg-foreground text-background border-foreground" :
                  i < stage ? "bg-sage/15 text-sage border-sage/20" :
                  "border-transparent hover:bg-muted"
                }`}
              >
                <span className={`w-[15px] h-[15px] rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                  i === stage ? "bg-background/20 text-background" :
                  i < stage ? "bg-sage text-white" : "bg-border text-muted-foreground"
                }`}>{i + 1}</span>
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`ml-1.5 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all flex-shrink-0 ${
              chatOpen ? "bg-terracotta text-white" : "border border-border hover:bg-muted"
            }`}
          >
            <Sparkles size={13} /> <span className="hidden sm:inline">ZOE</span>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto pb-20">
            <ProgressBanner message={progressMessage} active={!!progressMessage} />
            <div className="px-3.5 sm:px-6 md:px-14 py-5 sm:py-7 md:py-10">
            <div className="max-w-[820px] mx-auto">
              {stage === 0 && (
                <StageBriefIntake
                  settings={settings} onSettingsChange={setSettings}
                  briefText={briefText} onBriefTextChange={setBriefText}
                  uploadedFiles={uploadedFiles} onFilesChange={setUploadedFiles}
                  urlInput={urlInput} onUrlChange={setUrlInput}
                  activeTab={activeIntakeMode} onTabChange={setActiveIntakeMode}
                  onAnalyse={handleAnalyseBrief} isProcessing={isProcessing}
                />
              )}
              {stage === 1 && (
                <StageExecutionTable
                  plan={executionPlan} onPlanChange={setExecutionPlan}
                  settings={settings} onBack={() => setStage(0)}
                  onConfirm={handleConfirmPlan} isProcessing={isProcessing}
                />
              )}
              {stage === 2 && (
                <StageWriteHumanise
                  sections={sections}
                  onGenerate={(id) => streamSection(id)}
                  onWriteAll={handleWriteAll}
                  onAutopilot={handleAutopilot}
                  onGenerateImages={handleGenerateImages}
                  autopilotRunning={autopilotRunning}
                  generating={generating} generatingId={generatingId}
                  streamContent={streamContent} writingAll={writingAll}
                  onBack={() => setStage(1)} onNext={() => setStage(3)}
                  settings={settings} onSettingsChange={setSettings}
                />
              )}
              {stage === 3 && (
                <StageSelfCritique
                  onRunCritique={handleQualityCheck}
                  qualityReport={qualityReport}
                  totalWords={totalWords} totalTarget={totalTarget}
                  onNext={() => {
                    const issues = qualityReport?.report?.issues || [];
                    if (issues.length > 0) {
                      const feedback = issues.map((i: any) => `[${i.severity}] ${i.description} → ${i.suggestion}`).join("\n");
                      setRevisionFeedback(feedback);
                    }
                    setStage(4);
                  }}
                />
              )}
              {stage === 4 && (
                <StageRevise
                  onApplyRevisions={handleApplyRevisions}
                  isProcessing={isProcessing}
                  onNext={() => setStage(5)}
                  initialFeedback={revisionFeedback}
                />
              )}
              {stage === 5 && (
                <StageEditProofread
                  onRunEdit={handleEditProofread}
                  editDiffs={editDiffs}
                  onAcceptEdits={handleAcceptEdits}
                  onDenyEdits={handleDenyEdits}
                  editReport={editReport}
                  onNext={() => setStage(6)}
                />
              )}
              {stage === 6 && (
                <StageWriterSlate
                  sections={sections} priorSections={priorSections} totalTarget={totalTarget}
                  onAcceptAll={handleAcceptAll} onDenyAll={handleDenyAll}
                  onAcceptSection={handleAcceptSection} onDenySection={handleDenySection}
                  onTrimToTarget={handleTrimToTarget}
                  onNext={() => setStage(7)}
                  isProcessing={isProcessing}
                />
              )}
              {stage === 7 && (
                <StageFinalScan
                  onRunScan={handleFinalScan}
                  scanReport={scanReport}
                  onNext={() => setStage(8)}
                />
              )}
              {stage === 8 && (
                <StageSubmissionPrep
                  assessmentTitle={assessment?.title || "Assessment"}
                  totalWords={totalWords}
                  onExport={handleExport}
                  onDownloadImages={handleDownloadImagesZip}
                  hasImages={assessmentImages.length > 0}
                  isProcessing={isProcessing}
                  onNext={() => setStage(9)}
                  sections={sections}
                />
              )}
              {stage === 9 && (
                <StageManualSubmission
                  onApplyCorrections={handleManualCorrections}
                  onReExport={handleExport}
                  isProcessing={isProcessing}
                  assessmentTitle={assessment?.title || "Assessment"}
                />
              )}
            </div>
          </div>

          {/* Chat panel */}
          {chatOpen && (
            <aside className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col md:static md:inset-auto md:z-auto md:w-80 md:border-l md:border-border md:bg-card/50 md:backdrop-blur-none">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-terracotta" />
                  <span className="text-[12px] font-semibold">Ask ZOE</span>
                </div>
                <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8">
                    <Sparkles size={24} className="mx-auto text-terracotta/30 mb-3" />
                    <p className="text-[12px] text-muted-foreground mb-2">Ask ZOE anything about your assessment.</p>
                    <p className="text-[11px] text-muted-foreground/60">Try: "Write all sections", "Generate images", "Export"</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`text-[12px] leading-relaxed ${msg.role === "user" ? "text-right" : ""}`}>
                    <div className={`inline-block max-w-[90%] p-2.5 rounded-lg ${
                      msg.role === "user" ? "bg-terracotta text-white rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-slate max-w-none [&_p]:mb-1 [&_p]:mt-0 [&_ul]:my-1 [&_ol]:my-1">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" /> ZOE is thinking…
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t border-border">
                <div className="flex gap-2">
                  <label className="flex items-center justify-center w-9 h-9 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer flex-shrink-0">
                    <Paperclip size={14} className="text-muted-foreground" />
                    <input type="file" className="hidden" onChange={handleChatFileUpload} accept=".pdf,.docx,.doc,.txt" />
                  </label>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChatSend()}
                    placeholder="Ask a question…"
                    className="flex-1 text-[12px] px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-terracotta/30"
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={chatLoading || !chatInput.trim()}
                    className="px-3 py-2 bg-terracotta text-white rounded-lg hover:bg-terracotta/90 transition-colors disabled:opacity-50 active:scale-[0.97]"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {!chatOpen && (
        <DraggableChatFab onClick={() => setChatOpen(true)} />
      )}
    </div>
  );
};

export default WriterEngine;
