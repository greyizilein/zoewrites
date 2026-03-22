import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Clock, MoreHorizontal, LogOut, Home, FileText, Settings, Loader2, Trash2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Assessment {
  id: string;
  title: string;
  type: string | null;
  word_current: number;
  word_target: number;
  status: string;
  updated_at: string;
}

const statusStyles: Record<string, string> = {
  draft: "bg-terracotta/10 text-terracotta border-terracotta/20",
  planning: "bg-warm-gold/10 text-warm-gold border-warm-gold/20",
  writing: "bg-muted-blue/10 text-muted-blue border-muted-blue/20",
  reviewing: "bg-dusty-purple/10 text-dusty-purple border-dusty-purple/20",
  complete: "bg-sage/10 text-sage border-sage/20",
};

const formatCompact = (n: number): string => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
};

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string | null; tier: string; words_used: number; word_limit: number } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const [{ data: assessmentData }, { data: profileData }] = await Promise.all([
        supabase.from("assessments").select("id, title, type, word_current, word_target, status, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("profiles").select("full_name, tier, words_used, word_limit").eq("user_id", user.id).single(),
      ]);
      setAssessments(assessmentData || []);
      setProfile(profileData as any);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDelete = async (e: React.MouseEvent, assessmentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this assessment? This cannot be undone.")) return;
    try {
      await supabase.from("sections").delete().eq("assessment_id", assessmentId);
      const { error } = await supabase.from("assessments").delete().eq("id", assessmentId);
      if (error) throw error;
      setAssessments(prev => prev.filter(a => a.id !== assessmentId));
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
  const wordsLeft = Math.max(0, wordLimit - wordsUsed);
  const wordUsagePercent = wordLimit > 0 ? Math.min(Math.round((wordsUsed / wordLimit) * 100), 100) : 0;
  const activeCount = assessments.filter(a => a.status !== "complete").length;
  const completedCount = assessments.filter(a => a.status === "complete").length;
  const totalWordsWritten = assessments.reduce((a, b) => a + b.word_current, 0);
  const avgCompletion = assessments.length > 0
    ? Math.round(assessments.reduce((sum, a) => sum + (a.word_target > 0 ? (a.word_current / a.word_target) * 100 : 0), 0) / assessments.length)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
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
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground">
            <FileText size={15} /> My Assessments
          </div>
          <Link to="/analytics" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <BarChart3 size={15} /> Analytics
          </Link>
        </nav>
        <div className="border-t border-border pt-4 space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground">
            <Settings size={15} /> Settings
          </div>
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

      {/* Main */}
      <div className="flex-1">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40 md:hidden">
          <div className="px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <span className="text-xl font-extrabold text-foreground tracking-tight">ZOE</span>
            </Link>
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
                  <Link to="/analytics" className="flex items-center gap-2">
                    <BarChart3 size={14} /> Analytics
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2">
                  <Settings size={14} /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive focus:text-destructive">
                  <LogOut size={14} /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8"
          >
            <div>
              <h1 className="text-2xl font-bold text-foreground">Welcome back, {userName}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {activeCount > 0
                  ? `You have ${activeCount} assessment${activeCount > 1 ? "s" : ""} in progress.`
                  : "Start a new assessment to get going."}
              </p>
            </div>
            <Link to="/assessment/new">
              <Button className="bg-terracotta hover:bg-terracotta-600 text-white font-semibold active:scale-[0.97] transition-transform">
                <Plus size={16} className="mr-1" /> New Assessment
              </Button>
            </Link>
          </motion.div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-8">
            {[
              { label: "Words Left", value: isUnlimited ? "∞" : formatCompact(wordsLeft), sub: isUnlimited ? "unlimited" : `of ${formatCompact(wordLimit)}`, color: "text-terracotta" },
              { label: "Assessments", value: assessments.length, sub: `${completedCount} done`, color: "text-muted-blue" },
              { label: "Written", value: formatCompact(totalWordsWritten), sub: "total", color: "text-sage" },
              { label: "Avg. Done", value: `${avgCompletion}%`, sub: "across all", color: "text-dusty-purple" },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className="h-[88px] sm:h-[100px] flex flex-col items-center justify-center p-2.5 sm:p-4 rounded-xl border border-border bg-card cursor-pointer hover:scale-[1.02] active:scale-[0.97] hover:shadow-md hover:border-foreground/10 transition-all duration-200"
              >
                <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{kpi.label}</p>
                <p className={`text-lg sm:text-2xl font-bold tabular-nums leading-tight ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[9px] sm:text-[11px] text-muted-foreground mt-0.5">{kpi.sub}</p>
              </motion.div>
            ))}
          </div>

          {/* Word budget bar */}
          {isUnlimited ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="p-2.5 sm:p-4 rounded-lg sm:rounded-xl border border-border bg-card mb-4 sm:mb-8 flex items-center justify-between"
            >
              <span className="text-[11px] sm:text-[13px] font-semibold">Word Budget</span>
              <span className="text-[10px] sm:text-[12px] text-muted-foreground capitalize">Unlimited · {profile?.tier} plan</span>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="p-2.5 sm:p-4 rounded-lg sm:rounded-xl border border-border bg-card mb-4 sm:mb-8"
            >
              <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                <span className="text-[11px] sm:text-[13px] font-semibold">Word Budget</span>
                <span className="font-mono text-[10px] sm:text-[12px] text-muted-foreground">{formatCompact(wordsUsed)} / {formatCompact(wordLimit)}</span>
              </div>
              <Progress value={wordUsagePercent} className="h-1.5 sm:h-2" />
              <div className="flex justify-between mt-1 sm:mt-1.5 text-[9px] sm:text-[11px] text-muted-foreground">
                <span>{wordUsagePercent}%</span>
                <span className="capitalize">{profile?.tier}</span>
              </div>
            </motion.div>
          )}

          {/* Recent Activity */}
          {assessments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="p-3 sm:p-4 rounded-lg sm:rounded-xl border border-border bg-card mb-4 sm:mb-8"
            >
              <h2 className="text-[11px] sm:text-[13px] font-semibold mb-2 sm:mb-3">Recent Activity</h2>
              <div className="space-y-0.5">
                {assessments.slice(0, 5).map((a) => {
                  const pct = a.word_target > 0 ? Math.round((a.word_current / a.word_target) * 100) : 0;
                  const done = a.status === "complete";
                  return (
                    <Link
                      key={a.id}
                      to={`/assessment/${a.id}`}
                      className="flex items-center gap-2 sm:gap-3 px-1.5 sm:px-2 py-1.5 sm:py-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${done ? "bg-sage" : "bg-terracotta"}`} />
                      <span className="text-xs sm:text-sm font-medium text-foreground truncate flex-1 min-w-0">{a.title}</span>
                      <span className="hidden sm:inline text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
                        {a.word_current.toLocaleString()}/{a.word_target.toLocaleString()}
                      </span>
                      <span className="text-[10px] sm:text-[11px] tabular-nums text-muted-foreground w-7 sm:w-8 text-right">{pct}%</span>
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground w-10 sm:w-12 text-right">{getTimeAgo(a.updated_at)}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}

          {assessments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-center py-20"
            >
              <FileText size={48} className="mx-auto text-muted-foreground/20 mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-1">No assessments yet</h2>
              <p className="text-sm text-muted-foreground mb-6">Create your first assessment to get started with ZOE.</p>
              <Link to="/assessment/new">
                <Button className="bg-terracotta hover:bg-terracotta-600 text-white font-semibold active:scale-[0.97] transition-transform">
                  <Plus size={16} className="mr-1" /> Create First Assessment
                </Button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assessments.map((assessment, i) => {
                const progress = assessment.word_target > 0 ? Math.round((assessment.word_current / assessment.word_target) * 100) : 0;
                const timeAgo = getTimeAgo(assessment.updated_at);
                return (
                  <motion.div
                    key={assessment.id}
                    initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      to={`/assessment/${assessment.id}`}
                      className="block p-5 rounded-xl border border-border bg-card hover:shadow-md hover:shadow-black/5 transition-all duration-200 group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusStyles[assessment.status] || statusStyles.draft}`}>
                          {assessment.status}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button onClick={(e) => e.preventDefault()} className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => handleDelete(e as any, assessment.id)} className="text-destructive focus:text-destructive">
                              <Trash2 size={14} className="mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <h3 className="font-semibold text-sm text-foreground leading-snug mb-1 line-clamp-2">{assessment.title}</h3>
                      <p className="text-xs text-muted-foreground">{assessment.type || "Assessment"}</p>
                      <div className="mt-4">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                          <span className="tabular-nums">{assessment.word_current.toLocaleString()} / {assessment.word_target.toLocaleString()} words</span>
                          <span className="tabular-nums">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={12} /> {timeAgo}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: assessments.length * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to="/assessment/new"
                  className="flex flex-col items-center justify-center h-full min-h-[200px] p-5 rounded-xl border-2 border-dashed border-border hover:border-terracotta/30 bg-card/50 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-terracotta/10 flex items-center justify-center mb-3 group-hover:bg-terracotta/20 transition-colors">
                    <Plus size={20} className="text-terracotta" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">New Assessment</p>
                </Link>
              </motion.div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default Dashboard;
