interface Props {
  message: string;
  active: boolean;
}

export default function ProgressBanner({ message, active }: Props) {
  if (!active || !message) return null;

  return (
    <div className="sticky top-0 z-30 bg-terracotta/5 border-b border-terracotta/15 px-4 py-2 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-[6px] h-[6px] rounded-full bg-terracotta animate-pulse"
            style={{ animationDelay: `${i * 300}ms`, animationDuration: "1.2s" }}
          />
        ))}
      </div>
      <span className="text-[12px] font-medium text-terracotta">{message}</span>
    </div>
  );
}
