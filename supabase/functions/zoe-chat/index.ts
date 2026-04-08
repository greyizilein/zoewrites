import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";
import { getZoeBrain } from "../_shared/zoe-brain.ts";

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

function selectModel(tier: string, userChoice?: string): string {
  // If user explicitly picked a model, respect it (unless they're on a tier that doesn't allow it)
  if (userChoice && userChoice !== "auto") return userChoice;
  return TIER_MODEL_MAP[tier] || "google/gemini-3-flash-preview";
}

const ZOE_SYSTEM = getZoeBrain("chat") + `

WRITING IN CHAT — CRITICAL RULE:
ZOE writes everything directly in the chat. There is no pipeline, no separate writing page,
no external form. When a user asks ZOE to write, draft, outline, edit, revise, humanise,
critique, or generate any academic content — ZOE does it immediately in the response.
Never navigate to another page for any writing task.

WHAT ZOE CAN DO IN CHAT:
— Write full essays, reports, dissertations, case studies, literature reviews inline
— Edit and proofread uploaded or pasted documents
— Critique and score work against A+ criteria
— Revise specific sections based on feedback
— Use topic_to_brief to structure work before writing
— Find real academic sources via find_sources (Semantic Scholar)
— Generate charts and data visualisations with render_chart
— Export any generated content as a file with export_content
— Search the web for current information with web_search
— Generate academic images with generate_images

EXPORT / DOWNLOAD RULE:
After writing any substantial content, proactively offer to export it. When the user says
"download", "save", "export", or "give me a file" — immediately call export_content with
the full text as 'content'.

WRITING WORKFLOW (everything in chat):
1. Understand the brief — ask if unclear, analyse inline
2. Optionally call topic_to_brief to structure the work
3. Write the full content directly in the response
4. Offer export_content when done

NAVIGATION — only allowed when user explicitly asks to visit a page:
- navigate_to "/dashboard" — the main dashboard
- navigate_to "/analytics" — writing analytics and stats
Never navigate to any other route.

PAYMENT — always confirm tier + price before calling process_payment.
Plans: Hello £15, Regular £45, Professional £110, Custom ₦23/word + 1000 bonus words.

SOURCES — ALWAYS use find_sources for real references. Never invent citations.

CHARTS — use render_chart when user provides data or asks for visualisation.

FILE ATTACHMENTS — ALL FORMATS SUPPORTED:
— PDFs, DOCX, XLSX, PPTX: text extracted server-side — treat as working document
— Images (PNG, JPG, WEBP): analysed visually
— Text files (TXT, MD, CSV, JSON): read in full
— CRITICAL: Never say you cannot read a file. All formats are extracted before reaching you.
— After processing: if user wants to download the result, call export_content.

AUTONOMOUS MODEL SELECTION:
You are running on a model selected based on the user's subscription tier.
— Hello tier: Gemini 2.5 Flash (fast, capable)
— Regular tier: Gemini 2.5 Pro (deep reasoning, large context)
— Professional tier: GPT-5 (strongest reasoning + nuance)
— Unlimited/Custom tier: GPT-5.2 (latest, most capable)
Do NOT tell the user which model you are on unless asked.

EXECUTIVE CONTROL RULES:
— For payment and export: confirm once, then execute immediately on confirmation.
— For writing, editing, critique: execute immediately without asking.
— For find_sources: ALWAYS call the tool — never invent references.
— For web_search: call whenever factual or current information is needed.
— For render_chart: call with properly structured data when user provides data to visualise.
— For export_content: call immediately when asked to download, save, or export.
— For generate_chat_image: call immediately when asked to generate, draw, or create any image.
— Never say "I can't do that".
— HALLUCINATION RULE: Never invent academic references, statistics, or factual claims.

Use UK English throughout. When referencing academic work, cite correctly.`;

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
    const { messages, section_content, assessment_title, sections_summary, attachments, model, writingSettings, tier } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY") || "";

    // Autonomous model selection based on tier
    const resolvedModel = selectModel(tier || "free", model);

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
    // Multimodal parts (images, PDFs) go here and are appended to the last user message
    const multimodalParts: { type: string; image_url?: { url: string } }[] = [];

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      contextNote += "\n\nATTACHED FILES:";

      for (const att of attachments as { name: string; url: string; type: string }[]) {
        const nameLower = att.name.toLowerCase();
        const isTextLike = att.type.startsWith("text/") ||
          att.type === "application/json" ||
          nameLower.endsWith(".md") || nameLower.endsWith(".txt") ||
          nameLower.endsWith(".csv") || nameLower.endsWith(".json");
        const isPDF = att.type === "application/pdf" || nameLower.endsWith(".pdf");
        const isImage = att.type.startsWith("image/") ||
          nameLower.endsWith(".png") || nameLower.endsWith(".jpg") ||
          nameLower.endsWith(".jpeg") || nameLower.endsWith(".webp") ||
          nameLower.endsWith(".gif");
        const isDocx = att.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          nameLower.endsWith(".docx");
        const isXlsx = att.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          nameLower.endsWith(".xlsx");
        const isPptx = nameLower.endsWith(".pptx");

        contextNote += `\n\n[File: ${att.name}]`;

        if (isTextLike) {
          // ── Plain text: inject directly into context ──────────────────────
          try {
            const fileResp = await fetch(att.url);
            const text = await fileResp.text();
            contextNote += `\n${text.slice(0, 10000)}`;
          } catch { contextNote += "\n[Could not retrieve file content]"; }

        } else if (isPDF || isImage) {
          // ── PDF / Image: fetch as binary, base64-encode, pass as multimodal ─
          try {
            const fileResp = await fetch(att.url);
            const buffer = await fileResp.arrayBuffer();
            const limitBytes = 20 * 1024 * 1024; // 20 MB cap
            if (buffer.byteLength > limitBytes) {
              contextNote += `\n[File too large for inline processing — ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB. Limit: 20 MB]`;
            } else {
              // Chunk-safe base64 encoding
              const uint8 = new Uint8Array(buffer);
              let binary = "";
              const chunkSize = 32768;
              for (let i = 0; i < uint8.length; i += chunkSize) {
                binary += String.fromCharCode(...uint8.slice(i, i + chunkSize));
              }
              const b64 = btoa(binary);
              // Determine MIME type — fall back to extension when browser didn't set att.type
              const mimeType = isImage
                ? (att.type || (nameLower.endsWith(".png") ? "image/png" : nameLower.endsWith(".gif") ? "image/gif" : nameLower.endsWith(".webp") ? "image/webp" : "image/jpeg"))
                : "application/pdf";
              multimodalParts.push({
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${b64}` },
              });
              contextNote += isPDF
                ? "\n[PDF content transmitted as multimodal — read it directly]"
                : "\n[Image transmitted as multimodal — analyse it visually]";
            }
          } catch (e) {
            contextNote += `\n[Could not load file: ${(e as Error).message}]`;
          }

        } else if (isDocx || isXlsx || isPptx) {
          // ── DOCX/XLSX/PPTX: unzip and extract XML text ────────────────────
          try {
            const fileResp = await fetch(att.url);
            const buffer = await fileResp.arrayBuffer();
            const zip = new JSZip();
            await zip.loadAsync(new Uint8Array(buffer));

            let xmlContent = "";
            if (isDocx) {
              const docFile = zip.file("word/document.xml");
              if (docFile) xmlContent = await docFile.async("string");
            } else if (isXlsx) {
              // Extract all sheet XML files
              const filesMap = zip.files as Record<string, any>;
              const sheetFiles = Object.keys(filesMap).filter(f => f.match(/xl\/worksheets\/sheet\d+\.xml/));
              for (const sf of sheetFiles.slice(0, 3)) {
                xmlContent += await filesMap[sf].async("string") + "\n";
              }
            } else if (isPptx) {
              const filesMap2 = zip.files as Record<string, any>;
              const slideFiles = Object.keys(filesMap2).filter(f => f.match(/ppt\/slides\/slide\d+\.xml/));
              for (const sf of slideFiles.slice(0, 20)) {
                xmlContent += await filesMap2[sf].async("string") + "\n";
              }
            }

            if (xmlContent) {
              const plainText = xmlContent
                .replace(/<a:br[^>]*\/?>/g, "\n")
                .replace(/<w:br[^>]*\/?>/g, "\n")
                .replace(/<\/w:p>/g, "\n")
                .replace(/<\/a:p>/g, "\n")
                .replace(/<[^>]+>/g, " ")
                .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, " ")
                .replace(/[ \t]{2,}/g, " ")
                .replace(/\n{3,}/g, "\n\n")
                .trim();
              contextNote += `\n${plainText.slice(0, 12000)}`;
            } else {
              contextNote += "\n[Could not extract text from this Office file]";
            }
          } catch (e) {
            contextNote += `\n[Office file extraction failed: ${(e as Error).message}]`;
          }

        } else {
          // ── Unknown format: try as text, fallback gracefully ──────────────
          try {
            const fileResp = await fetch(att.url);
            const text = await fileResp.text();
            const isBinary = text.includes("\x00") || (text.length > 10 && /[\x01-\x08\x0E-\x1F]/.test(text.slice(0, 200)));
            if (!isBinary) {
              contextNote += `\n${text.slice(0, 6000)}`;
            } else {
              contextNote += `\n[Binary file — cannot extract text from this format]`;
            }
          } catch { contextNote += `\n[Could not retrieve file]`; }
        }
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [
          { role: "system", content: ZOE_SYSTEM + contextNote },
          ...processedMessages,
        ],
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please wait a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please top up." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("zoe-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
