# Team Workspace Mockups

The workspace and team screens are built as responsive parts of the app. The supplied Lollipop Sunshine reference guides the pink, mango, mint, and lilac palette; rounded cards; bright status pills; and one-thumb mobile controls. The mockups below capture the new flows before implementation details.

## Visual tokens

- Background: creamy lilac-white (`#fef7ff`); cards: white with warm pastel borders.
- Strawberry actions (`#ff3b7a` → `#ff75aa`), mango (`#ffae1a`), mint (`#28d1b2`), electric lilac (`#9d5cff`).
- Friendly, bold sans-serif type with deep plum text (`#342c44`).
- Cards use 18–25px corners; status and action controls use pill shapes.
- Phone controls target 48px tap height, 16px page gutters, and five primary bottom tabs.
- The reference’s photo gallery is left out because the PRD marks photo and video uploads as out of scope.

## Workspace onboarding

```text
┌──────────────────────────────────────────────────────────────┐
│ little day                                  today · sign in  │
│                                                              │
│               ✿  A CLASSROOM THAT WORKS TOGETHER              │
│          Bring your teaching team into one little place.      │
│     One roster, daily updates, and privacy for each team.      │
│                                                              │
│   [ One shared roster ] [ Updates as they happen ] [ Private ]│
│                                                              │
│                  [ Sign in or create a team → ]               │
└──────────────────────────────────────────────────────────────┘
```

## Team workspace

```text
┌───────────────┐  Good days happen together.     4 teammates  │
│ workspace ▾   │  Invite teachers to share this workspace.    │
│ Dashboard     │  ┌──────────────────────────────────────────┐ │
│ Students      │  │ +  Invite a teammate  teacher@school.com │ │
│ Attendance    │  │    [ Create invite ]                      │ │
│ Meals         │  └──────────────────────────────────────────┘ │
│ Reading       │  Teaching team           ● Private workspace │
│ Team          │  owner@email.com                Owner          │
│               │  teacher@email.com              Teacher        │
└───────────────┘
```

## Phone navigation and daily status

```text
┌─────────────────────────┐
│ ☰  Classroom / Today  T │
│ Every little detail...  │
│ [Today  ‹  Sep 30  ›]   │
│ [05 learners] [04 here] │
│ ┌─────────────────────┐ │
│ │ Emma Chen            │ │
│ │ Attendance  Present  │ │
│ │ Breakfast   Ate well │ │
│ │ Lunch       Pending  │ │
│ │ Reading     Done     │ │
│ └─────────────────────┘ │
│  Home  Kids  Here  ...   │
└─────────────────────────┘
```

Desktop keeps the persistent sidebar and dense classroom table. Phones use a six-item bottom dock, stacked status cards, large tap targets, and a workspace selector that remains available in the side drawer.
