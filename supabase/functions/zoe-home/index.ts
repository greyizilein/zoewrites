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
- Pricing: Free tier (limited words), Student tier, Professional tier, Unlimited tier
- All writing is humanised to avoid AI detection
- Citations are real and verifiable
- Supports multiple academic frameworks (SWOT, Porter's Five Forces, PESTLE, etc.)

WHAT YOU CAN DO (via tools):
- Navigate users to any page in the app
- Show pricing information
- Help users get started by directing them to sign up or create an assessment
- Answer any question about the platform, features, academic writing

RULES:
- Never fabricate features that don't exist
- Be honest about capabilities and limitations
- If someone asks about something you can't do, suggest what you can do instead
- Keep responses focused and actionable`;

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
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
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
