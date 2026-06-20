import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('favorite toggle markup', () => {
  it('renders a visible favorite-toggle control on the Ideas placeholder card', async () => {
    const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
    const placeholderStart = source.indexOf('project-card--placeholder');
    const placeholderSource = source.slice(placeholderStart, placeholderStart + 1800);

    expect(placeholderSource).toContain('favorite-toggle--unavailable');
    expect(placeholderSource).toContain('자주 쓰는 도구에 추가');
  });
});
