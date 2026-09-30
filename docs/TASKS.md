# Tasks

## Sprint 1 — Foundation + Student Roster + Attendance
**Goal:** DB seeded, students CRUD, daily attendance marking — viewable without login.
- [ ] Run migration SQL (tables, constraints, RLS, seed data)
- [ ] `lib/data/students.ts` — list, insert, update, delete
- [ ] `lib/data/attendance.ts` — upsert by (student_id, record_date)
- [ ] Students page — list, add, edit, delete (form + validation)
- [ ] Attendance page — today's roster, tap Present / Absent / Late
- [ ] Loading, empty, partial, error, ready states for both pages
- [ ] Responsive sidebar nav shell (desktop sidebar, mobile hamburger)

**DoD:** Teacher can add students and mark today's attendance; status persists after refresh.

## Sprint 2 — Meal & Reading Tracking
**Goal:** Log breakfast/lunch completion and 30-min reading lessons.
- [ ] `lib/data/meals.ts` — upsert by (student_id, record_date, meal_type)
- [ ] `lib/data/reading.ts` — upsert by (student_id, record_date)
- [ ] Meals page — per-student breakfast + lunch status toggle (completed / skipped / partial)
- [ ] Reading page — per-student 30-min lesson complete / incomplete toggle
- [ ] Loading, empty, partial, error, ready states on both pages

**DoD:** Teacher can mark meal and reading completion for any student; persists after refresh.

## Sprint 3 — Daily Dashboard & Weekly Summary ← v1 FUNCTIONAL MILESTONE
**Goal:** See all students' daily status + weekly completion rates.
- [ ] `lib/data/summary.ts` — aggregate queries (attendance %, meal %, reading %)
- [ ] Dashboard page — today's grid: attendance, meals, reading per student
- [ ] Weekly summary section — rates + at-risk student flags
- [ ] Loading, empty, partial, error, ready states

**DoD:** Success scenario works end-to-end: mark attendance → meals → reading → see weekly summary with rates and flags. This is the v1 functional milestone.

## Sprint 4 — Lock It Down
**Goal:** Auth + per-user data isolation.
- [ ] Add Supabase Auth (login / signup pages)
- [ ] Replace permissive RLS with `auth.uid() = user_id` policies on all tables
- [ ] Set `user_id` on every write (students, attendance, meals, reading)
- [ ] Audit log on every write
- [ ] Redirect unauthenticated users to login (app no longer public)

**DoD:** Logged-in teacher sees only their own students; anonymous access blocked.

## Gantt
```
S1: [####]  Foundation + Students + Attendance
S2:       [####]  Meals + Reading
S3:             [####]  Dashboard + Summary  ← v1 functional
S4:                   [####]  Lock Down (Auth + RLS)
```
