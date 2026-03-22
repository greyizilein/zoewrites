import { useState } from "react";
import { Check, X } from "lucide-react";
import StickyFooter from "./StickyFooter";
import ChecklistAnimation from "./ChecklistAnimation";

export interface EditDiff {
  sectionId: string;
  sectionTitle: string;
  original: string;
  corrected: string;
  accepted: boolean | null; // null = pending
}

interface Props {
  onRunEdit: () => Promise<any>;
  editDiffs: EditDiff[];
  onAcceptEdits: (sectionIds: string[]) => void;
  onDenyEdits: (sectionIds: string[]) => void;
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

export default function StageEditProofread({ onRunEdit, editDiffs, onAcceptEdits, onDenyEdits, editReport, onBack, onNext }: Props) {
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

  const pendingDiffs = editDiffs.filter(d => d.accepted === null);
  const allResolved = editDiffs.length > 0 && pendingDiffs.length === 0;
  const corrections = editReport?.corrections_count || 0;

  return (
    <div className="max-w-[560px] mx-auto">
      <div className="mb-6 text-center">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 6 of 10</p>
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

      {!running && !done && editDiffs.length === 0 && (
        <button onClick={handleRun} className="w-full py-3 bg-foreground text-background rounded-[10px] font-bold text-[14px] hover:bg-foreground/90 transition-all active:scale-[0.97]">
          Run Edit & Proofread
        </button>
      )}

      {running && (
        <div className="w-full py-3 bg-terracotta text-white rounded-[10px] font-bold text-[14px] text-center animate-pulse">
          Editing & proofreading…
        </div>
      )}

      {/* Per-section diff review */}
      {done && editDiffs.length > 0 && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="bg-sage/10 border border-sage/20 rounded-[10px] px-3.5 py-3">
            <span className="text-[13px] text-sage font-medium">✓ Edit pass complete — {corrections} corrections found</span>
          </div>

          {/* Accept All / Deny All */}
          {pendingDiffs.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => onAcceptEdits(pendingDiffs.map(d => d.sectionId))}
                className="flex-1 py-2.5 bg-sage text-white rounded-lg font-bold text-[13px] hover:bg-sage/80 transition-colors active:scale-[0.97] flex items-center justify-center gap-1.5"
              >
                <Check size={14} /> Accept All
              </button>
              <button
                onClick={() => onDenyEdits(pendingDiffs.map(d => d.sectionId))}
                className="flex-1 py-2.5 bg-muted border border-border text-foreground rounded-lg font-bold text-[13px] hover:bg-muted/80 transition-colors active:scale-[0.97] flex items-center justify-center gap-1.5"
              >
                <X size={14} /> Deny All
              </button>
            </div>
          )}

          {/* Per-section diffs */}
          {editDiffs.map((diff) => {
            const origWc = diff.original.split(/\s+/).filter(Boolean).length;
            const corrWc = diff.corrected.split(/\s+/).filter(Boolean).length;
            const wcDiff = corrWc - origWc;

            return (
              <div key={diff.sectionId} className="border border-border rounded-xl overflow-hidden bg-card">
                <div className="px-3.5 py-2.5 bg-muted/50 flex items-center justify-between">
                  <span className="text-[13px] font-semibold truncate">{diff.sectionTitle}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {origWc}→{corrWc}w
                      {wcDiff !== 0 && (
                        <span className={wcDiff > 0 ? "text-sage ml-1" : "text-terracotta ml-1"}>
                          ({wcDiff > 0 ? "+" : ""}{wcDiff})
                        </span>
                      )}
                    </span>
                    {diff.accepted === null ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => onAcceptEdits([diff.sectionId])}
                          className="w-7 h-7 rounded-md bg-sage/15 text-sage flex items-center justify-center hover:bg-sage/25 transition-colors active:scale-95"
                          title="Accept"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => onDenyEdits([diff.sectionId])}
                          className="w-7 h-7 rounded-md bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors active:scale-95"
                          title="Deny"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                        diff.accepted ? "bg-sage/15 text-sage" : "bg-destructive/10 text-destructive"
                      }`}>
                        {diff.accepted ? "Accepted" : "Denied"}
                      </span>
                    )}
                  </div>
                </div>
                {diff.accepted === null && (
                  <div className="px-3.5 py-3 border-t border-border max-h-[200px] overflow-y-auto">
                    <p className="text-[12px] text-muted-foreground mb-1.5 font-medium">Preview of corrected version:</p>
                    <p className="text-[13px] leading-[1.7] text-foreground/80 whitespace-pre-wrap">
                      {diff.corrected.slice(0, 500)}{diff.corrected.length > 500 ? "…" : ""}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {allResolved && (
            <div className="bg-sage/10 border border-sage/20 rounded-[10px] px-3.5 py-3 text-center">
              <span className="text-[13px] text-sage font-medium">All edits resolved — proceed to Writer Slate →</span>
            </div>
          )}
        </div>
      )}

      {/* Legacy: no diffs (e.g. no changes found) */}
      {done && editDiffs.length === 0 && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="bg-sage/10 border border-sage/20 rounded-[10px] px-3.5 py-3">
            <span className="text-[13px] text-sage font-medium">✓ Edit pass complete — no corrections needed</span>
          </div>
          {editReport?.summary && (
            <div className="bg-muted border border-border rounded-[10px] px-3.5 py-3">
              <p className="text-[12px] text-muted-foreground">{editReport.summary}</p>
            </div>
          )}
        </div>
      )}

      <StickyFooter leftLabel="← Revise" onLeft={onBack} rightLabel="Writer Slate →" onRight={onNext} />
    </div>
  );
}
