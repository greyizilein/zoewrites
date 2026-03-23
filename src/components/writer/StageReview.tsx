import { useState, useEffect, useRef } from "react";
import {
  Loader2, Check, AlertTriangle, AlertCircle, RefreshCw,
  Wrench, Link2, FileText, ChevronDown, ChevronUp,
} from "lucide-react";
import { Section } from "./types";

interface Issue {
  severity: "critical" | "major" | "minor" | "warning" | string;
  section?: string;
  description: string;
  suggestion?: string;
}

interface CoherenceIssue {
  severity: "critical" | "major" | "minor" | string;
  type: string;
  sections_involved: string[];
  description: string;
  suggestion: string;
}

interface FrameworkCheck {
  section_title: string;
  framework: string;
  present: string[];
  missing: string[];
  completeness_score: number;
}

type IssueState = null | "fixing" | "fixed" | "done";

interface Props {
  sections: Section[];
  fullDocContent: string;
  qualityReport: any;
  coherenceReport: any;
  isProcessing: boolean;
  generating: boolean;
  streamContent: string;
  onRunScan: () => Promise<any>;
  onReviseDocument: (feedback: string) => Promise<void>;
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
  sections, fullDocContent, qualityReport, coherenceReport, isProcessing, generating, streamContent,
  onRunScan, onReviseDocument, onBack, onNext,
}: Props) {
  const [scanning, setScanning] = useState(false);
  const [revising, setRevising] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [issueStates, setIssueStates] = useState<IssueState[]>([]);
  const [showDoc, setShowDoc] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track which issue descriptions have been resolved — survives re-scan
  const suppressedRef = useRef<Set<string>>(new Set());

  const report = qualityReport?.report;
  const grade = report?.overall_grade || report?.grade || null;
  const allIssues: Issue[] = report?.issues || [];
  const frameworkChecks: FrameworkCheck[] = report?.framework_checks || [];
  const coherenceIssues: CoherenceIssue[] = coherenceReport?.issues || [];
  const overallCoherence: string | null = coherenceReport?.overall_coherence || null;

  // Sync issueStates when qualityReport changes — auto-suppress previously fixed issues
  useEffect(() => {
    const newStates: IssueState[] = allIssues.map((issue) =>
      suppressedRef.current.has(issue.description) ? "done" : null
    );
    setIssueStates(newStates);
  }, [qualityReport]);

  const visibleIssues = allIssues.filter((_, i) => issueStates[i] !== "done");
  const criticalCount = visibleIssues.filter(i => i.severity === "critical").length
    + coherenceIssues.filter(i => i.severity === "critical").length;
  const warningCount = visibleIssues.filter(i => i.severity === "major" || i.severity === "warning").length
    + coherenceIssues.filter(i => i.severity === "major" || i.severity === "minor").length;

  const totalWords = sections.reduce((a, s) => a + s.word_current, 0);
  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0);
  const progress = totalTarget > 0 ? Math.round((totalWords / totalTarget) * 100) : 0;

  const animateFix = (indices: number[]) => {
    setIssueStates(prev => {
      const next = [...prev];
      indices.forEach(i => { next[i] = "fixing"; });
      return next;
    });
  };

  const animateFixed = (indices: number[], issues: Issue[]) => {
    setIssueStates(prev => {
      const next = [...prev];
      indices.forEach(i => { next[i] = "fixed"; });
      return next;
    });
    setTimeout(() => {
      setIssueStates(prev => {
        const next = [...prev];
        indices.forEach(i => {
          next[i] = "done";
          if (issues[i]) suppressedRef.current.add(issues[i].description);
        });
        return next;
      });
    }, 1200);
  };

  const handleScan = async () => {
    setScanning(true);
    try { await onRunScan(); } finally { setScanning(false); }
  };

  const handleRevise = async () => {
    const qualityIssueLines = visibleIssues.map(i =>
      `[${i.severity?.toUpperCase()}]${i.section ? ` [${i.section}]` : ""} ${i.description}${i.suggestion ? ` — ${i.suggestion}` : ""}`
    );
    const coherenceLines = coherenceIssues.map(i =>
      `[COHERENCE/${i.severity?.toUpperCase()}] ${i.description}${i.suggestion ? ` — ${i.suggestion}` : ""}`
    );
    const allLines = [...qualityIssueLines, ...coherenceLines];
    const issueFeedback = allLines.join("\n");
    const parts = [issueFeedback, customInstructions.trim() ? `ADDITIONAL INSTRUCTIONS:\n${customInstructions}` : ""].filter(Boolean);
    if (parts.length === 0) return;

    const indicesToFix = allIssues.map((_, i) => i).filter(i => issueStates[i] !== "done");
    animateFix(indicesToFix);
    setRevising(true);
    try {
      await onReviseDocument(parts.join("\n\n"));
      animateFixed(indicesToFix, allIssues);
      if (customInstructions) setCustomInstructions("");
    } finally {
      setRevising(false);
    }
  };

  const canRevise = visibleIssues.length > 0 || coherenceIssues.length > 0 || customInstructions.trim().length > 0;

  useEffect(() => {
    if (generating && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamContent, generating]);

  return (
    <div className="max-w-[640px] mx-auto flex flex-col gap-4">
      {/* Header */}
      <div>
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 3 of 4</p>
        <h1 className="text-[22px] font-bold tracking-tight mb-0.5">Review</h1>
        <p className="text-[13px] text-muted-foreground">Scan your document, apply fixes, then export.</p>
      </div>

      {/* Stats */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
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

      {/* Revision instructions */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
        <p className="text-[12px] font-bold text-foreground mb-1.5">Revision Instructions</p>
        <p className="text-[10px] text-muted-foreground mb-2.5">Add instructions for ZOE to apply alongside any scan issues in one revision pass.</p>
        <textarea
          value={customInstructions}
          onChange={e => setCustomInstructions(e.target.value)}
          placeholder="e.g. Strengthen the critical analysis. Add more statistical evidence. Ensure PESTLE ratings are justified…"
          rows={3}
          className="w-full text-[12px] bg-muted/40 border border-border rounded-xl px-3 py-2.5 resize-none placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-terracotta/40"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2.5">
        {canRevise && (
          <button
            onClick={handleRevise}
            disabled={revising || isProcessing || generating}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-terracotta text-white rounded-xl text-[13px] font-bold hover:bg-terracotta/90 transition-all active:scale-[0.97] disabled:opacity-50 shadow-sm"
          >
            {revising ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
            {customInstructions.trim() && visibleIssues.length > 0
              ? "Revise + Apply Instructions"
              : customInstructions.trim()
                ? "Apply Instructions"
                : "Fix All Issues"}
          </button>
        )}
        <button
          onClick={handleScan}
          disabled={scanning || isProcessing || generating}
          className={`flex items-center justify-center gap-1.5 py-3 px-4 border border-border rounded-xl text-[13px] font-semibold text-foreground hover:bg-muted/50 transition-all active:scale-[0.97] disabled:opacity-50 ${!canRevise ? "flex-1" : ""}`}
        >
          {scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {qualityReport ? "Re-scan" : "Run Scan"}
        </button>
      </div>

      {/* Revision streaming */}
      {generating && streamContent && (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <p className="text-[12px] font-bold text-foreground">Revising document…</p>
            <span className="text-[10px] font-semibold text-terracotta flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" />
              Live
            </span>
          </div>
          <div ref={scrollRef} className="px-5 py-4 max-h-64 overflow-y-auto">
            <pre className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">
              {streamContent}
              <span className="inline-block w-0.5 h-3 bg-terracotta animate-pulse ml-0.5 align-middle" />
            </pre>
          </div>
        </div>
      )}

      {/* Quality issues */}
      {visibleIssues.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-[12px] font-bold text-foreground">Issues Found ({visibleIssues.length})</p>
          </div>
          <div className="divide-y divide-border/50">
            {allIssues.map((issue, i) => {
              const state = issueStates[i] ?? null;
              if (state === "done") return null;
              const isFixing = state === "fixing";
              const isFixed = state === "fixed";
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 px-4 py-3 transition-all duration-500 ${isFixed ? "bg-sage/10" : isFixing ? "bg-muted/40" : ""}`}
                  style={{ opacity: isFixed ? 0.7 : 1 }}
                >
                  {isFixing ? (
                    <Loader2 size={13} className="text-muted-foreground flex-shrink-0 mt-0.5 animate-spin" />
                  ) : isFixed ? (
                    <Check size={13} className="text-sage flex-shrink-0 mt-0.5" />
                  ) : issue.severity === "critical" ? (
                    <AlertCircle size={13} className="text-destructive flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    {issue.section && (
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{issue.section}</p>
                    )}
                    <p className={`text-[11px] font-semibold ${isFixed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {issue.description}
                    </p>
                    {issue.suggestion && !isFixed && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{issue.suggestion}</p>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0 transition-all ${
                    isFixed ? "bg-sage/20 text-sage" :
                    issue.severity === "critical" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                  }`}>{isFixed ? "fixed" : issue.severity}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Framework checks */}
      {frameworkChecks.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-[12px] font-bold text-foreground">Framework Verification</p>
          </div>
          <div className="divide-y divide-border/50">
            {frameworkChecks.map((fc, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold text-foreground">{fc.framework}</p>
                  <span className={`text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full ${
                    fc.completeness_score >= 90 ? "bg-sage/10 text-sage" :
                    fc.completeness_score >= 70 ? "bg-amber-500/10 text-amber-600" :
                    "bg-destructive/10 text-destructive"
                  }`}>{fc.completeness_score}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-1.5">{fc.section_title}</p>
                {fc.missing.length > 0 ? (
                  <div className="space-y-0.5">
                    {fc.missing.map((m, j) => (
                      <div key={j} className="flex items-center gap-1.5">
                        <AlertCircle size={10} className="text-destructive flex-shrink-0" />
                        <span className="text-[10px] text-destructive">{m}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Check size={10} className="text-sage" />
                    <span className="text-[10px] text-sage">All components present</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coherence issues */}
      {coherenceIssues.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <p className="text-[12px] font-bold text-foreground">Cross-Section Coherence</p>
            {overallCoherence && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                overallCoherence === "Strong" ? "bg-sage/10 text-sage" :
                overallCoherence === "Adequate" ? "bg-amber-500/10 text-amber-600" :
                "bg-destructive/10 text-destructive"
              }`}>{overallCoherence}</span>
            )}
          </div>
          <div className="divide-y divide-border/50">
            {coherenceIssues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2.5 px-4 py-3">
                {issue.severity === "critical"
                  ? <AlertCircle size={13} className="text-destructive flex-shrink-0 mt-0.5" />
                  : <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                }
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-foreground">{issue.description}</p>
                  {issue.sections_involved?.length > 0 && (
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <Link2 size={9} className="text-muted-foreground flex-shrink-0" />
                      {issue.sections_involved.map((t, j) => (
                        <span key={j} className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                  {issue.suggestion && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{issue.suggestion}</p>
                  )}
                </div>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                  issue.severity === "critical" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                }`}>{issue.severity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document preview (collapsible) */}
      {fullDocContent && (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowDoc(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
          >
            <FileText size={13} className="text-muted-foreground" />
            <p className="text-[12px] font-bold text-foreground flex-1">Document Preview</p>
            {showDoc ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
          </button>
          {showDoc && (
            <div className="px-5 py-4 border-t border-border/50 max-h-96 overflow-y-auto">
              <pre className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">
                {fullDocContent}
              </pre>
            </div>
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
          disabled={isProcessing || generating}
          className="flex-1 py-3 bg-foreground text-background rounded-xl text-[13px] font-bold hover:bg-foreground/85 transition-all active:scale-[0.97] disabled:opacity-40"
        >
          Export →
        </button>
      </div>
    </div>
  );
}
