import { useState } from "react";
import { Loader2, Check, AlertTriangle, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Wrench, Send } from "lucide-react";
import { Section } from "./types";

interface Issue {
  severity: "critical" | "warning" | string;
  description: string;
  suggestion?: string;
}

interface Props {
  sections: Section[];
  qualityReport: any;
  isProcessing: boolean;
  onRunScan: () => Promise<any>;
  onFixAllIssues: () => Promise<void>;
  onApplySectionFeedback: (sectionId: string, feedback: string) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

const gradeColor: Record<string, string> = {
  "A+": "text-sage", "A": "text-sage", "B+": "text-terracotta", "B": "text-terracotta",
  "C+": "text-amber-600", "C": "text-amber-600", "D": "text-destructive", "F": "text-destructive",
};

export default function StageReview({
  sections, qualityReport, isProcessing, onRunScan,
  onFixAllIssues, onApplySectionFeedback, onBack, onNext,
}: Props) {
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [sectionFeedback, setSectionFeedback] = useState<Record<string, string>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);

  const report = qualityReport?.report;
  const grade = report?.grade || null;
  const issues: Issue[] = report?.issues || [];
  const criticalCount = issues.filter(i => i.severity === "critical").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;

  const totalWords = sections.reduce((a, s) => a + s.word_current, 0);
  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0);
  const progress = totalTarget > 0 ? Math.round((totalWords / totalTarget) * 100) : 0;

  const handleScan = async () => {
    setScanning(true);
    try { await onRunScan(); } finally { setScanning(false); }
  };

  const handleFixAll = async () => {
    setFixing(true);
    try { await onFixAllIssues(); } finally { setFixing(false); }
  };

  const handleSectionRevise = async (sectionId: string) => {
    const fb = sectionFeedback[sectionId];
    if (!fb?.trim()) return;
    setApplyingId(sectionId);
    try {
      await onApplySectionFeedback(sectionId, fb);
      setSectionFeedback(prev => ({ ...prev, [sectionId]: "" }));
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="max-w-[640px] mx-auto">
      {/* Header */}
      <div className="mb-5">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 3 of 4</p>
        <h1 className="text-[22px] font-bold tracking-tight mb-0.5">Review</h1>
        <p className="text-[13px] text-muted-foreground">Check your draft, fix issues, and refine sections before export.</p>
      </div>

      {/* Stats bar */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-4">
          {grade && (
            <div className="text-center flex-shrink-0">
              <p className={`text-3xl font-extrabold tabular-nums leading-none ${gradeColor[grade] || "text-foreground"}`}>{grade}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5 font-medium">Grade</p>
            </div>
          )}
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">Word count</p>
              <span className="text-[11px] font-bold tabular-nums text-foreground">{fmt(totalWords)} / {fmt(totalTarget)} ({progress}%)</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${progress >= 99 ? "bg-sage" : "bg-terracotta"}`} style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
            {grade && (
              <div className="flex items-center gap-3 pt-0.5">
                {criticalCount > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-destructive">
                    <AlertCircle size={11} /> {criticalCount} critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                    <AlertTriangle size={11} /> {warningCount} warning{warningCount !== 1 ? "s" : ""}
                  </span>
                )}
                {criticalCount === 0 && warningCount === 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-sage">
                    <Check size={11} /> All clear
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fix All Issues + Re-scan buttons */}
      <div className="flex gap-2.5 mb-4">
        {issues.length > 0 && (
          <button
            onClick={handleFixAll}
            disabled={fixing || isProcessing}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-terracotta text-white rounded-xl text-[13px] font-bold hover:bg-terracotta/90 transition-all active:scale-[0.97] disabled:opacity-50 shadow-sm"
          >
            {fixing ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
            Fix All Issues
          </button>
        )}
        <button
          onClick={handleScan}
          disabled={scanning || isProcessing}
          className={`flex items-center justify-center gap-1.5 py-3 px-4 border border-border rounded-xl text-[13px] font-semibold text-foreground hover:bg-muted/50 transition-all active:scale-[0.97] disabled:opacity-50 ${issues.length === 0 ? "flex-1" : ""}`}
        >
          {scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {qualityReport ? "Re-scan" : "Run Scan"}
        </button>
      </div>

      {/* Issues list */}
      {issues.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-[12px] font-bold text-foreground">Issues Found</p>
          </div>
          <div className="divide-y divide-border/50">
            {issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2.5 px-4 py-3">
                {issue.severity === "critical"
                  ? <AlertCircle size={13} className="text-destructive flex-shrink-0 mt-0.5" />
                  : <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                }
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-foreground">{issue.description}</p>
                  {issue.suggestion && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{issue.suggestion}</p>
                  )}
                </div>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                  issue.severity === "critical" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                }`}>
                  {issue.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-border/50">
          <p className="text-[12px] font-bold text-foreground">Sections</p>
        </div>
        {sections.map((s, idx) => {
          const pct = s.word_target > 0 ? Math.round((s.word_current / s.word_target) * 100) : 0;
          const overTarget = s.word_current > Math.ceil(s.word_target * 1.01);
          const underTarget = pct < 95;
          const isExpanded = expandedSectionId === s.id;
          const isApplying = applyingId === s.id;

          return (
            <div key={s.id} className={idx > 0 ? "border-t border-border/50" : ""}>
              <button
                onClick={() => setExpandedSectionId(isExpanded ? null : s.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.content ? "bg-sage" : "bg-border"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-foreground truncate">{s.title}</p>
                  <p className={`text-[10px] tabular-nums ${overTarget || underTarget ? "text-amber-600" : "text-muted-foreground"}`}>
                    {fmt(s.word_current)} / {fmt(s.word_target)}w
                    {overTarget && " · over"}
                    {underTarget && s.content && " · under"}
                  </p>
                </div>
                <div className="w-12 h-1 bg-muted rounded-full overflow-hidden flex-shrink-0">
                  <div className={`h-full rounded-full transition-all ${overTarget ? "bg-amber-500" : "bg-sage"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                {isExpanded ? <ChevronUp size={13} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={13} className="text-muted-foreground flex-shrink-0" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Content preview */}
                  {s.content && (
                    <div className="bg-muted/40 rounded-xl p-3 max-h-44 overflow-y-auto">
                      <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {s.content.slice(0, 800)}{s.content.length > 800 ? "…" : ""}
                      </p>
                    </div>
                  )}

                  {/* Custom feedback */}
                  <div className="flex gap-2">
                    <textarea
                      value={sectionFeedback[s.id] || ""}
                      onChange={e => setSectionFeedback(prev => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="Add revision feedback for this section…"
                      rows={2}
                      className="flex-1 text-[11px] bg-muted/40 border border-border rounded-xl px-3 py-2 resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-terracotta/40"
                    />
                    <button
                      onClick={() => handleSectionRevise(s.id)}
                      disabled={!sectionFeedback[s.id]?.trim() || isApplying || isProcessing}
                      className="flex-shrink-0 w-9 h-9 self-end flex items-center justify-center bg-terracotta/10 hover:bg-terracotta/20 border border-terracotta/20 rounded-xl transition-colors disabled:opacity-40 active:scale-[0.97]"
                    >
                      {isApplying ? <Loader2 size={13} className="text-terracotta animate-spin" /> : <Send size={13} className="text-terracotta" />}
                    </button>
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
          disabled={isProcessing}
          className="flex-1 py-3 bg-foreground text-background rounded-xl text-[13px] font-bold hover:bg-foreground/85 transition-all active:scale-[0.97] disabled:opacity-40"
        >
          Export →
        </button>
      </div>
    </div>
  );
}
