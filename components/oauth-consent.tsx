"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AuthOAuthAuthorizationDetailsResponse, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type ConsentDetails = { authorization_id: string; redirect_uri: string; client: { name: string; uri: string; logo_uri: string }; user: { id: string; email: string }; scope: string };
type Props = { authorizationId: string };

export function OAuthConsent({ authorizationId }: Props) {
  const client = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadConsent(currentUser: User) {
    setUser(currentUser);
    if (!authorizationId) {
      setError("This authorization link is missing its request ID. Go back to ChatGPT and try connecting again.");
      return;
    }
    const { data, error: detailsError } = await client.auth.oauth.getAuthorizationDetails(authorizationId) as AuthOAuthAuthorizationDetailsResponse;
    if (detailsError) {
      setError("Little Day could not verify this authorization request. Return to ChatGPT and try connecting again.");
      return;
    }
    if ("redirect_url" in data) {
      window.location.assign(data.redirect_url);
      return;
    }
    setDetails(data);
    setError("");
  }

  useEffect(() => {
    let active = true;
    void client.auth.getUser().then(({ data }) => {
      if (active && data.user) void loadConsent(data.user);
      else if (active) setUser(null);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) void loadConsent(session.user);
      else setUser(null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client, authorizationId]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { data, error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (authError || !data.user) {
      setError(authError?.message ?? "Sign-in failed. Check your details and try again.");
      return;
    }
    setPassword("");
    await loadConsent(data.user);
  }

  async function decide(approve: boolean) {
    if (!authorizationId) return;
    setBusy(true);
    setError("");
    const response = approve
      ? await client.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await client.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    setBusy(false);
    if (response.error || !response.data?.redirect_url) {
      setError("Little Day could not complete this choice. Return to ChatGPT and try again.");
      return;
    }
    window.location.assign(response.data.redirect_url);
  }

  return (
    <main className="oauth-shell">
      <section className="oauth-card" aria-labelledby="oauth-title">
        <div className="oauth-brand"><span className="oauth-mark">l</span><span><strong>Little Day</strong><small>TEAM CLASSROOMS</small></span></div>
        <p className="eyebrow">SECURE CONNECTION</p>
        <h1 id="oauth-title">Connect your classroom</h1>
        {!user ? (
          <>
            <p className="oauth-copy">Sign in to Little Day to review this ChatGPT connection. Your account permissions and classroom access stay in effect.</p>
            <form className="student-form oauth-form" onSubmit={(event) => void signIn(event)}>
              <label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@school.com" /></label>
              <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your Little Day password" /></label>
              {error && <p className="inline-form-error" role="alert">{error}</p>}
              <button className="primary-button auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to Little Day"}</button>
            </form>
            <p className="oauth-footnote">Need an account? <a href="/">Create one in Little Day first</a>, then reconnect ChatGPT.</p>
          </>
        ) : details ? (
          <>
            <p className="oauth-copy"><strong>{details.client.name}</strong> is requesting access for <strong>{details.user.email}</strong>.</p>
            <div className="oauth-permissions">
              <h2>What ChatGPT can do</h2>
              <ul>
                <li>Read classroom names and roles, student names, ages, and groups.</li>
                <li>Read daily attendance, meal and reading records, weekly rates, and rule-based follow-up flags.</li>
                <li>Record attendance, meals, or reading when you explicitly ask, for today or the last seven days.</li>
              </ul>
              <p>Student notes and demo classrooms are excluded. Records cannot be deleted or changed here if they are more than seven days old. Your classroom access rules and audit log apply.</p>
              {details.scope && <small>Sign-in permissions requested: {details.scope}</small>}
            </div>
            {error && <p className="inline-form-error" role="alert">{error}</p>}
            <div className="oauth-actions">
              <button className="secondary-button" onClick={() => void decide(false)} disabled={busy}>Deny</button>
              <button className="primary-button" onClick={() => void decide(true)} disabled={busy}>{busy ? "Saving…" : "Allow ChatGPT"}</button>
            </div>
            <p className="oauth-footnote">You can revoke this connection in your Little Day account’s authorized apps.</p>
          </>
        ) : (
          <p className="oauth-copy" role="status">Checking this connection request…</p>
        )}
      </section>
    </main>
  );
}
