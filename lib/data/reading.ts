import type { SupabaseClient } from "@supabase/supabase-js";

export async function listReading(client: SupabaseClient, date: string) {
  return client.from("reading_lessons").select("id,student_id,record_date,duration_minutes,status,notes").eq("record_date", date);
}

export async function saveReading(client: SupabaseClient, studentId: string, date: string, completed: boolean) {
  return client.from("reading_lessons").upsert(
    {
      student_id: studentId,
      record_date: date,
      duration_minutes: completed ? 30 : 0,
      status: completed ? "completed" : "incomplete",
    },
    { onConflict: "student_id,record_date" },
  ).select("id,student_id,record_date,duration_minutes,status,notes").single();
}
