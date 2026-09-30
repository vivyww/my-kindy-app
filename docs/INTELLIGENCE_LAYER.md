# Intelligence Layer

## Messy Inputs
- Free-text attendance notes: "Emma sick, sent home at 10am"
- Quick meal notes: "only ate half"
- Reading notes: "struggled with letter sounds"

## Auto-Structure Example
```json
{
  "raw_note": "Emma sick, sent home at 10am",
  "parsed": {
    "status": "absent",
    "reason": "sick",
    "sent_home": true,
    "time": "10:00"
  }
}
```

## Events to Track
- attendance_marked
- meal_completed / meal_skipped / meal_partial
- reading_completed / reading_incomplete

## Scoring Rules (v1 — rule-based, no AI needed)
- **Attendance rate**: present_days / total_days × 100
- **Meal completion**: completed_meals / expected_meals × 100 (expected = 2 per present day)
- **Reading completion**: completed_lessons / total_days × 100
- **At-risk flag**: attendance < 80% OR meal completion < 70% OR reading < 70%

## What Gets Ranked
- Students ranked by overall completion rate (desc)
- At-risk students highlighted in red on dashboard

## v1 vs Later
**v1:** Rule-based scoring only, computed on the dashboard from stored records. No AI calls.
**Later:** AI-suggested reading levels by age + completion history, natural-language note parsing, weekly trend predictions, auto-generated parent summaries.
