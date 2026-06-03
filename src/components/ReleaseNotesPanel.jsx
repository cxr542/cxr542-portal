import {
  RELEASE_NOTES,
  RELEASE_NOTE_TYPE_LABEL,
} from '../constants/releaseNotes';

export default function ReleaseNotesPanel({ onGoHome }) {
  return (
    <section className="module-panel release-notes" aria-labelledby="release-notes-heading">
      <div className="release-notes__head">
        <div>
          <h2 id="release-notes-heading">릴리즈 노트</h2>
          <p className="release-notes__lead">
            cxr542 포털과 모듈의 주요 변경 사항입니다. GitHub{' '}
            <a
              href="https://github.com/cxr542/cxr542-portal/commits/main"
              target="_blank"
              rel="noopener noreferrer"
            >
              커밋 기록
            </a>
            과 함께 보세요.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={onGoHome}>
          ← 포털 홈
        </button>
      </div>

      <ol className="release-notes__list">
        {RELEASE_NOTES.map((entry) => (
          <li key={entry.version} className="release-note-card">
            <header className="release-note-card__header">
              <span className="release-note-card__version">v{entry.version}</span>
              <time className="release-note-card__date" dateTime={entry.date}>
                {entry.date}
              </time>
            </header>
            <h3 className="release-note-card__title">{entry.title}</h3>
            <ul className="release-note-card__items">
              {entry.items.map((item, idx) => (
                <li key={`${entry.version}-${idx}`}>
                  <span
                    className={`release-note-badge release-note-badge--${item.type}`}
                  >
                    {RELEASE_NOTE_TYPE_LABEL[item.type] || item.type}
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
