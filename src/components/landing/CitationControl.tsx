import { motion } from "framer-motion";
import { Check } from "lucide-react";

const features = [
  "Choose exact citation count per section",
  "Set date range for all sources (e.g. 2018–2024)",
  "Toggle seminal/classic source inclusion",
  "AI recommends optimal citation density",
  "Supports Harvard, APA, MLA, Chicago & more",
];

const sectionCitations = [
  { name: "Introduction", count: 4, recommended: "3–5" },
  { name: "Literature Review", count: 12, recommended: "10–15" },
  { name: "Methodology", count: 6, recommended: "5–8" },
  { name: "Analysis", count: 8, recommended: "6–10" },
  { name: "Conclusion", count: 2, recommended: "1–3" },
];

const CitationControl = () => {
  return (
    <section className="py-20 md:py-28" style={{ background: "#FDFBF7" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Left - Description */}
          <motion.div
            initial={{ opacity: 0, x: -16, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">Citation Engine</span>
            <h2 className="mt-3 text-2xl md:text-3xl font-bold text-foreground tracking-tight leading-tight">
              Full control over every citation
            </h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              Set exactly how many citations each section needs. ZOE checks if your count is appropriate and recommends adjustments — you decide whether to accept.
            </p>

            <ul className="mt-8 space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <div className="w-4 h-4 rounded-full bg-muted-blue/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={10} className="text-muted-blue" />
                  </div>
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right - Interactive mockup */}
          <motion.div
            initial={{ opacity: 0, x: 16, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border bg-card shadow-lg shadow-black/5 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Citation Settings</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Date range:</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted-blue/10 text-muted-blue font-medium">2018 – 2024</span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Include seminal sources:</span>
                <div className="w-7 h-4 rounded-full bg-sage relative">
                  <div className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-white shadow-sm" />
                </div>
                <span className="text-[10px] text-sage font-medium">On</span>
              </div>
            </div>

            {/* Section rows */}
            <div>
              {sectionCitations.map((s, i) => (
                <div key={i} className="px-4 py-2.5 border-b border-border last:border-0 flex items-center justify-between">
                  <span className="text-xs text-foreground font-medium">{s.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">Rec: {s.recommended}</span>
                    <div className="flex items-center gap-1">
                      <button className="w-5 h-5 rounded bg-muted/60 text-muted-foreground text-[10px] font-bold hover:bg-muted transition-colors">−</button>
                      <span className="w-6 text-center text-xs font-mono font-semibold text-foreground tabular-nums">{s.count}</span>
                      <button className="w-5 h-5 rounded bg-muted/60 text-muted-foreground text-[10px] font-bold hover:bg-muted transition-colors">+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-muted/20 border-t border-border flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Total citations: <span className="font-semibold text-foreground tabular-nums">32</span></span>
              <span className="text-[10px] text-sage font-medium">✓ Density looks appropriate</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CitationControl;
