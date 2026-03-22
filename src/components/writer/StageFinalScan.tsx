import { useState } from "react";
import StickyFooter from "./StickyFooter";
import ChecklistAnimation from "./ChecklistAnimation";

interface Props {
  onRunScan: () => Promise<any>;
  scanReport: any;
  onBack: () => void;
  onNext: () => void;
}

const scanChecks = [
  "Brief compliance verification",
  "Banned AI phrase scan",
  "Citation ↔ reference matching",
  "Formatting & heading hierarchy",
  "Word count final check",
  "Figure & table numbering",
  "Appendix completeness",
];

export default function StageFinalScan({ onRunScan, scanReport, onBack, onNext }: Props) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(!!scanReport);
  const [error, setError] = useState<string | null>(null);
  const [apiDone, setApiDone] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setApiDone(false);
    setDone(false);
    try {
      await onRunScan();
      setApiDone(true);
    } catch (e: any) {
      setError(e.message || "Scan failed");
      setRunning(false);
    }
  };

  const handleChecklistComplete = () => {
    setRunning(false);
    if (!error && apiDone) setDone(true);
  };

  const issueCount = scanReport?.report?.issues?.length || 0;

  return (
    <div className="max-w-[560px] mx-auto">
      <div className="mb-6 text-center">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 8 of 10</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Final Scan</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Last error check before submission.</p>
      </div>

      <div className="border border-border rounded-xl p-4 mb-4">
        <ChecklistAnimation items={scanChecks} running={running} onComplete={handleChecklistComplete} apiDone={apiDone} />
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-[10px] px-3.5 py-3 mb-4">
          <span className="text-[13px] text-destructive font-medium">✗ {error}</span>
        </div>
      )}

      {!running && !done && (
        <button onClick={handleRun} className="w-full py-3 bg-foreground text-background rounded-[10px] font-bold text-[14px] hover:bg-foreground/90 transition-all active:scale-[0.97]">
          Run Final Scan
        </button>
      )}

      {running && (
        <div className="w-full py-3 bg-terracotta text-white rounded-[10px] font-bold text-[14px] text-center animate-pulse">
          Scanning…
        </div>
      )}

      {done && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {issueCount === 0 ? (
            <div className="bg-sage/10 border border-sage/20 rounded-[10px] px-3.5 py-3">
              <span className="text-[13px] text-sage font-medium">✓ All checks passed — ready for submission</span>
            </div>
          ) : (
            <div className="bg-terracotta/10 border border-terracotta/20 rounded-[10px] px-3.5 py-3">
              <span className="text-[13px] text-terracotta font-medium">⚠ {issueCount} issues found — review before submitting</span>
            </div>
          )}
          {scanReport?.report?.issues?.map((issue: any, i: number) => (
            <div key={i} className="bg-muted border border-border rounded-lg px-3.5 py-2.5">
              <span className={`text-[10px] font-bold uppercase ${issue.severity === "critical" ? "text-destructive" : "text-terracotta"}`}>{issue.severity}</span>
              <p className="text-[12px] mt-0.5">{issue.description}</p>
            </div>
          ))}
        </div>
      )}

      <StickyFooter leftLabel="← Slate" onLeft={onBack} rightLabel="Submit →" onRight={onNext} />
    </div>
  );
}
