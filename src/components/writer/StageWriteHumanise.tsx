import { useState } from "react";
import { Loader2, Check, Zap, ChevronDown, Sparkles, ImagePlus } from "lucide-react";
import PersonalisePanel from "./PersonalisePanel";
import StickyFooter from "./StickyFooter";
import { Section, WriterSettings, aiModels } from "./types";

interface Props {
  sections: Section[];
  onGenerate: (sectionId: string) => void;
  onWriteAll: () => void;
  onAutopilot?: () => void;
  onGenerateImages?: () => void;
  autopilotRunning?: boolean;
  generating: boolean;
  generatingId: string | null;
  streamContent: string;
  writingAll: boolean;
  onBack: () => void;
  onNext: () => void;
  settings: WriterSettings;
  onSettingsChange: (s: WriterSettings) => void;
}

export default function StageWriteHumanise({
  sections, onGenerate, onWriteAll, onAutopilot, onGenerateImages,
  autopilotRunning, generating, generatingId, streamContent, writingAll,
  onBack, onNext, settings, onSettingsChange,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalWords = sections.reduce((a, s) => a + s.word_current, 0);
  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0);
  const completedCount = sections.filter(s => s.status === "complete").length;
  const progress = totalTarget > 0 ? Math.round((totalWords / totalTarget) * 100) : 0;

  const statusDot = (status: string) => {
    if (status === "complete") return "bg-sage";
    if (status === "writing") return "bg-terracotta animate-pulse shadow-[0_0_5px_hsl(18,50%,53%,0.4)]";
    return "bg-border";
  };

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 3 of 10</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Write & Humanise</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">ZOE writes each section and auto-humanises the output.</p>
      </div>

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
          {autopilotRunning ? "Autopilot running…" : "⚡ Autopilot — full pipeline"}
        </button>
      )}

      {/* Progress */}
      <div className="bg-muted border border-border rounded-[10px] px-3.5 py-3 mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[13px] font-semibold">Progress</span>
          <span className="font-mono text-[12px] font-semibold text-terracotta">{totalWords.toLocaleString()} / {totalTarget.toLocaleString()}</span>
        </div>
        <div className="h-1 bg-border rounded-full overflow-hidden mb-1">
          <div className="h-full bg-terracotta rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div className="flex justify-between items-center text-[11px] text-muted-foreground flex-wrap gap-1">
          <span>{completedCount} / {sections.length} sections</span>
          <div className="flex gap-2">
            {onGenerateImages && completedCount > 0 && (
              <button onClick={onGenerateImages} className="text-dusty-purple font-medium hover:underline disabled:opacity-50 flex items-center gap-1">
                <ImagePlus size={11} /> Images
              </button>
            )}
            <button onClick={onWriteAll} disabled={writingAll || generating} className="text-terracotta font-medium hover:underline disabled:opacity-50">
              {writingAll ? "Writing…" : "Write All →"}
            </button>
          </div>
        </div>
      </div>

      <PersonalisePanel
        title="Personalise Writing"
        fields={[
          { label: "Writing Tone", type: "select", options: ["Academic Formal", "Academic Conversational", "Reflective", "Technical"], value: settings.writingTone, key: "writingTone" },
          { label: "Analysis Depth", type: "select", options: ["Overview", "Standard", "Deep Critical"], value: settings.analysisDepth, key: "analysisDepth" },
          { label: "Humanise", type: "select", options: ["Standard", "High", "Maximum"], value: settings.humanisation, key: "humanisation" },
          { label: "AI Model", type: "select", options: aiModels.map(m => m.name), value: aiModels.find(m => m.id === settings.model)?.name, key: "model" },
        ]}
        onApply={(values) => {
          const updated = { ...settings };
          Object.entries(values).forEach(([key, val]) => {
            if (key === "model") {
              const found = aiModels.find(m => m.name === val);
              if (found) (updated as any).model = found.id;
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
                <span className="flex-1 min-w-0 text-[13px] sm:text-[14px] font-medium text-left truncate">{s.title}</span>
                <span className="px-2 py-0.5 rounded bg-terracotta/10 text-terracotta text-[11px] font-mono flex-shrink-0">{s.word_current}/{s.word_target}</span>
                {s.status === "complete" && <Check size={13} className="text-sage flex-shrink-0" />}
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
                        <div className="text-[14px] leading-[1.8] text-foreground/85 whitespace-pre-wrap max-h-[400px] overflow-y-auto">{streamContent}</div>
                      ) : (
                        <div className="flex gap-1 items-center py-2">
                          {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />)}
                        </div>
                      )}
                    </div>
                  ) : s.content ? (
                    <div className="text-[14px] leading-[1.8] text-foreground/85 whitespace-pre-wrap">
                      {s.content.slice(0, 800)}{s.content.length > 800 ? "…" : ""}
                    </div>
                  ) : (
                    <div>
                      <p className="text-[12px] text-muted-foreground mb-2">
                        {s.framework ? `Framework: ${s.framework}. ` : ""}Target: {s.word_target} words.
                      </p>
                      <button onClick={() => onGenerate(s.id)} disabled={generating} className="px-3 py-1.5 rounded-lg bg-foreground text-background text-[12px] font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 active:scale-[0.97]">
                        Generate
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <StickyFooter leftLabel="← Plan" onLeft={onBack} rightLabel="Self-Critique →" onRight={onNext} />
    </div>
  );
}
