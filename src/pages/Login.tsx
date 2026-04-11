import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function Login() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  useEffect(() => {
    if (!loading && user && role) {
      if (role === "agent") {
        navigate("/", { replace: true });
      } else {
        navigate("/old", { replace: true });
      }
    }
  }, [user, role, loading, navigate]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password");
      return;
    }
    setSigningIn(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) throw error;
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setSigningIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      setForgotMsg("Please enter your email");
      return;
    }
    setForgotSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotMsg("✅ Reset link sent! Check your email.");
    } catch (e: any) {
      setForgotMsg(e.message || "Failed to send reset link");
    } finally {
      setForgotSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user) return null; // redirect will happen via useEffect

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-card rounded-lg shadow-xl grid md:grid-cols-2 overflow-hidden animate-fade-in">
        <div className="bg-primary text-primary-foreground p-10 flex flex-col justify-center">
          <div className="text-4xl font-extrabold tracking-tight">HOMEJOY</div>
          <div className="text-xl mt-3 font-semibold opacity-90">Agent Portal</div>
          <p className="mt-4 opacity-70 leading-relaxed">
            Find available rooms, check unit details, copy move-in cost, submit booking, and manage your claims.
          </p>
        </div>
        <div className="p-10 flex flex-col justify-center gap-4">
          {!showForgot ? (
            <>
              <div className="text-2xl font-bold text-card-foreground">Welcome back</div>
              <p className="text-muted-foreground text-sm -mt-2">Sign in to access your dashboard</p>
              {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Email</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full px-3 py-2.5 pr-10 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleLogin}
                  disabled={signingIn}
                  className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {signingIn ? "Signing in..." : "Sign In"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotMsg(""); }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-2xl font-bold text-card-foreground">Reset Password</div>
              <p className="text-muted-foreground text-sm -mt-2">Enter your registered email address and we'll send you a password reset link.</p>
              <div>
                <label className="text-xs text-muted-foreground font-medium">Email Address</label>
                <input
                  type="email"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleForgotPassword()}
                />
              </div>
              {forgotMsg && (
                <div className={`text-sm rounded-lg px-3 py-2 ${forgotMsg.startsWith("✅") ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                  {forgotMsg}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowForgot(false)} className="flex-1 px-3 py-2.5 rounded-lg border text-foreground text-sm hover:bg-secondary transition-colors">Back to Login</button>
                <button onClick={handleForgotPassword} disabled={forgotSending} className="flex-1 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {forgotSending ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
