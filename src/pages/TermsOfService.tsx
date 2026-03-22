import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const TermsOfService = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="pt-24 pb-20 max-w-3xl mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: March 2026</p>

        <div className="prose prose-sm max-w-none text-foreground/80 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>By accessing or using ZOE ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Service. ZOE is operated by ZOE Ltd.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
            <p>ZOE is an AI-powered academic writing assistant that helps users generate, revise, and humanise academic assessments. The Service includes text generation, citation management, quality analysis, document export, and related features.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. AI-Generated Content Disclaimer</h2>
            <p>Content produced by ZOE is generated using artificial intelligence models. While we strive for accuracy and academic rigour, AI-generated content may contain errors, inaccuracies, or fabricated references. Users are solely responsible for reviewing, verifying, and taking ownership of all content before submission to any institution.</p>
            <p>ZOE does not guarantee any specific grade, mark, or academic outcome. The Service is a writing aid and does not replace critical thinking, independent research, or academic integrity.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Academic Integrity</h2>
            <p>Users must comply with their institution's academic integrity policies. ZOE is designed to assist with writing, not to facilitate plagiarism or academic dishonesty. Users are responsible for ensuring their use of ZOE aligns with their institution's rules regarding AI-assisted work.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Payment Terms</h2>
            <p>ZOE offers both free and paid tiers. Paid plans are one-time purchases charged in Nigerian Naira (₦) via Paystack. Prices displayed in British Pounds (£) are converted at live exchange rates. All sales are final — no refunds are offered once content has been generated.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. User Accounts</h2>
            <p>You must provide a valid email address to create an account. You are responsible for maintaining the confidentiality of your credentials and for all activities under your account. You must notify us immediately of any unauthorised use.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Intellectual Property</h2>
            <p>Content you generate using ZOE belongs to you. However, you grant ZOE a non-exclusive licence to use anonymised, aggregated data to improve the Service. ZOE's branding, interface, and underlying technology remain the property of ZOE Ltd.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
            <p>ZOE is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service, including but not limited to academic penalties, data loss, or service interruptions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Termination</h2>
            <p>We reserve the right to suspend or terminate your access to the Service at any time for violation of these terms or for any other reason at our discretion.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the revised terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Contact</h2>
            <p>For questions about these terms, please contact us at <span className="text-terracotta">support@zoewrite.com</span>.</p>
          </section>
        </div>
      </motion.div>
    </main>
    <Footer />
  </div>
);

export default TermsOfService;
