import { useState } from "react";
import { Download, FileArchive } from "lucide-react";
import { Section } from "./types";

const FONT_OPTIONS = [
  "Arial 11pt", "Arial 12pt", "Calibri 11pt", "Calibri 12pt",
  "Times New Roman 12pt", "Georgia 12pt", "Garamond 12pt",
  "Cambria 12pt", "Palatino 12pt", "Verdana 11pt",
];

export interface SubmissionDetails {
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

interface Props {
  assessmentTitle: string;
  totalWords: number;
  onExport: (details?: SubmissionDetails, font?: string) => void;
  onDownloadImages?: () => void;
  hasImages?: boolean;
  isProcessing: boolean;
  onNext: () => void;
  sections?: Section[];
}

export default function StageSubmissionPrep({ assessmentTitle, totalWords, onExport, onDownloadImages, hasImages, isProcessing }: Props) {
  const [details, setDetails] = useState<SubmissionDetails>({
    fullName: "", studentId: "", institution: "", moduleCode: "",
    moduleName: "", academicYear: "", supervisor: "", submissionDate: "", company: "",
  });
  const [selectedFont, setSelectedFont] = useState("Calibri 12pt");

  const update = (field: keyof SubmissionDetails, value: string) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-[640px] mx-auto">
      {/* Header */}
      <div className="mb-5">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 7 of 7</p>
        <h1 className="text-[22px] font-bold tracking-tight mb-0.5">Export</h1>
        <p className="text-[13px] text-muted-foreground">Fill in your details, choose a font, and download.</p>
      </div>

      {/* Status + download */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 mb-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sage flex-shrink-0" />
          <p className="text-[13px] font-semibold text-foreground">
            Ready to export — {totalWords.toLocaleString()} words
          </p>
        </div>
        <button
          onClick={() => onExport(details, selectedFont)}
          disabled={isProcessing}
          className="w-full bg-foreground text-background rounded-xl py-3 flex items-center justify-center gap-2 text-[13px] font-bold hover:bg-foreground/85 transition-all active:scale-[0.97] disabled:opacity-50"
        >
          <Download size={15} />
          {isProcessing ? "Exporting…" : "Download .docx"}
        </button>
        {hasImages && onDownloadImages && (
          <button
            onClick={onDownloadImages}
            disabled={isProcessing}
            className="w-full border border-border rounded-xl py-2.5 flex items-center justify-center gap-2 text-[13px] font-semibold text-foreground hover:bg-muted/50 transition-all active:scale-[0.97] disabled:opacity-50"
          >
            <FileArchive size={15} /> Download Images (ZIP)
          </button>
        )}
      </div>

      {/* Font picker */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 mb-4 shadow-sm">
        <p className="text-[12px] font-bold text-foreground mb-3">Document Font</p>
        <div className="grid grid-cols-2 gap-2">
          {FONT_OPTIONS.map(f => (
            <button
              key={f}
              onClick={() => setSelectedFont(f)}
              className={`py-2 px-3 rounded-xl text-[11px] font-medium text-left transition-all ${
                selectedFont === f
                  ? "bg-terracotta text-white"
                  : "border border-border text-foreground hover:bg-muted/50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Submission details */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
        <p className="text-[12px] font-bold text-foreground mb-3">Submission Details <span className="text-muted-foreground font-normal">(optional — added to title page)</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            { label: "Full Name", field: "fullName" as const, placeholder: "Your name" },
            { label: "Student ID", field: "studentId" as const, placeholder: "B00123456" },
            { label: "Institution", field: "institution" as const, placeholder: "University of Manchester" },
            { label: "Module Code", field: "moduleCode" as const, placeholder: "BMAN71201" },
            { label: "Module Name", field: "moduleName" as const, placeholder: "Strategic Management" },
            { label: "Academic Year", field: "academicYear" as const, placeholder: "2024/2025" },
            { label: "Supervisor", field: "supervisor" as const, placeholder: "Dr. Sarah Chen" },
            { label: "Submission Date", field: "submissionDate" as const, placeholder: "", type: "date" },
            { label: "Company", field: "company" as const, placeholder: "Optional" },
          ].map(f => (
            <div key={f.field}>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">{f.label}</label>
              <input
                type={f.type || "text"}
                value={details[f.field]}
                onChange={e => update(f.field, e.target.value)}
                placeholder={f.placeholder}
                className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-terracotta/40 placeholder:text-muted-foreground/50"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
