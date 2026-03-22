import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Common strategic frameworks and their applicability signals */
const FRAMEWORK_MAP: Record<string, { triggers: string[]; description: string }> = {
  "SWOT Analysis": { triggers: ["strategic", "strengths", "weaknesses", "opportunities", "threats", "internal", "external"], description: "Internal strengths/weaknesses + external opportunities/threats with TOWS cross-analysis" },
  "Porter's Five Forces": { triggers: ["industry", "competitive", "rivalry", "market forces", "barriers to entry", "bargaining", "substitutes"], description: "Industry attractiveness analysis: rivalry, entry threats, buyer/supplier power, substitutes" },
  "PESTLE Analysis": { triggers: ["macro", "political", "economic", "social", "technological", "legal", "environmental", "external environment"], description: "Macro-environmental scanning across 6 dimensions" },
  "Porter's Generic Strategies": { triggers: ["competitive advantage", "cost leadership", "differentiation", "focus strategy", "competitive positioning"], description: "Strategic positioning: cost leadership, differentiation, or focus" },
  "Ansoff Matrix": { triggers: ["growth", "market penetration", "market development", "product development", "diversification"], description: "Growth strategy options across markets and products" },
  "VRIO Framework": { triggers: ["resources", "capabilities", "competitive advantage", "resource-based", "rbv", "sustained advantage"], description: "Resource evaluation: Valuable, Rare, Inimitable, Organised" },
  "McKinsey 7S": { triggers: ["organisational", "organizational", "alignment", "culture", "structure", "systems", "shared values"], description: "Organisational alignment across 7 elements" },
  "Value Chain Analysis": { triggers: ["value chain", "primary activities", "support activities", "operations", "logistics", "margin"], description: "Activity-level analysis of value creation and cost drivers" },
  "Balanced Scorecard": { triggers: ["performance measurement", "kpi", "financial perspective", "customer perspective", "balanced"], description: "Multi-perspective performance measurement framework" },
  "BCG Matrix": { triggers: ["portfolio", "market share", "market growth", "stars", "cash cows", "dogs", "question marks"], description: "Product/business portfolio analysis" },
  "Stakeholder Analysis": { triggers: ["stakeholder", "power", "interest", "influence", "mendelow"], description: "Mapping stakeholder power, interest, and influence" },
  "Force Field Analysis": { triggers: ["change management", "driving forces", "restraining forces", "lewin"], description: "Change analysis: driving vs restraining forces" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, section_title, word_target, citation_count, framework, execution_plan, model, brief_text, assessment_type, academic_level } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiModel = model || "google/gemini-2.5-flash";
    const wordCount = (content || "").split(/\s+/).filter(Boolean).length;

    // Auto-detect which frameworks would benefit this section
    const fullText = `${section_title} ${content || ""} ${brief_text || ""} ${assessment_type || ""}`.toLowerCase();
    const relevantFrameworks = Object.entries(FRAMEWORK_MAP)
      .filter(([name, { triggers }]) => {
        // Don't recommend a framework already assigned
        if (framework && name.toLowerCase().includes(framework.toLowerCase())) return false;
        return triggers.some(t => fullText.includes(t));
      })
      .map(([name, { description }]) => ({ name, description }));

    const frameworkRecPrompt = relevantFrameworks.length > 0
      ? `\n\nFRAMEWORK RECOMMENDATIONS AVAILABLE:\nBased on the content, these additional frameworks could strengthen the analysis:\n${relevantFrameworks.map(f => `- ${f.name}: ${f.description}`).join("\n")}\nIf appropriate, include a recommendation to apply one or more of these.`
      : "";

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
            content: `You are ZOE — an elite academic AI writer built by writers, for students who can't afford one. You write at A+/First-Class standard. You are confident, precise, and proactive.

Analyse the section and provide 3–5 specific, actionable recommendations to improve it to A+ standard. Focus on:
1. ANALYTICAL DEPTH — is the section descriptive or truly analytical/critical? Flag any descriptive passages that need to become evaluative.
2. FRAMEWORK APPLICATION — is the framework applied completely and in-depth? Are all components covered? Is there cross-analysis?
3. EVIDENCE QUALITY — are citations sufficient, current, and from quality sources?
4. ARGUMENT STRUCTURE — does each paragraph advance the argument? Are there logical gaps?
5. MISSING ANALYSES — would additional frameworks or analytical tools strengthen this section?
${frameworkRecPrompt}

Academic level: ${academic_level || "Undergraduate"} — calibrate expectations accordingly.`
          },
          {
            role: "user",
            content: `Section: ${section_title}\nWord target: ${word_target}, Current: ${wordCount}\nFramework: ${framework || "N/A"}\nExpected citations: ${citation_count || "appropriate"}\nAssessment type: ${assessment_type || "Not specified"}\n\nContent:\n${(content || "").slice(0, 4000)}`
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "provide_recommendations",
            description: "Return structured recommendations including framework suggestions",
            parameters: {
              type: "object",
              properties: {
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["citation", "argument", "structure", "style", "framework", "word-count", "analysis-depth", "missing-framework"] },
                      severity: { type: "string", enum: ["high", "medium", "low"] },
                      description: { type: "string" },
                      action: { type: "string", description: "Specific instruction for revision" },
                      suggested_framework: { type: "string", description: "If type is missing-framework, name the framework to apply" },
                    },
                    required: ["type", "severity", "description", "action"],
                    additionalProperties: false,
                  },
                },
                analysis_score: {
                  type: "object",
                  description: "How analytical vs descriptive the section is",
                  properties: {
                    descriptive_pct: { type: "number", description: "Percentage of content that is descriptive (0-100)" },
                    analytical_pct: { type: "number", description: "Percentage of content that is analytical/critical (0-100)" },
                    verdict: { type: "string", enum: ["highly_analytical", "mostly_analytical", "balanced", "mostly_descriptive", "descriptive"] },
                  },
                  required: ["descriptive_pct", "analytical_pct", "verdict"],
                  additionalProperties: false,
                },
              },
              required: ["recommendations", "analysis_score"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "provide_recommendations" } },
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
    const result = toolCall ? JSON.parse(toolCall.function.arguments) : { recommendations: [], analysis_score: null };

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("zoe-recommend error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
