import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealStatus, MealType } from "./types";

export async function listMeals(client: SupabaseClient, organizationId: string, date: string) {
  return client.from("meal_records").select("id,organization_id,student_id,record_date,meal_type,status,notes").eq("organization_id", organizationId).eq("record_date", date);
}

export async function saveMeal(client: SupabaseClient, organizationId: string, studentId: string, date: string, mealType: MealType, status: MealStatus) {
  return client.from("meal_records").upsert(
    { organization_id: organizationId, student_id: studentId, record_date: date, meal_type: mealType, status },
    { onConflict: "organization_id,student_id,record_date,meal_type" },
  ).select("id,organization_id,student_id,record_date,meal_type,status,notes").single();
}
