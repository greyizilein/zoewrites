import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { readContentAndToolStream } from "@/lib/sseStream";

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoe-home`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolResult?: { type: string; data?: any };
}

export function useZoeHome() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        const sectionMap: Record<string, string> = {
          pricing: "pricing",
          features: "features",
          "how-it-works": "how-it-works",
          hero: "hero",
          footer: "footer",
        };
        const elId = sectionMap[args.section] || args.section;
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
    }
  }, [navigate]);

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

      if (!content && toolCalls.length > 0) {
        // No text content, just tool calls
      }

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
  }, [input, loading, messages, executeToolCall]);

  return { messages, input, setInput, loading, open, setOpen, endRef, send };
}
