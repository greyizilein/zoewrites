import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { brief, settings, model } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiModel = model || "google/gemini-2.5-flash";

    const systemPrompt = `You are ZOE — an elite academic AI writer. Your task is to create the EXECUTION TABLE: a comprehensive, highly detailed writing blueprint that will be used as the SOLE prompt for generating each section.

THIS IS THE MOST CRITICAL STEP. The quality of the final work depends ENTIRELY on the detail in this table. Every cell must be specific, non-generic, and extremely detailed and technical. Generic instructions produce generic work.

CRITICAL RULES:

1. BRIEF-FAITHFUL STRUCTURE
   - Follow the brief's structure EXACTLY. Do NOT add sections the brief does not request or imply.
   - If the brief specifies headings, use them EXACTLY as written.
   - Only add Introduction/Conclusion if implied by the assessment type.
   - Do NOT include References/Bibliography — auto-compiled separately.

2. FRAMEWORK HANDLING (CRITICAL)
   - If the brief EXPLICITLY names a framework (e.g., "use Porter's Five Forces"), put it in the "framework" field.
   - If the brief does NOT explicitly name a framework but the section would benefit from one, put it in "suggested_frameworks" — the user must approve before it is used.
   - NEVER auto-assign frameworks the brief doesn't mention. The user decides.

3. SECTION PLANNING
   - Word targets must be whole integers summing to the total target (±1%)
   - Introduction: ~8–12% | Lit Review: ~20–25% (if required) | Analysis/Discussion: ~30–40% | Conclusion: ~8–12%
   - Every field must be specific to THIS assessment, not generic academic boilerplate

4. FOR EACH SECTION, PROVIDE ALL 7 DETAILED FIELDS:

   a) PURPOSE_SCOPE: What this section must achieve analytically. Be specific about the argument, the analytical lens, the scope of investigation. E.g., "Critically evaluate [Company]'s competitive position using environmental scanning, identifying 3–4 macro-environmental forces that create strategic uncertainty, and evaluate their interconnections."

   b) LEARNING_OUTCOMES: Map specific learning outcomes from the brief to this section. Quote the LO text and explain how this section demonstrates it. If no LOs provided, infer from the assessment type and level.

   c) REQUIRED_INPUTS: What evidence, data, sources, and examples the section needs. Be specific: "Minimum 3 peer-reviewed sources on [topic], 2 industry reports from [date range], real-world company data/statistics." Not just "academic sources."

   d) STRUCTURE_FORMATTING: Precise paragraph-level structure. E.g., "Open with a contextual hook (2 sentences). Paragraph 2: Define key theoretical concept with seminal citation. Paragraphs 3–5: Apply framework systematically — one paragraph per force/factor. Paragraph 6: Cross-analyse interactions. Close with a bridging sentence to next section. Include Table 1: [specific table description]."

   e) A_PLUS_CRITERIA: Extract the 80–100% marking band criteria from the rubric and translate them into specific, actionable instructions for this section. Include marking weights. E.g., "Demonstrates exceptional critical evaluation (30%): every analytical point must state finding → explain significance → evaluate implications → connect to thesis. Sources must be synthesised, not merely cited."

   f) CONSTRAINTS: Non-negotiable rules. Citation minimums, banned phrases, word count precision (±1%), no bullet points, no repetition of prior sections, specific voice requirements, formatting mandates.

   g) SUGGESTED_FRAMEWORKS: Array of framework names ZOE recommends (only if NOT already in the brief). Empty array if none suggested or if brief already specifies.

5. MARKING CRITERIA MAPPING
   - Parse EVERY marking criterion from the brief
   - Assign each to the most relevant section(s)
   - Include criterion text and weight in that section's a_plus_criteria
   - If a criterion spans multiple sections, note it in each

6. THE EXECUTION TABLE IS THE PROMPT
   - The content of each cell will be injected directly into the AI writing prompt for that section
   - Therefore, write each field as if you are giving detailed instructions to a brilliant writer
   - Be imperative, specific, and technical — not descriptive or vague`;

    const userPrompt = `Assessment Brief:
Title: ${brief.title || "Untitled"}
Type: ${brief.type || settings.type || "Essay"}
Subject: ${brief.subject || "Not specified"}
Word Count Target: ${brief.word_count || settings.wordCount || 3000}
Academic Level: ${brief.academic_level || settings.level || "Undergraduate"}
Citation Style: ${settings.citationStyle || "Harvard"}
Topic: ${settings.topic || brief.topic || "Not specified"}

Requirements:
${(brief.requirements || []).map((r: string) => `- ${r}`).join("\n") || "Not specified"}

Learning Outcomes:
${(brief.learning_outcomes || []).map((lo: string) => `- ${lo}`).join("\n") || "Not specified"}

Marking Criteria:
${(brief.marking_criteria || []).map((c: any) => `- ${c.criterion || c}: ${c.weight || ""}`).join("\n") || "Not specified"}

Specified Sections/Headings (if any):
${(brief.sections || brief.headings || []).map((h: string) => `- ${h}`).join("\n") || "None specified — infer from assessment type and brief content"}

Full Brief Text:
${brief.raw_text || brief.title || ""}

Create the execution table now. Every field must be detailed, specific, and actionable — not generic. The execution table IS the prompt that will generate A+ work. ONLY include sections the brief requires or implies. Do NOT add extras. Do NOT auto-assign frameworks the brief doesn't mention.`;

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
        tools: [{
          type: "function",
          function: {
            name: "create_execution_table",
            description: "Return the structured execution table with detailed per-section prompts",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Assessment title" },
                total_words: { type: "number", description: "Total word count target" },
                role_context: { type: "string", description: "Brief context about the role/perspective the writer should adopt" },
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Section heading exactly as in brief" },
                      word_target: { type: "number", description: "Exact word count for this section" },
                      purpose_scope: { type: "string", description: "Detailed purpose and analytical scope — what this section must achieve" },
                      learning_outcomes: { type: "string", description: "Learning outcomes this section addresses, mapped from the brief" },
                      required_inputs: { type: "string", description: "Specific evidence, data, sources, and examples needed" },
                      structure_formatting: { type: "string", description: "Paragraph-by-paragraph structure, tables, subheadings, formatting" },
                      a_plus_criteria: { type: "string", description: "Specific A+ marking criteria translated into actionable writing instructions" },
                      constraints: { type: "string", description: "Non-negotiable rules: citation mins, banned content, voice, formatting" },
                      citation_count: { type: "number", description: "Minimum number of in-text citations" },
                      framework: { type: "string", description: "Framework ONLY if brief explicitly specifies it — otherwise empty string" },
                      suggested_frameworks: {
                        type: "array",
                        items: { type: "string" },
                        description: "Frameworks ZOE suggests but user must approve. Empty if none or if brief already specifies."
                      },
                      sort_order: { type: "number", description: "Section order (0-indexed)" },
                    },
                    required: ["title", "word_target", "purpose_scope", "learning_outcomes", "required_inputs", "structure_formatting", "a_plus_criteria", "constraints", "citation_count", "sort_order"],
                    additionalProperties: false,
                  }
                }
              },
              required: ["title", "total_words", "sections"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "create_execution_table" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const plan = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify({ success: true, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("execution-table error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
