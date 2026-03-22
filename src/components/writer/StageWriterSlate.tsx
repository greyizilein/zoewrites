import { useState } from "react";
import { Check, X, ChevronDown } from "lucide-react";
import StickyFooter from "./StickyFooter";
import { Section } from "./types";

interface TrackedChange {
  id: string;
  sectionTitle: string;
  type: "insert" | "delete" | "modify";
  original: string;
  revised: string;
  accepted: boolean | null; // null = pending
}

interface Props {
  sections: Section[];
  totalTarget: number;
  onAcceptAll: () => void;
  onDenyAll: () => void;
  onTrimToTarget: () => void;
  onBack: () => void;
  onNext: () => void;
  isProcessing: boolean;
}

export default function StageWriterSlate({ sections, totalTarget, onAcceptAll, onDenyAll, onTrimToTarget, onBack, onNext, isProcessing }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const totalWords = sections.reduce((a, s) => a + s.word_current, 0);
  const diff = totalWords - totalTarget;
  const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
  const isOverTarget = diff > 0;

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 7 of 10</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Writer Slate</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Full document view. Review changes, adjust word count, accept or deny edits.</p>
      </div>

      {/* Word count bar */}
      <div className="bg-muted border border-border rounded-[10px] px-3.5 py-3 mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[13px] font-semibold">Word Count</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-semibold">{totalWords.toLocaleString()} / {totalTarget.toLocaleString()}</span>
            <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
              Math.abs(diff) <= 50 ? "bg-sage/15 text-sage" : isOverTarget ? "bg-terracotta/15 text-terracotta" : "bg-warm-gold/15 text-warm-gold"
            }`}>{diffLabel}</span>
          </div>
        </div>
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${
            Math.abs(diff) <= 50 ? "bg-sage" : "bg-terracotta"
          }`} style={{ width: `${Math.min((totalWords / totalTarget) * 100, 100)}%` }} />
        </div>
        {Math.abs(diff) > 50 && (
          <button
            onClick={onTrimToTarget}
            disabled={isProcessing}
            className="mt-2 text-[11px] text-terracotta font-medium hover:underline disabled:opacity-50"
          >
            {isOverTarget ? `Auto-trim ${diff} words →` : `Auto-expand ${Math.abs(diff)} words →`}
          </button>
        )}
      </div>

      {/* Accept/Deny all */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={onAcceptAll}
          disabled={isProcessing}
          className="flex-1 py-2.5 bg-sage text-white rounded-lg font-bold text-[13px] hover:bg-sage/80 transition-colors active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Check size={14} /> Accept All
        </button>
        <button
          onClick={onDenyAll}
          disabled={isProcessing}
          className="flex-1 py-2.5 bg-muted border border-border text-foreground rounded-lg font-bold text-[13px] hover:bg-muted/80 transition-colors active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <X size={14} /> Deny All
        </button>
      </div>

      {/* Full document board */}
      <div className="space-y-3">
        {sections.map((s) => {
          const isExpanded = expandedSection === s.id;
          return (
            <div key={s.id} className="border border-border rounded-xl overflow-hidden bg-card">
              <button
                onClick={() => setExpandedSection(isExpanded ? null : s.id)}
                className="w-full px-3.5 py-3 bg-muted/50 flex items-center gap-2 hover:bg-muted/80 transition-colors"
              >
                <span className="flex-1 text-[13px] sm:text-[14px] font-semibold text-left truncate">{s.title}</span>
                <span className="font-mono text-[11px] text-muted-foreground flex-shrink-0">{s.word_current}w</span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
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
