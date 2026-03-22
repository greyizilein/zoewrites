import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Infer citation density targets based on section title/type */
function getCitationDensity(title: string): { min: number; recommended: number; max: number } {
  // Target: 12 citations per 1000 words baseline
  const t = title.toLowerCase();
  if (t.includes("literature") || t.includes("lit review") || t.includes("lit.")) return { min: 14, recommended: 18, max: 25 };
  if (t.includes("introduction")) return { min: 6, recommended: 10, max: 14 };
  if (t.includes("conclusion")) return { min: 4, recommended: 8, max: 12 };
  if (t.includes("methodology") || t.includes("method")) return { min: 8, recommended: 12, max: 18 };
  if (t.includes("discussion") || t.includes("analysis")) return { min: 10, recommended: 14, max: 20 };
  if (t.includes("finding") || t.includes("result")) return { min: 8, recommended: 12, max: 16 };
  if (t.includes("recommendation")) return { min: 6, recommended: 10, max: 14 };
  // Default: 12 per 1000 words
  return { min: 8, recommended: 12, max: 18 };
}

/** Get academic level depth multiplier and expectations */
function getLevelExpectations(level: string): { depth: string; criticalThinking: string; analysisGuidance: string } {
  const l = level.toLowerCase();
  if (l.includes("doctoral")) return {
    depth: "DOCTORAL",
    criticalThinking: "Original contribution to knowledge required. Challenge existing paradigms. Synthesise across disciplines. Demonstrate methodological sophistication and epistemological awareness.",
    analysisGuidance: "Every framework application must interrogate assumptions, identify contradictions between models, propose extensions or modifications. Engage with counter-arguments at the deepest level."
  };
  if (l.includes("l7") || l.includes("postgraduate") || l.includes("masters")) return {
    depth: "POSTGRADUATE (L7)",
    criticalThinking: "Demonstrate mastery of subject through sophisticated critical evaluation. Synthesise multiple theoretical perspectives. Identify limitations and propose alternatives. Show independent thought beyond taught material.",
    analysisGuidance: "Framework analyses must go beyond surface application — interrogate why each factor matters, how factors interact, what the strategic implications are, and what the limitations of the framework itself are in this context."
  };
  if (l.includes("l6")) return {
    depth: "UNDERGRADUATE L6 (Final Year)",
    criticalThinking: "Strong critical evaluation expected. Compare and contrast theoretical positions. Evaluate evidence quality. Demonstrate ability to form independent, evidence-based judgements.",
    analysisGuidance: "Apply frameworks with depth: explain each component, support with evidence, evaluate significance, and draw strategic conclusions. Go beyond description to evaluation."
  };
  if (l.includes("l5")) return {
    depth: "UNDERGRADUATE L5",
    criticalThinking: "Developing critical thinking. Compare different perspectives. Begin to evaluate evidence and form arguments. Show awareness of complexity.",
    analysisGuidance: "Apply frameworks thoroughly: explain, illustrate with examples, and begin to evaluate significance. Balance description with analysis."
  };
  return {
    depth: "UNDERGRADUATE L4",
    criticalThinking: "Demonstrate understanding of key concepts. Apply theories to examples. Show ability to describe and explain with some evaluation.",
    analysisGuidance: "Apply frameworks clearly: define terms, describe each component, provide examples. Begin to offer evaluation where possible."
  };
}

