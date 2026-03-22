import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTABanner = () => (
  <section className="py-20 md:py-28" style={{ background: "#1a1714" }}>
    <div className="max-w-3xl mx-auto px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Ready to write your best paper?
        </h2>
        <p className="mt-4 text-white/35 max-w-md mx-auto">
          Upload your brief and let ZOE handle the rest. Your first assessment is free — up to 500 words.
        </p>
        <div className="mt-8">
          <Link to="/auth?tab=signup">
            <Button size="lg" className="bg-terracotta hover:bg-terracotta-600 text-white font-semibold px-8 h-12 text-base active:scale-[0.97] transition-transform animate-pulse-glow">
              Start writing free
              <ArrowRight size={18} className="ml-1" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  </section>
);

export default CTABanner;
