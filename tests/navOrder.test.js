import { describe, expect, it } from 'vitest';
import {
  applyNavOrder,
  DEFAULT_NAV_ORDER,
  RELEASE_NOTES_MODULE_ID,
  isRoutableModuleId,
  normalizeNavOrder,
} from '../src/constants/portalNav';

describe('nav order', () => {
  it('default order puts who-are-you right after home', () => {
    expect(DEFAULT_NAV_ORDER[0]).toBe('home');
    expect(DEFAULT_NAV_ORDER[1]).toBe('who-are-you');
  });

  it('normalizeNavOrder keeps home first', () => {
    expect(normalizeNavOrder(['vision-font', 'home', 'marathon'])[0]).toBe('home');
  });

  it('isRoutableModuleId includes release notes but not in default nav order', () => {
    expect(isRoutableModuleId(RELEASE_NOTES_MODULE_ID)).toBe(true);
    expect(DEFAULT_NAV_ORDER).not.toContain(RELEASE_NOTES_MODULE_ID);
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
