import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealStatus, MealType } from "./types";

export async function listMeals(client: SupabaseClient, date: string) {
  return client.from("meal_records").select("id,student_id,record_date,meal_type,status,notes").eq("record_date", date);
}

export async function saveMeal(client: SupabaseClient, studentId: string, date: string, mealType: MealType, status: MealStatus) {
  return client.from("meal_records").upsert(
    { student_id: studentId, record_date: date, meal_type: mealType, status },
    { onConflict: "student_id,record_date,meal_type" },
  ).select("id,student_id,record_date,meal_type,status,notes").single();
}
