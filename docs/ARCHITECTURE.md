# Architecture

## Stack
Next.js (App Router) + Supabase (Postgres) + Vercel.

## Build Now vs Later
**Now:** student roster, attendance marking, meal logging, reading lesson logging, daily dashboard, weekly summary.
**Later:** auth/login, per-user data isolation, smart insights, parent notifications.

## Key Action Flow — Mark Attendance
1. Teacher opens Attendance page → loads today's date, all students as rows
2. For each student, taps Present / Absent / Late
3. Each tap upserts to `attendance` table (student_id + record_date unique)
4. Status badge updates immediately on screen
5. Unmarked students show as "pending"

## Responsive Nav Shell
Persistent left sidebar on desktop: Students, Attendance, Meals, Reading, Dashboard. Collapses to hamburger menu on mobile. Current section highlighted. Keyboard-accessible.

## Layer Plan
1. **Data layer** (`lib/data/`) — all DB reads/writes via Supabase client; no inline queries in UI
2. **App logic** — server actions for marking attendance, meals, reading
3. **Smart features** (`lib/ai/`) — completion-rate insights, at-risk flags (added later; core works without it)

## Why the Core Runs Without AI
Attendance, meals, and reading are direct DB writes and reads. AI only adds optional insight overlays. Switch AI off → app still fully functional.

## Repo Structure
```
lib/data/        students.ts  attendance.ts  meals.ts  reading.ts  summary.ts
lib/ai/          insights.ts  (later)
app/students/    page.tsx
app/attendance/  page.tsx
app/meals/       page.tsx
app/reading/     page.tsx
app/dashboard/   page.tsx
components/      [folders mirror app routes]
__tests__/       beside each module
```

## Module Map
| Module | Responsibility | Owns | Build Order |
|---|---|---|---|
| students | Student CRUD | students table | 1st |
| attendance | Daily attendance marking | attendance table | 2nd |
| meals | Meal completion logging | meal_records table | 3rd |
| reading | Reading lesson logging | reading_lessons table | 4th |
| dashboard | Daily + weekly summary | all tables (read-only) | 5th |
| auth (later) | Login, owner-scoped RLS | user_id enforcement | 6th |
