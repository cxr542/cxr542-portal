import { useCallback, useState } from 'react';
import { DEFAULT_NAV_LABELS, NAV_LABELS_STORAGE_KEY } from '../constants/portalNav';

function readLabels() {
  try {
    const raw = localStorage.getItem(NAV_LABELS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NAV_LABELS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_NAV_LABELS, ...parsed };
  } catch {
    return { ...DEFAULT_NAV_LABELS };
  }
}

export function useNavLabels() {
  const [labels, setLabels] = useState(readLabels);

  const persist = useCallback((next) => {
    setLabels(next);
    localStorage.setItem(NAV_LABELS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const updateLabel = useCallback(
    (id, value) => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return;
      persist({ ...labels, [id]: trimmed });
    },
    [labels, persist],
  );

  const updateLabels = useCallback(
    (draft) => {
      const next = { ...labels };
      Object.keys(draft).forEach((id) => {
        const v = String(draft[id] || '').trim();
        if (v) next[id] = v;
      });
      persist(next);
    },
    [labels, persist],
  );

  const resetLabels = useCallback(() => {
    persist({ ...DEFAULT_NAV_LABELS });
  }, [persist]);

  return { labels, updateLabel, updateLabels, resetLabels, defaults: DEFAULT_NAV_LABELS };
}
