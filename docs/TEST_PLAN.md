# Test Plan

## v1 Success Scenario (manual)
1. Open app → Dashboard loads with seeded students (no login wall)
2. Go to Attendance → 5 students listed for today with seeded statuses
3. Change Lucas to Present, Noah to Present → badges update, persists on refresh
4. Go to Meals → mark breakfast completed for Emma, Aisha, Noah, Mia; skipped for Lucas
5. Mark lunch completed for all 5 (or skipped for Lucas)
6. Go to Reading → mark reading completed for Emma, Lucas, Aisha; incomplete for Mia
7. Go to Dashboard → today's grid shows attendance, meals, reading per student
8. Weekly summary shows attendance %, meal completion %, reading completion %
9. At-risk students highlighted (e.g., Mia — incomplete reading)

## Empty State Tests
- Delete all students → Students page: "No students yet. Add your first student."
- New date, no attendance marked → all students show "pending"
- No meal records for a date → Meals page: "No meals logged for this date."
- No reading records → Reading page: "No reading lessons logged for this date."
- Dashboard with no records → "No data yet. Start by marking attendance."

## Error State Tests
- Supabase unreachable → page shows "Couldn't load data. Check connection and retry." with retry button
- Submit student form with empty name → validation error, no save
- Submit student with age 7 → validation error (age must be 5 or 6)

## Loading State Tests
- Initial page load → skeleton rows / spinners before data appears
- After marking attendance → button shows brief spinner, then status badge
- Dashboard summary → loading spinner while aggregates compute

## Persistence Tests
- Mark attendance, refresh page → status persists
- Mark meal completion, refresh page → status persists
- Mark reading lesson, refresh page → status persists
- Delete a student → their attendance, meals, and reading records also removed (cascade)
