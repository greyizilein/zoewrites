import { useState, useEffect } from "react";
import { Settings, X } from "lucide-react";

export interface Field {
  label: string;
  type: "select" | "input" | "toggle" | "text";
  options?: string[];
  value?: string;
  checked?: boolean;
  description?: string;
  placeholder?: string;
  key?: string;
}

interface Props {
  title: string;
  fields: Field[];
  onApply?: (values: Record<string, any>) => void;
}

export default function PersonalisePanel({ title, fields, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [localValues, setLocalValues] = useState<Record<string, any>>({});

  // Init local values from fields
  useEffect(() => {
    const init: Record<string, any> = {};
    fields.forEach((f) => {
      const k = f.key || f.label;
      if (f.type === "toggle") init[k] = f.checked ?? false;
      else init[k] = f.value ?? "";
    });
    setLocalValues(init);
  }, [open]); // re-init when opened

  const updateLocal = (key: string, value: any) => {
    setLocalValues(prev => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] sm:text-[13px] transition-all mb-3.5 active:scale-[0.97] ${
          open ? "bg-terracotta/10 border-terracotta/30 text-terracotta" : "bg-muted border-border text-muted-foreground hover:bg-muted/80 hover:border-border"
        }`}
      >
        <Settings size={13} /> {title}
      </button>

      {open && (
        <div className="border border-border rounded-xl bg-card mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-3.5 py-2.5 bg-muted/50 border-b border-border flex items-center justify-between rounded-t-xl text-[13px]">
            <span className="font-semibold">⚙️ {title}</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {fields.map((f, i) => {
              const k = f.key || f.label;
              return (
                <div key={i}>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    {f.label}
                  </label>
                  {f.type === "select" && f.options && (
                    <select
                      value={localValues[k] || ""}
                      onChange={e => updateLocal(k, e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-terracotta/30 appearance-none"
                    >
                      {f.options.map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  )}
                  {f.type === "input" && (
                    <input
                      value={localValues[k] || ""}
                      onChange={e => updateLocal(k, e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-terracotta/30"
                      placeholder={f.placeholder}
                    />
                  )}
                  {f.type === "toggle" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateLocal(k, !localValues[k])}
                        className={`w-[34px] h-[19px] rounded-full relative transition-colors ${localValues[k] ? "bg-terracotta" : "bg-border"}`}
                      >
                        <span className={`block w-[15px] h-[15px] rounded-full bg-white shadow-sm absolute top-[2px] transition-all ${localValues[k] ? "right-[2px]" : "left-[2px]"}`} />
                      </button>
                      <span className="text-[13px]">{f.description || "Enabled"}</span>
                    </div>
                  )}
                  {f.type === "text" && (
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{f.description}</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-3.5 py-2.5 border-t border-border flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors rounded-md">Cancel</button>
            <button onClick={() => { onApply?.(localValues); setOpen(false); }} className="px-3 py-1.5 text-[12px] bg-foreground text-background rounded-md font-medium hover:bg-foreground/90 transition-colors active:scale-[0.97]">Apply</button>
          </div>
        </div>
      )}
    </>
  );
}
