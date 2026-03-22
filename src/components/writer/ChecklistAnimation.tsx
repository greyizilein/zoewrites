import { useState, useEffect } from "react";
import { Loader2, Check } from "lucide-react";

interface Props {
  items: string[];
  running: boolean;
  onComplete?: () => void;
  /** External signal that the actual API work is done */
  apiDone?: boolean;
}

export default function ChecklistAnimation({ items, running, onComplete, apiDone }: Props) {
  const [current, setCurrent] = useState(-1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [animDone, setAnimDone] = useState(false);

  useEffect(() => {
    if (!running) {
      if (!animDone) {
        setCurrent(-1);
        setCompleted([]);
      }
      return;
    }
    setAnimDone(false);
    let i = 0;
    setCurrent(0);
    const interval = setInterval(() => {
      setCompleted(prev => [...prev, i]);
      i++;
      if (i >= items.length) {
        clearInterval(interval);
        setCurrent(-1);
        setAnimDone(true);
      } else {
        setCurrent(i);
      }
    }, 440);
    return () => clearInterval(interval);
  }, [running, items.length]);

  // Fire onComplete only when both animation AND API are done
  useEffect(() => {
    if (animDone && (apiDone === undefined || apiDone)) {
      onComplete?.();
    }
  }, [animDone, apiDone]);

  const progress = items.length > 0 ? Math.round((completed.length / items.length) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[13px] font-semibold">Self-Critique Pass</span>
        <span className={`font-mono text-[13px] font-semibold ${completed.length === items.length ? "text-sage" : "text-terracotta"}`}>
          {progress}%
        </span>
      </div>
      <div className="h-1 bg-border rounded-full overflow-hidden mb-3.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${completed.length === items.length ? "bg-sage" : "bg-terracotta"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex flex-col gap-[7px]">
        {items.map((item, i) => {
          const isDone = completed.includes(i);
          const isActive = current === i;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="w-[18px] h-[18px] flex items-center justify-center flex-shrink-0">
                {isDone ? (
                  <div className="w-[18px] h-[18px] rounded-full bg-sage/15 flex items-center justify-center animate-in zoom-in duration-200">
                    <Check size={10} className="text-sage" strokeWidth={3} />
                  </div>
                ) : isActive ? (
                  <Loader2 size={14} className="text-terracotta animate-spin" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-border" />
                )}
              </div>
              <span className={`text-[12px] sm:text-[13px] transition-colors ${
                isDone ? "text-muted-foreground" : isActive ? "text-foreground" : "text-muted-foreground/40"
              }`}>
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
