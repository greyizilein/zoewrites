import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, feedback, word_target, section_title, model, settings } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiModel = model || "google/gemini-2.5-flash";
    const firstPerson = settings?.firstPerson || false;
    const hedging = settings?.hedgingIntensity || "Medium";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: "system",
            content: `You are ZOE — an elite academic AI writer built by writers, for students who can't afford one. You write at A+/First-Class standard. Revise the section based on feedback while maintaining A+ quality.

REVISION RULES:
- Keep word count at ${word_target} words (±1%)
- Preserve citation style and academic tone
- Include in-text citations but do NOT include a reference list at the end — references will be compiled separately
- ${firstPerson ? 'First person is allowed where appropriate' : 'Strictly third-person voice'}
- Hedging intensity: ${hedging}
- Never use banned AI phrases: "utilise", "multifaceted", "furthermore", "it is worth noting", "delve into", "shed light on", "robust framework", "comprehensive analysis", "nuanced understanding", "tapestry", "in the realm of"
- Vary sentence lengths: mix short (6–12 words) with longer analytical sentences (25–45 words)
- Never write three consecutive sentences of similar length
- Passive voice ≤30% of sentences`
          },
          {
            role: "user",
            content: `Section: ${section_title}\nWord target: ${word_target}\n\nCurrent content:\n${content}\n\nFeedback:\n${feedback}\n\nRevise the section now. Do NOT append a reference list.`
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("section-revise error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
