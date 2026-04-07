import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Section, WriterSettings, DEFAULT_WRITER_SETTINGS, STAGE_LABELS } from "@/components/writer/types";
import { readContentStream } from "@/lib/sseStream";

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function WriterEngine() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<any>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [stage, setStage] = useState(0);
  const [briefText, setBriefText] = useState("");
  const [settings, setSettings] = useState<WriterSettings>(DEFAULT_WRITER_SETTINGS);
  const [selectedModel] = useState("google/gemini-3-flash-preview");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Load assessment data
  const loadData = useCallback(async () => {
    if (!user || !id || id === "new") {
      if (id === "new") {
        // Create new assessment
        const { data, error } = await supabase.from("assessments").insert({ user_id: user!.id }).select().single();
        if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
        navigate(`/assessment/${data.id}`, { replace: true });
        return;
      }
      setLoading(false);
      return;
    }
    const [{ data: a }, { data: s }] = await Promise.all([
      supabase.from("assessments").select("*").eq("id", id).single(),
      supabase.from("sections").select("*").eq("assessment_id", id).order("sort_order"),
    ]);
    if (a) {
      setAssessment(a);
      setBriefText(a.brief_text || "");
      if (a.settings) {
        const saved = a.settings as any;
        setSettings(prev => ({ ...prev, ...saved }));
      }
    }
    if (s) {
      setSections(s as Section[]);
      if (s.length > 0 && !activeSection) setActiveSection(s[0].id);
    }
    // Determine stage from data
    if (s && s.length > 0) {
      const hasContent = s.some((sec: any) => sec.content && sec.content.length > 50);
      if (hasContent) setStage(2);
      else setStage(1);
    }
    setLoading(false);
  }, [user, id, navigate, toast, activeSection]);

  useEffect(() => { loadData(); }, [loadData]);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  // Pipeline actions
  const handleAnalyseBrief = async () => {
    if (!briefText.trim() || !assessment) return;
    setStage(0);
    toast({ title: "Analysing brief…" });
    try {
      const token = await getToken();
      const resp = await fetch(`${FUNC_URL}/brief-parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brief_text: briefText, assessment_id: assessment.id, model: selectedModel }),
      });
      if (!resp.ok) throw new Error("Brief analysis failed");
      await loadData();
      setStage(1);
      toast({ title: "Brief analysed", description: "Sections created from your brief." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const streamSection = async (sectionId: string, isRevision = false, feedback?: string) => {
    setStreamingId(sectionId);
    try {
      const token = await getToken();
      const sec = sections.find(s => s.id === sectionId);
      if (!sec) return;
      const endpoint = isRevision ? "section-revise" : "section-generate";
      const resp = await fetch(`${FUNC_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          section_id: sectionId,
          assessment_id: assessment.id,
          model: selectedModel,
          ...(isRevision && feedback ? { feedback } : {}),
        }),
      });
      if (!resp.ok || !resp.body) throw new Error("Generation failed");
      await readContentStream(resp.body, (text) => {
        setSections(prev => prev.map(s => s.id === sectionId ? { ...s, content: text, word_current: text.split(/\s+/).filter(Boolean).length } : s));
      });
      await loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setStreamingId(null);
  };

  const handleWriteAll = async () => {
    setStage(2);
    for (const sec of sections.filter(s => !s.content || s.content.length < 50)) {
      await streamSection(sec.id);
    }
    toast({ title: "All sections written" });
  };

  const handleQualityCheck = async () => {
    toast({ title: "Running quality check…" });
    try {
      const token = await getToken();
      const resp = await fetch(`${FUNC_URL}/quality-pass`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assessment_id: assessment.id, model: selectedModel }),
      });
      if (!resp.ok) throw new Error("Quality check failed");
      const data = await resp.json();
      toast({ title: "Quality check complete", description: `Score: ${data?.score || "N/A"}` });
      setStage(3);
      return data;
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleEditProofread = async () => {
    toast({ title: "Running edit & proofread…" });
    try {
      const token = await getToken();
      const resp = await fetch(`${FUNC_URL}/edit-proofread`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assessment_id: assessment.id, model: selectedModel }),
      });
      if (!resp.ok) throw new Error("Edit failed");
      await loadData();
      setStage(4);
      toast({ title: "Edit & proofread complete" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleGenerateImages = async () => {
    toast({ title: "Generating images…" });
    try {
      const token = await getToken();
      const resp = await fetch(`${FUNC_URL}/generate-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assessment_id: assessment.id, model: selectedModel }),
      });
      if (!resp.ok) throw new Error("Image generation failed");
      toast({ title: "Images generated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleExport = async () => {
    toast({ title: "Exporting document…" });
    try {
      const token = await getToken();
      const resp = await fetch(`${FUNC_URL}/export-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assessment_id: assessment.id }),
      });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${assessment.title || "document"}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setStage(5);
      toast({ title: "Export complete" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const currentSection = sections.find(s => s.id === activeSection);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-foreground truncate">{assessment?.title || "New Assessment"}</h1>
          <div className="flex items-center gap-1 mt-0.5">
            {STAGE_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-1">
                <button
                  onClick={() => setStage(i)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                    i === stage
                      ? "bg-primary text-primary-foreground"
                      : i < stage
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
                {i < STAGE_LABELS.length - 1 && <ChevronRight size={10} className="text-muted-foreground/50" />}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Stage content */}
      <main className="flex-1 overflow-y-auto">
        {/* Stage 0: Brief */}
        {stage === 0 && (
          <div className="max-w-2xl mx-auto p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Paste Your Brief</h2>
            <textarea
              value={briefText}
              onChange={e => setBriefText(e.target.value)}
              placeholder="Paste your assignment brief here…"
              className="w-full min-h-[300px] p-4 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button onClick={handleAnalyseBrief} disabled={!briefText.trim()} className="w-full">
              Analyse Brief
            </Button>
          </div>
        )}

        {/* Stage 1: Plan / Execution Table */}
        {stage === 1 && (
          <div className="max-w-2xl mx-auto p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Execution Plan</h2>
            {sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sections yet. Go back to Brief stage and analyse your brief first.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {sections.map((sec, i) => (
                    <div key={sec.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                      <span className="text-xs font-bold text-muted-foreground w-6">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{sec.title}</p>
                        <p className="text-[11px] text-muted-foreground">{sec.word_target} words · {sec.framework || "No framework"}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sec.status === "complete" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {sec.status}
                      </span>
                    </div>
                  ))}
                </div>
                <Button onClick={handleWriteAll} className="w-full">Write All Sections</Button>
              </>
            )}
          </div>
        )}

        {/* Stage 2: Write */}
        {stage === 2 && (
          <div className="flex flex-col md:flex-row h-[calc(100vh-64px)]">
            {/* Section nav */}
            <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto flex-shrink-0">
              <div className="p-3 space-y-1">
                {sections.map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSection(sec.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      activeSection === sec.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="truncate block">{sec.title}</span>
                    <span className="text-[10px] opacity-60">{sec.word_current}/{sec.word_target}w</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Editor area */}
            <div className="flex-1 overflow-y-auto p-6">
              {currentSection ? (
                <div className="max-w-3xl mx-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground">{currentSection.title}</h2>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={streamingId === currentSection.id}
                        onClick={() => streamSection(currentSection.id)}
                      >
                        {streamingId === currentSection.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        {currentSection.content ? "Rewrite" : "Generate"}
                      </Button>
                      {currentSection.content && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => streamSection(currentSection.id, true)}
                        >
                          Revise
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="min-h-[400px] p-4 rounded-xl border border-input bg-card text-sm whitespace-pre-wrap">
                    {currentSection.content || (
                      <span className="text-muted-foreground italic">No content yet. Click Generate to start writing.</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground text-right">
                    {currentSection.word_current} / {currentSection.word_target} words
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center mt-20">Select a section from the sidebar</p>
              )}
            </div>
          </div>
        )}

        {/* Stage 3: Review */}
        {stage === 3 && (
          <div className="max-w-2xl mx-auto p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Review & Quality Check</h2>
            <p className="text-sm text-muted-foreground">Run a quality check to get feedback on your sections.</p>
            <div className="flex gap-3">
              <Button onClick={handleQualityCheck}>Run Quality Check</Button>
              <Button variant="outline" onClick={handleEditProofread}>Edit & Proofread</Button>
            </div>
          </div>
        )}

        {/* Stage 4: Revise */}
        {stage === 4 && (
          <div className="max-w-2xl mx-auto p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Revision Center</h2>
            <p className="text-sm text-muted-foreground">Select sections to revise with feedback.</p>
            <div className="space-y-2">
              {sections.filter(s => s.content).map(sec => (
                <div key={sec.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{sec.title}</p>
                    <p className="text-[11px] text-muted-foreground">{sec.word_current} words</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => streamSection(sec.id, true)}>
                    Revise
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage 5: Export */}
        {stage === 5 && (
          <div className="max-w-2xl mx-auto p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Export</h2>
            <p className="text-sm text-muted-foreground">Your document is ready. Export as DOCX.</p>
            <div className="flex gap-3">
              <Button onClick={handleExport}>Export DOCX</Button>
              <Button variant="outline" onClick={handleGenerateImages}>Generate Images</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
