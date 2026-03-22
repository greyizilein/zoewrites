import { useState, useCallback, useEffect } from "react";
import { Upload, File, X } from "lucide-react";
import PersonalisePanel from "./PersonalisePanel";
import StickyFooter from "./StickyFooter";

interface Props {
  onApplyRevisions: (feedback: string) => void;
  isProcessing: boolean;
  onBack: () => void;
  onNext: () => void;
  initialFeedback?: string;
}

const revisionTypes = [
  { emoji: "📎", title: "Upload Feedback", desc: "PDF, DOCX, image" },
  { emoji: "📋", title: "Paste Comments", desc: "Supervisor notes" },
  { emoji: "🔄", title: "Re-upload Work", desc: "Marked copy" },
  { emoji: "✍️", title: "Type Corrections", desc: "Enter manually" },
];

export default function StageRevisionCenter({ onApplyRevisions, isProcessing, onBack, onNext, initialFeedback }: Props) {
  const [activeType, setActiveType] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [autoApplied, setAutoApplied] = useState(false);

  // Pre-fill from critique auto-revise
  useEffect(() => {
    if (initialFeedback && !autoApplied) {
      setFeedbackText(initialFeedback);
      setActiveType(3); // Type Corrections mode
      setAutoApplied(true);
    }
  }, [initialFeedback, autoApplied]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setUploadedFile(file);
  }, []);

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 5 of 6</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1.5">Revision & Corrections</h1>
        <p className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed">Upload supervisor feedback. ZOE implements and highlights every change.</p>
      </div>

      {initialFeedback && (
        <div className="bg-terracotta/5 border border-terracotta/20 rounded-[10px] px-3.5 py-3 mb-4">
          <p className="text-[12px] font-semibold text-terracotta mb-0.5">🔧 Auto-loaded from Self-Critique</p>
          <p className="text-[11px] text-muted-foreground">Issues from the critique have been pre-filled below. Click "Apply All" to fix them.</p>
        </div>
      )}

      <PersonalisePanel
        title="Revision Preferences"
        fields={[
          { label: "Highlight Colour", type: "select", options: ["Blue", "Yellow", "Both (blue + yellow)"], value: "Both (blue + yellow)" },
          { label: "Scope", type: "select", options: ["Full rewrite of affected areas", "Minimal changes only"], value: "Full rewrite of affected areas" },
          { label: "Re-run Critique", type: "toggle", checked: true, description: "After corrections" },
          { label: "Re-humanise", type: "toggle", checked: true, description: "After edits" },
          { label: "Edit Mode", type: "select", options: ["Standard", "Track changes style"], value: "Standard" },
        ]}
      />

      {/* Input method grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3.5">
        {revisionTypes.map((t, i) => (
          <button
            key={t.title}
            onClick={() => setActiveType(i)}
            className={`border rounded-[10px] p-2.5 sm:p-3.5 text-center transition-all hover:-translate-y-px ${
              activeType === i ? "border-terracotta bg-terracotta/5" : "border-border hover:border-terracotta/30"
            }`}
          >
            <div className="text-[22px] mb-1">{t.emoji}</div>
            <div className="text-[12px] font-semibold">{t.title}</div>
            <div className="text-[10px] text-muted-foreground">{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Upload/paste area */}
      <div className="bg-muted border border-border rounded-xl p-4 mb-3.5">
        <p className="text-[13px] font-semibold mb-2">📎 {revisionTypes[activeType].title}</p>
        {activeType <= 1 ? (
          <>
            {activeType === 0 && (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                className="relative border-2 border-dashed border-border rounded-[10px] p-6 text-center hover:border-terracotta/30 transition-colors cursor-pointer mb-2.5"
              >
                {uploadedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <File size={18} className="text-terracotta" />
                    <span className="text-[13px] font-medium">{uploadedFile.name}</span>
                    <button onClick={() => setUploadedFile(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div className="text-[24px] mb-1">📤</div>
                    <p className="text-[13px] font-medium mb-1">Drop feedback file here</p>
                    <p className="text-[11px] text-muted-foreground">PDF, DOCX, PNG, JPG — or annotated copy</p>
                    <input type="file" onChange={e => { if (e.target.files?.[0]) setUploadedFile(e.target.files[0]); }} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </>
                )}
              </div>
            )}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {activeType === 0 ? "Additional notes" : "Paste comments"}
              </label>
              <textarea
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                rows={3}
                placeholder={activeType === 0 ? "Specific instructions for implementing corrections..." : "Paste supervisor comments here..."}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[14px] resize-y focus:outline-none focus:ring-1 focus:ring-terracotta/30"
              />
            </div>
          </>
        ) : (
          <textarea
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
            rows={6}
            placeholder="Type your corrections and feedback here..."
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[14px] resize-y focus:outline-none focus:ring-1 focus:ring-terracotta/30"
          />
        )}
      </div>

      {/* Preview panel (static example) */}
      <div className="border border-border rounded-xl overflow-hidden mb-3.5">
        <div className="px-3.5 py-2.5 bg-muted/50 border-b border-border flex items-center gap-1.5 text-[13px] font-semibold flex-wrap">
          📄 Preview — Corrections
          <span className="ml-auto px-2 py-0.5 rounded bg-terracotta/10 text-terracotta text-[11px] font-medium">Pending</span>
        </div>
        <div className="p-3.5 text-[13px] leading-[1.8] text-foreground/80">
          <p className="text-muted-foreground italic text-[12px]">Apply revisions to see corrected content here with highlighted changes.</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-2.5 flex-wrap mb-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-r-sm bg-terracotta/15 border-l-[3px] border-terracotta inline-block" />
          Content corrections
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-r-sm bg-warm-gold/15 border-l-[3px] border-warm-gold inline-block" />
          Structural additions
        </div>
      </div>

      <StickyFooter
        leftLabel="← Critique"
        onLeft={onBack}
        rightLabel="Submit →"
        onRight={onNext}
        middleContent={
          <button
            onClick={() => onApplyRevisions(feedbackText)}
            disabled={isProcessing || (!feedbackText.trim() && !uploadedFile)}
            className="px-4 py-2 text-[13px] bg-muted-blue text-white rounded-lg font-medium hover:bg-muted-blue/80 transition-colors disabled:opacity-50 active:scale-[0.97]"
          >
            Apply All
          </button>
        }
      />
    </div>
  );
}
