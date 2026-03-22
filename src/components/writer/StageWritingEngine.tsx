import { useState } from "react";
import { Loader2, Check, RefreshCw, Edit3, Wand2, Sparkles, ChevronDown, Send, Zap } from "lucide-react";
import PersonalisePanel from "./PersonalisePanel";
import StickyFooter from "./StickyFooter";
import { Section, Recommendation, WriterSettings, aiModels } from "./types";

interface Props {
  sections: Section[];
  onSectionUpdate: (id: string, updates: Partial<Section>) => void;
  onGenerate: (sectionId: string) => void;
  onRevise: (sectionId: string, feedback: string) => void;
  onHumanise: (sectionId: string) => void;
  onHumaniseAll: () => void;
  onApplyAllRecs?: () => void;
  onWriteAll: () => void;
  onAutopilot?: () => void;
  autopilotRunning?: boolean;
  generating: boolean;
  generatingId: string | null;
  streamContent: string;
  writingAll: boolean;
  recommendations: Recommendation[];
  loadingRecs: boolean;
  onApplyRec: (rec: Recommendation) => void;
  onDismissRec: (idx: number) => void;
  onBack: () => void;
  onNext: () => void;
  settings: WriterSettings;
  onSettingsChange: (s: WriterSettings) => void;
}

