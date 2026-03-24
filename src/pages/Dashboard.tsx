import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus, LogOut, Home, Loader2, Trash2, FileText,
  BarChart3, MoreHorizontal, PenSquare, RefreshCw, ChevronDown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import ZoeDashboardChat from "@/components/chat/ZoeDashboardChat";

interface Assessment {
  id: string;
  title: string;
  type: string | null;
  word_current: number;
  word_target: number;
  status: string;
  updated_at: string;
}

const fmt = (n: number): string => {
  if (n >= 1_000_000_000) return "∞";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
};

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en", { month: "short", day: "numeric" });
}

/* ── Speedometer gauge: 240° arc, starts at ~8 o'clock ─────────────────── */
const SpeedometerGauge = ({
  value, max, size = 210,
}: { value: number; max: number; size?: number }) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const sw = size * 0.075; // stroke width

  const circ = 2 * Math.PI * r;
  const sweepFrac = 240 / 360;
  const arcLen = circ * sweepFrac;
  const gapLen = circ - arcLen;

  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const filledLen = arcLen * pct;

  // rotate 150° from 3-o'clock position → arc starts at ~8 o'clock
  const rot = 150;

  // clip viewBox: show only the top portion (arc doesn't go below mid-bottom)
  const viewH = cy + r * 0.62 + sw;

  return (
    <svg width={size} height={viewH} viewBox={`0 0 ${size} ${viewH}`}>
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="hsl(var(--border))" strokeOpacity={0.5}
        strokeWidth={sw}
        strokeDasharray={`${arcLen} ${gapLen}`}
        strokeLinecap="round"
        transform={`rotate(${rot} ${cx} ${cy})`}
      />
      {/* Dark inner arc (secondary — total target indicator) */}
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="hsl(24,14%,20%)"
        strokeWidth={sw * 0.45}
        strokeOpacity={0.18}
        strokeDasharray={`${arcLen} ${gapLen}`}
        strokeLinecap="round"
        transform={`rotate(${rot} ${cx} ${cy})`}
      />
      {/* Filled arc — orange */}
      {pct > 0 && (
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="hsl(var(--terracotta))"
          strokeWidth={sw}
          strokeDasharray={`${filledLen} ${circ - filledLen}`}
          strokeLinecap="round"
          transform={`rotate(${rot} ${cx} ${cy})`}
          className="transition-all duration-700 ease-out"
        />
      )}
      {/* Value */}
      <text
        x={cx} y={cy - 2}
        textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: size * 0.145, fontWeight: 800, fill: "hsl(var(--foreground))", letterSpacing: "-1px" }}
      >
        {fmt(value)}
      </text>
      <text
        x={cx} y={cy + size * 0.12}
        textAnchor="middle"
        style={{ fontSize: size * 0.055, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
      >
        Total Words
      </text>
    </svg>
  );
};

