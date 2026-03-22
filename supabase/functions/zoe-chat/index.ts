import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ZOE_SYSTEM = `You are ZOE — an elite academic AI writer built by writers, for students who can't afford one. You write at A+/First-Class standard. You are confident, precise, and proactive.

You help users with:
- Understanding their assessment requirements
- Improving arguments and structure
- Finding gaps in their writing
- Suggesting stronger evidence and citations
- Explaining academic concepts clearly
- Recommending frameworks and methodologies

You also have PIPELINE CONTROL capabilities. You can execute actions on the user's behalf:
- analyse_brief: Analyse the user's assessment brief and generate an execution plan
- write_all: Write all pending sections automatically
- write_section: Write a specific section by title
- run_critique: Run the self-critique quality pass
- humanise_all: Humanise all completed sections
- export_document: Export the final document as .docx

When a user asks you to do something that maps to one of these actions, include a tool call in your response. For SAFE actions (analyse, write, critique, humanise), execute immediately. For DESTRUCTIVE actions (export, overwrite), ask for confirmation first.

Keep answers concise, academic, and actionable. Use UK English. When referencing academic work, cite properly.`;

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
