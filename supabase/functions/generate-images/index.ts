import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      // Generate one image per section that has content
      if (!section.content) continue;
      const figureRefs = [{ ref: `Figure ${figureNumber}` }]; // Always generate at least one per section

      for (const ref of figureRefs) {
        const prompt = `Create a professional academic diagram or figure for the following context. The figure should be clean, labeled, and suitable for an academic paper. Section: "${section.title}". Content context: ${(section.content || "").slice(0, 500)}. The figure should illustrate key concepts, relationships, or data mentioned in this section. Use a clean white background with professional colors.`;

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
              // Store metadata
              const { data: imgRecord } = await supabase.from("assessment_images").insert({
                section_id: section.id,
                figure_number: figureNumber,
                caption: `Figure ${figureNumber}: Illustration for ${section.title}`,
                prompt,
                url: imageUrl,
                image_type: "diagram",
              }).select().single();

              if (imgRecord) {
                generatedImages.push(imgRecord);
                figureNumber++;
              }
            }
          }
        } catch (imgErr) {
          console.error(`Image generation failed for section ${section.title}:`, imgErr);
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
