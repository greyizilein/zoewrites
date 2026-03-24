import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM = `You are ZOE — the AI academic writing assistant powering ZOE Writes.

You live on the homepage as a friendly, knowledgeable guide. You help visitors understand the platform, answer questions, and guide them to take action.

PERSONALITY:
- Warm, confident, professional — like a brilliant academic mentor
- UK English throughout
- Concise but thorough — never rambling
- You genuinely care about helping students succeed

WHAT YOU KNOW:
- ZOE Writes is an AI-powered academic writing platform
- It helps students write essays, reports, dissertations, and assignments
- Features: brief analysis, execution planning, section-by-section writing, humanisation, self-critique, revision, edit & proofread, image generation, .docx export
- Pipeline: Upload Brief → Analyse → Plan → Write & Humanise → Self-Critique → Revise → Edit & Proofread → Final Scan → Export
- Pricing tiers:
  • Free: 5,000 words/month — £0
  • Student: 50,000 words/month — £9.99/mo
  • Professional: 200,000 words/month — £24.99/mo
  • Unlimited: Unlimited words — £49.99/mo
- All writing is humanised to avoid AI detection
- Citations are real and verifiable
- Supports multiple academic frameworks (SWOT, Porter's Five Forces, PESTLE, etc.)

FEATURES DETAIL (for demo/explanation):
1. Brief Analysis — Paste or upload your assignment brief. ZOE extracts word count, structure, learning outcomes, and constraints automatically.
2. Execution Planning — ZOE creates a detailed section-by-section plan with word targets, frameworks, and citation counts.
3. AI Writing — Each section is written individually with proper academic tone, real citations, and framework application.
4. Humanisation — All AI-written content is processed to read naturally and pass AI detection tools.
5. Self-Critique — ZOE reviews the work against marking criteria and identifies weaknesses.
6. Revision — Targeted improvements based on critique feedback, section by section.
7. Edit & Proofread — Grammar, spelling, formatting, and academic style corrections.
8. Image Generation — Create diagrams, charts, and figures referenced in your work.
9. Export — Download as formatted .docx with proper headings, citations, and figures.

WHAT YOU CAN DO (via tools):
- Navigate users to any page in the app
- Show pricing information inline
- Walk users through a feature demo explaining each pipeline step
- Direct users to sign up or log in
- Help users start creating an assessment
- Open a specific subscription tier for the user
- Scroll to any section on the homepage

RULES:
- Never fabricate features that don't exist
- Be honest about capabilities and limitations
- If someone asks about something you can't do, suggest what you can do instead
- Keep responses focused and actionable
- When users want to create an assessment or start writing, check if they need to sign up first
- When showing feature demos, be visual and descriptive — walk through each step`;

const tools = [
  {
    type: "function",
    function: {
      name: "navigate_page",
      description: "Navigate the user to a page in the app",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The route path, e.g. /auth, /dashboard, /analytics, /assessment/new" },
          reason: { type: "string", description: "Brief explanation of why navigating there" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scroll_to_section",
      description: "Scroll to a section on the homepage like pricing, features, or how-it-works",
      parameters: {
        type: "object",
        properties: {
          section: { type: "string", enum: ["pricing", "features", "how-it-works", "hero", "footer"] },
        },
        required: ["section"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_pricing",
      description: "Display pricing tier information inline in the chat",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "create_assessment",
      description: "Help the user start a new assessment. If they're not logged in, direct them to sign up first. If logged in, navigate to the new assessment page.",
      parameters: {
        type: "object",
        properties: {
          is_authenticated: { type: "boolean", description: "Whether the user is currently logged in" },
        },
        required: ["is_authenticated"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_signup",
      description: "Direct the user to the sign-up / login page to create an account or log in",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["signup", "login"], description: "Whether to show signup or login form" },
          reason: { type: "string", description: "Why they need to sign up/log in" },
        },
        required: ["mode"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_feature_demo",
      description: "Show an interactive walkthrough of a specific feature or the full pipeline. Use this when users ask 'how does it work', 'show me a demo', 'what can you do', etc.",
      parameters: {
        type: "object",
        properties: {
          feature: {
            type: "string",
            enum: ["full_pipeline", "brief_analysis", "execution_planning", "writing", "humanisation", "self_critique", "revision", "edit_proofread", "image_generation", "export"],
            description: "Which feature to demonstrate",
          },
        },
        required: ["feature"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_subscription",
      description: "Open a specific subscription tier for the user. Shows tier details and directs to payment.",
      parameters: {
        type: "object",
        properties: {
          tier: { type: "string", enum: ["free", "student", "professional", "unlimited"], description: "Which tier to open" },
        },
        required: ["tier"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, is_authenticated } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Augment system prompt with auth context
    const authContext = is_authenticated
      ? "\n\nCONTEXT: The user is currently logged in. They can create assessments directly."
      : "\n\nCONTEXT: The user is NOT logged in. They need to sign up or log in before creating assessments.";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM + authContext },
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
        return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("zoe-home error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
