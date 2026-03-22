import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VARIANT_PROMPTS = [
  (title: string, context: string) =>
    `Create a professional academic DIAGRAM for the section "${title}". Show relationships, processes, or hierarchies as a clean labelled diagram. Context: ${context}. Use a clean white background with professional colours. No text paragraphs — only a visual diagram.`,
  (title: string, context: string) =>
    `Create a professional academic CHART or TABLE visualisation for the section "${title}". Show data comparisons, distributions, or categorisations as a chart, graph, or structured table. Context: ${context}. Use a clean white background with professional colours. No text paragraphs — only a visual chart/table.`,
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assessment_id, sections } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const generatedImages: any[] = [];
    let figureNumber = 1;

    for (const section of sections) {
      if (!section.content) continue;
      const context = (section.content || "").slice(0, 500);

      // Generate 2 variants per section
      for (let vi = 0; vi < VARIANT_PROMPTS.length; vi++) {
        const prompt = VARIANT_PROMPTS[vi](section.title, context);

        try {
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-image-preview",
              messages: [{ role: "user", content: prompt }],
              modalities: ["image", "text"],
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (imageUrl) {
              generatedImages.push({
                section_id: section.id,
                section_title: section.title,
                figure_number: figureNumber,
                variant: vi + 1,
                caption: `Figure ${figureNumber}: ${vi === 0 ? "Diagram" : "Chart"} for ${section.title}`,
                prompt,
                url: imageUrl,
                image_type: vi === 0 ? "diagram" : "chart",
                selected: false,
              });
              figureNumber++;
            }
          }
        } catch (imgErr) {
          console.error(`Image generation failed for section ${section.title} variant ${vi + 1}:`, imgErr);
        }

        // Rate limit protection
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    return new Response(JSON.stringify({ success: true, images: generatedImages, count: generatedImages.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-images error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
