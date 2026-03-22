import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  leftLabel?: string;
  onLeft?: () => void;
  rightLabel: string;
  onRight: () => void;
  rightLoading?: boolean;
  rightDisabled?: boolean;
}

export default function StickyFooter({ leftLabel, onLeft, rightLabel, onRight, rightLoading, rightDisabled }: Props) {
  return (
    <div className="sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border py-2.5 mt-5 flex justify-between items-center gap-2 z-10">
      {leftLabel ? (
        <>
          {/* Mobile: icon arrow */}
          <button onClick={onLeft} className="sm:hidden w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors active:scale-[0.95]">
            <ChevronLeft size={16} />
          </button>
          {/* Desktop: text */}
          <button onClick={onLeft} className="hidden sm:block px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50">
            {leftLabel}
          </button>
        </>
      ) : <div />}
      <>
        {/* Mobile: icon arrow */}
        <button
          onClick={onRight}
          disabled={rightDisabled || rightLoading}
          className="sm:hidden w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-all active:scale-[0.95] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {rightLoading ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={16} />}
        </button>
        {/* Desktop: text */}
        <button
          onClick={onRight}
          disabled={rightDisabled || rightLoading}
          className="hidden sm:flex px-5 py-2.5 text-[14px] font-bold bg-foreground text-background rounded-[10px] hover:bg-foreground/90 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed items-center justify-center gap-1.5"
        >
          {rightLoading && <Loader2 size={14} className="animate-spin" />}
          {rightLabel}
        </button>
      </>
    </div>
  );
}
