import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";
import { extractText } from "https://esm.sh/unpdf@0.12.1";
import { getZoeBrain } from "../_shared/zoe-brain.ts";
import { SUPERIOR_STRUCTURE_PROMPT, ARCHITECT_CRITIQUE_CHECKLIST } from "../_shared/zoe-prompts.ts";

// ── Auto model fallback chain ────────────────────────────────────────────────
// If a model returns 402 (out of credits) or 429 (rate-limited), we walk down
// this chain so the user keeps getting a response.
const MODEL_FALLBACK_CHAIN: Record<string, string[]> = {
  "openai/gpt-5.2":            ["openai/gpt-5", "google/gemini-2.5-pro", "google/gemini-3-flash-preview"],
  "openai/gpt-5":              ["google/gemini-2.5-pro", "google/gemini-3-flash-preview"],
  "openai/gpt-5-mini":         ["google/gemini-2.5-flash", "google/gemini-3-flash-preview"],
  "google/gemini-2.5-pro":     ["google/gemini-2.5-flash", "google/gemini-3-flash-preview"],
  "google/gemini-2.5-flash":   ["google/gemini-3-flash-preview"],
  "google/gemini-3-flash-preview": [],
};

function nextFallback(model: string): string | null {
  const chain = MODEL_FALLBACK_CHAIN[model];
  if (!chain || chain.length === 0) return null;
  return chain[0];
}

// ── Architect model selection (always high-reasoning) ────────────────────────
function selectArchitectModel(tier: string): string {
  // Free / Hello / Regular tiers use Gemini 2.5 Pro for the architect phase.
  // Professional / Unlimited / Custom get GPT-5 for maximum structural rigour.
  if (tier === "professional" || tier === "unlimited" || tier === "custom") {
    return "openai/gpt-5";
  }
  return "google/gemini-2.5-pro";
}

// Marker that lets the client detect an architect output and render the
// "Begin writing" CTA. Must remain in sync with ZoeChat.tsx.
const ARCHITECT_TABLE_MARKER = "<!--ZOE_ARCHITECT_TABLE-->";
const SECTION_OUTPUT_MARKER = "<!--ZOE_SECTION_OUTPUT-->";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Tier → Model routing ─────────────────────────────────────────────────────
const TIER_MODEL_MAP: Record<string, string> = {
  free:         "google/gemini-3-flash-preview",
  hello:        "google/gemini-2.5-flash",
  regular:      "google/gemini-2.5-pro",
  professional: "openai/gpt-5",
  unlimited:    "openai/gpt-5.2",
  custom:       "openai/gpt-5.2",
};

function selectModel(tier: string): string {
  // Autonomous, tier-based selection. The client may NOT override.
  return TIER_MODEL_MAP[tier] || "google/gemini-3-flash-preview";
}

