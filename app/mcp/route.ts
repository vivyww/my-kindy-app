import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createClient } from "@supabase/supabase-js";
import { createKindyMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const resourceMetadataPath = "/.well-known/oauth-protected-resource/mcp";
const mcpResource = "https://my-kindy-app.vercel.app/mcp";

function unauthorized(request: Request) {
  const metadataUrl = `${new URL(request.url).origin}${resourceMetadataPath}`;
  return Response.json(
    { error: "Authentication required. Connect through ChatGPT using your Little Day account." },
    { status: 401, headers: { "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl}"` } },
  );
}

async function getAuthorizedContext(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("MCP Supabase configuration is missing.");

  const token = match[1].trim();
  if (!token || token.length > 8192) return null;
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: claimData, error: claimError } = await supabase.auth.getClaims(token);
  const claims = claimData?.claims;
  const audiences = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud];
  if (claimError || !audiences.includes(mcpResource) || typeof claims?.client_id !== "string" || !claims.client_id) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export async function POST(request: Request) {
  let context: Awaited<ReturnType<typeof getAuthorizedContext>>;
  try {
    context = await getAuthorizedContext(request);
  } catch {
    return Response.json({ error: "The classroom connection is not configured." }, { status: 503 });
  }
  const metadataUrl = `${new URL(request.url).origin}${resourceMetadataPath}`;
  const server = createKindyMcpServer(context, metadataUrl);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 1_048_576,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } catch {
    return Response.json({ error: "The MCP request could not be processed." }, { status: 400 });
  }
}

export async function GET(request: Request) {
  let context: Awaited<ReturnType<typeof getAuthorizedContext>>;
  try {
    context = await getAuthorizedContext(request);
  } catch {
    return Response.json({ error: "The classroom connection is not configured." }, { status: 503 });
  }
  if (!context) return unauthorized(request);
  return new Response("This Little Day MCP endpoint uses Streamable HTTP POST requests.", {
    status: 405,
    headers: { Allow: "POST" },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } });
}
