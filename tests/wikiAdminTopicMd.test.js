import { describe, expect, it } from 'vitest';
import { parseTopicSlugUrl } from '../scripts/portal-wiki-admin/topic-md.mjs';

describe('wiki admin topic routes', () => {
  it('parses topic slug path', () => {
    expect(parseTopicSlugUrl('/api/admin/topics/gemini')).toEqual({ slug: 'gemini' });
  });

  it('rejects reserved slugs', () => {
    expect(parseTopicSlugUrl('/api/admin/topics/new')).toBeNull();
  });
});