const ease = [0.16, 1, 0.3, 1];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"week" | "all">("week");
  const [profile, setProfile] = useState<{
    full_name: string | null; tier: string; words_used: number; word_limit: number;
  } | null>(null);

  const refreshData = useCallback(async () => {
    if (!user) return;
    const [{ data: ad }, { data: pd }] = await Promise.all([
      supabase.from("assessments").select("id, title, type, word_current, word_target, status, updated_at")
        .eq("user_id", user.id).is("deleted_at", null).order("updated_at", { ascending: false }),
      supabase.from("profiles").select("full_name, tier, words_used, word_limit")
        .eq("user_id", user.id).single(),
    ]);
    setAssessments(ad || []);
    setProfile(pd as any);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Move this assessment to trash? You can recover it within 2 months.")) return;
    try {
      const { error } = await supabase.from("assessments")
        .update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setAssessments(prev => prev.filter(a => a.id !== id));
      toast({ title: "Moved to trash", description: "Ask ZOE to restore it anytime within 2 months." });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const userName = profile?.full_name || user?.email?.split("@")[0] || "there";
  const initials = userName.slice(0, 2).toUpperCase();
  const wordsUsed = profile?.words_used || 0;
  const wordLimit = profile?.word_limit || 500;
  const isUnlimited = wordLimit >= 1_000_000_000;
  const wordsLeft = isUnlimited ? Infinity : Math.max(0, wordLimit - wordsUsed);

  // Filter by time range
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const filtered = timeRange === "week"
    ? assessments.filter(a => now - new Date(a.updated_at).getTime() < weekMs)
    : assessments;

  const totalWordsWritten = filtered.reduce((a, b) => a + b.word_current, 0);
  const totalWordsTarget = filtered.reduce((a, b) => a + b.word_target, 0);
  const completedCount = filtered.filter(a => a.status === "complete").length;
  const activeCount = filtered.filter(a => !["complete", "draft"].includes(a.status)).length;
  const draftCount = filtered.filter(a => a.status === "draft").length;
  const avgCompletion = filtered.length > 0
    ? Math.round(filtered.reduce((s, a) => s + (a.word_target > 0 ? (a.word_current / a.word_target) * 100 : 0), 0) / filtered.length)
    : 0;

  // Chart: last 6 assessments — words written (orange) + remaining (dark)
  const chartData = assessments.slice(0, 6).reverse().map(a => ({
    name: a.title.slice(0, 6),
    written: a.word_current,
    remaining: Math.max(0, a.word_target - a.word_current),
    done: a.status === "complete",
  }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,20%,96%)] flex">
      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <aside className="w-56 border-r border-border bg-card hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <div className="p-5 pb-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center">
              <span className="text-white text-[11px] font-extrabold">ZW</span>
            </div>
            <span className="text-base font-extrabold text-foreground tracking-tight">ZOE Writes</span>
          </Link>
        </div>
        <nav className="p-3 space-y-0.5 flex-1">
          <Link to="/dashboard" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold bg-terracotta/10 text-terracotta">
            <Home size={15} /> Dashboard
          </Link>
          <Link to="/assessment/new" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Plus size={15} /> New Assessment
          </Link>
          <Link to="/analytics" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <BarChart3 size={15} /> Analytics
          </Link>
        </nav>
        <div className="p-3 border-t border-border space-y-0.5">
          <button onClick={handleSignOut} className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-colors w-full text-left">
            <LogOut size={15} /> Sign Out
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2.5 mt-1">
            <div className="w-7 h-7 rounded-full bg-terracotta/15 flex items-center justify-center text-[10px] font-semibold text-terracotta flex-shrink-0">{initials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{profile?.tier || "free"} tier</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 pb-20 md:pb-0 overflow-y-auto">

        {/* ── Desktop header ── */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 sticky top-0 z-40 bg-[hsl(220,20%,96%)]/95 backdrop-blur-sm border-b border-border">
          <div>
            <h1 className="text-lg font-bold text-foreground">Dashboard</h1>
            <p className="text-[11px] text-muted-foreground">{assessments.length} assessments · {profile?.tier || "free"} tier</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex bg-card border border-border rounded-full p-0.5 shadow-sm">
              {(["week", "all"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                    timeRange === r ? "bg-terracotta text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "week" ? "This Week" : "All Time"}
                </button>
              ))}
            </div>
            <button
              onClick={refreshData}
              className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm active:scale-95 transition-transform"
            >
              <RefreshCw size={13} />
            </button>
            <Link to="/assessment/new">
              <button className="flex items-center gap-1.5 px-4 py-2 bg-terracotta text-white rounded-xl text-[12px] font-bold hover:bg-terracotta/90 active:scale-[0.97] transition-all shadow-sm">
                <Plus size={13} /> New Assessment
              </button>
            </Link>
          </div>
        </header>

        {/* ── Mobile header ── */}
        <header className="md:hidden sticky top-0 z-40 bg-[hsl(220,20%,96%)]/90 backdrop-blur-sm pt-safe">
          <div className="max-w-lg mx-auto px-4 pt-3 pb-2 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity active:scale-[0.97]">
              <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center shadow-sm">
                <span className="text-white text-[10px] font-extrabold">ZW</span>
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground leading-none">ZOE Writes</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{assessments.length} Assessments</p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshData}
                className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm active:scale-95 transition-transform"
              >
                <RefreshCw size={13} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 rounded-full bg-terracotta/15 flex items-center justify-center text-xs font-bold text-terracotta active:scale-95 transition-transform border border-terracotta/20">
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{profile?.tier || "free"} tier</p>
                  </div>
                  <DropdownMenuItem asChild>
                    <Link to="/analytics" className="flex items-center gap-2"><BarChart3 size={14} /> Analytics</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive flex items-center gap-2">
                    <LogOut size={14} /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="max-w-lg mx-auto px-4 pb-2">
            <div className="inline-flex bg-card border border-border rounded-full p-0.5 shadow-sm">
              {(["week", "all"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-4 py-1 rounded-full text-[11px] font-semibold transition-all ${
                    timeRange === r ? "bg-terracotta text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "week" ? "This Week" : "All Time"}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        {/* Mobile: single column. Desktop: 2-column grid */}
        <main className="max-w-lg mx-auto px-4 space-y-3 pt-1 md:max-w-none md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6 md:px-8 md:py-6 md:items-start md:space-y-0">

          {/* ── Left column on desktop ─── */}
          <div className="md:space-y-6">

            {/* ── Hero card: Gauge + side stats ─────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease }}
              className="bg-card rounded-2xl shadow-sm border border-border/50 p-4 md:p-6"
            >
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's Activity</p>

              {/* Gauge — larger on desktop */}
              <div className="flex md:flex-col items-center gap-2 md:gap-4">
                <div className="flex-shrink-0 -mb-2 md:mb-0 md:mx-auto">
                  <SpeedometerGauge value={totalWordsWritten} max={totalWordsTarget || 1} size={200} />
                </div>

                {/* Side stats — row on mobile, grid on desktop */}
                <div className="flex flex-col md:grid md:grid-cols-3 gap-2 flex-1 pl-1 md:pl-0 w-full">
                  {[
                    { label: "Complete", count: completedCount, color: "bg-sage", textColor: "text-sage" },
                    { label: "In Progress", count: activeCount, color: "bg-terracotta", textColor: "text-terracotta" },
                    { label: "Draft", count: draftCount, color: "bg-muted-foreground/40", textColor: "text-muted-foreground" },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 md:flex-col md:items-start md:py-3">
                      <span className={`w-2 h-2 rounded-full ${s.color} flex-shrink-0`} />
                      <div className="min-w-0">
                        <p className={`text-base font-bold tabular-nums leading-none ${s.textColor}`}>{s.count}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick action row — mobile only (desktop uses sidebar + header button) */}
              <div className="md:hidden grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50">
                <Link to="/assessment/new" className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border/50 hover:border-foreground/10 hover:shadow-sm active:scale-[0.96] transition-all">
                  <div className="w-8 h-8 rounded-lg bg-terracotta/10 flex items-center justify-center">
                    <Plus size={15} className="text-terracotta" />
                  </div>
                  <span className="text-[9px] font-medium text-foreground text-center leading-tight">New Assessment</span>
                </Link>
                <Link to="/analytics" className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border/50 hover:border-foreground/10 hover:shadow-sm active:scale-[0.96] transition-all">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <BarChart3 size={15} className="text-blue-500" />
                  </div>
                  <span className="text-[9px] font-medium text-foreground text-center leading-tight">Analytics</span>
                </Link>
                <button onClick={handleSignOut} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border/50 hover:border-foreground/10 hover:shadow-sm active:scale-[0.96] transition-all">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <LogOut size={15} className="text-muted-foreground" />
                  </div>
                  <span className="text-[9px] font-medium text-foreground text-center leading-tight">Sign Out</span>
                </button>
              </div>
            </motion.div>

            {/* ── Words quota card ───────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.18, ease }}
              className="bg-card rounded-2xl shadow-sm border border-border/50 p-4 md:p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-bold text-foreground">Word Quota</p>
                <span className="text-[10px] font-semibold text-terracotta capitalize px-2 py-0.5 bg-terracotta/10 rounded-full">
                  {profile?.tier || "free"}
                </span>
              </div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-2xl font-extrabold text-foreground tabular-nums">
                    {isUnlimited ? "∞" : fmt(wordsLeft as number)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">words remaining</p>
                </div>
                <p className="text-[10px] text-muted-foreground">{fmt(wordsUsed)} used</p>
              </div>
              {!isUnlimited && (
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-terracotta rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (wordsUsed / wordLimit) * 100)}%` }}
                  />
                </div>
              )}
            </motion.div>

          </div>{/* end left column */}

          {/* ── Right column on desktop ─── */}
          <div className="md:space-y-6">

            {/* ── Assessment Progress card ───────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1, ease }}
              className="bg-card rounded-2xl shadow-sm border border-border/50 p-4 md:p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[13px] font-bold text-foreground">Assessment Progress</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">Performance</span>
                    <div className="flex -space-x-1">
                      {["bg-terracotta", "bg-sage", "bg-muted-blue"].map((c, i) => (
                        <span key={i} className={`w-4 h-4 rounded-full ${c} border-2 border-card`} />
                      ))}
                    </div>
                  </div>
                </div>
                <Link to="/analytics">
                  <button className="flex items-center gap-1 bg-muted/60 hover:bg-muted text-[10px] font-semibold text-foreground px-3 py-1.5 rounded-full transition-colors active:scale-95">
                    Get Report <ChevronDown size={10} />
                  </button>
                </Link>
              </div>

              {chartData.length > 0 ? (
                <>
                  <div className="flex items-end gap-4 mb-3">
                    <div>
                      <p className="text-4xl font-extrabold text-foreground tabular-nums leading-none">{avgCompletion}%</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Avg. Completion</p>
                      <p className="text-[9px] text-muted-foreground/60">Across {filtered.length} assessment{filtered.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height={110}>
                        <BarChart data={chartData} barCategoryGap="15%" barGap={2}>
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                            formatter={(v: any, name: string) => [fmt(v) + " words", name === "written" ? "Written" : "Remaining"]}
                          />
                          <Bar dataKey="written" radius={[3, 3, 0, 0]} maxBarSize={22} fill="#c27b5c" />
                          <Bar dataKey="remaining" radius={[3, 3, 0, 0]} maxBarSize={22} fill="#2e231a" opacity={0.65} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-terracotta" />
                      <span className="text-[9px] text-muted-foreground font-medium">Words Written</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[hsl(24,14%,20%)]" />
                      <span className="text-[9px] text-muted-foreground font-medium">Remaining</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">No data yet — start an assessment!</p>
              )}
            </motion.div>

            {/* ── Recent Assessments ─────────────────────────── */}
            {assessments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.24, ease }}
                className="bg-card rounded-2xl shadow-sm border border-border/50 p-4 md:p-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-bold text-foreground">Recent Assessments</p>
                  <Link to="/assessment/new">
                    <button className="w-6 h-6 rounded-full bg-terracotta/10 flex items-center justify-center active:scale-95 transition-transform">
                      <Plus size={12} className="text-terracotta" />
                    </button>
                  </Link>
                </div>
                {/* Mobile: 5 items. Desktop: all, in a grid */}
                <div className="space-y-1 md:grid md:grid-cols-2 md:gap-x-3 md:gap-y-1 md:space-y-0">
                  {assessments.slice(0, assessments.length > 5 ? undefined : 5).map(a => {
                    const pct = a.word_target > 0 ? Math.round((a.word_current / a.word_target) * 100) : 0;
                    const done = a.status === "complete";
                    return (
                      <div key={a.id} className="flex items-center gap-2 group">
                        <Link
                          to={`/assessment/${a.id}`}
                          className="flex items-center gap-2.5 flex-1 min-w-0 px-2 py-2 rounded-xl hover:bg-muted/50 transition-colors"
                        >
                          <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white ${done ? "bg-sage" : "bg-terracotta"}`}>
                            {pct}%
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-semibold text-foreground truncate">{a.title}</p>
                            <p className="text-[9px] text-muted-foreground">{fmt(a.word_current)}w · {getTimeAgo(a.updated_at)}</p>
                          </div>
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
                            <div
                              className={`h-full rounded-full ${done ? "bg-sage" : "bg-terracotta"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-1 flex-shrink-0">
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => handleDelete(e as any, a.id)} className="text-destructive focus:text-destructive">
                              <Trash2 size={14} className="mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── Empty state ─────────────────────────────────── */}
            {assessments.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
                className="bg-card rounded-2xl border border-border/50 shadow-sm text-center py-16 px-6"
              >
                <FileText size={40} className="mx-auto text-muted-foreground/20 mb-3" />
                <h2 className="text-base font-bold text-foreground mb-1">No assessments yet</h2>
                <p className="text-xs text-muted-foreground mb-5">Create your first to get started.</p>
                <Link to="/assessment/new">
                  <Button className="bg-terracotta hover:bg-terracotta/90 text-white font-semibold active:scale-[0.97] transition-transform rounded-xl">
                    <Plus size={16} className="mr-1.5" /> Create Assessment
                  </Button>
                </Link>
              </motion.div>
            )}

          </div>{/* end right column */}

        </main>

        {/* ── Bottom Nav — mobile only ─────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg">
          <div className="flex items-center justify-around h-[58px] max-w-md mx-auto px-2">
            {([
              { icon: Home, label: "Home", to: "/dashboard" },
              { icon: PenSquare, label: "New", to: "/assessment/new" },
              { icon: BarChart3, label: "Analytics", to: "/analytics" },
            ] as const).map(item => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors active:scale-95 ${
                    active ? "text-terracotta" : "text-muted-foreground"
                  }`}
                >
                  <item.icon size={19} strokeWidth={active ? 2.2 : 1.8} />
                  <span className="text-[9px] font-medium">{item.label}</span>
                  {active && <span className="w-1 h-1 rounded-full bg-terracotta mt-0.5" />}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-muted-foreground transition-colors active:scale-95"
            >
              <LogOut size={19} strokeWidth={1.8} />
              <span className="text-[9px] font-medium">Sign Out</span>
            </button>
          </div>
        </nav>
      </div>

      <ZoeDashboardChat
        assessments={assessments}
        profile={profile}
        userName={userName}
        onRefresh={refreshData}
      />
    </div>
  );

}

export default Dashboard;
