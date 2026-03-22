import { motion } from "framer-motion";
import {
  Brain, BookOpen, BarChart3, Target, Shield, Search, Layers, GraduationCap,
} from "lucide-react";

const features = [
  { icon: Brain, title: "100+ Analytical Frameworks", description: "Porter's Five Forces, SWOT, PESTLE, BCG Matrix, McKinsey 7S, and dozens more — applied contextually.", color: "hsl(18, 50%, 53%)" },
  { icon: BookOpen, title: "Multi-Format Citations", description: "Harvard, APA 7th, MLA, Chicago, Vancouver, IEEE, OSCOLA — with per-section citation control.", color: "hsl(153, 16%, 42%)" },
  { icon: BarChart3, title: "Charts, Graphs & Figures", description: "Bar, line, pie, radar, scatter, waterfall, treemap — plus AI-generated diagrams and process flows.", color: "hsl(37, 56%, 50%)" },
  { icon: Target, title: "Exact Word Count", description: "±1% tolerance on every section and overall. ZOE auto-adjusts to hit the target without sacrificing quality.", color: "hsl(212, 38%, 43%)" },
  { icon: Shield, title: "Humaniser Pipeline", description: "5-pass humanisation: discipline detection, persona-driven revision, Turnitin bypass, and post-processing.", color: "hsl(263, 28%, 51%)" },
  { icon: Search, title: "Self-Critique Engine", description: "Evaluates against the marking rubric, identifies gaps, and makes corrections automatically.", color: "hsl(351, 40%, 56%)" },
  { icon: Layers, title: "Section-by-Section Control", description: "Accept, revise, or regenerate any section. Running coherence ensures each section flows naturally.", color: "hsl(18, 50%, 53%)" },
  { icon: GraduationCap, title: "Academic Levels", description: "Undergraduate, Master's, PhD, Professional — ZOE adapts depth, complexity, and language.", color: "hsl(153, 16%, 42%)" },
];

const Features = () => {
  return (
    <section className="py-24 md:py-32" style={{ background: "#1a1714" }}>
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Every detail, handled
          </h2>
          <p className="mt-4 text-white/35 max-w-xl mx-auto">
            ZOE doesn't just write — it plans, structures, cites, critiques, and polishes.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="group p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ background: `${feature.color}15` }}>
                <feature.icon size={18} style={{ color: feature.color }} />
              </div>
              <h3 className="font-semibold text-white text-sm">{feature.title}</h3>
              <p className="mt-2 text-xs text-white/35 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
