import { Loader2 } from "lucide-react";

interface Props {
  leftLabel?: string;
  onLeft?: () => void;
  rightLabel: string;
  onRight: () => void;
  rightLoading?: boolean;
  rightDisabled?: boolean;
  middleContent?: React.ReactNode;
}

export default function StickyFooter({ leftLabel, onLeft, rightLabel, onRight, rightLoading, rightDisabled, middleContent }: Props) {
  return (
    <div className="sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border py-2.5 mt-5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 z-10">
      {leftLabel ? (
        <button onClick={onLeft} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50">
          {leftLabel}
        </button>
      ) : <div />}
      {middleContent}
      <button
        onClick={onRight}
        disabled={rightDisabled || rightLoading}
        className="px-5 py-2.5 sm:px-7 sm:py-3 text-[14px] sm:text-[15px] font-bold bg-foreground text-background rounded-[10px] hover:bg-foreground/90 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
      >
        {rightLoading && <Loader2 size={14} className="animate-spin" />}
        {rightLabel}
      </button>
    </div>
  );
}
