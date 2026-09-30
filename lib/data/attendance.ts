import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceStatus } from "./types";

export async function listAttendance(client: SupabaseClient, date: string) {
  return client.from("attendance").select("id,student_id,record_date,status,notes").eq("record_date", date);
}

export async function saveAttendance(client: SupabaseClient, studentId: string, date: string, status: AttendanceStatus) {
  return client.from("attendance").upsert(
    { student_id: studentId, record_date: date, status },
    { onConflict: "student_id,record_date" },
  ).select("id,student_id,record_date,status,notes").single();
}
