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
import { countWords, countBodyWords, getBodyContent, truncateToWordCeiling } from "@/lib/wordCount";

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
  const [coherenceReport, setCoherenceReport] = useState<any>(null);
  const [autoPhase, setAutoPhase] = useState<AutoPhase>(null);
  const [progressMessage, setProgressMessage] = useState("");
  const [submissionDetails, setSubmissionDetails] = useState<SubmissionDetails | undefined>();
  const [selectedFont, setSelectedFont] = useState("Calibri 12pt");
  const [briefText, setBriefText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [activeIntakeMode, setActiveIntakeMode] = useState<"paste" | "upload" | "url" | "fields">("paste");

  const [generating, setGenerating] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [writeError, setWriteError] = useState<string | null>(null);

  const [imageVariants, setImageVariants] = useState<any[]>([]);
  const [imagesSkipped, setImagesSkipped] = useState(false);
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
          description: "Keep this tab active for best results. Progress is saved per section.",
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
      // Stay at stage 0 — routing shows StageExecutionTable automatically
      toast({ title: "Plan ready — review before writing" });
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

  // ─── Parse full document into sections ───────────────────────────────────────
  const parseFullDocument = (fullContent: string): Record<string, string> => {
    const result: Record<string, string> = {};
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const escapedTitle = section.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const headingRe = new RegExp(`(?:^|\n)##\s*${escapedTitle}\s*(?:\n|$)`, "i");
      const headingMatch = headingRe.exec(fullContent);
      if (!headingMatch) continue;
      const afterHeading = fullContent.slice(headingMatch.index + headingMatch[0].length);
      // Find end: next known section heading or --- separator
      let endIdx = afterHeading.length;
      for (let j = i + 1; j < sections.length; j++) {
        const nextTitle = sections[j].title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const nextRe = new RegExp(`\n##\s*${nextTitle}\s*(?:\n|$)`, "i");
        const nextMatch = nextRe.exec(afterHeading);
        if (nextMatch && nextMatch.index < endIdx) endIdx = nextMatch.index;
      }
      const sepMatch = /\n---\n/.exec(afterHeading);
      if (sepMatch && sepMatch.index < endIdx) endIdx = sepMatch.index;
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
    const newTotal = sections.reduce((a, s) => a + (parsedMap[s.id] ? countBodyWords(parsedMap[s.id]) : s.word_current), 0);
    if (assessment?.id) await supabase.from("assessments").update({ word_current: newTotal }).eq("id", assessment.id);
  };

  // ─── Full document generation (sequential section-generate loop) ─────────────
  const handleWriteDocument = async () => {
    if (sections.length === 0) return;
    setGenerating(true);
    setWriteError(null);
    setStreamContent("");

    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (!accessToken) {
      setWriteError("Session expired — please sign in again.");
      setGenerating(false);
      return;
    }

    const writtenContent: Record<string, string> = {};
    let displayContent = "";
    const isHarvard = (settings.citationStyle || "Harvard").toLowerCase().includes("harvard");

    try {
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        setProgressMessage(`Writing ${i + 1} of ${sections.length}: ${section.title}…`);

        // Build prior sections context from already-written content this run
        const priorParts = sections.slice(0, i)
          .filter(s => writtenContent[s.id])
          .map(s => `## ${s.title}\n${getBodyContent(writtenContent[s.id]).slice(0, 1000)}`);
        const priorSummary = priorParts.join("\n\n");

        const resp = await fetch(`${CHAT_URL}/section-generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            section: {
              title: section.title, word_target: section.word_target,
              framework: section.framework, citation_count: section.citation_count,
              a_plus_criteria: section.a_plus_criteria || "",
              purpose_scope: section.purpose_scope || "",
              learning_outcomes: section.learning_outcomes || "",
              required_inputs: section.required_inputs || "",
              structure_formatting: section.structure_formatting || "",
              constraints_text: section.constraints_text || "",
            },
            execution_plan: assessment?.execution_plan || executionPlan,
            prior_sections_summary: priorSummary,
            citation_style: settings.citationStyle || "Harvard",
            academic_level: settings.level || "Postgraduate L7",
            model: selectedModel, settings,
            brief_text: assessment?.brief_text || briefText || "",
            topic: settings.topic || "",
          }),
        });

        if (!resp.ok || !resp.body) {
          if (resp.status === 429) throw new Error("Rate limited — please wait a moment.");
          if (resp.status === 402) throw new Error("Credits exhausted.");
          throw new Error(`Write failed (${resp.status})`);
        }

        const sectionPrefix = (displayContent ? "\n\n---\n\n" : "") + `## ${section.title}\n\n`;
        const baseDisplay = displayContent + sectionPrefix;

        const sectionBody = await readContentStream(resp.body, (chunk) => {
          setStreamContent(baseDisplay + chunk);
        });

        // Apply Harvard citation fix
        let fixedBody = sectionBody;
        if (isHarvard) {
          fixedBody = sectionBody.replace(/\(([A-Z][^)]*?)&([^)]*?\d{4}[a-z]?)\)/g, "($1and$2)");
        }

        writtenContent[section.id] = fixedBody;
        displayContent = baseDisplay + fixedBody;

        // Save section to DB
        const wc = countBodyWords(fixedBody);
        await supabase.from("sections").update({ content: fixedBody, word_current: wc, status: "complete" }).eq("id", section.id);
        setSections(prev => prev.map(s => s.id === section.id ? { ...s, content: fixedBody, word_current: wc, status: "complete" } : s));
      }

      // Update total word count on assessment
      const newTotal = Object.values(writtenContent).reduce((a, c) => a + countBodyWords(c), 0);
      if (assessment?.id) await supabase.from("assessments").update({ word_current: newTotal }).eq("id", assessment.id);

    } catch (e: any) {
      setWriteError(e.message || "Generation failed");
    } finally {
      setGenerating(false);
      setStreamContent("");
      setProgressMessage("");
    }
  };

  // ─── Full document revision (sequential section-revise loop) ─────────────────
  const handleReviseDocument = async (feedback: string) => {
    if (!feedback.trim()) return;
    const contentSections = sections.filter(s => s.content && s.content.trim().length > 50);
    if (contentSections.length === 0) {
      toast({ title: "Nothing to revise — write the document first.", variant: "destructive" }); return;
    }

    setGenerating(true);
    setWriteError(null);
    setStreamContent("");

    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (!accessToken) {
      setWriteError("Session expired — please sign in again.");
      setGenerating(false);
      return;
    }

    let displayContent = "";
    const isHarvard = (settings.citationStyle || "Harvard").toLowerCase().includes("harvard");

    try {
      // Helper: filter feedback lines to what's relevant for a specific section
      const filterFeedback = (fullFeedback: string, sectionTitle: string): string => {
        const lines = fullFeedback.split("\n");
        const titleLower = sectionTitle.toLowerCase();
        const additionalIdx = lines.findIndex(l => l.startsWith("ADDITIONAL INSTRUCTIONS"));
        const issueLines = additionalIdx >= 0 ? lines.slice(0, additionalIdx) : lines;
        const additional = additionalIdx >= 0 ? lines.slice(additionalIdx).join("\n") : "";

        const relevant = issueLines.filter(line => {
          if (!line.trim()) return false;
          // Always include document-wide and coherence issues
          if (/\[document\]/i.test(line) || /\[coherence/i.test(line)) return true;
          // Include if no section tag (bare instruction)
          if (!/\[[^\]]+\]\s*\[[^\]]+\]/.test(line)) return true;
          // Include if section tag matches this section's title
          const sectionTagMatch = line.match(/\[([^\]]+)\]\s*\[([^\]]+)\]/);
          if (sectionTagMatch) {
            const tag = sectionTagMatch[2].toLowerCase();
            return titleLower.includes(tag) || tag.includes(titleLower);
          }
          return false;
        });

        const parts = [relevant.join("\n"), additional].filter(s => s.trim());
        return parts.join("\n\n");
      };

      for (let i = 0; i < contentSections.length; i++) {
        const section = contentSections[i];
        setProgressMessage(`Revising ${i + 1} of ${contentSections.length}: ${section.title}…`);

        const sectionFeedback = filterFeedback(feedback, section.title);
        if (!sectionFeedback.trim()) continue; // nothing relevant for this section

        const resp = await fetch(`${CHAT_URL}/section-revise`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            content: section.content,
            feedback: sectionFeedback,
            word_target: section.word_target,
            section_title: section.title,
            model: selectedModel, settings,
            brief_text: assessment?.brief_text || briefText || "",
            topic: settings.topic || "",
          }),
        });

        if (!resp.ok || !resp.body) {
          if (resp.status === 429) throw new Error("Rate limited — please wait a moment.");
          if (resp.status === 402) throw new Error("Credits exhausted.");
          throw new Error(`Revision failed (${resp.status})`);
        }

        const sectionPrefix = (displayContent ? "\n\n---\n\n" : "") + `## ${section.title}\n\n`;
        const baseDisplay = displayContent + sectionPrefix;

        const sectionBody = await readContentStream(resp.body, (chunk) => {
          setStreamContent(baseDisplay + chunk);
        });

        let fixedBody = sectionBody;
        if (isHarvard) {
          fixedBody = sectionBody.replace(/\(([A-Z][^)]*?)&([^)]*?\d{4}[a-z]?)\)/g, "($1and$2)");
        }

        displayContent = baseDisplay + fixedBody;

        const wc = countBodyWords(fixedBody);
        await supabase.from("sections").update({ content: fixedBody, word_current: wc }).eq("id", section.id);
        setSections(prev => prev.map(s => s.id === section.id ? { ...s, content: fixedBody, word_current: wc } : s));
      }

      // Recalculate from latest sections state
      const latestTotal = sections.reduce((a, s) => a + (s.word_current || 0), 0);
      if (assessment?.id) await supabase.from("assessments").update({ word_current: latestTotal }).eq("id", assessment.id);

    } catch (e: any) {
      setWriteError(e.message || "Revision failed");
    } finally {
      setGenerating(false);
      setStreamContent("");
      setProgressMessage("");
    }
  };

  // ─── Review: Quality + coherence scan ───────────────────────────────────────
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
            requirements: parsedBrief.requirements,
            marking_criteria: parsedBrief.marking_criteria,
            learning_outcomes: parsedBrief.learning_outcomes,
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

  // ─── Review: Run scan (alias for quality check) ───
  const handleRunScan = async () => {
    const data = await handleQualityCheck();
    return data;
  };

  // ─── STAGE 8: Export ───

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
                  generating={generating}
                  streamContent={streamContent}
                  fullDocContent={sections.filter(s => s.content && s.content.trim().length > 50).map(s => `## ${s.title}\n\n${s.content}`).join("\n\n---\n\n")}
                  onWrite={handleWriteDocument}
                  onBack={() => { setExecutionPlan(executionPlan); setStage(0); }}
                  onNext={() => setStage(2)}
                  settings={settings}
                  writeError={writeError}
                  onClearError={() => setWriteError(null)}
                />
              )}

              {/* Stage 2: Review */}
              {stage === 2 && (
                <StageReview
                  sections={sections}
                  fullDocContent={sections.filter(s => s.content && s.content.trim().length > 50).map(s => `## ${s.title}\n\n${s.content}`).join("\n\n---\n\n")}
                  qualityReport={qualityReport}
                  coherenceReport={coherenceReport}
                  isProcessing={isProcessing}
                  generating={generating}
                  streamContent={streamContent}
                  writeError={writeError}
                  onRunScan={handleRunScan}
                  onReviseDocument={handleReviseDocument}
                  onClearError={() => setWriteError(null)}
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
