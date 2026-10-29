-- REVIEW ONLY: apply to home only after separate approval. No users are seeded.
-- Core SQL SHA256: 03de1ae79ef50d79a89aff018c2ceb003b0aac988e8f2ac5bbaf7fec1f2a6f73
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('prompt_preview','prompt_preview_private')) THEN
    RAISE EXCEPTION 'Preview schema already exists; inspect it instead of overwriting';
  END IF;
END $guard$;
CREATE SCHEMA prompt_preview;
REVOKE ALL ON SCHEMA prompt_preview FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA prompt_preview TO authenticated;
CREATE SCHEMA IF NOT EXISTS prompt_preview_private;
REVOKE ALL ON SCHEMA prompt_preview_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA prompt_preview_private TO authenticated;

CREATE TABLE prompt_preview_private.test_users (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT
);
ALTER TABLE prompt_preview_private.test_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON prompt_preview_private.test_users FROM PUBLIC, anon, authenticated;
CREATE FUNCTION prompt_preview_private.allowed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NOT coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    AND EXISTS (SELECT 1 FROM prompt_preview_private.test_users WHERE owner_id = (SELECT auth.uid()));
$$;
REVOKE ALL ON FUNCTION prompt_preview_private.allowed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION prompt_preview_private.allowed() TO authenticated;

CREATE TABLE prompt_preview.portal_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  content text NOT NULL CHECK (length(content) <= 40000),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  category text NOT NULL DEFAULT '' CHECK (length(category) <= 100),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 20),
  source text NOT NULL DEFAULT 'portal' CHECK (source IN ('portal','chatgpt','cli','legacy_import')),
  favorite boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  request_id uuid NOT NULL,
  request_hash text NOT NULL,
  legacy jsonb,
  UNIQUE(owner_id, request_id)
);
CREATE INDEX portal_prompts_owner_updated ON prompt_preview.portal_prompts(owner_id, updated_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX portal_prompts_owner_category ON prompt_preview.portal_prompts(owner_id, category) WHERE deleted_at IS NULL;
CREATE INDEX portal_prompts_owner_favorite ON prompt_preview.portal_prompts(owner_id, updated_at DESC) WHERE deleted_at IS NULL AND favorite;
CREATE INDEX portal_prompts_tags ON prompt_preview.portal_prompts USING gin(tags) WHERE deleted_at IS NULL;
ALTER TABLE prompt_preview.portal_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_prompts_select ON prompt_preview.portal_prompts FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_id AND (SELECT prompt_preview_private.allowed()));
CREATE POLICY portal_prompts_insert ON prompt_preview.portal_prompts FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = owner_id AND (SELECT prompt_preview_private.allowed()));
CREATE POLICY portal_prompts_update ON prompt_preview.portal_prompts FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = owner_id AND (SELECT prompt_preview_private.allowed())) WITH CHECK ((SELECT auth.uid()) = owner_id AND (SELECT prompt_preview_private.allowed()));
REVOKE ALL ON prompt_preview.portal_prompts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON prompt_preview.portal_prompts TO authenticated;

CREATE TABLE prompt_preview_private.prompt_limits (
  owner_id uuid NOT NULL, scope text NOT NULL, bucket timestamptz NOT NULL, requests integer NOT NULL,
  PRIMARY KEY(owner_id, scope)
);
CREATE TABLE prompt_preview_private.prompt_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id uuid NOT NULL, prompt_id uuid NOT NULL, operation text NOT NULL,
  version integer NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prompt_audit_owner_time ON prompt_preview_private.prompt_audit(owner_id, occurred_at);
ALTER TABLE prompt_preview_private.prompt_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_preview_private.prompt_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA prompt_preview_private FROM PUBLIC, anon, authenticated;

