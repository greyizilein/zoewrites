import { useState, useEffect, useRef } from "react";
import { Loader2, Check, FileText, X, AlertCircle, Play } from "lucide-react";
import { Section, WriterSettings } from "./types";

type Phase = "idle" | "critiquing" | "correcting" | "done";

interface Props {
  sections: Section[];
  settings: WriterSettings;
  editedContent: string;
  critiqueText: string;
  correctedContent: string;
  generating: boolean;
  streamContent: string;
  writeError?: string | null;
  onRunCritiqueAndCorrect: () => Promise<void>;
  onCritiqueChange: (text: string) => void;
  onCorrectedChange: (text: string) => void;
  onClearError?: () => void;
  phase: Phase;
  onBack: () => void;
  onNext: () => void;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export default function StageCritiqueCorrect({
  sections, settings,
  editedContent, critiqueText, correctedContent,
  generating, streamContent, writeError,
  onRunCritiqueAndCorrect, onCritiqueChange, onCorrectedChange, onClearError,
  phase,
  onBack, onNext,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0);
  const correctedWc = countWords(correctedContent || "");

  useEffect(() => {
    if ((phase === "correcting") && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamContent, phase]);

  return (
    <div className="max-w-[920px] mx-auto flex flex-col gap-4">
      {/* Header */}
      <div>
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 5 of 7</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1">Critique & Correct</h1>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          {phase === "critiquing" ? "Evaluating against A+ criteria…" :
           phase === "correcting" ? "Applying all corrections…" :
           phase === "done" ? "Critique complete — corrections applied." :
           "ZOE evaluates the work against A+ criteria, then immediately applies every correction found."}
        </p>
      </div>

      {/* Action bar */}
      <div className="bg-card border border-border/50 rounded-2xl p-3.5 shadow-sm flex flex-wrap items-center gap-3">
        {phase === "idle" && (
          <button
            onClick={onRunCritiqueAndCorrect}
            disabled={!editedContent}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-terracotta text-white rounded-xl text-[13px] font-bold hover:bg-terracotta/90 transition-all active:scale-[0.97] disabled:opacity-40 shadow-sm"
          >
            <Play size={14} /> Critique & Correct
          </button>
        )}
        {(phase === "critiquing" || phase === "correcting") && (
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-terracotta" />
            <span className="text-[12px] font-semibold text-terracotta font-mono">
              {phase === "critiquing" ? "Critiquing…" : "Correcting…"}
            </span>
          </div>
        )}
        {phase === "done" && (
          <>
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-sage">
              <Check size={13} /> All corrections applied
            </span>
            <span className="font-mono text-[12px] font-bold text-foreground ml-auto">
              {fmt(correctedWc)} / {fmt(totalTarget)}w
            </span>
          </>
        )}
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT — Critique Report */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <p className="text-[12px] font-bold text-foreground">Critique Report</p>
            {phase === "critiquing" && (
              <span className="flex items-center gap-1 text-[10px] text-terracotta font-semibold">
                <Loader2 size={10} className="animate-spin" /> Evaluating…
              </span>
            )}
            {phase === "done" && (
              <span className="px-2 py-0.5 bg-sage/10 text-sage text-[10px] font-bold rounded-full">Done</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 max-h-[400px] sm:max-h-[500px]">
            {phase === "idle" && !critiqueText && (
              <p className="text-[12px] text-muted-foreground text-center py-8 leading-relaxed">
                The critique report will appear here. ZOE evaluates against A+ criteria and immediately applies every correction found.
              </p>
            )}
            {critiqueText && (
              <pre className="text-[11px] font-mono text-foreground/80 leading-[1.7] whitespace-pre-wrap">{critiqueText}</pre>
            )}
          </div>
        </div>

        {/* RIGHT — Corrected Draft */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
            <FileText size={13} className="text-muted-foreground" />
            <p className="text-[12px] font-bold text-foreground flex-1">Corrected Draft</p>
            {phase === "correcting" && (
              <span className="text-[10px] font-semibold text-terracotta flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" /> Applying corrections…
              </span>
            )}
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto max-h-[400px] sm:max-h-[500px]">
            {!correctedContent && phase !== "correcting" && (
              <div className="flex items-center justify-center h-full py-12 text-center">
                <div>
                  <div className="text-[24px] opacity-30 mb-2">◎</div>
                  <p className="text-[12px] text-muted-foreground">Corrections will appear here after critique runs…</p>
                </div>
              </div>
            )}
            <textarea
              value={phase === "correcting" ? streamContent || correctedContent : correctedContent}
              onChange={e => phase === "done" && onCorrectedChange(e.target.value)}
              readOnly={phase !== "done"}
              style={{ display: correctedContent || phase === "correcting" ? "block" : "none" }}
              className="w-full min-h-[380px] bg-transparent border-none outline-none resize-y px-5 py-4 text-[13px] font-serif leading-[1.9] text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Error */}
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
          disabled={phase === "critiquing" || phase === "correcting"}
          className="flex-1 py-3 bg-foreground text-background rounded-xl text-[13px] font-bold hover:bg-foreground/85 transition-all active:scale-[0.97] disabled:opacity-40"
        >
          Revision Centre →
        </button>
      </div>
    </div>
  );
}
