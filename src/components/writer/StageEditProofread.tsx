import { useState } from "react";
import StickyFooter from "./StickyFooter";
import ChecklistAnimation from "./ChecklistAnimation";

interface Props {
  onRunEdit: () => Promise<any>;
  editReport: any;
  onBack: () => void;
  onNext: () => void;
}

const editChecks = [
  "Grammar & syntax audit",
  "Spelling & typo correction",
  "Punctuation consistency",
  "Sentence structure refinement",
  "Paragraph flow & transitions",
  "Academic tone verification",
  "Passive voice optimisation",
];

export default function StageEditProofread({ onRunEdit, editReport, onBack, onNext }: Props) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(!!editReport);
  const [error, setError] = useState<string | null>(null);
  const [apiDone, setApiDone] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setApiDone(false);
    setDone(false);
    try {
      await onRunEdit();
      setApiDone(true);
    } catch (e: any) {
      setError(e.message || "Edit pass failed");
      setRunning(false);
    }
  };

  const handleChecklistComplete = () => {
    setRunning(false);
    if (!error && apiDone) setDone(true);
  };

  const corrections = editReport?.corrections_count || 0;

  return (
    <div className="max-w-[560px] mx-auto">
      <div className="mb-6 text-center">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 5 of 10</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Edit & Proofread</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Automated grammar, spelling, and structure pass.</p>
      </div>

      <div className="border border-border rounded-xl p-4 mb-4">
        <ChecklistAnimation items={editChecks} running={running} onComplete={handleChecklistComplete} apiDone={apiDone} />
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-[10px] px-3.5 py-3 mb-4">
          <span className="text-[13px] text-destructive font-medium">✗ {error}</span>
        </div>
      )}

      {!running && !done && (
        <button onClick={handleRun} className="w-full py-3 bg-foreground text-background rounded-[10px] font-bold text-[14px] hover:bg-foreground/90 transition-all active:scale-[0.97]">
          Run Edit & Proofread
        </button>
      )}

      {running && (
        <div className="w-full py-3 bg-terracotta text-white rounded-[10px] font-bold text-[14px] text-center animate-pulse">
          Editing & proofreading…
        </div>
      )}

      {done && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="bg-sage/10 border border-sage/20 rounded-[10px] px-3.5 py-3">
            <span className="text-[13px] text-sage font-medium">✓ Edit pass complete — {corrections} corrections applied</span>
          </div>
          {editReport?.summary && (
            <div className="bg-muted border border-border rounded-[10px] px-3.5 py-3">
              <p className="text-[12px] text-muted-foreground">{editReport.summary}</p>
            </div>
          )}
        </div>
      )}

      <StickyFooter leftLabel="← Critique" onLeft={onBack} rightLabel="Revise →" onRight={onNext} />
    </div>
  );
}
