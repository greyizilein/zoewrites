import { useState } from "react";
import PersonalisePanel from "./PersonalisePanel";
import StickyFooter from "./StickyFooter";
import ChecklistAnimation from "./ChecklistAnimation";

interface Props {
  onRunCritique: () => Promise<any>;
  qualityReport: any;
  totalWords: number;
  totalTarget: number;
  onBack: () => void;
  onRevisions: () => void;
  onSubmit: () => void;
  onAutoRevise?: (feedback: string) => void;
}

const critiqueChecks = [
  "Evaluating A+ criteria — section by section",
  "Argument quality: descriptive vs evaluative",
  "Citation audit & reference matching",
  "Framework application verification",
  "Word count ±50 of target",
  "Banned AI phrase scan",
  "Formatting & heading audit",
  "Reference list completeness",
  "Brief compliance check",
  "Humanisation & AI-pattern scoring",
];

function compileIssuesFeedback(qualityReport: any): string {
  if (!qualityReport?.report?.issues?.length && !qualityReport?.report?.brief_compliance?.length) return "";
  const lines: string[] = [];

  // Brief compliance failures
  const briefIssues = (qualityReport.report.brief_compliance || []).filter(
    (b: any) => b.status !== "fully_met"
  );
  if (briefIssues.length > 0) {
    lines.push("BRIEF COMPLIANCE ISSUES:");
    for (const b of briefIssues) {
      lines.push(`- ${b.requirement}: ${b.detail}`);
    }
    lines.push("");
  }

  // Content issues
  const issues = qualityReport.report.issues || [];
  if (issues.length > 0) {
    lines.push("CONTENT ISSUES TO FIX:");
    for (const issue of issues) {
      const section = issue.section ? `[${issue.section}] ` : "";
      lines.push(`- ${section}(${issue.severity}) ${issue.description}`);
      if (issue.suggestion) lines.push(`  → Fix: ${issue.suggestion}`);
    }
  }

  return lines.join("\n");
}

