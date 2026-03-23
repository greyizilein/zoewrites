import { useState, useEffect } from "react";
import {
  Loader2, Check, AlertTriangle, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Wrench, Send, Image, Table2, Plus,
  Link2,
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

// State per issue: null=visible, "fixing"=in-progress, "fixed"=green, "done"=dismissed
type IssueState = null | "fixing" | "fixed" | "done";

interface Props {
  sections: Section[];
  qualityReport: any;
  coherenceReport: any;
  isProcessing: boolean;
  onRunScan: () => Promise<any>;
  onFixAllIssues: (customInstructions?: string) => Promise<void>;
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
  sections, qualityReport, coherenceReport, isProcessing, onRunScan,
  onFixAllIssues, onApplySectionFeedback, onBack, onNext,
}: Props) {
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [sectionFeedback, setSectionFeedback] = useState<Record<string, string>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [issueStates, setIssueStates] = useState<IssueState[]>([]);
  const [addContentSectionId, setAddContentSectionId] = useState<string | null>(null);
  const [addContentType, setAddContentType] = useState<"table" | "figure" | null>(null);
  const [addContentDesc, setAddContentDesc] = useState("");
  const [applyingContent, setApplyingContent] = useState(false);

  const report = qualityReport?.report;
  const grade = report?.overall_grade || report?.grade || null;
  const allIssues: Issue[] = report?.issues || [];
  const frameworkChecks: FrameworkCheck[] = report?.framework_checks || [];
  const coherenceIssues: CoherenceIssue[] = coherenceReport?.issues || [];
  const overallCoherence: string | null = coherenceReport?.overall_coherence || null;

  // Sync issueStates when qualityReport changes (fresh scan)
  useEffect(() => {
    setIssueStates(allIssues.map(() => null));
  }, [qualityReport]);

  const visibleIssues = allIssues.filter((_, i) => issueStates[i] !== "done");
  const criticalCount = visibleIssues.filter(i => i.severity === "critical").length
    + coherenceIssues.filter(i => i.severity === "critical").length;
  const warningCount = visibleIssues.filter(i => i.severity === "major" || i.severity === "warning").length
    + coherenceIssues.filter(i => i.severity === "major" || i.severity === "minor").length;

  const totalWords = sections.reduce((a, s) => a + s.word_current, 0);
  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0);
  const progress = totalTarget > 0 ? Math.round((totalWords / totalTarget) * 100) : 0;

  const handleScan = async () => {
    setScanning(true);
    setIssueStates([]);
    try { await onRunScan(); } finally { setScanning(false); }
  };

  const animateFix = (indices: number[]) => {
    // Step 1: set all to "fixing"
    setIssueStates(prev => {
      const next = [...prev];
      indices.forEach(i => { next[i] = "fixing"; });
      return next;
    });
  };

  const animateFixed = (indices: number[]) => {
    // Step 2: set to "fixed" (green)
    setIssueStates(prev => {
      const next = [...prev];
      indices.forEach(i => { next[i] = "fixed"; });
      return next;
    });
    // Step 3: after 1.2s, dismiss
    setTimeout(() => {
      setIssueStates(prev => {
        const next = [...prev];
        indices.forEach(i => { next[i] = "done"; });
        return next;
      });
    }, 1200);
  };

  const handleFixAll = async () => {
    const indicesToFix = allIssues
      .map((_, i) => i)
      .filter(i => issueStates[i] !== "done");
    animateFix(indicesToFix);
    setFixing(true);
    try {
      await onFixAllIssues(customInstructions || undefined);
      animateFixed(indicesToFix);
      if (customInstructions) setCustomInstructions("");
    } finally {
      setFixing(false);
    }
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

  const handleAddContent = async (sectionId: string) => {
    if (!addContentType || !addContentDesc.trim()) return;
    const instruction = addContentType === "table"
      ? `Add a formatted markdown table to this section: ${addContentDesc}. Place it at the most analytically appropriate point in the section. Add a caption above: "Table X: [title]".`
      : `Add a figure placeholder to this section: ${addContentDesc}. Write the placeholder as [FIGURE X: ${addContentDesc} — ${addContentDesc}] and follow with caption "Figure X: [descriptive title]". Embed it at the most analytically relevant point.`;
    setApplyingContent(true);
    try {
      await onApplySectionFeedback(sectionId, instruction);
      setAddContentSectionId(null);
      setAddContentType(null);
      setAddContentDesc("");
    } finally {
      setApplyingContent(false);
    }
  };

  return (
    <div className="max-w-[640px] mx-auto">
      {/* Header */}
      <div className="mb-5">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 3 of 4</p>
        <h1 className="text-[22px] font-bold tracking-tight mb-0.5">Review</h1>
        <p className="text-[13px] text-muted-foreground">Check your draft, fix issues, and refine before export.</p>
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

      {/* Custom instructions */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 mb-4 shadow-sm">
        <p className="text-[12px] font-bold text-foreground mb-2">Additional Instructions</p>
        <p className="text-[10px] text-muted-foreground mb-2.5">Tell ZOE what else to fix or improve across all sections. These will be applied alongside any scan issues.</p>
        <textarea
          value={customInstructions}
          onChange={e => setCustomInstructions(e.target.value)}
          placeholder="e.g. Add more statistics. Ensure all framework criteria are fully covered. Strengthen the conclusion argument…"
          rows={3}
          className="w-full text-[12px] bg-muted/40 border border-border rounded-xl px-3 py-2.5 resize-none placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-terracotta/40"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2.5 mb-4">
        {(visibleIssues.length > 0 || customInstructions.trim()) && (
          <button
            onClick={handleFixAll}
            disabled={fixing || isProcessing}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-terracotta text-white rounded-xl text-[13px] font-bold hover:bg-terracotta/90 transition-all active:scale-[0.97] disabled:opacity-50 shadow-sm"
          >
            {fixing ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
            {customInstructions.trim() && visibleIssues.length > 0
              ? "Fix All + Apply Instructions"
              : customInstructions.trim()
                ? "Apply Instructions"
                : "Fix All Issues"}
          </button>
        )}
        <button
          onClick={handleScan}
          disabled={scanning || isProcessing}
          className={`flex items-center justify-center gap-1.5 py-3 px-4 border border-border rounded-xl text-[13px] font-semibold text-foreground hover:bg-muted/50 transition-all active:scale-[0.97] disabled:opacity-50 ${!visibleIssues.length && !customInstructions.trim() ? "flex-1" : ""}`}
        >
          {scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {qualityReport ? "Re-scan" : "Run Scan"}
        </button>
      </div>

      {/* Issues list with animation */}
      {visibleIssues.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden mb-4">
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
                  className={`flex items-start gap-2.5 px-4 py-3 transition-all duration-500 ${
                    isFixed ? "bg-sage/10" : isFixing ? "bg-muted/40" : ""
                  }`}
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
                  }`}>
                    {isFixed ? "fixed" : issue.severity}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Framework checks */}
      {frameworkChecks.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-[12px] font-bold text-foreground">Framework Verification</p>
          </div>
          <div className="divide-y divide-border/50">
            {frameworkChecks.map((fc, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-semibold text-foreground">{fc.framework}</p>
                  <span className={`text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full ${
                    fc.completeness_score >= 90 ? "bg-sage/10 text-sage" :
                    fc.completeness_score >= 70 ? "bg-amber-500/10 text-amber-600" :
                    "bg-destructive/10 text-destructive"
                  }`}>{fc.completeness_score}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-1.5">{fc.section_title}</p>
                {fc.missing.length > 0 && (
                  <div className="space-y-0.5">
                    {fc.missing.map((m, j) => (
                      <div key={j} className="flex items-center gap-1.5">
                        <AlertCircle size={10} className="text-destructive flex-shrink-0" />
                        <span className="text-[10px] text-destructive">{m}</span>
                      </div>
                    ))}
                  </div>
                )}
                {fc.missing.length === 0 && (
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
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden mb-4">
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
                  {issue.sections_involved.length > 0 && (
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
          const showAddContent = addContentSectionId === s.id;

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
                <div className="px-4 pb-4 space-y-3 border-t border-border/30">
                  {/* Content preview */}
                  {s.content && (
                    <div className="bg-muted/40 rounded-xl p-3 max-h-44 overflow-y-auto mt-3">
                      <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {s.content.slice(0, 800)}{s.content.length > 800 ? "…" : ""}
                      </p>
                    </div>
                  )}

                  {/* Custom feedback for this section */}
                  <div className="flex gap-2">
                    <textarea
                      value={sectionFeedback[s.id] || ""}
                      onChange={e => setSectionFeedback(prev => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="Add specific revision instructions for this section…"
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

                  {/* Add content (table or figure) */}
                  <div>
                    <button
                      onClick={() => {
                        setAddContentSectionId(showAddContent ? null : s.id);
                        setAddContentType(null);
                        setAddContentDesc("");
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus size={12} /> Add table or figure to this section
                    </button>

                    {showAddContent && (
                      <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setAddContentType("table")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${addContentType === "table" ? "bg-terracotta text-white border-terracotta" : "border-border text-muted-foreground hover:border-terracotta/30"}`}
                          >
                            <Table2 size={12} /> Table
                          </button>
                          <button
                            onClick={() => setAddContentType("figure")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${addContentType === "figure" ? "bg-terracotta text-white border-terracotta" : "border-border text-muted-foreground hover:border-terracotta/30"}`}
                          >
                            <Image size={12} /> Figure
                          </button>
                        </div>
                        {addContentType && (
                          <div className="flex gap-2">
                            <input
                              value={addContentDesc}
                              onChange={e => setAddContentDesc(e.target.value)}
                              placeholder={addContentType === "table" ? "e.g. Comparison of PESTLE factors with impact ratings" : "e.g. Porter's Five Forces diagram for industry X"}
                              className="flex-1 text-[11px] bg-muted/40 border border-border rounded-xl px-3 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-terracotta/40"
                            />
                            <button
                              onClick={() => handleAddContent(s.id)}
                              disabled={!addContentDesc.trim() || applyingContent}
                              className="flex-shrink-0 px-3 py-2 bg-terracotta text-white rounded-xl text-[11px] font-bold hover:bg-terracotta/90 disabled:opacity-40 active:scale-[0.97] transition-all"
                            >
                              {applyingContent ? <Loader2 size={12} className="animate-spin" /> : "Add"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
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
