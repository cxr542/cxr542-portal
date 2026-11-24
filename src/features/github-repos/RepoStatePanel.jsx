import { SOURCE_ERRORS } from './repoErrors.js';
import { errorView, formatClock } from './repoUi.js';

/** Full-area state for the repository list: loading skeleton, error, or empty. */
export function RepoStatePanel({ kind, code = 'unknown', resetAt = null, onRetry }) {
  if (kind === 'loading') {
    return <div className="repo-state repo-state--loading">
      <span className="repo-glass__sr-only">저장소 목록을 불러오는 중입니다…</span>
      {[0, 1, 2, 3, 4].map(index => <div key={index} className="repo-skeleton" aria-hidden="true">
        <span className="repo-skeleton__dot" /><span className="repo-skeleton__lines"><span /><span /></span><span className="repo-skeleton__pill" />
      </div>)}
    </div>;
  }
  if (kind === 'empty') {
    return <div className="repo-state">
      <span className="repo-state__icon" aria-hidden="true">◌</span>
      <h3>아직 표시할 저장소가 없습니다</h3>
      <p>GitHub 계정에 소유한 저장소가 없거나, 모두 숨김 처리되었습니다.</p>
      {onRetry && <button type="button" className="repo-state__action" onClick={onRetry}>다시 불러오기</button>}
    </div>;
  }
  const view = errorView(code);
  const clock = formatClock(resetAt);
  return <div className={`repo-state repo-state--error repo-state--${code}`} role="alert">
    <span className="repo-state__icon" aria-hidden="true">{view.icon}</span>
    <h3>{view.title}</h3>
    <p>{SOURCE_ERRORS[code] || SOURCE_ERRORS.unknown}</p>
    <p className="repo-state__hint">{view.hint}{code === 'rate_limited' && clock ? ` 재시도 가능 시각: ${clock}` : ''}</p>
    {onRetry && <button type="button" className="repo-state__action" onClick={onRetry}>다시 시도</button>}
  </div>;
}

/** Compact banner shown above stale data when a refresh fails. */
export function RepoStaleBanner({ code = 'unknown', resetAt = null, onRetry }) {
  const view = errorView(code);
  const clock = formatClock(resetAt);
  return <div className="repo-stale" role="alert">
    <span aria-hidden="true">{view.icon}</span>
    <span>{view.title}. 이전에 불러온 목록을 표시합니다.{code === 'rate_limited' && clock ? ` (${clock} 이후 재시도)` : ''}</span>
    {onRetry && <button type="button" onClick={onRetry}>다시 시도</button>}
  </div>;
}
