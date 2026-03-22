import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const cyclingWords = ["essays", "reports", "case studies", "analyses", "dissertations"];

const Hero = () => {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((i) => (i + 1) % cyclingWords.length);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden" style={{ background: "#1a1714" }}>
      {/* Radial glows */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, hsl(18, 50%, 53%) 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, hsl(153, 16%, 42%) 0%, transparent 70%)" }} />

      {/* Flowing line */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1200 800" fill="none">
        <motion.path
          d="M-50 400 Q200 350 350 450 T700 380 T1000 500 T1300 350"
          stroke="hsl(18, 50%, 53%)"
          strokeWidth="2"
          strokeOpacity="0.15"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 3, ease: "easeOut" }}
        />
      </svg>

      {/* Floating SVG illustrations */}
      <div className="absolute top-[18%] left-[8%] animate-float-gentle hidden md:block">
        <svg width="56" height="64" viewBox="0 0 56 64" fill="none" className="opacity-60">
          <rect x="4" y="4" width="44" height="56" rx="6" stroke="hsl(18, 50%, 53%)" strokeWidth="2" fill="hsl(18, 50%, 53%)" fillOpacity="0.08" />
          <line x1="14" y1="20" x2="38" y2="20" stroke="hsl(18, 50%, 53%)" strokeWidth="1.5" strokeOpacity="0.5" />
          <line x1="14" y1="28" x2="34" y2="28" stroke="hsl(18, 50%, 53%)" strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1="14" y1="36" x2="30" y2="36" stroke="hsl(18, 50%, 53%)" strokeWidth="1.5" strokeOpacity="0.3" />
        </svg>
      </div>

      <div className="absolute top-[25%] right-[12%] animate-float-slow hidden md:block">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="opacity-50">
          <circle cx="24" cy="24" r="20" stroke="hsl(153, 16%, 50%)" strokeWidth="2" fill="hsl(153, 16%, 42%)" fillOpacity="0.1" />
          <path d="M16 24 L22 30 L34 18" stroke="hsl(153, 16%, 50%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="absolute bottom-[30%] left-[14%] animate-float-drift hidden md:block">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="opacity-40">
          <polygon points="20,6 36,34 4,34" stroke="hsl(263, 28%, 55%)" strokeWidth="2" fill="hsl(263, 28%, 51%)" fillOpacity="0.1" />
        </svg>
      </div>

      <div className="absolute bottom-[22%] right-[8%] animate-float-gentle hidden lg:block" style={{ animationDelay: "1s" }}>
        <svg width="72" height="52" viewBox="0 0 72 52" fill="none" className="opacity-50">
          <rect x="2" y="2" width="68" height="48" rx="8" stroke="hsl(37, 56%, 50%)" strokeWidth="1.5" fill="hsl(37, 56%, 50%)" fillOpacity="0.06" />
          <rect x="10" y="12" width="24" height="3" rx="1.5" fill="hsl(37, 56%, 50%)" fillOpacity="0.4" />
          <rect x="10" y="20" width="50" height="2" rx="1" fill="hsl(37, 56%, 50%)" fillOpacity="0.2" />
          <rect x="10" y="26" width="44" height="2" rx="1" fill="hsl(37, 56%, 50%)" fillOpacity="0.15" />
          <rect x="10" y="32" width="36" height="2" rx="1" fill="hsl(37, 56%, 50%)" fillOpacity="0.1" />
        </svg>
      </div>

      <div className="absolute top-[60%] right-[22%] animate-float-slow hidden lg:block" style={{ animationDelay: "2s" }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="opacity-40">
          <path d="M8 24 L24 8" stroke="hsl(351, 40%, 56%)" strokeWidth="2" strokeLinecap="round" />
          <path d="M14 8 L24 8 L24 18" stroke="hsl(351, 40%, 56%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Animated cursor */}
      <div className="absolute top-[35%] left-[30%] animate-cursor pointer-events-none hidden md:block">
        <svg width="20" height="24" viewBox="0 0 20 24" fill="white" fillOpacity="0.7">
          <path d="M2 2 L2 18 L6 14 L10 22 L13 21 L9 13 L14 13 Z" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.05]"
        >
          Write better{" "}
          <span className="relative inline-block min-w-[200px] sm:min-w-[280px] text-left">
            <AnimatePresence mode="wait">
              <motion.span
                key={wordIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="text-terracotta inline-block"
              >
                {cyclingWords[wordIndex]}
              </motion.span>
            </AnimatePresence>
            {/* SVG highlight circle around cycling word */}
            <motion.svg
              key={`circle-${wordIndex}`}
              className="absolute -inset-x-3 -inset-y-2 w-[calc(100%+24px)] h-[calc(100%+16px)] pointer-events-none"
              viewBox="0 0 300 80"
              fill="none"
              preserveAspectRatio="none"
            >
              <motion.ellipse
                cx="150"
                cy="40"
                rx="145"
                ry="35"
                stroke="hsl(18, 50%, 53%)"
                strokeWidth="2"
                strokeOpacity="0.5"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              />
            </motion.svg>
            <span className="text-terracotta">.</span>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 text-lg md:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed"
        >
          Upload your brief. ZOE structures the plan, writes every section to A+ standard, self-critiques, and delivers a polished .docx — with figures, citations, and exact word counts.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/auth?tab=signup">
            <Button size="lg" className="bg-terracotta hover:bg-terracotta-600 text-white font-semibold px-8 h-12 text-base active:scale-[0.97] transition-transform">
              Start writing free
              <ArrowRight size={18} className="ml-1" />
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button variant="ghost" size="lg" className="text-white/40 hover:text-white hover:bg-white/5 h-12 px-6 text-base border border-white/10">
              See how it works
            </Button>
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-6 text-xs text-white/20"
        >
          Built by writers, for students who can't afford one.
        </motion.p>
      </div>
    </section>
  );
};

export default Hero;
