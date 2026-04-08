import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setError("Invalid or expired reset link. Please request a new one.");
      }
      setChecking(false);
    });
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (e: any) {
      setError(e.message || "Failed to reset password");
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card rounded-xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-bold text-foreground">Password Reset Successfully!</h1>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="bg-card rounded-xl shadow-lg p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
          <p className="text-muted-foreground">Enter your new password</p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">New Password</label>
            <input
              type="password"
              className="w-full mt-1 px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Min 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Confirm Password</label>
            <input
              type="password"
              className="w-full mt-1 px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Re-enter password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving || !password}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Resetting..." : "Reset Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
