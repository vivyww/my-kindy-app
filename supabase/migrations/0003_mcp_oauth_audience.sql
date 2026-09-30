-- Bind Supabase OAuth-issued access tokens to Little Day's remote MCP resource.
-- Keep the authenticated audience as well so existing PostgREST/RLS access works.

create or replace function public.mcp_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb := event->'claims';
begin
  -- Supabase OAuth Server includes client_id in OAuth access-token claims.
  -- Normal password, magic-link, and browser sessions keep their existing audience.
  if coalesce(claims->>'client_id', '') <> '' then
    claims := jsonb_set(
      claims,
      '{aud}',
      ' ["authenticated", "https://my-kindy-app.vercel.app/mcp"] '::jsonb,
      true
    );
    event := jsonb_set(event, '{claims}', claims, true);
  end if;
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.mcp_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.mcp_access_token_hook(jsonb) from anon, authenticated, public;
