import { useEffect, useRef } from "react";
import { Loader2, FileText, Zap, AlertCircle, X, RotateCcw } from "lucide-react";
import { Section, WriterSettings } from "./types";

export type AutoPhase = "writing" | "quality" | "editing" | null;

interface Props {
  sections: Section[];
  generating: boolean;
  streamContent: string;
  fullDocContent: string;
  onWrite: () => void;
  onRewrite?: () => void;
  onBack: () => void;
  onNext: () => void;
  settings: WriterSettings;
  writeError?: string | null;
  onClearError?: () => void;
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export default function StageWrite({
  sections, generating, streamContent, fullDocContent,
  onWrite, onRewrite, onBack, onNext, settings, writeError, onClearError,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0) || parseInt(settings.wordCount) || 0;
  const completedSections = sections.filter(s => s.content && s.content.trim().length > 50);
  const isComplete = !generating && (completedSections.length === sections.length && sections.length > 0) || (!generating && fullDocContent.length > 200);

  // Word count from live stream or stored full doc
  const liveText = generating ? streamContent : fullDocContent;
  const liveWords = liveText ? countWords(liveText) : 0;
  const progress = totalTarget > 0 ? Math.min(100, Math.round((liveWords / totalTarget) * 100)) : 0;
  const pct = totalTarget > 0 ? liveWords / totalTarget : 0;
  const wcClass = pct > 1.01 ? "text-destructive" : pct > 0.95 ? "text-sage" : "text-amber-500";

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (generating && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamContent, generating]);

  return (
    <div className="max-w-[820px] mx-auto flex flex-col gap-4">
      {/* Header */}
      <div>
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 3 of 7</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-0.5">Write</h1>
        <p className="text-[13px] text-muted-foreground">
          {generating
            ? "ZOE is writing the complete document in one continuous flow…"
            : isComplete
              ? "Document written — proceed to edit, proofread, and humanise."
              : "ZOE will write the entire document followed by the complete reference list."
          }
        </p>
      </div>

      {/* Stats + write button */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[12px] font-semibold text-foreground">
              {generating ? "Writing complete document…" : isComplete ? "Complete" : "Ready to generate"}
            </p>
            <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
              <span className={`font-bold ${wcClass}`}>{fmt(liveWords)}</span> / {fmt(totalTarget)} words
              {generating && <span className="text-terracotta animate-pulse ml-1">●</span>}
            </p>
          </div>
          {!generating && (
            <div className="flex items-center gap-2">
              {isComplete && onRewrite && (
                <button
                  onClick={() => { onClearError?.(); onRewrite(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-xl text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all active:scale-[0.97]"
                >
                  <RotateCcw size={12} /> Regenerate
                </button>
              )}
              {!isComplete && (
                <button
                  onClick={() => { onClearError?.(); onWrite(); }}
                  disabled={!settings.masterPrompt}
                  className="flex items-center gap-1.5 px-4 py-2 bg-terracotta text-white rounded-xl text-[13px] font-bold hover:bg-terracotta/90 transition-all active:scale-[0.97] disabled:opacity-40 shadow-sm"
                >
                  <Zap size={14} />
                  Generate Complete Work
                </button>
              )}
            </div>
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
            className={`h-full rounded-full transition-all duration-300 ${isComplete && !generating ? "bg-sage" : "bg-terracotta"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {!settings.masterPrompt && !generating && !isComplete && (
          <p className="text-[10px] text-amber-500 mt-2 font-medium">
            ⚠ No execution prompt found. Go back to the Prompt Builder and build your prompt first.
          </p>
        )}
      </div>

      {/* Live document area */}
      {(generating || isComplete) && (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
            <FileText size={13} className="text-muted-foreground" />
            <p className="text-[12px] font-bold text-foreground flex-1">
              {generating ? "Live output" : "Document"}
            </p>
            {generating && (
              <span className="text-[10px] font-semibold text-terracotta flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" />
                Streaming
              </span>
            )}
            {isComplete && (
              <span className="px-2 py-0.5 bg-sage/10 text-sage text-[10px] font-bold rounded-full">Complete</span>
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
      {!generating && !isComplete && (
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm text-center">
          <FileText size={28} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-foreground mb-1">Ready to generate</p>
          <p className="text-[11px] text-muted-foreground mb-4">
            ZOE will write the complete {fmt(totalTarget)}-word {settings.type?.toLowerCase() || "document"} in one continuous flow, followed by the complete reference list. References are excluded from the word count.
          </p>
        </div>
      )}

      {/* Inline error */}
      {writeError && (
        <div className="flex items-start gap-2.5 bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-destructive flex-1 leading-relaxed">{writeError}</p>
          {onClearError && (
            <button onClick={onClearError} className="text-destructive/60 hover:text-destructive flex-shrink-0">
              <X size={13} />
            </button>
          )}
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
          Edit & Proofread →
        </button>
      </div>
    </div>
  );
}
