-- REVIEW ONLY. Back up preview data and disable Preview API before running.
-- Do not run this against the public production prompt schema.
BEGIN;
DROP FUNCTION prompt_preview.portal_prompt_write(text,uuid,integer,uuid,jsonb);
DROP FUNCTION prompt_preview.portal_prompt_list(text,text,text[],boolean,timestamptz,uuid,integer);
DROP FUNCTION prompt_preview.portal_prompt_get(uuid);
DROP FUNCTION prompt_preview.portal_prompt_export(text,text,text[],boolean,timestamptz,uuid,integer,boolean);
DROP FUNCTION prompt_preview.portal_prompt_limit(boolean);
DROP TABLE prompt_preview.portal_prompts;
DROP FUNCTION prompt_preview_private.prompt_api_limit(boolean);
DROP FUNCTION prompt_preview_private.prompt_read_limit();
DROP FUNCTION prompt_preview_private.prompt_write(text,uuid,integer,uuid,jsonb);
DROP FUNCTION prompt_preview_private.prompt_rate(text,integer);
DROP FUNCTION prompt_preview_private.allowed();
DROP TABLE prompt_preview_private.prompt_limits;
DROP TABLE prompt_preview_private.prompt_audit;
DROP TABLE prompt_preview_private.test_users;
DROP SCHEMA prompt_preview;
DROP SCHEMA prompt_preview_private;
COMMIT;
