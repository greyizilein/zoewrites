import { useState, useEffect } from "react";
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
  onBack?: () => void;
  onNext: () => void;
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
  "Generate title page with your details",
  "Generate hyperlinked Table of Contents",
  "Add page numbers",
  "Format reference list (hanging indent)",
  "Heading hierarchy & numbering check",
  "Assemble submission-ready .docx",
];

export default function StageSubmissionPrep({ assessmentTitle, totalWords, onExport, onDownloadImages, hasImages, isProcessing, onBack, onNext }: Props) {
  const [details, setDetails] = useState<SubmissionDetails>({
    fullName: "", studentId: "", institution: "", moduleCode: "",
    moduleName: "", academicYear: "", supervisor: "", submissionDate: "", company: "",
  });
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const update = (field: keyof SubmissionDetails, value: string) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  // Auto-run preparation on mount
  useEffect(() => {
    if (!running && !done) {
      setRunning(true);
    }
  }, []);

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 9 of 10</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Final Submission</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Fill your details and export the submission-ready document.</p>
      </div>

      {/* Download buttons — always visible at top */}
      <div className="space-y-2.5 mb-5">
        <div className="bg-sage/10 border border-sage/20 rounded-[10px] px-3.5 py-3">
          <p className="text-[13px] text-sage font-semibold">✓ Submission-ready · {totalWords.toLocaleString()} words</p>
        </div>
        <button
          onClick={onExport}
          disabled={isProcessing}
          className="w-full bg-foreground text-background rounded-[9px] py-3 flex items-center justify-center gap-2 text-[14px] font-bold hover:bg-foreground/90 transition-all active:scale-[0.97] disabled:opacity-50"
        >
          <Download size={16} /> Download .docx
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
      </div>

      <PersonalisePanel
        title="Document Formatting"
        fields={[
          { label: "Font", type: "select", options: ["Calibri 12pt", "Times New Roman 12pt", "Arial 11pt"], value: "Calibri 12pt" },
          { label: "Spacing", type: "select", options: ["1.5×", "Double (2.0×)"], value: "Double (2.0×)" },
          { label: "Page Size", type: "select", options: ["A4", "US Letter"], value: "A4" },
          { label: "Title Page", type: "toggle", checked: true, description: "Auto" },
          { label: "Page Numbers", type: "select", options: ["Bottom center", "Bottom right", "Top right"], value: "Bottom center" },
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
        <div className="px-3.5 py-2.5 bg-muted/50 border-b border-border text-[13px] sm:text-[14px] font-semibold">🎯 Final Preparation</div>
        <div className="p-3.5">
          <ChecklistAnimation items={prepChecks} running={running} onComplete={() => { setRunning(false); setDone(true); }} />
        </div>
      </div>

      <StickyFooter leftLabel="← Scan" onLeft={onBack} rightLabel="Manual Submission →" onRight={onNext} />
    </div>
  );
}
