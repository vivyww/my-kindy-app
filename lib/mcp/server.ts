import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ListToolsRequestSchema, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { weekRangeForDate } from "@/lib/data/summary";

type WorkspaceRow = {
  workspace_id: string;
  workspace_name: string;
  is_demo: boolean;
  role: string;
};

type McpContext = {
  supabase: SupabaseClient;
  user: User;
};

type StudentRow = {
  id: string;
  name: string;
  age: number;
  group_name: string;
};

type AttendanceRow = { student_id: string; status: "present" | "absent" | "late" | "excused" };
type MealRow = { student_id: string; meal_type: "breakfast" | "lunch"; status: "completed" | "skipped" | "partial" | "pending" };
type ReadingRow = { student_id: string; status: "completed" | "incomplete"; duration_minutes: number };

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.").optional();
const workspaceIdInput = z.string().uuid("Choose a valid workspace.").optional();
const attendanceStatus = z.enum(["present", "absent", "late", "excused"]);
const mealStatus = z.enum(["completed", "skipped", "partial", "pending"]);
const oauthSecuritySchemes = [{ type: "oauth2" as const, scopes: ["email"] }];

type ChatGptTool = Tool & { securitySchemes: typeof oauthSecuritySchemes };

const chatGptToolDefinitions = [
  { name: "get_account_profile", title: "Connected Little Day account", description: "Identify the signed-in Little Day account connected to this ChatGPT workspace.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { title: "Connected Little Day account", readOnlyHint: true, openWorldHint: false }, _meta: { securitySchemes: oauthSecuritySchemes, "openai/profile": true } },
  { name: "list_workspaces", title: "List my classrooms", description: "List private Little Day classrooms that the signed-in user belongs to. Demo sample data is excluded.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { title: "List my classrooms", readOnlyHint: true, openWorldHint: false }, _meta: { securitySchemes: oauthSecuritySchemes } },
  { name: "list_students", title: "List classroom students", description: "List student names, ages, and groups in one of the user's private workspaces. Private notes are never returned.", inputSchema: { type: "object", properties: { workspace_id: { type: "string", format: "uuid" } }, additionalProperties: false }, annotations: { title: "List classroom students", readOnlyHint: true, openWorldHint: false }, _meta: { securitySchemes: oauthSecuritySchemes } },
  { name: "summarize_daily_records", title: "Summarize daily classroom records", description: "Show each student's attendance, breakfast, lunch, and reading status for a date, plus the app's week-to-date completion rates and at-risk flags. Defaults to today in Malaysia. Uses only private workspaces available to the connected account.", inputSchema: { type: "object", properties: { workspace_id: { type: "string", format: "uuid" }, date: { type: "string", format: "date" } }, additionalProperties: false }, annotations: { title: "Summarize daily classroom records", readOnlyHint: true, openWorldHint: false }, _meta: { securitySchemes: oauthSecuritySchemes } },
  { name: "flag_at_risk_students", title: "Find students needing follow-up", description: "Return students whose attendance is below 80%, meal completion below 70%, or reading completion below 70% for the current app week through the selected date. This is a rule-based flag, not a diagnosis.", inputSchema: { type: "object", properties: { workspace_id: { type: "string", format: "uuid" }, date: { type: "string", format: "date" } }, additionalProperties: false }, annotations: { title: "Find students needing follow-up", readOnlyHint: true, openWorldHint: false }, _meta: { securitySchemes: oauthSecuritySchemes } },
  { name: "mark_attendance", title: "Mark student attendance", description: "Create or update one student's attendance for today or a date within the last seven days. Only use after the teacher explicitly asks to mark that student and status. Each change is audited.", inputSchema: { type: "object", properties: { workspace_id: { type: "string", format: "uuid" }, student_id: { type: "string", format: "uuid" }, date: { type: "string", format: "date" }, status: { type: "string", enum: ["present", "absent", "late", "excused"] } }, required: ["student_id", "status"], additionalProperties: false }, annotations: { title: "Mark student attendance", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }, _meta: { securitySchemes: oauthSecuritySchemes } },
  { name: "record_meal", title: "Record a student's meal", description: "Create or update one student's breakfast or lunch status for today or a date within the last seven days. Only use after the teacher clearly requests the exact student, meal, and status. Each change is audited.", inputSchema: { type: "object", properties: { workspace_id: { type: "string", format: "uuid" }, student_id: { type: "string", format: "uuid" }, date: { type: "string", format: "date" }, meal_type: { type: "string", enum: ["breakfast", "lunch"] }, status: { type: "string", enum: ["completed", "skipped", "partial", "pending"] } }, required: ["student_id", "meal_type", "status"], additionalProperties: false }, annotations: { title: "Record a student's meal", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }, _meta: { securitySchemes: oauthSecuritySchemes } },
  { name: "record_reading", title: "Record a reading lesson", description: "Create or update one student's 30-minute reading lesson for today or a date within the last seven days. Only use after the teacher clearly asks to record completed or incomplete. Each change is audited.", inputSchema: { type: "object", properties: { workspace_id: { type: "string", format: "uuid" }, student_id: { type: "string", format: "uuid" }, date: { type: "string", format: "date" }, completed: { type: "boolean" } }, required: ["student_id", "completed"], additionalProperties: false }, annotations: { title: "Record a reading lesson", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }, _meta: { securitySchemes: oauthSecuritySchemes } },
] as unknown as ChatGptTool[];

function dateInMalaysia() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isValidDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function assertWritableDate(value: string) {
  if (!isValidDate(value)) throw new Error("Use a real calendar date in YYYY-MM-DD format.");
  const today = new Date(`${dateInMalaysia()}T00:00:00.000Z`);
  const selected = new Date(`${value}T00:00:00.000Z`);
  const daysAgo = Math.round((today.getTime() - selected.getTime()) / 86_400_000);
  if (daysAgo < 0) throw new Error("This tool can only update today's records or recent records, not future dates.");
  if (daysAgo > 7) throw new Error("Records older than seven days must be changed directly in Little Day by a teacher.");
}

function toolResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value as Record<string, unknown> };
}

