import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query) return new Response(JSON.stringify({ error: "query required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY");

    // Try Brave Search first
    if (BRAVE_API_KEY) {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&text_decorations=false`;
      const resp = await fetch(url, {
        headers: { "Accept": "application/json", "X-Subscription-Token": BRAVE_API_KEY },
      });
      if (resp.ok) {
        const json = await resp.json();
        const results = ((json.web?.results || []) as any[]).slice(0, 5).map((r: any) => ({
          title: r.title || "",
          url: r.url || "",
          snippet: r.description || "",
        }));
        return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fallback: DuckDuckGo Instant Answer API (no key required, limited)
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    const ddgResp = await fetch(ddgUrl, { headers: { "User-Agent": "ZOEWrites/1.0" } });
    if (ddgResp.ok) {
      const ddg = await ddgResp.json();
      const results: { title: string; url: string; snippet: string }[] = [];
      if (ddg.AbstractText) {
        results.push({ title: ddg.Heading || query, url: ddg.AbstractURL || "", snippet: ddg.AbstractText.slice(0, 300) });
      }
      for (const r of (ddg.RelatedTopics || []).slice(0, 4)) {
        if (r.Text && r.FirstURL) {
          results.push({ title: r.Text.slice(0, 80), url: r.FirstURL, snippet: r.Text.slice(0, 250) });
        }
      }
      return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("web-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
