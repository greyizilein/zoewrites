import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, BarChart3, TrendingUp, PieChart, Activity, BookOpen, Zap, Target, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, LineChart, Line, PieChart as RechartsPie, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(18, 50%, 53%)",
  planning: "hsl(40, 55%, 52%)",
  writing: "hsl(212, 38%, 43%)",
  reviewing: "hsl(280, 20%, 55%)",
  complete: "hsl(153, 16%, 42%)",
};

const TYPE_COLORS = [
  "hsl(18, 50%, 53%)", "hsl(212, 38%, 43%)", "hsl(153, 16%, 42%)",
  "hsl(40, 55%, 52%)", "hsl(280, 20%, 55%)", "hsl(200, 30%, 50%)",
];

type TimeRange = "7d" | "30d" | "90d" | "all";

const Analytics = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("30d");
  const [wordData, setWordData] = useState<any[]>([]);
  const [cumulativeData, setCumulativeData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [typeData, setTypeData] = useState<any[]>([]);
  const [velocityData, setVelocityData] = useState<any[]>([]);
  const [totals, setTotals] = useState({
    words: 0, assessments: 0, completed: 0, active: 0,
    avgTurnaround: 0, totalCitations: 0, completionRate: 0,
    wordsUsed: 0, wordLimit: 500, wordsLeft: 0,
  });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [{ data: assessments }, { data: sections }, { data: profileData }] = await Promise.all([
        supabase.from("assessments").select("id, word_current, word_target, status, type, created_at, updated_at, settings")
          .eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("sections").select("word_current, word_target, citation_count, status, framework, created_at, updated_at, assessment_id")
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("words_used, word_limit, tier").eq("user_id", user.id).single(),
      ]);

      if (!assessments) { setLoading(false); return; }

      const rangeDays = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 9999;
      const cutoff = new Date(Date.now() - rangeDays * 86400000);
      const filtered = assessments.filter(a => new Date(a.created_at) >= cutoff || range === "all");

      // Status distribution
      const statusMap: Record<string, number> = {};
      const typeMap: Record<string, number> = {};
      let totalWords = 0;
      let totalCitations = 0;
      let completedTurnarounds: number[] = [];

      filtered.forEach(a => {
        statusMap[a.status] = (statusMap[a.status] || 0) + 1;
        const t = a.type || "Other";
        typeMap[t] = (typeMap[t] || 0) + 1;
        totalWords += a.word_current;
        if (a.status === "complete") {
          const days = (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) / 86400000;
          completedTurnarounds.push(days);
        }
      });

      // Citations from sections
      const assessmentIds = new Set(filtered.map(a => a.id));
      (sections || []).forEach(s => {
        if (assessmentIds.has(s.assessment_id)) {
          totalCitations += s.citation_count || 0;
        }
      });

      setStatusData(Object.entries(statusMap).map(([name, value]) => ({ name, value })));
      setTypeData(Object.entries(typeMap).map(([name, value]) => ({ name, value })));

      const completedCount = filtered.filter(a => a.status === "complete").length;
      const activeCount = filtered.filter(a => a.status !== "complete").length;
      const avgTurnaround = completedTurnarounds.length > 0
        ? Math.round(completedTurnarounds.reduce((a, b) => a + b, 0) / completedTurnarounds.length * 10) / 10
        : 0;
      const wordsUsed = profileData?.words_used || 0;
      const wordLimit = profileData?.word_limit || 500;

      setTotals({
        words: totalWords,
        assessments: filtered.length,
        completed: completedCount,
        active: activeCount,
        avgTurnaround,
        totalCitations,
        completionRate: filtered.length > 0 ? Math.round((completedCount / filtered.length) * 100) : 0,
        wordsUsed,
        wordLimit,
        wordsLeft: Math.max(0, wordLimit - wordsUsed),
      });

      // Word usage by day
      const now = new Date();
      const startDate = new Date(now.getTime() - rangeDays * 86400000);
      const dailyWords: Record<string, number> = {};
      for (let i = 0; i < Math.min(rangeDays, 365); i++) {
        const d = new Date(startDate.getTime() + i * 86400000);
        dailyWords[d.toISOString().slice(0, 10)] = 0;
      }
      filtered.forEach(a => {
        const day = a.updated_at.slice(0, 10);
        if (dailyWords[day] !== undefined) dailyWords[day] += a.word_current;
      });
      setWordData(Object.entries(dailyWords).map(([date, words]) => ({
        date: date.slice(5),
        words,
      })));

      // Cumulative assessments
      let cumulative = 0;
      setCumulativeData(filtered.map(a => {
        cumulative++;
        return { date: a.created_at.slice(0, 10).slice(5), count: cumulative };
      }));

      // Writing velocity (words per day, rolling 7-day)
      const dayMap: Record<string, number> = {};
      (sections || []).filter(s => assessmentIds.has(s.assessment_id)).forEach(s => {
        const day = s.updated_at.slice(0, 10);
        dayMap[day] = (dayMap[day] || 0) + s.word_current;
      });
      const sortedDays = Object.keys(dayMap).sort();
      const velData: any[] = [];
      sortedDays.forEach((day, i) => {
        const window = sortedDays.slice(Math.max(0, i - 6), i + 1);
        const avg = Math.round(window.reduce((a, d) => a + (dayMap[d] || 0), 0) / window.length);
        velData.push({ date: day.slice(5), velocity: avg });
      });
      setVelocityData(velData.slice(-30));

      setLoading(false);
    };
    load();
  }, [user, range]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <h1 className="text-sm font-semibold text-foreground flex-1">Analytics</h1>
          <div className="flex gap-1">
            {(["7d", "30d", "90d", "all"] as TimeRange[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all active:scale-[0.97] ${
                  range === r ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {r === "all" ? "All" : r}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Word Budget */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="p-5 rounded-xl border border-border bg-card mb-6"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-[13px] font-semibold">Word Budget</span>
            <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
              {totals.wordsLeft.toLocaleString()} words remaining
            </span>
          </div>
          <Progress value={totals.wordLimit > 0 ? Math.round((totals.wordsUsed / totals.wordLimit) * 100) : 0} className="h-2.5 mb-1.5" />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{totals.wordsUsed.toLocaleString()} used</span>
            <span>{totals.wordLimit.toLocaleString()} limit</span>
          </div>
        </motion.div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total Words", value: totals.words.toLocaleString(), icon: BarChart3, color: "text-terracotta" },
            { label: "Assessments", value: totals.assessments, icon: FileCheck, color: "text-muted-blue" },
            { label: "Completed", value: totals.completed, icon: Target, color: "text-sage" },
            { label: "Active", value: totals.active, icon: Activity, color: "text-dusty-purple" },
            { label: "Completion Rate", value: `${totals.completionRate}%`, icon: TrendingUp, color: "text-terracotta" },
            { label: "Avg Turnaround", value: `${totals.avgTurnaround}d`, icon: Zap, color: "text-warm-gold" },
            { label: "Total Citations", value: totals.totalCitations.toLocaleString(), icon: BookOpen, color: "text-muted-blue" },
            { label: "Citation Density", value: totals.words > 0 ? `${(totals.totalCitations / (totals.words / 1000)).toFixed(1)}/1k` : "—", icon: PieChart, color: "text-sage" },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="p-4 rounded-xl border border-border bg-card"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <card.icon size={13} className={card.color} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">{card.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Word usage chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="p-5 rounded-xl border border-border bg-card"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4">Word Output</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={wordData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Bar dataKey="words" fill="hsl(18, 50%, 53%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Writing velocity */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="p-5 rounded-xl border border-border bg-card"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4">Writing Velocity (7-day avg)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={velocityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Area type="monotone" dataKey="velocity" stroke="hsl(212, 38%, 43%)" fill="hsl(212, 38%, 43%)" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Cumulative assessments */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="p-5 rounded-xl border border-border bg-card"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4">Assessments Over Time</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Line type="monotone" dataKey="count" stroke="hsl(153, 16%, 42%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Status distribution */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="p-5 rounded-xl border border-border bg-card"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4">Status Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RechartsPie>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={75} innerRadius={40} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={{ stroke: "hsl(var(--muted-foreground))" }}>
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "hsl(var(--muted-foreground))"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
              </RechartsPie>
            </ResponsiveContainer>
          </motion.div>

          {/* Type breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="p-5 rounded-xl border border-border bg-card md:col-span-2"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4">Assessment Types</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={120} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {typeData.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
