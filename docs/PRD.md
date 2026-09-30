# My Kindy App — PRD

## Problem
Kindergarten teachers track student attendance, two daily meals (breakfast + lunch), and a 30-minute reading lesson for ages 5–6. Paper-based tracking is error-prone and hard to summarize for a week.

## Target User
Teacher and staff at a kindergarten managing one or two classes of 5–6 year-olds.

## Core Objects
- **Students** — name, age, group
- **Attendance** — date, status (present / absent / late / excused)
- **Meal records** — date, meal_type (breakfast / lunch), status (completed / skipped / partial / pending)
- **Reading lessons** — date, duration_minutes, status (completed / incomplete)

## MVP (v1) — Must-haves
- [ ] Student roster: add, edit, delete students
- [ ] Mark daily attendance per student
- [ ] Record breakfast and lunch completion per student per day
- [ ] Record 30-min reading lesson completion per student per day
- [ ] Daily dashboard: all students' status at a glance
- [ ] Weekly summary: attendance rate, meal completion rate, reading completion rate
- [ ] Highlight absent students and incomplete meals / reading
- [ ] App renders without a login wall (seeded demo data visible to anonymous visitors)

## Non-goals (v1)
- Parent portal or messaging
- Billing / payments
- Photo / video uploads
- Curriculum planning
- Multi-school or multi-tenant

## Success Criteria
A teacher opens the app on Monday, marks all 5 students' attendance, logs breakfast and lunch completion for each, marks the reading lesson done for those who completed it, then opens the weekly summary and sees attendance %, meal completion %, and reading completion % with absent students highlighted.
