import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus, LogOut, Home, FileText, Settings, Loader2, Trash2,
  BarChart3, MoreHorizontal, PenSquare, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

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

/* SVG Donut Arc */
const DonutGauge = ({ value, max, size = 180 }: { value: number; max: number; size?: number }) => {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const dashOffset = circ * (1 - pct);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} opacity={0.3} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="hsl(var(--terracotta))"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
        className="transition-all duration-700 ease-out"
      />
      <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground text-2xl font-bold" style={{ fontSize: 28 }}>
        {fmt(value)}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
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
  const [profile, setProfile] = useState<{
    full_name: string | null; tier: string; words_used: number; word_limit: number;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const [{ data: ad }, { data: pd }] = await Promise.all([
        supabase.from("assessments").select("id, title, type, word_current, word_target, status, updated_at")
          .eq("user_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("profiles").select("full_name, tier, words_used, word_limit")
          .eq("user_id", user.id).single(),
      ]);
      setAssessments(ad || []);
      setProfile(pd as any);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete this assessment? This cannot be undone.")) return;
    try {
      await supabase.from("sections").delete().eq("assessment_id", id);
      const { error } = await supabase.from("assessments").delete().eq("id", id);
      if (error) throw error;
      setAssessments(prev => prev.filter(a => a.id !== id));
      toast({ title: "Assessment deleted" });
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
  const totalWordsWritten = assessments.reduce((a, b) => a + b.word_current, 0);
  const totalWordsTarget = assessments.reduce((a, b) => a + b.word_target, 0);
  const completedCount = assessments.filter(a => a.status === "complete").length;
  const activeCount = assessments.filter(a => !["complete", "draft"].includes(a.status)).length;
  const draftCount = assessments.filter(a => a.status === "draft").length;
  const avgCompletion = assessments.length > 0
    ? Math.round(assessments.reduce((s, a) => s + (a.word_target > 0 ? (a.word_current / a.word_target) * 100 : 0), 0) / assessments.length)
    : 0;

  // Chart data — last 7 assessments completion %
  const chartData = assessments.slice(0, 7).reverse().map(a => ({
    name: a.title.slice(0, 8),
    pct: a.word_target > 0 ? Math.round((a.word_current / a.word_target) * 100) : 0,
    done: a.status === "complete",
  }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta" />
      </div>
    );
  }

  const tileClass = "flex flex-col items-center justify-center rounded-xl border border-border bg-card cursor-pointer hover:shadow-md hover:border-foreground/10 active:scale-[0.96] transition-all duration-200";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="w-56 border-r border-border bg-card/30 p-4 hidden md:flex flex-col">
        <Link to="/" className="flex items-center mb-8">
          <span className="text-xl font-extrabold text-foreground tracking-tight">ZOE</span>
        </Link>
        <nav className="space-y-1 flex-1">
          <Link to="/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-terracotta/10 text-foreground">
            <Home size={15} /> Home
          </Link>
          <Link to="/assessment/new" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Plus size={15} /> New Assessment
          </Link>
          <Link to="/analytics" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <BarChart3 size={15} /> Analytics
          </Link>
        </nav>
        <div className="border-t border-border pt-4 space-y-1">
          <button onClick={handleSignOut} className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors w-full text-left">
            <LogOut size={15} /> Sign Out
          </button>
          <div className="flex items-center gap-2 px-3 py-2 mt-1">
            <div className="w-7 h-7 rounded-full bg-terracotta/15 flex items-center justify-center text-[10px] font-semibold text-terracotta">{initials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{userName}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{profile?.tier || "free"} tier</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 pb-20 md:pb-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="md:hidden">
              <span className="text-lg font-extrabold text-foreground tracking-tight">ZOE</span>
            </Link>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Welcome, <span className="text-foreground font-medium">{userName}</span>
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full bg-terracotta/15 flex items-center justify-center text-xs font-semibold text-terracotta active:scale-95 transition-transform">
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
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive focus:text-destructive">
                  <LogOut size={14} /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-5">
          {/* Hero Gauge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease }}
            className="flex flex-col items-center mb-5"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's Progress</p>
            <div className="flex items-center gap-5">
              <DonutGauge value={totalWordsWritten} max={totalWordsTarget || 1} />
              <div className="space-y-2.5">
                {[
                  { label: "Complete", count: completedCount, color: "bg-sage" },
                  { label: "Active", count: activeCount, color: "bg-terracotta" },
                  { label: "Draft", count: draftCount, color: "bg-muted-foreground/40" },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                    <span className="text-xs text-muted-foreground">{s.count} {s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Stat Tiles — 3 columns */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease }}
            className="grid grid-cols-3 gap-2 mb-3"
          >
            {[
              { label: "Words Left", value: isUnlimited ? "∞" : fmt(wordsLeft as number), color: "text-terracotta" },
              { label: "Assessments", value: assessments.length.toString(), color: "text-muted-blue" },
              { label: "Avg. Done", value: `${avgCompletion}%`, color: "text-dusty-purple" },
            ].map((t, i) => (
              <motion.div
                key={t.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.06, ease }}
                className={`${tileClass} h-[72px] p-2`}
              >
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{t.label}</p>
                <p className={`text-lg font-bold tabular-nums leading-tight ${t.color}`}>{t.value}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Action Tiles — 3 columns */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease }}
            className="grid grid-cols-3 gap-2 mb-5"
          >
            {[
              { label: "New", icon: Plus, to: "/assessment/new", bg: "bg-terracotta/10", ic: "text-terracotta" },
              { label: "Analytics", icon: BarChart3, to: "/analytics", bg: "bg-muted-blue/10", ic: "text-muted-blue" },
              { label: "Settings", icon: Settings, to: "/dashboard", bg: "bg-dusty-purple/10", ic: "text-dusty-purple" },
            ].map((a, i) => (
              <motion.div
                key={a.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + i * 0.06, ease }}
              >
                <Link to={a.to} className={`${tileClass} h-[72px] p-2 gap-1`}>
                  <div className={`w-8 h-8 rounded-lg ${a.bg} flex items-center justify-center`}>
                    <a.icon size={16} className={a.ic} />
                  </div>
                  <span className="text-[10px] font-medium text-foreground">{a.label}</span>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease }}
            className="mb-5"
          >
            <Link to="/assessment/new">
              <Button className="w-full bg-terracotta hover:bg-terracotta/90 text-white font-semibold h-11 rounded-xl active:scale-[0.97] transition-transform">
                <Plus size={16} className="mr-1.5" /> New Assessment
              </Button>
            </Link>
          </motion.div>

          {/* Recent Assessments */}
          {assessments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease }}
              className="rounded-xl border border-border bg-card p-3 mb-4"
            >
              <h2 className="text-xs font-semibold text-foreground mb-2">Recent Assessments</h2>
              <div className="space-y-0.5">
                {assessments.slice(0, 5).map(a => {
                  const pct = a.word_target > 0 ? Math.round((a.word_current / a.word_target) * 100) : 0;
                  const done = a.status === "complete";
                  return (
                    <div key={a.id} className="flex items-center gap-2 group">
                      <Link
                        to={`/assessment/${a.id}`}
                        className="flex items-center gap-2 flex-1 min-w-0 px-1.5 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? "bg-sage" : "bg-terracotta"}`} />
                        <span className="text-xs font-medium text-foreground truncate flex-1">{a.title}</span>
                        <span className="text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
                        <span className="text-[10px] text-muted-foreground">{getTimeAgo(a.updated_at)}</span>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
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

          {/* Empty state */}
          {assessments.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="text-center py-12"
            >
              <FileText size={40} className="mx-auto text-muted-foreground/20 mb-3" />
              <h2 className="text-base font-semibold text-foreground mb-1">No assessments yet</h2>
              <p className="text-xs text-muted-foreground mb-4">Create your first assessment to get started.</p>
              <Link to="/assessment/new">
                <Button className="bg-terracotta hover:bg-terracotta/90 text-white font-semibold active:scale-[0.97] transition-transform">
                  <Plus size={16} className="mr-1" /> Create First Assessment
                </Button>
              </Link>
            </motion.div>
          )}

          {/* Mini Chart */}
          {chartData.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4, ease }}
              className="rounded-xl border border-border bg-card p-3"
            >
              <h2 className="text-xs font-semibold text-foreground mb-2">Completion Trend</h2>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={chartData} barCategoryGap="20%">
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis hide domain={[0, 100]} />
                  <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.done ? "hsl(var(--sage))" : "hsl(var(--terracotta))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-1.5">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sage" /><span className="text-[9px] text-muted-foreground">Complete</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-terracotta" /><span className="text-[9px] text-muted-foreground">In Progress</span></div>
              </div>
            </motion.div>
          )}
        </main>

        {/* Bottom Nav — mobile only */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
          <div className="flex items-center justify-around h-14 max-w-md mx-auto">
            {[
              { icon: Home, label: "Home", to: "/dashboard" },
              { icon: PenSquare, label: "New", to: "/assessment/new" },
              { icon: BarChart3, label: "Analytics", to: "/analytics" },
              { icon: Settings, label: "Settings", to: "/dashboard" },
              { icon: User, label: "Profile", to: "/dashboard" },
            ].map(item => {
              const active = location.pathname === item.to && item.label === "Home";
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${active ? "text-terracotta" : "text-muted-foreground"} active:scale-95`}
                >
                  <item.icon size={18} />
                  <span className="text-[9px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Dashboard;
