"use client";

import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Props = {
  client: SupabaseClient;
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
};

export function AuthDialog({ client, open, onClose, onAuthenticated }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    if (mode === "signup") {
      const name = workspaceName.trim();
      if (name.length < 2) {
        setError("Give your classroom a name (at least 2 characters).");
        setBusy(false);
        return;
      }
      window.localStorage.setItem("little-day-pending-workspace", JSON.stringify({ name, email: email.trim().toLowerCase() }));
      const { data, error: authError } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        onAuthenticated();
        onClose();
      } else {
        setNotice("Check your inbox to confirm your email. Then sign in to open your classroom.");
      }
      return;
    }

    const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    onAuthenticated();
    onClose();
  }

  return (
    <div className="modal-backdrop auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" aria-label="Close sign in" onClick={onClose}>×</button>
        <span className="auth-mark">l</span>
        <p className="eyebrow">LITTLE DAY · TEAM CLASSROOMS</p>
        <h2 id="auth-title">{mode === "signin" ? "Welcome back." : "Start your classroom."}</h2>
        <p className="auth-subtitle">{mode === "signin" ? "Sign in to pick up your team’s day." : "Create your account and invite your teaching team."}</p>
        <form onSubmit={(event) => void submit(event)} className="student-form auth-form">
          {mode === "signup" && <label>Classroom name<input required minLength={2} maxLength={80} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="e.g. Little Acorns Kindergarten" /></label>}
          <label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@school.com" /></label>
          <label>Password<input type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></label>
          {error && <p className="inline-form-error" role="alert">{error}</p>}
          {notice && <p className="inline-form-notice" role="status">{notice}</p>}
          <button className="primary-button auth-submit" disabled={busy}>{busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <p className="auth-switch">{mode === "signin" ? "New to Little Day?" : "Already have an account?"}{" "}
          <button onClick={() => { setMode((current) => current === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </section>
    </div>
  );
}
