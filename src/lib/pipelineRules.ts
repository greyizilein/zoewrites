/**
 * ZOE Pipeline Rules v2 — Master quality rules and prompt builders.
 * Extracted from ZOE_Pipeline_Rules.txt + ZOE_pipeline.jsx.txt
 */

/* ═══════════════════════════════════════════════════
   CONSTANTS — Quality rules (verbatim from v2 spec)
═══════════════════════════════════════════════════ */

export const WRITING_RULES = `WRITING QUALITY RULES

Writing: Produce a rigorous academic response that adheres strictly to a prescribed word count and is written in formal UK English, maintaining a third-person voice throughout with no contractions. The work must demonstrate sophisticated critical evaluation, theoretical integration, and precise disciplinary terminology, synthesising complex ideas rather than offering descriptive narration. The argument should be coherent, analytically robust, and grounded in high-quality, contemporary research, incorporating empirical data and relevant statistics to support nuanced and balanced discussion. Well-developed scholarly examples should be included where appropriate, and key concepts must be clearly and precisely defined. Differences and similarities between theoretical perspectives should be examined to provide deeper analytical insight, and frameworks must be critically appraised in relation to their strengths, limitations, assumptions, practical applicability, and relevance to professional practice. Evidence must be interrogated rather than accepted uncritically, with explicit connections drawn between theory, research, and practice to demonstrate mature scholarly engagement. Focus on depth, specificity, and quality.

Structure: The structure must consist of fully developed paragraphs organised under clear, academically appropriate headings, with no bullet points or lists anywhere in the body of the work. Figures and tables, where required, must be embedded within the relevant sections rather than placed at the end, following this sequence: preceding analytical paragraph, figure or table heading, interpretation or description, and continuation of analysis. Numbers must be written in numerals (1, 2, 3) not words, except when a number begins a sentence. Abbreviations such as "e.g.", "i.e.", and "etc." must be avoided. The final work must meet core academic standards of clarity, structural coherence, originality, relevance, rigorous engagement with evidence, accuracy of citation, ethical scholarly practice, and advanced critical insight.`;

export const HUMANISATION_RULES = `HUMANISATION RULES

Humanise the content so it will not be flagged as written by AI. Apply every one of the following transformations without exception:

Sentence structure and rhythm: Break the robotic uniformity of AI prose. Vary sentence length aggressively — place short, punchy sentences next to longer, more complex ones. Do not let three consecutive sentences share a similar length or structure. This variation in "burstiness" is the single most detectable difference between human and AI writing, so treat it as a priority.

Remove AI fingerprints: Strip out all phrases that AI defaults to. This includes openers like "It is worth noting", "It is important to", "Furthermore", "Moreover", "In conclusion", "Delving into", "In the realm of", and any sentence that begins by restating what was just said. Remove hollow filler affirmations entirely.

Transitions: Replace mechanical logical connectors with natural, conversational bridges. Humans do not write "Additionally, it can be observed that" — they write "That said," or "Which raises the question of" or simply start a new thought without flagging it.

Vocabulary: Flatten the vocabulary slightly. AI overuses elevated synonyms to signal intelligence — choose the cleaner, more direct word unless the complex one is genuinely the right fit. Avoid nominalisation where a verb would do ("make a decision" becomes "decide").

Imperfection and opinion: Introduce subtle authorial presence. Real writers hedge naturally, qualify claims informally, and occasionally let a perspective bleed through. Passive constructions everywhere signal AI — use active voice with a human behind it.

Paragraph logic: AI tends to build paragraphs in rigid triads — claim, evidence, conclusion, repeat. Break this. Let some paragraphs be two sentences. Let an idea carry across a paragraph break. Let the structure follow the thought, not a template.

Perplexity: Increase lexical unpredictability. AI writing is statistically very predictable — each word is the most likely next word. Introduce phrasing that is correct but slightly unexpected. This is what makes writing feel authored rather than generated.`;

export const QUALITY_CRITERIA = `QUALITY CRITERIA

The completed work must satisfy every one of the following without exception: Clarity of Argument, Depth of Analysis, Critical Thinking, Proper Synthesis of Information, Coherence and Structure, Accurate Citations and Referencing, Originality, Relevance to Topic, Use of Scholarly Sources, Formal Academic Tone, No contractions, Proper Grammar and Spelling, Logical Flow of Ideas, Thorough Research, Adherence to Formatting Guidelines, Balanced Discussion of Different Perspectives, Use of Data and Statistics, and Ethical Writing Practices (no fabricated sources, no plagiarism).`;

