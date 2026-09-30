# Connect Little Day to ChatGPT

Little Day exposes a remote MCP server at `https://my-kindy-app.vercel.app/mcp`. It uses Supabase OAuth so ChatGPT acts as the signed-in teacher, while workspace row-level security remains active.

## Supabase setup (one time)

In the Supabase project for Little Day:

1. Open **Authentication → OAuth Server** and enable the OAuth 2.1 server.
2. Set the authorization path to `/oauth/consent`.
3. Enable dynamic client registration so ChatGPT can register its connector.
4. In **Authentication → URL Configuration**, make sure the Site URL is `https://my-kindy-app.vercel.app`.
5. In the SQL Editor, apply `supabase/migrations/0003_mcp_oauth_audience.sql`.
6. Open **Authentication → Hooks → Custom Access Token**, choose the `public.mcp_access_token_hook` Postgres function, and save it.

The authorization screen is hosted by Little Day. It requires an existing Little Day account and shows the requested access before the teacher approves it.
The hook adds the MCP resource URL as an audience only to OAuth-issued tokens and retains the `authenticated` audience for normal Supabase RLS.

## ChatGPT Work setup

1. Open ChatGPT on the web and go to **Settings → Apps** (or **Apps & Connectors**, depending on the workspace UI).
2. If needed, have the workspace admin enable **Developer mode** for custom MCP apps.
3. Choose **Create app** / **Add custom app**, and enter `https://my-kindy-app.vercel.app/mcp` as the MCP server URL.
4. Choose OAuth when prompted and save the app as **Little Day Classroom**.
5. Connect the app, sign in to Little Day, review the access screen, and choose **Allow ChatGPT**.
6. In a ChatGPT Work conversation, enable the Little Day app and ask for a daily classroom summary. To make a record, explicitly name the student, date, and status.

The connector can read workspaces, names, ages, groups, attendance, meals, reading logs, weekly completion rates, and rule-based follow-up flags. It can record attendance, meals, and reading only when explicitly asked. It cannot read student notes, access the public demo workspace, delete records, or edit records older than seven days.

## Endpoint checks

- `GET https://my-kindy-app.vercel.app/mcp` without a token should return `401` with a `WWW-Authenticate` header that points to `/.well-known/oauth-protected-resource/mcp`.
- `GET https://my-kindy-app.vercel.app/.well-known/oauth-protected-resource/mcp` should return the protected-resource metadata with the Supabase OAuth issuer.
- After the Supabase OAuth settings are enabled, the ChatGPT connector should complete authorization through `/oauth/consent` and then list the signed-in user's private workspaces.

ChatGPT plan and workspace settings control whether custom MCP apps are available and whether write tools can run. See [OpenAI's MCP connector instructions](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt) for the current UI and plan requirements.
