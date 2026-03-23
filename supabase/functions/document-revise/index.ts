import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, feedback, word_target, sections, model, settings, brief_text, topic, citation_style } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiModel = model || "google/gemini-2.5-flash";
    const firstPerson = settings?.firstPerson || false;
    const hedging = settings?.hedgingIntensity || "Medium";
    const citStyle = citation_style || settings?.citationStyle || "Harvard";

    // Build section word targets for reference
    const sectionTargets = (sections || []).map((s: any) =>
      `${s.title}: ${s.word_target} words`
    ).join(", ");

    const systemPrompt = `You are ZOE — an elite academic AI writer. You are revising a complete academic document to address specific feedback. The revision must be the final, polished, submission-ready version of the entire document.

${topic ? `SUBJECT — NON-NEGOTIABLE: This assessment is about "${topic}". Write exclusively about this subject.` : ""}
${brief_text ? `ORIGINAL BRIEF:\n${brief_text.slice(0, 2000)}` : ""}

═══════════════════════════════════════════════
REVISION RULES — ALL NON-NEGOTIABLE
═══════════════════════════════════════════════

APPLY EVERY FEEDBACK POINT: Every single item in the feedback below MUST be addressed in this revision. No exceptions. No partial addressing. If feedback says "add X", add X. If it says "fix Y", fix Y. If it says "include a table", include a table. Every instruction is mandatory.

NON-REGRESSION: Do NOT introduce new errors while fixing existing ones. Preserve all correctly-placed citations. Do not remove or alter content that was not flagged for change. The revision must be strictly better than the original in every respect.

WORD COUNT: Maintain each section's original word count exactly (±1%):
${sectionTargets || `Total: ~${word_target} words`}
If adding content causes a section to exceed its ceiling, trim less analytically significant prose proportionally.

CITATION RULES: All citations must be genuine and verifiable. Maintain ${citStyle} style with "and" not "&". Every new analytical claim must be supported by an in-text citation. Preserve all existing correct citations.

WRITING STANDARDS:
- Formal UK English, ${firstPerson ? "first-person permitted" : "strictly third-person — no 'I' or 'we'"}, no contractions
- Passive voice ≤30% of sentences
- Hedging: ${hedging}
- Vary sentence lengths aggressively — short punchy (6–12 words) mixed with long analytical (25–45 words)
- Never write 3 consecutive sentences of similar length
- Numbers in numerals; no bullet points in body text

BANNED PHRASES — NEVER USE: "utilise", "multifaceted", "furthermore", "moreover", "it is worth noting", "it is important to", "in today's world", "plays a crucial role", "leveraging", "synergies", "paradigm shift", "holistic approach", "robust framework", "comprehensive analysis", "nuanced understanding", "delve into", "shed light on", "pave the way", "it is evident that", "myriad", "plethora", "cutting-edge", "game-changer", "groundbreaking", "tapestry", "in the realm of", "advent of".

HUMANISING: The document must read as authored by a human scholar. Vary burstiness, use natural transitions, introduce slightly unexpected but appropriate word choices, let paragraph structure follow thought not template.

OUTPUT FORMAT: Preserve the exact section structure. For each section:
## [Section Title]
[Revised body text]
## References
[Updated reference list — add new sources cited, remove any no longer used, keep all unchanged references]
---
Then continue with next section.`;

    const userPrompt = `FEEDBACK TO APPLY — EVERY ITEM IS MANDATORY:
${feedback}

CURRENT DOCUMENT CONTENT:
${content}

Apply every feedback point above to the complete document. Maintain all section word counts (±1%). Preserve the complete document structure.

Output the full revised document now. No preamble, no commentary. Begin with the first section heading immediately.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
        max_tokens: 32000,
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
    console.error("document-revise error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
