import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  SUPERIOR_STRUCTURE_PROMPT,
  ARCHITECT_CRITIQUE_CHECKLIST,
} from "../_shared/zoe-prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ARCHITECT_TABLE_MARKER = "<!--ZOE_ARCHITECT_TABLE-->";

// Strongest reasoning models, in order of preference.
// All architect cost is borne by the platform regardless of user tier.
const ARCHITECT_MODEL_CHAIN = [
  "openai/gpt-5.2",
  "openai/gpt-5",
  "google/gemini-2.5-pro",
];

async function runArchitect(opts: {
  apiKey: string;
  model: string;
  brief: string;
  deliverableType: string;
  wordCount: number;
  academicLevel: string;
  citationStyle: string;
  minCitations: number;
  subject: string;
}): Promise<string> {
  const userMsg = `BRIEF (verbatim — do not summarise):
${opts.brief}

PARAMETERS:
- Deliverable type: ${opts.deliverableType}
- Total word count target: ${opts.wordCount}
- Academic level: ${opts.academicLevel}
- Citation style: ${opts.citationStyle}
- Minimum citations: ${opts.minCitations}
- Subject/module: ${opts.subject || "(infer from brief)"}

OUTPUT FORMAT — STRICT:
1. Output the three paragraphs (Role, Context, Execution Command) above the table.
2. Output ONE markdown table with columns:
   | Section | Word Count (+1% ceiling) | Purpose & Scope | Required Inputs | Structure & Formatting | Learning Outcomes (in full) | Tables/Figures Required | Citations (min) | A+ Marking Criteria | Non-Negotiable Constraints |
3. Below the table, output the reference-list instruction.
4. PREFIX your entire output with the literal token ${ARCHITECT_TABLE_MARKER} on its own line.
5. Output ONLY the prompt artefact — no preamble, no commentary, no "here is the table".

CRITICAL TABLE INTEGRITY RULES (re-read before writing):
- If the brief implies multiple distinct tables (e.g. "stakeholder table" AND "risk table"), each gets its OWN row labelled "Table 1: ...", "Table 2: ...". NEVER merge required tables.
- If the brief specifies N figures, list Figure 1..Figure N each as separate rows or sub-items inside the relevant section.
- Word counts per section MUST sum to ${opts.wordCount}.
- Introduction and Conclusion are ~100 words each (or together ~10% of total).
- Learning outcomes are written OUT IN FULL prose — never "LO1", "LO2".
- Numerals for all numbers (1, 2, 3 — not "one, two, three"); "%" for percentages.
- No bullet points in the final work; no contractions; UK English; third-person.
- If appendices apply, give each its own row with step-by-step production instructions.

${ARCHITECT_CRITIQUE_CHECKLIST}`;

  const body = {
    model: opts.model,
    messages: [
      { role: "system", content: SUPERIOR_STRUCTURE_PROMPT },
      { role: "user", content: userMsg },
    ],
    reasoning: { effort: "high" },
  };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${txt.slice(0, 300)}`);
  }

  const json = await resp.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  return content.trim();
}

function quickAudit(output: string, target: number): { ok: boolean; reason?: string } {
  if (!output) return { ok: false, reason: "empty output" };
  if (!output.includes("|")) return { ok: false, reason: "no markdown table" };
  if (!/section by section and pause until I say next/i.test(output)) {
    return { ok: false, reason: "missing 'write section by section and pause' phrase" };
  }
  if (/\bLO\s?[0-9]\b/.test(output)) {
    return { ok: false, reason: "uses LO codes instead of full LO descriptions" };
  }
  if (target >= 1000 && output.length < 1500) {
    return { ok: false, reason: "table too short for the target word count" };
  }
  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      brief,
      deliverable_type,
      word_count,
      academic_level,
      citation_style,
      min_citations,
      subject_or_module,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const wc = Number(word_count) || 1500;
    const baseOpts = {
      apiKey: LOVABLE_API_KEY,
      brief: String(brief || "").trim(),
      deliverableType: String(deliverable_type || "Essay"),
      wordCount: wc,
      academicLevel: String(academic_level || "Postgraduate L7"),
      citationStyle: String(citation_style || "Harvard"),
      minCitations: Number(min_citations) || Math.ceil(wc / 100),
      subject: String(subject_or_module || ""),
    };

    if (!baseOpts.brief) {
      return new Response(
        JSON.stringify({ error: "brief is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let table = "";
    let lastReason = "";
    let modelUsed = "";

    // Walk the model chain. For each model, try up to 2 times before falling back.
    outer: for (const model of ARCHITECT_MODEL_CHAIN) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          table = await runArchitect({ ...baseOpts, model });
          const audit = quickAudit(table, baseOpts.wordCount);
          if (audit.ok) {
            modelUsed = model;
            break outer;
          }
          lastReason = audit.reason || "audit failed";
          console.warn(`[zoe-architect] ${model} attempt ${attempt + 1} failed audit: ${lastReason}`);
        } catch (e) {
          lastReason = e instanceof Error ? e.message : "unknown error";
          console.warn(`[zoe-architect] ${model} attempt ${attempt + 1} error: ${lastReason}`);
          // If this is a hard error (4xx/5xx), break to fall back to the next model immediately.
          if (lastReason.includes("AI gateway 4") || lastReason.includes("AI gateway 5")) break;
        }
      }
    }

    if (!table) {
      return new Response(
        JSON.stringify({ error: `Architect failed: ${lastReason}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!table.includes(ARCHITECT_TABLE_MARKER)) {
      table = `${ARCHITECT_TABLE_MARKER}\n\n${table}`;
    }

    return new Response(
      JSON.stringify({ table, model: modelUsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[zoe-architect] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
