import React, { useState, useRef, useCallback } from "react";
import { MessageCircle } from "lucide-react";

interface DraggableChatFabProps {
  onClick: () => void;
}

const STORAGE_KEY = "zoe-fab-pos";
const BTN_SIZE = 56;
const DRAG_THRESHOLD = 5;

function getInitialPos(): { x: number; y: number } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    x: window.innerWidth - BTN_SIZE - 16,
    y: window.innerHeight - BTN_SIZE - 80,
  };
}

const DraggableChatFab: React.FC<DraggableChatFabProps> = ({ onClick }) => {
  const [pos, setPos] = useState(getInitialPos);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false });

  const clamp = useCallback((x: number, y: number) => {
    const maxX = window.innerWidth - BTN_SIZE;
    const maxY = window.innerHeight - BTN_SIZE;
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };
  }, []);

  const snapToEdge = useCallback((x: number, y: number) => {
    const midX = window.innerWidth / 2;
    const snappedX = x + BTN_SIZE / 2 < midX ? 8 : window.innerWidth - BTN_SIZE - 8;
    const snapped = clamp(snappedX, y);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapped)); } catch {}
    return snapped;
  }, [clamp]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    dragRef.current = { startX: t.clientX, startY: t.clientY, startPosX: pos.x, startPosY: pos.y, moved: false };
  }, [pos]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    const dx = t.clientX - dragRef.current.startX;
    const dy = t.clientY - dragRef.current.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      dragRef.current.moved = true;
    }
    if (dragRef.current.moved) {
      setPos(clamp(dragRef.current.startPosX + dx, dragRef.current.startPosY + dy));
    }
  }, [clamp]);

  const onTouchEnd = useCallback(() => {
    if (dragRef.current.moved) {
      setPos((prev) => snapToEdge(prev.x, prev.y));
    } else {
      onClick();
    }
  }, [onClick, snapToEdge]);

  return (
    <button
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={(e) => { e.preventDefault(); }}
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
      className="fixed z-40 w-14 h-14 rounded-full bg-terracotta text-white shadow-lg flex items-center justify-center active:scale-[0.95] transition-shadow md:hidden"
    >
      <MessageCircle size={22} />
    </button>
  );
};

export default DraggableChatFab;
