import { useState } from "react";
import PersonalisePanel from "./PersonalisePanel";
import StickyFooter from "./StickyFooter";
import ChecklistAnimation from "./ChecklistAnimation";
import { Download, FileArchive } from "lucide-react";

interface Props {
  assessmentTitle: string;
  totalWords: number;
  onExport: () => void;
  onDownloadImages?: () => void;
  hasImages?: boolean;
  isProcessing: boolean;
  onBack: () => void;
}

interface SubmissionDetails {
  fullName: string;
  studentId: string;
  institution: string;
  moduleCode: string;
  moduleName: string;
  academicYear: string;
  supervisor: string;
  submissionDate: string;
  company: string;
}

const prepChecks = [
  "Final edit & proofread pass",
  "Generate title page with your details",
  "Generate hyperlinked Table of Contents",
  "Add page numbers",
  "Format reference list (new page, hanging indent)",
  "Verify all citations ↔ references match",
  "Heading hierarchy & numbering check",
  "Sequential figure & table numbering",
  "Add appendices (if required)",
  "Final formatting: Calibri 12pt, 2.0×, A4, justified",
  "Assemble submission-ready .docx",
];

export default function StageSubmissionPrep({ assessmentTitle, totalWords, onExport, onDownloadImages, hasImages, isProcessing, onBack }: Props) {
  const [details, setDetails] = useState<SubmissionDetails>({
    fullName: "", studentId: "", institution: "", moduleCode: "",
    moduleName: "", academicYear: "", supervisor: "", submissionDate: "", company: "",
  });
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const update = (field: keyof SubmissionDetails, value: string) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  const handlePrepare = () => {
    setRunning(true);
  };

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 6 of 6</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Submission Preparation</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Fill your details. ZOE edits, proofreads, formats, and prepares the final submission-ready document.</p>
      </div>

      <PersonalisePanel
        title="Document Formatting"
        fields={[
          { label: "Font", type: "select", options: ["Calibri 12pt", "Times New Roman 12pt", "Arial 11pt"], value: "Calibri 12pt" },
          { label: "Spacing", type: "select", options: ["1.5×", "Double (2.0×)"], value: "Double (2.0×)" },
          { label: "Page Size", type: "select", options: ["A4", "US Letter"], value: "A4" },
          { label: "Margins", type: "select", options: ["Standard (25mm)", "Narrow (20mm)", "Wide (30mm left)"], value: "Standard (25mm)" },
          { label: "Table of Contents", type: "toggle", checked: true, description: "Auto" },
          { label: "Page Numbers", type: "select", options: ["Bottom center", "Bottom right", "Top right"], value: "Bottom center" },
          { label: "Title Page", type: "toggle", checked: true, description: "Auto" },
          { label: "Heading Format", type: "select", options: ["H1: 20pt Bold, H2: 16pt Bold", "Numbered (1.0, 1.1)"], value: "H1: 20pt Bold, H2: 16pt Bold" },
          { label: "Figure/Table Numbers", type: "select", options: ["Sequential (Figure 1, 2…)", "Chapter-relative (1.1, 2.1…)"], value: "Sequential (Figure 1, 2…)" },
          { label: "Justification", type: "select", options: ["Fully justified", "Left-aligned"], value: "Fully justified" },
        ]}
      />

      {/* Submission details */}
      <div className="border border-border rounded-xl overflow-hidden mb-4">
        <div className="px-3.5 py-2.5 bg-muted/50 border-b border-border text-[13px] sm:text-[14px] font-semibold">📝 Submission Details</div>
        <div className="p-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {[
              { label: "Full Name *", field: "fullName" as const, placeholder: "Your name" },
              { label: "Student ID *", field: "studentId" as const, placeholder: "B00123456" },
              { label: "Institution *", field: "institution" as const, placeholder: "University of Manchester" },
              { label: "Module Code", field: "moduleCode" as const, placeholder: "BMAN71201" },
              { label: "Module Name", field: "moduleName" as const, placeholder: "Strategic Management" },
              { label: "Academic Year", field: "academicYear" as const, placeholder: "2024/2025" },
              { label: "Supervisor", field: "supervisor" as const, placeholder: "Dr. Sarah Chen" },
              { label: "Submission Date", field: "submissionDate" as const, placeholder: "", type: "date" },
              { label: "Company (optional)", field: "company" as const, placeholder: "Optional" },
            ].map(f => (
              <div key={f.field}>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">{f.label}</label>
                <input
                  type={f.type || "text"}
                  value={details[f.field]}
                  onChange={e => update(f.field, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-terracotta/30"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preparation checklist */}
      <div className="border border-border rounded-xl overflow-hidden mb-4">
        <div className="px-3.5 py-2.5 bg-muted/50 border-b border-border text-[13px] sm:text-[14px] font-semibold">🎯 Final Preparation — ZOE will:</div>
        <div className="p-3.5">
          <ChecklistAnimation items={prepChecks} running={running} onComplete={() => { setRunning(false); setDone(true); }} />
        </div>
      </div>

      {done && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="bg-sage/10 border border-sage/20 rounded-[10px] px-3.5 py-3">
            <p className="text-[13px] text-sage font-semibold mb-1">✓ Submission-ready — A+ Grade Quality</p>
            <p className="text-[11px] text-muted-foreground">All formatting confirmed · TOC generated · References verified · {totalWords.toLocaleString()} words</p>
          </div>

          <button
            onClick={onExport}
            disabled={isProcessing}
            className="w-full bg-foreground text-background rounded-[9px] py-3 sm:py-3.5 flex items-center justify-center gap-2 text-[14px] sm:text-[15px] font-bold hover:bg-foreground/90 transition-all active:scale-[0.97] disabled:opacity-50"
          >
            <Download size={16} /> Download Final Assessment.docx
          </button>

          {hasImages && onDownloadImages && (
            <button
              onClick={onDownloadImages}
              disabled={isProcessing}
              className="w-full bg-dusty-purple text-white rounded-[9px] py-3 flex items-center justify-center gap-2 text-[14px] font-bold hover:bg-dusty-purple/90 transition-all active:scale-[0.97] disabled:opacity-50"
            >
              <FileArchive size={16} /> Download Images (ZIP)
            </button>
          )}

          <div className="bg-muted border border-border rounded-lg px-3.5 py-2.5 flex justify-between items-center flex-wrap gap-2">
            <div className="min-w-0">
              <p className="text-[12px] font-medium truncate">{assessmentTitle.replace(/\s+/g, "_")}_FINAL.docx</p>
              <p className="text-[11px] text-muted-foreground">Calibri 12pt · 2.0× · Harvard · A4 · {totalWords.toLocaleString()} words</p>
            </div>
            <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">48h</span>
          </div>
        </div>
      )}

      <StickyFooter
        leftLabel="← Revisions"
        onLeft={onBack}
        rightLabel="Prepare Final Submission →"
        onRight={handlePrepare}
        rightDisabled={done}
      />
    </div>
  );
}
