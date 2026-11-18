import { describe, expect, it } from 'vitest';
import { filterSampleRepos, REPO_CATEGORIES, SAMPLE_REPOS } from './GithubReposPage';

describe('GitHub repository demo fixtures', () => {
  it('contains unique repository names', () => {
    expect(new Set(SAMPLE_REPOS.map(repo => repo.name)).size).toBe(SAMPLE_REPOS.length);
  });
  it('assigns every repository to a declared category', () => {
    const allowed = new Set(REPO_CATEGORIES.map(category => category.name));
    expect(SAMPLE_REPOS.every(repo => allowed.has(repo.category))).toBe(true);
  });
  it('filters by category and origin simultaneously', () => {
    const found = filterSampleRepos(SAMPLE_REPOS, { category: 'AI·에이전트', origin: '외부 원본 추정' });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every(repo => repo.category === 'AI·에이전트' && repo.origin === '외부 원본 추정')).toBe(true);
  });
  it('matches case-insensitive names and descriptions', () => {
    expect(filterSampleRepos(SAMPLE_REPOS, { query: 'GEMINITUNER' }).map(repo => repo.name)).toContain('GeminiTuner');
    expect(filterSampleRepos(SAMPLE_REPOS, { query: '러닝화' }).map(repo => repo.name)).toContain('today-shoes');
  });
  it('handles empty results', () => {
    expect(filterSampleRepos(SAMPLE_REPOS, { query: 'not-a-repository-xxxx' })).toEqual([]);
  });
});
