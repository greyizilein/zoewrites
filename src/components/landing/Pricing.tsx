import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { loadPaystackScript, openPaystackPopup } from "@/lib/paystack";

const NGN_PER_WORD = 23;
const PAYSTACK_PUBLIC_KEY = "pk_live_e1d5c33f8f38484c592eaad87382adab502a8c1e";

const tiers = [
  {
    name: "Free",
    priceGBP: 0,
    period: "forever",
    description: "Try ZOE with a short assessment.",
    words: "500 words",
    features: ["500 word limit", "Harvard & APA citations", "Basic self-critique", ".docx export", "Unlimited images"],
    cta: "Get Started",
    highlighted: false,
    color: "hsl(24, 14%, 45%)",
    tier: "free",
  },
  {
    name: "Hello",
    priceGBP: 15,
    period: "one-time",
    description: "For a standard essay or short report.",
    words: "1,500 words",
    features: ["1,500 word limit", "All citation styles", "Full self-critique & edit", "Figures & tables", "Humaniser pipeline", "Unlimited images"],
    cta: "Buy Now",
    highlighted: false,
    color: "hsl(153, 16%, 42%)",
    tier: "hello",
  },
  {
    name: "Regular",
    priceGBP: 45,
    period: "one-time",
    description: "For coursework and detailed reports.",
    words: "5,000 words",
    features: ["5,000 word limit", "All citation styles", "Full self-critique & edit", "Figures & tables", "Humaniser pipeline", "Framework library", "Unlimited images"],
    cta: "Buy Now",
    highlighted: false,
    color: "hsl(212, 38%, 43%)",
    tier: "regular",
  },
  {
    name: "Professional",
    priceGBP: 110,
    period: "one-time",
    description: "For dissertations and complex work.",
    words: "15,000 words",
    features: ["15,000 word limit", "All citation styles", "Advanced critique engine", "Custom frameworks", "Priority processing", "Research integration", "Unlimited images"],
    cta: "Buy Now",
    highlighted: true,
    color: "hsl(18, 50%, 53%)",
    tier: "professional",
  },
];

