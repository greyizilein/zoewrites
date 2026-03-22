import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BANNED_PHRASES = [
  "utilise", "utilize", "multifaceted", "furthermore", "it is worth noting",
  "in today's world", "since the dawn of time", "plays a crucial role",
  "it is important to note", "in conclusion it can be said",
  "leveraging", "synergies", "paradigm shift", "holistic approach",
  "robust framework", "comprehensive analysis", "nuanced understanding",
  "delve into", "shed light on", "pave the way", "at the end of the day",
  "undeniable", "indispensable", "pivotal role", "cutting-edge",
  "state-of-the-art", "game-changer", "groundbreaking",
  "tapestry", "in the realm of", "it is evident that", "myriad", "plethora", "advent of",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, execution_plan, word_target, model, brief_text, requirements, marking_criteria, learning_outcomes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiModel = model || "google/gemini-2.5-flash";

    const foundBanned = BANNED_PHRASES.filter(p => content.toLowerCase().includes(p.toLowerCase()));
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const wordDiff = wordCount - (word_target || wordCount);
    const wordDiffPercent = word_target ? ((wordDiff / word_target) * 100).toFixed(1) : "0";

    // Build brief compliance section for prompt
    const hasRequirements = requirements && requirements.length > 0;
    const hasMarkingCriteria = marking_criteria && marking_criteria.length > 0;
    const hasLearningOutcomes = learning_outcomes && learning_outcomes.length > 0;
    const hasBrief = brief_text && brief_text.trim().length > 0;

    let briefCompliancePrompt = "";
    if (hasBrief || hasRequirements || hasMarkingCriteria || hasLearningOutcomes) {
      briefCompliancePrompt = `\n\nBRIEF COMPLIANCE CHECK (CRITICAL — this is the most important evaluation):
You MUST evaluate the work against the ORIGINAL BRIEF requirements. This is not optional.

${hasBrief ? `ORIGINAL BRIEF TEXT:\n${brief_text}\n` : ""}
${hasRequirements ? `SPECIFIC REQUIREMENTS:\n${requirements.map((r: string, i: number) => `R${i + 1}: ${r}`).join("\n")}\n` : ""}
${hasMarkingCriteria ? `MARKING CRITERIA:\n${marking_criteria.map((c: any, i: number) => `MC${i + 1}: ${typeof c === "string" ? c : `${c.criterion} (${c.weight || "unweighted"})`}`).join("\n")}\n` : ""}
${hasLearningOutcomes ? `LEARNING OUTCOMES:\n${learning_outcomes.map((lo: string, i: number) => `LO${i + 1}: ${lo}`).join("\n")}\n` : ""}

For each requirement, marking criterion, and learning outcome:
- Check if the work ADDRESSES it specifically
- If addressed: note which section addresses it and how well
- If NOT addressed or only partially addressed: flag as CRITICAL issue
- Check for sections in the work that were NOT requested by the brief (flag as "unrequested section" — minor issue)`;
    }

    const systemPrompt = `You are ZOE — an elite academic AI writer built by writers, for students who can't afford one. You are the quality assurance engine. Critique this academic work against A+ standards AND against the original brief requirements.

EVALUATE:
1. Brief compliance — does the work address every requirement, marking criterion, and learning outcome from the original brief? This is the MOST IMPORTANT check.
2. Argument coherence and logical flow
3. Evidence quality and citation density
4. Critical analysis depth (not just description)
5. Writing quality (sentence variety, academic tone, no AI patterns)
6. Word count compliance (target: ${word_target}, current: ${wordCount}, diff: ${wordDiffPercent}%)
7. Banned phrase usage: ${foundBanned.length > 0 ? foundBanned.join(", ") : "None found"}
8. Structural integrity — do sections match what the brief asked for?
${briefCompliancePrompt}

RESPOND with specific corrections needed. If word count exceeds target by >1%, specify which passages to trim.`;

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
          { role: "user", content: `Execution Plan:\n${JSON.stringify(execution_plan)}\n\nFull Content:\n${content}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "quality_report",
            description: "Return quality assessment with brief compliance",
            parameters: {
              type: "object",
              properties: {
                overall_grade: { type: "string", enum: ["A+", "A", "B+", "B", "C+", "C", "D", "F"] },
                word_count_status: { type: "string", enum: ["within_tolerance", "over", "under"] },
                banned_phrases_found: { type: "array", items: { type: "string" } },
                brief_compliance: {
                  type: "array",
                  description: "Per-requirement compliance check",
                  items: {
                    type: "object",
                    properties: {
                      requirement: { type: "string", description: "The requirement/criterion/LO text" },
                      type: { type: "string", enum: ["requirement", "marking_criterion", "learning_outcome"] },
                      status: { type: "string", enum: ["fully_met", "partially_met", "not_met"] },
                      addressed_in: { type: "string", description: "Which section addresses this" },
                      detail: { type: "string", description: "How well it's addressed or what's missing" },
                    },
                    required: ["requirement", "status", "detail"],
                    additionalProperties: false,
                  }
                },
                issues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      severity: { type: "string", enum: ["critical", "major", "minor"] },
                      section: { type: "string" },
                      description: { type: "string" },
                      suggestion: { type: "string" },
                    },
                    required: ["severity", "description", "suggestion"],
                    additionalProperties: false,
                  }
                },
                revised_content: { type: "string", description: "Full revised content with all fixes applied. Only include if changes were needed." },
                summary: { type: "string" },
              },
              required: ["overall_grade", "word_count_status", "issues", "summary"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "quality_report" } },
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
    const report = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify({
      success: true,
      report,
      pre_check: { word_count: wordCount, word_target, diff_percent: wordDiffPercent, banned_phrases: foundBanned }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("quality-pass error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
