import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceStatus } from "./types";

export async function listAttendance(client: SupabaseClient, organizationId: string, date: string) {
  return client.from("attendance").select("id,organization_id,student_id,record_date,status,notes").eq("organization_id", organizationId).eq("record_date", date);
}

export async function saveAttendance(client: SupabaseClient, organizationId: string, studentId: string, date: string, status: AttendanceStatus) {
  return client.from("attendance").upsert(
    { organization_id: organizationId, student_id: studentId, record_date: date, status },
    { onConflict: "organization_id,student_id,record_date" },
  ).select("id,organization_id,student_id,record_date,status,notes").single();
}
