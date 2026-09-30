import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workspace, WorkspaceMember } from "./types";

export async function listWorkspaces(client: SupabaseClient) {
  const result = await client.rpc("list_workspaces");
  return { data: result.data as Workspace[] | null, error: result.error };
}

export async function createWorkspace(client: SupabaseClient, name: string) {
  const result = await client.rpc("create_workspace", { workspace_name: name });
  return { data: result.data as string | null, error: result.error };
}

export async function listWorkspaceMembers(client: SupabaseClient, organizationId: string) {
  const result = await client.rpc("list_workspace_members", { target_organization: organizationId });
  return { data: result.data as WorkspaceMember[] | null, error: result.error };
}

export async function inviteWorkspaceMember(client: SupabaseClient, organizationId: string, email: string) {
  const result = await client.rpc("create_workspace_invite", { target_organization: organizationId, invite_email: email });
  return { data: result.data as string | null, error: result.error };
}

export async function acceptWorkspaceInvite(client: SupabaseClient, token: string) {
  const result = await client.rpc("accept_workspace_invite", { invite_token: token });
  return { data: result.data as string | null, error: result.error };
}

export async function removeWorkspaceMember(client: SupabaseClient, organizationId: string, userId: string) {
  return client.rpc("remove_workspace_member", { target_organization: organizationId, target_user: userId });
}
