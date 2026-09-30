"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AttendanceStatus, Student } from "@/lib/data/types";
import { formatDate, localDateString } from "@/lib/data/types";
import { listAttendance, saveAttendance } from "@/lib/data/attendance";
import { createStudent, deleteStudent, listStudents, updateStudent, type StudentInput } from "@/lib/data/students";
import { createClient } from "@/lib/supabase/client";

type Section = "students" | "attendance";
const sections: { id: Section; label: string; icon: string; hint: string }[] = [
  { id: "students", label: "Students", icon: "♧", hint: "Class roster" },
  { id: "attendance", label: "Attendance", icon: "✓", hint: "Daily check-in" },
];
const attendanceOptions: { value: AttendanceStatus; label: string; short: string }[] = [
  { value: "present", label: "Present", short: "P" },
  { value: "absent", label: "Absent", short: "A" },
  { value: "late", label: "Late", short: "L" },
  { value: "excused", label: "Excused", short: "E" },
];

const initialForm: StudentInput = { name: "", age: 5, group_name: "K1-A", notes: "" };

export function KindyApp() {
  const [section, setSection] = useState<Section>("students");
  const [menuOpen, setMenuOpen] = useState(false);
  const [date, setDate] = useState(localDateString());
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingStudent, setSavingStudent] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentInput>(initialForm);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const client = useMemo(() => configured ? createClient() : null, [configured]);

  const load = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    const [studentResult, attendanceResult] = await Promise.all([
      listStudents(client),
      listAttendance(client, date),
    ]);
    if (studentResult.error || attendanceResult.error) {
      setError(studentResult.error?.message ?? attendanceResult.error?.message ?? "Couldn't load classroom data.");
      setLoading(false);
      return;
    }
    setStudents((studentResult.data ?? []) as Student[]);
    setAttendance(Object.fromEntries((attendanceResult.data ?? []).map((record) => [record.student_id, record.status as AttendanceStatus])));
    setLoading(false);
  }, [client, date]);

  useEffect(() => { void load(); }, [load]);

  function beginAdd() {
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
    if (!client) return;
    setSavingStudent(true);
    setError("");
    const normalized = { ...form, name, group_name: form.group_name.trim() || "K1-A", notes: form.notes?.trim() || null };
    const result = editing ? await updateStudent(client, editing.id, normalized) : await createStudent(client, normalized);
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
    if (!client || !window.confirm(`Remove ${student.name} and their attendance, meals, and reading records?`)) return;
    setError("");
    const result = await deleteStudent(client, student.id);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setNotice(`${student.name} was removed from the class.`);
    await load();
  }

  async function markAttendance(student: Student, status: AttendanceStatus) {
    if (!client) return;
    setSavingAttendance(student.id);
    setError("");
    const result = await saveAttendance(client, student.id, date, status);
    setSavingAttendance(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setAttendance((current) => ({ ...current, [student.id]: status }));
    setNotice(`${student.name}: ${status}.`);
  }

  function moveDate(days: number) {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    setDate(localDateString(next));
  }

  const markedCount = students.filter((student) => attendance[student.id]).length;
  const presentCount = students.filter((student) => attendance[student.id] === "present" || attendance[student.id] === "late").length;

  return (
    <div className="app-frame">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setSection("students"); setMenuOpen(false); }}>
          <span className="brand-mark">m</span>
          <span><strong>little day</strong><small>kindergarten</small></span>
        </a>
        <div className="class-card"><span className="class-dot" /><span><strong>Sunshine class</strong><small>K1-A · 5 students</small></span><span className="class-chevron">⌄</span></div>
        <p className="nav-label">CLASSROOM</p>
        <nav className="main-nav" aria-label="Classroom">
          {sections.map((item) => (
            <button key={item.id} className={`nav-item ${section === item.id ? "nav-item-active" : ""}`} onClick={() => { setSection(item.id); setMenuOpen(false); }} aria-current={section === item.id ? "page" : undefined}>
              <span className="nav-icon">{item.icon}</span><span className="nav-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><div className="teacher-avatar">T</div><div><strong>Teacher view</strong><small>Classroom workspace</small></div><span className="more-dots">···</span></div>
      </aside>

      {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen((open) => !open)}>☰</button>
          <div className="breadcrumbs"><span>Classroom</span><span className="crumb-slash">/</span><strong>{section === "students" ? "Students" : "Attendance"}</strong></div>
          <div className="topbar-actions"><span className="today-chip"><span className="online-dot" />Today, {formatDate(localDateString(), { month: "short", day: "numeric" })}</span><button className="avatar-button" aria-label="Teacher profile">T</button></div>
        </header>

        <div className="page-wrap">
          <div className="page-heading-row">
            <div>
              <p className="eyebrow">SUNSHINE CLASS <span>·</span> {section === "students" ? "ROSTER" : "DAILY CHECK-IN"}</p>
              <h1>{section === "students" ? "A little hello to every learner." : "Who’s here today?"}</h1>
              <p className="page-subtitle">{section === "students" ? "Keep your classroom crew and their little details in one happy place." : "Take attendance at a glance. Your changes save as you go."}</p>
            </div>
            {section === "students" ? <button className="primary-button" onClick={beginAdd}><span>＋</span> Add student</button> : <div className="date-picker"><button aria-label="Previous day" onClick={() => moveDate(-1)}>‹</button><span>{formatDate(date)}</span><button aria-label="Next day" onClick={() => moveDate(1)}>›</button><input aria-label="Attendance date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>}
          </div>

          <div className="stats-row">
            <div className="stat-card"><span className="stat-icon stat-lavender">♧</span><span><small>Little learners</small><strong>{students.length.toString().padStart(2, "0")}</strong></span></div>
            <div className="stat-card"><span className="stat-icon stat-peach">☀</span><span><small>{section === "students" ? "Groups together" : "Marked today"}</small><strong>{section === "students" ? new Set(students.map((student) => student.group_name)).size.toString().padStart(2, "0") : `${markedCount}/${students.length}`}</strong></span></div>
            <div className="stat-card"><span className="stat-icon stat-mint">✓</span><span><small>{section === "students" ? "Age 5 & 6" : "Here at school"}</small><strong>{section === "students" ? students.filter((student) => student.age === 5 || student.age === 6).length.toString().padStart(2, "0") : presentCount.toString().padStart(2, "0")}</strong></span></div>
          </div>

          {!configured && <div className="message-banner message-info"><strong>Connect your classroom first.</strong><span>Pull the project’s Supabase values into <code>.env.local</code> to enable live records.</span></div>}
          {error && <div className="message-banner message-error" role="alert"><span>{error}</span><button onClick={() => void load()}>Try again</button></div>}
          {notice && !error && <div className="message-banner message-success" role="status">{notice}</div>}

          <section className="roster-panel">
            <div className="panel-header"><div><h2>{section === "students" ? "Your classroom crew" : "Attendance check-in"}</h2><p>{section === "students" ? "A small class, full of big personalities." : formatDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p></div><span className="panel-count">{section === "students" ? `${students.length} learners` : `${markedCount} of ${students.length} marked`}</span></div>
            {loading ? <div className="loading-state"><span className="spinner" /> Gathering the class list…</div> : students.length === 0 ? <div className="empty-state"><span className="empty-illustration">✿</span><h3>No learners just yet</h3><p>Add your first student and start your class roster.</p>{section === "students" && configured && <button className="primary-button" onClick={beginAdd}>＋ Add your first student</button>}</div> : section === "students" ? (
              <div className="student-list" role="list">
                {students.map((student, index) => <article className="student-row" role="listitem" key={student.id}>
                  <span className={`student-avatar student-avatar-${index % 5}`}>{student.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                  <span className="student-main"><strong>{student.name}</strong><small>{student.notes || "Ready for another bright day"}</small></span>
                  <span className="age-pill">Age {student.age}</span><span className="group-pill">{student.group_name}</span>
                  <span className="row-actions"><button aria-label={`Edit ${student.name}`} onClick={() => beginEdit(student)}>Edit</button><button className="delete-action" aria-label={`Delete ${student.name}`} onClick={() => void removeStudent(student)}>Remove</button></span>
                </article>)}
              </div>
            ) : (
              <div className="attendance-list" role="list">
                {students.map((student, index) => <article className="attendance-row" role="listitem" key={student.id}>
                  <span className={`student-avatar student-avatar-${index % 5}`}>{student.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                  <span className="student-main"><strong>{student.name}</strong><small>{student.group_name} · Age {student.age}</small></span>
                  <div className="attendance-actions" aria-label={`${student.name} attendance status`}>
                    {attendanceOptions.map((option) => <button key={option.value} className={`attendance-choice ${attendance[student.id] === option.value ? `attendance-${option.value}` : ""}`} aria-label={option.label} aria-pressed={attendance[student.id] === option.value} disabled={!client || savingAttendance === student.id} onClick={() => void markAttendance(student, option.value)}><span>{option.short}</span><small>{option.label}</small></button>)}
                  </div>
                  <span className={`status-label ${attendance[student.id] ? `status-${attendance[student.id]}` : "status-pending"}`}>{savingAttendance === student.id ? "Saving…" : attendance[student.id] ?? "Pending"}</span>
                </article>)}
              </div>
            )}
            <div className="panel-footer"><span><span className="online-dot" />All changes save automatically</span><span>{section === "students" ? "A lovely little class" : `${students.length - markedCount} still to check in`}</span></div>
          </section>

          <footer className="page-footer"><span>Made for the little moments that make a big day.</span><span className="footer-flower">✿</span></footer>
        </div>
      </main>

      {formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
        <section className="student-modal" role="dialog" aria-modal="true" aria-labelledby="student-form-title">
          <button className="modal-close" aria-label="Close form" onClick={() => setFormOpen(false)}>×</button>
          <p className="eyebrow">SUNSHINE CLASS</p><h2 id="student-form-title">{editing ? "A little update" : "Welcome a new learner"}</h2><p className="modal-subtitle">Just the details you need to keep their day in order.</p>
          <form onSubmit={(event) => void submitStudent(event)} className="student-form">
            <label>Student name<input autoFocus required maxLength={100} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Emma Chen" /></label>
            <div className="form-two-col"><label>Age<select value={form.age} onChange={(event) => setForm((current) => ({ ...current, age: Number(event.target.value) as 5 | 6 }))}><option value={5}>5 years old</option><option value={6}>6 years old</option></select></label><label>Class group<input required maxLength={40} value={form.group_name} onChange={(event) => setForm((current) => ({ ...current, group_name: event.target.value }))} placeholder="K1-A" /></label></div>
            <label>Little notes <span className="optional-label">Optional</span><textarea rows={3} maxLength={500} value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="A favourite story, a small reminder…" /></label>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button" disabled={savingStudent || !client}>{savingStudent ? "Saving…" : editing ? "Save changes" : "Add to class"}</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}