export default function StageSelfCritique({ onRunCritique, qualityReport, totalWords, totalTarget, onBack, onRevisions, onSubmit, onAutoRevise }: Props) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(!!qualityReport);
  const [error, setError] = useState<string | null>(null);
  const [apiDone, setApiDone] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setApiDone(false);
    setDone(false);
    try {
      await onRunCritique();
      setApiDone(true);
    } catch (e: any) {
      setError(e.message || "Critique failed");
      setRunning(false);
    }
  };

  const handleChecklistComplete = () => {
    setRunning(false);
    if (!error && apiDone) setDone(true);
  };

  const handleFixAll = () => {
    if (!qualityReport || !onAutoRevise) return;
    const feedback = compileIssuesFeedback(qualityReport);
    if (feedback) {
      onAutoRevise(feedback);
    }
  };

  const issueCount = (qualityReport?.report?.issues?.length || 0) +
    (qualityReport?.report?.brief_compliance || []).filter((b: any) => b.status !== "fully_met").length;

  return (
    <div className="max-w-[560px] mx-auto">
      <div className="mb-6 text-center">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 4 of 6</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Self-Critique & Correction</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Reviewing against A+ criteria and correcting every gap.</p>
      </div>

      <PersonalisePanel
        title="Critique Settings"
        fields={[
          { label: "Critique Depth", type: "select", options: ["Standard", "Full", "Deep (2-pass)"], value: "Full" },
          { label: "Word Count Tolerance", type: "select", options: ["±50 words", "±25 words", "Exact"], value: "±50 words" },
          { label: "AI-Pattern Rewrite", type: "toggle", checked: true, description: "Auto-fix < 6" },
          { label: "Proofreading", type: "toggle", checked: true, description: "Full pass" },
          { label: "Editing Level", type: "select", options: ["Light (grammar only)", "Standard", "Heavy (restructure)"], value: "Standard" },
        ]}
      />

      <div className="border border-border rounded-xl p-4 mb-4">
        <ChecklistAnimation items={critiqueChecks} running={running} onComplete={handleChecklistComplete} apiDone={apiDone} />
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-[10px] px-3.5 py-3 mb-4">
          <span className="text-[13px] text-destructive font-medium">✗ {error}</span>
        </div>
      )}

      {!running && !done && (
        <button onClick={handleRun} className="w-full py-3 bg-foreground text-background rounded-[10px] font-bold text-[14px] hover:bg-foreground/90 transition-all active:scale-[0.97]">
          Run Self-Critique
        </button>
      )}

      {running && (
        <div className="w-full py-3 bg-terracotta text-white rounded-[10px] font-bold text-[14px] text-center animate-pulse">
          Running critique…
        </div>
      )}

      {done && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="bg-sage/10 border border-sage/20 rounded-[10px] px-3.5 py-3">
            <span className="text-[13px] text-sage font-medium">✓ Word count: <strong className="font-mono">{totalWords.toLocaleString()} / {totalTarget.toLocaleString()}</strong> — within ±1%</span>
          </div>
          <div className="bg-terracotta/10 border border-terracotta/20 rounded-[10px] px-3.5 py-3">
            <span className="text-[13px] text-terracotta font-medium">Grade: <strong className="font-mono">{qualityReport?.report?.overall_grade || "—"}</strong> · {qualityReport?.report?.issues?.length || 0} issues found</span>
          </div>
          <div className="bg-dusty-purple/10 border border-dusty-purple/20 rounded-[10px] px-3.5 py-3">
            <span className="text-[13px] text-dusty-purple font-medium">{qualityReport?.pre_check?.banned_phrases?.length || 0} banned phrases detected</span>
          </div>

          {/* Brief compliance results */}
          {qualityReport?.report?.brief_compliance && qualityReport.report.brief_compliance.length > 0 && (
            <div className="border border-border rounded-[10px] overflow-hidden">
              <div className="bg-muted px-3.5 py-2 border-b border-border">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Brief Compliance</span>
              </div>
              <div className="divide-y divide-border">
                {qualityReport.report.brief_compliance.map((item: any, i: number) => (
                  <div key={i} className="px-3.5 py-2.5 flex items-start gap-2">
                    <span className={`text-[13px] mt-0.5 ${item.status === "fully_met" ? "text-sage" : item.status === "partially_met" ? "text-terracotta" : "text-destructive"}`}>
                      {item.status === "fully_met" ? "✓" : item.status === "partially_met" ? "◐" : "✗"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate">{item.requirement}</p>
                      <p className="text-[11px] text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues list */}
          {qualityReport?.report?.issues && qualityReport.report.issues.length > 0 && (
            <div className="border border-border rounded-[10px] overflow-hidden">
              <div className="bg-muted px-3.5 py-2 border-b border-border">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Issues</span>
              </div>
              <div className="divide-y divide-border max-h-[200px] overflow-y-auto">
                {qualityReport.report.issues.map((issue: any, i: number) => (
                  <div key={i} className="px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase ${issue.severity === "critical" ? "text-destructive" : issue.severity === "major" ? "text-terracotta" : "text-muted-foreground"}`}>{issue.severity}</span>
                      {issue.section && <span className="text-[10px] text-muted-foreground">· {issue.section}</span>}
                    </div>
                    <p className="text-[12px]">{issue.description}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">→ {issue.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fix All Issues button */}
          {issueCount > 0 && onAutoRevise && (
            <button
              onClick={handleFixAll}
              className="w-full py-3 bg-terracotta text-white rounded-[10px] font-bold text-[14px] hover:bg-terracotta/90 transition-all active:scale-[0.97]"
            >
              🔧 Fix All {issueCount} Issues → Revision Stage
            </button>
          )}
        </div>
      )}

      <StickyFooter
        leftLabel="← Sections"
        onLeft={onBack}
        rightLabel="Submit →"
        onRight={onSubmit}
        middleContent={done ? (
          <button onClick={onRevisions} className="px-4 py-2 text-[13px] border border-border rounded-lg hover:bg-muted transition-colors active:scale-[0.97]">Revisions</button>
        ) : undefined}
      />
    </div>
  );
}
