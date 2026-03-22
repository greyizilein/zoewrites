import { motion } from "framer-motion";
import { Upload, Table2, PenLine, FileCheck } from "lucide-react";

const steps = [
  {
    icon: Upload,
    step: "01",
    title: "Upload your brief",
    description: "Drop your assessment brief — PDF, DOCX, image, or just paste the text. ZOE reads and understands every requirement.",
    color: "hsl(18, 50%, 53%)",
  },
  {
    icon: Table2,
    step: "02",
    title: "Review the execution plan",
    description: "ZOE generates a structured plan: sections, word counts, frameworks, citation density, and A+ criteria. Edit anything before writing begins.",
    color: "hsl(153, 16%, 42%)",
  },
  {
    icon: PenLine,
    step: "03",
    title: "AI writes section-by-section",
    description: "Each section is written with running coherence, exact word counts, proper citations, and embedded figures. No generic filler.",
    color: "hsl(212, 38%, 43%)",
  },
  {
    icon: FileCheck,
    step: "04",
    title: "Self-critique & export",
    description: "ZOE evaluates against the marking rubric, proofreads, adjusts word counts, and exports a polished .docx with everything in place.",
    color: "hsl(263, 28%, 51%)",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 md:py-32" style={{ background: "hsl(37, 45%, 93%)" }}>
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Four steps to an A+ paper
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
            From brief to polished document in minutes, not days.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-center"
            >
              <div
                className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: `${item.color}12`, border: `1px solid ${item.color}20` }}
              >
                <item.icon size={24} style={{ color: item.color }} />
              </div>
              <p className="text-[11px] font-mono font-semibold tracking-wider uppercase mb-2" style={{ color: item.color }}>
                Step {item.step}
              </p>
              <h3 className="text-base font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
