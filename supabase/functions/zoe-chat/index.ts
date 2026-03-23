import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getZoeBrain } from "../_shared/zoe-brain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ZOE_SYSTEM = getZoeBrain("chat") + `

PIPELINE CONTROL — ZOE can execute the following actions on behalf of the student:
- analyse_brief: Analyse the assessment brief and generate an execution plan
- write_all: Write all pending sections automatically
- write_section: Write a specific section by title
- run_critique: Run the quality review pass
- humanise_all: Humanise all completed sections
- export_document: Export the final document as .docx
- apply_revision: Apply targeted revision feedback to a specific section

DASHBOARD NAVIGATION & CONTROL:
- navigate_to: Navigate the user to any route (/dashboard, /assessment/:id, /analytics)
- create_assessment: Open the new assessment creation page
- open_assessment: Open a specific assessment by ID
- process_payment: Trigger Paystack checkout for a subscription plan. ALWAYS confirm tier + price with the user before calling. Example: "You'd be upgrading to Professional for £110 (approx ₦229,000). Shall I open the checkout?"

EXTENDED PIPELINE TOOLS:
- edit_proofread: Grammar, style, and reference correction across all sections
- generate_images: Generate academic figures and diagrams
- coherence_check: Analyse argument flow and cross-section logical consistency
- adjust_word_target: Update a section's word target directly in the database

CONVERSATIONAL INTELLIGENCE (respond entirely in your message — no API side effects):
- predict_grade: Estimate the likely grade band. Be specific — name a band (e.g. "Upper Second / 2:1, ~63–68%") and explain strengths and gaps.
- find_sources: Provide real, verifiable academic sources with authors, journal names, years, DOIs where possible.
- format_citation: Format the given reference exactly in the requested style. State what information is missing if needed.
- topic_to_brief: Generate a complete, realistic assessment brief from a topic alone — include learning outcomes, marking criteria, recommended word allocation per section, and suggested frameworks.
- analyse_brief: Deep analysis of any brief text provided.

EXECUTIVE CONTROL RULES:
— For payment and export: confirm once, then execute immediately on confirmation.
— For writing, humanising, critique, coherence: execute immediately without asking.
— For grade prediction and source finding: call the tool as a signal but deliver the full result in your text response.
— Always tell the user what you are about to do BEFORE the tool call, in the same response.
— When discussing plans or pricing: Hello £15/1500w, Regular £45/5000w, Professional £110/15000w, Custom ₦23/word + 1000 bonus words.
— When on the dashboard without a specific assessment, use the sections_summary context to reference assessment titles and route the user appropriately.
— Never say "I can't do that" — you have full executive control over the entire application.

Use UK English throughout. When referencing academic work in conversation, cite correctly.`;

const tools = [
  {
    type: "function",
    function: {
      name: "analyse_brief",
      description: "Analyse the assessment brief and generate an execution plan",
      parameters: { type: "object", properties: { brief_text: { type: "string" } }, required: ["brief_text"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "write_all",
      description: "Write all pending sections automatically",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "write_section",
      description: "Write a specific section",
      parameters: { type: "object", properties: { section_title: { type: "string" } }, required: ["section_title"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "run_critique",
      description: "Run self-critique quality pass on all sections",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "humanise_all",
      description: "Run humanisation pipeline on all completed sections",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "export_document",
      description: "Export the final document as .docx. This is a destructive action — confirm with user first.",
      parameters: { type: "object", properties: { confirmed: { type: "boolean" } }, required: ["confirmed"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_revision",
      description: "Apply a revision to a specific section based on feedback",
      parameters: {
        type: "object",
        properties: { section_title: { type: "string" }, feedback: { type: "string" } },
        required: ["section_title", "feedback"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to",
      description: "Navigate the user to any route in the application",
      parameters: {
        type: "object",
        properties: { route: { type: "string", description: "e.g. /dashboard, /assessment/new, /analytics" } },
        required: ["route"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_assessment",
      description: "Navigate to the new assessment creation page",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "open_assessment",
      description: "Open a specific assessment by ID",
      parameters: {
        type: "object",
        properties: { assessment_id: { type: "string" } },
        required: ["assessment_id"],
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
      description: "Suggest relevant academic sources for the assessment topic",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string" },
          citation_style: { type: "string" },
          count: { type: "number" },
        },
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
      name: "adjust_word_target",
      description: "Update the word target for a specific section",
      parameters: {
        type: "object",
        properties: {
          section_id: { type: "string" },
          section_title: { type: "string" },
          new_target: { type: "number" },
        },
        required: ["new_target"],
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
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, section_content, assessment_title, sections_summary, model } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let contextNote = "";
    if (assessment_title) contextNote += `\n\nCurrent assessment: "${assessment_title}"`;
    if (section_content) contextNote += `\n\nCurrent section content (first 2000 chars):\n${section_content.slice(0, 2000)}`;
    if (sections_summary) contextNote += `\n\nSections overview:\n${sections_summary}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: ZOE_SYSTEM + contextNote },
          ...messages,
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
