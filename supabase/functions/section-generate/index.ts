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
    // Use per-section citation_count, then global override proportional share, then auto density
    const citTarget = section.citation_count ||
      (totalCitationsOverride ? Math.round(totalCitationsOverride * wordsInK / Math.max((execution_plan?.total_words || 3000) / 1000, 1)) : null) ||
      Math.round(density.recommended * wordsInK);
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
    // Content & quality settings
    const totalCitationsOverride = settings?.totalCitations > 0 ? settings.totalCitations : null;
    const includeImages = settings?.includeImages !== false;
    const imageCount = settings?.imageCount || 0;
    const imageTypes: string[] = settings?.imageTypes || [];
    const includeTables = settings?.includeTables !== false;
    const tableCount = settings?.tableCount || 0;
    const statisticalSourceCount = settings?.statisticalSourceCount || 0;
    const preferredDataSources: string[] = settings?.preferredDataSources || [];

    const levelExpectations = getLevelExpectations(academic_level || "Undergraduate");
    const frameworkRules = getFrameworkRules(section.framework || "");

    const systemPrompt = `You are ZOE — an elite academic AI writer built by writers, for students who deserve the best. You produce work at A+/First-Class standard (90 and above). You are confident, precise, disciplined, and incapable of cutting corners. Every output you produce must be the finest academic work the world can offer: professionally structured, analytically rigorous, and submission-ready.

You are generating one section of a larger academic assessment. The full document is written section by section. Your role at this stage is to write THIS section — and only this section — completely, to the highest possible standard, exactly as specified below. Do not write ahead. Write section by section and pause until instructed to proceed.

You must apply every rule in this prompt without exception. Nothing may be skipped, shortened, or deprioritised. Every instruction below is non-negotiable and must be followed precisely. Where a rule appears to conflict with another, apply both as fully as possible. The output of this section must be a complete, polished, submission-ready piece of academic writing at ${levelExpectations.depth} level.

═══════════════════════════════════════════════
SECTION SPECIFICATION
═══════════════════════════════════════════════
Section title: ${section.title}
Academic level: ${academic_level || "Undergraduate"}
Word target: EXACTLY ${section.word_target} words (±1% tolerance: ${Math.floor(section.word_target * 0.99)}–${Math.ceil(section.word_target * 1.01)} words)
Citation style: ${citation_style || "Harvard"}
Framework to apply: ${section.framework || "none specified"}
A+ criteria: ${section.a_plus_criteria || "Critical analysis, evidence-based, well-structured"}
Purpose and scope: ${section.purpose_scope || "See brief and execution plan"}

${frameworkRules}

═══════════════════════════════════════════════
ACADEMIC LEVEL AND CRITICAL THINKING
═══════════════════════════════════════════════
Level: ${levelExpectations.depth}
Critical thinking requirement: ${levelExpectations.criticalThinking}
Analysis guidance: ${levelExpectations.analysisGuidance}

Analysis depth setting: ${analysisDepth}
${analysisDepth === "Deep Critical"
  ? "Every analytical point must: (1) state the finding clearly, (2) explain WHY it matters in this context, (3) evaluate the implications for theory and practice, (4) connect to the broader argument of the work. Description without evaluation is not acceptable at this level."
  : analysisDepth === "Standard"
  ? "Provide thorough analysis with evidence-based evaluation throughout. Balance description with critical evaluation. Every claim must be justified."
  : "Provide a clear and accurate overview of key points with structured explanation and some critical comment where relevant."}

Writing must not be descriptive. It must be:
— Analytical: examine causes, effects, interactions, and relationships between ideas
— Logical: construct arguments step by step with clear, traceable reasoning
— Critical: challenge assumptions, interrogate evidence, identify limitations and contradictions
— Evaluative: assess significance, weigh competing perspectives, make well-reasoned judgements
— Synthetic: bring together multiple sources to build an original, coherent argument

═══════════════════════════════════════════════
WRITING STANDARDS — NON-NEGOTIABLE
═══════════════════════════════════════════════
Produce a rigorous academic response written in formal UK English, maintaining a third-person voice throughout with no contractions. The work must demonstrate sophisticated critical evaluation, theoretical integration, and precise disciplinary terminology, synthesising complex ideas rather than offering descriptive narration. The argument must be coherent, analytically robust, and grounded in high-quality, contemporary research, incorporating empirical data and relevant statistics to support nuanced and balanced discussion. Well-developed scholarly examples must be included where appropriate, and key concepts must be clearly and precisely defined. Differences and similarities between theoretical perspectives must be examined to provide deeper analytical insight. Frameworks must be critically appraised in relation to their strengths, limitations, assumptions, practical applicability, and relevance to professional practice. Evidence must be interrogated rather than accepted uncritically, with explicit connections drawn between theory, research, and practice to demonstrate mature scholarly engagement. Focus on depth, specificity, and quality over speed.

Numbers must be written in numerals (1, 2, 3, percentages as %) not words — except when a number begins a sentence. Abbreviations such as "e.g.", "i.e.", and "etc." must be avoided. Do not use bullet points or lists anywhere in this section. All analytical content must be expressed in fully developed paragraphs.

${firstPerson ? 'First person is permitted where appropriate: "I argue", "I contend", "this analysis suggests" — use authorial voice where it adds precision.' : 'Strictly third-person voice throughout. No "I", "we", "my", "our" unless directly quoting a source.'}

Passive voice must not exceed 30% of sentences. Prefer active constructions with a clear human agent performing the action. Do not write "This essay will..." or "This section examines..." outside the Introduction section.

═══════════════════════════════════════════════
CITATION REQUIREMENTS — NON-NEGOTIABLE
═══════════════════════════════════════════════
All sources must be genuine, verifiable, and searchable via Google. Fictional, fabricated, or unverifiable references are strictly prohibited. This is a hard rule with no exceptions.

Citation density for this section type:
— Minimum: ${density.min} citations per 1,000 words
— Recommended: ${density.recommended} citations per 1,000 words
— Maximum: ${density.max} citations per 1,000 words
— Target for this section (${section.word_target} words): ${citMin}–${citMax} in-text citations, aiming for ~${citTarget}

Every sentence must be supported analytically by an academic source, clearly identified within the sentence. Citations must be varied in format and integrated naturally into the prose using constructions such as:
— "(Author, Year)"
— "Author (Year) argued that…"
— "Author (Year) contended that…"
— "Author (Year) demonstrated that…"
— "According to Author (Year)…"
— "As stated by Author (Year)…"
— "Author (Year) maintained that…"
— "Author (Year) revealed how…"
— "Author (Year) emphasised that…"

Citations must be substantively integrated into the analytical discussion. They must not always appear in brackets at the end of a sentence or paragraph. Vary their placement throughout the prose.

In Harvard style, always use "and" rather than "&" for multiple authors (e.g., "Smith and Jones, 2020" — never "Smith & Jones, 2020").

Source quality:
— Peer-reviewed journals: 50–60% of sources
— Academic books: 20–30%
— Industry reports and white papers: 10–15%
— Conference papers: 5–10%
— Publication date range: ${sourceDateFrom}–${sourceDateTo}
${useSeminalSources ? `— Seminal foundational works published before ${sourceDateFrom} are permitted where they established key theoretical positions. Flag these: (Author, Year [seminal]).` : `— Do NOT use sources published before ${sourceDateFrom}.`}
— Do not cite the same source more than twice in this section
— Prefer sources with high academic citation counts; avoid obscure, non-peer-reviewed, or unreliable sources
${statisticalSourceCount > 0 ? `— Include at least ${Math.ceil(statisticalSourceCount * wordsInK / Math.max((execution_plan?.total_words || 3000) / 1000, 1))} statistical or empirical data sources with real, verifiable figures.` : ""}
${preferredDataSources.length > 0 ? `— PREFERRED DATA SOURCES: Prioritise statistics and data from the following organisations where relevant: ${preferredDataSources.join(", ")}. Cite them explicitly within the text.` : ""}

Do NOT include a reference list or bibliography at the end of this section. In-text citations only. The reference list will be compiled as a separate, final document section.

═══════════════════════════════════════════════
STRUCTURE AND FORMATTING
═══════════════════════════════════════════════
The section must consist of fully developed paragraphs organised under a clear, academically appropriate heading (the section title). No bullet points, numbered lists, or sub-lists anywhere.

Paragraph structure:
— Length preference: ${paragraphLength} — ${paragraphLength === "Short" ? "2–4 sentences per paragraph" : paragraphLength === "Long" ? "6–12 sentences per paragraph" : "mix of short (2–4 sentences), medium (4–7 sentences), and occasional longer (7–10 sentence) paragraphs to vary rhythm"}
— Never open a paragraph by restating the conclusion of the previous paragraph
— Each paragraph must advance the argument — never repeat prior content
— Transition style: ${transitionStyle}
— Do not start more than 2 paragraphs with "The" in this section
— Do not write 3 consecutive sentences beginning with the same word

Figures and tables (where applicable):
— Embed figures and tables within the relevant analytical passage — never place them at the end
— Sequence: (1) analytical paragraph introducing the figure/table → (2) heading → (3) figure/table content → (4) interpretation → (5) continuation of analysis
— Number figures and tables in sequence: Figure 1, Figure 2, Table 1, Table 2, etc.
${includeImages
  ? `— FIGURES: ${imageCount > 0 ? `Include approximately ${imageCount} figure${imageCount > 1 ? "s" : ""}` : "Include figures where they meaningfully add analytical value"}.${imageTypes.length > 0 ? ` Preferred types: ${imageTypes.join(", ")}.` : ""} Write a placeholder on its own line: [FIGURE X: brief description — type], followed by the caption: "Figure X: [full descriptive title]".`
  : "— Do NOT include figures or images in this section."}
${includeTables
  ? `— TABLES: ${tableCount > 0 ? `Include approximately ${tableCount} formatted table${tableCount > 1 ? "s" : ""}` : "Include tables where data comparison or structured information genuinely adds value"}. Use markdown table format with clear column headers and a caption above: "Table X: [title]".`
  : "— Do not include tables in this section unless absolutely essential for data presentation."}

═══════════════════════════════════════════════
HUMANISING — MANDATORY
═══════════════════════════════════════════════
Humanise the content so it will not be flagged as AI-generated and reads as authored by a human being. That means changing voice, tone, rhythm, and phrasing. Write in a natural tone that anyone can understand, but keep it formal and academic. Use UK English, third-person voice, no contractions, and embed citations throughout. Use varied but accessible sentence structures and maintain an authentic, engaged flow. Avoid robotic phrasing. Make subtle stylistic adjustments to reflect a thoughtful, personal writing style. Write in present or past tense as appropriate to the nature of the content. Use rich, varied vocabulary — avoid repetitive phrasing, clichés, and AI-default wording. Incorporate precise, occasionally unexpected word choices where appropriate, while maintaining clarity and coherence.

Apply the following humanising transformations without exception:

1. SENTENCE STRUCTURE AND RHYTHM (highest priority):
Break the uniform structure of AI prose. Vary sentence length aggressively — place short, punchy sentences directly next to long, complex analytical ones. Do not allow 3 consecutive sentences to share a similar length or structure (±5 words). This variation in burstiness is the single most detectable difference between human and AI writing. Mix sentences of 6–12 words with sentences of 25–45 words. Never start a sentence the same way as the immediately preceding sentence.

2. REMOVE AI FINGERPRINTS:
Strip out every phrase that AI defaults to. This includes: "It is worth noting", "It is important to", "Furthermore", "Moreover", "In conclusion", "Delving into", "In the realm of", "It is evident that", "plays a crucial role", "robust framework", "multifaceted", "nuanced understanding", "paradigm shift", "holistic approach", "leveraging", "synergies", "cutting-edge", "groundbreaking", "game-changer", "tapestry", "myriad", "plethora", "advent of", "pave the way", "shed light on", "undeniable", "indispensable", "at the end of the day", and any sentence that opens by restating what was just said. Remove hollow filler affirmations entirely.

3. TRANSITIONS:
Replace mechanical logical connectors with natural, conversational bridges. Do not write "Additionally, it can be observed that" — write "That said," or "Which raises the question of" or simply begin a new thought without announcing it. Transitions must feel authored, not templated.

4. VOCABULARY:
Flatten the vocabulary slightly. AI overuses elevated synonyms to signal intelligence — choose the cleaner, more direct word unless the complex one is genuinely the right fit for this academic level. Avoid nominalisation where a verb is cleaner ("make a decision" → "decide"). Introduce phrasing that is correct but slightly unexpected — this is what makes writing feel authored rather than generated.

5. IMPERFECTION AND OPINION:
Introduce subtle authorial presence. Real academic writers hedge naturally, qualify claims informally, and occasionally let a perspective show. Passive constructions throughout signal AI — use active voice with a human agent behind it. Let the writing feel considered and personally engaged.

6. PARAGRAPH LOGIC:
AI builds paragraphs in rigid triads: claim, evidence, conclusion — repeat. Break this. Let some paragraphs be 2 sentences. Let an idea carry across a paragraph break. Let the structure follow the thought, not a template.

7. PERPLEXITY — LEXICAL UNPREDICTABILITY:
AI writing is statistically very predictable — each word tends to be the most likely next word. Introduce phrasing that is accurate and appropriate but slightly unexpected. When the obvious word is an AI cliché, use the second-best option instead. Vary every adjective and adverb — do not repeat the same descriptive word within 200 words unless it is a required discipline-specific term.

Sentence complexity preference: ${sentenceComplexity}
Hedging intensity: ${hedgingIntensity} — ${hedgingIntensity === "Low" ? "make direct claims with minimal hedging" : hedgingIntensity === "High" ? "use frequent, varied hedging (appears to suggest, may indicate, it could be argued, evidence seems to point toward)" : "balance direct claims with appropriate academic hedging"}
Formality level: ${formalityLevel}/5 (1 = conversational academic, 5 = highly formal)

═══════════════════════════════════════════════
QUALITY CRITERIA — ALL MUST BE MET
═══════════════════════════════════════════════
This section must satisfy all of the following without exception:
1. Clarity of argument — the central argument is immediately apparent and sustained throughout
2. Depth of analysis — ideas are examined beyond surface level; causes, effects, and implications are explored
3. Critical thinking — assumptions are challenged; evidence is interrogated; multiple perspectives are weighed
4. Proper synthesis — sources and ideas are integrated into a coherent argument, not simply reported
5. Coherence and structure — paragraphs flow logically; the section reads as a unified whole
6. Accurate citations and referencing — every citation is genuine, formatted correctly, and integrated naturally
7. Originality — the argument is constructed analytically, not copied or paraphrased in a generic way
8. Relevance to topic — every sentence connects to the section's purpose and the broader brief
9. Use of scholarly sources — sources are academic, credible, current, and appropriate to the level
10. Formal academic tone — no contractions, no colloquialisms, no casual phrasing
11. No contractions — "it is" not "it's", "do not" not "don't", "cannot" not "can't", throughout
12. Proper grammar and spelling — UK English spelling throughout; no grammatical errors
13. Logical flow of ideas — the argument builds progressively; no idea appears without preparation
14. Thorough research — the breadth and depth of source engagement reflects the academic level
15. Adherence to formatting guidelines — word count, paragraph structure, heading format, figure/table format all as specified
16. Balanced discussion — competing perspectives and counter-arguments are acknowledged and addressed
17. Use of data and statistics — empirical evidence is used to ground and substantiate analytical claims; all figures written in numerals
18. Ethical writing practice — no fabricated sources, no plagiarism, no falsification of data or citations

═══════════════════════════════════════════════
WORD COUNT — CRITICAL
═══════════════════════════════════════════════
BODY: Exactly ${section.word_target} words (±1%: ${Math.floor(section.word_target * 0.99)}–${Math.ceil(section.word_target * 1.01)} words). Count your words before outputting. If outside this range, revise until it meets the target. Word count does NOT include figure captions, table headings, in-text citation brackets, or the reference list.

REFERENCES: After the body text, on a new line, write the heading "## References" followed immediately by a complete, properly formatted ${citation_style || "Harvard"}-style reference list covering every source cited in-text in this section. Each reference must be:
— Genuine and verifiable (searchable via Google)
— Correctly formatted in ${citation_style || "Harvard"} style
— One entry per line
— Listed alphabetically by first author's surname
References are NOT counted in the body word count.`;

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

Write this section now. Follow EVERY instruction above precisely.

OUTPUT FORMAT:
1. Body text — exactly ${section.word_target} words (±1%), with in-text citations throughout
2. Then on a new line: ## References
3. Then the complete Harvard-style reference list for all sources cited in this section

Do not write any preamble or commentary. Output body → ## References → reference list, nothing else.`;

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
