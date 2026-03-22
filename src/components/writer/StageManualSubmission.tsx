import { useState, useCallback } from "react";
import { Upload, File, X, Send, Download } from "lucide-react";
import StickyFooter from "./StickyFooter";

interface Props {
  onApplyCorrections: (corrections: string) => void;
  onReExport: () => void;
  isProcessing: boolean;
  onBack: () => void;
  assessmentTitle: string;
}

export default function StageManualSubmission({ onApplyCorrections, onReExport, isProcessing, onBack, assessmentTitle }: Props) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [corrections, setCorrections] = useState("");

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setUploadedFile(file);
  }, []);

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 10 of 10</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Manual Submission</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Re-upload your exported work. Paste or type corrections and ZOE implements them exactly.</p>
      </div>

      {/* Upload area */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="relative border-2 border-dashed border-border rounded-[10px] p-8 text-center hover:border-terracotta/30 transition-colors cursor-pointer mb-4"
      >
        {uploadedFile ? (
          <div className="flex items-center justify-center gap-3">
            <File size={20} className="text-terracotta" />
            <span className="text-[14px] font-medium">{uploadedFile.name}</span>
            <button onClick={() => setUploadedFile(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
          </div>
        ) : (
          <>
            <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-[14px] font-medium mb-1">Drop your exported .docx here</p>
            <p className="text-[12px] text-muted-foreground">Re-upload the file you previously exported</p>
            <input type="file" accept=".docx,.doc,.pdf" onChange={e => { if (e.target.files?.[0]) setUploadedFile(e.target.files[0]); }} className="absolute inset-0 opacity-0 cursor-pointer" />
          </>
        )}
      </div>

      {/* Corrections text */}
      <div className="mb-4">
        <label className="text-[12px] font-semibold text-muted-foreground block mb-1.5">Corrections & Adjustments</label>
        <textarea
          value={corrections}
          onChange={e => setCorrections(e.target.value)}
          rows={8}
          placeholder="Type or paste exact corrections here. Be specific — e.g. 'In section 2, paragraph 3, change X to Y' or 'Add a paragraph about Z after the methodology section'…"
          className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-[14px] resize-y focus:outline-none focus:ring-1 focus:ring-terracotta/30"
        />
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => onApplyCorrections(corrections)}
          disabled={isProcessing || !corrections.trim()}
          className="flex-1 py-3 bg-terracotta text-white rounded-[10px] font-bold text-[14px] hover:bg-terracotta/90 transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Send size={14} /> Apply Corrections
        </button>
        <button
          onClick={onReExport}
          disabled={isProcessing}
          className="flex-1 py-3 bg-foreground text-background rounded-[10px] font-bold text-[14px] hover:bg-foreground/90 transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Download size={14} /> Re-Export .docx
        </button>
      </div>

      <StickyFooter leftLabel="← Submit" onLeft={onBack} rightLabel="Re-Export →" onRight={onReExport} />
    </div>
  );
}
