import { formatCount, formatDateTime, visibilityLabel } from './repoUi.js';

function Updated({ value }) {
  const label = formatDateTime(value);
  return label ? <time dateTime={value}>{label}</time> : '—';
}

function RepoName({ repo }) {
  return <>{repo.favorite && <><span className="repo-favorite" aria-hidden="true">★ </span><span className="sr-only">즐겨찾기 </span></>}{repo.name}</>;
}

function RepoLabels({ repo }) {
  return <div className="repo-labels">
    <span>{repo.category}</span>
    {repo.status && <span>{repo.status}</span>}
    {repo.hidden && <span>숨김</span>}
  </div>;
}

function RepoActions({ repo, onManage }) {
  return <div className="repo-actions">
    <a className="secondary" href={repo.url} target="_blank" rel="noopener noreferrer" aria-label={`GitHub 열기 · ${repo.name}`}>GitHub <span aria-hidden="true">↗</span></a>
    <button className="secondary" type="button" aria-haspopup="dialog" aria-label={`${repo.name} 관리`} onClick={event => onManage(repo.key, event.currentTarget)}>관리</button>
  </div>;
}

const fields = [
  { label: '언어', value: repo => repo.language || '—' },
  { label: '공개 범위', value: repo => <span className="repo-visibility">{visibilityLabel(repo.visibility)}</span> },
  { label: 'Star', value: repo => formatCount(repo.stars) },
  { label: '업데이트', value: repo => <Updated value={repo.updatedAt} /> },
];

export function RepoResults({ repos, view, onManage }) {
  // Roles preserve table semantics when CSS stacks cells at narrow widths.
  if (view === 'list') return <div className="repo-table-wrap">
    <table className="repo-table" aria-label="저장소 비교" role="table">
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader">저장소</th>
          {fields.map(({ label }) => <th key={label} scope="col" role="columnheader">{label}</th>)}
          <th scope="col" role="columnheader">작업</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {repos.map(repo => <tr key={repo.key} role="row">
          <th scope="row" role="rowheader">
            <strong><RepoName repo={repo} /></strong>
            <p className="repo-description">{repo.description || '설명이 없습니다.'}</p>
            <RepoLabels repo={repo} />
          </th>
          {fields.map(({ label, value }) => <td key={label} role="cell">
            <span className="repo-mobile-label" aria-hidden="true">{label}</span>
            <span>{value(repo)}</span>
          </td>)}
          <td role="cell"><RepoActions repo={repo} onManage={onManage} /></td>
        </tr>)}
      </tbody>
    </table>
  </div>;

  return <ul className="repo-cards" role="list">
    {repos.map(repo => <li key={repo.key} className="repo-card">
      <div className="repo-card__heading">
        <h3><RepoName repo={repo} /></h3>
        <span className="repo-visibility">{visibilityLabel(repo.visibility)}</span>
      </div>
      <p className="repo-description">{repo.description || '설명이 없습니다.'}</p>
      <RepoLabels repo={repo} />
      <dl className="repo-card__facts">
        {fields.filter(({ label }) => label !== '공개 범위').map(({ label, value }) => <div key={label}>
          <dt>{label}</dt><dd>{value(repo)}</dd>
        </div>)}
      </dl>
      <RepoActions repo={repo} onManage={onManage} />
    </li>)}
  </ul>;
}
