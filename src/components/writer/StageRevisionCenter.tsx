import { useState, useRef } from "react";
import { Loader2, Send, Mic, MicOff, Upload, Check, X, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Section } from "./types";

interface RevisionChange {
  id: string;
  type: "ADDITION" | "MODIFICATION" | "DELETION" | "REFERENCE_FIX" | "GRAMMAR" | "STYLE";
  section: string;
  description: string;
  accepted: boolean | null;
}

interface Props {
  sections: Section[];
  generating: boolean;
  streamContent: string;
  writeError?: string | null;
  onReviseDocument: (feedback: string) => Promise<void>;
  onClearError?: () => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StageRevisionCenter({
  sections, generating, streamContent, writeError, onReviseDocument,
  onClearError, onBack, onNext,
}: Props) {
  const [activeTab, setActiveTab] = useState<"paste" | "upload" | "voice" | "manual">("paste");
  const [feedback, setFeedback] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [manualChanges, setManualChanges] = useState<RevisionChange[]>([]);
  const [revising, setRevising] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const contentSections = sections.filter(s => s.content && s.content.trim().length > 50);
  const hasContent = contentSections.length > 0;

  const handleVoiceToggle = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setFeedback(prev => prev + "\n[Voice input not supported in this browser]");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GB";
    
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setVoiceText(transcript);
    };
    
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const applyVoice = () => {
    if (voiceText.trim()) {
      setFeedback(prev => (prev ? prev + "\n" : "") + voiceText.trim());
      setVoiceText("");
    }
  };

  const addManualChange = () => {
    setManualChanges(prev => [...prev, {
      id: crypto.randomUUID(),
      type: "MODIFICATION",
      section: contentSections[0]?.title || "",
      description: "",
      accepted: null,
    }]);
  };