export const LEVEL_MAP: Record<string, string> = {
  "Undergraduate L4": "Level 4 undergraduate",
  "Undergraduate L5": "Level 5 undergraduate",
  "Undergraduate L6": "Level 6 undergraduate / Honours",
  "Postgraduate L7": "Level 7 postgraduate",
  "Level 4": "Level 4 undergraduate",
  "Level 5": "Level 5 undergraduate",
  "Level 6": "Level 6 undergraduate / Honours",
  "Masters": "Level 7 postgraduate",
  "Doctoral": "Level 8 doctoral",
  "Professional": "professional / CPD",
};

/* ═══════════════════════════════════════════════════
   PROMPT BUILDER — assembles the master execution prompt
═══════════════════════════════════════════════════ */

export interface PromptSettings {
  assessmentType: string;
  wordCount: number;
  citStyle: string;
  level: string;
  tone: string;
  humanisation: string;
  burstiness: number;
  briefText: string;
  title: string;
  module: string;
  moduleCode: string;
  learningOutcomes: string;
  rubric: string;
  sectionSpecs: string;
  dateFrom: number;
  dateTo: number;
  seminal: boolean;
  totalCitations: number;
  topic: string;
}

export function buildMasterPrompt(s: PromptSettings): string {
  const totalCitations = Math.max(20, s.totalCitations || Math.round(s.wordCount / 90));
  const introWc = Math.round(s.wordCount * 0.07);
  const concWc = Math.round(s.wordCount * 0.07);

  return `ROLE

You are a ${LEVEL_MAP[s.level] || "postgraduate"} academic writer completing a ${s.assessmentType.toLowerCase()} assignment${s.module ? ` for ${s.module}${s.moduleCode ? ` (${s.moduleCode})` : ""}` : ""}. You write exclusively in formal UK English, in third person, with no contractions at any point. You demonstrate sophisticated critical evaluation, theoretical integration, and precise disciplinary terminology throughout. Every claim is grounded in genuine, verifiable academic sources. You write as a human scholar — with natural variation in sentence rhythm, authentic scholarly transitions, and analytical depth that goes well beyond surface description.

CONTEXT

${s.title ? `Assessment title: ${s.title}\n` : ""}${s.module ? `Module: ${s.module}${s.moduleCode ? ` (${s.moduleCode})` : ""}\n` : ""}Academic level: ${LEVEL_MAP[s.level] || s.level}
Total word count: ${s.wordCount.toLocaleString()} words — this is a hard ceiling. The complete work must not exceed ${Math.round(s.wordCount * 1.01).toLocaleString()} words under any circumstances.
Citation style: ${s.citStyle}
Tone: ${s.tone || "Analytical"}
Humanisation: ${s.humanisation || "High"}

${s.briefText ? `ASSIGNMENT BRIEF\n\n${s.briefText}\n` : ""}
${s.learningOutcomes ? `LEARNING OUTCOMES\n\n${s.learningOutcomes}\n` : ""}
${s.rubric ? `MARKING RUBRIC / A+ CRITERIA\n\n${s.rubric}\n` : ""}

EXECUTION COMMAND

Write the complete ${s.wordCount.toLocaleString()}-word ${s.assessmentType.toLowerCase()} in full, in one continuous uninterrupted output from the first word of the introduction to the final word of the conclusion, followed immediately and without any break by the complete reference list. Do not stop at any point. Do not announce sections before writing them. Do not ask for confirmation at any stage. Do not summarise what you are about to do. Begin writing immediately and produce the entire work now.

COMPLETE WORK SPECIFICATION

${s.sectionSpecs || buildDefaultSectionSpecs(s.assessmentType, s.wordCount, introWc, concWc)}

CITATION RULES

A minimum of ${totalCitations} new and distinct academic sources must be used across the complete work, with no repetition of previously cited works and no duplication of references. All sources must be genuine, verifiable, and searchable via Google Scholar — fabricated references are strictly prohibited. Publication dates must fall between ${s.dateFrom || 2015} and ${s.dateTo || 2025}${s.seminal ? ", with the exception of foundational seminal works published before this range where their historical significance is directly relevant to the argument" : ""}. Every sentence must be analytically supported by a named academic source. Citations must be woven into the prose using varied scholarly constructions: "(Author, Year)," "Author (Year) argued that...," "contended that...," "demonstrated that...," "according to," "as stated by," "maintained that," "revealed how," "emphasised that." Citations must not always appear bracketed at the end of a sentence — they must be substantively integrated. All in-text citations must follow ${s.citStyle} style${s.citStyle.includes("Harvard") ? " using 'and' not '&'" : ""}. The complete reference list appears at the end of the work, is excluded from the word count, and must be formatted to ${s.citStyle} standard without exception.

${WRITING_RULES}

${HUMANISATION_RULES}

${QUALITY_CRITERIA}`;
}

