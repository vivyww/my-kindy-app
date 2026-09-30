# Security

## Secret Handling
- Supabase service-role key: server-side only, never in client code
- Supabase anon key: safe for client (public, read-only intent)
- `.env` committed to `.gitignore`, never committed to repo

## Permission Model
- **v1 (demo-first):** permissive RLS — all reads/writes open, no login required. Seed data renders for anonymous visitors.
- **Lock-down sprint:** RLS enforces `auth.uid() = user_id` on every table. Teachers see only their own students. Anonymous access blocked.
- Agent inherits the calling user's permissions — no elevated access.

## Approved-Tools Rule
Agent calls named functions only: `summarize_daily_records`, `flag_at_risk_students`, `suggest_reading_level`. No raw SQL, no `run_any` / `send_any` patterns.

## Audit Principle
Every meaningful write (attendance mark, meal update, reading log, student CRUD) writes to `audit_logs` with action, entity type, entity ID, and details. Every agent action is logged the same way.

## Honesty Note
If per-user RLS or auth setup is beyond the builder's current skill, stop and get a human to verify the policies before exposing real student data. Do not mark security "done" until policies are tested with two different users.