  const updateManualChange = (id: string, field: string, value: any) => {
    setManualChanges(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeManualChange = (id: string) => {
    setManualChanges(prev => prev.filter(c => c.id !== id));
  };

  const getFeedbackText = (): string => {
    const parts: string[] = [];
    
    if (activeTab === "paste" && feedback.trim()) {
      parts.push(feedback.trim());
    }
    if (activeTab === "voice" && voiceText.trim()) {
      parts.push(voiceText.trim());
    }
    if (activeTab === "manual" && manualChanges.length > 0) {
      const accepted = manualChanges.filter(c => c.accepted !== false && c.description.trim());
      if (accepted.length > 0) {
        parts.push("MANUAL CORRECTIONS:\n" + accepted.map(c =>
          `[${c.type}] [${c.section}] ${c.description}`
        ).join("\n"));
      }
    }
    
    return parts.join("\n\n");
  };

  const handleRevise = async () => {
    const text = getFeedbackText();
    if (!text.trim()) return;
    
    setRevising(true);
    try {
      await onReviseDocument(text);
    } finally {
      setRevising(false);
    }
  };

  const canRevise = getFeedbackText().trim().length > 0 && hasContent;

  return (
    <div className="max-w-[640px] mx-auto flex flex-col gap-4">
      <div>
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 6 of 7</p>
        <h1 className="text-[22px] font-bold tracking-tight mb-0.5">Revision Centre</h1>
        <p className="text-[13px] text-muted-foreground">
          Paste supervisor feedback, upload marked scripts, or dictate corrections. ZOE applies them precisely.
        </p>
      </div>

      {!hasContent && (
        <div className="bg-muted/50 border border-border rounded-2xl p-6 text-center">
          <FileText size={28} className="text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[13px] font-semibold text-foreground mb-1">No content to revise</p>
          <p className="text-[11px] text-muted-foreground">Write the document first, then return here to apply corrections.</p>
        </div>
      )}

      {hasContent && (
        <>
          {/* Input tabs */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="flex bg-muted border-b border-border">
              {([
                { id: "paste" as const, icon: "📋", label: "Paste" },
                { id: "upload" as const, icon: "📎", label: "Upload" },
                { id: "voice" as const, icon: "🎤", label: "Voice" },
                { id: "manual" as const, icon: "✍️", label: "Manual" },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 py-2.5 text-[11px] sm:text-[12px] flex items-center justify-center gap-1 border-b-2 transition-all ${
                    activeTab === t.id
                      ? "bg-card border-foreground text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>

            <div className="p-3 sm:p-4">
              {activeTab === "paste" && (
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Paste supervisor feedback, examiner comments, or your own revision notes…"
                  rows={6}
                  className="w-full bg-transparent border-none resize-y text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
              )}

              {activeTab === "upload" && (
                <div className="text-center py-6">
                  {uploadedFile ? (
                    <div className="flex items-center justify-center gap-2 bg-muted rounded-lg px-4 py-3">
                      <FileText size={16} className="text-terracotta" />
                      <span className="text-[13px] font-medium">{uploadedFile.name}</span>
                      <button onClick={() => setUploadedFile(null)} className="text-muted-foreground hover:text-foreground">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload size={28} className="text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-[13px] font-medium mb-1">Upload marked script</p>
                      <p className="text-[11px] text-muted-foreground">PDF, DOCX, or image of annotated work</p>
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={e => setUploadedFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>
              )}

              {activeTab === "voice" && (
                <div className="text-center py-4">
                  <button
                    onClick={handleVoiceToggle}
                    className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 transition-all ${
                      isRecording
                        ? "bg-destructive text-white animate-pulse shadow-lg"
                        : "bg-terracotta text-white hover:bg-terracotta/90"
                    }`}
                  >
                    {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>
                  <p className="text-[13px] font-medium mb-1">
                    {isRecording ? "Recording — speak your corrections…" : "Tap to start dictating"}
                  </p>
                  {voiceText && (
                    <div className="mt-3 bg-muted rounded-xl p-3 text-left">
                      <p className="text-[12px] text-foreground leading-relaxed">{voiceText}</p>
                      <button
                        onClick={applyVoice}
                        className="mt-2 px-3 py-1.5 bg-terracotta text-white rounded-lg text-[11px] font-semibold hover:bg-terracotta/90"
                      >
                        Add to feedback
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "manual" && (
                <div className="space-y-3">
                  {manualChanges.map(change => (
                    <div key={change.id} className="border border-border rounded-xl p-3 space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={change.type}
                          onChange={e => updateManualChange(change.id, "type", e.target.value)}
                          className="bg-muted border border-border rounded-lg px-2 py-1.5 text-[11px] focus:outline-none"
                        >
                          {["ADDITION", "MODIFICATION", "DELETION", "REFERENCE_FIX", "GRAMMAR", "STYLE"].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <select
                          value={change.section}
                          onChange={e => updateManualChange(change.id, "section", e.target.value)}
                          className="flex-1 bg-muted border border-border rounded-lg px-2 py-1.5 text-[11px] truncate focus:outline-none"
                        >
                          {contentSections.map(s => (
                            <option key={s.id} value={s.title}>{s.title}</option>
                          ))}
                        </select>
                        <button onClick={() => removeManualChange(change.id)} className="text-muted-foreground hover:text-destructive">
                          <X size={14} />
                        </button>
                      </div>
                      <textarea
                        value={change.description}
                        onChange={e => updateManualChange(change.id, "description", e.target.value)}
                        placeholder="Describe the change needed…"
                        rows={2}
                        className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-terracotta/30"
                      />
                    </div>
                  ))}
                  <button
                    onClick={addManualChange}
                    className="w-full py-2.5 border border-dashed border-border rounded-xl text-[12px] text-muted-foreground hover:text-foreground hover:border-terracotta/30 transition-colors"
                  >
                    + Add correction
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Apply button */}
          <button
            onClick={handleRevise}
            disabled={!canRevise || revising || generating}
            className="w-full py-3 bg-terracotta text-white rounded-xl text-[13px] font-bold hover:bg-terracotta/90 transition-all active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {revising || generating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {revising || generating ? "Applying corrections…" : "Apply Corrections"}
          </button>

          {/* Streaming output */}
          {generating && streamContent && (
            <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                <p className="text-[12px] font-bold text-foreground">Revising…</p>
                <span className="text-[10px] font-semibold text-terracotta flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" /> Live
                </span>
              </div>
              <div ref={scrollRef} className="px-5 py-4 max-h-64 overflow-y-auto">
                <pre className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">
                  {streamContent}
                  <span className="inline-block w-0.5 h-3 bg-terracotta animate-pulse ml-0.5 align-middle" />
                </pre>
              </div>
            </div>
          )}
        </>
      )}

      {/* Error */}
      {writeError && (
        <div className="flex items-start gap-2.5 bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
          <p className="text-[12px] text-destructive flex-1 leading-relaxed">{writeError}</p>
          {onClearError && (
            <button onClick={onClearError} className="text-destructive/60 hover:text-destructive flex-shrink-0">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex gap-2.5">
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-border rounded-xl text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all active:scale-[0.97]"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={generating}
          className="flex-1 py-3 bg-foreground text-background rounded-xl text-[13px] font-bold hover:bg-foreground/85 transition-all active:scale-[0.97] disabled:opacity-40"
        >
          Export →
        </button>
      </div>
    </div>
  );
}
