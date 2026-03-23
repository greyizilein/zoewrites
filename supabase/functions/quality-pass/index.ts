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

/** Extract required framework components for any named framework */
function getFrameworkComponents(frameworkName: string): string[] {
  if (!frameworkName) return [];
  const f = frameworkName.toLowerCase();
  if (f.includes("swot")) return ["Strengths quadrant", "Weaknesses quadrant", "Opportunities quadrant", "Threats quadrant", "TOWS cross-analysis (SO, ST, WO, WT strategies)"];
  if (f.includes("pestle") || f.includes("pestel")) return ["Political factors", "Economic factors", "Social factors", "Technological factors", "Legal factors", "Environmental factors", "Impact ratings per factor", "Strategic implications summary"];
  if (f.includes("pest")) return ["Political factors", "Economic factors", "Social factors", "Technological factors"];
  if (f.includes("porter") && f.includes("five")) return ["Threat of New Entrants", "Bargaining Power of Suppliers", "Bargaining Power of Buyers", "Threat of Substitutes", "Competitive Rivalry", "Force ratings (High/Medium/Low)", "Industry profitability implications"];
  if (f.includes("porter") && f.includes("generic")) return ["Cost Leadership strategy analysis", "Differentiation strategy analysis", "Focus strategy analysis", "Current strategy identification", "Stuck-in-the-middle risk assessment"];
  if (f.includes("ansoff")) return ["Market Penetration quadrant", "Market Development quadrant", "Product Development quadrant", "Diversification quadrant", "Risk assessment per strategy", "Recommended strategic direction"];
  if (f.includes("vrio") || f.includes("vrin")) return ["Resource/capability identification", "Value assessment", "Rarity assessment", "Inimitability assessment", "Organisation/Non-substitutability assessment", "VRIO summary table", "Competitive advantage conclusions"];
  if (f.includes("mckinsey") || f.includes("7s")) return ["Strategy element", "Structure element", "Systems element", "Shared Values element", "Skills element", "Style element", "Staff element", "Hard vs Soft S distinction", "Inter-element alignment analysis"];
  if (f.includes("balanced scorecard") || f.includes("bsc")) return ["Financial perspective", "Customer perspective", "Internal Business Processes perspective", "Learning & Growth perspective", "Objectives per perspective", "Cause-and-effect linkages"];
  if (f.includes("value chain")) return ["Inbound Logistics", "Operations", "Outbound Logistics", "Marketing & Sales", "Service (primary activities)", "Firm Infrastructure", "HR Management", "Technology Development", "Procurement (support activities)", "Margin analysis"];
  if (f.includes("bcg") || f.includes("boston")) return ["Stars quadrant", "Cash Cows quadrant", "Question Marks quadrant", "Dogs quadrant", "Portfolio positioning", "Strategic recommendations per category"];
  if (f.includes("tows")) return ["SO strategies (strengths + opportunities)", "ST strategies (strengths + threats)", "WO strategies (weaknesses + opportunities)", "WT strategies (weaknesses + threats)"];
  if (f.includes("5 whys") || f.includes("five whys")) return ["Problem statement", "Why 1", "Why 2", "Why 3", "Why 4", "Why 5", "Root cause identification", "Corrective action recommendation"];
  if (f.includes("fishbone") || f.includes("ishikawa")) return ["Problem/effect statement", "People causes", "Process causes", "Equipment causes", "Environment causes", "Materials causes", "Root cause analysis"];
  if (f.includes("stakeholder")) return ["Stakeholder identification", "Power assessment", "Interest assessment", "Power-interest matrix", "Engagement strategy per stakeholder group"];
  // Generic — any named framework: require all components to be explicitly applied
  return ["Complete application of all named components", "Evidence-based analysis for each component", "Summary table or structured presentation", "Strategic implications", "Framework limitations discussion"];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, execution_plan, sections: sectionsList, word_target, model, brief_text, requirements, marking_criteria, learning_outcomes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiModel = model || "google/gemini-2.5-flash";

    // Strip references blocks from word count
    const bodyContent = content.replace(/\n## References[\s\S]*?(?=\n## [A-Z]|\n---|\n==|$)/gi, "").replace(/\n## References[\s\S]*$/i, "");
    const foundBanned = BANNED_PHRASES.filter(p => bodyContent.toLowerCase().includes(p.toLowerCase()));
    const wordCount = bodyContent.split(/\s+/).filter(Boolean).length;
    const wordDiff = wordCount - (word_target || wordCount);
    const wordDiffPercent = word_target ? ((wordDiff / word_target) * 100).toFixed(1) : "0";

    // Build framework verification context
    const frameworksInPlay: { section: string; framework: string; components: string[] }[] = [];
    if (sectionsList && Array.isArray(sectionsList)) {
      for (const sec of sectionsList) {
        if (sec.framework && sec.framework.toLowerCase() !== "none specified" && sec.framework !== "N/A") {
          const comps = getFrameworkComponents(sec.framework);
          if (comps.length > 0) {
            frameworksInPlay.push({ section: sec.title, framework: sec.framework, components: comps });
          }
        }
      }
    }

    // Build brief compliance section for prompt
    const hasRequirements = requirements && requirements.length > 0;
    const hasMarkingCriteria = marking_criteria && marking_criteria.length > 0;
    const hasLearningOutcomes = learning_outcomes && learning_outcomes.length > 0;
    const hasBrief = brief_text && brief_text.trim().length > 0;

    let briefCompliancePrompt = "";
    if (hasBrief || hasRequirements || hasMarkingCriteria || hasLearningOutcomes) {
      briefCompliancePrompt = `\n\nBRIEF COMPLIANCE (most important check):
${hasBrief ? `ORIGINAL BRIEF:\n${brief_text}\n` : ""}
${hasRequirements ? `REQUIREMENTS:\n${requirements.map((r: string, i: number) => `R${i + 1}: ${r}`).join("\n")}\n` : ""}
${hasMarkingCriteria ? `MARKING CRITERIA:\n${marking_criteria.map((c: any, i: number) => `MC${i + 1}: ${typeof c === "string" ? c : `${c.criterion} (${c.weight || "unweighted"})`}`).join("\n")}\n` : ""}
${hasLearningOutcomes ? `LEARNING OUTCOMES:\n${learning_outcomes.map((lo: string, i: number) => `LO${i + 1}: ${lo}`).join("\n")}\n` : ""}
For each: check if fully addressed. Flag as CRITICAL if not addressed. Note which section addresses it.`;
    }

    let frameworkPrompt = "";
    if (frameworksInPlay.length > 0) {
      frameworkPrompt = `\n\nFRAMEWORK VERIFICATION (verify EVERY required component is present):
${frameworksInPlay.map(f => `Section "${f.section}" uses ${f.framework}. Required components:\n${f.components.map((c, i) => `  ${i + 1}. ${c}`).join("\n")}`).join("\n\n")}
For each component: is it present in the content? If missing or incomplete: flag as CRITICAL issue tagged to that section.`;
    }

    const systemPrompt = `You are ZOE's quality assurance engine. Critically evaluate this academic work to A+ standards.

EVALUATE in this priority order:
1. FRAMEWORK COMPLETENESS — Every named framework must have ALL required components applied. Missing components = CRITICAL issues.
2. BRIEF COMPLIANCE — Every requirement, marking criterion, and learning outcome must be fully addressed.
3. ARGUMENT COHERENCE — Logical flow, no contradictions, each section advances the argument.
4. EVIDENCE QUALITY — Citation density, source credibility, empirical data support.
5. CRITICAL ANALYSIS DEPTH — Not descriptive. Evaluative. Interrogates evidence.
6. WRITING QUALITY — Sentence variety, academic tone, no AI patterns.
7. WORD COUNT — Target: ${word_target}, current body: ${wordCount} (${wordDiffPercent}% diff).
8. BANNED PHRASES — Found: ${foundBanned.length > 0 ? foundBanned.join(", ") : "none"}.
${briefCompliancePrompt}
${frameworkPrompt}

CRITICAL: Every issue MUST have a section field identifying exactly which section it belongs to. Use the exact section title from the content. If an issue is global (applies to whole document), use "Document" as the section value. Never leave section blank.`;

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
            description: "Return quality assessment with section-tagged issues and framework verification",
            parameters: {
              type: "object",
              properties: {
                overall_grade: { type: "string", enum: ["A+", "A", "B+", "B", "C+", "C", "D", "F"] },
                word_count_status: { type: "string", enum: ["within_tolerance", "over", "under"] },
                banned_phrases_found: { type: "array", items: { type: "string" } },
                brief_compliance: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      requirement: { type: "string" },
                      type: { type: "string", enum: ["requirement", "marking_criterion", "learning_outcome"] },
                      status: { type: "string", enum: ["fully_met", "partially_met", "not_met"] },
                      addressed_in: { type: "string" },
                      detail: { type: "string" },
                    },
                    required: ["requirement", "status", "detail"],
                    additionalProperties: false,
                  }
                },
                framework_checks: {
                  type: "array",
                  description: "Per-framework completeness verification",
                  items: {
                    type: "object",
                    properties: {
                      section_title: { type: "string", description: "Which section uses this framework" },
                      framework: { type: "string" },
                      required_components: { type: "array", items: { type: "string" } },
                      present: { type: "array", items: { type: "string" }, description: "Components confirmed present" },
                      missing: { type: "array", items: { type: "string" }, description: "Components missing or incomplete" },
                      completeness_score: { type: "number", description: "0-100 percentage complete" },
                    },
                    required: ["section_title", "framework", "present", "missing", "completeness_score"],
                    additionalProperties: false,
                  }
                },
                issues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      severity: { type: "string", enum: ["critical", "major", "minor"] },
                      section: { type: "string", description: "Exact section title this issue belongs to. Use 'Document' for global issues. REQUIRED." },
                      description: { type: "string" },
                      suggestion: { type: "string" },
                    },
                    required: ["severity", "section", "description", "suggestion"],
                    additionalProperties: false,
                  }
                },
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
