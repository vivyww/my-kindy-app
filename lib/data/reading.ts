import type { SupabaseClient } from "@supabase/supabase-js";

export async function listReading(client: SupabaseClient, organizationId: string, date: string) {
  return client.from("reading_lessons").select("id,organization_id,student_id,record_date,duration_minutes,status,notes").eq("organization_id", organizationId).eq("record_date", date);
}

export async function saveReading(client: SupabaseClient, organizationId: string, studentId: string, date: string, completed: boolean) {
  return client.from("reading_lessons").upsert(
    {
      organization_id: organizationId,
      student_id: studentId,
      record_date: date,
      duration_minutes: completed ? 30 : 0,
      status: completed ? "completed" : "incomplete",
    },
    { onConflict: "organization_id,student_id,record_date" },
  ).select("id,organization_id,student_id,record_date,duration_minutes,status,notes").single();
}
