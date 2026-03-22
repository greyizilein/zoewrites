import { useState } from "react";
import { Loader2, Check, Zap, Play, Square, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Section, WriterSettings } from "./types";

export type AutoPhase = "writing" | "quality" | "editing" | null;

interface Props {
  sections: Section[];
  onGenerate: (sectionId: string) => void;
  onWriteAll: () => void;
  onAutopilot: () => void;
  autopilotRunning: boolean;
  autoPhase: AutoPhase;
  generating: boolean;
  generatingId: string | null;
  streamContent: string;
  writingAll: boolean;
  onBack: () => void;
  onNext: () => void;
  settings: WriterSettings;
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export default function StageWrite({
  sections, onGenerate, onWriteAll, onAutopilot,
  autopilotRunning, autoPhase, generating, generatingId,
  streamContent, writingAll, onBack, onNext, settings,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalWords = sections.reduce((a, s) => a + s.word_current, 0);
  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0);
  const completedCount = sections.filter(s => s.status === "complete").length;
  const allComplete = completedCount === sections.length && sections.length > 0;
  const progress = totalTarget > 0 ? Math.round((totalWords / totalTarget) * 100) : 0;

  const phaseLabels: Record<NonNullable<AutoPhase>, string> = {
    writing: "Writing sections…",
    quality: "Running quality check…",
    editing: "Proofreading…",
  };

  const phases: AutoPhase[] = ["writing", "quality", "editing"];

  return (
    <div className="max-w-[640px] mx-auto">
      {/* Header */}
      <div className="mb-5">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 2 of 4</p>
        <h1 className="text-[22px] font-bold tracking-tight mb-0.5">Write</h1>
        <p className="text-[13px] text-muted-foreground">Generate your sections manually or let Auto handle everything.</p>
      </div>

      {/* Progress bar */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-semibold text-foreground">
            {completedCount}/{sections.length} sections complete
          </p>
          <span className="text-[12px] font-bold text-terracotta tabular-nums">{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-terracotta rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 tabular-nums">
          {fmt(totalWords)} / {fmt(totalTarget)} words
        </p>
      </div>

      {/* Autopilot running overlay */}
      {autopilotRunning && (
        <div className="bg-card border border-border/50 rounded-2xl p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={15} className="text-terracotta animate-pulse" />
            <p className="text-[13px] font-bold text-foreground">Auto Mode Running</p>
          </div>
          <div className="space-y-2.5">
            {phases.map((phase) => {
              const phaseIndex = phases.indexOf(phase);
              const currentIndex = autoPhase ? phases.indexOf(autoPhase) : -1;
              const isDone = currentIndex > phaseIndex;
              const isCurrent = phase === autoPhase;
              return (
                <div key={phase} className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isDone ? "bg-sage" : isCurrent ? "bg-terracotta animate-pulse" : "bg-muted"
                  }`}>
                    {isDone
                      ? <Check size={10} className="text-white" />
                      : isCurrent
                        ? <Loader2 size={10} className="text-white animate-spin" />
                        : <span className="w-1.5 h-1.5 rounded-full bg-border" />
                    }
                  </div>
                  <span className={`text-[12px] font-medium ${
                    isDone ? "text-sage" : isCurrent ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {phaseLabels[phase!]}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-2.5 mt-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                autoPhase === null && completedCount === sections.length ? "bg-sage" : "bg-muted"
              }`}>
                {autoPhase === null && completedCount === sections.length
                  ? <Check size={10} className="text-white" />
                  : <span className="w-1.5 h-1.5 rounded-full bg-border" />
                }
              </div>
              <span className="text-[12px] font-medium text-muted-foreground">Advancing to Review</span>
            </div>
          </div>
          <button
            onClick={onAutopilot}
            className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors active:scale-[0.97]"
          >
            <Square size={12} /> Stop
          </button>
        </div>
      )}

      {/* Action buttons */}
      {!autopilotRunning && (
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            onClick={onAutopilot}
            disabled={allComplete}
            className="flex items-center justify-center gap-1.5 py-3 bg-terracotta text-white rounded-xl text-[13px] font-bold hover:bg-terracotta/90 transition-all active:scale-[0.97] disabled:opacity-40 shadow-sm"
          >
            <Zap size={14} /> Auto
          </button>
          <button
            onClick={onWriteAll}
            disabled={writingAll || generating || allComplete}
            className="flex items-center justify-center gap-1.5 py-3 border border-border rounded-xl text-[13px] font-semibold text-foreground hover:bg-muted/50 transition-all active:scale-[0.97] disabled:opacity-40"
          >
            {writingAll ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Write All
          </button>
        </div>
      )}

      {/* Section list */}
      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden mb-4">
        {sections.map((s, idx) => {
          const isGenerating = generatingId === s.id;
          const isDone = s.status === "complete";
          const isExpanded = expandedId === s.id;
          const pct = s.word_target > 0 ? Math.round((s.word_current / s.word_target) * 100) : 0;

          return (
            <div key={s.id} className={`${idx > 0 ? "border-t border-border/50" : ""}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isDone ? "bg-sage" :
                  isGenerating ? "bg-terracotta animate-pulse shadow-[0_0_5px_hsl(18,50%,53%,0.4)]" :
                  "bg-border"
                }`} />

                {/* Title + word count */}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-foreground truncate">{s.title}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {fmt(s.word_current)} / {fmt(s.word_target)}w
                    {isDone && <span className="text-sage ml-1">· {pct}%</span>}
                  </p>
                </div>

                {/* Progress mini-bar */}
                <div className="w-14 h-1 bg-muted rounded-full overflow-hidden flex-shrink-0">
                  <div className={`h-full rounded-full transition-all ${isDone ? "bg-sage" : "bg-terracotta"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>

                {/* Write / generating button */}
                {!isDone && !isGenerating && !autopilotRunning && (
                  <button
                    onClick={() => onGenerate(s.id)}
                    disabled={generating}
                    className="flex-shrink-0 px-3 py-1.5 bg-foreground text-background rounded-lg text-[11px] font-bold hover:bg-foreground/85 transition-all active:scale-[0.97] disabled:opacity-40"
                  >
                    Write
                  </button>
                )}
                {isGenerating && (
                  <div className="flex-shrink-0 flex items-center gap-1 text-terracotta">
                    <Loader2 size={13} className="animate-spin" />
                    <span className="text-[11px] font-semibold">Writing</span>
                  </div>
                )}
                {isDone && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground"
                  >
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                )}
              </div>

              {/* Stream preview */}
              {isGenerating && streamContent && (
                <div className="px-4 pb-3">
                  <div className="bg-muted/40 rounded-xl p-3 max-h-28 overflow-hidden relative">
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-4">{streamContent}</p>
                    <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-muted/40 to-transparent rounded-b-xl" />
                  </div>
                </div>
              )}

              {/* Expanded content preview */}
              {isExpanded && s.content && (
                <div className="px-4 pb-3">
                  <div className="bg-muted/40 rounded-xl p-3 max-h-40 overflow-y-auto">
                    <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{s.content.slice(0, 600)}{s.content.length > 600 ? "…" : ""}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer nav */}
      <div className="flex gap-2.5">
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-border rounded-xl text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all active:scale-[0.97]"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!sections.some(s => s.content)}
          className="flex-1 py-3 bg-foreground text-background rounded-xl text-[13px] font-bold hover:bg-foreground/85 transition-all active:scale-[0.97] disabled:opacity-40"
        >
          Review →
        </button>
      </div>
    </div>
  );
}
