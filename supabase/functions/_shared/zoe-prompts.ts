/**
 * ZOE PROMPTS LIBRARY
 *
 * Verbatim source-of-truth prompts that ZOE uses internally.
 * Edit here only — referenced from edge functions.
 */

/**
 * SUPERIOR STRUCTURE PROMPT — the "Architect" prompt.
 *
 * ZOE runs this against a high-reasoning model BEFORE writing a single word
 * of any structured deliverable. It produces ONE detailed markdown execution
 * table that becomes the blueprint for the writing phase.
 *
 * Source: user-uploaded Superior_Prompt.docx (verbatim).
 */
export const SUPERIOR_STRUCTURE_PROMPT = `<instructions>

Review all provided documents and images (along with images inside the documents) and use them to create a highly detailed, executable prompt presented in a structured table (Above the table should be the role, context and execution command in three paragraphs and must include the phrase "write section by section and pause until I say next." Include section breakdown, learning outcomes (detailed fully, not as LO1/2 so that any AI can know what outcomes to meet), word count (per section), required inputs, formatting standards, non-negotiable constraints (one of which must be that each section can only exceed the word count by 1%, while introductions and conclusions are usually 100 words each or 10% (together) of the total word count), A+ marking criteria, etc. Ensure the table is comprehensive, domain-appropriate, and fully actionable, enabling precise execution of the work to professional standards. The prompt table must instruct the model to write/create a complete, A+-grade work/output covering every requirement to achieve the highest standard. Be specific, non-generic, and extremely detailed and technical (where required) with what must be in each section to make the work an A+ (90 upward) grade (also focus on structure, headings, sections, etc). Instruct the AI to write figures in numbers (i.e. 1,2,3… percentages in "%" and all figures and statistics in numbers, not words). For figures, provide figure headings. Do not refer to the documents uploaded in creating the prompt. While creating the prompt, review it against what you have and all the instructions to ensure that it is of the highest quality. If it's not, stop writing and rewrite it from scratch until you have produced an A+ prompt table. Appendices (if available/necessary) must be fully included with equal step-by-step processes used in producing them. Formatting rules, citation style, and presentation standards must be explicit to the smallest details. Nothing should be omitted or overlooked, so that once executed, the resulting prompt automatically produces a final, polished, submission-ready output that meets/exceeds A+ criteria in all measurable aspects. The table must begin from the introduction and end at the conclusion or appendices with the next instruction being the reference list. The final output MUST be one detailed table. Not more than one. ONE!

<structural instructions>

Writing: Produce a rigorous Level Seven academic response that adheres strictly to a prescribed word count and is written in formal UK English, maintaining a third-person voice throughout with no contractions. The work must demonstrate sophisticated critical evaluation, theoretical integration, and precise disciplinary terminology, synthesising complex ideas rather than offering descriptive narration. The argument should be coherent, analytically robust, and grounded in high-quality, contemporary research, incorporating empirical data and relevant statistics to support nuanced and balanced discussion. Well-developed scholarly examples should be included where appropriate, and key concepts must be clearly and precisely defined. Differences and similarities between theoretical perspectives should be examined to provide deeper analytical insight, and frameworks must be critically appraised in relation to their strengths, limitations, assumptions, practical applicability, and relevance to professional practice. Evidence must be interrogated rather than accepted uncritically, with explicit connections drawn between theory, research, and practice to demonstrate mature scholarly engagement. Focus on depth, specificity, and quality over speed.

Citations: A minimum of [ ] new and distinct academic sources must be used, with no repetition of previously cited works and no duplication of references within the piece. All sources must be genuine, verifiable, and searchable via Google; fictional or fabricated references are strictly prohibited. Every sentence must be supported analytically by an academic source clearly identified within the sentence using varied citation styles and narrative format, such as "(Author, Year)," "Author (Year) argued that…," "contended that…," "demonstrated that…," or similar scholarly constructions like: "according to", "as stated by", "maintained that", "revealed how", or "emphasised that". Citations must be substantively integrated into the analytical discussion and should not always appear in brackets at the end of a sentence or paragraph as the final element. All in-text citations must follow Harvard style using "and" rather than ampersands. A complete and accurate Harvard-style reference list must be provided at the end and is excluded from the word count.

Structure: The structure must consist of fully developed paragraphs organised under clear, academically appropriate headings, with no bullet points or lists. Figures and tables, where required, must be embedded within the relevant sections rather than placed at the end, following this sequence: preceding analytical paragraph, figure or table heading, interpretation or description, and continuation of analysis. Numbers must be written in numerals (i.e. 1, 2, 3, ...) not words, except when a number begins a sentence. Abbreviations such as "e.g.", "i.e.", and "etc." must be avoided. The final work must meet core academic standards of clarity, structural coherence, originality, relevance, rigorous engagement with evidence, accuracy of citation, ethical scholarly practice, and advanced critical insight.

Humanising: Humanize the content you write so it won't be flagged as written by AI, ensuring it reads as written by a human. That means changing your voice, tone, and style. Write in natural layman's tone that anyone can understand, but make it formal and don't use first-person or contractions. Use UK English and citations. Use varied but simple sentence structures with simple words that anyone can understand, and maintain an authentic flow. Avoid robotic phrasing and keep the text engaging and relatable to human readers. Additionally, make subtle stylistic adjustments to reflect a thoughtful and personal writing style. Write the text with a richer and more varied vocabulary, avoiding repetitive phrasing and common AI-style wording. Incorporate rarer words, regional slang, or poetic phrasing where appropriate, while maintaining clarity and coherence. Ensure the tone remains formal (or adjust if needed) and that the meaning of the original text is preserved. Use vivid descriptions, dynamic sentence structures, and a natural flow that feels engaging and sophisticated.

Humaniser instructions: Apply the following transformations without exception:

Sentence structure and rhythm: Break the robotic uniformity of AI prose. Vary sentence length aggressively — place short, punchy sentences next to longer, more complex ones. Do not let three consecutive sentences share a similar length or structure. This variation in "burstiness" is the single most detectable difference between human and AI writing, so treat it as a priority.

Remove AI fingerprints: Strip out all phrases that AI defaults to. This includes openers like "It is worth noting", "It is important to", "Furthermore", "Moreover", "In conclusion", "Delving into", "In the realm of", and any sentence that begins by restating what was just said. Remove hollow filler affirmations entirely.

Transitions: Replace mechanical logical connectors with natural, conversational bridges. Humans do not write "Additionally, it can be observed that" — they write "That said," or "Which raises the question of" or simply start a new thought without flagging it.

Vocabulary: Flatten the vocabulary slightly. AI overuses elevated synonyms to signal intelligence — choose the cleaner, more direct word unless the complex one is genuinely the right fit. Avoid nominalisation where a verb would do ("make a decision" → "decide").

Imperfection and opinion: Introduce subtle authorial presence. Real writers hedge naturally, qualify claims informally, and occasionally let a perspective bleed through. Passive constructions everywhere signal AI — use active voice with a human behind it.

Paragraph logic: AI tends to build paragraphs in rigid triads — claim, evidence, conclusion, repeat. Break this. Let some paragraphs be two sentences. Let an idea carry across a paragraph break. Let the structure follow the thought, not a template.

Perplexity: Increase lexical unpredictability. AI writing is statistically very predictable — each word is the most likely next word. Introduce phrasing that is correct but slightly unexpected. This is what makes writing feel authored rather than generated.

Quality: This work must meet the following criteria and encompass these factors:

Clarity of Argument, Depth of Analysis, Critical Thinking, Proper Synthesis of Information, Coherence and Structure, Accurate Citations and Referencing, Originality, Relevance to Topic, Use of Scholarly Sources, Formal Academic Tone, No contractions, Proper Grammar and Spelling, Logical Flow of Ideas, Thorough Research, Adherence to Formatting Guidelines, Balanced Discussion of Different Perspectives, Use of Data and Statistics, and Ethical Writing Practices (e.g., avoiding plagiarism, non-falsification of sources).

Output: The response must be written section by section, pausing after each section until further instruction is given to proceed.

<instructions>

Apply only what is appropriate within the instructions in the document(s)/files upload along with the prompt.

<instructions>`;