CREATE FUNCTION prompt_preview_private.prompt_rate(p_scope text, p_max integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt()->>'is_anonymous')::boolean, false) THEN RAISE SQLSTATE 'PT401' USING MESSAGE='unauthorized'; END IF;
  IF NOT prompt_preview_private.allowed() THEN RAISE SQLSTATE 'PT403' USING MESSAGE='forbidden'; END IF;
  INSERT INTO prompt_preview_private.prompt_limits(owner_id, scope, bucket, requests)
    VALUES(v_uid, p_scope, date_trunc('minute', clock_timestamp()), 1)
  ON CONFLICT(owner_id, scope) DO UPDATE SET
    requests = CASE WHEN prompt_limits.bucket = EXCLUDED.bucket THEN prompt_limits.requests + 1 ELSE 1 END,
    bucket = EXCLUDED.bucket
  RETURNING requests INTO v_count;
  IF v_count > p_max THEN RAISE SQLSTATE 'PT429' USING MESSAGE='rate_limited'; END IF;
END $$;
REVOKE ALL ON FUNCTION prompt_preview_private.prompt_rate(text, integer) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION prompt_preview_private.prompt_write(p_operation text, p_id uuid, p_version integer, p_request_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_row prompt_preview.portal_prompts; v_hash text; v_tags text[];
BEGIN
  PERFORM prompt_preview_private.prompt_rate('write', 60);
  IF p_operation NOT IN ('create','update','delete') OR p_operation IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE SQLSTATE 'PT400' USING MESSAGE='invalid_input'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE k NOT IN ('title','content','description','category','tags','favorite','source','legacy')) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='invalid_input'; END IF;
  IF p_data ? 'tags' THEN
    IF jsonb_typeof(p_data->'tags') <> 'array' THEN RAISE SQLSTATE 'PT400' USING MESSAGE='invalid_tags'; END IF;
    IF jsonb_array_length(p_data->'tags') > 20 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'tags') t WHERE jsonb_typeof(t) <> 'string' OR length(t#>>'{}') NOT BETWEEN 1 AND 60) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='invalid_tags'; END IF;
    SELECT coalesce(array_agg(t), '{}') INTO v_tags FROM jsonb_array_elements_text(p_data->'tags') t;
  END IF;
  IF (p_data ? 'title' AND (jsonb_typeof(p_data->'title') <> 'string' OR length(btrim(p_data->>'title')) NOT BETWEEN 1 AND 300))
    OR (p_data ? 'content' AND (jsonb_typeof(p_data->'content') <> 'string' OR length(p_data->>'content') > 40000))
    OR (p_data ? 'description' AND (jsonb_typeof(p_data->'description') <> 'string' OR length(p_data->>'description') > 2000))
    OR (p_data ? 'category' AND (jsonb_typeof(p_data->'category') <> 'string' OR length(p_data->>'category') > 100))
    OR (p_data ? 'favorite' AND jsonb_typeof(p_data->'favorite') <> 'boolean')
    OR (p_data ? 'source' AND coalesce(p_data->>'source','') NOT IN ('portal','chatgpt','cli','legacy_import'))
    OR (p_data ? 'legacy' AND (p_operation <> 'create' OR p_data->>'source' IS DISTINCT FROM 'legacy_import' OR jsonb_typeof(p_data->'legacy') <> 'object' OR octet_length((p_data->'legacy')::text) > 131072))
    THEN RAISE SQLSTATE 'PT400' USING MESSAGE='invalid_input'; END IF;

  IF p_operation = 'create' THEN
    IF p_request_id IS NULL OR NOT (p_data ? 'title' AND p_data ? 'content') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='invalid_input'; END IF;
    v_hash := encode(sha256(convert_to(p_data::text, 'UTF8')), 'hex');
    PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text || p_request_id::text, 0));
    SELECT * INTO v_row FROM prompt_preview.portal_prompts WHERE owner_id = v_uid AND request_id = p_request_id;
    IF FOUND THEN
      IF v_row.request_hash <> v_hash THEN RAISE SQLSTATE 'PT409' USING MESSAGE='idempotency_conflict'; END IF;
      IF v_row.deleted_at IS NOT NULL THEN RAISE SQLSTATE 'PT410' USING MESSAGE='already_deleted'; END IF;
      RETURN to_jsonb(v_row) - 'request_hash' - 'request_id' - 'legacy';
    END IF;
    INSERT INTO prompt_preview.portal_prompts(owner_id, title, content, description, category, tags, favorite, source, request_id, request_hash, legacy)
    VALUES(v_uid, btrim(p_data->>'title'), p_data->>'content', coalesce(p_data->>'description',''), coalesce(p_data->>'category',''), coalesce(v_tags,'{}'), coalesce((p_data->>'favorite')::boolean,false), coalesce(p_data->>'source','portal'), p_request_id, v_hash, p_data->'legacy') RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM prompt_preview.portal_prompts WHERE id = p_id AND owner_id = v_uid FOR UPDATE;
    IF NOT FOUND OR v_row.deleted_at IS NOT NULL THEN RAISE SQLSTATE 'PT404' USING MESSAGE='not_found'; END IF;
    IF p_version IS NULL OR p_version <> v_row.version THEN RAISE SQLSTATE 'PT409' USING MESSAGE='version_conflict'; END IF;
    UPDATE prompt_preview.portal_prompts SET
      title = coalesce(p_data->>'title', title), content = coalesce(p_data->>'content', content),
      description = coalesce(p_data->>'description', description), category = coalesce(p_data->>'category', category),
      tags = coalesce(v_tags,tags), favorite = coalesce((p_data->>'favorite')::boolean,favorite),
      source = coalesce(p_data->>'source',source), version = version + 1, updated_at = clock_timestamp(),
      deleted_at = CASE WHEN p_operation = 'delete' THEN clock_timestamp() ELSE NULL END
    WHERE id = p_id AND owner_id = v_uid RETURNING * INTO v_row;
  END IF;
  INSERT INTO prompt_preview_private.prompt_audit(owner_id, prompt_id, operation, version) VALUES(v_uid, v_row.id, p_operation, v_row.version);
  DELETE FROM prompt_preview_private.prompt_audit WHERE owner_id = v_uid AND occurred_at < now() - interval '90 days';
  RETURN to_jsonb(v_row) - 'request_hash' - 'request_id' - 'legacy';
