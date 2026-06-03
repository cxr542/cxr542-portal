import { describe, expect, it } from 'vitest';
import { applyNavOrder, DEFAULT_NAV_ORDER, normalizeNavOrder } from '../src/constants/portalNav';

describe('nav order', () => {
  it('default order puts who-are-you right after home', () => {
    expect(DEFAULT_NAV_ORDER[0]).toBe('home');
    expect(DEFAULT_NAV_ORDER[1]).toBe('who-are-you');
  });

  it('normalizeNavOrder keeps home first', () => {
    expect(normalizeNavOrder(['vision-font', 'home', 'marathon'])[0]).toBe('home');
  });

  it('applyNavOrder follows custom order', () => {
    const items = applyNavOrder(['home', 'marathon', 'who-are-you']);
    expect(items.map((i) => i.id)).toEqual([
      'home',
      'marathon',
      'who-are-you',
      ...DEFAULT_NAV_ORDER.filter((id) => !['home', 'marathon', 'who-are-you'].includes(id)),
    ]);
  });
});
