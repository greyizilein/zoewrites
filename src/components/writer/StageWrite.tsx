import { useEffect, useRef } from "react";
import { Loader2, FileText, Zap } from "lucide-react";
import { Section, WriterSettings } from "./types";

export type AutoPhase = "writing" | "quality" | "editing" | null;

interface Props {
  sections: Section[];
  generating: boolean;
  streamContent: string;
  fullDocContent: string;
  onWrite: () => void;
  onBack: () => void;
  onNext: () => void;
  settings: WriterSettings;
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export default function StageWrite({
  sections, generating, streamContent, fullDocContent,
  onWrite, onBack, onNext, settings,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0);

  // Approximate word count from live stream or stored full doc
  const liveText = generating ? streamContent : fullDocContent;
  const liveWords = liveText ? liveText.split(/\s+/).filter(Boolean).length : 0;
  const progress = totalTarget > 0 ? Math.min(100, Math.round((liveWords / totalTarget) * 100)) : 0;

  const isComplete = !generating && fullDocContent && fullDocContent.trim().length > 100;

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (generating && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamContent, generating]);

  return (
    <div className="max-w-[640px] mx-auto flex flex-col gap-4">
      {/* Header */}
      <div>
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 2 of 4</p>
        <h1 className="text-[22px] font-bold tracking-tight mb-0.5">Write</h1>
        <p className="text-[13px] text-muted-foreground">
          {generating ? "ZOE is writing your document live…" : isComplete ? "Document written — review or proceed to quality check." : "ZOE will write your complete document in one pass."}
        </p>
      </div>

      {/* Stats + write button */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[12px] font-semibold text-foreground">
              {generating ? "Writing…" : isComplete ? "Complete" : `${sections.length} section${sections.length !== 1 ? "s" : ""} planned`}
            </p>
            <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
              {fmt(liveWords)} / {fmt(totalTarget)} words {generating && <span className="text-terracotta animate-pulse">●</span>}
            </p>
          </div>
          {!generating && (
            <button
              onClick={onWrite}
              disabled={sections.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-terracotta text-white rounded-xl text-[13px] font-bold hover:bg-terracotta/90 transition-all active:scale-[0.97] disabled:opacity-40 shadow-sm"
            >
              <Zap size={14} />
              {isComplete ? "Rewrite" : "Write Document"}
            </button>
          )}
          {generating && (
            <div className="flex items-center gap-1.5 text-terracotta">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-[13px] font-semibold">{progress}%</span>
            </div>
          )}
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-terracotta rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Live document area */}
      {(generating || isComplete) && (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
            <FileText size={13} className="text-muted-foreground" />
            <p className="text-[12px] font-bold text-foreground">
              {generating ? "Live output" : "Document"}
            </p>
            {generating && (
              <span className="ml-auto text-[10px] font-semibold text-terracotta flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" />
                Streaming
              </span>
            )}
          </div>
          <div
            ref={scrollRef}
            className="px-5 py-4 max-h-[500px] overflow-y-auto"
          >
            <pre className="text-[12px] text-foreground/85 leading-relaxed whitespace-pre-wrap font-sans">
              {liveText || ""}
              {generating && <span className="inline-block w-0.5 h-3.5 bg-terracotta animate-pulse ml-0.5 align-middle" />}
            </pre>
          </div>
        </div>
      )}

      {/* Placeholder when not yet started */}
      {!generating && !isComplete && sections.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm text-center">
          <FileText size={28} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-foreground mb-1">Ready to write</p>
          <p className="text-[11px] text-muted-foreground mb-4">
            ZOE will write the full {fmt(totalTarget)}-word document in one continuous pass — maintaining coherence, citations, and framework requirements throughout.
          </p>
          <div className="space-y-1 text-left max-w-xs mx-auto">
            {sections.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold flex-shrink-0">{i + 1}</span>
                <span className="truncate">{s.title}</span>
                <span className="ml-auto tabular-nums flex-shrink-0">{fmt(s.word_target)}w</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
          disabled={!isComplete || generating}
          className="flex-1 py-3 bg-foreground text-background rounded-xl text-[13px] font-bold hover:bg-foreground/85 transition-all active:scale-[0.97] disabled:opacity-40"
        >
          Review →
        </button>
      </div>
    </div>
  );
}
