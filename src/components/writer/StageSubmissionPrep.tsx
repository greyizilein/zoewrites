import { useState, useEffect } from "react";
import PersonalisePanel from "./PersonalisePanel";
import StickyFooter from "./StickyFooter";
import ChecklistAnimation from "./ChecklistAnimation";
import { Download, FileArchive, Eye, EyeOff } from "lucide-react";
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
  onBack?: () => void;
  onNext: () => void;
  sections?: Section[];
}

const prepChecks = [
  "Generate title page with your details",
  "Generate hyperlinked Table of Contents",
  "Add page numbers",
  "Format reference list (hanging indent)",
  "Heading hierarchy & numbering check",
  "Assemble submission-ready .docx",
];

export default function StageSubmissionPrep({ assessmentTitle, totalWords, onExport, onDownloadImages, hasImages, isProcessing, onBack, onNext, sections }: Props) {
  const [details, setDetails] = useState<SubmissionDetails>({
    fullName: "", studentId: "", institution: "", moduleCode: "",
    moduleName: "", academicYear: "", supervisor: "", submissionDate: "", company: "",
  });
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedFont, setSelectedFont] = useState("Calibri 12pt");
  const [showPreview, setShowPreview] = useState(false);

  const update = (field: keyof SubmissionDetails, value: string) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (!running && !done) setRunning(true);
  }, []);

  const fontFamily = selectedFont.split(" ")[0];
  const fontSize = selectedFont.includes("11pt") ? "11pt" : "12pt";

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 9 of 10</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Final Submission</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Fill your details and export the submission-ready document.</p>
      </div>

      {/* Download buttons — always visible */}
      <div className="space-y-2.5 mb-5">
        <div className="bg-sage/10 border border-sage/20 rounded-[10px] px-3.5 py-3">
          <p className="text-[13px] text-sage font-semibold">✓ Submission-ready · {totalWords.toLocaleString()} words</p>
        </div>
        <button
          onClick={() => onExport(details, selectedFont)}
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

      {/* Font & Formatting */}
      <PersonalisePanel
        title="Document Formatting"
        fields={[
          { label: "Font", type: "select", options: FONT_OPTIONS, value: selectedFont, key: "font" },
          { label: "Spacing", type: "select", options: ["1.5×", "Double (2.0×)"], value: "Double (2.0×)" },
          { label: "Page Size", type: "select", options: ["A4", "US Letter"], value: "A4" },
          { label: "Title Page", type: "toggle", checked: true, description: "Auto" },
          { label: "Page Numbers", type: "select", options: ["Bottom center", "Bottom right", "Top right"], value: "Bottom center" },
        ]}
        onApply={(values) => {
          if (values.font) setSelectedFont(values.font as string);
        }}
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

      {/* Live document preview toggle */}
      <div className="border border-border rounded-xl overflow-hidden mb-4">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="w-full px-3.5 py-2.5 bg-muted/50 border-b border-border text-[13px] sm:text-[14px] font-semibold flex items-center gap-2 hover:bg-muted transition-colors"
        >
          {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
          {showPreview ? "Hide Preview" : "Preview Document"}
        </button>
        {showPreview && sections && (
          <div
            className="p-6 sm:p-8 max-h-[50vh] overflow-y-auto bg-white text-black"
            style={{ fontFamily, fontSize, textAlign: "justify", lineHeight: "2" }}
          >
            {/* Title page preview */}
            <div className="text-center mb-8 pb-8 border-b border-gray-300">
              <h1 className="text-[24px] font-bold mb-4" style={{ fontFamily }}>{assessmentTitle}</h1>
              {details.fullName && <p className="text-[14px] mb-1">{details.fullName}</p>}
              {details.studentId && <p className="text-[14px] mb-1">Student ID: {details.studentId}</p>}
              {details.institution && <p className="text-[14px] mb-1">{details.institution}</p>}
              {details.moduleName && <p className="text-[14px] mb-1">{details.moduleName} ({details.moduleCode})</p>}
              {details.supervisor && <p className="text-[14px] mb-1">Supervisor: {details.supervisor}</p>}
              {details.submissionDate && <p className="text-[14px] mb-1">{new Date(details.submissionDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>}
            </div>

            {/* Content preview */}
            {sections.map(s => (
              <div key={s.id} className="mb-6">
                <h2 className="font-bold mb-2" style={{ fontFamily, fontSize: "16px" }}>{s.title}</h2>
                {s.content && (
                  <div className="whitespace-pre-wrap" style={{ fontFamily, fontSize }}>
                    {s.content.slice(0, 1500)}{s.content.length > 1500 ? "…" : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <StickyFooter leftLabel="← Scan" onLeft={onBack} rightLabel="Manual Submission →" onRight={onNext} />
    </div>
  );
}
