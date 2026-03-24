import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { readContentAndToolStream } from "@/lib/sseStream";
import { supabase } from "@/integrations/supabase/client";

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoe-home`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolResult?: { type: string; data?: any };
}

const FEATURE_DEMOS: Record<string, { title: string; icon: string; steps: string[] }> = {
  full_pipeline: {
    title: "Full Writing Pipeline",
    icon: "🔄",
    steps: [
      "📋 **Upload Brief** — Paste your assignment brief or upload a document",
      "🔍 **Analyse** — ZOE extracts word count, structure, learning outcomes, and constraints",
      "📊 **Plan** — A detailed section-by-section execution plan is created with word targets and frameworks",
      "✍️ **Write & Humanise** — Each section is written with academic rigour, real citations, and then humanised",
      "🔎 **Self-Critique** — ZOE reviews against marking criteria and identifies weaknesses",
      "🔧 **Revise** — Targeted improvements based on critique feedback",
      "✏️ **Edit & Proofread** — Grammar, spelling, formatting, and style corrections",
      "🖼️ **Images** — Generate diagrams, charts, and figures as needed",
      "📥 **Export** — Download as a formatted .docx ready for submission",
    ],
  },
  brief_analysis: {
    title: "Brief Analysis",
    icon: "🔍",
    steps: [
      "📋 Paste your assignment brief text or upload the document",
      "🤖 ZOE reads and parses the entire brief automatically",
      "📊 Extracts: word count target, required sections, learning outcomes",
      "⚙️ Identifies: constraints, formatting requirements, frameworks to apply",
      "✅ Produces a structured breakdown ready for the execution plan",
    ],
  },
  execution_planning: {
    title: "Execution Planning",
    icon: "📊",
    steps: [
      "📋 Based on the analysed brief, ZOE creates a section-by-section plan",
      "🎯 Each section gets a word target proportional to its importance",
      "📚 Recommended frameworks are assigned (e.g. SWOT, PESTLE, Porter's)",
      "🔢 Citation counts are allocated per section",
      "✅ You can review and adjust the plan before writing begins",
    ],
  },
  writing: {
    title: "AI Writing",
    icon: "✍️",
    steps: [
      "📝 Each section is written individually following the execution plan",
      "📚 Real, verifiable academic citations are woven in naturally",
      "🏗️ Frameworks are applied where specified (tables, analysis structures)",
      "🎯 Word targets are respected for each section",
      "🎭 Content is then humanised to read naturally and pass AI detection",
    ],
  },
  humanisation: {
    title: "Humanisation",
    icon: "🎭",
    steps: [
      "🤖 AI-generated content goes through a humanisation pass",
      "✍️ Sentence structure is varied to mimic natural writing patterns",
      "🗣️ Voice and tone are adjusted to match your academic level",
      "🔍 Output is designed to pass common AI detection tools",
      "✅ The meaning and citations remain intact throughout",
    ],
  },
  self_critique: {
    title: "Self-Critique",
    icon: "🔎",
    steps: [
      "📋 ZOE reviews the completed work against the original marking criteria",
      "📊 Each section is scored on depth, analysis, and academic rigour",
      "⚠️ Weaknesses and gaps are identified with specific feedback",
      "💡 Suggestions for improvement are provided per section",
      "🎯 An overall quality score helps you gauge readiness",
    ],
  },
  revision: {
    title: "Revision",
    icon: "🔧",
    steps: [
      "📝 Based on critique feedback, ZOE revises specific sections",
      "🎯 Targeted improvements address identified weaknesses",
      "📚 Additional citations may be added where depth was lacking",
      "✍️ Revised content is re-humanised automatically",
      "✅ You can request multiple revision passes if needed",
    ],
  },
  edit_proofread: {
    title: "Edit & Proofread",
    icon: "✏️",
    steps: [
      "📝 Grammar and spelling corrections throughout",
      "🎨 Formatting consistency (headings, spacing, references)",
      "📐 Academic style compliance (formal tone, third person, etc.)",
      "🔗 Citation format verification (Harvard, APA, etc.)",
      "✅ Final polished output ready for submission",
    ],
  },
  image_generation: {
    title: "Image Generation",
    icon: "🖼️",
    steps: [
      "📊 ZOE identifies where diagrams or figures would enhance your work",
      "🎨 Generates professional academic diagrams, charts, and flowcharts",
      "📝 Each image gets a proper figure number and caption",
      "🔗 Images are referenced correctly within the text",
      "📥 All images are included in the final .docx export",
    ],
  },
  export: {
    title: "Export",
    icon: "📥",
    steps: [
      "📄 All sections are compiled into a single formatted document",
      "📐 Proper heading hierarchy and formatting applied",
      "📚 Reference list / bibliography generated automatically",
      "🖼️ Figures inserted with captions and numbering",
      "💾 Download as .docx — ready to submit",
    ],
  },
};

const TIER_DETAILS: Record<string, { name: string; price: string; words: string; features: string[] }> = {
  free: { name: "Free", price: "£0", words: "5,000 words/month", features: ["Basic writing pipeline", "Standard AI model", "Limited exports"] },
  student: { name: "Student", price: "£9.99/mo", words: "50,000 words/month", features: ["Full writing pipeline", "Advanced AI models", "Unlimited exports", "Image generation"] },
  professional: { name: "Professional", price: "£24.99/mo", words: "200,000 words/month", features: ["Everything in Student", "Priority processing", "Advanced frameworks", "Bulk operations"] },
  unlimited: { name: "Unlimited", price: "£49.99/mo", words: "Unlimited words", features: ["Everything in Professional", "No word limits", "Premium support", "Early access to features"] },
};

export function useZoeHome() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check auth state
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session);
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const executeToolCall = useCallback((name: string, args: any) => {
    switch (name) {
      case "navigate_page":
        navigate(args.path);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: args.reason || `Navigating to ${args.path}…`,
          toolResult: { type: "navigate", data: { path: args.path } },
        }]);
        break;

      case "scroll_to_section": {
        const elId = args.section;
        const el = document.getElementById(elId);
        if (el) {
          setOpen(false);
          setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 300);
        }
        break;
      }

      case "show_pricing":
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Here are our pricing tiers:",
          toolResult: { type: "pricing" },
        }]);
        break;

      case "create_assessment":
        if (isAuthenticated) {
          navigate("/assessment/new");
          setMessages(prev => [...prev, {
            role: "assistant",
            content: "Taking you to create a new assessment! 🚀",
            toolResult: { type: "navigate", data: { path: "/assessment/new" } },
          }]);
        } else {
          navigate("/auth");
          setMessages(prev => [...prev, {
            role: "assistant",
            content: "You'll need to sign up or log in first. Taking you there now — once you're in, you can create your first assessment straight away! ✨",
            toolResult: { type: "navigate", data: { path: "/auth" } },
          }]);
        }
        break;

      case "start_signup":
        navigate("/auth");
        setMessages(prev => [...prev, {
          role: "assistant",
          content: args.mode === "login"
            ? "Taking you to the login page… 🔑"
            : "Taking you to sign up — it only takes a moment! ✨",
          toolResult: { type: "navigate", data: { path: "/auth" } },
        }]);
        break;

      case "show_feature_demo": {
        const demo = FEATURE_DEMOS[args.feature];
        if (demo) {
          const stepsText = demo.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `${demo.icon} **${demo.title}**\n\n${stepsText}`,
            toolResult: { type: "feature_demo", data: { feature: args.feature, demo } },
          }]);
        }
        break;
      }

      case "open_subscription": {
        const tier = TIER_DETAILS[args.tier];
        if (tier) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `💎 **${tier.name} Plan** — ${tier.price}\n\n📝 ${tier.words}\n\n**Includes:**\n${tier.features.map(f => `• ${f}`).join("\n")}`,
            toolResult: { type: "subscription", data: { tier: args.tier, ...tier } },
          }]);
          // Scroll to pricing section
          const el = document.getElementById("pricing");
          if (el) {
            setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 500);
          }
        }
        break;
      }
    }
  }, [navigate, isAuthenticated]);

  const send = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          is_authenticated: isAuthenticated,
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }

      const { content, toolCalls } = await readContentAndToolStream(resp.body, (text) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.toolResult) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: text } : m);
          }
          return [...prev, { role: "assistant", content: text }];
        });
      });

      for (const tc of toolCalls) {
        try {
          const args = tc.arguments ? JSON.parse(tc.arguments) : {};
          executeToolCall(tc.name, args);
        } catch {}
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Sorry, something went wrong: ${e?.message || "unknown error"}`,
      }]);
    }

    setLoading(false);
  }, [input, loading, messages, executeToolCall, isAuthenticated]);

  return { messages, input, setInput, loading, open, setOpen, endRef, send };
}