/* ═══════════════════════════════════════════════════
   DEFAULT SECTION SPECIFICATIONS
═══════════════════════════════════════════════════ */

export function buildDefaultSectionSpecs(type: string, wc: number, introWc?: number, concWc?: number): string {
  const iWc = introWc || Math.round(wc * 0.07);
  const cWc = concWc || Math.round(wc * 0.07);
  const bodyWc = wc - iWc - cWc;
  const sectionWc = Math.round(bodyWc / 3);

  const specs: Record<string, string> = {
    "Business Report": `Introduction (${iWc} words): Open by identifying the precise strategic, operational, or analytical problem the report addresses. Do not open with a definition or a broad contextual sweep. Establish the scope explicitly — what is included and what is deliberately excluded. Present a clear analytical thesis that signals the report's central argument or finding. Signpost the major sections in the order they will appear. Integrate a minimum of 3 citations that establish the scholarly and industry context. Word count ceiling: ${Math.round(iWc * 1.01)} words absolute maximum.

Main Analysis — Section 1 (${sectionWc} words): Conduct the first major dimension of analysis specified in the brief. Apply the relevant theoretical framework or model directly to the specific organisational context — do not describe the framework in general terms before applying it. Use data, statistics, and empirical evidence throughout. Evaluate the framework's strengths and limitations in this specific context. Every substantive claim must cite a genuine source. Integrate any required figures or tables within the section, preceded by an analytical paragraph and followed by interpretation. Word count ceiling: ${Math.round(sectionWc * 1.01)} words.

Main Analysis — Section 2 (${sectionWc} words): Address the second major analytical dimension. Build directly on the argument established in the preceding section — do not restart the context. Deepen the critical analysis by examining competing perspectives or theoretical tensions. Include specific organisational examples and industry data. Continue the citation pattern established — varied constructions, substantively integrated. Word count ceiling: ${Math.round(sectionWc * 1.01)} words.

Main Analysis — Section 3 (${sectionWc} words): Synthesise the preceding analysis into strategic recommendations or evaluative conclusions. These must flow logically from the evidence presented and be grounded in the theoretical frameworks applied. Recommendations must be specific, feasible, and supported by academic evidence — not generic best practice. Address implementation considerations and potential limitations. Word count ceiling: ${Math.round(sectionWc * 1.01)} words.

Conclusion (${cWc} words): Synthesise the central argument of the report without introducing new evidence or analysis. Draw explicit connections between each section's findings and the original thesis. Evaluate the implications of the analysis for the organisation or industry. Close with a forward-looking statement grounded in the evidence. Do not use "In conclusion" as an opener. Word count ceiling: ${Math.round(cWc * 1.01)} words.`,

    "Essay": `Introduction (${iWc} words): Open with a sentence that locates the specific intellectual tension or debate the essay will interrogate. Do not open with a definition, a broad historical sweep, or a restatement of the question. Establish the interpretive angle clearly. Present a clear thesis that signals the essay's central argument. Signpost the line of reasoning in the order it will unfold. Integrate a minimum of 3 citations establishing the scholarly context. Word count ceiling: ${Math.round(iWc * 1.01)} words.

Main Body — First Argument (${sectionWc} words): Develop the first major strand of the argument in full. Apply relevant theory directly to evidence — do not summarise theory before applying it. Interrogate the evidence rather than accepting it at face value. Use a minimum of 6 distinct sources in this section. Vary citation constructions throughout. Acknowledge counterarguments and address them analytically. Word count ceiling: ${Math.round(sectionWc * 1.01)} words.

Main Body — Second Argument (${sectionWc} words): Develop the second major strand, building directly on the first. Deepen the analytical complexity — introduce nuance, theoretical tension, or empirical contradiction. Synthesise multiple sources rather than discussing them sequentially. Every paragraph must advance the central thesis rather than simply adding supporting points. Word count ceiling: ${Math.round(sectionWc * 1.01)} words.

Main Body — Critical Synthesis (${sectionWc} words): Bring the two preceding arguments into analytical dialogue with each other. Identify points of convergence, tension, and theoretical implication. This section should represent the most analytically ambitious part of the essay. Draw on the broadest range of sources while maintaining argumentative coherence. Word count ceiling: ${Math.round(sectionWc * 1.01)} words.

Conclusion (${cWc} words): Return to the thesis and evaluate it in light of the evidence presented. Do not summarise each section — synthesise the argument's trajectory. Identify the key analytical insight the essay has produced. Address the broader significance or implications for the field. Do not introduce new evidence. Do not open with "In conclusion" or "To summarise." Word count ceiling: ${Math.round(cWc * 1.01)} words.`,
  };

  return specs[type] || (specs["Essay"] || "").replace(/Essay/g, type);
}

