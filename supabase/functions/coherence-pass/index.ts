import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sections, model } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!sections || sections.length < 2) {
      return new Response(JSON.stringify({ success: true, report: { issues: [], summary: "Not enough sections for coherence analysis." } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiModel = model || "google/gemini-2.5-flash";

    // Build section summaries for analysis (first 600 chars of each body)
    const sectionSummaries = sections.map((s: any, i: number) => {
      const body = (s.content || "").replace(/\n## References[\s\S]*$/i, "").trim();
      const preview = body.slice(0, 600) + (body.length > 600 ? "…" : "");
      return `SECTION ${i + 1}: "${s.title}"\n${preview}`;
    }).join("\n\n---\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: "system",
            content: `You are ZOE's cross-section coherence auditor for academic writing. Analyse the sections provided for inter-section quality issues.

EVALUATE:
1. ARGUMENT FLOW — Does each section's conclusion logically connect to the next section's opening? Flag breaks in logical flow.
2. REPETITION — Are the same substantive points, evidence, or examples made in multiple sections? Flag exact repetitions.
3. CONTRADICTIONS — Do any sections make claims that directly contradict claims in other sections? Flag these as CRITICAL.
4. TERMINOLOGY CONSISTENCY — Are key concepts and terms defined and used consistently throughout? Flag inconsistencies.
5. NARRATIVE ARC — Does the work tell a coherent story from introduction to conclusion? Is the argument cumulative?
6. SECTION BALANCE — Are any sections disproportionately thin or tangential given their word count?
7. TRANSITION QUALITY — Does each section set up what follows? Are there abrupt topic changes?

For each issue, identify EXACTLY which sections are involved (use the section titles provided). Be specific — do not raise vague issues. Only flag real problems, not style preferences.`
          },
          {
            role: "user",
            content: `Analyse these sections for cross-section coherence issues:\n\n${sectionSummaries}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "coherence_report",
            description: "Return cross-section coherence issues",
            parameters: {
              type: "object",
              properties: {
                overall_coherence: { type: "string", enum: ["Strong", "Adequate", "Weak", "Fragmented"] },
                issues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      severity: { type: "string", enum: ["critical", "major", "minor"] },
                      type: { type: "string", enum: ["contradiction", "repetition", "flow_break", "terminology", "arc", "balance", "transition"] },
                      sections_involved: { type: "array", items: { type: "string" }, description: "Exact section titles involved" },
                      description: { type: "string" },
                      suggestion: { type: "string" },
                    },
                    required: ["severity", "type", "sections_involved", "description", "suggestion"],
                    additionalProperties: false,
                  }
                },
                summary: { type: "string" },
              },
              required: ["overall_coherence", "issues", "summary"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "coherence_report" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const report = toolCall ? JSON.parse(toolCall.function.arguments) : { issues: [], summary: "Coherence analysis complete." };

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coherence-pass error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