const ZOE_SYSTEM = getZoeBrain("chat") + `

═══════════════════════════════════════════════════════════════════
THE TWO-PHASE WRITING DOCTRINE — NON-NEGOTIABLE
═══════════════════════════════════════════════════════════════════

For ANY structured deliverable longer than a chat reply (essay, report,
dissertation, case study, business plan, reflective piece, literature
review, proposal, thesis chapter, etc.), follow this two-phase flow:

PHASE 1 — SILENT ARCHITECT (always first):
  Call the 'architect_work' tool. The blueprint table it returns is
  INTERNAL SCAFFOLDING for YOU only. You MUST NOT show, mention, summarise,
  paraphrase, or describe the table to the user. Do NOT print the table.
  Do NOT say "I have created a blueprint". Do NOT ask the user to approve
  it. The user must never know the table exists. After the tool returns,
  silently use it as your authoritative plan.

PHASE 2 — AUTO-WRITER (immediately after Phase 1, no user prompt):
  As soon as the architect tool returns, immediately begin writing the
  document section-by-section. Output Section 1 in full. Then in the SAME
  response (or the next assistant message if streaming closes) continue
  with Section 2, Section 3, etc., until the entire document is complete,
  including the reference list.

  - Honour each row of the architect table strictly: word count (±1%),
    citations, framework, formatting, tables/figures, A+ criteria.
  - Do NOT pause between sections. Do NOT ask "shall I continue?".
  - Only stop or pause if the user interrupts with feedback.
  - Use clear markdown headings for each section (## Heading).

If the brief is missing CRITICAL information you cannot infer (e.g.
target word count, deliverable type, citation style, academic level),
call the 'request_clarification' tool with a tickable form instead of
asking in prose. As soon as the user submits the form, immediately
proceed with Phase 1 → Phase 2 without further confirmation.

If the user asks a casual question, gives feedback, or wants chat-style
help (≤300 words of output), respond conversationally without invoking
the architect.

═══════════════════════════════════════════════════════════════════

WRITING IN CHAT — CRITICAL RULE:
ZOE writes everything directly in the chat. There is no separate writing
page. Generation happens inline.

WHAT ZOE CAN DO:
— Architect any structured deliverable silently via 'architect_work'
— Write the full document in the same turn after the architect returns
— Edit and proofread uploaded or pasted documents
— Critique and score work against A+ criteria
— Find real academic sources via find_sources (Semantic Scholar)
— Generate charts and visualisations with render_chart
— Export any generated content as a file with export_content
— Search the web for current information with web_search
— Generate academic images with generate_chat_image
— Ask for clarifications via tickable forms with request_clarification

EXPORT / DOWNLOAD RULE:
After writing any substantial content, the user can download it using
the inline Copy / .docx / .pdf / .txt buttons under each message.
You do not need to explicitly offer downloads.

NAVIGATION — only when user explicitly asks to visit a page:
- navigate_to "/dashboard"
- navigate_to "/analytics"
- navigate_to "/zoe"

PAYMENT — always confirm tier + price before calling process_payment.
Plans: Hello £15, Regular £45, Professional £110, Custom ₦23/word + 1000 bonus words.

SOURCES — ALWAYS use find_sources for real references. Never invent citations.

FILE ATTACHMENTS — BROAD FORMAT SUPPORT:
— PDFs, DOCX, XLSX, PPTX, ODT, RTF, EPUB: text extracted server-side
— Images (PNG, JPG, WEBP, GIF): analysed visually
— Plain text + source code (.ts, .py, .html, .xml, .yaml, .sql, .sh, .json, .csv, .md, .log, .ini, .toml…): read in full
— HEIC, audio (.mp3/.wav/.m4a) and video are NOT supported yet — if the user uploads one, briefly explain and suggest a JPG/PNG or transcript instead.
— Scanned PDFs with no selectable text cannot be read — ask the user to paste the key passages.
— A `[ZOE NOTE: …]` line in context tells you exactly which files were skipped or partially read; mention them naturally if the user asks.

AUTONOMOUS MODEL SELECTION:
You are running on a model selected automatically based on the user's
subscription tier. The architect phase always uses the strongest
reasoning model regardless of tier. Do NOT tell the user which model
you are on unless asked, and never offer to switch models.

EXECUTIVE CONTROL:
— For payment and export: confirm once, then execute on confirmation.
— For writing, editing, critique: execute immediately.
— For find_sources: ALWAYS call the tool — never invent references.
— For architect_work: call IMMEDIATELY when the user requests any
  structured deliverable. Do not ask permission first unless critical
  information is missing — in which case use request_clarification.
— Never say "I can't do that".
— HALLUCINATION RULE: Never invent academic references, statistics, or factual claims.

Use UK English throughout.`;

