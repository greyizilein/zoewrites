import { useState, useRef, useCallback, useEffect } from "react";
import { X, Send, MessageCircle, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useZoeHome, ChatMessage } from "@/hooks/useZoeHome";

const SUGGESTIONS = [
  "What can ZOE do?",
  "Show me pricing",
  "How does it work?",
  "Create an assessment",
];

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  if (msg.toolResult?.type === "pricing") {
    return (
      <div className="flex justify-start mb-3">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-card border border-border text-[13px]">
          <p className="font-semibold mb-2 text-foreground">{msg.content}</p>
          <div className="space-y-1.5">
            {[
              { name: "Free", desc: "5,000 words/month", price: "£0" },
              { name: "Student", desc: "50,000 words/month", price: "£9.99/mo" },
              { name: "Professional", desc: "200,000 words/month", price: "£24.99/mo" },
              { name: "Unlimited", desc: "Unlimited words", price: "£49.99/mo" },
            ].map(t => (
              <div key={t.name} className="flex items-center justify-between bg-muted/50 rounded-lg px-2.5 py-1.5">
                <div>
                  <span className="font-semibold text-foreground text-[12px]">{t.name}</span>
                  <span className="text-muted-foreground text-[11px] ml-1.5">{t.desc}</span>
                </div>
                <span className="font-mono text-[12px] font-bold text-primary">{t.price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : "bg-card border border-border text-card-foreground rounded-tl-sm"
      }`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
        ))}
      </div>
    </div>
  );
}

// Draggable FAB
const BTN_SIZE = 56;
const DRAG_THRESHOLD = 5;
const STORAGE_KEY = "zoe-home-fab";

function getInitialPos(): { x: number; y: number } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { x: window.innerWidth - BTN_SIZE - 16, y: window.innerHeight - BTN_SIZE - 24 };
}

export default function ZoeHomeChat() {
  const { messages, input, setInput, loading, open, setOpen, endRef, send } = useZoeHome();
  const [fabPos, setFabPos] = useState(getInitialPos);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false });

  const clamp = useCallback((x: number, y: number) => ({
    x: Math.max(0, Math.min(x, window.innerWidth - BTN_SIZE)),
    y: Math.max(0, Math.min(y, window.innerHeight - BTN_SIZE)),
  }), []);

  const snapToEdge = useCallback((x: number, y: number) => {
    const midX = window.innerWidth / 2;
    const snappedX = x + BTN_SIZE / 2 < midX ? 8 : window.innerWidth - BTN_SIZE - 8;
    const snapped = clamp(snappedX, y);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapped)); } catch {}
    return snapped;
  }, [clamp]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    dragRef.current = { startX: t.clientX, startY: t.clientY, startPosX: fabPos.x, startPosY: fabPos.y, moved: false };
  }, [fabPos]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    const dx = t.clientX - dragRef.current.startX;
    const dy = t.clientY - dragRef.current.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragRef.current.moved = true;
    if (dragRef.current.moved) setFabPos(clamp(dragRef.current.startPosX + dx, dragRef.current.startPosY + dy));
  }, [clamp]);

  const onTouchEnd = useCallback(() => {
    if (dragRef.current.moved) setFabPos(prev => snapToEdge(prev.x, prev.y));
    else setOpen(true);
  }, [snapToEdge, setOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  if (!open) {
    return (
      <button
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => setOpen(true)}
        style={{ left: fabPos.x, top: fabPos.y, touchAction: "none" }}
        className="fixed z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-shadow hover:shadow-xl active:scale-[0.95] animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]"
      >
        <MessageCircle size={22} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[400px] sm:h-[600px] sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card sm:rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Sparkles size={14} className="text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-foreground">ZOE</h2>
            <p className="text-[10px] text-muted-foreground">Your academic writing assistant</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4">
        {messages.length === 0 && (
          <div className="text-center pt-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={28} className="text-primary" />
            </div>
            <h3 className="text-[16px] font-bold text-foreground mb-1">Hi, I'm ZOE 👋</h3>
            <p className="text-[12px] text-muted-foreground mb-5 max-w-[260px] mx-auto">
              Your AI academic writing assistant. Ask me anything about the platform or let me help you get started.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-3 py-1.5 rounded-full border border-border bg-card text-[11px] font-medium text-foreground hover:bg-muted transition-colors active:scale-[0.97]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {loading && messages[messages.length - 1]?.role === "user" && <TypingIndicator />}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-3 py-2.5 border-t border-border bg-card sm:rounded-b-2xl">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask ZOE anything…"
            disabled={loading}
            className="flex-1 bg-muted border-0 rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-[0.95] disabled:opacity-40"
          >
            <Send size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