END $$;
REVOKE ALL ON FUNCTION prompt_preview_private.prompt_write(text, uuid, integer, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prompt_preview_private.prompt_write(text, uuid, integer, uuid, jsonb) TO authenticated;
CREATE FUNCTION prompt_preview.portal_prompt_write(p_operation text, p_id uuid, p_version integer, p_request_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT prompt_preview_private.prompt_write(p_operation,p_id,p_version,p_request_id,p_data);
$$;
REVOKE ALL ON FUNCTION prompt_preview.portal_prompt_write(text, uuid, integer, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prompt_preview.portal_prompt_write(text, uuid, integer, uuid, jsonb) TO authenticated;

CREATE FUNCTION prompt_preview_private.prompt_read_limit() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT prompt_preview_private.prompt_rate('read',240); $$;
REVOKE ALL ON FUNCTION prompt_preview_private.prompt_read_limit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prompt_preview_private.prompt_read_limit() TO authenticated;
CREATE FUNCTION prompt_preview.portal_prompt_list(p_query text, p_category text, p_tags text[], p_favorite boolean, p_cursor_time timestamptz, p_cursor_id uuid, p_limit integer)
RETURNS TABLE(id uuid, owner_id uuid, title text, description text, category text, tags text[], source text, favorite boolean, visibility text, version integer, created_at timestamptz, updated_at timestamptz, deleted_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM prompt_preview_private.prompt_read_limit();
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 51 OR p_query IS NULL OR length(p_query) > 200 OR cardinality(p_tags) > 20 THEN RAISE SQLSTATE 'PT400' USING MESSAGE='invalid_input'; END IF;
  RETURN QUERY SELECT p.id,p.owner_id,p.title,p.description,p.category,p.tags,p.source,p.favorite,p.visibility,p.version,p.created_at,p.updated_at,p.deleted_at
  FROM prompt_preview.portal_prompts p
  WHERE p.owner_id = auth.uid() AND p.deleted_at IS NULL
    AND (p_query = '' OR strpos(lower(p.title || E'\n' || p.content || E'\n' || p.description || E'\n' || array_to_string(p.tags,' ')),lower(p_query)) > 0)
    AND (p_category IS NULL OR p.category = p_category)
    AND (p_tags IS NULL OR p.tags @> p_tags)
    AND (p_favorite IS NULL OR p.favorite = p_favorite)
    AND (p_cursor_time IS NULL OR (p.updated_at,p.id) < (p_cursor_time,p_cursor_id))
  ORDER BY p.updated_at DESC,p.id DESC LIMIT p_limit;
END $$;
REVOKE ALL ON FUNCTION prompt_preview.portal_prompt_list(text,text,text[],boolean,timestamptz,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prompt_preview.portal_prompt_list(text,text,text[],boolean,timestamptz,uuid,integer) TO authenticated;
CREATE FUNCTION prompt_preview.portal_prompt_get(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM prompt_preview_private.prompt_read_limit();
  SELECT to_jsonb(p) - 'request_id' - 'request_hash' - 'legacy' INTO result FROM prompt_preview.portal_prompts p
    WHERE p.id = p_id AND p.owner_id = auth.uid() AND p.deleted_at IS NULL;
  IF result IS NULL THEN RAISE SQLSTATE 'PT404' USING MESSAGE='not_found'; END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION prompt_preview.portal_prompt_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prompt_preview.portal_prompt_get(uuid) TO authenticated;
CREATE FUNCTION prompt_preview.portal_prompt_export(p_query text, p_category text, p_tags text[], p_favorite boolean, p_cursor_time timestamptz, p_cursor_id uuid, p_limit integer, p_include_deleted boolean)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM prompt_preview_private.prompt_read_limit();
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 51 OR p_query IS NULL OR length(p_query) > 200 OR cardinality(p_tags) > 20 THEN RAISE SQLSTATE 'PT400' USING MESSAGE='invalid_input'; END IF;
  RETURN QUERY SELECT to_jsonb(p) - 'request_hash'
  FROM prompt_preview.portal_prompts p WHERE p.owner_id = auth.uid() AND (p.deleted_at IS NULL OR p_include_deleted)
    AND (p_query = '' OR strpos(lower(p.title || E'\n' || p.content || E'\n' || p.description || E'\n' || array_to_string(p.tags,' ')),lower(p_query)) > 0)
    AND (p_category IS NULL OR p.category = p_category)
    AND (p_tags IS NULL OR p.tags @> p_tags)
    AND (p_favorite IS NULL OR p.favorite = p_favorite)
    AND (p_cursor_time IS NULL OR (p.updated_at,p.id) < (p_cursor_time,p_cursor_id))
  ORDER BY p.updated_at DESC,p.id DESC LIMIT p_limit;
END $$;
REVOKE ALL ON FUNCTION prompt_preview.portal_prompt_export(text,text,text[],boolean,timestamptz,uuid,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prompt_preview.portal_prompt_export(text,text,text[],boolean,timestamptz,uuid,integer,boolean) TO authenticated;
CREATE FUNCTION prompt_preview_private.prompt_api_limit(p_write boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_write IS NULL THEN RAISE SQLSTATE 'PT400' USING MESSAGE='invalid_input'; END IF;
  PERFORM prompt_preview_private.prompt_rate(CASE WHEN p_write THEN 'api-write' ELSE 'api-read' END, CASE WHEN p_write THEN 60 ELSE 240 END);
END $$;
REVOKE ALL ON FUNCTION prompt_preview_private.prompt_api_limit(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prompt_preview_private.prompt_api_limit(boolean) TO authenticated;
CREATE FUNCTION prompt_preview.portal_prompt_limit(p_write boolean) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT prompt_preview_private.prompt_api_limit(p_write); $$;
REVOKE ALL ON FUNCTION prompt_preview.portal_prompt_limit(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prompt_preview.portal_prompt_limit(boolean) TO authenticated;
COMMIT;
