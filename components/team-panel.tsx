"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inviteWorkspaceMember, listWorkspaceMembers, removeWorkspaceMember } from "@/lib/data/workspaces";
import type { Workspace, WorkspaceMember } from "@/lib/data/types";

type Props = {
  client: SupabaseClient | null;
  workspace: Workspace | null;
  signedIn: boolean;
  userId: string | null;
  onSignIn: () => void;
};

export function TeamPanel({ client, workspace, signedIn, userId, onSignIn }: Props) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canManage = workspace?.role === "owner" || workspace?.role === "admin";

  useEffect(() => {
    let alive = true;
    async function loadMembers() {
      if (!client || !workspace || workspace.is_demo || !signedIn) {
        setMembers([]);
        return;
      }
      setLoading(true);
      const result = await listWorkspaceMembers(client, workspace.workspace_id);
      if (!alive) return;
      setLoading(false);
      if (result.error) setError(result.error.message);
      else setMembers(result.data ?? []);
    }
    void loadMembers();
    return () => { alive = false; };
  }, [client, workspace, signedIn]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !workspace) return;
    setBusy(true);
    setError("");
    setNotice("");
    const result = await inviteWorkspaceMember(client, workspace.workspace_id, email.trim());
    setBusy(false);
    if (result.error || !result.data) {
      setError(result.error?.message ?? "Couldn’t create this invitation.");
      return;
    }
    const link = new URL(window.location.href);
    link.searchParams.set("invite", result.data);
    setInviteUrl(link.toString());
    setNotice(`Invitation ready for ${email.trim()}. It expires in 7 days and can be used once.`);
    setEmail("");
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setNotice("Invite link copied. Send it to your teammate.");
  }

  async function removeMember(member: WorkspaceMember) {
    if (!client || !workspace || !window.confirm(`Remove ${member.email} from ${workspace.workspace_name}?`)) return;
    setError("");
    const result = await removeWorkspaceMember(client, workspace.workspace_id, member.user_id);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setMembers((current) => current.filter((item) => item.user_id !== member.user_id));
    setNotice(`${member.email} was removed from this workspace.`);
  }

  if (!signedIn || workspace?.is_demo) {
    return <div className="team-welcome">
      <div className="team-hero-art" aria-hidden="true"><span>✿</span><span>✦</span><span>☼</span></div>
      <p className="eyebrow">A CLASSROOM THAT WORKS TOGETHER</p>
      <h3>Bring your teaching team into one little place.</h3>
      <p>Keep children, daily care, and weekly progress together. Invite teachers to share one secure classroom workspace.</p>
      <div className="team-feature-grid">
        <div><span>01</span><strong>One shared roster</strong><small>Every teammate sees the same learners and class groups.</small></div>
        <div><span>02</span><strong>Updates as they happen</strong><small>Attendance, meals, and reading stay in sync across the team.</small></div>
        <div><span>03</span><strong>Private by classroom</strong><small>Each school workspace is isolated from every other team.</small></div>
      </div>
      <button className="primary-button" onClick={onSignIn}>{signedIn ? "Create a classroom workspace" : "Sign in or create a team"}<span>→</span></button>
    </div>;
  }

  return <div className="team-page">
    <div className="team-page-heading"><div><p className="eyebrow">YOUR CLASSROOM PEOPLE</p><h3>Good days happen together.</h3><p>Invite teachers to share this workspace and care for the same learners.</p></div><span className="team-count">{members.length} {members.length === 1 ? "teammate" : "teammates"}</span></div>
    {error && <div className="message-banner message-error" role="alert">{error}</div>}
    {notice && <div className="message-banner message-success" role="status">{notice}</div>}
    {canManage && <form className="invite-card" onSubmit={(event) => void invite(event)}>
      <div className="invite-icon">＋</div><div className="invite-copy"><strong>Invite a teammate</strong><small>We’ll make a private, one-time link for their school email.</small></div>
      <label className="invite-input"><span className="sr-only">Teammate email address</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teacher@school.com" /></label>
      <button className="primary-button" disabled={busy}>{busy ? "Making link…" : "Create invite"}</button>
      {inviteUrl && <div className="invite-link"><span>{inviteUrl}</span><button type="button" className="secondary-button" onClick={() => void copyInvite()}>Copy link</button></div>}
    </form>}
    <div className="team-members-card">
      <div className="team-members-head"><div><strong>Teaching team</strong><small>People with access to {workspace?.workspace_name}.</small></div><span className="secure-label"><i /> Private workspace</span></div>
      {loading ? <div className="loading-state"><span className="spinner" /> Gathering your team…</div> : members.map((member, index) => <article className="team-member-row" key={member.user_id}>
        <span className={`team-avatar team-avatar-${index % 4}`}>{member.email.slice(0, 1).toUpperCase()}</span><span className="team-member-copy"><strong>{member.email}</strong><small>Joined {new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(new Date(member.joined_at))}</small></span>
        <span className={`role-pill role-${member.role}`}>{member.role}</span>
        {canManage && member.role !== "owner" && member.user_id !== userId && (workspace?.role === "owner" || member.role === "teacher") && <button className="remove-member" onClick={() => void removeMember(member)}>Remove</button>}
      </article>)}
      {!loading && members.length === 0 && <div className="team-empty">No teammates yet. Create an invite to bring your classroom together.</div>}
    </div>
    <p className="team-footnote"><span>✦</span> Invites match the recipient’s email and expire after seven days.</p>
  </div>;
}
