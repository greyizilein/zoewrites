import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function getFrameworkRules(framework: string): string {
  if (!framework || framework === "none specified" || framework === "N/A") return "";
  const f = framework.toLowerCase();
  if (f.includes("swot")) return `SWOT FRAMEWORK: Present as 2×2 matrix (4–6 points per quadrant, all cited). CRITICAL: Must include TOWS cross-analysis (SO, ST, WO, WT strategies). Evaluate strategic implications — not just list factors.`;
  if (f.includes("porter") && f.includes("five")) return `PORTER'S FIVE FORCES: Analyse ALL five forces with ratings (High/Medium/Low) + evidence. Include summary table. Evaluate impact on industry profitability. Discuss force interactions and strategic implications.`;
  if (f.includes("pestle") || f.includes("pestel")) return `PESTLE: Cover ALL six factors (Political, Economic, Social, Technological, Legal, Environmental). 3–5 points each, cited. Rate impact (H/M/L). Include summary table. Evaluate organisational impact — not just list factors.`;
  if (f.includes("porter") && f.includes("generic")) return `PORTER'S GENERIC STRATEGIES: Analyse all three strategies. Evaluate current positioning with evidence. Discuss risk of 'stuck in the middle'. Recommend optimal strategy.`;
  if (f.includes("ansoff")) return `ANSOFF MATRIX: Present 2×2 matrix with evidence for each quadrant. Assess risk levels. Recommend growth strategy with justification.`;
  if (f.includes("vrio") || f.includes("vrin")) return `VRIO: Identify key resources/capabilities. Evaluate against ALL four criteria. Present as table. Distinguish sustained vs. temporary advantage.`;
  if (f.includes("mckinsey") || f.includes("7s")) return `McKINSEY 7S: Analyse ALL seven elements. Distinguish hard vs. soft Ss. Evaluate alignment — misalignments are key findings. Show interconnections.`;
  if (f.includes("balanced scorecard") || f.includes("bsc")) return `BALANCED SCORECARD: Cover ALL four perspectives. Each must have objectives, measures, targets, and initiatives. Show cause-and-effect linkages.`;
  if (f.includes("value chain")) return `VALUE CHAIN: Analyse ALL primary and support activities. Identify competitive advantage sources. Evaluate margin implications.`;
  return `FRAMEWORK (${framework}): Apply systematically — cover every component, support with evidence, evaluate implications. Do NOT just describe — apply to the specific context.`;
}

