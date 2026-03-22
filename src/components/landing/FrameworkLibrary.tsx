import { motion } from "framer-motion";

const frameworks = [
  "Porter's Five Forces", "SWOT Analysis", "PESTLE", "BCG Matrix", "McKinsey 7S",
  "Balanced Scorecard", "Ansoff Matrix", "Value Chain", "Blue Ocean", "VRIO Framework",
  "Stakeholder Analysis", "Resource-Based View", "Transaction Cost", "Institutional Theory",
  "Agency Theory", "Dynamic Capabilities", "Knowledge-Based View", "Game Theory",
  "Real Options", "Scenario Planning", "Design Thinking", "Lean Canvas",
  "Business Model Canvas", "OKR Framework", "RACI Matrix", "Kotter's 8 Steps",
  "Lewin's Change Model", "ADKAR", "Maslow's Hierarchy", "Herzberg's Two-Factor",
  "Bloom's Taxonomy", "Gibbs' Reflective Cycle", "Kolb's Learning Cycle",
  "Critical Path Method", "Six Sigma", "Theory of Constraints",
];

const colors = [
  "hsl(18, 50%, 53%)", "hsl(153, 16%, 42%)", "hsl(212, 38%, 43%)",
  "hsl(263, 28%, 51%)", "hsl(37, 56%, 50%)", "hsl(351, 40%, 56%)",
];

const FrameworkLibrary = () => {
  return (
    <section id="frameworks" className="py-24 md:py-32" style={{ background: "hsl(37, 45%, 93%)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            100+ analytical frameworks
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl">
            Every major business, management, psychology, and research framework — applied contextually to your assessment.
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-2">
          {frameworks.map((fw, i) => (
            <motion.span
              key={fw}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.3, delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border cursor-default hover:scale-110 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
              style={{
                color: colors[i % colors.length],
                borderColor: `${colors[i % colors.length]}20`,
                background: `${colors[i % colors.length]}08`,
              }}
            >
              {fw}
            </motion.span>
          ))}
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border bg-muted/50">
            +64 more…
          </span>
        </div>
      </div>
    </section>
  );
};

export default FrameworkLibrary;
