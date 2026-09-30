"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AttendanceStatus, MealStatus, MealType, ReadingRecord, Student } from "@/lib/data/types";
import { formatDate, localDateString } from "@/lib/data/types";
import { listAttendance, saveAttendance } from "@/lib/data/attendance";
import { listMeals, saveMeal } from "@/lib/data/meals";
import { listReading, saveReading } from "@/lib/data/reading";
import { listWeekRecords, summarizeWeek, weekRangeForDate, type WeeklySummary } from "@/lib/data/summary";
import { createStudent, deleteStudent, listStudents, updateStudent, type StudentInput } from "@/lib/data/students";
import { acceptWorkspaceInvite, createWorkspace, listWorkspaces } from "@/lib/data/workspaces";
import type { Workspace } from "@/lib/data/types";
import { createClient } from "@/lib/supabase/client";
import { AuthDialog } from "@/components/auth-dialog";
import { TeamPanel } from "@/components/team-panel";
import type { User } from "@supabase/supabase-js";

type Section = "dashboard" | "students" | "attendance" | "meals" | "reading" | "team";
const sections: { id: Section; label: string; icon: string; hint: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⌂", hint: "Your bright day" },
  { id: "students", label: "Students", icon: "♧", hint: "Class roster" },
  { id: "attendance", label: "Attendance", icon: "✓", hint: "Daily check-in" },
  { id: "meals", label: "Meals", icon: "⌁", hint: "Breakfast & lunch" },
  { id: "reading", label: "Reading", icon: "▤", hint: "Storytime" },
  { id: "team", label: "Team", icon: "♡", hint: "Your people" },
];
const mobileSections = sections.filter((item) => item.id !== "team");
const attendanceOptions: { value: AttendanceStatus; label: string; short: string }[] = [
  { value: "present", label: "Present", short: "P" },
  { value: "absent", label: "Absent", short: "A" },
  { value: "late", label: "Late", short: "L" },
  { value: "excused", label: "Excused", short: "E" },
];

const initialForm: StudentInput = { name: "", age: 5, group_name: "K1-A", notes: "" };
const mealOptions: { value: MealStatus; label: string; icon: string }[] = [
  { value: "completed", label: "Ate well", icon: "✓" },
  { value: "partial", label: "Some", icon: "½" },
  { value: "skipped", label: "Skipped", icon: "–" },
];