export default function StageWritingEngine({
  sections, onGenerate, onRevise, onHumanise, onHumaniseAll, onWriteAll,
  onAutopilot, autopilotRunning,
  generating, generatingId, streamContent, writingAll,
  recommendations, loadingRecs, onApplyRec, onDismissRec, onApplyAllRecs,
  onBack, onNext, settings, onSettingsChange,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revisionInput, setRevisionInput] = useState("");
  const [showRevision, setShowRevision] = useState<string | null>(null);

  const totalWords = sections.reduce((a, s) => a + s.word_current, 0);
  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0);
  const completedCount = sections.filter(s => s.status === "complete").length;
  const progress = totalTarget > 0 ? Math.round((totalWords / totalTarget) * 100) : 0;

  const statusDot = (status: string) => {
    if (status === "complete") return "bg-sage";
    if (status === "writing") return "bg-terracotta animate-pulse shadow-[0_0_5px_hsl(18,50%,53%,0.4)]";
    return "bg-border";
  };

  const statusTag = (s: Section) => {
    if (s.status === "complete") return <span className="px-2 py-0.5 rounded bg-sage/15 text-sage text-[11px] font-medium">✓ Complete</span>;
    if (s.status === "writing") return <span className="px-2 py-0.5 rounded bg-terracotta/15 text-terracotta text-[11px] font-medium animate-pulse">⌨ Writing…</span>;
    return <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-[11px]">Pending</span>;
  };

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 3 of 6</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Writing Engine</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Accept, revise, or regenerate each section.</p>
      </div>

      {/* Autopilot banner */}
      {onAutopilot && (
        <button
          onClick={onAutopilot}
          disabled={autopilotRunning || writingAll || generating}
          className={`w-full mb-4 py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] ${
            autopilotRunning
              ? "bg-terracotta text-white animate-pulse"
              : "bg-gradient-to-r from-terracotta to-dusty-purple text-white hover:opacity-90"
          } disabled:opacity-60`}
        >
          <Zap size={16} />
          {autopilotRunning ? "Autopilot running… ZOE is handling everything" : "⚡ Autopilot — ZOE writes, critiques, revises & exports"}
        </button>
      )}

      {/* Progress bar */}
      <div className="bg-muted border border-border rounded-[10px] px-3.5 py-3 mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[13px] font-semibold">Progress</span>
          <span className="font-mono text-[12px] font-semibold text-terracotta">{totalWords.toLocaleString()} / {totalTarget.toLocaleString()}</span>
        </div>
        <div className="h-1 bg-border rounded-full overflow-hidden mb-1">
          <div className="h-full bg-terracotta rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div className="flex justify-between items-center text-[11px] text-muted-foreground flex-wrap gap-1">
          <span>{completedCount} / {sections.length} sections complete</span>
          <div className="flex gap-2">
            {completedCount > 0 && (
              <button onClick={onHumaniseAll} disabled={generating} className="text-dusty-purple font-medium hover:underline disabled:opacity-50">
                Humanise All
              </button>
            )}
            <button onClick={onWriteAll} disabled={writingAll || generating} className="text-terracotta font-medium hover:underline disabled:opacity-50">
              {writingAll ? "Writing all…" : "Write All →"}
            </button>
          </div>
        </div>
      </div>

      <PersonalisePanel
        title="Personalise Writing"
        fields={[
          { label: "Writing Tone", type: "select", options: ["Academic Formal", "Academic Conversational", "Reflective", "Technical"], value: settings.writingTone, key: "writingTone" },
          { label: "Voice Perspective", type: "select", options: ["Third Person (academic)", "First Person (reflective)", "Mixed"], value: settings.firstPerson ? "First Person (reflective)" : "Third Person (academic)", key: "voicePerspective" },
          { label: "Analysis Depth", type: "select", options: ["Overview", "Standard", "Deep Critical"], value: settings.analysisDepth, key: "analysisDepth" },
          { label: "Humanise", type: "select", options: ["Standard", "High", "Maximum"], value: settings.humanisation, key: "humanisation" },
          { label: "Banned Phrases", type: "select", options: ["Full blacklist (34+)", "Custom list"], value: "Full blacklist (34+)" },
          { label: "Grammar Pipeline", type: "select", options: ["Full 7-stage", "Basic (3-stage)", "Off"], value: settings.grammarPipeline, key: "grammarPipeline" },
          { label: "AI Model", type: "select", options: aiModels.map(m => m.name), value: aiModels.find(m => m.id === settings.model)?.name, key: "model" },
          { label: "Visuals", type: "toggle", checked: settings.autoImages, description: "Auto", key: "autoImages" },
          // Dynamic settings that appear for strategic/analytical work
          ...(settings.type === "Strategic Analysis" || settings.type === "Report" ? [
            { label: "Framework Depth", type: "select" as const, options: ["Standard", "Deep (with cross-analysis)", "Comprehensive (multi-framework)"], value: "Deep (with cross-analysis)", key: "frameworkDepth" },
          ] : []),
        ]}
        onApply={(values) => {
          const updated = { ...settings };
          Object.entries(values).forEach(([key, val]) => {
            if (key === "model") {
              const found = aiModels.find(m => m.name === val);
              if (found) (updated as any).model = found.id;
            } else if (key === "voicePerspective") {
              updated.firstPerson = val === "First Person (reflective)";
            } else {
              (updated as any)[key] = val;
            }
          });
          onSettingsChange(updated);
        }}
      />

      {/* Section cards */}
      <div className="space-y-3">
        {sections.map((s) => {
          const isExpanded = expandedId === s.id;
          const isGenerating = generating && generatingId === s.id;

          return (
            <div key={s.id} className={`border rounded-xl overflow-hidden bg-card transition-colors ${
              s.status === "writing" ? "border-terracotta" :
              s.status === "complete" ? "border-sage/50" : "border-border"
            }`}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
                className="w-full px-3.5 py-3 bg-muted/50 flex items-center gap-2 hover:bg-muted/80 transition-colors"
              >
                <span className={`w-[9px] h-[9px] rounded-full flex-shrink-0 ${statusDot(s.status)}`} />
                <span className={`flex-1 min-w-0 text-[13px] sm:text-[14px] font-medium text-left truncate ${
                  s.status === "pending" ? "text-muted-foreground" : "text-foreground"
                }`}>{s.title}</span>
                <div className="flex gap-1 flex-wrap flex-shrink-0">
                  {statusTag(s)}
                  <span className="px-2 py-0.5 rounded bg-terracotta/10 text-terracotta text-[11px] font-mono">{s.word_current}/{s.word_target}</span>
                  {s.framework && <span className="px-2 py-0.5 rounded bg-sage/15 text-sage text-[11px] hidden sm:inline">{s.framework}</span>}
                </div>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              {isExpanded && (
                <div className="px-3.5 py-3 border-t border-border animate-in fade-in slide-in-from-top-2 duration-200">
                  {isGenerating ? (
                    <div className="bg-muted border border-border rounded-[10px] p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 size={14} className="text-terracotta animate-spin" />
                        <span className="text-[13px] font-medium">Writing {s.title}…</span>
                        <span className="font-mono text-[11px] text-muted-foreground ml-auto">{streamContent.split(/\s+/).filter(Boolean).length}/{s.word_target}</span>
                      </div>
                      <div className="h-[3px] bg-border rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-terracotta rounded-full animate-pulse" style={{ width: `${Math.min((streamContent.split(/\s+/).filter(Boolean).length / s.word_target) * 100, 100)}%` }} />
                      </div>
                      {streamContent ? (
                        <div className="text-[14px] sm:text-[15px] leading-[1.8] text-foreground/85 whitespace-pre-wrap max-h-[400px] overflow-y-auto">{streamContent}</div>
                      ) : (
                        <div className="flex gap-1 items-center py-2">
                          {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />)}
                        </div>
                      )}
                    </div>
                  ) : s.content ? (
                    <>
                      <div className="text-[14px] sm:text-[15px] leading-[1.8] text-foreground/85 whitespace-pre-wrap mb-3">
                        {s.content.slice(0, 800)}{s.content.length > 800 ? "…" : ""}
                      </div>
                      <div className="flex gap-1.5 flex-wrap pt-3 border-t border-border">
                        <button className="px-3 py-1.5 rounded-lg bg-sage text-white text-[12px] font-medium hover:bg-sage/80 transition-colors active:scale-[0.97]">
                          <Check size={12} className="inline mr-1" />Accepted
                        </button>
                        <button onClick={() => setShowRevision(showRevision === s.id ? null : s.id)} className="px-3 py-1.5 rounded-lg border border-border text-[12px] hover:bg-muted transition-colors active:scale-[0.97]">
                          <Edit3 size={12} className="inline mr-1" />Revise
                        </button>
                        <button onClick={() => onGenerate(s.id)} className="px-3 py-1.5 rounded-lg text-[12px] text-muted-foreground hover:bg-muted transition-colors active:scale-[0.97]">
                          <RefreshCw size={12} className="inline mr-1" />Regenerate
                        </button>
                        <button onClick={() => onHumanise(s.id)} className="px-3 py-1.5 rounded-lg border border-dusty-purple/30 text-[12px] text-dusty-purple hover:bg-dusty-purple/10 transition-colors active:scale-[0.97]">
                          <Wand2 size={12} className="inline mr-1" />Humanise
                        </button>
                      </div>
                      {showRevision === s.id && (
                        <div className="flex gap-2 mt-3">
                          <textarea
                            value={revisionInput}
                            onChange={e => setRevisionInput(e.target.value)}
                            placeholder="Describe what to change…"
                            className="flex-1 min-h-[80px] bg-muted border border-border rounded-lg px-3 py-2 text-[13px] resize-y focus:outline-none focus:ring-1 focus:ring-terracotta/30"
                          />
                          <button
                            onClick={() => { onRevise(s.id, revisionInput); setRevisionInput(""); setShowRevision(null); }}
                            disabled={!revisionInput.trim()}
                            className="self-end px-3 py-2 bg-terracotta text-white rounded-lg hover:bg-terracotta/90 transition-colors disabled:opacity-50 active:scale-[0.97]"
                          >
                            <Send size={13} />
                          </button>
                        </div>
                      )}
                      {recommendations.length > 0 && expandedId === s.id && (
                        <div className="mt-4 p-3 rounded-xl border border-terracotta/15 bg-terracotta/[0.03]">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={14} className="text-terracotta" />
                            <span className="text-[12px] font-semibold">ZOE recommends</span>
                            {recommendations.length > 1 && onApplyAllRecs && (
                              <button
                                onClick={onApplyAllRecs}
                                className="ml-auto text-[10px] px-2.5 py-1 rounded bg-terracotta text-white font-medium hover:bg-terracotta/90 transition-colors active:scale-[0.97]"
                              >
                                Accept All ({recommendations.length})
                              </button>
                            )}
                          </div>
                          <div className="space-y-2">
                            {recommendations.map((rec, i) => (
                              <div key={i} className="p-2.5 rounded-lg bg-card border border-border">
                                <div className="flex items-start gap-2">
                                  <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                    rec.severity === "high" ? "bg-terracotta/15 text-terracotta" :
                                    rec.severity === "medium" ? "bg-warm-gold/15 text-warm-gold" : "bg-sage/15 text-sage"
                                  }`}>{rec.type}</span>
                                  <p className="text-[12px] text-muted-foreground flex-1">{rec.description}</p>
                                </div>
                                <div className="mt-2 flex gap-1.5">
                                  <button onClick={() => onApplyRec(rec)} className="text-[10px] px-2 py-0.5 rounded bg-terracotta/10 text-terracotta font-medium hover:bg-terracotta/20 transition-colors active:scale-[0.97]">Apply</button>
                                  <button onClick={() => onDismissRec(i)} className="text-[10px] px-2 py-0.5 rounded text-muted-foreground hover:text-foreground transition-colors active:scale-[0.97]">Skip</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {recommendations.length === 0 && s.content && expandedId === s.id && !loadingRecs && (
                        <div className="mt-3 text-center">
                          <button
                            onClick={() => onApplyRec({ type: "fetch", severity: "low", description: "", action: `__fetch__${s.id}` })}
                            className="text-[11px] text-terracotta hover:underline font-medium active:scale-[0.97]"
                          >
                            <Sparkles size={11} className="inline mr-1" />Get ZOE recommendations
                          </button>
                        </div>
                      )}
                      {loadingRecs && expandedId === s.id && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                          <Loader2 size={12} className="animate-spin" /> Analysing section…
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <p className="text-[12px] text-muted-foreground mb-2">
                        {s.framework ? `Framework: ${s.framework}. ` : ""}
                        Target: {s.word_target} words, {s.citation_count || 0} citations.
                      </p>
                      <div className="flex gap-1.5">
                        <button onClick={() => onGenerate(s.id)} disabled={generating} className="px-3 py-1.5 rounded-lg bg-foreground text-background text-[12px] font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 active:scale-[0.97]">
                          Generate
                        </button>
                        <button className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted-foreground hover:bg-muted transition-colors">Add notes</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <StickyFooter
        leftLabel="← Plan"
        onLeft={onBack}
        rightLabel="Run Self-Critique →"
        onRight={onNext}
      />
    </div>
  );
}
