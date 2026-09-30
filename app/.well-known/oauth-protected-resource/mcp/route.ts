export const dynamic = "force-dynamic";
const mcpResource = "https://my-kindy-app.vercel.app/mcp";

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!supabaseUrl) return Response.json({ error: "OAuth is not configured." }, { status: 503 });

  return Response.json(
    {
      resource: mcpResource,
      authorization_servers: [`${supabaseUrl}/auth/v1`],
      bearer_methods_supported: ["header"],
      resource_documentation: "https://my-kindy-app.vercel.app/docs/chatgpt-mcp",
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
