import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const FULL_TEXT =
  "The contemporary landscape of strategic management has undergone significant transformation (Johnson et al., 2023; Porter, 2021) in the wake of technological disruption, shifting consumer preferences, and evolving regulatory frameworks (Teece, 2022). This report critically examines Tesla Inc.'s strategic positioning through the lens of established analytical frameworks (Barney & Hesterly, 2021), evaluating both the organisation's competitive advantages and the systemic challenges it faces within the electric vehicle sector (Schilling, 2023; IEA, 2022). Drawing upon Porter's Five Forces, resource-based theory, and institutional perspectives (North, 2020), the analysis reveals that while Tesla maintains a formidable first-mover advantage, its long-term dominance is far from assured (Christensen & Raynor, 2022).";

const TYPING_SPEED = 22;
const PAUSE_AFTER = 3500;

const executionRows = [
  { title: "Introduction", words: 300, framework: "—", status: "✓" },
  { title: "Literature Review", words: 800, framework: "SWOT", status: "✓" },
  { title: "Methodology", words: 500, framework: "—", status: "✓" },
  { title: "Analysis & Discussion", words: 1200, framework: "Porter's Five Forces", status: "✓" },
  { title: "Conclusion", words: 200, framework: "—", status: "✓" },
];

const ProductMock = () => {
  const [charIndex, setCharIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Typing loop
  useEffect(() => {
    if (isTyping && charIndex < FULL_TEXT.length) {
      timerRef.current = setTimeout(() => setCharIndex((c) => c + 1), TYPING_SPEED);
    } else if (charIndex >= FULL_TEXT.length) {
      setIsTyping(false);
      timerRef.current = setTimeout(() => {
        setCharIndex(0);
        setIsTyping(true);
      }, PAUSE_AFTER);
    }
    return () => clearTimeout(timerRef.current);
  }, [charIndex, isTyping]);

  const displayedText = FULL_TEXT.slice(0, charIndex);
  const wordCount = displayedText.split(/\s+/).filter(Boolean).length;
  const progress = Math.round((charIndex / FULL_TEXT.length) * 298);

  // Execution table row reveal
  const [visibleRows, setVisibleRows] = useState(0);
  const [planReady, setPlanReady] = useState(false);
  const execTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const revealNext = () => {
      setVisibleRows((v) => {
        if (v < executionRows.length) {
          execTimerRef.current = setTimeout(revealNext, 1400);
          return v + 1;
        }
        // All rows shown, show "Plan ready" then restart
        setTimeout(() => setPlanReady(true), 600);
        setTimeout(() => {
          setVisibleRows(0);
          setPlanReady(false);
          execTimerRef.current = setTimeout(revealNext, 800);
        }, 4500);
        return v;
      });
    };
    execTimerRef.current = setTimeout(revealNext, 1200);
    return () => clearTimeout(execTimerRef.current);
  }, []);

  return (
    <section className="py-20 md:py-28" style={{ background: "#1a1714" }}>
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            See ZOE in action
          </h2>
          <p className="mt-3 text-sm text-white/40 max-w-md mx-auto">
            A real workspace view — ZOE writes, critiques, and refines each section.
          </p>
        </motion.div>

        {/* ── Card 1: Writing workspace ── */}
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40"
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#2a2520] border-b border-white/5">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 mx-8">
              <div className="bg-white/5 rounded-md px-3 py-1 text-[10px] text-white/30 text-center font-mono">
                app.zoewrite.com/workspace
              </div>
            </div>
          </div>

          {/* Workspace content */}
          <div className="bg-[#1e1b17] flex min-h-[360px] md:min-h-[420px]">
            {/* Sidebar */}
            <div className="w-48 border-r border-white/5 p-3 hidden md:block">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-white/20 mb-3">Sections</div>
              {[
                { title: "Introduction", status: "writing", words: `${progress}/300` },
                { title: "Literature Review", status: "pending", words: "0/800" },
                { title: "Methodology", status: "pending", words: "0/500" },
                { title: "Analysis & Discussion", status: "pending", words: "0/1200" },
                { title: "Conclusion", status: "pending", words: "0/200" },
              ].map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] mb-0.5 ${
                    i === 0 ? "bg-[#C4704B]/15 text-white/90" : "text-white/40"
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    s.status === "complete" ? "bg-[#5B7F6E]" :
                    s.status === "writing" ? "bg-[#C4704B] animate-pulse" : "bg-white/15"
                  }`} />
                  <span className="flex-1 truncate">{s.title}</span>
                  <span className="text-[9px] font-mono text-white/20">{s.words}</span>
                </div>
              ))}
              <div className="mt-4 pt-3 border-t border-white/5">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-white/20 mb-2">Quality</div>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between text-white/30"><span>Citations</span><span>{Math.floor(wordCount / 8)}</span></div>
                  <div className="flex justify-between text-white/30"><span>Banned phrases</span><span className="text-[#5B7F6E]">0</span></div>
                  <div className="flex justify-between text-white/30"><span>Grade</span><span className="text-[#C4704B] font-semibold">A+</span></div>
                </div>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 p-5 md:p-6">
              <div className="flex items-center gap-2 mb-3">
                {isTyping ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-[#C4704B] animate-pulse" />
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[#C4704B]">Writing</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full bg-[#5B7F6E] flex items-center justify-center">
                      <svg width="7" height="7" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white/30">Complete</span>
                  </>
                )}
              </div>
              <h3 className="text-sm font-bold text-white/90 mb-1">Introduction</h3>
              <p className="text-[10px] text-white/25 mb-4">Framework: —  •  <span className="tabular-nums">{progress}</span> / 300 words</p>
              <div className="text-[11px] leading-relaxed text-white/50 min-h-[120px]">
                <p>{displayedText}<span className="inline-block w-[2px] h-[13px] bg-[#C4704B] ml-[1px] align-middle animate-blink-cursor" /></p>
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-md bg-[#5B7F6E] text-white text-[10px] font-semibold flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Accept
                </div>
                <div className="px-3 py-1.5 rounded-md border border-white/10 text-white/50 text-[10px] font-medium">
                  Request Revision
                </div>
                <div className="px-3 py-1.5 rounded-md text-white/30 text-[10px]">
                  Regenerate
                </div>
              </div>
            </div>

            {/* Suggestions panel */}
            <div className="w-56 border-l border-white/5 p-4 hidden lg:block">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-white/20 mb-3">ZOE recommends</div>
              <div className="space-y-3">
                <div className="p-2.5 rounded-lg bg-[#C4704B]/10 border border-[#C4704B]/15">
                  <p className="text-[10px] text-white/60 leading-relaxed">
                    Consider adding a clearer thesis statement in paragraph 2 to strengthen the argument structure.
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#C4704B]/20 text-[#C4704B] font-medium cursor-pointer">Apply</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded text-white/30 cursor-pointer">Skip</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#3D6B9E]/10 border border-[#3D6B9E]/15">
                  <p className="text-[10px] text-white/60 leading-relaxed">
                    Add 2 more citations to this section for stronger evidence density.
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3D6B9E]/20 text-[#3D6B9E] font-medium cursor-pointer">Apply</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded text-white/30 cursor-pointer">Skip</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Animated cursor overlay */}
        <div className="relative hidden md:block">
          <div className="absolute -top-[300px] left-[15%] animate-cursor pointer-events-none z-20">
            <svg width="18" height="22" viewBox="0 0 20 24" fill="white" fillOpacity="0.5">
              <path d="M2 2 L2 18 L6 14 L10 22 L13 21 L9 13 L14 13 Z" />
            </svg>
          </div>
        </div>

        {/* ── Card 2: Execution Table ── */}
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40"
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#2a2520] border-b border-white/5">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 mx-8">
              <div className="bg-white/5 rounded-md px-3 py-1 text-[10px] text-white/30 text-center font-mono">
                app.zoewrite.com/plan
              </div>
            </div>
          </div>

          {/* Table content */}
          <div className="bg-[#1e1b17] p-5 md:p-6 min-h-[260px]">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full flex items-center justify-center ${visibleRows >= executionRows.length && planReady ? "bg-[#5B7F6E]" : "bg-[#C4704B] animate-pulse"}`}>
                {visibleRows >= executionRows.length && planReady && (
                  <svg width="7" height="7" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </div>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/30">
                {visibleRows >= executionRows.length && planReady ? "Plan ready" : "Generating plan…"}
              </span>
            </div>

            <h3 className="text-sm font-bold text-white/90 mb-4">Execution Table</h3>

            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_140px_60px] gap-2 text-[9px] font-semibold uppercase tracking-wider text-white/20 border-b border-white/5 pb-2 mb-1">
              <span>Section</span>
              <span>Words</span>
              <span className="hidden sm:block">Framework</span>
              <span>Status</span>
            </div>

            {/* Table rows */}
            <div className="space-y-0.5">
              {executionRows.map((row, i) => (
                <div key={i} className="relative">
                  {i < visibleRows ? (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="grid grid-cols-[1fr_80px_140px_60px] gap-2 py-2 text-[11px]"
                    >
                      <span className="text-white/60">{row.title}</span>
                      <span className="text-white/40 font-mono tabular-nums">{row.words}</span>
                      <span className="text-white/30 hidden sm:block">{row.framework}</span>
                      <span className="text-[#5B7F6E]">{row.status}</span>
                    </motion.div>
                  ) : i === visibleRows ? (
                    /* Loading shimmer for the next row */
                    <div className="grid grid-cols-[1fr_80px_140px_60px] gap-2 py-2">
                      <div className="h-3 rounded bg-white/5 animate-pulse" />
                      <div className="h-3 w-10 rounded bg-white/5 animate-pulse" />
                      <div className="h-3 w-16 rounded bg-white/5 animate-pulse hidden sm:block" />
                      <div className="h-3 w-6 rounded bg-white/5 animate-pulse" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Total row */}
            {visibleRows >= executionRows.length && planReady && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="border-t border-white/5 mt-2 pt-2 grid grid-cols-[1fr_80px_140px_60px] gap-2 text-[11px] font-semibold"
              >
                <span className="text-white/50">Total</span>
                <span className="text-white/60 font-mono tabular-nums">3,000</span>
                <span className="hidden sm:block" />
                <span className="text-[#5B7F6E]">✓</span>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ProductMock;
