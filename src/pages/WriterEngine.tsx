import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Menu, ChevronLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import WriterSidebar from "@/components/writer/WriterSidebar";
import StageBriefIntake from "@/components/writer/StageBriefIntake";
import StageExecutionTable from "@/components/writer/StageExecutionTable";
import StageWrite, { AutoPhase } from "@/components/writer/StageWrite";
import StageReview from "@/components/writer/StageReview";
import StageSubmissionPrep, { SubmissionDetails } from "@/components/writer/StageSubmissionPrep";
import ProgressBanner from "@/components/writer/ProgressBanner";
import { Section, WriterSettings, defaultSettings, stageLabels } from "@/components/writer/types";
import { readContentStream } from "@/lib/sseStream";
import { countWords, truncateToWordCeiling } from "@/lib/wordCount";

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
  const [autoPhase, setAutoPhase] = useState<AutoPhase>(null);
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

  const [imageVariants, setImageVariants] = useState<any[]>([]);
  const [imagesSkipped, setImagesSkipped] = useState(false);
  const [assessmentImages, setAssessmentImages] = useState<any[]>([]);

  const [recentAssessments, setRecentAssessments] = useState<{ id: string; title: string; status: string }[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null; tier: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!id || !user) return;
      const [{ data: aData }, { data: sData }, { data: profileData }, { data: recentData }, { data: imgData }] = await Promise.all([
        supabase.from("assessments").select("*").eq("id", id).single(),
        supabase.from("sections").select("*").eq("assessment_id", id).order("sort_order", { ascending: true }),
        supabase.from("profiles").select("full_name, tier").eq("user_id", user.id).single(),
        supabase.from("assessments").select("id, title, status").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(5),
        supabase.from("assessment_images").select("*").in("section_id", (await supabase.from("sections").select("id").eq("assessment_id", id)).data?.map(s => s.id) || []),
      ]);
      if (cancelled) return;
      if (aData) {
        setAssessment(aData);
        setExecutionPlan(aData.execution_plan);
        if (aData.settings) setSettings(prev => ({ ...prev, ...(aData.settings as Record<string, any>) }));
        setBriefText(aData.brief_text || "");
        if (sData && sData.length > 0) {
          const allComplete = sData.every(s => s.status === "complete");
          setStage(allComplete ? 2 : 1);
        } else if (aData.execution_plan) {
          setStage(0); // show plan review
        }
      }
      setSections((sData || []).map((s: any) => ({ ...s, suggested_frameworks: Array.isArray(s.suggested_frameworks) ? s.suggested_frameworks : [] })));
      setAssessmentImages(imgData || []);
      setProfile(profileData);
      setRecentAssessments((recentData || []).filter(r => r.id !== id));
      setLoading(false);
    };

    if (id) {
      fetchData();
    } else {
      const loadContext = async () => {
        if (!user) return;
        const [{ data: profileData }, { data: recentData }] = await Promise.all([
          supabase.from("profiles").select("full_name, tier").eq("user_id", user.id).single(),
          supabase.from("assessments").select("id, title, status").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(5),
        ]);
        if (cancelled) return;
        setProfile(profileData);
        setRecentAssessments(recentData || []);
      };
      loadContext();
    }

    return () => { cancelled = true; };
  }, [id, user]);

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

      setStage(1);
      toast({ title: "Plan confirmed — start writing" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Shared trim helper ─────────────────────────────────────────────────────
  // Calls section-revise with a trim instruction and returns the trimmed content,
  // or null if the request failed or returned nothing useful.
  const streamTrimSection = async (
    content: string,
    feedback: string,
    wordTarget: number,
    sectionTitle: string,
    accessToken: string,
  ): Promise<string | null> => {
    const trimResp = await fetch(`${CHAT_URL}/section-revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        content, feedback, word_target: wordTarget, section_title: sectionTitle,
        model: selectedModel, settings,
        brief_text: assessment?.brief_text || briefText || "",
        topic: settings.topic || "",
      }),
    });
    if (!trimResp.ok || !trimResp.body) return null;
    const result = await readContentStream(trimResp.body);
    return result || null;
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

    const briefContext = assessment?.brief_text || briefText || "";
    const topicContext = settings.topic || "";

    const endpoint = isRevision ? "section-revise" : "section-generate";
    const body = isRevision
      ? {
          content: section.content, feedback, word_target: section.word_target,
          section_title: section.title, model: selectedModel, settings,
          brief_text: briefContext, topic: topicContext,
        }
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
          brief_text: briefContext, topic: topicContext,
        };

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please sign in again.");

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

      const fullContent = await readContentStream(resp.body, setStreamContent);

      // Hard word count cap: truncate at sentence boundaries if over 1% of target
      const ceiling = Math.ceil(section.word_target * 1.01);
      let finalContent = truncateToWordCeiling(fullContent, ceiling);
      let wordCount = countWords(finalContent);

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
        const currentContent = (!latestData.error && latestData.data?.content) || fullContent;
        const currentWc = countWords(currentContent);
        const wCeiling = Math.ceil(section.word_target * 1.01);
        if (currentWc > wCeiling) {
          const trimFeedback = `Trim this section to exactly ${section.word_target} words. Remove redundant phrases, tighten prose. Do NOT add new content.`;
          try {
            toast({ title: "Trimming to target…", description: section.title });
            const trimContent = await streamTrimSection(currentContent, trimFeedback, section.word_target, section.title, accessToken);
            if (trimContent) {
              const trimWc = countWords(trimContent);
              await supabase.from("sections").update({ content: trimContent, word_current: trimWc }).eq("id", sectionId);
              setSections(prev => prev.map(s => s.id === sectionId ? { ...s, content: trimContent, word_current: trimWc } : s));
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
    if (sections.length === 0) {
      toast({ title: "No sections yet", description: "Confirm your plan first.", variant: "destructive" });
      return;
    }
    // Use content length as truth — status can be stale
    const pending = sections.filter(s => !s.content || s.content.trim().length < 50);
    if (pending.length === 0) {
      toast({ title: "All sections already written", description: "Go to Review or rewrite individual sections." });
      return;
    }
    setWritingAll(true);
    for (const s of pending) {
      await streamSection(s.id);
      await new Promise(r => setTimeout(r, 800));
    }
    setWritingAll(false);
    toast({ title: "All sections complete!" });
  };

  // ─── Quality check (used by Review stage) ───
  const handleQualityCheck = async () => {
    const contentSections = sections.filter(s => s.content && s.content.trim().length > 50);
    if (contentSections.length === 0) {
      toast({ title: "No content to scan", description: "Write your sections first.", variant: "destructive" });
      return null;
    }
    const allContent = contentSections.map(s => `## ${s.title}\n${s.content}`).join("\n\n");

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

  // ─── Review: Apply feedback to a single section ───
  const handleApplySectionFeedback = async (sectionId: string, feedback: string) => {
    if (!feedback.trim()) return;
    setIsProcessing(true);
    try {
      await streamSection(sectionId, true, feedback);
      toast({ title: "Section revised" });
    } catch (e: any) {
      toast({ title: "Revision failed", description: e.message, variant: "destructive" });
    }
    setIsProcessing(false);
  };

  // ─── Review: Fix all issues from quality report ───
  const handleFixAllIssues = async () => {
    const issues = qualityReport?.report?.issues || [];
    if (issues.length === 0) { toast({ title: "No issues to fix" }); return; }
    const feedback = issues
      .map((i: any) => `[${i.severity?.toUpperCase()}] ${i.description}${i.suggestion ? ` — ${i.suggestion}` : ""}`)
      .join("\n");
    setIsProcessing(true);
    try {
      for (const s of sections.filter(s => s.content)) {
        await streamSection(s.id, true, feedback);
      }
      toast({ title: "Issues applied to all sections", description: "Run Re-scan to verify." });
    } catch (e: any) {
      toast({ title: "Fix failed", description: e.message, variant: "destructive" });
    }
    setIsProcessing(false);
  };

  // ─── Review: Edit & proofread (auto-applied silently) ───
  const handleEditProofreadSilent = async () => {
    const contentSections = sections.filter(s => s.content);
    if (contentSections.length === 0) return;
    try {
      for (const section of contentSections) {
        const { data, error } = await supabase.functions.invoke("edit-proofread", {
          body: { content: section.content, model: selectedModel },
        });
        if (error || !data?.corrected_content) continue;
        const corrected = data.corrected_content;
        if (corrected !== section.content) {
          const wc = countWords(corrected);
          await supabase.from("sections").update({ content: corrected, word_current: wc }).eq("id", section.id);
          setSections(prev => prev.map(s => s.id === section.id ? { ...s, content: corrected, word_current: wc } : s));
        }
      }
    } catch { /* best-effort */ }
  };

  // ─── Trim helper ─────────────────────────────────────────────────────────────
  const handleTrimToTarget = async (trimTargets?: Record<string, number>) => {
    setIsProcessing(true);

    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (!accessToken) {
      toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    const contentSections = sections.filter(s => s.content);
    const currentTotal = contentSections.reduce((a, s) => a + s.word_current, 0);
    const excess = currentTotal - totalTarget;
    if (excess <= 0) { setIsProcessing(false); toast({ title: "Already within target" }); return; }

    // Track updated word counts locally so the final total is accurate
    const updatedWordCounts: Record<string, number> = {};

    for (const s of contentSections) {
      const customTrim = trimTargets?.[s.id];
      const proportionalTrim = Math.ceil(excess * (s.word_current / currentTotal));
      const wordsToRemove = customTrim ?? proportionalTrim;
      if (wordsToRemove <= 0) continue;

      const targetWc = Math.max(s.word_current - wordsToRemove, Math.floor(s.word_target * 0.95));
      const trimFeedback = `Trim this section from ${s.word_current} to exactly ${targetWc} words. Remove redundant phrases and tighten prose. Do NOT add new content. Do NOT humanise. Preserve all citations exactly.`;

      try {
        const trimContent = await streamTrimSection(s.content!, trimFeedback, targetWc, s.title, accessToken);
        if (trimContent) {
          const trimWc = countWords(trimContent);
          updatedWordCounts[s.id] = trimWc;
          await supabase.from("sections").update({ content: trimContent, word_current: trimWc }).eq("id", s.id);
          setSections(prev => prev.map(x => x.id === s.id ? { ...x, content: trimContent, word_current: trimWc } : x));
        }
      } catch { /* best-effort trim */ }
    }

    // Use locally-tracked counts to avoid reading stale React state
    const newTotal = contentSections.reduce((a, s) => a + (updatedWordCounts[s.id] ?? s.word_current), 0);
    if (assessment?.id) await supabase.from("assessments").update({ word_current: newTotal }).eq("id", assessment.id);
    setIsProcessing(false);
    toast({ title: "Word count trimmed" });
  };

  // ─── Review: Run scan (alias for quality check) ───
  const handleRunScan = async () => {
    const data = await handleQualityCheck();
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
    setProgressMessage("Generating images…");
    try {
      const { data, error } = await supabase.functions.invoke("generate-images", {
        body: { assessment_id: assessment.id, sections: sections.filter(s => s.content) },
      });
      if (error) throw error;
      // Store as variants for user selection (not saved to DB yet)
      setImageVariants(data?.images || []);
      toast({ title: `${data?.count || 0} image variants generated!` });
    } catch (e: any) {
      toast({ title: "Image generation failed", description: e.message, variant: "destructive" });
    }
    setProgressMessage("");
  };

  const handleSelectImage = async (variant: any) => {
    // Toggle selection
    setImageVariants(prev => prev.map(v =>
      v.section_id === variant.section_id
        ? { ...v, selected: v.variant === variant.variant }
        : v
    ));
    // Save selected image to assessment_images table
    try {
      const { data: imgRecord } = await supabase.from("assessment_images").insert({
        section_id: variant.section_id,
        figure_number: variant.figure_number,
        caption: variant.caption,
        prompt: variant.prompt,
        url: variant.url,
        image_type: variant.image_type,
      }).select().single();
      if (imgRecord) {
        setAssessmentImages(prev => {
          // Remove any previous image for this section
          const filtered = prev.filter(i => i.section_id !== variant.section_id);
          return [...filtered, imgRecord];
        });
      }
    } catch (e: any) {
      toast({ title: "Image save failed", description: e?.message, variant: "destructive" });
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

  // ─── AUTOPILOT ───
  const handleAutopilot = async () => {
    if (autopilotRunning) { autopilotCancelRef.current = true; return; }
    autopilotCancelRef.current = false;
    setAutopilotRunning(true);

    try {
      // Phase 1: Write all sections without substantial content
      setAutoPhase("writing");
      if (sections.length === 0) {
        toast({ title: "No sections to write", description: "Confirm your plan first.", variant: "destructive" });
        setAutopilotRunning(false); setAutoPhase(null); return;
      }
      const pending = sections.filter(s => !s.content || s.content.trim().length < 50);
      for (const s of pending) {
        if (autopilotCancelRef.current) break;
        await streamSection(s.id);
        await new Promise(r => setTimeout(r, 800));
      }
      if (autopilotCancelRef.current) { setAutopilotRunning(false); setAutoPhase(null); return; }

      // Phase 2: Quality check (silent)
      setAutoPhase("quality");
      await handleQualityCheck();
      if (autopilotCancelRef.current) { setAutopilotRunning(false); setAutoPhase(null); return; }

      // Phase 3: Edit & proofread (auto-apply silently)
      setAutoPhase("editing");
      await handleEditProofreadSilent();
      if (autopilotCancelRef.current) { setAutopilotRunning(false); setAutoPhase(null); return; }

      // Advance to Review — user reviews before any export
      setAutoPhase(null);
      setStage(2);
      toast({ title: "Auto complete — review your draft", description: "Fix any issues before exporting." });
    } catch (e: any) {
      toast({ title: "Auto error", description: e.message, variant: "destructive" });
    } finally {
      setAutopilotRunning(false);
      setAutoPhase(null);
    }
  };

  const canAdvance = (targetStage: number) => {
    if (targetStage <= stage) return true;
    if (targetStage === 1 && sections.length === 0) return false;
    if (targetStage >= 2 && !sections.some(s => s.content)) return false;
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
        <div className="h-12 border-b border-border flex items-center justify-between px-3 md:px-4 gap-2 flex-shrink-0 bg-card">
          {/* Left: hamburger + back arrow */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors md:hidden">
              <Menu size={16} />
            </button>
            <button
              onClick={() => stage > 0 && handleStageChange(stage - 1)}
              disabled={stage === 0}
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted transition-all disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
          </div>

          {/* Centre: step indicator — always visible, compact */}
          <div className="flex items-center gap-1 flex-1 justify-center overflow-hidden">
            {stageLabels.map((label, i) => (
              <button
                key={i}
                onClick={() => handleStageChange(i)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                  i === stage
                    ? "bg-terracotta text-white"
                    : i < stage
                      ? "text-sage"
                      : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {i < stage && <span className="text-[9px]">✓</span>}
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            ))}
          </div>

          <div className="w-8 flex-shrink-0" />
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto pb-20">
            <ProgressBanner message={progressMessage} active={!!progressMessage} />
            <div className="px-3.5 sm:px-6 md:px-14 py-5 sm:py-7 md:py-10">
            <div className="max-w-[820px] mx-auto">
              {/* Stage 0: Brief — intake form, then plan review inline */}
              {stage === 0 && !executionPlan && (
                <StageBriefIntake
                  settings={settings} onSettingsChange={setSettings}
                  briefText={briefText} onBriefTextChange={setBriefText}
                  uploadedFiles={uploadedFiles} onFilesChange={setUploadedFiles}
                  urlInput={urlInput} onUrlChange={setUrlInput}
                  activeTab={activeIntakeMode} onTabChange={setActiveIntakeMode}
                  onAnalyse={handleAnalyseBrief} isProcessing={isProcessing}
                />
              )}
              {stage === 0 && executionPlan && (
                <StageExecutionTable
                  plan={executionPlan} onPlanChange={setExecutionPlan}
                  settings={settings} onBack={() => setExecutionPlan(null)}
                  onConfirm={handleConfirmPlan} isProcessing={isProcessing}
                />
              )}

              {/* Stage 1: Write */}
              {stage === 1 && (
                <StageWrite
                  sections={sections}
                  onGenerate={(id) => streamSection(id)}
                  onWriteAll={handleWriteAll}
                  onAutopilot={handleAutopilot}
                  autopilotRunning={autopilotRunning}
                  autoPhase={autoPhase}
                  generating={generating} generatingId={generatingId}
                  streamContent={streamContent} writingAll={writingAll}
                  onBack={() => { setExecutionPlan(executionPlan); setStage(0); }}
                  onNext={() => setStage(2)}
                  settings={settings}
                />
              )}

              {/* Stage 2: Review */}
              {stage === 2 && (
                <StageReview
                  sections={sections}
                  qualityReport={qualityReport}
                  isProcessing={isProcessing}
                  onRunScan={handleRunScan}
                  onFixAllIssues={handleFixAllIssues}
                  onApplySectionFeedback={handleApplySectionFeedback}
                  onBack={() => setStage(1)}
                  onNext={() => setStage(3)}
                />
              )}

              {/* Stage 3: Export */}
              {stage === 3 && (
                <StageSubmissionPrep
                  assessmentTitle={assessment?.title || "Assessment"}
                  totalWords={totalWords}
                  onExport={handleExport}
                  onDownloadImages={handleDownloadImagesZip}
                  hasImages={assessmentImages.length > 0}
                  isProcessing={isProcessing}
                  onNext={() => {}}
                  sections={sections}
                />
              )}
            </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default WriterEngine;
