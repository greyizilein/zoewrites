import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, model } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are ZOE — an elite academic proofreader. Apply the following checks and corrections. Do NOT change content, structure, arguments, or citations — fix language and mechanics only:

1. All spelling errors
2. All grammatical errors
3. All punctuation errors
4. UK English spelling throughout (colour not color, organisation not organization, realise not realize, behaviour not behavior)
5. Tense consistency throughout each section
6. Sentence fragments and run-on sentences
7. Any contractions (convert to full forms: do not, cannot, it is)
8. Any first-person language (I, we, my, our) — convert to third person
9. Any informal register or colloquial expressions
10. Remove prohibited abbreviations: e.g., i.e., etc.
11. Numbers as numerals for data/statistics
12. Percentages with "%" symbol

CITATION AUDIT — also check:
— Every sentence has analytical support from a named source. Mark unsupported sentences with [CITATION NEEDED].
— Vary citation constructions — convert clusters of "(Author, Year)" at sentence end into integrated narrative forms.
— For Harvard: use "and" not "&"; (Author and Author, Year) for two; (Author et al., Year) for three+.

Return JSON: { "corrected_content": "...", "summary": "...", "corrections_count": N }`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      throw new Error(`AI gateway error: ${resp.status}`);
    }

    const data = await resp.json();
    const resultText = data.choices?.[0]?.message?.content || "{}";
    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      result = { corrected_content: content, summary: "No changes needed", corrections_count: 0 };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("edit-proofread error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
