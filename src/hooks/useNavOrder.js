import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_NAV_ORDER,
  NAV_ORDER_STORAGE_KEY,
  applyNavOrder,
  normalizeNavOrder,
} from '../constants/portalNav';

function readOrder() {
  try {
    const raw = localStorage.getItem(NAV_ORDER_STORAGE_KEY);
    if (!raw) return normalizeNavOrder(DEFAULT_NAV_ORDER);
    const parsed = JSON.parse(raw);
    return normalizeNavOrder(parsed);
  } catch {
    return normalizeNavOrder(DEFAULT_NAV_ORDER);
  }
}

export function useNavOrder() {
  const [order, setOrder] = useState(readOrder);

  const navItems = useMemo(() => applyNavOrder(order), [order]);

  const persist = useCallback((next) => {
    const normalized = normalizeNavOrder(next);
    setOrder(normalized);
    localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(normalized));
  }, []);

  const moveItem = useCallback(
    (id, direction) => {
      if (id === 'home') return;
      const idx = order.indexOf(id);
      if (idx < 0) return;
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 1 || swap >= order.length) return;
      const next = order.slice();
      [next[idx], next[swap]] = [next[swap], next[idx]];
      persist(next);
    },
    [order, persist],
  );

  const setOrderFromDraft = useCallback(
    (draft) => {
      persist(draft);
    },
    [persist],
  );

  const resetOrder = useCallback(() => {
    persist(DEFAULT_NAV_ORDER);
  }, [persist]);

  return {
    order,
    navItems,
    moveItem,
    setOrder: setOrderFromDraft,
    resetOrder,
    defaultOrder: DEFAULT_NAV_ORDER,
  };
}
