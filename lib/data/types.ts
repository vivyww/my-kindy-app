export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type Student = {
  id: string;
  organization_id: string;
  name: string;
  age: 5 | 6;
  group_name: string;
  notes: string | null;
  created_at: string;
};

export type Workspace = {
  workspace_id: string;
  workspace_name: string;
  is_demo: boolean;
  role: "owner" | "admin" | "teacher" | "demo";
};

export type WorkspaceMember = {
  user_id: string;
  email: string;
  role: "owner" | "admin" | "teacher";
  joined_at: string;
};

export type AttendanceRecord = {
  id: string;
  student_id: string;
  record_date: string;
  status: AttendanceStatus;
  notes: string | null;
};

export type MealStatus = "completed" | "skipped" | "partial" | "pending";
export type MealType = "breakfast" | "lunch";

export type MealRecord = {
  id: string;
  student_id: string;
  record_date: string;
  meal_type: MealType;
  status: MealStatus;
  notes: string | null;
};

export type ReadingRecord = {
  id: string;
  student_id: string;
  record_date: string;
  duration_minutes: number;
  status: "completed" | "incomplete";
  notes: string | null;
};

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en-MY", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
