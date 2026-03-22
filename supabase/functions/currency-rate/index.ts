import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedRate: { ngn_to_gbp: number; gbp_to_ngn: number; updated_at: string } | null = null;
let cacheTime = 0;
const CACHE_DURATION = 3600_000; // 1 hour

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const now = Date.now();
    if (cachedRate && now - cacheTime < CACHE_DURATION) {
      return new Response(JSON.stringify(cachedRate), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch live rate
    const resp = await fetch("https://open.er-api.com/v6/latest/GBP");
    if (!resp.ok) throw new Error("Exchange rate API unavailable");
    const data = await resp.json();
    const gbp_to_ngn = data.rates?.NGN || 2083; // fallback
    const ngn_to_gbp = 1 / gbp_to_ngn;

    cachedRate = {
      ngn_to_gbp: parseFloat(ngn_to_gbp.toFixed(6)),
      gbp_to_ngn: parseFloat(gbp_to_ngn.toFixed(2)),
      updated_at: new Date().toISOString(),
    };
    cacheTime = now;

    return new Response(JSON.stringify(cachedRate), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("currency-rate error:", e);
    // Fallback rates
    const fallback = { ngn_to_gbp: 0.00048, gbp_to_ngn: 2083, updated_at: new Date().toISOString(), fallback: true };
    return new Response(JSON.stringify(fallback), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