function toolError(error: unknown) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : "The request could not be completed." }],
  };
}

function authRequired(metadataUrl: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: "Connect your Little Day account to use classroom tools." }],
    _meta: {
      "mcp/www_authenticate": [
        `Bearer resource_metadata="${metadataUrl}", error="invalid_token", error_description="Connect your Little Day account to continue"`,
      ],
    },
  };
}

async function listPrivateWorkspaces(supabase: SupabaseClient): Promise<WorkspaceRow[]> {
  const { data, error } = await supabase.rpc("list_workspaces");
  if (error) throw new Error("Little Day could not load your workspaces. Reconnect and try again.");
  return ((data ?? []) as WorkspaceRow[]).filter((workspace) => !workspace.is_demo);
}

async function resolveWorkspace(supabase: SupabaseClient, requestedId?: string): Promise<WorkspaceRow> {
  const workspaces = await listPrivateWorkspaces(supabase);
  if (requestedId) {
    const match = workspaces.find((workspace) => workspace.workspace_id === requestedId);
    if (!match) throw new Error("That workspace is not available to your signed-in account. Call list_workspaces to see your options.");
    return match;
  }
  if (workspaces.length === 1) return workspaces[0];
  if (workspaces.length > 1) {
    const choices = workspaces.map(({ workspace_id, workspace_name }) => ({ workspace_id, workspace_name }));
    throw new Error(`Choose a workspace by calling list_workspaces and passing its workspace_id: ${JSON.stringify(choices)}`);
  }
  throw new Error("No private classroom is linked to this account yet. Create or join a workspace in Little Day, then reconnect.");
}

function safeRate(numerator: number, denominator: number): number | null {
  return denominator ? Math.round((numerator / denominator) * 100) : null;
}

function countStatus<T extends { status: string }>(rows: T[], status: string) {
  return rows.filter((row) => row.status === status).length;
}

