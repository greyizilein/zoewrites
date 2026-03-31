import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Home, PenLine, X, BarChart3, LogOut, ChevronDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { stageLabels } from "./types";

interface Props {
  currentStage: number;
  onStageChange: (n: number) => void;
  onClose: () => void;
  userName: string;
  userTier: string;
  initials: string;
  recentAssessments: { id: string; title: string; status: string }[];
}

const stageIcons = ["📋", "🗂️", "✍️", "🔍", "🔄", "📥"];

export default function WriterSidebar({ currentStage, onStageChange, onClose, userName, userTier, initials, recentAssessments }: Props) {
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <>
      {/* Header */}
      <div className="px-4 py-4 flex-shrink-0 flex items-center justify-between border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-foreground text-background flex items-center justify-center text-[11px] font-black flex-shrink-0">Z</div>
          <span className="text-[15px] font-bold tracking-tight">ZOE Writes</span>
        </Link>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors md:hidden"
        >
          <X size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Nav */}
      <div className="px-3 pt-3 space-y-1 flex-shrink-0">
        <Link
          to="/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <Home size={16} />
          <span className="font-medium">Dashboard</span>
        </Link>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold bg-terracotta/10 text-terracotta">
          <PenLine size={16} />
          <span>Writer Engine</span>
        </div>
      </div>

      <div className="h-px bg-border mx-3 mt-3" />

      {/* Stages */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2">
        <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider px-1 pb-2">Stages</p>
        <div className="space-y-1">
          {stageLabels.map((label, i) => {
            const isDone = i < currentStage;
            const isCurrent = i === currentStage;
            return (
              <button
                key={i}
                onClick={() => { onStageChange(i); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all text-left ${
                  isCurrent
                    ? "bg-muted font-semibold text-foreground"
                    : isDone
                      ? "text-sage hover:bg-muted/40"
                      : "text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] transition-all ${
                  isCurrent ? "bg-terracotta text-white shadow-sm" :
                  isDone ? "bg-sage/15 text-sage" : "bg-muted text-muted-foreground"
                }`}>
                  {isDone ? <Check size={12} /> : stageIcons[i] || (i + 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{i + 1}. {label}</span>
                </div>
                {isCurrent && (
                  <div className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Recent assessments */}
        {recentAssessments.length > 0 && (
          <div className="mt-4">
            <div className="h-px bg-border mb-3" />
            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider px-1 pb-2">Recent</p>
            <div className="space-y-0.5">
              {recentAssessments.slice(0, 3).map(a => (
                <Link
                  key={a.id}
                  to={`/assessment/${a.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                >
                  <span className="text-[14px] flex-shrink-0">📄</span>
                  <span className="truncate flex-1">{a.title}</span>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    a.status === "complete" ? "bg-sage" : "bg-terracotta animate-pulse"
                  }`} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User profile */}
      <div className="border-t border-border flex-shrink-0 px-3 py-3">
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-terracotta/15 flex items-center justify-center text-[11px] font-bold text-terracotta flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-semibold truncate">{userName}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{userTier} plan</p>
          </div>
          <ChevronDown size={15} className={`text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
        </button>

        {profileOpen && (
          <div className="mt-1 space-y-0.5 animate-in fade-in slide-in-from-bottom-1 duration-150">
            <Link
              to="/analytics"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <BarChart3 size={15} /> Analytics
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
}
