import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Upload, Link2, ClipboardPaste, ChevronRight, X, File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const assessmentTypes = [
  "Essay", "Report", "Case Study", "Dissertation", "Literature Review",
  "Research Paper", "Reflection", "Presentation Script", "Proposal", "Other",
];

const citationStyles = [
  "Harvard", "APA 7th", "APA 6th", "MLA", "Chicago", "Vancouver", "IEEE", "OSCOLA",
];

const academicLevels = ["Undergraduate (Year 1)", "Undergraduate (Year 2)", "Undergraduate (Year 3)", "Master's", "PhD", "Professional"];

const aiModels = [
  { id: "google/gemini-2.5-flash", name: "ZOE Standard", desc: "Fast, balanced — default" },
  { id: "google/gemini-2.5-pro", name: "ZOE Pro", desc: "Maximum quality, slower" },
  { id: "google/gemini-2.5-flash-lite", name: "ZOE Rapid", desc: "Fastest, lighter tasks" },
  { id: "openai/gpt-5", name: "GPT-5", desc: "OpenAI flagship" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", desc: "OpenAI balanced" },
  { id: "openai/gpt-5.2", name: "GPT-5.2", desc: "Latest OpenAI reasoning" },
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash", desc: "Next-gen speed" },
  { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", desc: "Next-gen reasoning" },
];

const NewAssessment = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [inputMode, setInputMode] = useState("paste");
  const [briefText, setBriefText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [settings, setSettings] = useState({
    type: "",
    wordCount: "",
    citationStyle: "",
    level: "",
    language: "English",
    model: "google/gemini-2.5-flash",
    sourceDateFrom: "",
    sourceDateTo: "",
    useSeminalSources: false,
  });
  const [parsedBrief, setParsedBrief] = useState<any>(null);
  const [executionPlan, setExecutionPlan] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setUploadedFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const hasBrief = briefText.trim() || uploadedFile || urlInput.trim();

  const handleProceed = async () => {
    if (!hasBrief) {
      toast({ title: "Missing brief", description: "Please provide your assessment brief.", variant: "destructive" });
      return;
    }
    if (!settings.type || !settings.wordCount || !settings.citationStyle || !settings.level) {
      toast({ title: "Incomplete settings", description: "Please fill in all assessment settings.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    toast({ title: "Analysing brief…", description: "ZOE is parsing your assessment brief." });

    try {
      let body: any = {};
      if (uploadedFile) {
        const buffer = await uploadedFile.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        body = { file_base64: base64, file_type: uploadedFile.type || uploadedFile.name.split(".").pop(), model: settings.model };
      } else if (urlInput.trim()) {
        body = { url: urlInput.trim(), model: settings.model };
      } else {
        body = { text: briefText, model: settings.model };
      }

      const { data: parseData, error: parseError } = await supabase.functions.invoke("brief-parse", { body });
      if (parseError) throw parseError;

      const brief = parseData?.brief || { title: settings.type + " Assessment", type: settings.type, raw_text: briefText };
      setParsedBrief(brief);

      if (brief.word_count && !settings.wordCount) {
        setSettings(prev => ({ ...prev, wordCount: String(brief.word_count) }));
      }

      toast({ title: "Generating plan…", description: "Creating the execution table." });

      const { data: planData, error: planError } = await supabase.functions.invoke("execution-table", {
        body: { brief, settings, model: settings.model },
      });
      if (planError) throw planError;

      setExecutionPlan(planData?.plan);
      setStep(2);
      toast({ title: "Plan ready", description: "Review the execution table below." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to process brief.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPlan = async () => {
    if (!user || !executionPlan) return;

    setIsProcessing(true);
    try {
      const { data: assessment, error: aErr } = await supabase.from("assessments").insert({
        user_id: user.id,
        title: executionPlan.title || parsedBrief?.title || "Untitled Assessment",
        type: settings.type,
        brief_text: briefText || parsedBrief?.raw_text || "",
        settings: settings as any,
        execution_plan: executionPlan as any,
        word_target: parseInt(settings.wordCount) || executionPlan.total_words || 3000,
        status: "planning",
      }).select().single();

      if (aErr || !assessment) throw aErr || new Error("Failed to create assessment");

      const sectionInserts = (executionPlan.sections || []).map((s: any) => ({
        assessment_id: assessment.id,
        title: s.title,
        word_target: s.word_target,
        framework: s.framework || null,
        citation_count: s.citation_count || 0,
        sort_order: s.sort_order,
        status: "pending",
      }));

      const { error: sErr } = await supabase.from("sections").insert(sectionInserts);
      if (sErr) throw sErr;

      toast({ title: "Assessment created", description: "Redirecting to workspace…" });
      navigate(`/assessment/${assessment.id}/workspace`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft size={16} />
              </Button>
            </Link>
            <span className="text-sm font-semibold text-foreground">New Assessment</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={step === 1 ? "text-terracotta font-semibold" : ""}>1. Brief</span>
            <ChevronRight size={14} />
            <span className={step === 2 ? "text-terracotta font-semibold" : ""}>2. Execution Plan</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-xl font-bold text-foreground mb-1">Upload your assessment brief</h1>
            <p className="text-sm text-muted-foreground mb-8">Paste, upload, or link your brief. ZOE will extract all requirements.</p>

            <Tabs value={inputMode} onValueChange={setInputMode} className="mb-8">
              <TabsList className="bg-muted">
                <TabsTrigger value="paste" className="gap-1.5"><ClipboardPaste size={14} />Type / Paste</TabsTrigger>
                <TabsTrigger value="upload" className="gap-1.5"><Upload size={14} />Upload File</TabsTrigger>
                <TabsTrigger value="url" className="gap-1.5"><Link2 size={14} />Paste URL</TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="mt-4">
                <Textarea placeholder="Paste your assessment brief here…" value={briefText} onChange={(e) => setBriefText(e.target.value)} className="min-h-[200px] resize-y" />
              </TabsContent>

              <TabsContent value="upload" className="mt-4">
                <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} className="relative border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-terracotta/30 transition-colors">
                  {uploadedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <File size={20} className="text-terracotta" />
                      <span className="text-sm text-foreground font-medium">{uploadedFile.name}</span>
                      <button onClick={() => setUploadedFile(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} className="mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">PDF, DOCX, images — any format</p>
                      <input type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.txt" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="url" className="mt-4">
                <Input placeholder="https://university.edu/assessment-brief.pdf" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-2">Paste a direct link to your brief document.</p>
              </TabsContent>
            </Tabs>

            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Assessment Settings</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Assessment Type</Label>
                  <Select value={settings.type} onValueChange={(v) => setSettings({ ...settings, type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                    <SelectContent>{assessmentTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Word Count</Label>
                  <Input type="number" placeholder="e.g. 3000" value={settings.wordCount} onChange={(e) => setSettings({ ...settings, wordCount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Citation Style</Label>
                  <Select value={settings.citationStyle} onValueChange={(v) => setSettings({ ...settings, citationStyle: v })}>
                    <SelectTrigger><SelectValue placeholder="Select style…" /></SelectTrigger>
                    <SelectContent>{citationStyles.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Academic Level</Label>
                  <Select value={settings.level} onValueChange={(v) => setSettings({ ...settings, level: v })}>
                    <SelectTrigger><SelectValue placeholder="Select level…" /></SelectTrigger>
                    <SelectContent>{academicLevels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* AI Model selector */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">AI Model</Label>
                <Select value={settings.model} onValueChange={(v) => setSettings({ ...settings, model: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {aiModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-medium">{m.name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">— {m.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Citation source settings */}
              <div className="border border-border rounded-lg p-4 space-y-4">
                <h3 className="text-xs font-semibold text-foreground">Source Settings</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Sources from year</Label>
                    <Input type="number" placeholder="e.g. 2018" value={settings.sourceDateFrom} onChange={(e) => setSettings({ ...settings, sourceDateFrom: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Sources to year</Label>
                    <Input type="number" placeholder="e.g. 2024" value={settings.sourceDateTo} onChange={(e) => setSettings({ ...settings, sourceDateTo: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={settings.useSeminalSources} onCheckedChange={(v) => setSettings({ ...settings, useSeminalSources: v })} />
                  <Label className="text-xs text-muted-foreground">Include seminal/foundational sources (pre-date range)</Label>
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-end">
              <Button onClick={handleProceed} disabled={isProcessing} className="bg-terracotta hover:bg-terracotta-600 text-white font-semibold px-8 active:scale-[0.97] transition-transform">
                {isProcessing ? (
                  <><Loader2 size={16} className="mr-1 animate-spin" />Processing…</>
                ) : (
                  <>Generate Execution Plan<ChevronRight size={16} className="ml-1" /></>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && executionPlan && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-xl font-bold text-foreground mb-1">Execution Plan</h1>
            <p className="text-sm text-muted-foreground mb-8">Review and edit the plan before ZOE starts writing.</p>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b border-border">
                <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <div className="col-span-3">Section</div>
                  <div className="col-span-2">Words</div>
                  <div className="col-span-2">Citations</div>
                  <div className="col-span-2">Framework</div>
                  <div className="col-span-3">A+ Criteria</div>
                </div>
              </div>
              {(executionPlan.sections || []).map((row: any, i: number) => (
                <div key={i} className="px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <div className="grid grid-cols-12 gap-4 text-sm">
                    <div className="col-span-3 font-medium text-foreground">{row.title}</div>
                    <div className="col-span-2 text-muted-foreground font-mono text-xs tabular-nums">{row.word_target}</div>
                    <div className="col-span-2 text-muted-foreground text-xs tabular-nums">{row.citation_count || "—"}</div>
                    <div className="col-span-2 text-muted-foreground text-xs">{row.framework || "—"}</div>
                    <div className="col-span-3 text-muted-foreground text-xs">{row.a_plus_criteria || "—"}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span>Total: <span className="font-semibold text-foreground tabular-nums">{executionPlan.total_words?.toLocaleString()}</span> words</span>
              <span><span className="font-semibold text-foreground">{executionPlan.sections?.length}</span> sections</span>
              <span>Model: <span className="font-semibold text-foreground">{aiModels.find(m => m.id === settings.model)?.name || settings.model}</span></span>
            </div>

            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} className="text-muted-foreground">
                <ArrowLeft size={16} className="mr-1" /> Back to Brief
              </Button>
              <Button onClick={handleConfirmPlan} disabled={isProcessing} className="bg-terracotta hover:bg-terracotta-600 text-white font-semibold px-8 active:scale-[0.97] transition-transform">
                {isProcessing ? (
                  <><Loader2 size={16} className="mr-1 animate-spin" />Creating…</>
                ) : (
                  <>Confirm Plan & Begin Writing<ChevronRight size={16} className="ml-1" /></>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default NewAssessment;