const tools = [
  {
    type: "function",
    function: {
      name: "navigate_to",
      description: "Navigate the user to a page. Allowed routes: /dashboard, /analytics only.",
      parameters: {
        type: "object",
        properties: {
          route: {
            type: "string",
            enum: ["/dashboard", "/analytics"],
            description: "The route to navigate to",
          },
        },
        required: ["route"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "process_payment",
      description: "Trigger Paystack checkout for a subscription plan. Confirm with the user before calling.",
      parameters: {
        type: "object",
        properties: {
          tier: { type: "string", enum: ["hello", "regular", "professional", "custom"] },
          custom_words: { type: "number", description: "Only used when tier is 'custom'" },
        },
        required: ["tier"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_proofread",
      description: "Run edit and proofread pass on the current assessment",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_images",
      description: "Generate academic images and charts for the current assessment",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "coherence_check",
      description: "Run coherence and argument-flow analysis on the current assessment",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "predict_grade",
      description: "Analyse current content and predict a likely grade band with specific reasoning",
      parameters: {
        type: "object",
        properties: { focus_areas: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_sources",
      description: "Search Semantic Scholar for real, verified academic sources. ALWAYS use this tool when finding sources — never invent or guess references. Returns actual papers with DOIs.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string" },
          citation_style: { type: "string" },
          count: { type: "number", description: "Number of sources to return (default 5, max 10)" },
        },
        required: ["topic"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "format_citation",
      description: "Format a source reference in the specified citation style",
      parameters: {
        type: "object",
        properties: {
          source_details: { type: "string" },
          style: { type: "string" },
        },
        required: ["source_details", "style"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "topic_to_brief",
      description: "Generate a complete assessment brief from a topic title",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string" },
          type: { type: "string", description: "e.g. Essay, Report, Case Study" },
          word_count: { type: "number" },
          level: { type: "string", description: "e.g. Postgraduate L7, Undergraduate L6" },
        },
        required: ["topic"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sign_out",
      description: "Sign the user out of the application",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "read_analytics",
      description: "Read and narrate the user's writing analytics — total words, completions, citations, plan status. Use when asked 'how am I doing', 'show my stats', 'analytics', 'how many words have I written', etc.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for real-time information, news, or any query requiring current data. Always use this for factual lookups, current events, or when the user asks to 'search' anything.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_chart",
      description: "Render a data visualisation (bar chart, line graph, pie chart, area chart) inline in the chat from user-provided data.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["bar", "line", "pie", "area"], description: "Chart type" },
          title: { type: "string", description: "Chart title" },
          data: {
            type: "array",
            description: "Data points — each object must have a 'label' and 'value' key, plus any additional series keys",
            items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" } }, required: ["label", "value"] },
          },
          x_label: { type: "string", description: "X-axis label" },
          y_label: { type: "string", description: "Y-axis label" },
        },
        required: ["type", "data"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_assessment_settings",
      description: "Update the current assessment's settings — citation style, academic level, or AI writing model.",
      parameters: {
        type: "object",
        properties: {
          citation_style: { type: "string", description: "e.g. Harvard, APA, Vancouver, MLA, Chicago" },
          level: { type: "string", description: "e.g. Undergraduate L4, L5, L6, Postgraduate L7" },
          model: { type: "string", description: "AI model to use for writing" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_content",
      description: "Export or download content produced in the conversation — e.g. a rewritten document, a summary, or any text ZOE has generated. Use when user says 'save this', 'download', 'export what you wrote', 'give me a file'.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The text content to export" },
          filename: { type: "string", description: "Suggested filename (e.g. 'revised-essay.txt')" },
        },
        required: ["content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_chat_image",
      description: "Generate an image from a text prompt and display it inline in the chat. Use when user asks to create, draw, generate, or design any image, diagram, illustration, or visual.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Detailed description of the image to generate" },
          style: { type: "string", description: "Image style hint — e.g. 'academic diagram', 'infographic', 'illustration', 'realistic photo'" },
        },
        required: ["prompt"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "architect_work",
      description: "PHASE 1 (silent). Call this FIRST for any structured deliverable (essay, report, dissertation, case study, business plan, reflective piece, lit review, proposal). Returns a meticulous markdown blueprint table that is INTERNAL to you only. NEVER show, print, summarise, paraphrase or describe the table to the user. NEVER ask 'shall I begin' or wait for 'next'. After the tool returns, IMMEDIATELY proceed to PHASE 2 and write the full document section-by-section in the same turn. Always pass the FULL brief verbatim including any uploaded text the user attached.",
      parameters: {
        type: "object",
        properties: {
          brief: {
            type: "string",
            description: "The complete brief, verbatim. Include the user's request and ALL attached/extracted document text. Do not summarise. Do not paraphrase.",
          },
          deliverable_type: {
            type: "string",
            description: "Essay, Report, Dissertation, Case Study, Business Plan, Reflective Piece, Literature Review, Proposal, etc.",
          },
          word_count: {
            type: "number",
            description: "Total target word count. If the brief specifies a range, use the upper bound.",
          },
          academic_level: {
            type: "string",
            description: "e.g. Undergraduate L4/L5/L6, Postgraduate L7, Doctoral L8. Default L7 if unspecified.",
          },
          citation_style: {
            type: "string",
            description: "Harvard, APA, MLA, Vancouver, Chicago, OSCOLA, etc. Default Harvard if unspecified.",
          },
          min_citations: {
            type: "number",
            description: "Minimum total citations required. Use the brief's number if stated; otherwise default to ceil(word_count / 100).",
          },
          subject_or_module: {
            type: "string",
            description: "Subject area or module name if discernible from the brief.",
          },
        },
        required: ["brief", "deliverable_type", "word_count"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_section",
      description: "PHASE 2 progress signal. The model writes the section text inline in the same turn; this tool just notifies the UI which section is being written. Do NOT pause for the user. Continue immediately with the next section after each call until the entire document is complete.",
      parameters: {
        type: "object",
        properties: {
          section_title: { type: "string", description: "Exact heading from the architect table." },
          section_index: { type: "number", description: "0-indexed position within the table." },
          word_target: { type: "number", description: "Target word count for this section (the model must honour ±1%)." },
        },
        required: ["section_title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_clarification",
      description: "Ask the user for missing CRITICAL information by rendering a tickable / selectable form in the chat. Use this INSTEAD of asking questions in prose when you need structured answers (e.g. word count, deliverable type, citation style, academic level, sub-topic choice). Once the user submits the form, immediately proceed with the work — do not ask again.",
      parameters: {
        type: "object",
        properties: {
          intro: { type: "string", description: "Short one-line explanation shown above the form (e.g. 'Quick check before I start.')." },
          fields: {
            type: "array",
            description: "1–6 fields the user needs to fill in.",
            items: {
              type: "object",
              properties: {
                key: { type: "string", description: "Stable key returned in the submission (e.g. 'word_count')." },
                label: { type: "string", description: "Human label shown to the user." },
                type: { type: "string", enum: ["text", "number", "select", "checkbox"], description: "Input type." },
                options: { type: "array", items: { type: "string" }, description: "Required for type=select. Options the user picks from." },
                placeholder: { type: "string" },
                required: { type: "boolean" },
                default: { type: "string", description: "Optional default value (string form)." },
              },
              required: ["key", "label", "type"],
              additionalProperties: false,
            },
          },
        },
        required: ["fields"],
        additionalProperties: false,
      },
    },
  },
];

// ── Semantic Scholar lookup ──────────────────────────────────────────────────
async function fetchSemanticScholar(query: string, count = 5): Promise<string> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${Math.min(count, 10)}&fields=title,authors,year,journal,externalIds,abstract`;
    const resp = await fetch(url, { headers: { "User-Agent": "ZOEWrites/1.0" } });
    if (!resp.ok) return "";
    const json = await resp.json();
    const papers = (json.data || []) as any[];
    if (!papers.length) return "";
    return papers.map((p: any) => {
      const authors = (p.authors || []).slice(0, 3).map((a: any) => a.name).join(", ") + (p.authors?.length > 3 ? " et al." : "");
      const doi = p.externalIds?.DOI ? `DOI: ${p.externalIds.DOI}` : "";
      const journal = p.journal?.name || "";
      return `- **${p.title}** — ${authors} (${p.year || "n.d."})${journal ? ` · ${journal}` : ""}${doi ? ` · ${doi}` : ""}${p.abstract ? `\n  _${p.abstract.slice(0, 200)}…_` : ""}`;
    }).join("\n\n");
  } catch { return ""; }
}

// ── Web search (Brave Search API) ────────────────────────────────────────────
async function fetchWebSearch(query: string, apiKey: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&text_decorations=false`;
    const resp = await fetch(url, {
      headers: { "Accept": "application/json", "X-Subscription-Token": apiKey },
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    return ((json.web?.results || []) as any[]).slice(0, 5).map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.description || "",
    }));
  } catch { return []; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { messages, section_content, assessment_title, sections_summary, attachments, writingSettings, tier } = body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing or invalid 'messages' array." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "ZOE is not configured (missing AI key). Contact support." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY") || "";

    // Autonomous model selection — user choice is ignored.
    const resolvedModel = selectModel(tier || "free");

    let contextNote = "";
    if (assessment_title) contextNote += `\n\nCurrent assessment: "${assessment_title}"`;
    if (section_content) contextNote += `\n\nCurrent section content (first 2000 chars):\n${section_content.slice(0, 2000)}`;
    if (sections_summary) contextNote += `\n\nSections overview:\n${sections_summary}`;
    if (writingSettings) {
      contextNote += `\n\n## User Writing Preferences\n` +
        `- Citation Style: ${writingSettings.citationStyle}\n` +
        `- Academic Level: ${writingSettings.academicLevel}\n` +
        `- Assessment Type: ${writingSettings.assessmentType}\n` +
        `- Writing Tone: ${writingSettings.writingTone}\n` +
        `- Humanisation: ${writingSettings.humanisationLevel}\n` +
        `- Source Date Range: ${writingSettings.sourceDateFrom}–${writingSettings.sourceDateTo}\n` +
        `Apply these preferences automatically to all writing, editing, and generation tasks.`;
    }

    // Add tier context
    contextNote += `\n\nUser tier: ${tier || "free"}. Model in use: ${resolvedModel}.`;

    // Pre-fetch Semantic Scholar results if the last user message mentions sources/references
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const lastText = (lastUserMsg?.content || "").toLowerCase();
    const wantsSources = lastText.includes("source") || lastText.includes("reference") || lastText.includes("citation") || lastText.includes("find paper") || lastText.includes("academic");
    if (wantsSources && assessment_title) {
      const topic = assessment_title;
      const scholarResults = await fetchSemanticScholar(topic, 5);
      if (scholarResults) {
        contextNote += `\n\nSEMANTIC SCHOLAR — verified papers for topic "${topic}":\n${scholarResults}\n\n(Use ONLY these real papers when citing sources. Do NOT invent references.)`;
      }
    }

    // ── File attachment processing ─────────────────────────────────────────
    // Strict budgets to prevent "CPU Time exceeded" on large multi-file prompts.
    // Per-file caps keep any single download/parse from blowing the request budget.
    // The total text budget caps how much extracted prose we shove into context.
    const PER_FILE_BYTE_LIMIT = 8 * 1024 * 1024;   // 8 MB hard cap per file fetch
    const PER_FILE_FETCH_MS   = 12_000;            // 12s fetch+download timeout per file
    const PER_FILE_PARSE_MS   = 8_000;             // 8s parse timeout per file
    const TOTAL_TEXT_BUDGET   = 60_000;            // total chars of extracted prose injected
    const PER_FILE_TEXT_MAX   = 12_000;            // cap any single file's extracted text
    const IMAGE_BYTE_LIMIT    = 6 * 1024 * 1024;   // 6 MB cap for inline images
    const MAX_IMAGES          = 4;

    const multimodalParts: { type: string; image_url?: { url: string } }[] = [];
    let textBudgetRemaining = TOTAL_TEXT_BUDGET;
    let imagesAccepted = 0;
    const skipNotes: string[] = [];

    // Race a promise against a timeout so a slow download / hung parse
    // can't burn the entire CPU budget for the request.
    function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        p.then(v => { clearTimeout(t); resolve(v); },
               e => { clearTimeout(t); reject(e); });
      });
    }

    // Fetch a file with a size cap — abort the read once we exceed limit.
    async function fetchCapped(url: string, maxBytes: number): Promise<{ buffer: ArrayBuffer; truncated: boolean }> {
      const ctrl = new AbortController();
      const resp = await fetch(url, { signal: ctrl.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const cl = resp.headers.get("content-length");
      if (cl && Number(cl) > maxBytes) {
        ctrl.abort();
        throw new Error(`file is ${(Number(cl) / 1024 / 1024).toFixed(1)}MB — exceeds ${(maxBytes / 1024 / 1024).toFixed(0)}MB cap`);
      }
      // Stream-read up to the cap; abort if we cross it.
      const reader = resp.body?.getReader();
      if (!reader) {
        const buffer = await resp.arrayBuffer();
        if (buffer.byteLength > maxBytes) throw new Error(`file exceeds ${(maxBytes / 1024 / 1024).toFixed(0)}MB cap`);
        return { buffer, truncated: false };
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      let truncated = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          if (total + value.byteLength > maxBytes) {
            truncated = true;
            ctrl.abort();
            const remaining = maxBytes - total;
            if (remaining > 0) chunks.push(value.slice(0, remaining));
            break;
          }
          chunks.push(value);
          total += value.byteLength;
        }
      }
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
      return { buffer: out.buffer, truncated };
    }

    function classify(att: { name: string; type: string }) {
      const n = (att.name || "").toLowerCase();
      const t = (att.type || "").toLowerCase();
      return {
        isText: t.startsWith("text/") || t === "application/json" ||
                /\.(md|txt|csv|json|log|xml|yaml|yml)$/.test(n),
        isPDF: t === "application/pdf" || n.endsWith(".pdf"),
        isImage: t.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(n),
        isDocx: t.includes("wordprocessingml") || n.endsWith(".docx"),
        isXlsx: t.includes("spreadsheetml") || n.endsWith(".xlsx"),
        isPptx: n.endsWith(".pptx"),
      };
    }

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      contextNote += "\n\nATTACHED FILES:";

      // Hard cap on number of files we even try to process.
      const MAX_FILES = 8;
      const filesToProcess = (attachments as { name: string; url: string; type: string }[])
        .filter(a => a && typeof a.url === "string" && typeof a.name === "string")
        .slice(0, MAX_FILES);
      if (attachments.length > MAX_FILES) {
        skipNotes.push(`${attachments.length - MAX_FILES} extra file(s) ignored — limit is ${MAX_FILES}/turn.`);
      }

      // Process files sequentially so the budget can short-circuit cleanly,
      // but each file is wrapped in its own timeout so one bad file can't
      // stall the whole request.
      for (const att of filesToProcess) {
        const kind = classify(att);
        contextNote += `\n\n[File: ${att.name}]`;

        // If we've burned the text budget, skip parsing further non-image files.
        if (!kind.isImage && textBudgetRemaining <= 200) {
          contextNote += "\n[Skipped — total extracted text budget for this turn was exhausted by earlier files. Ask user to send fewer files or paste key passages.]";
          skipNotes.push(`${att.name} skipped (budget exhausted)`);
          continue;
        }

        try {
          if (kind.isImage) {
            if (imagesAccepted >= MAX_IMAGES) {
              contextNote += `\n[Image skipped — only ${MAX_IMAGES} images per turn.]`;
              continue;
            }
            const { buffer } = await withTimeout(
              fetchCapped(att.url, IMAGE_BYTE_LIMIT),
              PER_FILE_FETCH_MS, `fetch ${att.name}`,
            );
            const uint8 = new Uint8Array(buffer);
            let binary = "";
            const chunkSize = 0x8000;
            for (let i = 0; i < uint8.length; i += chunkSize) {
              binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize) as unknown as number[]);
            }
            const b64 = btoa(binary);
            const n = att.name.toLowerCase();
            const mimeType = (att.type && att.type.startsWith("image/"))
              ? att.type
              : (n.endsWith(".png") ? "image/png" :
                 n.endsWith(".gif") ? "image/gif" :
                 n.endsWith(".webp") ? "image/webp" : "image/jpeg");
            multimodalParts.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } });
            imagesAccepted++;
            contextNote += "\n[Image transmitted — analyse visually]";

          } else if (kind.isText) {
            const { buffer, truncated } = await withTimeout(
              fetchCapped(att.url, PER_FILE_BYTE_LIMIT),
              PER_FILE_FETCH_MS, `fetch ${att.name}`,
            );
            const text = new TextDecoder().decode(buffer);
            const slice = text.slice(0, Math.min(PER_FILE_TEXT_MAX, textBudgetRemaining));
            contextNote += `\n${slice}`;
            textBudgetRemaining -= slice.length;
            if (truncated || text.length > slice.length) {
              contextNote += `\n[…truncated…]`;
            }

          } else if (kind.isPDF) {
            const { buffer } = await withTimeout(
              fetchCapped(att.url, PER_FILE_BYTE_LIMIT),
              PER_FILE_FETCH_MS, `fetch ${att.name}`,
            );
            let extracted = "";
            try {
              const result = await withTimeout(
                extractText(new Uint8Array(buffer), { mergePages: true }) as Promise<{ text: string | string[] }>,
                PER_FILE_PARSE_MS, `parse ${att.name}`,
              );
              const t = result?.text;
              extracted = (Array.isArray(t) ? t.join("\n\n") : t || "").trim();
            } catch (parseErr) {
              console.warn(`[zoe-chat] pdf parse failed for ${att.name}:`, (parseErr as Error).message);
            }
            if (extracted.length > 0) {
              const slice = extracted.slice(0, Math.min(PER_FILE_TEXT_MAX, textBudgetRemaining));
              contextNote += `\n${slice}`;
              textBudgetRemaining -= slice.length;
              if (extracted.length > slice.length) contextNote += `\n[…PDF truncated, ${extracted.length} total chars…]`;
            } else {
              contextNote += `\n[PDF "${att.name}" appears to be scanned/image-only — no extractable text. Ask user to paste key passages or upload .docx.]`;
              skipNotes.push(`${att.name} (no extractable text)`);
            }

          } else if (kind.isDocx || kind.isXlsx || kind.isPptx) {
            const { buffer } = await withTimeout(
              fetchCapped(att.url, PER_FILE_BYTE_LIMIT),
              PER_FILE_FETCH_MS, `fetch ${att.name}`,
            );
            let plainText = "";
            try {
              plainText = await withTimeout((async () => {
                const zip = new JSZip();
                await zip.loadAsync(new Uint8Array(buffer));
                let xmlContent = "";
                if (kind.isDocx) {
                  const docFile = zip.file("word/document.xml");
                  if (docFile) xmlContent = await docFile.async("string");
                } else if (kind.isXlsx) {
                  const filesMap = zip.files as Record<string, any>;
                  const sheetFiles = Object.keys(filesMap).filter(f => /xl\/worksheets\/sheet\d+\.xml/.test(f)).slice(0, 3);
                  for (const sf of sheetFiles) xmlContent += await filesMap[sf].async("string") + "\n";
                } else if (kind.isPptx) {
                  const filesMap = zip.files as Record<string, any>;
                  const slideFiles = Object.keys(filesMap).filter(f => /ppt\/slides\/slide\d+\.xml/.test(f)).slice(0, 20);
                  for (const sf of slideFiles) xmlContent += await filesMap[sf].async("string") + "\n";
                }
                if (!xmlContent) return "";
                return xmlContent
                  .replace(/<a:br[^>]*\/?>/g, "\n").replace(/<w:br[^>]*\/?>/g, "\n")
                  .replace(/<\/w:p>/g, "\n").replace(/<\/a:p>/g, "\n")
                  .replace(/<[^>]+>/g, " ")
                  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
                  .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, " ")
                  .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
              })(), PER_FILE_PARSE_MS, `parse ${att.name}`);
            } catch (parseErr) {
              console.warn(`[zoe-chat] office parse failed for ${att.name}:`, (parseErr as Error).message);
            }
            if (plainText) {
              const slice = plainText.slice(0, Math.min(PER_FILE_TEXT_MAX, textBudgetRemaining));
              contextNote += `\n${slice}`;
              textBudgetRemaining -= slice.length;
              if (plainText.length > slice.length) contextNote += `\n[…truncated, ${plainText.length} total chars…]`;
            } else {
              contextNote += "\n[Could not extract text from this Office file — please paste the key sections.]";
              skipNotes.push(`${att.name} (office extraction failed)`);
            }

          } else {
            // Unknown — try as text, fall back gracefully.
            try {
              const { buffer } = await withTimeout(
                fetchCapped(att.url, PER_FILE_BYTE_LIMIT),
                PER_FILE_FETCH_MS, `fetch ${att.name}`,
              );
              const text = new TextDecoder().decode(buffer);
              const isBinary = text.includes("\x00") || /[\x01-\x08\x0E-\x1F]/.test(text.slice(0, 200));
              if (!isBinary) {
                const slice = text.slice(0, Math.min(6_000, textBudgetRemaining));
                contextNote += `\n${slice}`;
                textBudgetRemaining -= slice.length;
              } else {
                contextNote += "\n[Binary file — cannot extract text from this format]";
                skipNotes.push(`${att.name} (unsupported binary format)`);
              }
            } catch (e) {
              contextNote += `\n[Could not retrieve file: ${(e as Error).message}]`;
              skipNotes.push(`${att.name} (fetch failed)`);
            }
          }
        } catch (e) {
          // Per-file failure: log and continue with the rest.
          const msg = (e as Error).message || "unknown error";
          console.warn(`[zoe-chat] attachment failed: ${att.name}:`, msg);
          contextNote += `\n[Failed: ${msg}]`;
          skipNotes.push(`${att.name} (${msg})`);
        }
      }

      if (skipNotes.length > 0) {
        contextNote += `\n\n[ZOE NOTE: ${skipNotes.length} file(s) had issues. If the user asks about them, briefly mention which were skipped: ${skipNotes.join("; ")}.]`;
      }
    }

    // ── Build final messages array — inject multimodal parts into last user message ──
    let processedMessages = [...messages];
    if (multimodalParts.length > 0) {
      const lastIdx = processedMessages.length - 1;
      const lastMsg = processedMessages[lastIdx];
      if (lastMsg?.role === "user") {
        processedMessages = [
          ...processedMessages.slice(0, lastIdx),
          {
            role: "user",
            content: [
              { type: "text", text: typeof lastMsg.content === "string" ? lastMsg.content : "" },
              ...multimodalParts,
            ],
          },
        ];
      }
    }

    // ── Gateway call with auto model fallback on 402/429 ────────────────────
    let activeModel = resolvedModel;
    let response: Response | null = null;
    let lastErrorBody = "";
    let lastErrorStatus = 0;
    const triedModels: string[] = [];

    for (let attempt = 0; attempt < 5; attempt++) {
      triedModels.push(activeModel);
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [
            { role: "system", content: ZOE_SYSTEM + contextNote },
            ...processedMessages,
          ],
          tools,
          stream: true,
        }),
      });

      if (response.ok) break;

      lastErrorStatus = response.status;
      lastErrorBody = await response.text().catch(() => "");
      console.warn(`[zoe-chat] gateway ${response.status} on ${activeModel}: ${lastErrorBody.slice(0, 300)}`);

      // Fall through on capacity / overload / transient gateway errors.
      if (response.status === 402 || response.status === 429 ||
          response.status === 500 || response.status === 502 ||
          response.status === 503 || response.status === 504) {
        const next = nextFallback(activeModel);
        if (next) {
          activeModel = next;
          continue;
        }
      }
      break;
    }

    if (!response || !response.ok) {
      console.error("AI gateway error:", lastErrorStatus, lastErrorBody, "tried:", triedModels);
      let userMsg = "ZOE couldn't reach the AI service. Please try again in a moment.";
      let status = lastErrorStatus || 500;
      if (lastErrorStatus === 402) {
        userMsg = "All AI models are out of credits — please top up your workspace usage.";
      } else if (lastErrorStatus === 429) {
        userMsg = "ZOE is being rate-limited across all fallback models. Try again in 30 seconds.";
      } else if (lastErrorStatus === 400) {
        const isMimeIssue = /invalid.*mime|invalid_image_format|only image/i.test(lastErrorBody);
        userMsg = isMimeIssue
          ? "One of your attachments couldn't be read by the AI (likely a scanned PDF or unsupported format). Try the .docx version or paste the text."
          : `The AI rejected the request: ${lastErrorBody.slice(0, 200) || "bad request"}`;
        status = 400;
      } else if (lastErrorStatus >= 500) {
        userMsg = "The AI service is temporarily unavailable. Please try again shortly.";
      }
      return new Response(JSON.stringify({ error: userMsg, status: lastErrorStatus, triedModels }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extraHeaders: Record<string, string> = {};
    if (activeModel !== resolvedModel) {
      extraHeaders["X-Zoe-Model-Switched"] = activeModel;
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("zoe-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
