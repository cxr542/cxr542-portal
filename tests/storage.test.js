import { beforeEach, describe, expect, it } from 'vitest';
import { readList, writeList } from '../src/utils/storage';

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

describe('storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes and reads list data', () => {
    writeList('items', [{ id: 1 }]);
    expect(readList('items')).toEqual([{ id: 1 }]);
  });

  it('returns empty list for malformed storage value', () => {
    localStorage.setItem('broken', '{not-json');
    expect(readList('broken')).toEqual([]);
  });
});
