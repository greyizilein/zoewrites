import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Check, RefreshCw, Edit3, Download,
  FileText, CheckCircle2, Clock, Loader2, Send,
  Wand2, ShieldCheck, Sparkles, PlayCircle, X,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Section {
  id: string;
  title: string;
  word_target: number;
  word_current: number;
  status: string;
  content: string | null;
  framework: string | null;
  sort_order: number;
  citation_count: number | null;
}

interface Recommendation {
  type: string;
  severity: string;
  description: string;
  action: string;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock size={14} className="text-muted-foreground" />,
  writing: <Loader2 size={14} className="text-terracotta animate-spin" />,
  complete: <CheckCircle2 size={14} className="text-sage" />,
  reviewing: <RefreshCw size={14} className="text-muted-blue" />,
  humanising: <Wand2 size={14} className="text-dusty-purple animate-pulse" />,
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const Workspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSection, setActiveSection] = useState<string>("");
  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [humanising, setHumanising] = useState(false);
  const [qualityReport, setQualityReport] = useState<any>(null);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [writingAll, setWritingAll] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      const [{ data: aData }, { data: sData }] = await Promise.all([
        supabase.from("assessments").select("*").eq("id", id).single(),
        supabase.from("sections").select("*").eq("assessment_id", id).order("sort_order", { ascending: true }),
      ]);
      setAssessment(aData);
      setSections(sData || []);
      if (sData && sData.length > 0) setActiveSection(sData[0].id);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const totalWords = sections.reduce((a, s) => a + s.word_current, 0);
  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalWords / totalTarget) * 100) : 0;
  const active = sections.find((s) => s.id === activeSection);
  const selectedModel = assessment?.settings?.model || "google/gemini-2.5-flash";

  const fetchRecommendations = useCallback(async (section: Section) => {
    if (!section.content) return;
    setLoadingRecs(true);
    try {
      const { data, error } = await supabase.functions.invoke("zoe-recommend", {
        body: {
          content: section.content,
          section_title: section.title,
          word_target: section.word_target,
          citation_count: section.citation_count,
          framework: section.framework,
          execution_plan: assessment?.execution_plan,
          model: selectedModel,
        },
      });
      if (!error && data?.recommendations) {
        setRecommendations(data.recommendations);
      }
    } catch { /* silent */ }
    setLoadingRecs(false);
  }, [assessment, selectedModel]);

  const streamSection = useCallback(async (sectionId: string, isRevision = false, feedback = "") => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    setGenerating(true);
    setStreamContent("");

    await supabase.from("sections").update({ status: "writing" }).eq("id", sectionId);
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, status: "writing" } : s));

    const priorSections = sections.filter(s => s.sort_order < section.sort_order && s.content);
    const priorSummary = priorSections.map(s => `${s.title}: ${(s.content || "").slice(0, 200)}...`).join("\n");

    const endpoint = isRevision ? "section-revise" : "section-generate";
    const body = isRevision
      ? { content: section.content, feedback, word_target: section.word_target, section_title: section.title, model: selectedModel }
      : {
          section: { title: section.title, word_target: section.word_target, framework: section.framework, citation_count: section.citation_count, a_plus_criteria: "" },
          execution_plan: assessment?.execution_plan,
          prior_sections_summary: priorSummary,
          citation_style: assessment?.settings?.citationStyle || "Harvard",
          academic_level: assessment?.settings?.level || "Undergraduate",
          model: selectedModel,
        };

    try {
      const resp = await fetch(`${CHAT_URL}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 429) throw new Error("Rate limited. Please wait a moment and try again.");
        if (resp.status === 402) throw new Error("Credits exhausted. Please top up your account.");
        throw new Error(errData.error || "Stream failed");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setStreamContent(fullContent);
            }
          } catch { /* partial JSON */ }
        }
      }

      const wordCount = fullContent.split(/\s+/).filter(Boolean).length;
      await supabase.from("sections").update({
        content: fullContent,
        word_current: wordCount,
        status: "complete",
      }).eq("id", sectionId);

      setSections(prev => prev.map(s =>
        s.id === sectionId ? { ...s, content: fullContent, word_current: wordCount, status: "complete" } : s
      ));

      const newTotal = sections.reduce((a, s) => a + (s.id === sectionId ? wordCount : s.word_current), 0);
      await supabase.from("assessments").update({ word_current: newTotal }).eq("id", id);

      toast({ title: "Section complete", description: `${section.title} — ${wordCount} words written.` });

      // Auto-fetch recommendations
      fetchRecommendations({ ...section, content: fullContent, word_current: wordCount });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      await supabase.from("sections").update({ status: "pending" }).eq("id", sectionId);
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, status: "pending" } : s));
    } finally {
      setGenerating(false);
      setStreamContent("");
      setShowRevisionInput(false);
      setRevisionFeedback("");
    }
  }, [sections, assessment, id, toast, selectedModel, fetchRecommendations]);

  const handleHumanise = async () => {
    if (!active?.content) return;
    setHumanising(true);
    toast({ title: "Humanising…", description: "Running 5-pass pipeline. This may take a moment." });
    try {
      const { data, error } = await supabase.functions.invoke("humanise", {
        body: {
          content: active.content,
          word_target: active.word_target,
          mode: "full",
          model: selectedModel,
        },
      });
      if (error) throw error;
      if (data?.humanised_content) {
        const wordCount = data.word_count || data.humanised_content.split(/\s+/).filter(Boolean).length;
        await supabase.from("sections").update({ content: data.humanised_content, word_current: wordCount }).eq("id", active.id);
        setSections(prev => prev.map(s =>
          s.id === active.id ? { ...s, content: data.humanised_content, word_current: wordCount } : s
        ));
        toast({ title: "Humanised!", description: `${data.passes_applied?.length || 5} passes applied. ${wordCount} words.` });
      }
    } catch (e: any) {
      toast({ title: "Humanise failed", description: e.message, variant: "destructive" });
    }
    setHumanising(false);
  };

  const handleQualityCheck = async () => {
    const allContent = sections.filter(s => s.content).map(s => `## ${s.title}\n${s.content}`).join("\n\n");
    if (!allContent) {
      toast({ title: "No content to check", variant: "destructive" });
      return;
    }
    setQualityLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("quality-pass", {
        body: {
          content: allContent,
          execution_plan: assessment?.execution_plan,
          word_target: totalTarget,
          model: selectedModel,
        },
      });
      if (error) throw error;
      setQualityReport(data);
      setShowQualityModal(true);
    } catch (e: any) {
      toast({ title: "Quality check failed", description: e.message, variant: "destructive" });
    }
    setQualityLoading(false);
  };

  const handleWriteAll = async () => {
    const pendingSections = sections.filter(s => s.status === "pending" || !s.content);
    if (pendingSections.length === 0) {
      toast({ title: "All sections already written" });
      return;
    }
    setWritingAll(true);
    for (const section of pendingSections) {
      setActiveSection(section.id);
      await streamSection(section.id);
      await new Promise(r => setTimeout(r, 1000)); // Brief pause between sections
    }
    setWritingAll(false);
    toast({ title: "All sections complete!", description: `${pendingSections.length} sections written.` });
  };

  const handleExport = async () => {
    toast({ title: "Exporting…", description: "Generating .docx file." });
    try {
      const { data, error } = await supabase.functions.invoke("export-docx", {
        body: { assessment_id: id },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
        toast({ title: "Export ready", description: "Your .docx has been downloaded." });
      }
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    }
  };

  const applyRecommendation = (rec: Recommendation) => {
    if (!active) return;
    setRevisionFeedback(rec.action);
    setShowRevisionInput(true);
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user" as const, content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    let assistantSoFar = "";
    const sectionsSum = sections.map(s => `${s.title} (${s.status}, ${s.word_current}w)`).join(", ");

    try {
      const resp = await fetch(`${CHAT_URL}/zoe-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg],
          section_content: active?.content || "",
          assessment_title: assessment?.title || "",
          sections_summary: sectionsSum,
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
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch { /* partial */ }
        }
      }
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    }
    setChatLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-full mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8">
                <ArrowLeft size={15} />
              </Button>
            </Link>
            <span className="text-sm font-semibold text-foreground truncate max-w-[300px]">
              {assessment?.title || "Assessment"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setChatOpen(!chatOpen)} size="sm" variant={chatOpen ? "default" : "outline"} className={`h-8 text-xs ${chatOpen ? "bg-terracotta hover:bg-terracotta-600 text-white" : ""}`}>
              <MessageCircle size={13} className="mr-1" /> Ask ZOE
            </Button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground mr-2">
              <span className="tabular-nums">{totalWords.toLocaleString()} / {totalTarget.toLocaleString()}</span>
              <Progress value={overallProgress} className="w-20 h-1.5" />
              <span className="tabular-nums">{overallProgress}%</span>
            </div>
            <Button onClick={handleWriteAll} disabled={writingAll || generating} size="sm" variant="outline" className="h-8 text-xs hidden sm:flex">
              {writingAll ? <Loader2 size={13} className="mr-1 animate-spin" /> : <PlayCircle size={13} className="mr-1" />}
              Write All
            </Button>
            <Button onClick={handleQualityCheck} disabled={qualityLoading} size="sm" variant="outline" className="h-8 text-xs hidden sm:flex">
              {qualityLoading ? <Loader2 size={13} className="mr-1 animate-spin" /> : <ShieldCheck size={13} className="mr-1" />}
              Quality Check
            </Button>
            <Button onClick={handleExport} size="sm" className="bg-terracotta hover:bg-terracotta-600 text-white font-semibold h-8 text-xs active:scale-[0.97] transition-transform">
              <Download size={13} className="mr-1" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-border bg-card/30 p-4 hidden md:block overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Sections</p>
          <div className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => { setActiveSection(section.id); setRecommendations([]); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2.5 transition-colors ${
                  activeSection === section.id
                    ? "bg-terracotta/10 text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {statusIcons[section.status] || statusIcons.pending}
                <span className="truncate flex-1">{section.title}</span>
                <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">
                  {section.word_current}/{section.word_target}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          {active && (
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl mx-auto px-6 py-8"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {statusIcons[active.status] || statusIcons.pending}
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {active.status === "writing" ? "Writing…" : active.status}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-foreground">{active.title}</h2>
                  {active.framework && (
                    <p className="text-xs text-muted-foreground mt-1">Framework: {active.framework}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    <span className="tabular-nums font-mono">{active.word_current}</span> / <span className="tabular-nums font-mono">{active.word_target}</span> words
                  </p>
                  <Progress value={active.word_target > 0 ? (active.word_current / active.word_target) * 100 : 0} className="w-28 h-1 mt-1" />
                </div>
              </div>

              {generating && activeSection === active.id ? (
                <div className="prose prose-sm max-w-none text-foreground/85 leading-relaxed whitespace-pre-wrap">
                  {streamContent || (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Loader2 size={28} className="text-terracotta animate-spin mb-4" />
                      <p className="text-sm text-muted-foreground">ZOE is writing this section…</p>
                    </div>
                  )}
                </div>
              ) : active.content ? (
                <>
                  <div className="prose prose-sm max-w-none text-foreground/85 leading-relaxed whitespace-pre-wrap">
                    {active.content}
                  </div>
                  <div className="mt-8 border-t border-border pt-6">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <Button onClick={() => toast({ title: "Section accepted" })} size="sm" className="bg-sage hover:bg-sage/80 text-white font-medium h-8 text-xs active:scale-[0.97] transition-transform">
                        <Check size={13} className="mr-1" /> Accept
                      </Button>
                      <Button onClick={() => setShowRevisionInput(!showRevisionInput)} size="sm" variant="outline" className="h-8 text-xs">
                        <Edit3 size={13} className="mr-1" /> Revise
                      </Button>
                      <Button onClick={() => streamSection(active.id)} size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground">
                        <RefreshCw size={13} className="mr-1" /> Regenerate
                      </Button>
                      <Button onClick={handleHumanise} disabled={humanising} size="sm" variant="outline" className="h-8 text-xs border-dusty-purple/30 text-dusty-purple hover:bg-dusty-purple/10">
                        {humanising ? <Loader2 size={13} className="mr-1 animate-spin" /> : <Wand2 size={13} className="mr-1" />}
                        Humanise
                      </Button>
                    </div>
                    {showRevisionInput && (
                      <div className="flex gap-2">
                        <Textarea
                          value={revisionFeedback}
                          onChange={(e) => setRevisionFeedback(e.target.value)}
                          placeholder="Describe what to change…"
                          className="min-h-[80px] text-sm"
                        />
                        <Button
                          onClick={() => streamSection(active.id, true, revisionFeedback)}
                          disabled={!revisionFeedback.trim()}
                          size="sm"
                          className="bg-terracotta hover:bg-terracotta-600 text-white self-end"
                        >
                          <Send size={13} />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* ZOE Recommends */}
                  {(recommendations.length > 0 || loadingRecs) && (
                    <div className="mt-6 p-4 rounded-xl border border-terracotta/15 bg-terracotta/[0.03]">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={14} className="text-terracotta" />
                        <span className="text-xs font-semibold text-foreground">ZOE recommends</span>
                      </div>
                      {loadingRecs ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 size={12} className="animate-spin" /> Analysing…
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {recommendations.map((rec, i) => (
                            <div key={i} className="p-2.5 rounded-lg bg-background border border-border">
                              <div className="flex items-start gap-2">
                                <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                  rec.severity === "high" ? "bg-terracotta/15 text-terracotta" :
                                  rec.severity === "medium" ? "bg-warm-gold/15 text-warm-gold" :
                                  "bg-sage/15 text-sage"
                                }`}>{rec.type}</span>
                                <p className="text-xs text-muted-foreground flex-1">{rec.description}</p>
                              </div>
                              <div className="mt-2 flex gap-1.5">
                                <button onClick={() => applyRecommendation(rec)} className="text-[10px] px-2 py-0.5 rounded bg-terracotta/10 text-terracotta font-medium hover:bg-terracotta/20 transition-colors">
                                  Apply
                                </button>
                                <button onClick={() => setRecommendations(prev => prev.filter((_, j) => j !== i))} className="text-[10px] px-2 py-0.5 rounded text-muted-foreground hover:text-foreground transition-colors">
                                  Skip
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : active.status === "pending" ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText size={28} className="text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground">This section hasn't been written yet.</p>
                  <Button onClick={() => streamSection(active.id)} className="mt-4 bg-terracotta hover:bg-terracotta-600 text-white font-semibold active:scale-[0.97] transition-transform">
                    Generate this section
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Loader2 size={28} className="text-terracotta animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">Processing…</p>
                </div>
              )}
            </motion.div>
          )}
        </main>

        {/* ZOE Chat Sidebar */}
        {chatOpen && (
          <aside className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col md:static md:inset-auto md:z-auto md:w-80 md:border-l md:border-border md:bg-card/50 md:backdrop-blur-none">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-terracotta" />
                <span className="text-xs font-semibold text-foreground">Ask ZOE</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <Sparkles size={24} className="mx-auto text-terracotta/30 mb-3" />
                  <p className="text-xs text-muted-foreground">Ask ZOE anything about your assessment.</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`text-xs leading-relaxed ${msg.role === "user" ? "text-right" : ""}`}>
                  <div className={`inline-block max-w-[90%] p-2.5 rounded-lg ${
                    msg.role === "user"
                      ? "bg-terracotta text-white rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" /> ZOE is thinking…
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChatSend()}
                  placeholder="Ask a question…"
                  className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-terracotta/30"
                />
                <Button onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()} size="sm" className="bg-terracotta hover:bg-terracotta-600 text-white h-8 w-8 p-0">
                  <Send size={12} />
                </Button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Quality Report Modal */}
      {showQualityModal && qualityReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-xl border border-border max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Quality Report</h3>
              <button onClick={() => setShowQualityModal(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-2xl font-bold ${
                qualityReport.report?.overall_grade?.startsWith("A") ? "text-sage" :
                qualityReport.report?.overall_grade?.startsWith("B") ? "text-muted-blue" : "text-terracotta"
              }`}>{qualityReport.report?.overall_grade || "—"}</span>
              <div>
                <p className="text-xs text-muted-foreground">Word count: {qualityReport.pre_check?.word_count?.toLocaleString()} / {qualityReport.pre_check?.word_target?.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Diff: {qualityReport.pre_check?.diff_percent}%</p>
              </div>
            </div>
            {qualityReport.pre_check?.banned_phrases?.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-terracotta/10 border border-terracotta/20">
                <p className="text-xs font-semibold text-terracotta mb-1">Banned phrases detected:</p>
                <p className="text-xs text-muted-foreground">{qualityReport.pre_check.banned_phrases.join(", ")}</p>
              </div>
            )}
            <p className="text-sm text-foreground/80 mb-4">{qualityReport.report?.summary}</p>
            {qualityReport.report?.issues?.length > 0 && (
              <div className="space-y-2">
                {qualityReport.report.issues.map((issue: any, i: number) => (
                  <div key={i} className={`p-3 rounded-lg border ${
                    issue.severity === "critical" ? "bg-terracotta/5 border-terracotta/20" :
                    issue.severity === "major" ? "bg-warm-gold/5 border-warm-gold/20" :
                    "bg-muted/50 border-border"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-bold uppercase ${
                        issue.severity === "critical" ? "text-terracotta" :
                        issue.severity === "major" ? "text-warm-gold" : "text-muted-foreground"
                      }`}>{issue.severity}</span>
                      {issue.section && <span className="text-[9px] text-muted-foreground">• {issue.section}</span>}
                    </div>
                    <p className="text-xs text-foreground/80">{issue.description}</p>
                    <p className="text-xs text-muted-foreground mt-1 italic">{issue.suggestion}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Workspace;
