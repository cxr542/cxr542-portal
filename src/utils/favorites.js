export const FAVORITES_STORAGE_KEY = 'cxr542-portal-favorites-v1';

// The portal config uses `marathon` and `prompt-collection` as its stable project ids.
export const DEFAULT_FAVORITE_IDS = ['idea-bank', 'marathon', 'today-shoes', 'prompt-collection'];

function normalizeFavoriteIds(ids, validIds) {
  if (!Array.isArray(ids)) return [];

  const validIdSet = new Set(validIds);
  return ids.reduce((result, id) => {
    if (typeof id === 'string' && validIdSet.has(id) && !result.includes(id)) {
      result.push(id);
    }
    return result;
  }, []);
}

export function readFavoriteIds(validIds) {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (raw === null) return normalizeFavoriteIds(DEFAULT_FAVORITE_IDS, validIds);
    return normalizeFavoriteIds(JSON.parse(raw), validIds);
  } catch {
    return [];
  }
}

export function toggleFavoriteId(currentIds, id, validIds) {
  const favorites = normalizeFavoriteIds(currentIds, validIds);
  return favorites.includes(id)
    ? favorites.filter((favoriteId) => favoriteId !== id)
    : normalizeFavoriteIds([...favorites, id], validIds);
}

export function writeFavoriteIds(ids, validIds) {
  const favorites = normalizeFavoriteIds(ids, validIds);
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
}
