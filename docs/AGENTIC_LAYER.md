# Agentic Layer

## Draftable Actions — Low Risk (auto)
- Generate daily summary text from stored records
- Flag at-risk students based on rule-based scoring
- Suggest reading level based on age + completion history

## Executable After Approval — Medium Risk (light approval)
- Update attendance status from a parsed free-text note
- Create a follow-up task for an at-risk student

## Human-Only — Critical (never automated)
- Delete any record (attendance, meal, reading, student)
- Modify historical records older than 7 days
- Send messages to parents

## Named Tools
| Tool | Risk | Input | Output |
|---|---|---|---|
| `summarize_daily_records` | low | date | summary text |
| `flag_at_risk_students` | low | date range | student list + reasons |
| `suggest_reading_level` | low | student_id | level + confidence |
| `update_attendance_from_note` | medium | note text | parsed status (requires approval) |

No raw SQL or arbitrary execution — named tools only.

## Audit Log Fields
Every agent action writes to `audit_logs`: action, entity_type, entity_id, details (jsonb), user_id, created_at.

## v1 vs Later
**v1:** None automated. Dashboard shows rule-based flags only.
**Later:** Auto-summarize, draft note parsing with approval, reading-level suggestions with teacher review.