/**
 * Self-critique checklist used after the architect produces the table.
 * If the model's self-evaluation flags any item, ZOE rewrites the table from scratch.
 */
export const ARCHITECT_CRITIQUE_CHECKLIST = `Before returning the table, silently audit it against this checklist. If ANY item fails, REWRITE THE ENTIRE TABLE FROM SCRATCH (up to 2 retries). Do not patch — rewrite.

1. STRUCTURE
   - Three paragraphs (Role, Context, Execution Command) appear ABOVE the table.
   - The Execution Command paragraph contains the EXACT phrase: "write section by section and pause until I say next."
   - There is exactly ONE table. Not two. Not nested. ONE.
   - The table starts at Introduction and ends at Conclusion (or Appendices if relevant).
   - A "Reference list" instruction appears BELOW the table, not inside it.

2. WORD COUNTS
   - Per-section word counts sum to the total target.
   - Each section row states the +1% ceiling explicitly.
   - Introduction and Conclusion are ~100 words each, OR together ~10% of total.

3. LEARNING OUTCOMES
   - LOs are written out IN FULL — never as "LO1", "LO2", "LO3".
   - Each LO is mapped to the section(s) that demonstrate it.

4. TABLES vs FIGURES (CRITICAL — do not merge)
   - If the brief implies multiple tables, each table gets its OWN row with its OWN heading and purpose. Do NOT collapse multiple required tables into one.
   - Figure count is exact — if the brief says "include 3 figures", the table specifies Figure 1, Figure 2, Figure 3 with individual headings and placement.
   - Each figure/table row specifies the heading format (e.g. "Table 1: ..." / "Figure 1: ...").

5. NUMERICAL FORMATTING
   - Constraint row explicitly states: numerals for all figures (1, 2, 3 — not "one, two, three"), "%" for percentages, statistics in numerals.

6. CITATIONS
   - Citation style stated explicitly (Harvard / APA / etc.).
   - Minimum citation count per section stated.
   - Harvard uses "and" not "&" if Harvard is the style.

7. APPENDICES
   - If appendices are required or implied, they get their OWN rows with step-by-step production instructions equal in detail to main sections.

8. A+ CRITERIA
   - Each section row contains specific A+ marking criteria translated into actionable writing instructions — not generic phrases like "demonstrate critical analysis".

9. NON-NEGOTIABLES
   - Constraints column lists: +1% ceiling, no bullet points, no contractions, UK English, third-person, no "e.g./i.e./etc.", no banned AI phrases.

10. SELF-CONTAINED
    - The table makes NO reference to "the uploaded document" or "the brief" — it stands alone as a complete prompt that another AI could execute without seeing the original brief.

If all 10 pass, return the table. Otherwise, REWRITE.`;
