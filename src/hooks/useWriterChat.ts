import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readContentAndToolStream } from "@/lib/sseStream";
import { Section, WriterSettings } from "@/components/writer/types";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface UseWriterChatOptions {
  sections: Section[];
  assessment: any;
  settings: WriterSettings;
  selectedModel: string;
  setBriefText: (text: string) => void;
  setStage: (stage: number) => void;
  setUploadedFiles: (fn: (prev: File[]) => File[]) => void;
  setActiveIntakeMode: (mode: "paste" | "upload" | "url" | "fields") => void;
  streamSection: (id: string, isRevision?: boolean, feedback?: string) => Promise<void>;
  handleAnalyseBrief: () => Promise<void>;
  handleWriteAll: () => Promise<void>;
  handleQualityCheck: () => Promise<any>;
  handleEditProofread: () => Promise<any>;
  handleGenerateImages: () => Promise<void>;
  handleExport: () => Promise<void>;
}

export function useWriterChat({
  sections,
  assessment,
  settings,
  selectedModel,
  setBriefText,
  setStage,
  setUploadedFiles,
  setActiveIntakeMode,
  streamSection,
  handleAnalyseBrief,
  handleWriteAll,
  handleQualityCheck,
  handleEditProofread,
  handleGenerateImages,
  handleExport,
}: UseWriterChatOptions) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const executeChatAction = async (toolName: string, args: any) => {
    if (toolName === "export_document" && !args.confirmed) {
      setChatMessages(prev => [...prev, { role: "assistant", content: `⚠️ Confirm export? Reply "yes".` }]);
      return;
    }

    switch (toolName) {
      case "analyse_brief":
        if (args.brief_text) setBriefText(args.brief_text);
        setChatMessages(prev => [...prev, { role: "assistant", content: "📝 Analysing brief…" }]);
        setStage(0);
        await handleAnalyseBrief();
        break;
      case "write_all":
        setChatMessages(prev => [...prev, { role: "assistant", content: "✍️ Writing all sections…" }]);
        setStage(2);
        await handleWriteAll();
        break;
      case "write_section": {
        const query = (args.section_title || "").toLowerCase();
        const sec =
          sections.find(s => s.title.toLowerCase() === query) ||
          sections.find(s => s.title.toLowerCase().includes(query));
        if (sec) {
          setChatMessages(prev => [...prev, { role: "assistant", content: `✍️ Writing "${sec.title}"…` }]);
          setStage(2);
          await streamSection(sec.id);
        } else {
          setChatMessages(prev => [...prev, { role: "assistant", content: `❌ Section "${args.section_title}" not found.` }]);
        }
        break;
      }
      case "run_critique":
        setChatMessages(prev => [...prev, { role: "assistant", content: "🔍 Running critique…" }]);
        setStage(3);
        await handleQualityCheck();
        break;
      case "humanise_all":
        setChatMessages(prev => [...prev, { role: "assistant", content: "🎭 Humanising…" }]);
        setStage(2);
        for (const s of sections.filter(x => x.content)) {
          try {
            const { data } = await supabase.functions.invoke("humanise", {
              body: {
                content: s.content,
                word_target: s.word_target,
                mode: "full",
                model: selectedModel,
                voice_perspective: settings.firstPerson ? "first" : "third",
              },
            });
            if (data?.humanised_content) {
              const wc = data.humanised_content.split(/\s+/).filter(Boolean).length;
              await supabase.from("sections").update({ content: data.humanised_content, word_current: wc }).eq("id", s.id);
            }
          } catch { /* skip individual section */ }
        }
        break;
      case "export_document":
        setChatMessages(prev => [...prev, { role: "assistant", content: "📥 Exporting…" }]);
        setStage(8);
        await handleExport();
        break;
      case "apply_revision": {
        const revSec = sections.find(s =>
          s.title.toLowerCase() === (args.section_title || "").toLowerCase() ||
          s.title.toLowerCase().includes((args.section_title || "").toLowerCase()),
        );
        if (revSec) {
          setChatMessages(prev => [...prev, { role: "assistant", content: `📝 Revising "${revSec.title}"…` }]);
          setStage(4);
          await streamSection(revSec.id, true, args.feedback);
        }
        break;
      }
      case "generate_images":
        setChatMessages(prev => [...prev, { role: "assistant", content: "🖼️ Generating images…" }]);
        setStage(2);
        await handleGenerateImages();
        break;
      case "run_edit":
        setChatMessages(prev => [...prev, { role: "assistant", content: "✏️ Running edit & proofread…" }]);
        setStage(5);
        await handleEditProofread();
        break;
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please sign in again.");

      const resp = await fetch(`${CHAT_URL}/zoe-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg],
          section_content: sections.find(s => s.content)?.content || "",
          assessment_title: assessment?.title || "",
          sections_summary: sections.map(s => `${s.title} (${s.status}, ${s.word_current}w)`).join(", "),
          model: selectedModel,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Chat request failed");

      const { content, toolCalls } = await readContentAndToolStream(resp.body, (text) => {
        setChatMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: text } : m);
          }
          return [...prev, { role: "assistant", content: text }];
        });
      });

      // If the response was pure tool calls with no text, add a placeholder so
      // the user sees something while the tool action executes.
      if (!content && toolCalls.length > 0) {
        setChatMessages(prev => [...prev, { role: "assistant", content: "Working on it…" }]);
      }

      for (const tc of toolCalls) {
        try {
          const args = tc.arguments ? JSON.parse(tc.arguments) : {};
          await executeChatAction(tc.name, args);
        } catch (e: any) {
          setChatMessages(prev => [
            ...prev,
            { role: "assistant", content: `Action "${tc.name}" failed: ${e?.message || "unknown error"}` },
          ]);
        }
      }
    } catch (e: any) {
      setChatMessages(prev => [
        ...prev,
        { role: "assistant", content: `Sorry, an error occurred: ${e?.message || "unknown error"}` },
      ]);
    }

    setChatLoading(false);
  };

  const handleChatFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFiles(prev => [...prev, file]);
    setActiveIntakeMode("upload");
    setChatMessages(prev => [
      ...prev,
      { role: "user", content: `📎 Uploaded: ${file.name}` },
      { role: "assistant", content: `Received "${file.name}". Say "analyse my brief" to process it.` },
    ]);
  };

  return {
    chatOpen,
    setChatOpen,
    chatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    chatEndRef,
    handleChatSend,
    handleChatFileUpload,
  };
}
