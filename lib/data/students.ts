import type { SupabaseClient } from "@supabase/supabase-js";
import type { Student } from "./types";

export type StudentInput = Pick<Student, "name" | "age" | "group_name" | "notes">;

const columns = "id,organization_id,name,age,group_name,notes,created_at";

export async function listStudents(client: SupabaseClient, organizationId: string) {
  return client.from("students").select(columns).eq("organization_id", organizationId).order("name");
}

export async function createStudent(client: SupabaseClient, organizationId: string, input: StudentInput) {
  return client.from("students").insert({ ...input, organization_id: organizationId }).select(columns).single();
}

export async function updateStudent(client: SupabaseClient, organizationId: string, id: string, input: StudentInput) {
  return client.from("students").update(input).eq("organization_id", organizationId).eq("id", id).select(columns).single();
}

export async function deleteStudent(client: SupabaseClient, organizationId: string, id: string) {
  return client.from("students").delete().eq("organization_id", organizationId).eq("id", id);
}