const Pricing = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customWords, setCustomWords] = useState("");
  const [gbpToNgn, setGbpToNgn] = useState(2083);
  const [rateUpdated, setRateUpdated] = useState("");
  const [loadingRate, setLoadingRate] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("currency-rate");
        if (!error && data) {
          setGbpToNgn(data.gbp_to_ngn || 2083);
          setRateUpdated(data.updated_at ? new Date(data.updated_at).toLocaleTimeString() : "");
        }
      } catch { /* use fallback */ }
      setLoadingRate(false);
    };
    fetchRate();
  }, []);

  const customWordCount = parseInt(customWords) || 0;
  const bonusWords = customWordCount > 0 ? 1000 : 0;
  const totalWords = customWordCount + bonusWords;
  const costNGN = customWordCount * NGN_PER_WORD;
  const costGBP = (costNGN / gbpToNgn).toFixed(2);

  const handlePayment = async (tier: typeof tiers[0]) => {
    if (tier.tier === "free") return;
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to purchase a plan.", variant: "destructive" });
      return;
    }

    setPaymentLoading(tier.tier);
    try {
      await loadPaystackScript();
      const amountNGN = Math.round(tier.priceGBP * gbpToNgn);
      openPaystackPopup({
        email: user.email || "",
        amountInKobo: amountNGN * 100,
        tier: tier.tier,
        publicKey: PAYSTACK_PUBLIC_KEY,
        onSuccess: async (reference) => {
          toast({ title: "Verifying payment…" });
          const { data, error } = await supabase.functions.invoke("paystack-verify", {
            body: { reference, tier: tier.tier, user_id: user.id },
          });
          if (error) {
            toast({ title: "Verification failed", description: error.message, variant: "destructive" });
          } else {
            toast({ title: "Payment successful!", description: `Upgraded to ${tier.name}. ${data?.word_limit?.toLocaleString()} words available.` });
          }
          setPaymentLoading(null);
        },
        onClose: () => setPaymentLoading(null),
      });
    } catch (e: any) {
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
      setPaymentLoading(null);
    }
  };

  const handleCustomPayment = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to purchase.", variant: "destructive" });
      return;
    }
    if (customWordCount < 100) {
      toast({ title: "Minimum 100 words", variant: "destructive" });
      return;
    }

    setPaymentLoading("custom");
    try {
      await loadPaystackScript();
      openPaystackPopup({
        email: user.email || "",
        amountInKobo: costNGN * 100,
        tier: "custom",
        customWords: customWordCount,
        publicKey: PAYSTACK_PUBLIC_KEY,
        onSuccess: async (reference) => {
          toast({ title: "Verifying payment…" });
          const { data, error } = await supabase.functions.invoke("paystack-verify", {
            body: { reference, tier: "custom", custom_words: customWordCount, user_id: user.id },
          });
          if (error) {
            toast({ title: "Verification failed", description: error.message, variant: "destructive" });
          } else {
            toast({ title: "Payment successful!", description: `${totalWords.toLocaleString()} words available (incl. 1,000 bonus).` });
          }
          setPaymentLoading(null);
        },
        onClose: () => setPaymentLoading(null),
      });
    } catch (e: any) {
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
      setPaymentLoading(null);
    }
  };

  return (
    <section id="pricing" className="py-24 md:py-32" style={{ background: "hsl(40, 33%, 98%)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Simple, student-friendly pricing
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
            Pay per assessment. No subscriptions. Images & references don't count toward word limits.
          </p>
        </motion.div>

        {/* Main tiers */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {tiers.map((tier, i) => {
            const ngnPrice = Math.round(tier.priceGBP * gbpToNgn);
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className={`rounded-xl p-6 flex flex-col border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10 ${
                  tier.highlighted
                    ? "border-terracotta/30 bg-terracotta/[0.04] relative shadow-lg shadow-terracotta/5"
                    : "border-border bg-card hover:border-foreground/15"
                }`}
              >
                {tier.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-terracotta text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold" style={{ color: tier.color }}>{tier.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground tabular-nums">£{tier.priceGBP}</span>
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  </div>
                  {tier.priceGBP > 0 && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60 tabular-nums">≈ ₦{ngnPrice.toLocaleString()}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{tier.words}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">{tier.description}</p>
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check size={14} className="shrink-0 mt-0.5" style={{ color: tier.color }} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {tier.tier === "free" ? (
                  <Link to="/auth?tab=signup">
                    <Button className="w-full bg-foreground/5 hover:bg-foreground/10 text-foreground font-semibold active:scale-[0.97] transition-transform" size="sm">
                      {tier.cta}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={() => handlePayment(tier)}
                    disabled={paymentLoading === tier.tier}
                    className={`w-full font-semibold active:scale-[0.97] transition-transform ${
                      tier.highlighted
                        ? "bg-terracotta hover:bg-terracotta-600 text-white"
                        : "bg-foreground/5 hover:bg-foreground/10 text-foreground"
                    }`}
                    size="sm"
                  >
                    {paymentLoading === tier.tier ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                    {tier.cta}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Custom + PAPERSTUDIO row */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Custom tier */}
          <motion.div
            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl p-6 border border-warm-gold/20 bg-warm-gold/[0.03]"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-warm-gold">Custom</h3>
                <p className="text-xs text-muted-foreground mt-1">Set your own word count. ₦23 per word + 1,000 free bonus words.</p>
              </div>
              <Calculator size={20} className="text-warm-gold/50" />
            </div>

            <div className="flex gap-3 items-end mb-4">
              <div className="flex-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Word count</label>
                <Input
                  type="number"
                  placeholder="e.g. 8000"
                  value={customWords}
                  onChange={(e) => setCustomWords(e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              {customWordCount > 0 && (
                <div className="text-right pb-1">
                  <p className="text-xl font-bold text-foreground tabular-nums">£{costGBP}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">₦{costNGN.toLocaleString()}</p>
                  <p className="text-[10px] text-warm-gold">+{bonusWords.toLocaleString()} bonus words</p>
                </div>
              )}
            </div>

            {customWordCount > 0 && (
              <p className="text-xs text-muted-foreground mb-4">
                Total: <span className="font-semibold text-foreground tabular-nums">{totalWords.toLocaleString()} words</span> ({customWordCount.toLocaleString()} + {bonusWords.toLocaleString()} free)
              </p>
            )}

            {rateUpdated && (
              <p className="text-[9px] text-muted-foreground/40 mb-3">Rate updated: {rateUpdated} • £1 ≈ ₦{gbpToNgn.toLocaleString()}</p>
            )}

            <Button
              onClick={handleCustomPayment}
              disabled={paymentLoading === "custom" || customWordCount < 100}
              className="w-full bg-warm-gold hover:bg-warm-gold/90 text-white font-semibold active:scale-[0.97] transition-transform"
              size="sm"
            >
              {paymentLoading === "custom" ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {customWordCount > 0 ? `Pay ₦${costNGN.toLocaleString()}` : "Enter word count"}
            </Button>
          </motion.div>

          {/* PAPERSTUDIO */}
          <motion.div
            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl p-6 border border-dusty-purple/20 bg-dusty-purple/[0.03] flex flex-col"
          >
            <h3 className="text-sm font-semibold text-dusty-purple">PAPERSTUDIO</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">For full dissertations. Multi-chapter, literature-heavy, research-grade output.</p>
            <ul className="space-y-2 mb-6 flex-1">
              {["Full dissertation support", "Multi-chapter planning", "Literature review engine", "Research methodology", "Appendices & supplementary", "Dedicated processing"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check size={14} className="text-dusty-purple shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <a href="https://paperstudio.lovable.app/" target="_blank" rel="noopener noreferrer">
              <Button className="w-full bg-dusty-purple hover:bg-dusty-purple/90 text-white font-semibold active:scale-[0.97] transition-transform" size="sm">
                Visit PaperStudio
              </Button>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
