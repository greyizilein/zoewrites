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
import StagePromptBuilder from "@/components/writer/StagePromptBuilder";
import StageWrite from "@/components/writer/StageWrite";
import StageEditProofHumanise from "@/components/writer/StageEditProofHumanise";
import StageCritiqueCorrect from "@/components/writer/StageCritiqueCorrect";
import StageRevisionCenter from "@/components/writer/StageRevisionCenter";
import StageSubmissionPrep, { SubmissionDetails } from "@/components/writer/StageSubmissionPrep";
import ProgressBanner from "@/components/writer/ProgressBanner";
import { Section, WriterSettings, defaultSettings, stageLabels } from "@/components/writer/types";
import { readContentStream } from "@/lib/sseStream";
import { countWords, countBodyWords, getBodyContent, truncateToWordCeiling } from "@/lib/wordCount";
import {
  buildMasterPrompt,
  buildAnalysePrompt,
  buildProofreadPrompt,
  buildCitationAuditPrompt,
  buildHumanisePrompt,
  buildCritiquePrompt,
  buildCorrectionPrompt,
  type PromptSettings,
} from "@/lib/pipelineRules";

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

  // 7 stages: 0=Brief 1=Prompt 2=Write 3=Edit 4=Critique 5=Revise 6=Export
  const [stage, setStage] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [isProcessing, setIsProcessing] = useState(false);

  const [assessment, setAssessment] = useState<any>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [executionPlan, setExecutionPlan] = useState<any>(null);
  const [settings, setSettings] = useState<WriterSettings>({ ...defaultSettings });
  const [qualityReport, setQualityReport] = useState<any>(null);
  const [coherenceReport, setCoherenceReport] = useState<any>(null);
  const [progressMessage, setProgressMessage] = useState("");
  const [submissionDetails, setSubmissionDetails] = useState<SubmissionDetails | undefined>();
  const [selectedFont, setSelectedFont] = useState("Calibri 12pt");
  const [briefText, setBriefText] = useState("");
  const [activeIntakeMode, setActiveIntakeMode] = useState<"paste" | "upload" | "url" | "fields">("paste");
  const [urlInput, setUrlInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const [generating, setGenerating] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [writeError, setWriteError] = useState<string | null>(null);

  // Full document content for continuous generation
  const [fullDocContent, setFullDocContent] = useState("");
  // Prompt builder state
  const [sectionSpecs, setSectionSpecs] = useState("");
  const [masterPrompt, setMasterPrompt] = useState("");
  const [isPromptBuilt, setIsPromptBuilt] = useState(false);
  // Edit stage state
  const [editedContent, setEditedContent] = useState("");
  // Critique stage state
  const [critiqueText, setCritiqueText] = useState("");
  const [correctedContent, setCorrectedContent] = useState("");
  const [critiquePhase, setCritiquePhase] = useState<"idle" | "critiquing" | "correcting" | "done">("idle");

  const [imageVariants, setImageVariants] = useState<any[]>([]);
  const [assessmentImages, setAssessmentImages] = useState<any[]>([]);

  const [recentAssessments, setRecentAssessments] = useState<{ id: string; title: string; status: string }[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null; tier: string } | null>(null);
  const wakeLockRef = useRef<any>(null);

  // ─── Wake lock + visibility: keep alive during AI generation ────────────────
  const isActivelyGenerating = generating;

  useEffect(() => {
    const acquireWakeLock = async () => {
      if (!isActivelyGenerating) return;
      try {
        if ("wakeLock" in navigator && wakeLockRef.current === null) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
          wakeLockRef.current.addEventListener("release", () => { wakeLockRef.current = null; });
        }
      } catch { /* wake lock not supported */ }
    };
    const releaseWakeLock = () => {
      if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
    };
    if (isActivelyGenerating) { acquireWakeLock(); }
    else { releaseWakeLock(); }
    return () => { releaseWakeLock(); };
  }, [isActivelyGenerating]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActivelyGenerating) {
        toast({
          title: "Tab is hidden — AI generation may slow",
          description: "Keep this tab active for best results.",
          variant: "destructive",
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isActivelyGenerating]);

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
          // Reconstruct full doc content from sections
          const docContent = sData.filter(s => s.content && s.content.trim().length > 50)
            .map(s => s.content).join("\n\n");
          if (docContent) {
            setFullDocContent(docContent);
            setEditedContent(docContent);
          }
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

  const selectedModel = settings.model || "google/gemini-2.5-pro";
  const userName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const initials = userName.slice(0, 2).toUpperCase();
  const totalWords = sections.reduce((a, s) => a + s.word_current, 0);
  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0);

  // Helper: fetch with retry
  const fetchWithRetry = async (url: string, opts: RequestInit, maxRetries = 3): Promise<Response> => {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
      try {
        const resp = await fetch(url, opts);
        if (resp.status === 429 || resp.status === 402) return resp;
        return resp;
      } catch (e: any) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Network error after retries");
  };

  // ─── Helper: get access token ──────────────────────────────────────────────
  const getAccessToken = async (): Promise<string> => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error("Session expired — please sign in again.");
    return token;
  };

  // ═══════════════════════════════════════════
  // STAGE 0: Analyse Brief
  // ═══════════════════════════════════════════
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
      setStage(1); // Move to Prompt Builder stage
      toast({ title: "Plan ready — build your execution prompt" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ═══════════════════════════════════════════
  // STAGE 1: Prompt Builder
  // ═══════════════════════════════════════════
  const handleBuildPrompt = async () => {
    setIsProcessing(true);
    try {
      const accessToken = await getAccessToken();
      const wc = parseInt(settings.wordCount) || 3000;

      // Step 1: Use AI to build section specifications from the brief
      const analysePromptText = buildAnalysePrompt({
        assessmentType: settings.type || "Essay",
        wordCount: wc,
        citStyle: settings.citationStyle || "Harvard",
        level: settings.level || "Postgraduate L7",
        tone: settings.writingTone || "Analytical",
        humanisation: settings.humanisation || "High",
        burstiness: settings.burstiness || 4,
        briefText: briefText || "",
        title: executionPlan?.title || settings.topic || "",
        module: settings.module || "",
        moduleCode: settings.moduleCode || "",
        learningOutcomes: settings.learningOutcomes || "",
        rubric: settings.rubric || "",
        sectionSpecs: "",
        dateFrom: parseInt(settings.sourceDateFrom) || 2015,
        dateTo: parseInt(settings.sourceDateTo) || 2025,
        seminal: settings.useSeminalSources,
        totalCitations: settings.totalCitations || 0,
        topic: settings.topic || "",
      });

      const resp = await fetchWithRetry(`${CHAT_URL}/section-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          section: {
            title: "Section Specifications",
            word_target: 2000,
            framework: null,
            citation_count: 0,
          },
          execution_plan: executionPlan,
          prior_sections_summary: "",
          citation_style: settings.citationStyle,
          academic_level: settings.level,
          model: selectedModel,
          settings,
          brief_text: analysePromptText,
          topic: settings.topic || "",
        }),
      });

      if (!resp.ok || !resp.body) throw new Error(`Build failed (${resp.status})`);

      const specs = await readContentStream(resp.body);
      setSectionSpecs(specs);

      // Step 2: Build the master prompt
      const promptSettings: PromptSettings = {
        assessmentType: settings.type || "Essay",
        wordCount: wc,
        citStyle: settings.citationStyle || "Harvard",
        level: settings.level || "Postgraduate L7",
        tone: settings.writingTone || "Analytical",
        humanisation: settings.humanisation || "High",
        burstiness: settings.burstiness || 4,
        briefText: briefText || "",
        title: executionPlan?.title || settings.topic || "",
        module: settings.module || "",
        moduleCode: settings.moduleCode || "",
        learningOutcomes: settings.learningOutcomes || "",
        rubric: settings.rubric || "",
        sectionSpecs: specs,
        dateFrom: parseInt(settings.sourceDateFrom) || 2015,
        dateTo: parseInt(settings.sourceDateTo) || 2025,
        seminal: settings.useSeminalSources,
        totalCitations: settings.totalCitations || 0,
        topic: settings.topic || "",
      };

      const prompt = buildMasterPrompt(promptSettings);
      setMasterPrompt(prompt);
      setSettings(prev => ({ ...prev, sectionSpecs: specs, masterPrompt: prompt }));
      setIsPromptBuilt(true);
      toast({ title: "Execution prompt built — ready to generate" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRebuildPrompt = () => {
    const wc = parseInt(settings.wordCount) || 3000;
    const prompt = buildMasterPrompt({
      assessmentType: settings.type || "Essay",
      wordCount: wc,
      citStyle: settings.citationStyle || "Harvard",
      level: settings.level || "Postgraduate L7",
      tone: settings.writingTone || "Analytical",
      humanisation: settings.humanisation || "High",
      burstiness: settings.burstiness || 4,
      briefText: briefText || "",
      title: executionPlan?.title || settings.topic || "",
      module: settings.module || "",
      moduleCode: settings.moduleCode || "",
      learningOutcomes: settings.learningOutcomes || "",
      rubric: settings.rubric || "",
      sectionSpecs: sectionSpecs,
      dateFrom: parseInt(settings.sourceDateFrom) || 2015,
      dateTo: parseInt(settings.sourceDateTo) || 2025,
      seminal: settings.useSeminalSources,
      totalCitations: settings.totalCitations || 0,
      topic: settings.topic || "",
    });
    setMasterPrompt(prompt);
    setSettings(prev => ({ ...prev, masterPrompt: prompt }));
    setIsPromptBuilt(true);
    toast({ title: "Prompt rebuilt" });
  };

  // ═══════════════════════════════════════════
  // STAGE 1 (Plan): Confirm execution plan + create sections in DB
  // ═══════════════════════════════════════════
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

      // Auto-advance — the plan is confirmed, now build the prompt
      toast({ title: "Plan confirmed — building prompt…" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ═══════════════════════════════════════════
  // STAGE 2: Full-document generation (single pass)
  // ═══════════════════════════════════════════
  const handleWriteDocument = async (forceRewrite = false) => {
    const prompt = masterPrompt || settings.masterPrompt;
    if (!prompt) {
      toast({ title: "No execution prompt", description: "Go back to the Prompt Builder and build your prompt.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setWriteError(null);
    setStreamContent("");
    setFullDocContent("");

    try {
      const accessToken = await getAccessToken();

      setProgressMessage("Writing complete document…");

      // Send the full master prompt as a single generation call
      const resp = await fetchWithRetry(`${CHAT_URL}/section-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          section: {
            title: "Complete Document",
            word_target: parseInt(settings.wordCount) || 3000,
            framework: null,
            citation_count: settings.totalCitations || 0,
          },
          execution_plan: executionPlan,
          prior_sections_summary: "",
          citation_style: settings.citationStyle || "Harvard",
          academic_level: settings.level || "Postgraduate L7",
          model: selectedModel,
          settings,
          brief_text: prompt, // The full master prompt IS the brief
          topic: settings.topic || "",
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("Rate limited — please wait a moment.");
        if (resp.status === 402) throw new Error("Credits exhausted.");
        throw new Error(`Write failed (${resp.status})`);
      }

      const fullText = await readContentStream(resp.body, (chunk) => {
        setStreamContent(chunk);
      });

      // Apply Harvard citation fix
      const isHarvard = (settings.citationStyle || "Harvard").toLowerCase().includes("harvard");
      let fixedText = fullText;
      if (isHarvard) {
        fixedText = fullText.replace(/\(([A-Z][^)]*?)&([^)]*?\d{4}[a-z]?)\)/g, "($1and$2)");
      }

      setFullDocContent(fixedText);
      setEditedContent(fixedText);

      // Parse the full document into sections for DB storage
      if (sections.length > 0) {
        const parsedMap = parseFullDocument(fixedText);
        await saveParsedSections(parsedMap);
      }

      // Update assessment word count
      const bodyWc = countBodyWords(fixedText);
      if (assessment?.id) {
        await supabase.from("assessments").update({ word_current: bodyWc }).eq("id", assessment.id);
      }

      toast({ title: "Document written — proceed to edit" });
    } catch (e: any) {
      setWriteError(e.message || "Generation failed");
    } finally {
      setGenerating(false);
      setStreamContent("");
      setProgressMessage("");
    }
  };

  // ─── Parse full document into sections (for DB storage) ──────────────────────
  const parseFullDocument = (fullContent: string): Record<string, string> => {
    const result: Record<string, string> = {};
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const escapedTitle = section.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const headingRe = new RegExp(`(?:^|\\n)##\\s*${escapedTitle}\\s*(?:\\n|$)`, "i");
      const headingMatch = headingRe.exec(fullContent);
      if (!headingMatch) continue;
      const afterHeading = fullContent.slice(headingMatch.index + headingMatch[0].length);
      let endIdx = afterHeading.length;
      for (let j = i + 1; j < sections.length; j++) {
        const nextTitle = sections[j].title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const nextRe = new RegExp(`\\n##\\s*${nextTitle}\\s*(?:\\n|$)`, "i");
        const nextMatch = nextRe.exec(afterHeading);
        if (nextMatch && nextMatch.index < endIdx) endIdx = nextMatch.index;
      }
      // Stop before ## References
      const refMatch = /\n## References[\s\S]*$/i.exec(afterHeading);
      if (refMatch && refMatch.index < endIdx) endIdx = refMatch.index;
      result[section.id] = afterHeading.slice(0, endIdx).trim();
    }
    return result;
  };

  // ─── Save parsed sections to DB ──────────────────────────────────────────────
  const saveParsedSections = async (parsedMap: Record<string, string>) => {
    for (const section of sections) {
      const content = parsedMap[section.id];
      if (!content) continue;
      const wc = countBodyWords(content);
      await supabase.from("sections").update({ content, word_current: wc, status: "complete" }).eq("id", section.id);
      setSections(prev => prev.map(s => s.id === section.id ? { ...s, content, word_current: wc, status: "complete" } : s));
    }
  };

  // ═══════════════════════════════════════════
  // STAGE 3: Edit / Proofread / Humanise passes
  // ═══════════════════════════════════════════
  const callEditPass = async (prompt: string): Promise<string> => {
    const accessToken = await getAccessToken();
    setGenerating(true);
    setStreamContent("");

    const resp = await fetchWithRetry(`${CHAT_URL}/section-revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        content: editedContent,
        feedback: prompt,
        word_target: parseInt(settings.wordCount) || 3000,
        section_title: "Complete Document",
        model: selectedModel,
        settings,
        brief_text: briefText || "",
        topic: settings.topic || "",
      }),
    });

    if (!resp.ok || !resp.body) throw new Error(`Edit pass failed (${resp.status})`);

    const result = await readContentStream(resp.body, (chunk) => {
      setStreamContent(chunk);
    });

    setGenerating(false);
    setStreamContent("");
    return result;
  };

  const handleRunEditPass = async (pass: "proofread" | "citation" | "humanise") => {
    try {
      let prompt: string;
      if (pass === "proofread") prompt = buildProofreadPrompt(editedContent);
      else if (pass === "citation") prompt = buildCitationAuditPrompt(editedContent, settings.citationStyle || "Harvard");
      else prompt = buildHumanisePrompt(editedContent, settings.burstiness || 4);

      const result = await callEditPass(prompt);
      setEditedContent(result);
      setFullDocContent(result);

      // Update sections in DB
      if (sections.length > 0) {
        const parsedMap = parseFullDocument(result);
        await saveParsedSections(parsedMap);
      }
    } catch (e: any) {
      setWriteError(e.message);
      setGenerating(false);
      setStreamContent("");
    }
  };

  const handleRunAllEditPasses = async () => {
    try {
      // 1. Proofread
      setProgressMessage("Running proofread pass…");
      let result = await callEditPass(buildProofreadPrompt(editedContent));
      setEditedContent(result);

      // 2. Citation audit
      setProgressMessage("Running citation audit…");
      result = await callEditPass(buildCitationAuditPrompt(result, settings.citationStyle || "Harvard"));
      setEditedContent(result);

      // 3. Humanise
      setProgressMessage("Running humanisation pass…");
      result = await callEditPass(buildHumanisePrompt(result, settings.burstiness || 4));
      setEditedContent(result);
      setFullDocContent(result);

      // Update sections in DB
      if (sections.length > 0) {
        const parsedMap = parseFullDocument(result);
        await saveParsedSections(parsedMap);
      }

      toast({ title: "All three edit passes complete" });
    } catch (e: any) {
      setWriteError(e.message);
    } finally {
      setGenerating(false);
      setStreamContent("");
      setProgressMessage("");
    }
  };

  // ═══════════════════════════════════════════
  // STAGE 4: Critique & Correct
  // ═══════════════════════════════════════════
  const handleCritiqueAndCorrect = async () => {
    try {
      const accessToken = await getAccessToken();
      setCritiquePhase("critiquing");
      setGenerating(true);
      setStreamContent("");
      setCritiqueText("");
      setCorrectedContent("");

      // Phase 1: Critique
      setProgressMessage("Running critique…");
      const critiquePrompt = buildCritiquePrompt(
        editedContent,
        settings.type || "Essay",
        settings.level || "Postgraduate L7"
      );

      const critiqueResp = await fetchWithRetry(`${CHAT_URL}/section-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          section: { title: "Critique", word_target: 2000, framework: null, citation_count: 0 },
          execution_plan: executionPlan,
          prior_sections_summary: "",
          citation_style: settings.citationStyle,
          academic_level: settings.level,
          model: selectedModel,
          settings,
          brief_text: critiquePrompt,
          topic: settings.topic || "",
        }),
      });

      if (!critiqueResp.ok || !critiqueResp.body) throw new Error(`Critique failed (${critiqueResp.status})`);

      const critique = await readContentStream(critiqueResp.body, (chunk) => {
        setCritiqueText(chunk);
      });
      setCritiqueText(critique);

      // Phase 2: Correct
      setCritiquePhase("correcting");
      setProgressMessage("Applying corrections…");
      setStreamContent("");

      const correctionPrompt = buildCorrectionPrompt(
        editedContent,
        critique,
        parseInt(settings.wordCount) || 3000
      );

      const corrResp = await fetchWithRetry(`${CHAT_URL}/section-revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          content: editedContent,
          feedback: correctionPrompt,
          word_target: parseInt(settings.wordCount) || 3000,
          section_title: "Complete Document",
          model: selectedModel,
          settings,
          brief_text: briefText || "",
          topic: settings.topic || "",
        }),
      });

      if (!corrResp.ok || !corrResp.body) throw new Error(`Correction failed (${corrResp.status})`);

      const corrected = await readContentStream(corrResp.body, (chunk) => {
        setStreamContent(chunk);
      });

      setCorrectedContent(corrected);
      setEditedContent(corrected);
      setFullDocContent(corrected);
      setCritiquePhase("done");

      // Update sections in DB
      if (sections.length > 0) {
        const parsedMap = parseFullDocument(corrected);
        await saveParsedSections(parsedMap);
      }

      toast({ title: "Critique & corrections applied" });
    } catch (e: any) {
      setWriteError(e.message);
      setCritiquePhase("idle");
    } finally {
      setGenerating(false);
      setStreamContent("");
      setProgressMessage("");
    }
  };

  // ═══════════════════════════════════════════
  // STAGE 5: Revision Center (existing)
  // ═══════════════════════════════════════════
  const handleReviseDocument = async (feedback: string) => {
    if (!feedback.trim()) return;
    if (!editedContent && !fullDocContent) {
      toast({ title: "Nothing to revise — write the document first.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setWriteError(null);
    setStreamContent("");

    try {
      const accessToken = await getAccessToken();
      setProgressMessage("Revising document…");

      const resp = await fetchWithRetry(`${CHAT_URL}/section-revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          content: editedContent || fullDocContent,
          feedback,
          word_target: parseInt(settings.wordCount) || 3000,
          section_title: "Complete Document",
          model: selectedModel,
          settings,
          brief_text: briefText || "",
          topic: settings.topic || "",
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("Rate limited — please wait a moment.");
        if (resp.status === 402) throw new Error("Credits exhausted.");
        throw new Error(`Revision failed (${resp.status})`);
      }

      const result = await readContentStream(resp.body, (chunk) => {
        setStreamContent(chunk);
      });

      // Apply Harvard citation fix
      const isHarvard = (settings.citationStyle || "Harvard").toLowerCase().includes("harvard");
      let fixedResult = result;
      if (isHarvard) {
        fixedResult = result.replace(/\(([A-Z][^)]*?)&([^)]*?\d{4}[a-z]?)\)/g, "($1and$2)");
      }

      setEditedContent(fixedResult);
      setFullDocContent(fixedResult);

      // Update sections in DB
      if (sections.length > 0) {
        const parsedMap = parseFullDocument(fixedResult);
        await saveParsedSections(parsedMap);
      }

      const bodyWc = countBodyWords(fixedResult);
      if (assessment?.id) {
        await supabase.from("assessments").update({ word_current: bodyWc }).eq("id", assessment.id);
      }

    } catch (e: any) {
      setWriteError(e.message || "Revision failed");
    } finally {
      setGenerating(false);
      setStreamContent("");
      setProgressMessage("");
    }
  };

  // ═══════════════════════════════════════════
  // Review: Quality + coherence scan
  // ═══════════════════════════════════════════
  const handleQualityCheck = async () => {
    const contentSections = sections.filter(s => s.content && s.content.trim().length > 50);
    if (contentSections.length === 0) {
      toast({ title: "Nothing to scan", description: "Write the document first.", variant: "destructive" });
      return null;
    }

    const allContent = contentSections
      .map(s => `## ${s.title}\n${getBodyContent(s.content || "")}`)
      .join("\n\n");

    const briefData = assessment?.execution_plan || executionPlan;
    const parsedBrief = briefData ? {
      brief_text: assessment?.brief_text || briefText || "",
      requirements: briefData.requirements || [],
      marking_criteria: briefData.marking_criteria || [],
      learning_outcomes: briefData.learning_outcomes || [],
    } : {};

    const sectionsForQuality = contentSections.map(s => ({
      title: s.title, framework: s.framework || null,
    }));
    const sectionsForCoherence = contentSections.map(s => ({
      title: s.title, content: getBodyContent(s.content || ""),
    }));

    try {
      const [qualityResult, coherenceResult] = await Promise.allSettled([
        supabase.functions.invoke("quality-pass", {
          body: {
            content: allContent,
            execution_plan: executionPlan,
            word_target: totalTarget,
            model: selectedModel,
            sections: sectionsForQuality,
            brief_text: parsedBrief.brief_text,
            requirements: (parsedBrief as any).requirements,
            marking_criteria: (parsedBrief as any).marking_criteria,
            learning_outcomes: (parsedBrief as any).learning_outcomes,
          },
        }),
        contentSections.length >= 2
          ? supabase.functions.invoke("coherence-pass", {
              body: { sections: sectionsForCoherence, model: selectedModel },
            })
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (qualityResult.status === "rejected") throw qualityResult.reason;
      const { data: qData, error: qError } = qualityResult.value as any;
      if (qError) throw qError;
      setQualityReport(qData);

      if (coherenceResult.status === "fulfilled") {
        const { data: cData } = coherenceResult.value as any;
        setCoherenceReport(cData?.report || null);
      }

      return qData;
    } catch (e: any) {
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
      throw e;
    }
  };

  const handleRunScan = async () => {
    const data = await handleQualityCheck();
    return data;
  };

  // ═══════════════════════════════════════════
  // STAGE 6: Export
  // ═══════════════════════════════════════════
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

  // ═══════════════════════════════════════════
  // Stage navigation
  // ═══════════════════════════════════════════
  const canAdvance = (targetStage: number) => {
    if (targetStage <= stage) return true;
    if (targetStage === 2 && !isPromptBuilt && !settings.masterPrompt) return false;
    if (targetStage >= 3 && !fullDocContent && !editedContent) return false;
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

          {/* Step indicator */}
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
              {/* Stage 0: Brief intake */}
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

              {/* Stage 1: Prompt Builder (with plan review) */}
              {stage === 1 && executionPlan && !isPromptBuilt && !settings.masterPrompt && (
                <StageExecutionTable
                  plan={executionPlan} onPlanChange={setExecutionPlan}
                  settings={settings} onBack={() => { setExecutionPlan(null); setStage(0); }}
                  onConfirm={async () => { await handleConfirmPlan(); await handleBuildPrompt(); }}
                  isProcessing={isProcessing}
                />
              )}
              {stage === 1 && (isPromptBuilt || settings.masterPrompt) && (
                <StagePromptBuilder
                  settings={settings}
                  onSettingsChange={setSettings}
                  sectionSpecs={sectionSpecs || settings.sectionSpecs || ""}
                  onSectionSpecsChange={(t) => { setSectionSpecs(t); setSettings(prev => ({ ...prev, sectionSpecs: t })); }}
                  masterPrompt={masterPrompt || settings.masterPrompt || ""}
                  onMasterPromptChange={(t) => { setMasterPrompt(t); setSettings(prev => ({ ...prev, masterPrompt: t })); }}
                  onBuildPrompt={handleBuildPrompt}
                  onRebuildPrompt={handleRebuildPrompt}
                  isBuilding={isProcessing}
                  isBuilt={isPromptBuilt || !!settings.masterPrompt}
                  onBack={() => setStage(0)}
                  onNext={() => setStage(2)}
                />
              )}
              {stage === 1 && !executionPlan && !isPromptBuilt && !settings.masterPrompt && (
                <div className="text-center py-10">
                  <p className="text-muted-foreground text-sm">No plan generated yet.</p>
                  <button onClick={() => setStage(0)} className="mt-3 text-terracotta text-sm font-semibold hover:underline">← Back to Brief</button>
                </div>
              )}

              {/* Stage 2: Write (full document) */}
              {stage === 2 && (
                <StageWrite
                  sections={sections}
                  generating={generating}
                  streamContent={streamContent}
                  fullDocContent={fullDocContent}
                  onWrite={() => handleWriteDocument(false)}
                  onRewrite={() => handleWriteDocument(true)}
                  onBack={() => setStage(1)}
                  onNext={() => setStage(3)}
                  settings={settings}
                  writeError={writeError}
                  onClearError={() => setWriteError(null)}
                />
              )}

              {/* Stage 3: Edit / Proofread / Humanise */}
              {stage === 3 && (
                <StageEditProofHumanise
                  sections={sections}
                  settings={settings}
                  editedContent={editedContent}
                  generating={generating}
                  streamContent={streamContent}
                  writeError={writeError}
                  onRunPass={handleRunEditPass}
                  onRunAllPasses={handleRunAllEditPasses}
                  onContentChange={(c) => { setEditedContent(c); setFullDocContent(c); }}
                  onClearError={() => setWriteError(null)}
                  onBack={() => setStage(2)}
                  onNext={() => setStage(4)}
                />
              )}

              {/* Stage 4: Critique & Correct */}
              {stage === 4 && (
                <StageCritiqueCorrect
                  sections={sections}
                  settings={settings}
                  editedContent={editedContent}
                  critiqueText={critiqueText}
                  correctedContent={correctedContent}
                  generating={generating}
                  streamContent={streamContent}
                  writeError={writeError}
                  onRunCritiqueAndCorrect={handleCritiqueAndCorrect}
                  onCritiqueChange={setCritiqueText}
                  onCorrectedChange={(c) => { setCorrectedContent(c); setEditedContent(c); setFullDocContent(c); }}
                  onClearError={() => setWriteError(null)}
                  phase={critiquePhase}
                  onBack={() => setStage(3)}
                  onNext={() => setStage(5)}
                />
              )}

              {/* Stage 5: Revision Centre */}
              {stage === 5 && (
                <StageRevisionCenter
                  sections={sections}
                  generating={generating}
                  streamContent={streamContent}
                  writeError={writeError}
                  onReviseDocument={handleReviseDocument}
                  onClearError={() => setWriteError(null)}
                  onBack={() => setStage(4)}
                  onNext={() => setStage(6)}
                />
              )}

              {/* Stage 6: Export */}
              {stage === 6 && (
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
