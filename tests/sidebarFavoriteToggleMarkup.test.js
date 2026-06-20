import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('sidebar favorite toggle markup', () => {
  it('keeps project navigation separate from the menu favorite toggle', async () => {
    const source = await readFile(new URL('../src/components/PortalSidebar.jsx', import.meta.url), 'utf8');

    expect(source).toContain('onToggleFavorite');
    expect(source).toContain('sidebar-favorite-toggle');
    expect(source).toContain('event.stopPropagation()');
    expect(source).toContain('event.preventDefault()');
  });
});
