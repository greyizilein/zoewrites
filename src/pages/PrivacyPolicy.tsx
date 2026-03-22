import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="pt-24 pb-20 max-w-3xl mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: March 2026</p>

        <div className="prose prose-sm max-w-none text-foreground/80 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
            <p>We collect information you provide directly: your email address, name, and payment details (processed by Paystack — we do not store card numbers). We also collect assessment content you create, usage data, and device/browser information.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
            <p>We use your information to provide and improve the Service, process payments, communicate with you about your account, and ensure security. We may use anonymised, aggregated data to improve our AI models and Service quality.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Data Storage & Security</h2>
            <p>Your data is stored securely using industry-standard encryption. Assessment content is stored in our cloud infrastructure. We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, alteration, or destruction.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. AI Processing</h2>
            <p>Your assessment content is processed by third-party AI models (Google Gemini, OpenAI GPT) to generate, revise, and analyse text. This processing is essential to the Service. Content sent to AI providers is not used by them to train their models, subject to their respective data processing agreements.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Data Sharing</h2>
            <p>We do not sell your personal data. We share data only with: payment processors (Paystack) for transactions, AI model providers for content generation, and cloud infrastructure providers for hosting. We may disclose data if required by law.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data. You can export your assessments at any time. To exercise these rights or request data deletion, contact us at <span className="text-terracotta">support@zoewrite.com</span>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use advertising or tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Data Retention</h2>
            <p>We retain your account data and assessments for as long as your account is active. After account deletion, data is permanently removed within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Children's Privacy</h2>
            <p>ZOE is not intended for users under 16 years of age. We do not knowingly collect data from children.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
            <p>We may update this policy periodically. We will notify you of significant changes via email or a notice on the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Contact</h2>
            <p>For privacy-related enquiries, contact us at <span className="text-terracotta">support@zoewrite.com</span>.</p>
          </section>
        </div>
      </motion.div>
    </main>
    <Footer />
  </div>
);

export default PrivacyPolicy;
