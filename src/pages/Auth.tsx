import { useState } from "react";
import { Link, useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Mail, Lock, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const Auth = () => {
  const { session, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "" });

  if (!authLoading && session) {
    return <Navigate to="/zoe" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      return;
    }
    // Route paid tiers straight into the ZOE workspace; free users see the dashboard upgrade flow.
    let target = "/zoe";
    try {
      const uid = data.session?.user.id;
      if (uid) {
        const { data: prof } = await supabase.from("profiles").select("tier").eq("user_id", uid).single();
        if (!prof || prof.tier === "free") target = "/dashboard";
      }
    } catch { /* fall through to /zoe */ }
    navigate(target);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupForm.email,
      password: signupForm.password,
      options: {
        data: { full_name: signupForm.name },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We've sent you a confirmation link." });
    }
  };

  const handleGoogleLogin = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result?.error) {
      toast({ title: "OAuth failed", description: String(result.error), variant: "destructive" });
    } else if (!result?.redirected) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#1a1714" }}>
      <motion.div
        initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="text-xl font-extrabold text-white tracking-tight">ZOE</span>
          </Link>
          <p className="mt-3 text-sm text-white/30">Write any assessment. Perfectly.</p>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-6">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="w-full bg-white/5 border border-white/10">
              <TabsTrigger value="login" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40">
                Log in
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40">
                Sign up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/60 text-xs">Email</Label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <Input
                      type="email"
                      placeholder="you@university.edu"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-terracotta/50"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/60 text-xs">Password</Label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="pl-9 pr-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-terracotta/50"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-terracotta hover:bg-terracotta-600 text-white font-semibold active:scale-[0.97] transition-transform">
                  {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                  Log in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/60 text-xs">Full name</Label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <Input
                      type="text"
                      placeholder="Alex Rivera"
                      value={signupForm.name}
                      onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-terracotta/50"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/60 text-xs">Email</Label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <Input
                      type="email"
                      placeholder="you@university.edu"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-terracotta/50"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/60 text-xs">Password</Label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                      className="pl-9 pr-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-terracotta/50"
                      required
                      minLength={6}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-terracotta hover:bg-terracotta-600 text-white font-semibold active:scale-[0.97] transition-transform">
                  {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-5 pt-5 border-t border-white/10">
            <Button
              variant="outline"
              onClick={handleGoogleLogin}
              className="w-full border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/20">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