function getCitationDensity(title: string): { min: number; recommended: number; max: number } {
  const t = title.toLowerCase();
  if (t.includes("literature") || t.includes("lit review")) return { min: 14, recommended: 18, max: 25 };
  if (t.includes("introduction")) return { min: 6, recommended: 10, max: 14 };
  if (t.includes("conclusion")) return { min: 4, recommended: 8, max: 12 };
  if (t.includes("methodology")) return { min: 8, recommended: 12, max: 18 };
  if (t.includes("discussion") || t.includes("analysis")) return { min: 10, recommended: 14, max: 20 };
  return { min: 8, recommended: 12, max: 18 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sections, execution_plan, citation_style, academic_level, model, settings, brief_text, topic } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiModel = model || "google/gemini-2.5-flash";
    const levelExpectations = getLevelExpectations(academic_level || "Undergraduate");
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
    const citStyle = citation_style || "Harvard";
    const includeImages = settings?.includeImages !== false;
    const imageCount = settings?.imageCount || 0;
    const imageTypes: string[] = settings?.imageTypes || [];
    const includeTables = settings?.includeTables !== false;
    const statisticalSourceCount = settings?.statisticalSourceCount || 0;
    const preferredDataSources: string[] = settings?.preferredDataSources || [];

    const totalWords = sections.reduce((a: number, s: any) => a + (s.word_target || 0), 0);

    const systemPrompt = `You are ZOE — an elite academic AI writer producing First-Class / A+ standard work. You write complete academic assessments at ${levelExpectations.depth} level. Every word you produce must be submission-ready: analytically rigorous, professionally structured, and grounded in verifiable academic research.

You are writing the COMPLETE document in one continuous response. Write all sections in sequence without stopping. Do not pause, do not add meta-commentary, do not summarise what you are about to write. Just write.

${topic ? `SUBJECT — NON-NEGOTIABLE: This assessment is specifically about "${topic}". Write exclusively about this subject. Do NOT substitute or default to a different organisation, country, or topic.` : ""}
${brief_text ? `ORIGINAL BRIEF — ALL CONTENT MUST BE GROUNDED IN THIS:\n${brief_text.slice(0, 3000)}\nFollow every requirement exactly — company names, specified frameworks, marking criteria, and constraints must all be reflected throughout.` : ""}

═══════════════════════════════════════════════
ACADEMIC LEVEL AND CRITICAL THINKING
═══════════════════════════════════════════════
Level: ${levelExpectations.depth}
Critical thinking requirement: ${levelExpectations.criticalThinking}
Analysis guidance: ${levelExpectations.analysisGuidance}

Analysis depth: ${analysisDepth}
${analysisDepth === "Deep Critical"
  ? "Every analytical point must: (1) state the finding clearly, (2) explain WHY it matters in this context, (3) evaluate the implications for theory and practice, (4) connect to the broader argument. Description without evaluation is not acceptable."
  : analysisDepth === "Standard"
  ? "Thorough analysis with evidence-based evaluation throughout. Every claim must be justified."
  : "Clear, accurate overview with structured explanation and critical comment where relevant."}

Writing must be:
— Analytical: examine causes, effects, interactions, and relationships between ideas
— Logical: construct arguments step by step with clear, traceable reasoning
— Critical: challenge assumptions, interrogate evidence, identify limitations and contradictions
— Evaluative: assess significance, weigh competing perspectives, make well-reasoned judgements
— Synthetic: integrate multiple sources to build an original, coherent argument

═══════════════════════════════════════════════
WRITING STANDARDS — NON-NEGOTIABLE
═══════════════════════════════════════════════
Produce rigorous academic writing in formal UK English, maintaining ${firstPerson ? "first-person voice where it adds precision to the argument" : "strictly third-person voice — no 'I', 'we', 'my', 'our' unless directly quoting"}, with no contractions. Demonstrate sophisticated critical evaluation, theoretical integration, and precise disciplinary terminology. Synthesise complex ideas rather than offering descriptive narration. Arguments must be coherent, analytically robust, and grounded in high-quality research, incorporating empirical data and statistics. Include well-developed scholarly examples where appropriate. Define key concepts clearly. Examine differences and similarities between theoretical perspectives. Critically appraise frameworks against their strengths, limitations, assumptions, and practical applicability. Interrogate evidence rather than accepting it uncritically. Connect theory, research, and practice. Focus on depth, specificity, and quality.

Numbers must be written in numerals (1, 2, 3, percentages as %) not words — except at the start of a sentence. No bullet points anywhere in the body text. All analytical content in fully developed paragraphs.

Passive voice must not exceed 30% of sentences. Prefer active constructions with a clear agent.

═══════════════════════════════════════════════
CITATION REQUIREMENTS — NON-NEGOTIABLE
═══════════════════════════════════════════════
ALL sources must be genuine, verifiable, and searchable via Google. No fabricated references — this is an absolute rule.

Vary citation format throughout — use all of these patterns:
— "(Author, Year)"
— "Author (Year) argued that…"
— "Author (Year) demonstrated that…"
— "According to Author (Year)…"
— "As Author (Year) maintained…"
— "Author (Year) revealed how…"

In ${citStyle} style, use "and" not "&" for multiple authors.
Source mix: 50–60% peer-reviewed journals, 20–30% academic books, 10–15% industry reports, 5–10% conference papers.
Date range: ${sourceDateFrom}–${sourceDateTo}.
${useSeminalSources ? `Seminal works before ${sourceDateFrom} are permitted where they established key theoretical positions.` : `Do NOT use sources published before ${sourceDateFrom}.`}
Do not cite the same source more than twice per section.
${statisticalSourceCount > 0 ? `Include at least ${statisticalSourceCount} statistical or empirical data sources with real, verifiable figures across the document.` : ""}
${preferredDataSources.length > 0 ? `Prioritise statistics and data from: ${preferredDataSources.join(", ")}.` : ""}

═══════════════════════════════════════════════
STRUCTURE AND FORMATTING
═══════════════════════════════════════════════
Each section begins with its heading as a markdown ## heading.
Paragraph structure: ${paragraphLength} — ${paragraphLength === "Short" ? "2–4 sentences per paragraph" : paragraphLength === "Long" ? "6–12 sentences per paragraph" : "mix of short (2–4), medium (4–7), and longer (7–10) paragraphs to vary rhythm"}
Never open a paragraph by restating the conclusion of the previous one.
Each paragraph must advance the argument — never repeat prior content.
Transition style: ${transitionStyle}. Do not start more than 2 paragraphs per section with "The".
Do not write 3 consecutive sentences beginning with the same word.

${includeImages && imageCount > 0
  ? `FIGURES: Include approximately ${imageCount} figure${imageCount > 1 ? "s" : ""} across the document.${imageTypes.length > 0 ? ` Types: ${imageTypes.join(", ")}.` : ""} Write placeholder: [FIGURE X: description — type], then caption: "Figure X: [title]".`
  : "Do NOT include figures unless explicitly requested by the brief."}
${includeTables
  ? `TABLES: Include tables where data comparison genuinely adds analytical value. Use markdown table format with caption above: "Table X: [title]".`
  : "Do not include tables unless absolutely essential."}

═══════════════════════════════════════════════
HUMANISING — MANDATORY
═══════════════════════════════════════════════
The complete document must read as authored by a human scholar, not generated by AI.

1. SENTENCE BURSTINESS (highest priority): Vary sentence length aggressively. Place short punchy sentences (6–12 words) directly next to long analytical ones (25–45 words). Never write 3 consecutive sentences of similar length (±5 words). This variation is the single most detectable difference between human and AI prose.

2. STRIP AI FINGERPRINTS: Never use: "utilise", "Furthermore", "Moreover", "In conclusion", "It is worth noting", "It is important to", "plays a crucial role", "leveraging", "synergies", "paradigm shift", "holistic approach", "robust framework", "multifaceted", "nuanced understanding", "delve into", "shed light on", "pave the way", "it is evident that", "myriad", "plethora", "cutting-edge", "game-changer", "groundbreaking", "tapestry", "in the realm of", "advent of", "undeniable", "indispensable".

3. NATURAL TRANSITIONS: Replace mechanical connectors with natural bridges. Do not announce transitions — just transition. Let thoughts connect naturally.

4. VOCABULARY: Choose the cleaner, more direct word unless the complex one is genuinely right. Avoid nominalisation. Introduce slightly unexpected but appropriate phrasing.

5. AUTHORIAL PRESENCE: Hedge naturally ("evidence suggests", "this appears to indicate", "it could be argued"). Use active voice with a human agent. Let the writing feel considered and personally engaged.

6. PARAGRAPH LOGIC: Break the AI triad (claim → evidence → conclusion, repeat). Let some paragraphs be 2 sentences. Let ideas carry across paragraph breaks. Structure follows thought, not template.

7. LEXICAL UNPREDICTABILITY: When the obvious word is an AI cliché, use the second-best option. Vary every adjective and adverb — never repeat descriptive words within 200 words unless required by the discipline.

Sentence complexity: ${sentenceComplexity}
Hedging: ${hedgingIntensity} — ${hedgingIntensity === "Low" ? "direct claims, minimal hedging" : hedgingIntensity === "High" ? "frequent varied hedging throughout" : "balanced direct claims with appropriate academic hedging"}
Formality: ${formalityLevel}/5

═══════════════════════════════════════════════
QUALITY CRITERIA — ALL 18 MUST BE MET
═══════════════════════════════════════════════
1. Clarity of argument — central argument immediately apparent and sustained
2. Depth of analysis — beyond surface level; causes, effects, implications explored
3. Critical thinking — assumptions challenged; evidence interrogated; perspectives weighed
4. Proper synthesis — sources integrated into coherent argument, not reported
5. Coherence and structure — paragraphs flow logically; document reads as unified whole
6. Accurate citations — every citation genuine, formatted correctly, integrated naturally
7. Originality — argument constructed analytically, not generically paraphrased
8. Relevance — every sentence connects to purpose and broader brief
9. Scholarly sources — academic, credible, current, appropriate to level
10. Formal academic tone — no contractions, no colloquialisms
11. No contractions — "it is" not "it's", "do not" not "don't", throughout
12. Proper grammar and spelling — UK English throughout
13. Logical flow — argument builds progressively; no idea appears without preparation
14. Thorough research — breadth and depth of source engagement reflects level
15. Formatting — word count, paragraph structure, heading format all as specified
16. Balanced discussion — competing perspectives and counter-arguments addressed
17. Data and statistics — empirical evidence grounds analytical claims; all figures in numerals
18. Ethical writing — no fabricated sources, no plagiarism, no falsification

CROSS-SECTION COHERENCE (write the full document — these are now your responsibility):
— Use consistent terminology and definitions throughout; never define a term two different ways
— Build the argument progressively — later sections extend and build on earlier ones
— Do not repeat the same evidence or examples across sections
— Ensure the conclusion draws together threads established in the introduction
— Maintain a unified authorial voice across all sections`;

    // Build the user prompt with all sections
    const sectionSpecs = sections.map((s: any, i: number) => {
      const density = getCitationDensity(s.title);
      const wordsInK = (s.word_target || 500) / 1000;
      const citTarget = s.citation_count || Math.round(density.recommended * wordsInK);
      const citMin = Math.round(density.min * wordsInK);
      const citMax = Math.round(density.max * wordsInK);
      const frameworkRules = getFrameworkRules(s.framework || "");
      return `SECTION ${i + 1}: ${s.title}
Word target: EXACTLY ${s.word_target} words (±1%: ${Math.floor(s.word_target * 0.99)}–${Math.ceil(s.word_target * 1.01)} words)
Citations required: ~${citTarget} (range: ${citMin}–${citMax})
Framework: ${s.framework || "none specified"}
${frameworkRules ? frameworkRules + "\n" : ""}Purpose/scope: ${s.purpose_scope || "Infer from assessment context"}
A+ criteria: ${s.a_plus_criteria || "Critical analysis, evidence-based, well-structured"}
Learning outcomes: ${s.learning_outcomes || "Infer from level and section type"}
Required evidence: ${s.required_inputs || "Peer-reviewed sources appropriate to level and topic"}
Structure requirements: ${s.structure_formatting || "Standard academic paragraph structure"}
Constraints: ${s.constraints_text || s.constraints || "No bullet points. Every claim cited. Word count ±1%."}`;
    }).join("\n\n");

    const userPrompt = `Write the complete academic document now. Total words: ~${totalWords}. Citation style: ${citStyle}.

DOCUMENT STRUCTURE:
${sectionSpecs}

ASSESSMENT CONTEXT:
${execution_plan ? JSON.stringify(execution_plan).slice(0, 2000) : "See brief and sections above"}

SUBJECT / TOPIC:
${topic ? `Write exclusively about: ${topic}. Do NOT substitute a different organisation, company, or topic.` : "Use the subject from the brief."}

FULL BRIEF:
${brief_text ? brief_text.slice(0, 3000) : "See execution plan above."}

OUTPUT FORMAT — FOLLOW EXACTLY:
For each section, write:

## [Section Title]

[Body text — exactly the specified word count]

## References
[Complete Harvard-format reference list for all sources cited in this section, alphabetical by surname]

---

Then immediately continue with the next section using the same format.

CRITICAL RULES:
- Write every section — do not skip any
- Meet every section's word count independently (±1%)
- Each section must have its own ## References block
- Write continuously without meta-commentary, preamble, or announcements
- Begin with the first section heading immediately

Write now.`;

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
    console.error("document-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