/* ═══════════════════════════════════════════════════
   BUILD AI ANALYSIS PROMPT — asks AI to create section specs
═══════════════════════════════════════════════════ */

export function buildAnalysePrompt(s: PromptSettings): string {
  return `You are helping to build a detailed academic writing execution prompt.

Brief: ${s.briefText || `A ${s.assessmentType} of ${s.wordCount} words at ${s.level} level.`}
Assessment type: ${s.assessmentType}
Total word count: ${s.wordCount}
Level: ${s.level}
Module: ${s.module || "Not specified"}
Citation style: ${s.citStyle}

Write ONLY the COMPLETE WORK SPECIFICATION section of the execution prompt. This means: for each section of the ${s.assessmentType}, write one dense, detailed prose paragraph specifying exactly:
- The section heading (academically appropriate, no generic headings like "Body")
- The exact word count target (distribute the ${s.wordCount} words proportionally: introduction ~${Math.round(s.wordCount * 0.07)}w, body sections distributed proportionally, conclusion ~${Math.round(s.wordCount * 0.07)}w)
- The precise analytical content required in that section — be specific to the topic, not generic
- Which specific theories, frameworks, models, or data to apply or analyse
- The A+ criteria this section must satisfy
- The minimum citation count for this section
- The word count ceiling (target × 1.01, rounded down)

Write each section specification as a complete, detailed prose paragraph. No tables. No bullet points. No markdown headers. Just flowing prose paragraphs, one per section, separated by a blank line. Cover every section from introduction to conclusion. Do not include the reference list specification — just write [REFERENCE LIST: follows immediately after the conclusion, formatted to ${s.citStyle} standard, excluded from word count.] at the end.`;
}

/* ═══════════════════════════════════════════════════
   EDIT PASS PROMPTS
═══════════════════════════════════════════════════ */

export function buildProofreadPrompt(text: string): string {
  return `Proofread and correct the following academic text. Fix ALL of: grammar errors, spelling mistakes, punctuation issues, inconsistent tense, sentence fragments, run-on sentences, UK English violations (colour not color, organisation not organization, realise not realize, whilst not while, behaviour not behavior, etc.), and any contractions. Do not change the content, structure, or citations. Do not add or remove paragraphs. Return ONLY the corrected text with no commentary.

TEXT:
${text}`;
}

export function buildCitationAuditPrompt(text: string, citStyle: string): string {
  return `Review the following academic text for citation compliance. Apply these corrections:
1. Ensure every sentence has an analytical citation — add [CITATION NEEDED] where missing
2. Vary citation constructions — convert any that always appear as "(Author, Year)" at sentence end to integrated narrative forms: "Author (Year) argued that...", "as demonstrated by Author (Year)...", etc.
3. Check all in-text citations follow ${citStyle} style with "and" not "&"
4. Ensure citations are substantively woven into sentences, not just appended
Return ONLY the corrected text. Do not add a reference list.

TEXT:
${text}`;
}