/** Get framework application rules for common strategic/analytical frameworks */
function getFrameworkRules(framework: string): string {
  const f = framework.toLowerCase();
  
  if (f.includes("swot")) return `
SWOT ANALYSIS — INDUSTRY-STANDARD APPLICATION:
- Structure as a 2×2 matrix (Strengths, Weaknesses, Opportunities, Threats) presented as a markdown table
- Each quadrant must contain 4–6 substantive points, not single words
- Every point must be evidence-based with citations
- CRITICAL: After the matrix, provide a TOWS cross-analysis showing how strengths can exploit opportunities (SO), how strengths can counter threats (ST), how opportunities can overcome weaknesses (WO), and how to minimise weaknesses and avoid threats (WT)
- Do NOT just list factors — evaluate their relative importance and strategic implications
- Connect internal factors (S/W) to external factors (O/T) explicitly
- Rank factors by significance where applicable`;

  if (f.includes("porter") && f.includes("five")) return `
PORTER'S FIVE FORCES — INDUSTRY-STANDARD APPLICATION:
- Analyse ALL five forces: (1) Threat of New Entrants, (2) Bargaining Power of Suppliers, (3) Bargaining Power of Buyers, (4) Threat of Substitutes, (5) Competitive Rivalry
- Each force must be rated (High/Medium/Low) with evidence-based justification
- Include a summary table rating each force
- CRITICAL: Do NOT just describe each force — evaluate its IMPACT on industry profitability
- Discuss how forces interact and reinforce each other
- Consider dynamic changes: how forces are shifting over time
- End with strategic implications: what does the five forces picture mean for the firm?`;

  if (f.includes("pestle") || f.includes("pestel") || f.includes("pest")) return `
PESTLE ANALYSIS — INDUSTRY-STANDARD APPLICATION:
- Cover ALL six factors: Political, Economic, Social, Technological, Legal, Environmental
- Each factor must have 3–5 substantive points with current evidence and citations
- Present as a structured analysis with clear subheadings per factor
- CRITICAL: Do NOT just list macro-environmental factors — evaluate their IMPACT on the organisation/industry
- Rate each factor's significance (High/Medium/Low impact)
- Consider interconnections between PESTLE factors
- Include a summary table showing key factors, impact level, and strategic implications
- Use current data and statistics (within source date range)`;

  if (f.includes("porter") && f.includes("generic")) return `
PORTER'S GENERIC STRATEGIES — APPLICATION:
- Analyse all three strategies: Cost Leadership, Differentiation, Focus (Cost Focus + Differentiation Focus)
- Evaluate which strategy the organisation currently pursues with evidence
- Assess strategy fit with industry structure (link to Five Forces if applicable)
- Discuss risks of being "stuck in the middle"
- Recommend optimal strategic positioning with justification`;

  if (f.includes("ansoff")) return `
ANSOFF MATRIX — APPLICATION:
- Present as a 2×2 matrix: Market Penetration, Market Development, Product Development, Diversification
- Evaluate each quadrant's applicability to the organisation with evidence
- Assess risk levels for each strategy
- Recommend optimal growth strategy with justification`;

  if (f.includes("vrio") || f.includes("vrin")) return `
VRIO/VRIN FRAMEWORK — APPLICATION:
- Identify key resources and capabilities
- Evaluate each against ALL four criteria: Valuable, Rare, Inimitable (costly to imitate), Organised (non-substitutable)
- Present as a table showing each resource against VRIO criteria
- Identify which resources provide sustained competitive advantage vs. temporary advantage vs. competitive parity
- Link to strategic recommendations`;

  if (f.includes("mckinsey") || f.includes("7s")) return `
McKINSEY 7S FRAMEWORK — APPLICATION:
- Analyse ALL seven elements: Strategy, Structure, Systems, Shared Values, Skills, Style, Staff
- Distinguish hard Ss (Strategy, Structure, Systems) from soft Ss (Shared Values, Skills, Style, Staff)
- Evaluate alignment between elements — misalignments are key findings
- Present interconnections visually or in a structured table
- Focus on how misalignment drives organisational problems`;

  if (f.includes("balanced scorecard") || f.includes("bsc")) return `
BALANCED SCORECARD — APPLICATION:
- Cover ALL four perspectives: Financial, Customer, Internal Business Processes, Learning & Growth
- Each perspective must have specific objectives, measures, targets, and initiatives
- Show cause-and-effect linkages between perspectives
- Present as a structured table or framework`;

  if (f.includes("value chain")) return `
VALUE CHAIN ANALYSIS — APPLICATION:
- Analyse ALL primary activities: Inbound Logistics, Operations, Outbound Logistics, Marketing & Sales, Service
- Analyse ALL support activities: Firm Infrastructure, HR Management, Technology Development, Procurement
- Identify sources of competitive advantage in each activity
- Evaluate margin implications
- Link to cost drivers and differentiation opportunities`;

  // Generic framework guidance
  if (framework && framework !== "none specified" && framework !== "N/A") return `
FRAMEWORK APPLICATION — "${framework}":
- Apply this framework systematically and completely — cover every component
- Support each analytical point with evidence and citations
- Do NOT just describe the framework — APPLY it to the specific context
- Present findings in a structured format (tables where appropriate)
- Evaluate implications and strategic significance of findings
- Identify limitations of the framework in this context`;

  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { section, execution_plan, prior_sections_summary, citation_style, academic_level, model, settings, brief_text, topic } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiModel = model || "google/gemini-2.5-flash";
    const density = getCitationDensity(section.title);
    const wordsInK = section.word_target / 1000;
    const citTarget = section.citation_count || Math.round(density.recommended * wordsInK);
    const citMin = Math.round(density.min * wordsInK);
    const citMax = Math.round(density.max * wordsInK);

    // Extract advanced settings with defaults
    const formalityLevel = settings?.formalityLevel || 4;
    const hedgingIntensity = settings?.hedgingIntensity || "Medium";
    const firstPerson = settings?.firstPerson || false;
    const sentenceComplexity = settings?.sentenceComplexity || "Mixed";
    const transitionStyle = settings?.transitionStyle || "Formal connectors";
    const paragraphLength = settings?.paragraphLength || "Medium";
    const sourceDateFrom = settings?.sourceDateFrom || "2015";
    const sourceDateTo = settings?.sourceDateTo || "2025";
    const useSeminalSources = settings?.useSeminalSources !== false;
    const analysisDepth = settings?.analysisDepth || "Deep Critical";

    const levelExpectations = getLevelExpectations(academic_level || "Undergraduate");
    const frameworkRules = getFrameworkRules(section.framework || "");

    const systemPrompt = `You are ZOE — an elite academic AI writer built by writers, for students who can't afford one. You write at A+/First-Class standard. You are confident, precise, and proactive. Your output must be the very best the world can offer — professional, industry-standard quality.

ACADEMIC LEVEL: ${levelExpectations.depth}
CRITICAL THINKING EXPECTATIONS: ${levelExpectations.criticalThinking}
ANALYSIS GUIDANCE: ${levelExpectations.analysisGuidance}

ANALYSIS DEPTH: ${analysisDepth}
${analysisDepth === "Deep Critical" ? "- Every analytical point must: (1) State the finding, (2) Explain WHY it matters, (3) Evaluate implications, (4) Connect to broader argument. Never be descriptive — be evaluative." :
  analysisDepth === "Standard" ? "- Provide thorough analysis with evidence-based evaluation. Balance description with critical evaluation." :
  "- Provide clear overview with key points. Focus on accurate description with some evaluation."}

WRITING MUST NOT BE DESCRIPTIVE. It MUST be:
- Analytical: examine causes, effects, and relationships
- Logical: build arguments step by step with clear reasoning chains
- Deeply critical: challenge assumptions, evaluate evidence quality, identify limitations
- Evaluative: assess significance, compare alternatives, make judgements

${frameworkRules}

WRITING RULES:
1. Write EXACTLY ${section.word_target} words (±1% tolerance: ${Math.floor(section.word_target * 0.99)}–${Math.ceil(section.word_target * 1.01)} words)
2. Use ${citation_style || "Harvard"} citation style with real, verifiable academic sources. IMPORTANT: In Harvard style, use "and" NOT "&" for multiple authors (e.g., "Smith and Jones, 2020" not "Smith & Jones, 2020").
3. Academic level: ${academic_level || "Undergraduate"}
4. Use the framework "${section.framework || "none specified"}" where applicable — apply it COMPLETELY and IN-DEPTH following the framework rules above
5. Meet these A+ criteria: ${section.a_plus_criteria || "Critical analysis, evidence-based, well-structured"}

CITATION DENSITY (per 1,000 words for this section type):
- Minimum: ${density.min} | Recommended: ${density.recommended} | Maximum: ${density.max}
- Target for this section: ${citMin}–${citMax} in-text citations (aim for ~${citTarget})
- Include in-text citations within the text body. Do NOT include a reference list or bibliography at the end — references will be compiled separately as a final document section.

SOURCE QUALITY RULES:
- Source type distribution: peer-reviewed journals 50–60%, books 20–30%, reports/white papers 10–15%, conference papers 5–10%
- No circular citations: do not cite the same source more than twice in this section
- Publication date range: ${sourceDateFrom}–${sourceDateTo}
${useSeminalSources ? "- Seminal/foundational works published before " + sourceDateFrom + " are permitted when they established key theoretical positions. Flag these parenthetically (e.g., 'Porter, 1985 [seminal]')." : "- Do NOT use sources published before " + sourceDateFrom + "."}
- For APA/Vancouver styles, include DOIs where applicable
- Prefer sources with high citation counts; avoid obscure or non-peer-reviewed sources unless contextually essential

SENTENCE BURSTINESS (critical for human-like writing):
- Never write three consecutive sentences of similar length (±5 words)
- Mix short punchy sentences (6–12 words) with longer analytical ones (25–45 words)
- Sentence complexity preference: ${sentenceComplexity}
- Begin sentences with conjunctions ("But", "And", "Yet") occasionally — ~10% of sentences
- Begin some sentences with dependent clauses, prepositions, or adverbs
- Never start a sentence the same way as the previous sentence

LEXICAL UNPREDICTABILITY:
- When the "obvious" word is an AI cliché, choose the second-best alternative
- Vary vocabulary: do not repeat the same adjective/adverb within 200 words unless discipline-specific terminology

AUTHORIAL PRESENCE:
- Formality level: ${formalityLevel}/5 (1=conversational academic, 5=highly formal)
- Hedging intensity: ${hedgingIntensity} — ${hedgingIntensity === "Low" ? "make direct claims with minimal hedging" : hedgingIntensity === "High" ? "use frequent hedging (appears to suggest, may indicate, it could be argued)" : "balance direct claims with appropriate hedging"}
- ${firstPerson ? 'First person is ALLOWED: use "I argue", "I contend" where appropriate for authorial voice' : 'Strictly third-person voice. No "I", "we", "my" unless quoting.'}
- Natural hedging: "this appears to suggest", "evidence indicates", "it could be argued"
- Passive voice ≤30% of sentences — prefer active constructions with human agents
- Do NOT use "This essay will..." or "This section examines..." outside the Introduction

PARAGRAPH STRUCTURE:
- Paragraph length preference: ${paragraphLength} — ${paragraphLength === "Short" ? "2–4 sentences per paragraph" : paragraphLength === "Long" ? "6–12 sentences per paragraph" : "mix short (2–4), medium (4–7), and occasional long (7–10) paragraphs"}
- Never open a paragraph by restating the previous paragraph's conclusion
- Each paragraph must advance the argument, not repeat prior points
- Transition style: ${transitionStyle}

BANNED PHRASES — never use any of these:
"utilise", "utilize", "multifaceted", "furthermore", "it is worth noting", "in today's world", "since the dawn of time", "plays a crucial role", "it is important to note", "in conclusion it can be said", "leveraging", "synergies", "paradigm shift", "holistic approach", "robust framework", "comprehensive analysis", "nuanced understanding", "delve into", "shed light on", "pave the way", "at the end of the day", "undeniable", "indispensable", "pivotal role", "cutting-edge", "state-of-the-art", "game-changer", "groundbreaking", "tapestry", "in the realm of", "it is evident that", "myriad", "plethora", "advent of"

STRUCTURAL RULES:
- Do NOT start paragraphs with "The" more than twice in the section
- Do NOT write three consecutive sentences beginning with the same word
- Include seamless transitions between paragraphs
- Every claim must be supported by evidence or logical reasoning
- If comparative data or structured information is needed, include properly formatted markdown tables inline (using | column | separators |)
- If figures or tables are referenced, include a heading like "Table 1: Description" or "Figure 1: Description" on its own line

WORD COUNT IS CRITICAL. Count your words. The section MUST be within ±1% of ${section.word_target} words.`;

    const userPrompt = `SECTION: ${section.title}
TARGET WORDS: ${section.word_target}
FRAMEWORK: ${section.framework || "N/A"}
CITATIONS REQUIRED: ~${citTarget} (range: ${citMin}–${citMax})

─── SECTION PURPOSE & ANALYTICAL SCOPE ───
${section.purpose_scope || section.a_plus_criteria || "Not specified"}

─── LEARNING OUTCOMES TO DEMONSTRATE ───
${section.learning_outcomes || "Not specified — infer from assessment type and level"}

─── REQUIRED EVIDENCE & SOURCES ───
${section.required_inputs || "Use peer-reviewed academic sources appropriate to the topic and level"}

─── STRUCTURE & FORMATTING REQUIREMENTS ───
${section.structure_formatting || "Follow standard academic paragraph structure with clear topic sentences and logical flow"}

─── A+ MARKING CRITERIA ───
${section.a_plus_criteria || "Critical analysis, evidence-based argumentation, well-structured prose"}

─── NON-NEGOTIABLE CONSTRAINTS ───
${section.constraints || "No bullet points. Every claim cited. Word count ±1%."}

SUBJECT / COMPANY / TOPIC — CRITICAL:
${topic ? `The assessment is specifically about: ${topic}. You MUST write exclusively about this subject. Do NOT substitute or default to a different organisation, company, or topic.` : "Use the subject identified in the brief below."}

ORIGINAL BRIEF (ground ALL content in this — company names, data, requirements, and frameworks specified here must be followed exactly):
${brief_text ? brief_text.slice(0, 3000) : "See execution plan for context."}

ASSESSMENT CONTEXT:
${execution_plan ? JSON.stringify(execution_plan) : "Full assessment plan not provided"}

PRIOR SECTIONS SUMMARY (maintain terminology consistency — use the same terms, theoretical positions, and definitions established here):
${prior_sections_summary || "This is the first section."}

Write this section now. Follow EVERY instruction above precisely. EXACTLY ${section.word_target} words (±1%). Include in-text citations but NO reference list at the end.`;

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
    console.error("section-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
