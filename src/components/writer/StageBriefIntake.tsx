import { useCallback, useState } from "react";
import { File, X, Search, ChevronDown, ChevronUp } from "lucide-react";
import PersonalisePanel from "./PersonalisePanel";
import StickyFooter from "./StickyFooter";
import { WriterSettings, assessmentTypes, citationStyles, academicLevels, aiModels, DATA_SOURCES_BY_CATEGORY, IMAGE_TYPES } from "./types";

interface Props {
  settings: WriterSettings;
  onSettingsChange: (s: WriterSettings) => void;
  briefText: string;
  onBriefTextChange: (t: string) => void;
  uploadedFiles: File[];
  onFilesChange: (f: File[]) => void;
  urlInput: string;
  onUrlChange: (u: string) => void;
  activeTab: "paste" | "upload" | "url" | "fields";
  onTabChange: (t: "paste" | "upload" | "url" | "fields") => void;
  onAnalyse: () => void;
  isProcessing: boolean;
}

export default function StageBriefIntake({
  settings, onSettingsChange, briefText, onBriefTextChange,
  uploadedFiles, onFilesChange, urlInput, onUrlChange,
  activeTab, onTabChange, onAnalyse, isProcessing,
}: Props) {

  const [sourceSearch, setSourceSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["International Bodies", "Statistical Databases", "Consulting & Industry Research"]));

  const toggleCategory = (cat: string) => setExpandedCategories(prev => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFilesChange([...uploadedFiles, ...files]);
  }, [onFilesChange, uploadedFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onFilesChange([...uploadedFiles, ...files]);
  };

  const removeFile = (index: number) => {
    onFilesChange(uploadedFiles.filter((_, i) => i !== index));
  };

  const updateSetting = (key: keyof WriterSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const totalSize = uploadedFiles.reduce((a, f) => a + f.size, 0);

  const hasContent =
    (activeTab === "paste" && briefText.trim()) ||
    (activeTab === "upload" && uploadedFiles.length > 0) ||
    (activeTab === "url" && urlInput.trim()) ||
    (activeTab === "fields" && briefText.trim());

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 1 of 7</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Brief Intake</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Upload or paste your assessment brief. ZOE reads any format.</p>
      </div>

      {/* Assessment type grid */}
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Select Assessment Type</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3.5">
        {assessmentTypes.map(t => (
          <button
            key={t.title}
            onClick={() => updateSetting("type", t.title)}
            className={`border rounded-[10px] p-2.5 sm:p-3.5 text-center transition-all hover:-translate-y-px active:scale-[0.97] ${
              settings.type === t.title
                ? "border-terracotta bg-terracotta/5"
                : "border-border hover:border-terracotta/30 hover:bg-terracotta/[0.03]"
            }`}
          >
            <div className="text-[22px] sm:text-[24px] mb-1">{t.emoji}</div>
            <div className="text-[12px] sm:text-[13px] font-semibold">{t.title}</div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground">{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Topic input */}
      <div className="mb-3.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Topic</p>
        <p className="text-[11px] text-muted-foreground mb-1.5">Optional — specify if your brief requires you to choose a topic</p>
        <input
          value={settings.topic}
          onChange={e => updateSetting("topic", e.target.value)}
          placeholder="e.g. Impact of AI on healthcare delivery in the NHS"
          className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:ring-1 focus:ring-terracotta/30 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Tab system */}
      <div className="border border-border rounded-xl overflow-hidden mb-3.5">
        <div className="flex bg-muted border-b border-border">
          {([
            { id: "paste" as const, icon: "📄", label: "Paste" },
            { id: "upload" as const, icon: "📎", label: "Upload" },
            { id: "url" as const, icon: "🔗", label: "URL" },
            { id: "fields" as const, icon: "✍️", label: "Fields" },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`flex-1 py-2.5 text-[11px] sm:text-[13px] flex items-center justify-center gap-1 border-b-2 transition-all ${
                activeTab === t.id
                  ? "bg-card border-foreground text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-4">
          {activeTab === "paste" && (
            <textarea
              value={briefText}
              onChange={e => onBriefTextChange(e.target.value)}
              placeholder="Paste your full assessment brief — learning outcomes, word count, marking criteria…"
              className="w-full min-h-[160px] bg-transparent border-none resize-y text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          )}
          {activeTab === "upload" && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              className="relative border-2 border-dashed border-border rounded-[10px] p-7 sm:p-10 text-center hover:border-terracotta/30 transition-colors cursor-pointer"
            >
              {uploadedFiles.length > 0 ? (
                <div className="space-y-2">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 bg-muted rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <File size={16} className="text-terracotta shrink-0" />
                        <span className="text-[13px] font-medium truncate">{file.name}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-foreground shrink-0"><X size={14} /></button>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">{uploadedFiles.length} file(s) · {(totalSize / (1024 * 1024)).toFixed(1)} MB total</p>
                  <div className="relative border border-dashed border-border rounded-lg p-3 text-center cursor-pointer hover:border-terracotta/30 transition-colors">
                    <p className="text-[12px] text-muted-foreground">+ Add more files</p>
                    <input type="file" multiple accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.txt,.xlsx,.pptx,.csv" onChange={handleFileInput} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-[28px] mb-1.5">📎</div>
                  <p className="text-[14px] font-medium mb-1">Drop files or tap to browse</p>
                  <p className="text-[12px] text-muted-foreground">PDF, DOCX, PNG, JPG, XLSX, PPTX, CSV, TXT — up to 1GB total</p>
                  <input type="file" multiple accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.txt,.xlsx,.pptx,.csv" onChange={handleFileInput} className="absolute inset-0 opacity-0 cursor-pointer" />
                </>
              )}
            </div>
          )}
          {activeTab === "url" && (
            <div>
              <div className="flex gap-2 mb-1.5">
                <input
                  value={urlInput}
                  onChange={e => onUrlChange(e.target.value)}
                  placeholder="https://blackboard.university.ac.uk/brief"
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-terracotta/30"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Blackboard, Moodle, Canvas, Google Classroom, SharePoint</p>
            </div>
          )}
          {activeTab === "fields" && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Assessment title</label>
                  <input className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-terracotta/30" placeholder="Strategic Analysis of..."
                    value={settings.topic}
                    onChange={e => updateSetting("topic", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Module</label>
                  <input className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-terracotta/30" placeholder="Strategic Management"
                    value={settings.module}
                    onChange={e => updateSetting("module", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Word count</label>
                  <input className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-terracotta/30" placeholder="5000" type="number"
                    value={settings.wordCount}
                    onChange={e => updateSetting("wordCount", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Academic level</label>
                  <select className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-terracotta/30 appearance-none"
                    value={settings.level}
                    onChange={e => updateSetting("level", e.target.value)}
                  >
                    {academicLevels.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Citation style</label>
                  <select className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-terracotta/30 appearance-none"
                    value={settings.citationStyle}
                    onChange={e => updateSetting("citationStyle", e.target.value)}
                  >
                    {citationStyles.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Institution</label>
                  <input className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-terracotta/30" placeholder="University of Manchester"
                    value={settings.institution}
                    onChange={e => updateSetting("institution", e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-2.5">
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">Learning outcomes / brief</label>
                <textarea className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-terracotta/30 resize-y" rows={2} placeholder="LO1: Critically evaluate..."
                  value={briefText}
                  onChange={e => onBriefTextChange(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick settings strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 mb-3.5">
        {[
          { label: "Type", value: settings.type || "Select…" },
          { label: "Words", value: settings.wordCount || "—", mono: true },
          { label: "Citation", value: settings.citationStyle || "Select…" },
          { label: "Level", value: settings.level || "Select…" },
          { label: "AI Model", value: aiModels.find(m => m.id === settings.model)?.name || "Standard" },
        ].map(s => (
          <div key={s.label} className="bg-muted border border-border rounded-lg px-2.5 py-2">
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
            <div className={`text-[12px] sm:text-[13px] font-medium truncate ${s.mono ? "font-mono" : ""}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* New: Additional brief fields from Update Folder */}
      <div className="border border-border rounded-xl overflow-hidden mb-3.5">
        <div className="px-3.5 py-2.5 bg-muted/50 border-b border-border text-[12px] font-semibold text-foreground">
          Detailed Settings
        </div>
        <div className="p-3.5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Module Code</label>
              <input value={settings.moduleCode || ""} onChange={e => updateSetting("moduleCode", e.target.value)}
                placeholder="e.g. BMG814" className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-terracotta/30 placeholder:text-muted-foreground/50" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Deadline</label>
              <input type="date" value={settings.deadline || ""} onChange={e => updateSetting("deadline", e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-terracotta/30" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Learning Outcomes</label>
            <textarea value={settings.learningOutcomes || ""} onChange={e => updateSetting("learningOutcomes", e.target.value)}
              placeholder="LO1: Critically evaluate… LO2: Demonstrate knowledge of…"
              rows={2} className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[13px] resize-y focus:outline-none focus:ring-1 focus:ring-terracotta/30 placeholder:text-muted-foreground/50" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Marking Rubric / A+ Criteria</label>
            <textarea value={settings.rubric || ""} onChange={e => updateSetting("rubric", e.target.value)}
              placeholder="Optional — paste marking criteria or describe what constitutes an A+ grade…"
              rows={2} className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[13px] resize-y focus:outline-none focus:ring-1 focus:ring-terracotta/30 placeholder:text-muted-foreground/50" />
          </div>

          {/* Writing Tone chips */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Writing Tone</label>
            <div className="flex flex-wrap gap-1.5">
              {["Analytical", "Critical", "Evaluative", "Discursive", "Argumentative", "Reflective", "Academic Formal"].map(t => (
                <button key={t} onClick={() => updateSetting("writingTone", t)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${settings.writingTone === t ? "bg-terracotta text-white" : "border border-border text-muted-foreground hover:border-terracotta/40"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Humanisation chips */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Humanisation Level</label>
            <div className="flex flex-wrap gap-1.5">
              {["Standard", "High", "Maximum"].map(h => (
                <button key={h} onClick={() => updateSetting("humanisation", h)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${settings.humanisation === h ? "bg-terracotta text-white" : "border border-border text-muted-foreground hover:border-terracotta/40"}`}>
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Burstiness slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Sentence Burstiness</label>
              <span className="text-[11px] font-bold text-foreground">{["Very Low", "Low", "Medium", "High", "Maximum"][settings.burstiness - 1]}</span>
            </div>
            <input type="range" min={1} max={5} value={settings.burstiness || 4}
              onChange={e => updateSetting("burstiness", parseInt(e.target.value))}
              className="w-full accent-terracotta h-1.5" />
            <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
              <span>1 — Uniform</span><span>5 — Wild</span>
            </div>
          </div>

          {/* Perplexity slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Perplexity Level</label>
              <span className="text-[11px] font-bold text-foreground">{["Very Low", "Low", "Medium", "High", "Maximum"][settings.perplexityLevel - 1]}</span>
            </div>
            <input type="range" min={1} max={5} value={settings.perplexityLevel || 3}
              onChange={e => updateSetting("perplexityLevel", parseInt(e.target.value))}
              className="w-full accent-terracotta h-1.5" />
            <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
              <span>1 — Predictable</span><span>5 — Unexpected</span>
            </div>
          </div>

          {/* Active voice target */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Voice Target</label>
              <span className="text-[11px] font-bold text-foreground font-mono">{settings.activeVoiceTarget || 70}%</span>
            </div>
            <input type="range" min={50} max={100} step={5} value={settings.activeVoiceTarget || 70}
              onChange={e => updateSetting("activeVoiceTarget", parseInt(e.target.value))}
              className="w-full accent-terracotta h-1.5" />
          </div>

          {/* Source type mix */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Source Type Mix</label>
            <div className="space-y-2">
              {[
                { key: "journalPct" as const, label: "Journal Articles", value: settings.journalPct },
                { key: "bookPct" as const, label: "Books", value: settings.bookPct },
                { key: "reportPct" as const, label: "Reports", value: settings.reportPct },
                { key: "confPct" as const, label: "Conference Papers", value: settings.confPct },
              ].map(s => (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground min-w-[110px]">{s.label}</span>
                  <input type="range" min={0} max={100} value={s.value}
                    onChange={e => updateSetting(s.key, parseInt(e.target.value))}
                    className="flex-1 accent-terracotta h-1" />
                  <span className="text-[11px] font-bold text-foreground font-mono w-8 text-right">{s.value}%</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <button onClick={() => updateSetting("autoBalance", !settings.autoBalance)}
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${settings.autoBalance ? "bg-terracotta" : "bg-border"}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.autoBalance ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
              <span className="text-[11px] text-muted-foreground">Auto-balance to 100%</span>
            </div>
          </div>

          {/* Prohibited phrases */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Prohibited Phrases</label>
            <p className="text-[10px] text-muted-foreground mb-1">Custom phrases to block (beyond default AI fingerprints). Comma-separated.</p>
            <input value={settings.prohibitedPhrases || ""} onChange={e => updateSetting("prohibitedPhrases", e.target.value)}
              placeholder="e.g. It is worth noting, Furthermore, Moreover" className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-terracotta/30 placeholder:text-muted-foreground/50" />
          </div>

          {/* Reference verification toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Reference Verification</label>
              <p className="text-[10px] text-muted-foreground">Show [CITATION NEEDED] markers for uncited claims</p>
            </div>
            <button onClick={() => updateSetting("referenceVerification", !settings.referenceVerification)}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${settings.referenceVerification ? "bg-terracotta" : "bg-border"}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.referenceVerification ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Personalise */}
      <PersonalisePanel
        title="Personalise Settings"
        fields={[
          { label: "Citation Style", type: "select", options: citationStyles, value: settings.citationStyle, key: "citationStyle" },
          { label: "Academic Level", type: "select", options: academicLevels, value: settings.level, key: "level" },
          { label: "AI Model", type: "select", options: aiModels.map(m => m.name), value: aiModels.find(m => m.id === settings.model)?.name, key: "model" },
          { label: "Word Count", type: "input", value: settings.wordCount, placeholder: "5000", key: "wordCount" },
          { label: "Language", type: "select", options: ["UK English", "US English"], value: settings.language, key: "language" },
          { label: "Institution", type: "input", value: settings.institution, placeholder: "University of Manchester", key: "institution" },
          { label: "Source From", type: "input", value: settings.sourceDateFrom, placeholder: "2015", key: "sourceDateFrom" },
          { label: "Source To", type: "input", value: settings.sourceDateTo, placeholder: "2025", key: "sourceDateTo" },
          { label: "Seminal Sources", type: "toggle", checked: settings.useSeminalSources, description: "Enabled", key: "useSeminalSources" },
          { label: "Images", type: "toggle", checked: settings.autoImages, description: "Auto-generate", key: "autoImages" },
          { label: "Grammar Pipeline", type: "select", options: ["Full 7-stage", "Basic (3-stage)", "Off"], value: settings.grammarPipeline, key: "grammarPipeline" },
          { label: "Humanisation", type: "select", options: ["Standard", "High", "Maximum"], value: settings.humanisation, key: "humanisation" },
          { label: "Formality", type: "select", options: ["1 — Conversational", "2 — Semi-formal", "3 — Formal", "4 — Academic", "5 — Highly Formal"], value: `${settings.formalityLevel} — ${["Conversational", "Semi-formal", "Formal", "Academic", "Highly Formal"][settings.formalityLevel - 1]}`, key: "formalityLevel" },
          { label: "Hedging", type: "select", options: ["Low", "Medium", "High"], value: settings.hedgingIntensity, key: "hedgingIntensity" },
          { label: "First Person", type: "toggle", checked: settings.firstPerson, description: settings.firstPerson ? "Allowed" : "Off", key: "firstPerson" },
          { label: "Sentence Style", type: "select", options: ["Simple", "Mixed", "Complex"], value: settings.sentenceComplexity, key: "sentenceComplexity" },
          { label: "Transitions", type: "select", options: ["Formal connectors", "Casual bridges", "Implicit"], value: settings.transitionStyle, key: "transitionStyle" },
          { label: "Paragraph Length", type: "select", options: ["Short", "Medium", "Long"], value: settings.paragraphLength, key: "paragraphLength" },
          { label: "Analysis Depth", type: "select", options: ["Overview", "Standard", "Deep Critical"], value: settings.analysisDepth, key: "analysisDepth" },
          { label: "Technical Density", type: "select", options: ["1 — Accessible", "2 — Light", "3 — Moderate", "4 — Technical", "5 — Specialist"], value: `${settings.technicalDensity} — ${["Accessible", "Light", "Moderate", "Technical", "Specialist"][settings.technicalDensity - 1]}`, key: "technicalDensity" },
          { label: "Chart Complexity", type: "select", options: ["1 — Minimal", "2 — Standard", "3 — Full Academic", "4 — Publication-Ready"], value: `${settings.chartComplexity} — ${["Minimal", "Standard", "Full Academic", "Publication-Ready"][settings.chartComplexity - 1]}`, key: "chartComplexity" },
          { label: "Figure Numbering", type: "select", options: ["Sequential", "Chapter-based"], value: settings.figureNumbering, key: "figureNumbering" },
        ]}
        onApply={(values) => {
          const updated = { ...settings };
          Object.entries(values).forEach(([key, val]) => {
            if (key === "model") {
              const found = aiModels.find(m => m.name === val);
              if (found) (updated as any).model = found.id;
            } else if (key === "formalityLevel") {
              const num = parseInt(String(val));
              (updated as any).formalityLevel = isNaN(num) ? 4 : num;
            } else if (key === "technicalDensity") {
              const num = parseInt(String(val));
              (updated as any).technicalDensity = isNaN(num) ? 3 : num;
            } else if (key === "chartComplexity") {
              const num = parseInt(String(val));
              (updated as any).chartComplexity = isNaN(num) ? 3 : num;
            } else {
              (updated as any)[key] = val;
            }
          });
          onSettingsChange(updated);
        }}
      />

      {/* Content & Quality Settings */}
      <div className="border border-border rounded-xl overflow-hidden mb-3.5">
        <div className="px-3.5 py-2.5 bg-muted/50 border-b border-border text-[12px] font-semibold text-foreground">
          Content & Quality Settings
        </div>
        <div className="p-3.5 space-y-4">
          {/* Citations */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Total Citations Override</label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Leave 0 for ZOE to auto-distribute per section</p>
              <input
                type="number"
                min={0}
                value={settings.totalCitations || ""}
                onChange={e => updateSetting("totalCitations", parseInt(e.target.value) || 0)}
                placeholder="e.g. 40"
                className="w-32 bg-muted border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-terracotta/30"
              />
            </div>
          </div>

          {/* Images */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Images</label>
                <p className="text-[10px] text-muted-foreground">Figures embedded in the document</p>
              </div>
              <button
                onClick={() => updateSetting("includeImages", !settings.includeImages)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${settings.includeImages ? "bg-terracotta" : "bg-border"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.includeImages ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            {settings.includeImages && (
              <div className="space-y-2.5 pl-1">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-muted-foreground w-20 flex-shrink-0">Count</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.imageCount || ""}
                    onChange={e => updateSetting("imageCount", parseInt(e.target.value) || 0)}
                    placeholder="0 = auto"
                    className="w-24 bg-muted border border-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-terracotta/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1.5">Types (select all that apply)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {IMAGE_TYPES.map(t => {
                      const selected = settings.imageTypes.includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() => updateSetting("imageTypes", selected ? settings.imageTypes.filter(x => x !== t) : [...settings.imageTypes, t])}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${selected ? "bg-terracotta text-white" : "border border-border text-muted-foreground hover:border-terracotta/40"}`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Tables</label>
                <p className="text-[10px] text-muted-foreground">Formatted data tables in the document</p>
              </div>
              <button
                onClick={() => updateSetting("includeTables", !settings.includeTables)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${settings.includeTables ? "bg-terracotta" : "bg-border"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.includeTables ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            {settings.includeTables && (
              <div className="pl-1 flex items-center gap-2">
                <label className="text-[11px] text-muted-foreground w-20 flex-shrink-0">Count</label>
                <input
                  type="number"
                  min={0}
                  value={settings.tableCount || ""}
                  onChange={e => updateSetting("tableCount", parseInt(e.target.value) || 0)}
                  placeholder="0 = auto"
                  className="w-24 bg-muted border border-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-terracotta/30"
                />
              </div>
            )}
          </div>

          {/* Statistical data */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Statistical / Empirical Sources</label>
            <p className="text-[10px] text-muted-foreground mb-1.5">Number of data-backed sources (e.g. Statista, Gartner)</p>
            <input
              type="number"
              min={0}
              value={settings.statisticalSourceCount || ""}
              onChange={e => updateSetting("statisticalSourceCount", parseInt(e.target.value) || 0)}
              placeholder="0 = auto"
              className="w-32 bg-muted border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-terracotta/30"
            />
          </div>

          {/* Preferred data sources — 100+ with categories */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Preferred Data Sources</label>
              {settings.preferredDataSources.length > 0 && (
                <button
                  onClick={() => updateSetting("preferredDataSources", [])}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear all ({settings.preferredDataSources.length})
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">ZOE will prioritise these for statistics & data. Select from 100+ sources.</p>
            {/* Search */}
            <div className="relative mb-2">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Search sources…"
                value={sourceSearch}
                onChange={e => setSourceSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-terracotta/30"
              />
            </div>
            {/* Categories */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {Object.entries(DATA_SOURCES_BY_CATEGORY).map(([cat, sources]) => {
                const filtered = sourceSearch
                  ? sources.filter(s => s.toLowerCase().includes(sourceSearch.toLowerCase()))
                  : sources;
                if (filtered.length === 0) return null;
                const expanded = expandedCategories.has(cat) || !!sourceSearch;
                const catSelected = filtered.filter(s => settings.preferredDataSources.includes(s)).length;
                return (
                  <div key={cat} className="border border-border/50 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-foreground">{cat}</span>
                        {catSelected > 0 && (
                          <span className="px-1.5 py-0.5 bg-terracotta text-white rounded-full text-[9px] font-bold">{catSelected}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            const allSelected = filtered.every(s => settings.preferredDataSources.includes(s));
                            const updated = allSelected
                              ? settings.preferredDataSources.filter(s => !filtered.includes(s))
                              : [...new Set([...settings.preferredDataSources, ...filtered])];
                            updateSetting("preferredDataSources", updated);
                          }}
                          className="text-[9px] font-semibold text-terracotta hover:text-terracotta/80 transition-colors"
                        >
                          {filtered.every(s => settings.preferredDataSources.includes(s)) ? "Deselect all" : "Select all"}
                        </button>
                        {expanded ? <ChevronUp size={11} className="text-muted-foreground" /> : <ChevronDown size={11} className="text-muted-foreground" />}
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-3 py-2 flex flex-wrap gap-1.5">
                        {filtered.map(src => {
                          const selected = settings.preferredDataSources.includes(src);
                          return (
                            <button
                              key={src}
                              onClick={() => updateSetting("preferredDataSources", selected
                                ? settings.preferredDataSources.filter(x => x !== src)
                                : [...settings.preferredDataSources, src])}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${selected ? "bg-terracotta text-white" : "border border-border text-muted-foreground hover:border-terracotta/40"}`}
                            >
                              {src}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <StickyFooter
        rightLabel="Analyse Brief →"
        onRight={onAnalyse}
        rightLoading={isProcessing}
        rightDisabled={!hasContent}
      />
    </div>
  );
}
