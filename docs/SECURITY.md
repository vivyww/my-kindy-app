# Security

## Secret Handling
- Supabase service-role keys stay server-side and are never used by the MCP endpoint.
- The Supabase anon key is public; the MCP server uses it with the caller's verified OAuth access token.
- `.env` files remain ignored and are never committed.

## Permission Model
- The demo workspace remains readable without login; it is not writable.
- Private workspace data is readable and writable only to authenticated workspace members through the organization membership policies in `0002_team_workspaces.sql`.
- MCP requests require a Supabase OAuth access token. The server validates the token with Supabase Auth and forwards that same token to PostgREST; it never uses a service-role key.
- MCP tools list private workspaces only, omit student notes, and depend on the same workspace RLS as the app.
- MCP writes are limited to attendance, meals, and reading records for today or the preceding seven days. Database triggers append changes to `audit_logs`; there are no delete tools.

## Approved-Tools Rule
Agent calls named functions only: `list_workspaces`, `list_students`, `summarize_daily_records`, `flag_at_risk_students`, `mark_attendance`, `record_meal`, and `record_reading`. No raw SQL, no `run_any` / `send_any` patterns.

## Audit Principle
Every meaningful write (attendance mark, meal update, reading log, student CRUD) writes to `audit_logs` with action, entity type, entity ID, details, user ID, and timestamp through database triggers or approved RPCs.

## OAuth Setup
Supabase OAuth Server and dynamic client registration must be enabled in the Supabase dashboard, with `/oauth/consent` set as the authorization path. MCP tools inherit the calling user's workspace membership and row-level security. Never mark the ChatGPT connection ready until the OAuth flow succeeds and the endpoint returns only the signed-in user's private workspaces.

## Verification Note
Before broad rollout with real student data, verify cross-workspace isolation with two accounts and confirm the OAuth app can be revoked from the user's Supabase authorizations.
