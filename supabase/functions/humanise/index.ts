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
  "it should be noted", "it can be argued", "this essay will discuss",
  "this report aims to", "in light of", "on the other hand",
  "with regards to", "in terms of", "due to the fact that",
  "in order to", "a plethora of", "myriad of", "a wide range of",
  "plays an important role", "is of paramount importance",
  "tapestry", "in the realm of",
];

function preProcess(text: string): string {
  let result = text;
  for (const phrase of BANNED_PHRASES) {
    const regex = new RegExp(phrase, "gi");
    result = result.replace(regex, "");
  }
  result = result.replace(/(\d)\s*%/g, "$1%");
  result = result.replace(/(\([^)]*;\s*[^)]*;\s*[^)]*;\s*[^)]*\))/g, (match) => {
    const cites = match.slice(1, -1).split(";").map(c => c.trim());
    if (cites.length > 3) {
      const half = Math.ceil(cites.length / 2);
      return `(${cites.slice(0, half).join("; ")}) ... (${cites.slice(half).join("; ")})`;
    }
    return match;
  });
  result = result.replace(/\s{2,}/g, " ").trim();
  return result;
}

function postProcess(text: string): string {
  let result = text;
  const reportingVerbs = ["argues that", "contends that", "posits that", "asserts that", "suggests that", "maintains that", "observes that"];
  let verbIndex = 0;
  result = result.replace(/(states that|notes that|claims that)/gi, () => {
    const replacement = reportingVerbs[verbIndex % reportingVerbs.length];
    verbIndex++;
    return replacement;
  });
  return result;
}

function hardTrimToWordCount(text: string, ceiling: number): { text: string; wordCount: number } {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let trimmed = "";
  let wc = 0;
  for (const s of sentences) {
    const sWc = s.trim().split(/\s+/).filter(Boolean).length;
    if (wc + sWc > ceiling) break;
    trimmed += s;
    wc += sWc;
  }
  return { text: trimmed.trim() || text, wordCount: wc || text.split(/\s+/).filter(Boolean).length };
}

function getVoiceInstruction(voice: string): string {
  switch (voice) {
    case "first":
      return "Maintain FIRST PERSON perspective throughout (I, my, we). This is a reflective piece. Do NOT switch to third person.";
    case "third":
      return "Maintain strict THIRD PERSON perspective throughout. Do NOT use first person (I, my, we, our) at any point. This is formal academic writing.";
    case "mixed":
      return "Use primarily third person but allow occasional first person where it adds authorial presence (e.g., 'I argue', 'this author contends'). Keep first person usage under 10% of sentences.";
    default:
      return "Maintain third person perspective throughout. Do NOT use first person (I, my, we, our).";
  }
}

