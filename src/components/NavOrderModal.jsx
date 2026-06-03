import { useEffect, useState } from 'react';
import { PORTAL_NAV_ITEMS } from '../constants/portalNav';

export default function NavOrderModal({
  isOpen,
  onClose,
  order,
  labels,
  defaults,
  onSave,
  onReset,
}) {
  const [draft, setDraft] = useState(order);

  useEffect(() => {
    if (isOpen) setDraft(order);
  }, [isOpen, order]);

  if (!isOpen) return null;

  const byId = Object.fromEntries(PORTAL_NAV_ITEMS.map((item) => [item.id, item]));
  const modules = draft.filter((id) => id !== 'home');

  const move = (id, dir) => {
    const idx = draft.indexOf(id);
    if (idx < 0) return;
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 1 || swap >= draft.length) return;
    const next = draft.slice();
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setDraft(next);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(draft);
    onClose();
  };

  return (
    <div className="portal-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="portal-modal portal-modal--wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="nav-order-title"
      >
        <div className="portal-modal__header">
          <h3 id="nav-order-title">사이드바 메뉴 순서</h3>
          <button type="button" className="portal-modal__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="portal-modal__hint">
            <strong>포털 홈</strong>은 맨 위에 고정됩니다. 모듈 순서는 사이드바와 홈 카드에 같이 반영됩니다.
          </p>
          <div className="portal-modal__body">
            <div className="nav-order-row nav-order-row--fixed">
              <span className="nav-order-row__icon" aria-hidden="true">
                {byId.home?.icon}
              </span>
              <span className="nav-order-row__label">{labels.home || defaults.home}</span>
              <span className="nav-order-row__pin">고정</span>
            </div>
            <ol className="nav-order-list">
              {modules.map((id, i) => {
                const item = byId[id];
                if (!item) return null;
                return (
                  <li key={id} className="nav-order-row">
                    <span className="nav-order-row__rank">{i + 1}</span>
                    <span className="nav-order-row__icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="nav-order-row__label">
                      {labels[id] || item.defaultLabel}
                    </span>
                    <span className="nav-order-row__actions">
                      <button
                        type="button"
                        className="nav-order-btn"
                        onClick={() => move(id, 'up')}
                        disabled={i === 0}
                        aria-label="위로"
                        title="위로"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="nav-order-btn"
                        onClick={() => move(id, 'down')}
                        disabled={i === modules.length - 1}
                        aria-label="아래로"
                        title="아래로"
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="portal-modal__actions">
            <button type="button" className="btn-ghost" onClick={onReset}>
              기본 순서
            </button>
            <button type="submit" className="btn-primary">
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
