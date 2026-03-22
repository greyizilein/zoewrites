import { useState, useMemo } from "react";
import { Trash2, Plus, ChevronDown, Check, X } from "lucide-react";
import PersonalisePanel from "./PersonalisePanel";
import StickyFooter from "./StickyFooter";
import { WriterSettings, aiModels } from "./types";

interface PlanSection {
  title: string;
  word_target: number;
  citation_count: number;
  framework: string;
  a_plus_criteria: string;
  purpose_scope: string;
  learning_outcomes: string;
  required_inputs: string;
  structure_formatting: string;
  constraints: string;
  suggested_frameworks: string[];
  sort_order: number;
}

interface Props {
  plan: any;
  onPlanChange: (plan: any) => void;
  settings: WriterSettings;
  onBack: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

const FIELD_LABELS: { key: string; label: string }[] = [
  { key: "purpose_scope", label: "Purpose & Scope" },
  { key: "learning_outcomes", label: "Learning Outcomes" },
  { key: "required_inputs", label: "Required Inputs" },
  { key: "structure_formatting", label: "Structure & Formatting" },
  { key: "a_plus_criteria", label: "A+ Criteria" },
  { key: "constraints", label: "Constraints" },
];

export default function StageExecutionTable({ plan, onPlanChange, settings, onBack, onConfirm, isProcessing }: Props) {
  const sections: PlanSection[] = (plan?.sections || []).map((s: any) => ({
    title: s.title || "",
    word_target: s.word_target || 0,
    citation_count: s.citation_count || 0,
    framework: s.framework || "",
    a_plus_criteria: s.a_plus_criteria || "",
    purpose_scope: s.purpose_scope || "",
    learning_outcomes: s.learning_outcomes || "",
    required_inputs: s.required_inputs || "",
    structure_formatting: s.structure_formatting || "",
    constraints: s.constraints || "",
    suggested_frameworks: s.suggested_frameworks || [],
    sort_order: s.sort_order ?? 0,
  }));

  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const updateSection = (idx: number, field: string, value: any) => {
    const updated = [...sections];
    if (field === "word_target" || field === "citation_count") {
      const num = Math.round(Number(value));
      updated[idx] = { ...updated[idx], [field]: isNaN(num) ? 0 : num };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    onPlanChange({ ...plan, sections: updated, total_words: updated.reduce((a, s) => a + (Math.round(Number(s.word_target)) || 0), 0) });
  };

  const removeSection = (idx: number) => {
    const updated = sections.filter((_, i) => i !== idx);
    onPlanChange({ ...plan, sections: updated, total_words: updated.reduce((a, s) => a + (Math.round(Number(s.word_target)) || 0), 0) });
    if (expandedIdx === idx) setExpandedIdx(null);
    else if (expandedIdx !== null && expandedIdx > idx) setExpandedIdx(expandedIdx - 1);
  };

  const acceptFramework = (sectionIdx: number, fw: string) => {
    const updated = [...sections];
    const sec = { ...updated[sectionIdx] };
    sec.framework = sec.framework ? `${sec.framework}, ${fw}` : fw;
    sec.suggested_frameworks = sec.suggested_frameworks.filter(f => f !== fw);
    updated[sectionIdx] = sec;
    onPlanChange({ ...plan, sections: updated });
  };

  const rejectFramework = (sectionIdx: number, fw: string) => {
    const updated = [...sections];
    updated[sectionIdx] = { ...updated[sectionIdx], suggested_frameworks: updated[sectionIdx].suggested_frameworks.filter(f => f !== fw) };
    onPlanChange({ ...plan, sections: updated });
  };

  const addSection = () => {
    const newSec: PlanSection = {
      title: "New Section", word_target: 300, citation_count: 3, framework: "",
      a_plus_criteria: "", purpose_scope: "", learning_outcomes: "", required_inputs: "",
      structure_formatting: "", constraints: "", suggested_frameworks: [], sort_order: sections.length,
    };
    onPlanChange({ ...plan, sections: [...sections, newSec], total_words: (plan?.total_words || 0) + 300 });
    setExpandedIdx(sections.length);
  };

  const totalWords = sections.reduce((a, s) => a + (Math.round(Number(s.word_target)) || 0), 0);

  const DETAIL_KEYS = ["purpose_scope", "learning_outcomes", "required_inputs", "structure_formatting", "a_plus_criteria", "constraints"] as const;

  const getFieldScore = (row: PlanSection) => {
    let filled = 0;
    for (const k of DETAIL_KEYS) if ((row as any)[k]?.trim()) filled++;
    return filled;
  };

  const overallProgress = useMemo(() => {
    const total = sections.length * DETAIL_KEYS.length;
    const filled = sections.reduce((a, s) => a + getFieldScore(s), 0);
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  }, [sections]);

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 2 of 6</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Execution Table</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Your detailed blueprint. Every field is editable. Confirm to begin writing.</p>

        {/* Overall progress bar */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <span className="text-[11px] font-mono font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
            {overallProgress}% detailed
          </span>
        </div>
      </div>

      <PersonalisePanel
        title="Personalise Plan"
        fields={[
          { label: "Framework Depth", type: "select", options: ["Overview", "Standard", "Deep Critical"], value: "Standard" },
          { label: "Visual Outputs", type: "toggle", checked: true, description: "Auto-generate" },
          { label: "Code Required", type: "toggle", checked: false, description: "Include code" },
          { label: "Tables Required", type: "toggle", checked: true, description: "Auto" },
        ]}
      />

      {plan?.role_context && (
        <div className="bg-muted border border-border rounded-[10px] px-3.5 py-3 mb-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Role</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{plan.role_context}</p>
        </div>
      )}

      {/* Section Cards */}
      <div className="space-y-2.5 mb-3.5">
        {sections.map((row, i) => {
          const isExpanded = expandedIdx === i;
          const score = getFieldScore(row);
          const isComplete = score === DETAIL_KEYS.length;
          return (
            <div key={i} className={`border rounded-xl overflow-hidden bg-card transition-shadow hover:shadow-sm ${isComplete ? "border-primary/30" : "border-border"}`}>
              {/* Header */}
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full px-4 py-3 flex items-center gap-2 hover:bg-muted/30 transition-colors"
              >
                <span className="flex-1 text-left min-w-0">
                  <span className="text-[14px] font-medium block truncate">{row.title}</span>
                  <span className="flex gap-1.5 flex-wrap mt-1 items-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${isComplete ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {score}/{DETAIL_KEYS.length}
                    </span>
                    <span className="font-mono font-semibold text-primary text-[11px]">{row.word_target}w</span>
                    <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">{row.citation_count} cit.</span>
                    {row.framework && <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent-foreground text-[10px]">{row.framework}</span>}
                    {row.suggested_frameworks.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-terracotta/15 text-terracotta text-[10px]">
                        {row.suggested_frameworks.length} suggested
                      </span>
                    )}
                  </span>
                </span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-border space-y-3 animate-in fade-in duration-150">
                  {/* Title + basic fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Title</label>
                      <input value={row.title} onChange={e => updateSection(i, "title", e.target.value)}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[13px] mt-1 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Words</label>
                      <input type="number" value={row.word_target} onChange={e => updateSection(i, "word_target", Number(e.target.value))}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[13px] font-mono mt-1 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Citations</label>
                      <input type="number" value={row.citation_count} onChange={e => updateSection(i, "citation_count", Number(e.target.value))}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[13px] mt-1 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    </div>
                  </div>

                  {/* Framework */}
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Framework (from brief)</label>
                    <input value={row.framework} onChange={e => updateSection(i, "framework", e.target.value)} placeholder="Only if brief specifies"
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[13px] mt-1 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>

                  {/* Suggested Frameworks */}
                  {row.suggested_frameworks.length > 0 && (
                    <div>
                      <label className="text-[10px] font-semibold text-terracotta uppercase tracking-wider">ZOE Suggests</label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {row.suggested_frameworks.map((fw, fi) => (
                          <span key={fi} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-terracotta/10 border border-terracotta/20 text-[11px] text-terracotta">
                            {fw}
                            <button onClick={() => acceptFramework(i, fw)} className="hover:text-primary transition-colors" title="Accept">
                              <Check size={12} />
                            </button>
                            <button onClick={() => rejectFramework(i, fw)} className="hover:text-destructive transition-colors" title="Reject">
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detailed fields */}
                  {FIELD_LABELS.map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
                      <textarea
                        value={(row as any)[key] || ""}
                        onChange={e => updateSection(i, key, e.target.value)}
                        placeholder={`Detailed ${label.toLowerCase()} for this section…`}
                        rows={3}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[12px] mt-1 resize-y focus:outline-none focus:ring-1 focus:ring-primary/30 leading-relaxed"
                      />
                    </div>
                  ))}

                  <button onClick={() => removeSection(i)} className="flex items-center gap-1.5 text-[12px] text-destructive hover:underline">
                    <Trash2 size={12} /> Remove section
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add section + summary */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <button onClick={addSection} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-muted-foreground border border-dashed border-border rounded-lg hover:border-primary/30 hover:text-foreground transition-colors active:scale-[0.97]">
          <Plus size={13} /> Add Section
        </button>
        <div className="flex items-center gap-4 text-[12px] text-muted-foreground flex-wrap">
          <span>Total: <span className="font-semibold text-foreground font-mono tabular-nums">{totalWords.toLocaleString()}</span> words</span>
          <span><span className="font-semibold text-foreground">{sections.length}</span> sections</span>
          <span>Model: <span className="font-semibold text-foreground">{aiModels.find(m => m.id === settings.model)?.name || settings.model}</span></span>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap mt-3">
        {["✓ ±1% word count", "✓ No bullet points", `✓ ${settings.citationStyle}`, "✓ Every claim cited", "✓ No AI phrases"].map(c => (
          <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent/10 text-[11px] text-accent-foreground font-medium">{c}</span>
        ))}
      </div>

      <StickyFooter
        leftLabel="← Re-analyse"
        onLeft={onBack}
        rightLabel="Confirm → Write"
        onRight={onConfirm}
        rightLoading={isProcessing}
      />
    </div>
  );
}