async function aiPass(content: string, systemPrompt: string, apiKey: string, model: string): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Rate limited");
    if (resp.status === 402) throw new Error("Credits exhausted");
    throw new Error(`AI error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, word_target, mode = "full", model, voice_perspective } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiModel = model || "google/gemini-2.5-flash";
    const passes: string[] = [];
    const voiceRule = getVoiceInstruction(voice_perspective || "third");

    const wordFloor = word_target;
    const wordCeiling = Math.ceil(word_target * 1.01);
    const wordCountRule = `CRITICAL WORD COUNT RULE: Your output MUST contain at least ${wordFloor} words and no more than ${wordCeiling} words. NEVER go below ${wordFloor} words. If your output is shorter, add elaboration, examples, or deeper analysis to the weakest paragraphs until you reach ${wordFloor} words. Count carefully before finishing.`;

    // Layer 1: Pre-processor (code-based)
    let processed = preProcess(content);
    passes.push("pre-processor");

    // Pass 0: Discipline detection
    const disciplineProfile = await aiPass(
      processed.slice(0, 500),
      "Detect the academic discipline of this text. Return ONLY a brief JSON-like description: discipline name, typical hedging style (cautious/moderate/assertive), and 3 common reporting verbs for this field. Keep response under 100 words.",
      LOVABLE_API_KEY,
      aiModel
    );
    passes.push("discipline-detection");

    // Hard cap after each pass to prevent drift
    const capAfterPass = (text: string): string => {
      const wc = text.split(/\s+/).filter(Boolean).length;
      if (wc > wordCeiling) {
        const result = hardTrimToWordCount(text, wordCeiling);
        return result.text;
      }
      return text;
    };

    // Pass 1: Author revision
    processed = await aiPass(
      processed,
      `You are a meticulous academic author revising your own draft before submission. Discipline context: ${disciplineProfile}. ${voiceRule} ${wordCountRule} Rewrite naturally as though you wrote it yourself. Maintain all citations and academic references exactly. Do not add meta-commentary — return only the revised text.`,
      LOVABLE_API_KEY,
      aiModel
    );
    processed = capAfterPass(processed);
    passes.push("author-revision");

    // Pass 2: Journal reviewer
    processed = await aiPass(
      processed,
      `You are a senior journal peer reviewer. Rewrite ONLY the parts that sound AI-generated or formulaic. ${voiceRule} Preserve citations exactly. Vary sentence openings. Mix sentence lengths naturally (8-35 words). ${wordCountRule} Return only the full revised text.`,
      LOVABLE_API_KEY,
      aiModel
    );
    processed = capAfterPass(processed);
    passes.push("journal-reviewer");

    if (mode === "full") {
      // Pass 3: Aggressive paraphrase
      processed = await aiPass(
        processed,
        `Aggressively paraphrase this academic text. Replace up to 80% of words with synonyms while preserving meaning, citations, and academic tone. ${voiceRule} Prefer concrete nouns over abstract ones. Vary paragraph openings. Do not start more than 2 paragraphs with "The". ${wordCountRule} Return only the text.`,
        LOVABLE_API_KEY,
        aiModel
      );
      processed = capAfterPass(processed);
      passes.push("aggressive-paraphrase");

      // Pass 4: Final polish targeting AI detection signals
      processed = await aiPass(
        processed,
        `Final polish targeting 6 AI-detection signals: (1) sentence-length uniformity — vary between 8 and 40 words, (2) excessive hedging — remove unnecessary qualifiers, (3) predictable paragraph structure — vary openings, (4) overuse of transition words — reduce and diversify, (5) passive voice density — convert 30% of passives to active, (6) lexical repetition — replace repeated terms. ${voiceRule} Preserve all citations. ${wordCountRule} Return only the text.`,
        LOVABLE_API_KEY,
        aiModel
      );
      processed = capAfterPass(processed);
      passes.push("turnitin-bypass");

      // Pass 5: Anti-AI detection pass — specifically targets patterns that AI detectors flag
      processed = await aiPass(
        processed,
        `You are an expert at evading AI content detection systems. Rewrite this text to reduce its AI detection score while maintaining academic quality. Target these specific patterns:

1. SENTENCE STARTERS: AI texts disproportionately start sentences with "This", "The", "It", "However", "Moreover", "Furthermore", "Additionally", "In". Change at least 60% of sentence starters to use: dependent clauses, prepositional phrases, adverbs, gerunds, or direct subjects with active verbs.

2. SENTENCE RHYTHM: AI texts have unnaturally uniform sentence length (15-25 words). Insert short punchy sentences (5-10 words) and occasional long complex ones (30-45 words). At least 20% of sentences should be under 12 words.

3. PARAGRAPH OPENING PATTERNS: Never start consecutive paragraphs the same way. Use varied structures: questions, short declarative statements, quotations, statistics, counter-arguments.

4. WORD CHOICE: Replace these AI-favourite words with natural alternatives: "crucial" → "key/important/central", "significant" → "notable/marked/considerable", "comprehensive" → remove or use specific descriptor, "facilitate" → "help/enable/support", "demonstrate" → "show/reveal/indicate", "implement" → "apply/carry out/introduce", "enhance" → "improve/strengthen/boost".

5. CONNECTOR OVERUSE: Remove 40% of transitional phrases like "Moreover", "Furthermore", "In addition", "Consequently". Let ideas connect naturally through content rather than explicit signposting.

6. HEDGING UNIFORMITY: AI texts hedge everything identically. Vary hedging: some claims should be direct ("X causes Y"), some cautious ("evidence suggests"), some interrogative ("whether X leads to Y remains debated").

${voiceRule} Preserve ALL citations exactly. ${wordCountRule} Return only the rewritten text.`,
        LOVABLE_API_KEY,
        aiModel
      );
      processed = capAfterPass(processed);
      passes.push("anti-ai-detection");
    }

    // Layer 3: Post-processor (code-based)
    processed = postProcess(processed);
    passes.push("post-processor");

    let finalWordCount = processed.split(/\s+/).filter(Boolean).length;

    // Word count correction pass — if still below target, run a targeted expansion
    if (finalWordCount < wordFloor) {
      console.log(`[humanise] Word count ${finalWordCount} below target ${wordFloor}, running correction pass`);
      processed = await aiPass(
        processed,
        `This text is ${finalWordCount} words but MUST be at least ${wordFloor} words. Add ${wordFloor - finalWordCount + 10} more words by:
1. Expanding the weakest arguments with more evidence or examples
2. Adding transitional sentences between paragraphs
3. Deepening analysis in sections that are too brief
${voiceRule}
Preserve all citations exactly. Do NOT add filler or padding. Every added sentence must contribute substantive academic content. Return the full expanded text.`,
        LOVABLE_API_KEY,
        aiModel
      );
      finalWordCount = processed.split(/\s+/).filter(Boolean).length;
      passes.push("word-count-correction");
    }

    // FINAL hard word count cap — always enforced, never skipped
    if (finalWordCount > wordCeiling) {
      console.log(`[humanise] Hard cap: ${finalWordCount} > ${wordCeiling}, truncating at sentence boundaries`);
      const result = hardTrimToWordCount(processed, wordCeiling);
      processed = result.text;
      finalWordCount = result.wordCount;
      passes.push("hard-cap-trim");
    }

    return new Response(JSON.stringify({
      success: true,
      humanised_content: processed,
      word_count: finalWordCount,
      passes_applied: passes,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("humanise error:", e);
    const status = (e as Error).message?.includes("Rate limited") ? 429 : (e as Error).message?.includes("Credits") ? 402 : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
