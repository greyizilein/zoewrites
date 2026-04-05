import { useState } from "react";
import { Loader2, Sparkles, Copy, RotateCcw, Plus, Trash2 } from "lucide-react";
import { WriterSettings } from "./types";

interface Props {
  settings: WriterSettings;
  onSettingsChange: (s: WriterSettings) => void;
  sectionSpecs: string;
  onSectionSpecsChange: (t: string) => void;
  masterPrompt: string;
  onMasterPromptChange: (t: string) => void;
  onBuildPrompt: () => Promise<void>;
  onRebuildPrompt: () => void;
  isBuilding: boolean;
  isBuilt: boolean;
  onBack: () => void;
  onNext: () => void;
}

export default function StagePromptBuilder({
  settings, onSettingsChange,
  sectionSpecs, onSectionSpecsChange,
  masterPrompt, onMasterPromptChange,
  onBuildPrompt, onRebuildPrompt,
  isBuilding, isBuilt,
  onBack, onNext,
}: Props) {

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(masterPrompt || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = masterPrompt ? masterPrompt.split(/\s+/).filter(Boolean).length : 0;
  const charCount = masterPrompt?.length || 0;

  return (
    <div className="max-w-[920px] mx-auto flex flex-col gap-4">
      {/* Header */}
      <div>
        <p className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stage 2 of 7</p>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mb-1">Prompt Builder</h1>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          ZOE analyses your brief and assembles a complete execution prompt. Edit the section specifications, then build the final prompt.
        </p>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT — Section Specifications */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold text-foreground">Section Specifications</p>
            <div className="flex gap-2">
              {!isBuilding && (
                <button
                  onClick={onBuildPrompt}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-terracotta text-white rounded-xl text-[11px] font-bold hover:bg-terracotta/90 transition-all active:scale-[0.97]"
                >
                  <Sparkles size={12} /> Build with AI
                </button>
              )}
              {isBuilding && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-terracotta">
                  <Loader2 size={12} className="animate-spin" /> Analysing brief…
                </span>
              )}
              {isBuilt && (
                <button
                  onClick={onRebuildPrompt}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-xl text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                >
                  <RotateCcw size={11} /> Rebuild
                </button>
              )}
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-terracotta/5 border border-terracotta/20 rounded-xl px-3.5 py-2.5 text-[11px] text-foreground/80 leading-relaxed">
            <strong className="text-foreground">How it works:</strong> ZOE writes each section specification as a detailed prose paragraph — no tables, no rows.
            Edit anything below before building the final prompt. This is what tells the AI <em>exactly</em> what to write in each section.
          </div>

          <textarea
            value={sectionSpecs}
            onChange={e => onSectionSpecsChange(e.target.value)}
            placeholder={"ZOE will write your section specifications here once you click 'Build with AI'.\n\nYou can also write them manually:\n\nIntroduction (350 words): Open by identifying the precise strategic tension...\n\nPorter's Five Forces Analysis (1,200 words): Apply the framework specifically to the UK EV market...\n\netc."}
            className="w-full min-h-[320px] sm:min-h-[400px] bg-muted/30 border border-border rounded-xl px-4 py-3.5 text-[12px] font-mono leading-[1.75] text-foreground/90 resize-y placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-terracotta/30"
          />

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onSectionSpecsChange("")}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trash2 size={10} /> Clear
            </button>
            <button
              onClick={() => onSectionSpecsChange(sectionSpecs + "\n\n[Add section here: Heading (Xw): Detailed specification...]")}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus size={10} /> Add section
            </button>
          </div>
        </div>

        {/* RIGHT — Assembled Execution Prompt */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold text-foreground">Assembled Execution Prompt</p>
            <div className="flex gap-2">
              <button
                onClick={onRebuildPrompt}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw size={10} /> Rebuild
              </button>
              <button
                onClick={handleCopy}
                disabled={!masterPrompt}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                <Copy size={10} /> {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {!masterPrompt && (
            <div className="flex-1 bg-muted/30 border border-border rounded-xl p-6 flex items-center justify-center text-center min-h-[200px]">
              <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[260px]">
                The complete execution prompt will appear here once you build it. It includes the role, context, execution command, your section specifications, and all quality rules.
              </p>
            </div>
          )}

          {masterPrompt && (
            <>
              <textarea
                value={masterPrompt}
                onChange={e => onMasterPromptChange(e.target.value)}
                className="w-full min-h-[320px] sm:min-h-[400px] bg-muted/20 border border-border rounded-xl px-4 py-3.5 text-[11px] font-mono leading-[1.8] text-foreground/60 resize-y focus:outline-none focus:ring-1 focus:ring-terracotta/30"
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {charCount.toLocaleString()} characters · {wordCount.toLocaleString()} words
                </span>
                <span className="px-2 py-0.5 bg-sage/10 text-sage text-[10px] font-bold rounded-full">
                  Ready for generation
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Generate button */}
      {isBuilt && (
        <button
          onClick={onNext}
          className="w-full py-3.5 bg-terracotta text-white rounded-xl text-[14px] font-bold hover:bg-terracotta/90 transition-all active:scale-[0.97] shadow-sm"
        >
          Generate Complete Work →
        </button>
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
          disabled={!isBuilt}
          className="flex-1 py-3 bg-foreground text-background rounded-xl text-[13px] font-bold hover:bg-foreground/85 transition-all active:scale-[0.97] disabled:opacity-40"
        >
          Write →
        </button>
      </div>
    </div>
  );
}
