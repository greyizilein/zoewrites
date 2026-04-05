import { useState, useEffect, useRef } from "react";
import { Loader2, Check, FileText, X, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Section, WriterSettings } from "./types";

type PassType = "proofread" | "citation" | "humanise";

interface PassLog {
  ts: string;
  msg: string;
  ok?: boolean;
  err?: boolean;
}

interface Props {
  sections: Section[];
  settings: WriterSettings;
  editedContent: string;
  generating: boolean;
  streamContent: string;
  writeError?: string | null;
  onRunPass: (pass: PassType) => Promise<void>;
  onRunAllPasses: () => Promise<void>;
  onContentChange: (content: string) => void;
  onClearError?: () => void;
  onBack: () => void;
  onNext: () => void;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export default function StageEditProofHumanise({
  sections, settings, editedContent, generating, streamContent,
  writeError, onRunPass, onRunAllPasses, onContentChange, onClearError,
  onBack, onNext,
}: Props) {
  const [runningPass, setRunningPass] = useState<PassType | "all" | null>(null);
  const [passLog, setPassLog] = useState<PassLog[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [showLog, setShowLog] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalTarget = sections.reduce((a, s) => a + s.word_target, 0);
  const wc = countWords(editedContent || "");
  const pct = totalTarget ? wc / totalTarget : 0;
  const wcClass = pct > 1.01 ? "text-destructive" : pct > 0.95 ? "text-sage" : "text-amber-500";

  const addLog = (msg: string, ok?: boolean, err?: boolean) => {
    setPassLog(p => [...p, { ts: new Date().toLocaleTimeString(), msg, ok, err }]);
  };

  const handlePass = async (pass: PassType) => {
    setRunningPass(pass);
    addLog(`Starting ${pass} pass…`);
    try {
      await onRunPass(pass);
      addLog(`✓ ${pass} pass complete — ${countWords(editedContent).toLocaleString()} words`, true);
    } catch (e: any) {
      addLog(`Error: ${e.message}`, false, true);
    }
    setRunningPass(null);
  };

  const handleRunAll = async () => {
    setRunningPass("all");
    setAllDone(false);
    addLog("Starting all three passes…");
    try {
      await onRunAllPasses();
      addLog("All passes complete.", true);
      setAllDone(true);
    } catch (e: any) {
      addLog(`Error: ${e.message}`, false, true);
    }
    setRunningPass(null);
  };

  // Auto-scroll streaming
  useEffect(() => {
    if (generating && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamContent, generating]);

  const extraTools = ["Expand section", "Condense section", "Simplify language", "Strengthen argument", "Check consistency"];

  return (
    <div className="max-w-[820px] mx-auto flex flex-col gap-4">
      {/* Header */}
      <div>
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 4 of 7</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1">Edit / Proofread / Humanise</h1>
        <p className="text-[13px] text-muted-foreground">
          Three targeted passes — run individually or all at once. Each pass refines the draft without altering the core content.
        </p>
      </div>

      {/* Pass buttons */}
      <div className="bg-card border border-border/50 rounded-2xl p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {([
            { id: "proofread" as PassType, icon: "✦", label: "Proofread" },
            { id: "citation" as PassType, icon: "⊕", label: "Citations" },
            { id: "humanise" as PassType, icon: "◈", label: "Humanise" },
          ]).map(p => {
            const isThis = runningPass === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handlePass(p.id)}
                disabled={!!runningPass}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold font-mono transition-all ${
                  isThis
                    ? "bg-terracotta/10 text-terracotta border border-terracotta/30"
                    : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                } disabled:opacity-40`}
              >
                {isThis && <Loader2 size={11} className="animate-spin" />}
                {p.icon} {p.label}
              </button>
            );
          })}
          <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
          <button
            onClick={handleRunAll}
            disabled={!!runningPass}
            className="flex items-center gap-1.5 px-4 py-2 bg-terracotta text-white rounded-xl text-[11px] font-bold hover:bg-terracotta/90 transition-all active:scale-[0.97] disabled:opacity-40"
          >
            ▶ Run All Three Passes
          </button>
          {runningPass && (
            <span className="text-[10px] text-terracotta font-semibold flex items-center gap-1 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" />
              Processing…
            </span>
          )}
        </div>
        {/* Word count strip */}
        <div className="flex items-center gap-3">
          <span className={`font-mono text-[12px] font-bold ${wcClass}`}>
            {fmt(wc)} / {fmt(totalTarget)}w
          </span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${pct > 1.01 ? "bg-destructive" : pct > 0.95 ? "bg-sage" : "bg-amber-500"}`}
              style={{ width: `${Math.min(100, pct * 100)}%` }} />
          </div>
          {allDone && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-sage">
              <Check size={11} /> All passes complete
            </span>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
          <FileText size={13} className="text-muted-foreground" />
          <p className="text-[12px] font-bold text-foreground flex-1">Draft Editor</p>
          {generating && (
            <span className="text-[10px] font-semibold text-terracotta flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" /> Streaming
            </span>
          )}
        </div>
        <div ref={scrollRef} className="relative">
          <textarea
            value={generating ? streamContent || editedContent : editedContent}
            onChange={e => !generating && onContentChange(e.target.value)}
            readOnly={generating}
            className="w-full min-h-[350px] sm:min-h-[440px] bg-transparent border-none outline-none resize-y px-5 py-4 text-[13px] font-serif leading-[1.9] text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            placeholder="Your draft will appear here. It flows from the Write stage automatically."
          />
        </div>
      </div>

      {/* Pass log (collapsible on mobile) */}
      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowLog(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          <p className="text-[12px] font-bold text-foreground">Pass Log ({passLog.length})</p>
          {showLog ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
        </button>
        {showLog && (
          <div className="px-4 pb-3 max-h-40 overflow-y-auto border-t border-border/50">
            {passLog.length === 0 && (
              <p className="text-[11px] text-muted-foreground font-mono py-2">Run a pass to see log</p>
            )}
            {passLog.map((l, i) => (
              <div key={i} className={`text-[11px] font-mono py-1 border-b border-border/30 last:border-0 ${l.ok ? "text-sage" : l.err ? "text-destructive" : "text-muted-foreground"}`}>
                <span className="opacity-50 mr-2">{l.ts}</span>{l.msg}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extra tools */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Extra Tools</p>
        <div className="flex flex-wrap gap-1.5">
          {extraTools.map(t => (
            <button
              key={t}
              className="px-3 py-1.5 border border-border rounded-xl text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {writeError && (
        <div className="flex items-start gap-2.5 bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-destructive flex-1 leading-relaxed">{writeError}</p>
          {onClearError && (
            <button onClick={onClearError} className="text-destructive/60 hover:text-destructive flex-shrink-0">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Footer nav */}
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
          Critique & Correct →
        </button>
      </div>
    </div>
  );
}
