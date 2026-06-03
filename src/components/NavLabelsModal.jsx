import { useEffect, useState } from 'react';
import { NAV_IDS } from '../constants/portalNav';

export default function NavLabelsModal({ isOpen, onClose, labels, defaults, onSave, onReset }) {
  const [draft, setDraft] = useState(labels);

  useEffect(() => {
    if (isOpen) setDraft(labels);
  }, [isOpen, labels]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(draft);
    onClose();
  };

  return (
    <div className="portal-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="portal-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="nav-labels-title"
      >
        <div className="portal-modal__header">
          <h3 id="nav-labels-title">사이드바 메뉴 이름</h3>
          <button type="button" className="portal-modal__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="portal-modal__hint">
            왼쪽 메뉴에 보이는 이름을 바꿀 수 있습니다. 예: 「아이디어 뱅크」→「아이디어 노트」
          </p>
          <div className="portal-modal__body">
            {NAV_IDS.map((id) => (
              <label className="portal-modal__field" key={id}>
                <span>
                  {defaults[id]} <em>(기본)</em>
                </span>
                <input
                  type="text"
                  value={draft[id] || ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [id]: e.target.value }))}
                  maxLength={40}
                />
              </label>
            ))}
          </div>
          <div className="portal-modal__actions">
            <button type="button" className="btn-ghost" onClick={onReset}>
              기본값 복원
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
