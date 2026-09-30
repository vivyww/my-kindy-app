import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceStatus, MealStatus, ReadingRecord, Student } from "./types";

type AttendanceRow = { student_id: string; status: AttendanceStatus };
type MealRow = { student_id: string; status: MealStatus };
type LessonRow = Pick<ReadingRecord, "student_id" | "status" | "duration_minutes">;

export type StudentWeek = {
  student: Student;
  attendanceRate: number | null;
  mealRate: number | null;
  readingRate: number | null;
  reasons: string[];
};

export type WeeklySummary = {
  attendanceRate: number | null;
  mealRate: number | null;
  readingRate: number | null;
  attendanceDays: number;
  presentDays: number;
  completedMeals: number;
  expectedMeals: number;
  completedLessons: number;
  expectedLessons: number;
  students: StudentWeek[];
  atRiskStudents: StudentWeek[];
};

export function weekRangeForDate(date: string) {
  const end = new Date(`${date}T12:00:00Z`);
  const day = (end.getUTCDay() + 6) % 7;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - day);
  return { start: start.toISOString().slice(0, 10), end: date };
}

export async function listWeekRecords(client: SupabaseClient, organizationId: string, start: string, end: string) {
  const range = (table: "attendance" | "meal_records" | "reading_lessons", columns: string) =>
    client.from(table).select(columns).eq("organization_id", organizationId).gte("record_date", start).lte("record_date", end);
  const [attendance, meals, reading] = await Promise.all([
    range("attendance", "student_id,status"),
    range("meal_records", "student_id,status"),
    range("reading_lessons", "student_id,status,duration_minutes"),
  ]);
  return { attendance, meals, reading };
}

function percentage(numerator: number, denominator: number): number | null {
  return denominator ? Math.round((numerator / denominator) * 100) : null;
}

export function summarizeWeek(
  students: Student[],
  attendanceRows: AttendanceRow[],
  mealRows: MealRow[],
  lessonRows: LessonRow[],
): WeeklySummary {
  const perStudent = students.map((student): StudentWeek => {
    const attendance = attendanceRows.filter((row) => row.student_id === student.id);
    const meals = mealRows.filter((row) => row.student_id === student.id);
    const lessons = lessonRows.filter((row) => row.student_id === student.id);
    const presentDays = attendance.filter((row) => row.status === "present" || row.status === "late").length;
    const completedMeals = meals.filter((row) => row.status === "completed").length;
    const completedLessons = lessons.filter((row) => row.status === "completed").length;
    const attendanceRate = percentage(presentDays, attendance.length);
    const mealRate = percentage(completedMeals, presentDays * 2);
    const readingRate = percentage(completedLessons, presentDays);
    const reasons: string[] = [];
    if (attendanceRate !== null && attendanceRate < 80) reasons.push("Attendance below 80%");
    if (mealRate !== null && mealRate < 70) reasons.push("Meals below 70%");
    if (readingRate !== null && readingRate < 70) reasons.push("Reading below 70%");
    return { student, attendanceRate, mealRate, readingRate, reasons };
  });

  const presentDays = attendanceRows.filter((row) => row.status === "present" || row.status === "late").length;
  const completedMeals = mealRows.filter((row) => row.status === "completed").length;
  const completedLessons = lessonRows.filter((row) => row.status === "completed").length;
  const attendanceDays = attendanceRows.length;
  const expectedMeals = presentDays * 2;
  return {
    attendanceRate: percentage(presentDays, attendanceDays),
    mealRate: percentage(completedMeals, expectedMeals),
    readingRate: percentage(completedLessons, presentDays),
    attendanceDays,
    presentDays,
    completedMeals,
    expectedMeals,
    completedLessons,
    expectedLessons: presentDays,
    students: perStudent,
    atRiskStudents: perStudent.filter((item) => item.reasons.length > 0),
  };
}
