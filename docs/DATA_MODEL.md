# Data Model

## students
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | nullable — owner-scoping at lock-down |
| name | text | not null |
| age | int | not null, check 5–6 |
| group_name | text | not null, default 'K1-A' |
| notes | text | |
| reading_level_suggestion | text | AI-generated value |
| suggestion_source | text | AI source |
| suggestion_confidence | numeric | AI confidence 0–1 |
| suggestion_review_status | text | default 'unreviewed' |
| created_at | timestamptz | default now() |

## attendance
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | nullable |
| student_id | uuid | not null → students(id), on delete cascade |
| record_date | date | not null, default current_date |
| status | text | check in ('present','absent','late','excused') |
| notes | text | |
| created_at | timestamptz | default now() |

Unique: (student_id, record_date)

## meal_records
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | nullable |
| student_id | uuid | not null → students(id), cascade |
| record_date | date | not null |
| meal_type | text | check in ('breakfast','lunch') |
| status | text | check in ('completed','skipped','partial','pending') |
| notes | text | |
| created_at | timestamptz | default now() |

Unique: (student_id, record_date, meal_type)

## reading_lessons
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | nullable |
| student_id | uuid | not null → students(id), cascade |
| record_date | date | not null |
| duration_minutes | int | not null, default 30 |
| status | text | check in ('completed','incomplete') |
| notes | text | |
| created_at | timestamptz | default now() |

Unique: (student_id, record_date)

## audit_logs
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | nullable |
| action | text | not null |
| entity_type | text | |
| entity_id | uuid | |
| details | jsonb | |
| created_at | timestamptz | default now() |

## RLS / Permissions
All tables: RLS enabled. v1 uses permissive policies (read/write open — demo works without login). Lock-down sprint replaces with `auth.uid() = user_id` on every table.

## AI Fields
`students.reading_level_suggestion` stores value + `suggestion_source` + `suggestion_confidence` + `suggestion_review_status` (default 'unreviewed'). Teacher must review before acting on it.