async function buildDailySummary(supabase: SupabaseClient, requestedWorkspaceId?: string, requestedDate?: string) {
  const date = requestedDate ?? dateInMalaysia();
  if (!isValidDate(date)) throw new Error("Use a real calendar date in YYYY-MM-DD format.");
  const workspace = await resolveWorkspace(supabase, requestedWorkspaceId);

  const [studentsResult, attendanceResult, mealsResult, readingResult] = await Promise.all([
    supabase.from("students").select("id,name,age,group_name").eq("organization_id", workspace.workspace_id).order("name"),
    supabase.from("attendance").select("student_id,status").eq("organization_id", workspace.workspace_id).eq("record_date", date),
    supabase.from("meal_records").select("student_id,meal_type,status").eq("organization_id", workspace.workspace_id).eq("record_date", date),
    supabase.from("reading_lessons").select("student_id,status,duration_minutes").eq("organization_id", workspace.workspace_id).eq("record_date", date),
  ]);
  if (studentsResult.error || attendanceResult.error || mealsResult.error || readingResult.error) {
    throw new Error("Little Day could not load the classroom records. Check the workspace permissions and try again.");
  }

  const students = (studentsResult.data ?? []) as StudentRow[];
  const attendance = (attendanceResult.data ?? []) as AttendanceRow[];
  const meals = (mealsResult.data ?? []) as MealRow[];
  const reading = (readingResult.data ?? []) as ReadingRow[];
  const { start, end } = weekRangeForDate(date);
  const [weekAttendanceResult, weekMealsResult, weekReadingResult] = await Promise.all([
    supabase.from("attendance").select("student_id,status").eq("organization_id", workspace.workspace_id).gte("record_date", start).lte("record_date", end),
    supabase.from("meal_records").select("student_id,status").eq("organization_id", workspace.workspace_id).gte("record_date", start).lte("record_date", end),
    supabase.from("reading_lessons").select("student_id,status").eq("organization_id", workspace.workspace_id).gte("record_date", start).lte("record_date", end),
  ]);
  if (weekAttendanceResult.error || weekMealsResult.error || weekReadingResult.error) {
    throw new Error("Little Day could not load the weekly records. Check the workspace permissions and try again.");
  }

  const weekAttendance = (weekAttendanceResult.data ?? []) as AttendanceRow[];
  const weekMeals = (weekMealsResult.data ?? []) as Array<{ student_id: string; status: string }>;
  const weekReading = (weekReadingResult.data ?? []) as Array<{ student_id: string; status: string }>;

  const perStudent = students.map((student) => {
    const attendanceForStudent = weekAttendance.filter((row) => row.student_id === student.id);
    const mealsForStudent = weekMeals.filter((row) => row.student_id === student.id);
    const readingForStudent = weekReading.filter((row) => row.student_id === student.id);
    const presentDays = attendanceForStudent.filter((row) => row.status === "present" || row.status === "late").length;
    const attendanceRate = safeRate(presentDays, attendanceForStudent.length);
    const mealRate = safeRate(countStatus(mealsForStudent, "completed"), presentDays * 2);
    const readingRate = safeRate(countStatus(readingForStudent, "completed"), presentDays);
    const reasons: string[] = [];
    if (attendanceRate !== null && attendanceRate < 80) reasons.push("Attendance below 80%");
    if (mealRate !== null && mealRate < 70) reasons.push("Meals below 70%");
    if (readingRate !== null && readingRate < 70) reasons.push("Reading below 70%");
    return {
      student_id: student.id,
      name: student.name,
      age: student.age,
      group: student.group_name,
      attendance_rate: attendanceRate,
      meal_completion_rate: mealRate,
      reading_completion_rate: readingRate,
      at_risk_reasons: reasons,
    };
  });

  const dailyStudents = students.map((student) => {
    const attendanceRow = attendance.find((row) => row.student_id === student.id);
    const breakfastRow = meals.find((row) => row.student_id === student.id && row.meal_type === "breakfast");
    const lunchRow = meals.find((row) => row.student_id === student.id && row.meal_type === "lunch");
    const readingRow = reading.find((row) => row.student_id === student.id);
    return {
      student_id: student.id,
      name: student.name,
      age: student.age,
      group: student.group_name,
      attendance: attendanceRow?.status ?? "not_recorded",
      breakfast: breakfastRow?.status ?? "not_recorded",
      lunch: lunchRow?.status ?? "not_recorded",
      reading: readingRow ? { status: readingRow.status, duration_minutes: readingRow.duration_minutes } : { status: "not_recorded", duration_minutes: 0 },
    };
  });

  const presentDays = weekAttendance.filter((row) => row.status === "present" || row.status === "late").length;
  const completedMeals = countStatus(weekMeals, "completed");
  const completedLessons = countStatus(weekReading, "completed");
  const totalPresentAndLateToday = attendance.filter((row) => row.status === "present" || row.status === "late").length;
  const { start: weekStart } = weekRangeForDate(date);

  return {
    workspace: { id: workspace.workspace_id, name: workspace.workspace_name },
    date,
    week_to_date: { start: weekStart, end: date },
    daily_totals: {
      students: students.length,
      present: countStatus(attendance, "present"),
      late: countStatus(attendance, "late"),
      absent: countStatus(attendance, "absent"),
      excused: countStatus(attendance, "excused"),
      attendance_not_recorded: Math.max(0, students.length - attendance.length),
      breakfast_completed: meals.filter((row) => row.meal_type === "breakfast" && row.status === "completed").length,
      lunch_completed: meals.filter((row) => row.meal_type === "lunch" && row.status === "completed").length,
      reading_completed: countStatus(reading, "completed"),
    },
    weekly_rates: {
      attendance_percent: safeRate(presentDays, weekAttendance.length),
      meals_percent: safeRate(completedMeals, presentDays * 2),
      reading_percent: safeRate(completedLessons, presentDays),
    },
    at_risk_students: perStudent.filter((student) => student.at_risk_reasons.length > 0),
    students: dailyStudents,
  };
}

