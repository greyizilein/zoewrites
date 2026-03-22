import { useState, useCallback, useEffect, useRef } from "react";
import { Upload, File, X, Loader2 } from "lucide-react";
import StickyFooter from "./StickyFooter";

interface Props {
  onApplyRevisions: (feedback: string) => void;
  isProcessing: boolean;
  onNext: () => void;
  initialFeedback?: string;
}

export default function StageRevise({ onApplyRevisions, isProcessing, onNext, initialFeedback }: Props) {
  const [feedbackText, setFeedbackText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const autoAppliedRef = useRef(false);

  useEffect(() => {
    if (initialFeedback && !autoAppliedRef.current) {
      setFeedbackText(initialFeedback);
    }
  }, [initialFeedback]);

  useEffect(() => {
    if (initialFeedback && !autoAppliedRef.current && !isProcessing) {
      autoAppliedRef.current = true;
      const timer = setTimeout(() => {
        onApplyRevisions(initialFeedback);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [initialFeedback, isProcessing, onApplyRevisions]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setUploadedFile(file);
  }, []);

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 5 of 10</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Revise</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Provide feedback or corrections. ZOE applies them and advances to Edit & Proofread.</p>
      </div>

      {initialFeedback && (
        <div className="bg-terracotta/5 border border-terracotta/20 rounded-[10px] px-3.5 py-3 mb-4">
          <p className="text-[12px] font-semibold text-terracotta mb-0.5">🔧 Auto-loaded from previous stages</p>
          <p className="text-[11px] text-muted-foreground">Issues have been pre-filled and are being auto-applied…</p>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 bg-terracotta/10 border border-terracotta/20 rounded-[10px] px-3.5 py-3 mb-4 animate-pulse">
          <Loader2 size={14} className="animate-spin text-terracotta" />
          <span className="text-[13px] font-medium text-terracotta">Applying revisions to all sections…</span>
        </div>
      )}

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="relative border-2 border-dashed border-border rounded-[10px] p-6 text-center hover:border-terracotta/30 transition-colors cursor-pointer mb-4"
      >
        {uploadedFile ? (
          <div className="flex items-center justify-center gap-3">
            <File size={18} className="text-terracotta" />
            <span className="text-[13px] font-medium">{uploadedFile.name}</span>
            <button onClick={() => setUploadedFile(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
          </div>
        ) : (
          <>
            <Upload size={20} className="mx-auto text-muted-foreground mb-1" />
            <p className="text-[13px] font-medium mb-0.5">Drop feedback file</p>
            <p className="text-[11px] text-muted-foreground">PDF, DOCX, or image</p>
            <input type="file" onChange={e => { if (e.target.files?.[0]) setUploadedFile(e.target.files[0]); }} className="absolute inset-0 opacity-0 cursor-pointer" />
          </>
        )}
      </div>

      <textarea
        value={feedbackText}
        onChange={e => setFeedbackText(e.target.value)}
        rows={6}
        placeholder="Type or paste your corrections and feedback here…"
        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[14px] resize-y focus:outline-none focus:ring-1 focus:ring-terracotta/30 mb-4"
      />

      <button
        onClick={() => onApplyRevisions(feedbackText)}
        disabled={isProcessing || (!feedbackText.trim() && !uploadedFile)}
        className="w-full py-3 bg-terracotta text-white rounded-[10px] font-bold text-[14px] hover:bg-terracotta/90 transition-all active:scale-[0.97] disabled:opacity-50"
      >
        {isProcessing ? "Applying…" : "Apply Revisions → Edit & Proofread"}
      </button>

      <StickyFooter rightLabel="Edit & Proofread →" onRight={onNext} />
    </div>
  );
}