export function KindyApp() {
  const [section, setSection] = useState<Section>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [date, setDate] = useState(localDateString());
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [meals, setMeals] = useState<Record<string, Partial<Record<MealType, MealStatus>>>>({});
  const [reading, setReading] = useState<Record<string, ReadingRecord>>({});
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingStudent, setSavingStudent] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState<string | null>(null);
  const [savingRecord, setSavingRecord] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentInput>(initialForm);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const client = useMemo(() => configured ? createClient() : null, [configured]);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [workspaceFormOpen, setWorkspaceFormOpen] = useState(false);
  const [workspaceDraft, setWorkspaceDraft] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);

  useEffect(() => {
    if (!client) {
      setAuthLoading(false);
      setWorkspaceLoading(false);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const pendingInvite = params.get("invite");
    if (pendingInvite) {
      setInviteToken(pendingInvite);
      setAuthOpen(true);
    }
    void client.auth.getUser().then(({ data }) => {
      setAuthUser(data.user);
      setAuthLoading(false);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    let active = true;
    async function loadWorkspaces() {
      if (!client || authLoading) return;
      setWorkspaceLoading(true);
      let result = await listWorkspaces(client);
      if (!active) return;
      if (result.error) {
        setError(result.error.message);
        setWorkspace(null);
        setWorkspaces([]);
        setWorkspaceLoading(false);
        return;
      }
      let available = result.data ?? [];
      if (authUser?.email) {
        const rawPending = window.localStorage.getItem("little-day-pending-workspace");
        if (rawPending) {
          try {
            const pending = JSON.parse(rawPending) as { name?: string; email?: string };
            if (pending.email?.toLowerCase() === authUser.email.toLowerCase() && !available.some((item) => !item.is_demo)) {
              const created = await createWorkspace(client, pending.name ?? "My classroom");
              if (created.error) setError(created.error.message);
              else {
                window.localStorage.removeItem("little-day-pending-workspace");
                if (created.data) window.localStorage.setItem("little-day-workspace", created.data);
              }
              result = await listWorkspaces(client);
              if (!active) return;
              available = result.data ?? available;
            } else if (pending.email?.toLowerCase() !== authUser.email.toLowerCase()) {
              window.localStorage.removeItem("little-day-pending-workspace");
            }
          } catch {
            window.localStorage.removeItem("little-day-pending-workspace");
          }
        }
      }
      if (!active) return;
      const selectedId = window.localStorage.getItem("little-day-workspace");
      const selected = available.find((item) => item.workspace_id === selectedId)
        ?? (authUser ? available.find((item) => !item.is_demo) : null)
        ?? available.find((item) => item.is_demo)
        ?? null;
      setWorkspaces(available);
      setWorkspace(selected);
      if (selected) window.localStorage.setItem("little-day-workspace", selected.workspace_id);
      setWorkspaceLoading(false);
    }
    void loadWorkspaces();
    return () => { active = false; };
  }, [client, authLoading, authUser, workspaceRefreshKey]);

  useEffect(() => {
    if (!client || !inviteToken || !authUser || workspaceLoading) return;
    let active = true;
    void (async () => {
      const result = await acceptWorkspaceInvite(client, inviteToken);
      if (!active) return;
      if (result.error || !result.data) {
        setError(result.error?.message ?? "Couldn’t accept this invitation.");
        return;
      }
      const list = await listWorkspaces(client);
      if (!active) return;
      const joined = (list.data ?? []).find((item) => item.workspace_id === result.data);
      if (joined) {
        setWorkspaces(list.data ?? []);
        setWorkspace(joined);
        window.localStorage.setItem("little-day-workspace", joined.workspace_id);
        setNotice(`You joined ${joined.workspace_name}. Welcome to the team!`);
      }
      setInviteToken("");
      setAuthOpen(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.toString());
    })();
    return () => { active = false; };
  }, [client, inviteToken, authUser, workspaceLoading]);

  const load = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setError("");
      return;
    }
    if (workspaceLoading || !workspace) {
      setLoading(workspaceLoading);
      return;
    }
    setLoading(true);
    setError("");
    const { start: weekStart, end: weekEnd } = weekRangeForDate(date);
    const [studentResult, attendanceResult, mealResult, readingResult, weekResult] = await Promise.all([
      listStudents(client, workspace.workspace_id),
      listAttendance(client, workspace.workspace_id, date),
      listMeals(client, workspace.workspace_id, date),
      listReading(client, workspace.workspace_id, date),
      listWeekRecords(client, workspace.workspace_id, weekStart, weekEnd),
    ]);
    if (studentResult.error || attendanceResult.error || mealResult.error || readingResult.error || weekResult.attendance.error || weekResult.meals.error || weekResult.reading.error) {
      setError(studentResult.error?.message ?? attendanceResult.error?.message ?? mealResult.error?.message ?? readingResult.error?.message ?? weekResult.attendance.error?.message ?? weekResult.meals.error?.message ?? weekResult.reading.error?.message ?? "Couldn't load classroom data.");
      setLoading(false);
      return;
    }
    const listedStudents = (studentResult.data ?? []) as Student[];
    setStudents(listedStudents);
    setAttendance(Object.fromEntries((attendanceResult.data ?? []).map((record) => [record.student_id, record.status as AttendanceStatus])));
    const mealState: Record<string, Partial<Record<MealType, MealStatus>>> = {};
    for (const record of mealResult.data ?? []) {
      mealState[record.student_id] ??= {};
      mealState[record.student_id][record.meal_type as MealType] = record.status as MealStatus;
    }
    setMeals(mealState);
    setReading(Object.fromEntries((readingResult.data ?? []).map((record) => [record.student_id, record as ReadingRecord])));
    setWeekly(summarizeWeek(
      listedStudents,
      (weekResult.attendance.data ?? []) as unknown as Parameters<typeof summarizeWeek>[1],
      (weekResult.meals.data ?? []) as unknown as Parameters<typeof summarizeWeek>[2],
      (weekResult.reading.data ?? []) as unknown as Parameters<typeof summarizeWeek>[3],
    ));
    setLoading(false);
  }, [client, date, workspace, workspaceLoading]);

  useEffect(() => { void load(); }, [load]);

  function beginAdd() {
    if (!canWrite) return;
    setEditing(null);
    setForm(initialForm);
    setFormOpen(true);
    setNotice("");
  }

  function beginEdit(student: Student) {
    setEditing(student);
    setForm({ name: student.name, age: student.age, group_name: student.group_name, notes: student.notes ?? "" });
    setFormOpen(true);
    setNotice("");
  }

  async function submitStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError("Add the student’s name before saving.");
      return;
    }
    if (form.age !== 5 && form.age !== 6) {
      setError("Age must be 5 or 6.");
      return;
    }
    if (!client || !workspace || !canWrite) return;
    setSavingStudent(true);
    setError("");
    const normalized = { ...form, name, group_name: form.group_name.trim() || "K1-A", notes: form.notes?.trim() || null };
    const result = editing ? await updateStudent(client, workspace.workspace_id, editing.id, normalized) : await createStudent(client, workspace.workspace_id, normalized);
    setSavingStudent(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setFormOpen(false);
    setNotice(editing ? `${name}’s details were updated.` : `${name} was added to the class.`);
    await load();
  }

  async function removeStudent(student: Student) {
    if (!client || !workspace || !canWrite || !window.confirm(`Remove ${student.name} and their attendance, meals, and reading records?`)) return;
    setError("");
    const result = await deleteStudent(client, workspace.workspace_id, student.id);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setNotice(`${student.name} was removed from the class.`);
    await load();
  }

  async function markAttendance(student: Student, status: AttendanceStatus) {
    if (!client || !workspace || !canWrite) return;
    setSavingAttendance(student.id);
    setError("");
    const result = await saveAttendance(client, workspace.workspace_id, student.id, date, status);
    setSavingAttendance(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setAttendance((current) => ({ ...current, [student.id]: status }));
    setNotice(`${student.name}: ${status}.`);
    await load();
  }

  async function markMeal(student: Student, mealType: MealType, status: MealStatus) {
    if (!client || !workspace || !canWrite) return;
    const key = `${student.id}-${mealType}`;
    setSavingRecord(key);
    setError("");
    const result = await saveMeal(client, workspace.workspace_id, student.id, date, mealType, status);
    setSavingRecord(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setMeals((current) => ({ ...current, [student.id]: { ...current[student.id], [mealType]: status } }));
    setNotice(`${student.name}’s ${mealType} saved as ${status}.`);
    await load();
  }

  async function markReading(student: Student, completed: boolean) {
    if (!client || !workspace || !canWrite) return;
    setSavingRecord(student.id);
    setError("");
    const result = await saveReading(client, workspace.workspace_id, student.id, date, completed);
    setSavingRecord(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setReading((current) => ({ ...current, [student.id]: result.data as ReadingRecord }));
    setNotice(`${student.name}’s reading lesson saved.`);
    await load();
  }

  function moveDate(days: number) {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    setDate(localDateString(next));
  }

  const canWrite = Boolean(authUser && workspace && !workspace.is_demo);
  function selectWorkspace(nextId: string) {
    const selected = workspaces.find((item) => item.workspace_id === nextId);
    if (!selected) return;
    window.localStorage.setItem("little-day-workspace", selected.workspace_id);
    setWorkspace(selected);
    setSection("dashboard");
    setMenuOpen(false);
    setNotice(`Switched to ${selected.workspace_name}.`);
    setError("");
  }

  async function submitWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !authUser) {
      setAuthOpen(true);
      return;
    }
    setSavingWorkspace(true);
    setError("");
    const result = await createWorkspace(client, workspaceDraft.trim());
    setSavingWorkspace(false);
    if (result.error || !result.data) {
      setError(result.error?.message ?? "Couldn’t create this workspace.");
      return;
    }
    const updated = await listWorkspaces(client);
    if (updated.error) {
      setError(updated.error.message);
      return;
    }
    const nextWorkspaces = updated.data ?? [];
    setWorkspaces(nextWorkspaces);
    const created = nextWorkspaces.find((item) => item.workspace_id === result.data);
    if (created) {
      setWorkspace(created);
      window.localStorage.setItem("little-day-workspace", created.workspace_id);
      setSection("dashboard");
    }
    setWorkspaceDraft("");
    setWorkspaceFormOpen(false);
    setNotice("Your new classroom workspace is ready.");
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    window.localStorage.removeItem("little-day-workspace");
    setSection("dashboard");
    setNotice("You’re signed out. The demo classroom is ready to explore.");
  }

  function retryLoad() {
    if (!workspace) {
      setError("");
      setWorkspaceLoading(true);
      setWorkspaceRefreshKey((current) => current + 1);
      return;
    }
    void load();
  }

  const markedCount = students.filter((student) => attendance[student.id]).length;
  const presentCount = students.filter((student) => attendance[student.id] === "present" || attendance[student.id] === "late").length;
  const mealCount = Object.values(meals).reduce((count, studentMeals) => count + Object.keys(studentMeals).length, 0);
  const readingCount = Object.keys(reading).length;
  const sectionTitle = { dashboard: "Dashboard", students: "Students", attendance: "Attendance", meals: "Meals", reading: "Reading", team: "Team" }[section];
  const heading = { dashboard: "Every little detail, in one bright view.", students: "A little hello to every learner.", attendance: "Who’s here today?", meals: "A happy tummy makes a happy day.", reading: "Make a little room for storytime.", team: "A good day is a team effort." }[section];
  const subtitle = { dashboard: "A kind, clear look at today and the week so far.", students: "Keep your classroom crew and their little details in one happy place.", attendance: "Take attendance at a glance. Your changes save as you go.", meals: "Track breakfast and lunch for every little learner.", reading: "Log each child’s 30-minute reading lesson.", team: "Bring your teachers together around the little people in your care." }[section];

  return (
    <div className="app-frame">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setSection("dashboard"); setMenuOpen(false); }}>
          <span className="brand-mark" aria-hidden="true">🍭</span>
          <span><strong>little day</strong><small>kindergarten</small></span>
        </a>
        <div className="workspace-control">
          <label htmlFor="workspace-select">YOUR WORKSPACE</label>
          <div className="workspace-select-row"><span className="class-dot" /><select id="workspace-select" value={workspace?.workspace_id ?? ""} onChange={(event) => selectWorkspace(event.target.value)} disabled={workspaceLoading || workspaces.length === 0} aria-label="Switch classroom workspace">
            {workspaces.map((item) => <option key={item.workspace_id} value={item.workspace_id}>{item.workspace_name}{item.is_demo ? " · demo" : ""}</option>)}
          </select><button aria-label="Create classroom workspace" title="Create classroom workspace" onClick={() => { if (authUser) setWorkspaceFormOpen(true); else setAuthOpen(true); }}>＋</button></div>
          <small>{new Set(students.map((student) => student.group_name)).size} groups · {students.length} learners</small>
        </div>
        <p className="nav-label">CLASSROOM</p>
        <nav className="main-nav" aria-label="Classroom">
          {sections.map((item) => (
            <button key={item.id} className={`nav-item ${section === item.id ? "nav-item-active" : ""}`} onClick={() => { setSection(item.id); setMenuOpen(false); }} aria-current={section === item.id ? "page" : undefined}>
              <span className="nav-icon">{item.icon}</span><span className="nav-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><div className="teacher-avatar">{authUser?.email?.slice(0, 1).toUpperCase() ?? "T"}</div><div className="sidebar-user"><strong>{authUser?.email ?? "Demo classroom"}</strong><small>{workspace?.role ?? "Read-only preview"}</small></div>{authUser ? <button className="more-dots" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}>↗</button> : <button className="more-dots" aria-label="Sign in" title="Sign in" onClick={() => setAuthOpen(true)}>→</button>}</div>
      </aside>

      {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen((open) => !open)}>☰</button>
          <div className="breadcrumbs"><span>Classroom</span><span className="crumb-slash">/</span><strong>{sectionTitle}</strong></div>
          <div className="topbar-actions"><span className="today-chip"><span className="online-dot" />Today, {formatDate(localDateString(), { month: "short", day: "numeric" })}</span>{authUser ? <button className="avatar-button account-button" onClick={() => void signOut()} aria-label={`Sign out ${authUser.email ?? "account"}`} title="Sign out">{authUser.email?.slice(0, 1).toUpperCase() ?? "T"}</button> : <button className="top-signin" onClick={() => setAuthOpen(true)}>Sign in</button>}</div>
        </header>

        <div className="page-wrap">
          <div className="page-heading-row">
            <div>
              <p className="eyebrow">{workspace?.workspace_name.toUpperCase() ?? "YOUR CLASSROOM"} <span>·</span> {section === "dashboard" ? "DAILY OVERVIEW" : section === "students" ? "ROSTER" : section === "attendance" ? "DAILY CHECK-IN" : section.toUpperCase()}</p>
              <h1>{heading}</h1>
              <p className="page-subtitle">{subtitle}</p>
            </div>
            {section === "students" ? <button className="primary-button" onClick={beginAdd} disabled={!canWrite}><span>＋</span> Add student</button> : section === "team" ? null : <div className="date-picker"><button aria-label="Previous day" onClick={() => moveDate(-1)}>‹</button><span>{formatDate(date)}</span><button aria-label="Next day" onClick={() => moveDate(1)}>›</button><span className="date-calendar" aria-hidden="true">▦</span><input aria-label="Choose report date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>}
          </div>

          {section !== "team" && <div className="stats-row">
            <div className="stat-card"><span className="stat-icon stat-lavender">♧</span><span><small>Little learners</small><strong>{students.length.toString().padStart(2, "0")}</strong></span></div>
            <div className="stat-card"><span className="stat-icon stat-peach">☀</span><span><small>{section === "students" ? "Groups together" : section === "attendance" ? "Marked today" : section === "meals" ? "Meal choices" : section === "reading" ? "Lessons logged" : "Here today"}</small><strong>{section === "students" ? new Set(students.map((student) => student.group_name)).size.toString().padStart(2, "0") : section === "attendance" ? `${markedCount}/${students.length}` : section === "meals" ? `${mealCount}/${students.length * 2}` : section === "reading" ? `${readingCount}/${students.length}` : `${presentCount}/${students.length}`}</strong></span></div>
            <div className="stat-card"><span className="stat-icon stat-mint">✓</span><span><small>{section === "students" ? "Age 5 & 6" : section === "attendance" ? "Here at school" : section === "meals" ? "Little learners" : section === "reading" ? "Completed" : "Weekly attendance"}</small><strong>{section === "students" ? students.filter((student) => student.age === 5 || student.age === 6).length.toString().padStart(2, "0") : section === "attendance" ? presentCount.toString().padStart(2, "0") : section === "meals" ? new Set(Object.keys(meals)).size.toString().padStart(2, "0") : section === "reading" ? Object.values(reading).filter((lesson) => lesson.status === "completed").length.toString().padStart(2, "0") : weekly?.attendanceRate === null || weekly?.attendanceRate === undefined ? "—" : `${weekly.attendanceRate}%`}</strong></span></div>
          </div>}

          {!configured && <div className="message-banner message-info"><strong>Connect your classroom first.</strong><span>Pull the project’s Supabase values into <code>.env.local</code> to enable live records.</span></div>}
          {workspace?.is_demo && section !== "team" && <div className="message-banner message-demo"><span><strong>Demo classroom</strong> · You’re exploring sample records. Sign in to create a private team workspace.</span><button onClick={() => setAuthOpen(true)}>Sign in</button></div>}
          {error && <div className="message-banner message-error" role="alert"><span>{error}</span><button onClick={retryLoad}>Try again</button></div>}
          {notice && !error && <div className="message-banner message-success" role="status">{notice}</div>}

          <section className={`roster-panel ${section === "team" ? "team-roster-panel" : ""}`}>
            {section !== "team" && <div className="panel-header"><div><h2>{section === "dashboard" ? `Today in ${workspace?.workspace_name ?? "your classroom"}` : section === "students" ? "Your classroom crew" : section === "attendance" ? "Attendance check-in" : section === "meals" ? "Breakfast & lunch" : "Reading circle"}</h2><p>{section === "students" ? "A small class, full of big personalities." : formatDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p></div><span className="panel-count">{section === "students" ? `${students.length} learners` : section === "attendance" ? `${markedCount} of ${students.length} marked` : section === "meals" ? `${mealCount} of ${students.length * 2} meals logged` : section === "reading" ? `${readingCount} of ${students.length} lessons logged` : `${students.length} learners`}</span></div>}
            {section === "team" ? <TeamPanel client={client} workspace={workspace} signedIn={Boolean(authUser)} userId={authUser?.id ?? null} onSignIn={() => authUser ? setWorkspaceFormOpen(true) : setAuthOpen(true)} /> : loading ? <div className="loading-state"><span className="spinner" /> Gathering the class list…</div> : !workspace ? <div className="empty-state"><span className="empty-illustration">✿</span><h3>Classroom setup isn’t ready yet</h3><p>The workspace database migration must be applied before classroom records can load.</p><button className="secondary-button" onClick={retryLoad}>Try again</button></div> : students.length === 0 ? <div className="empty-state"><span className="empty-illustration">✿</span><h3>{configured ? "No learners just yet" : "Class data isn’t connected"}</h3><p>{configured ? "Add your first student and start your class roster." : "Connect the Supabase project to load and save your classroom records."}</p>{(section === "students" || section === "dashboard") && canWrite && <button className="primary-button" onClick={beginAdd}>＋ Add your first student</button>}</div> : section === "students" ? (
              <div className="student-list" role="list">
                {students.map((student, index) => <article className="student-row" role="listitem" key={student.id}>
                  <span className={`student-avatar student-avatar-${index % 5}`}>{student.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                  <span className="student-main"><strong>{student.name}</strong><small>{student.notes || "Ready for another bright day"}</small></span>
                  <span className="age-pill">Age {student.age}</span><span className="group-pill">{student.group_name}</span>
                  {canWrite && <span className="row-actions"><button aria-label={`Edit ${student.name}`} onClick={() => beginEdit(student)}>Edit</button><button className="delete-action" aria-label={`Delete ${student.name}`} onClick={() => void removeStudent(student)}>Remove</button></span>}
                </article>)}
              </div>
            ) : section === "attendance" ? (
              <div className="attendance-list" role="list">
                {students.map((student, index) => <article className="attendance-row" role="listitem" key={student.id}>
                  <span className={`student-avatar student-avatar-${index % 5}`}>{student.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                  <span className="student-main"><strong>{student.name}</strong><small>{student.group_name} · Age {student.age}</small></span>
                  <div className="attendance-actions" aria-label={`${student.name} attendance status`}>
                    {attendanceOptions.map((option) => <button key={option.value} className={`attendance-choice ${attendance[student.id] === option.value ? `attendance-${option.value}` : ""}`} aria-label={option.label} aria-pressed={attendance[student.id] === option.value} disabled={!canWrite || savingAttendance === student.id} onClick={() => void markAttendance(student, option.value)}><span>{option.short}</span><small>{option.label}</small></button>)}
                  </div>
                  <span className={`status-label ${attendance[student.id] ? `status-${attendance[student.id]}` : "status-pending"}`}>{savingAttendance === student.id ? "Saving…" : attendance[student.id] ?? "Pending"}</span>
                </article>)}
              </div>
            ) : section === "meals" ? (
              <div className="meal-list" role="list">
                {students.map((student, index) => <article className="meal-row" role="listitem" key={student.id}>
                  <span className={`student-avatar student-avatar-${index % 5}`}>{student.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                  <span className="student-main"><strong>{student.name}</strong><small>{student.group_name} · Age {student.age}</small></span>
                  {(["breakfast", "lunch"] as MealType[]).map((mealType) => <div className="meal-choice-group" key={mealType} aria-label={`${student.name} ${mealType}`}>
                    <small className="meal-label">{mealType}</small>
                    <div className="meal-options">{mealOptions.map((option) => <button key={option.value} className={`meal-choice ${meals[student.id]?.[mealType] === option.value ? `meal-${option.value}` : ""}`} aria-label={`${option.label} for ${mealType}`} aria-pressed={meals[student.id]?.[mealType] === option.value} disabled={!canWrite || savingRecord === `${student.id}-${mealType}`} onClick={() => void markMeal(student, mealType, option.value)}><span>{option.icon}</span><small>{option.label}</small></button>)}</div>
                  </div>)}
                </article>)}
              </div>
            ) : section === "reading" ? (
              <div className="reading-list" role="list">
                {students.map((student, index) => {
                  const lesson = reading[student.id];
                  return <article className="reading-row" role="listitem" key={student.id}>
                    <span className={`student-avatar student-avatar-${index % 5}`}>{student.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                    <span className="student-main"><strong>{student.name}</strong><small>{student.group_name} · Age {student.age}</small></span>
                    <span className="reading-duration">{lesson?.duration_minutes ?? 0} <small>min</small></span>
                    <div className="reading-actions">
                      <button className={`reading-button ${lesson?.status === "completed" ? "reading-complete" : ""}`} aria-pressed={lesson?.status === "completed"} disabled={!canWrite || savingRecord === student.id} onClick={() => void markReading(student, true)}><span>✓</span> Completed · 30 min</button>
                      <button className={`reading-button ${lesson?.status === "incomplete" ? "reading-incomplete" : ""}`} aria-pressed={lesson?.status === "incomplete"} disabled={!canWrite || savingRecord === student.id} onClick={() => void markReading(student, false)}><span>○</span> Incomplete</button>
                    </div>
                  </article>;
                })}
              </div>
            ) : (
              <div className="dashboard-grid" role="table" aria-label="Today’s classroom status">
                <div className="dashboard-head" role="row"><span role="columnheader">Learner</span><span role="columnheader">Attendance</span><span role="columnheader">Breakfast</span><span role="columnheader">Lunch</span><span role="columnheader">Reading</span></div>
                {students.map((student, index) => <div className="dashboard-row" role="row" key={student.id}>
                  <span className="dashboard-student" role="cell"><span className={`student-avatar student-avatar-${index % 5}`}>{student.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><strong>{student.name}</strong></span>
                  <span role="cell" data-label="Attendance"><span className={`dashboard-tag ${attendance[student.id] ? `dashboard-${attendance[student.id]}` : "dashboard-pending"}`}>{attendance[student.id] ?? "Pending"}</span></span>
                  <span role="cell" data-label="Breakfast"><span className={`dashboard-tag ${meals[student.id]?.breakfast ? `dashboard-${meals[student.id].breakfast}` : "dashboard-pending"}`}>{meals[student.id]?.breakfast ?? "Pending"}</span></span>
                  <span role="cell" data-label="Lunch"><span className={`dashboard-tag ${meals[student.id]?.lunch ? `dashboard-${meals[student.id].lunch}` : "dashboard-pending"}`}>{meals[student.id]?.lunch ?? "Pending"}</span></span>
                  <span role="cell" data-label="Reading"><span className={`dashboard-tag ${reading[student.id]?.status === "completed" ? "dashboard-present" : reading[student.id]?.status === "incomplete" ? "dashboard-partial" : "dashboard-pending"}`}>{reading[student.id]?.status === "completed" ? "Done · 30m" : reading[student.id]?.status === "incomplete" ? "Incomplete" : "Pending"}</span></span>
                </div>)}
                <div className="dashboard-shortcuts"><span>Ready to log today’s care?</span><button onClick={() => setSection("attendance")}>Take attendance <span>→</span></button><button onClick={() => setSection("meals")}>Log meals <span>→</span></button><button onClick={() => setSection("reading")}>Reading circle <span>→</span></button></div>
              </div>
            )}
            {section !== "team" && <div className="panel-footer"><span>{configured ? <><span className="online-dot" />{workspace?.is_demo ? "Sample data · read only" : "All changes save automatically"}</> : "Waiting for the live classroom connection"}</span><span>{section === "students" ? "A lovely little class" : section === "attendance" ? `${students.length - markedCount} still to check in` : section === "meals" ? `${students.length * 2 - mealCount} meals to log` : section === "reading" ? `${students.length - readingCount} lessons to log` : "A bright day ahead"}</span></div>}
          </section>

          {section === "dashboard" && <section className="weekly-section" aria-labelledby="weekly-title">
            <div className="weekly-heading"><div><p className="eyebrow">WEEK OF {formatDate(weekRangeForDate(date).start, { month: "short", day: "numeric" }).toUpperCase()} <span>TO</span> {formatDate(date, { month: "short", day: "numeric" }).toUpperCase()}</p><h3 id="weekly-title">Little wins this week</h3><p>Weekly completion so far, based on the days each child was here.</p></div><span className="weekly-sun">☼</span></div>
            <div className="weekly-metrics">
              <div className="weekly-metric"><span>Attendance</span><strong>{weekly?.attendanceRate === null || weekly?.attendanceRate === undefined ? "—" : `${weekly.attendanceRate}%`}</strong><small>{weekly?.presentDays ?? 0} of {weekly?.attendanceDays ?? 0} attendance marks</small><div className="metric-track"><i style={{ width: `${weekly?.attendanceRate ?? 0}%` }} /></div></div>
              <div className="weekly-metric"><span>Meals completed</span><strong>{weekly?.mealRate === null || weekly?.mealRate === undefined ? "—" : `${weekly.mealRate}%`}</strong><small>{weekly?.completedMeals ?? 0} of {weekly?.expectedMeals ?? 0} expected meals</small><div className="metric-track metric-track-peach"><i style={{ width: `${weekly?.mealRate ?? 0}%` }} /></div></div>
              <div className="weekly-metric"><span>Reading lessons</span><strong>{weekly?.readingRate === null || weekly?.readingRate === undefined ? "—" : `${weekly.readingRate}%`}</strong><small>{weekly?.completedLessons ?? 0} of {weekly?.expectedLessons ?? 0} expected lessons</small><div className="metric-track metric-track-green"><i style={{ width: `${weekly?.readingRate ?? 0}%` }} /></div></div>
            </div>
            <div className="at-risk-heading"><div><h4>Extra little check-ins</h4><p>Students below this week’s classroom goals</p></div><span>{weekly?.atRiskStudents.length ?? 0} to check in</span></div>
            {(weekly?.atRiskStudents.length ?? 0) > 0 ? <div className="at-risk-list">{weekly?.atRiskStudents.map((item, index) => <div className="at-risk-row" key={item.student.id}><span className={`student-avatar student-avatar-${index % 5}`}>{item.student.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><strong>{item.student.name}</strong><span>{item.reasons.join(" · ")}</span></div>)}</div> : <div className="all-on-track">{weekly?.attendanceDays ? "A lovely week so far — everyone is on track." : "Log this week’s attendance and little routines to see your summary."}</div>}
          </section>}

          <footer className="page-footer"><span>Made for the little moments that make a big day.</span><span className="footer-flower">✿</span></footer>
        </div>
      </main>

      <nav className="mobile-tabbar" aria-label="Primary navigation">
        {mobileSections.map((item) => <button key={item.id} className={section === item.id ? "mobile-tab-active" : ""} onClick={() => { setSection(item.id); setMenuOpen(false); }} aria-current={section === item.id ? "page" : undefined}>
          <span>{item.icon}</span><small>{item.label}</small>
        </button>)}
      </nav>

      {formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
        <section className="student-modal" role="dialog" aria-modal="true" aria-labelledby="student-form-title">
          <button className="modal-close" aria-label="Close form" onClick={() => setFormOpen(false)}>×</button>
          <p className="eyebrow">SUNSHINE CLASS</p><h2 id="student-form-title">{editing ? "A little update" : "Welcome a new learner"}</h2><p className="modal-subtitle">Just the details you need to keep their day in order.</p>
          <form onSubmit={(event) => void submitStudent(event)} className="student-form">
            <label>Student name<input autoFocus required maxLength={100} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Emma Chen" /></label>
            <div className="form-two-col"><label>Age<select value={form.age} onChange={(event) => setForm((current) => ({ ...current, age: Number(event.target.value) as 5 | 6 }))}><option value={5}>5 years old</option><option value={6}>6 years old</option></select></label><label>Class group<input required maxLength={40} value={form.group_name} onChange={(event) => setForm((current) => ({ ...current, group_name: event.target.value }))} placeholder="K1-A" /></label></div>
            <label>Little notes <span className="optional-label">Optional</span><textarea rows={3} maxLength={500} value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="A favourite story, a small reminder…" /></label>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button" disabled={savingStudent || !client || !canWrite}>{savingStudent ? "Saving…" : editing ? "Save changes" : "Add to class"}</button></div>
          </form>
        </section>
      </div>}

      {workspaceFormOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setWorkspaceFormOpen(false); }}>
        <section className="student-modal workspace-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-form-title">
          <button className="modal-close" aria-label="Close workspace form" onClick={() => setWorkspaceFormOpen(false)}>×</button>
          <span className="auth-mark">✿</span><p className="eyebrow">A NEW LITTLE PLACE</p><h2 id="workspace-form-title">Create a classroom</h2><p className="modal-subtitle">Give your team a shared, private space for the daily details.</p>
          <form onSubmit={(event) => void submitWorkspace(event)} className="student-form">
            <label>Classroom name<input autoFocus required minLength={2} maxLength={80} value={workspaceDraft} onChange={(event) => setWorkspaceDraft(event.target.value)} placeholder="e.g. Little Acorns Kindergarten" /></label>
            {error && <p className="inline-form-error" role="alert">{error}</p>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setWorkspaceFormOpen(false)}>Cancel</button><button className="primary-button" disabled={savingWorkspace || !authUser}>{savingWorkspace ? "Making space…" : "Create workspace"}</button></div>
          </form>
        </section>
      </div>}

      {client && <AuthDialog client={client} open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={() => setNotice("You’re signed in. Your team workspace is loading.")} />}
    </div>
  );
}
