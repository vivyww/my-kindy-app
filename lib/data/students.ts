import type { SupabaseClient } from "@supabase/supabase-js";
import type { Student } from "./types";

export type StudentInput = Pick<Student, "name" | "age" | "group_name" | "notes">;

export async function listStudents(client: SupabaseClient) {
  return client.from("students").select("id,name,age,group_name,notes,created_at").order("name");
}

export async function createStudent(client: SupabaseClient, input: StudentInput) {
  return client.from("students").insert(input).select("id,name,age,group_name,notes,created_at").single();
}

export async function updateStudent(client: SupabaseClient, id: string, input: StudentInput) {
  return client.from("students").update(input).eq("id", id).select("id,name,age,group_name,notes,created_at").single();
}

export async function deleteStudent(client: SupabaseClient, id: string) {
  return client.from("students").delete().eq("id", id);
}