export function buildHumanisePrompt(text: string, burstiness: number): string {
  const bLevel = ["Very Low", "Low", "Medium", "High", "Maximum"][burstiness - 1] || "High";
  return `Apply the following humanisation transformations to the academic text below. Apply every instruction without exception:

1. SENTENCE BURSTINESS (${bLevel} setting): Vary sentence length ${burstiness >= 4 ? "aggressively" : "moderately"} — short punchy sentences next to longer complex ones. No three consecutive sentences of similar length or structure.

2. REMOVE AI FINGERPRINTS: Strip every instance of: "It is worth noting", "It is important to", "Furthermore", "Moreover", "In conclusion", "Delving into", "In the realm of", "In today's", "This essay will", "This report will", "It can be argued", "It should be noted". Remove all hollow filler affirmations.

3. NATURAL TRANSITIONS: Replace mechanical connectors with natural bridges. "Additionally, it can be observed that" → "That said," or just start the next thought directly.

4. VOCABULARY: Choose cleaner, more direct words. Reduce nominalisation ("conduct an analysis of" → "analyse"). Flatten elevated synonyms to their natural equivalents unless the complex word is genuinely the right fit.

5. PARAGRAPH LOGIC: Break rigid triads. Allow two-sentence paragraphs. Let ideas carry across paragraph breaks. Let structure follow thought, not template.

6. AUTHORIAL PRESENCE: Use active voice. Let a perspective bleed through occasionally — real writers hedge and qualify naturally.

7. PERPLEXITY: Introduce phrasing that is correct but slightly unexpected. The most likely next word is usually the AI choice — deviate deliberately.

Preserve: all citations, all facts, all academic content, all section headings, all word counts (within 2%). Do not add or remove sections. Return ONLY the transformed text.

TEXT:
${text}`;
}

/* ═══════════════════════════════════════════════════
   CRITIQUE + CORRECTION PROMPTS
═══════════════════════════════════════════════════ */

export function buildCritiquePrompt(text: string, assessmentType: string, level: string): string {
  return `You are a senior academic at a UK university with expertise in ${assessmentType} assessment. Your role is to provide a rigorous critique of the following ${level} ${assessmentType.toLowerCase()}.

Evaluate it against A+ criteria (85-100%) and identify every specific gap, weakness, or improvement needed. Be precise — reference exact locations (paragraph 2, section on X, the sentence beginning with Y). Do not give generic feedback.

Evaluate:
1. Argument quality — is there a clear analytical thesis? Does evidence support or merely illustrate?
2. Critical evaluation — does the work evaluate frameworks/evidence or just describe them?
3. Theoretical integration — are theories synthesised or discussed in sequence?
4. Evidence quality — are sources interrogated or accepted uncritically?
5. Citation density — are all claims supported? Are any sentences unsupported?
6. Humanisation — are there any remaining AI fingerprint phrases? Any three consecutive sentences of similar length?
7. Word count — which sections are over or under their targets?
8. Structural coherence — does the argument flow? Does each section build on the last?
9. Academic register — any contractions, first person, or informal language?
10. Framework application — are theoretical frameworks applied specifically to the case, or described in general terms?

Output a numbered critique list. Each item: the issue, where it occurs, and the specific correction needed. Be ruthless — the goal is A+.

WORK TO CRITIQUE:
${text}`;
}

export function buildCorrectionPrompt(text: string, critiqueText: string, wordCount: number): string {
  return `You are correcting an academic work based on a detailed critique. Apply EVERY correction listed in the critique immediately and completely. Do not skip any item.

CRITIQUE TO APPLY:
${critiqueText}

RULES FOR APPLYING CORRECTIONS:
— Fix every issue identified, in the exact location specified
— Do not change anything that was not identified as a problem
— Maintain all existing citations and add new ones where "[CITATION NEEDED]" appears
— Maintain word count within ±1% of target (${wordCount} words)
— Apply all humanisation improvements specified
— Do not add commentary or explanations — return ONLY the corrected work followed immediately by the complete reference list

ORIGINAL WORK:
${text}`;
}
