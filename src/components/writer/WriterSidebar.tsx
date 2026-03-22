import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Home, PenLine, X, Settings, BarChart3, LogOut, ChevronUp } from "lucide-react";
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

const dotClass = (i: number, current: number) => {
  if (i === current) return "w-2 h-2 rounded-full bg-terracotta animate-pulse shadow-[0_0_5px_hsl(18,50%,53%,0.4)] flex-shrink-0";
  if (i < current) return "w-2 h-2 rounded-full bg-sage flex-shrink-0";
  return "w-2 h-2 rounded-full bg-border flex-shrink-0";
};

export default function WriterSidebar({ currentStage, onStageChange, onClose, userName, userTier, initials, recentAssessments }: Props) {
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <>
      {/* Top */}
      <div className="p-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors">
            <div className="w-6 h-6 rounded-md bg-foreground text-background flex items-center justify-center text-[10px] font-black flex-shrink-0">Z</div>
            <span className="text-[15px] font-bold">ZOE</span>
          </Link>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted/50 transition-colors md:hidden">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Nav items */}
      <div className="px-2 space-y-0.5">
        <Link to="/dashboard" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-muted-foreground hover:bg-muted/50 transition-colors">
          <Home size={14} /> Home
        </Link>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium bg-muted/50 text-foreground">
          <PenLine size={14} /> Writer Engine
        </div>
      </div>

      <div className="h-px bg-border mx-2 my-1" />

      {/* Stages */}
      <div className="flex-1 overflow-y-auto px-2">
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider px-2.5 pt-2.5 pb-1">Writer Stages</p>
        {stageLabels.map((label, i) => (
          <button
            key={i}
            onClick={() => { onStageChange(i); onClose(); }}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-all mb-0.5 ${
              i === currentStage ? "bg-muted/50 font-medium text-foreground" :
              i < currentStage ? "text-sage" : "text-muted-foreground"
            } hover:bg-muted/50`}
          >
            <span className={dotClass(i, currentStage)} />
            {i + 1}. {label}
          </button>
        ))}

        {recentAssessments.length > 0 && (
          <>
            <div className="h-px bg-border my-3" />
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider px-2.5 pb-1">Recent</p>
            {recentAssessments.slice(0, 3).map(a => (
              <Link
                key={a.id}
                to={`/assessment/${a.id}`}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="text-[14px] w-[18px] text-center">📄</span>
                <span className="truncate flex-1">{a.title}</span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.status === "complete" ? "bg-sage" : "bg-terracotta animate-pulse"}`} />
              </Link>
            ))}
          </>
        )}
      </div>

      {/* User with expandable menu */}
      <div className="border-t border-border flex-shrink-0">
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="w-full p-2 flex items-center gap-2 px-2.5 py-2.5 hover:bg-muted/50 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-terracotta/15 flex items-center justify-center text-[10px] font-semibold text-terracotta flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-medium truncate">{userName}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{userTier} plan</p>
          </div>
          <ChevronUp size={14} className={`text-muted-foreground transition-transform ${profileOpen ? "" : "rotate-180"}`} />
        </button>

        {profileOpen && (
          <div className="px-2 pb-2 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <Link
              to="/analytics"
              onClick={onClose}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <BarChart3 size={14} /> Analytics
            </Link>
            <Link
              to="/dashboard"
              onClick={onClose}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <Settings size={14} /> Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
}
