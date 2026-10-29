-- First disable/restore the custom access token hook in Auth settings.
-- Revoke the dedicated MCP client/sessions separately before removing its mapping.
-- Does not drop the shared private schema or other prompt tables.
begin;
drop function prompt_preview_private.mcp_access_token_hook(jsonb);
drop table prompt_preview_private.mcp_oauth_resources;
commit;
