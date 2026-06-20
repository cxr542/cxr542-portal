import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FAVORITE_IDS,
  FAVORITES_STORAGE_KEY,
  readFavoriteIds,
  toggleFavoriteId,
  writeFavoriteIds,
} from '../src/utils/favorites';

const memoryStore = {};
global.localStorage = {
  getItem(key) {
    return key in memoryStore ? memoryStore[key] : null;
  },
  setItem(key, value) {
    memoryStore[key] = String(value);
  },
  clear() {
    Object.keys(memoryStore).forEach((key) => delete memoryStore[key]);
  },
};

const validIds = ['idea-bank', 'marathon', 'today-shoes', 'prompt-collection'];

describe('favorite storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses the configured defaults when no user setting exists', () => {
    expect(readFavoriteIds(validIds)).toEqual(DEFAULT_FAVORITE_IDS);
  });

  it('keeps only valid saved project ids and removes duplicates', () => {
    localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(['idea-bank', 'missing-project', 'home', 'idea-bank', 'today-shoes']),
    );

    expect(readFavoriteIds(validIds)).toEqual(['idea-bank', 'today-shoes']);
  });

  it('persists a project when toggled on and removes it when toggled off', () => {
    const added = toggleFavoriteId([], 'idea-bank', validIds);
    expect(added).toEqual(['idea-bank']);
    writeFavoriteIds(added, validIds);
    expect(JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY))).toEqual(['idea-bank']);

    const removed = toggleFavoriteId(added, 'idea-bank', validIds);
    writeFavoriteIds(removed, validIds);
    expect(removed).toEqual([]);
    expect(JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY))).toEqual([]);
  });
});
