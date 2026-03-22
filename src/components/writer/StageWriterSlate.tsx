import { useState, useEffect } from "react";
import { Check, X, ChevronDown, AlertTriangle, Loader2 } from "lucide-react";
import StickyFooter from "./StickyFooter";
import ChecklistAnimation from "./ChecklistAnimation";
import { Section } from "./types";

interface Props {
  sections: Section[];
  priorSections: Section[];
  totalTarget: number;
  onAcceptAll: () => void;
  onDenyAll: () => void;
  onAcceptSection: (sectionId: string) => void;
  onDenySection: (sectionId: string) => void;
  onTrimToTarget: () => void;
  onBack: () => void;
  onNext: () => void;
  isProcessing: boolean;
}

const acceptChecklist = [
  "Applying accepted changes…",
  "Updating word counts…",
  "Confirming document state…",
];

const denyChecklist = [
  "Reverting to prior version…",
  "Restoring section content…",
  "Confirming rollback…",
];

export default function StageWriterSlate({ sections, priorSections, totalTarget, onAcceptAll, onDenyAll, onAcceptSection, onDenySection, onTrimToTarget, onBack, onNext, isProcessing }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [resolvedSections, setResolvedSections] = useState<Record<string, "accepted" | "denied">>({});
  const [animating, setAnimating] = useState<"accept" | "deny" | null>(null);
  const [animDone, setAnimDone] = useState(false);

  const totalWords = sections.reduce((a, s) => a + s.word_current, 0);
  const diff = totalWords - totalTarget;
  const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
  const isOverTarget = diff > 0;
  const overOnePercent = Math.abs(diff) > totalTarget * 0.01;
  const hasPrior = priorSections.length > 0;

  // Auto-advance after animation completes
  useEffect(() => {
    if (animDone) {
      const timer = setTimeout(() => {
        setAnimating(null);
        setAnimDone(false);
        onNext();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [animDone, onNext]);

  const handleAcceptSection = (sectionId: string) => {
    onAcceptSection(sectionId);
    setResolvedSections(prev => ({ ...prev, [sectionId]: "accepted" }));
  };

  const handleDenySection = (sectionId: string) => {
    onDenySection(sectionId);
    setResolvedSections(prev => ({ ...prev, [sectionId]: "denied" }));
  };

  const handleAcceptAll = async () => {
    setAnimating("accept");
    await onAcceptAll();
    const all: Record<string, "accepted"> = {};
    sections.forEach(s => { all[s.id] = "accepted"; });
    setResolvedSections(all);
  };

  const handleDenyAll = async () => {
    setAnimating("deny");
    await onDenyAll();
    const all: Record<string, "denied"> = {};
    sections.forEach(s => { all[s.id] = "denied"; });
    setResolvedSections(all);
  };

  const pendingCount = sections.filter(s => !resolvedSections[s.id]).length;

  // If animating, show the checklist
  if (animating) {
    return (
      <div>
        <div className="mb-6">
          <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 7 of 10</p>
          <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Writer Slate</h1>
        </div>
        <div className="border border-border rounded-xl p-4 mb-4">
          <ChecklistAnimation
            items={animating === "accept" ? acceptChecklist : denyChecklist}
            running={!animDone}
            onComplete={() => setAnimDone(true)}
          />
        </div>
        {animDone && (
          <div className="bg-sage/10 border border-sage/20 rounded-[10px] px-3.5 py-3 text-center animate-in fade-in duration-300">
            <span className="text-[13px] text-sage font-semibold">
              {animating === "accept" ? "✓ All changes applied — advancing to Final Scan…" : "✓ Reverted to prior version — advancing…"}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 7 of 10</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Writer Slate</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Full document view. Review changes, adjust word count, accept or deny edits.</p>
      </div>

      {/* Word count bar */}
      <div className={`border rounded-[10px] px-3.5 py-3 mb-4 ${overOnePercent ? "bg-terracotta/5 border-terracotta/20" : "bg-muted border-border"}`}>
        <div className="flex justify-between items-center mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold">Word Count</span>
            {overOnePercent && <AlertTriangle size={13} className="text-terracotta" />}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-semibold">{totalWords.toLocaleString()} / {totalTarget.toLocaleString()}</span>
            <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
              Math.abs(diff) <= totalTarget * 0.01 ? "bg-sage/15 text-sage" : "bg-terracotta/15 text-terracotta"
            }`}>{diffLabel}</span>
          </div>
        </div>
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${
            Math.abs(diff) <= totalTarget * 0.01 ? "bg-sage" : "bg-terracotta"
          }`} style={{ width: `${Math.min((totalWords / totalTarget) * 100, 100)}%` }} />
        </div>
        {overOnePercent && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-terracotta font-medium">
              {isOverTarget ? `${diff} words over target (>${(diff / totalTarget * 100).toFixed(1)}%)` : `${Math.abs(diff)} words under target`}
            </span>
            <button
              onClick={onTrimToTarget}
              disabled={isProcessing}
              className="text-[11px] text-white bg-terracotta px-2.5 py-1 rounded-md font-medium hover:bg-terracotta/90 disabled:opacity-50 active:scale-95 transition-all"
            >
              {isProcessing ? <Loader2 size={11} className="animate-spin" /> : isOverTarget ? `Auto-trim →` : `Auto-expand →`}
            </button>
          </div>
        )}
      </div>

      {/* Accept/Deny all */}
      {pendingCount > 0 && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleAcceptAll}
            disabled={isProcessing}
            className="flex-1 py-2.5 bg-sage text-white rounded-lg font-bold text-[13px] hover:bg-sage/80 transition-colors active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Check size={14} /> Accept All ({pendingCount})
          </button>
          <button
            onClick={handleDenyAll}
            disabled={isProcessing || !hasPrior}
            className="flex-1 py-2.5 bg-muted border border-border text-foreground rounded-lg font-bold text-[13px] hover:bg-muted/80 transition-colors active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <X size={14} /> Deny All
          </button>
        </div>
      )}

      {pendingCount === 0 && sections.length > 0 && (
        <div className="bg-sage/10 border border-sage/20 rounded-[10px] px-3.5 py-3 mb-4 text-center">
          <span className="text-[13px] text-sage font-medium">All changes resolved — proceed to Final Scan →</span>
        </div>
      )}

      {/* Full document board */}
      <div className="space-y-3">
        {sections.map((s) => {
          const isExpanded = expandedSection === s.id;
          const prior = priorSections.find(p => p.id === s.id);
          const priorWc = prior?.word_current || 0;
          const wcChange = hasPrior ? s.word_current - priorWc : 0;
          const status = resolvedSections[s.id];

          return (
            <div key={s.id} className={`border rounded-xl overflow-hidden bg-card ${
              status === "accepted" ? "border-sage/30" :
              status === "denied" ? "border-destructive/30" :
              "border-border"
            }`}>
              <button
                onClick={() => setExpandedSection(isExpanded ? null : s.id)}
                className="w-full px-3.5 py-3 bg-muted/50 flex items-center gap-2 hover:bg-muted/80 transition-colors"
              >
                <span className="flex-1 text-[13px] sm:text-[14px] font-semibold text-left truncate">{s.title}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="font-mono text-[11px] text-muted-foreground">{s.word_current}w</span>
                  {hasPrior && wcChange !== 0 && (
                    <span className={`font-mono text-[10px] font-bold ${wcChange > 0 ? "text-sage" : "text-terracotta"}`}>
                      {wcChange > 0 ? "+" : ""}{wcChange}
                    </span>
                  )}
                  {status ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      status === "accepted" ? "bg-sage/15 text-sage" : "bg-destructive/10 text-destructive"
                    }`}>
                      {status === "accepted" ? "✓" : "✗"}
                    </span>
                  ) : (
                    <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleAcceptSection(s.id)} className="w-6 h-6 rounded bg-sage/15 text-sage flex items-center justify-center hover:bg-sage/25 active:scale-95">
                        <Check size={11} />
                      </button>
                      <button onClick={() => handleDenySection(s.id)} disabled={!hasPrior} className="w-6 h-6 rounded bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 active:scale-95 disabled:opacity-30">
                        <X size={11} />
                      </button>
                    </div>
                  )}
                  <ChevronDown size={14} className={`text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>
              {isExpanded && s.content && (
                <div className="px-3.5 py-3 border-t border-border">
                  <div className="text-[14px] leading-[1.8] text-foreground/85 whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                    {s.content}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <StickyFooter leftLabel="← Revise" onLeft={onBack} rightLabel="Final Scan →" onRight={onNext} />
    </div>
  );
}