export function createKindyMcpServer(context: McpContext | null, metadataUrl: string) {
  const server = new McpServer(
    { name: "little-day-classroom", version: "1.0.0" },
    { instructions: "Help teachers review and update their Little Day classroom. Start by listing workspaces when needed. Use only the teacher's accessible workspace. Never infer student status; only write when the teacher clearly asks. Do not expose private student notes, delete records, or modify records older than seven days." },
  );

  server.registerTool("get_account_profile", {
    title: "Connected Little Day account",
    description: "Identify the signed-in Little Day account connected to this ChatGPT workspace.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { "openai/profile": true, securitySchemes: oauthSecuritySchemes },
  }, async () => {
    if (!context) return authRequired(metadataUrl);
    return toolResult({ id: context.user.id, name: context.user.email?.split("@")[0] ?? "Teacher", email: context.user.email ?? null });
  });

  server.registerTool("list_workspaces", {
    title: "List my classrooms",
    description: "List private Little Day classrooms that the signed-in user belongs to. Demo sample data is excluded.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { securitySchemes: oauthSecuritySchemes },
  }, async () => {
    if (!context) return authRequired(metadataUrl);
    try {
      const workspaces = await listPrivateWorkspaces(context.supabase);
      return toolResult(workspaces.map(({ workspace_id, workspace_name, role }) => ({ workspace_id, name: workspace_name, role })));
    } catch (error) { return toolError(error); }
  });

  server.registerTool("list_students", {
    title: "List classroom students",
    description: "List student names, ages, and groups in one of the user's private workspaces. Private notes are never returned.",
    inputSchema: { workspace_id: workspaceIdInput },
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { securitySchemes: oauthSecuritySchemes },
  }, async ({ workspace_id }) => {
    if (!context) return authRequired(metadataUrl);
    try {
      const workspace = await resolveWorkspace(context.supabase, workspace_id);
      const { data, error } = await context.supabase.from("students").select("id,name,age,group_name").eq("organization_id", workspace.workspace_id).order("name");
      if (error) throw new Error("Little Day could not load the student roster.");
      return toolResult({ workspace: workspace.workspace_name, students: data ?? [] });
    } catch (error) { return toolError(error); }
  });

  server.registerTool("summarize_daily_records", {
    title: "Summarize daily classroom records",
    description: "Show each student's attendance, breakfast, lunch, and reading status for a date, plus the app's week-to-date completion rates and at-risk flags. Defaults to today in Malaysia. Uses only private workspaces available to the connected account.",
    inputSchema: { workspace_id: workspaceIdInput, date: dateInput },
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { securitySchemes: oauthSecuritySchemes },
  }, async ({ workspace_id, date }) => {
    if (!context) return authRequired(metadataUrl);
    try { return toolResult(await buildDailySummary(context.supabase, workspace_id, date)); }
    catch (error) { return toolError(error); }
  });

  server.registerTool("flag_at_risk_students", {
    title: "Find students needing follow-up",
    description: "Return students whose attendance is below 80%, meal completion below 70%, or reading completion below 70% for the current app week through the selected date. This is a rule-based flag, not a diagnosis.",
    inputSchema: { workspace_id: workspaceIdInput, date: dateInput },
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { securitySchemes: oauthSecuritySchemes },
  }, async ({ workspace_id, date }) => {
    if (!context) return authRequired(metadataUrl);
    try {
      const summary = await buildDailySummary(context.supabase, workspace_id, date);
      return toolResult({ workspace: summary.workspace, week_to_date: summary.week_to_date, students: summary.at_risk_students });
    } catch (error) { return toolError(error); }
  });

  server.registerTool("mark_attendance", {
    title: "Mark student attendance",
    description: "Create or update one student's attendance for today or a date within the last seven days. Only use after the teacher explicitly asks to mark that student and status. Never infer status from context. Each change is saved to Little Day and its audit log.",
    inputSchema: { workspace_id: workspaceIdInput, student_id: z.string().uuid(), date: dateInput, status: attendanceStatus },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { securitySchemes: oauthSecuritySchemes },
  }, async ({ workspace_id, student_id, date, status }) => {
    if (!context) return authRequired(metadataUrl);
    try {
      const workspace = await resolveWorkspace(context.supabase, workspace_id);
      const recordDate = date ?? dateInMalaysia();
      assertWritableDate(recordDate);
      const { data, error } = await context.supabase.from("attendance").upsert(
        { organization_id: workspace.workspace_id, student_id, record_date: recordDate, status },
        { onConflict: "organization_id,student_id,record_date" },
      ).select("student_id,record_date,status").single();
      if (error || !data) throw new Error("Attendance wasn't saved. Check the student and workspace, then try again.");
      return toolResult({ saved: true, workspace: workspace.workspace_name, ...data });
    } catch (error) { return toolError(error); }
  });

  server.registerTool("record_meal", {
    title: "Record a student's meal",
    description: "Create or update one student's breakfast or lunch status for today or a date within the last seven days. Only use after the teacher clearly requests the exact student, meal, and status. Each change is saved to Little Day and its audit log.",
    inputSchema: { workspace_id: workspaceIdInput, student_id: z.string().uuid(), date: dateInput, meal_type: z.enum(["breakfast", "lunch"]), status: mealStatus },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { securitySchemes: oauthSecuritySchemes },
  }, async ({ workspace_id, student_id, date, meal_type, status }) => {
    if (!context) return authRequired(metadataUrl);
    try {
      const workspace = await resolveWorkspace(context.supabase, workspace_id);
      const recordDate = date ?? dateInMalaysia();
      assertWritableDate(recordDate);
      const { data, error } = await context.supabase.from("meal_records").upsert(
        { organization_id: workspace.workspace_id, student_id, record_date: recordDate, meal_type, status },
        { onConflict: "organization_id,student_id,record_date,meal_type" },
      ).select("student_id,record_date,meal_type,status").single();
      if (error || !data) throw new Error("The meal record wasn't saved. Check the student and workspace, then try again.");
      return toolResult({ saved: true, workspace: workspace.workspace_name, ...data });
    } catch (error) { return toolError(error); }
  });

  server.registerTool("record_reading", {
    title: "Record a reading lesson",
    description: "Create or update one student's 30-minute reading lesson for today or a date within the last seven days. Only use after the teacher clearly asks to record completed or incomplete. Each change is saved to Little Day and its audit log.",
    inputSchema: { workspace_id: workspaceIdInput, student_id: z.string().uuid(), date: dateInput, completed: z.boolean() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { securitySchemes: oauthSecuritySchemes },
  }, async ({ workspace_id, student_id, date, completed }) => {
    if (!context) return authRequired(metadataUrl);
    try {
      const workspace = await resolveWorkspace(context.supabase, workspace_id);
      const recordDate = date ?? dateInMalaysia();
      assertWritableDate(recordDate);
      const { data, error } = await context.supabase.from("reading_lessons").upsert(
        { organization_id: workspace.workspace_id, student_id, record_date: recordDate, duration_minutes: completed ? 30 : 0, status: completed ? "completed" : "incomplete" },
        { onConflict: "organization_id,student_id,record_date" },
      ).select("student_id,record_date,duration_minutes,status").single();
      if (error || !data) throw new Error("The reading record wasn't saved. Check the student and workspace, then try again.");
      return toolResult({ saved: true, workspace: workspace.workspace_name, ...data });
    } catch (error) { return toolError(error); }
  });

  // ChatGPT expects this auth descriptor at the root of each tool definition. The
  // SDK exposes tool metadata under `_meta`, so mirror the registered tools here.
  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: chatGptToolDefinitions }));

  return server;
}
