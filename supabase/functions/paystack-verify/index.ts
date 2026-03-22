import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tierWordLimits: Record<string, number> = {
  free: 500,
  hello: 1500,
  regular: 5000,
  professional: 15000,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { reference, tier, custom_words, user_id } = await req.json();
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not configured");

    // Verify payment with Paystack
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

    const verifyData = await verifyResponse.json();

    if (!verifyData.status || verifyData.data?.status !== "success") {
      return new Response(JSON.stringify({ error: "Payment verification failed", details: verifyData.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update user profile
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const wordLimit = tier === "custom" ? (custom_words || 0) + 1000 : tierWordLimits[tier] || 500;

    const { error } = await supabase
      .from("profiles")
      .update({ tier, words_used: 0 })
      .eq("user_id", user_id);

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      tier,
      word_limit: wordLimit,
      amount_paid: verifyData.data?.amount / 100,
      currency: verifyData.data?.currency,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("paystack-verify error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
