import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const sourcePath = 'supabase/migrations/20261027152049_portal_prompts.sql';
export const outputPath = 'supabase/preview/portal-prompts.sql';

// The reviewed core SQL remains the single source for CRUD, versions and tombstones.
export function buildPreviewSql(source) {
  const rateGuard = "  INSERT INTO portal_private.prompt_limits(owner_id, scope, bucket, requests)";
  if (!source.startsWith('BEGIN;\n') || source.split(rateGuard).length !== 2 || source.split('(SELECT auth.uid()) = owner_id').length !== 5) {
    throw new Error('Core SQL changed: review the preview isolation transformation.');
  }
  let sql = source.replaceAll('public.', 'prompt_preview.').replaceAll('portal_private', 'prompt_preview_private');
  const isolation = `DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('prompt_preview','prompt_preview_private')) THEN
    RAISE EXCEPTION 'Preview schema already exists; inspect it instead of overwriting';
  END IF;
END $guard$;
CREATE SCHEMA prompt_preview;
REVOKE ALL ON SCHEMA prompt_preview FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA prompt_preview TO authenticated;
`;
  sql = sql.replace('BEGIN;\n', () => 'BEGIN;\n' + isolation);
  const members = `CREATE TABLE prompt_preview_private.test_users (
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

`;
  sql = sql.replace('CREATE TABLE prompt_preview.portal_prompts (', () => members + 'CREATE TABLE prompt_preview.portal_prompts (');
  sql = sql.replaceAll('(SELECT auth.uid()) = owner_id', '(SELECT auth.uid()) = owner_id AND (SELECT prompt_preview_private.allowed())');
  sql = sql.replace(rateGuard.replace('portal_private','prompt_preview_private'), "  IF NOT prompt_preview_private.allowed() THEN RAISE SQLSTATE 'PT403' USING MESSAGE='forbidden'; END IF;\n" + rateGuard.replace('portal_private','prompt_preview_private'));
  return '-- REVIEW ONLY: apply to home only after separate approval. No users are seeded.\n-- Core SQL SHA256: ' + createHash('sha256').update(source).digest('hex') + '\n' + sql;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync('supabase/preview', { recursive: true });
  writeFileSync(outputPath, buildPreviewSql(readFileSync(sourcePath,'utf8')));
  console.info('Wrote ' + outputPath + '; no database connection or changes.');
}
