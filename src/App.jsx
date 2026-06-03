import { useEffect, useMemo, useState } from 'react';
import './App.css';
import ModuleLinkBar from './components/ModuleLinkBar';
import NavLabelsModal from './components/NavLabelsModal';
import PortalSidebar from './components/PortalSidebar';
import { MODULE_HINTS, NAV_IDS, PORTAL_NAV_ITEMS, SIDEBAR_COLLAPSED_KEY } from './constants/portalNav';
import { useNavLabels } from './hooks/useNavLabels';
import { getHomeSnapshots } from './utils/homeSnapshots';
import { summarizeMonthlyDistance } from './utils/marathon';
import { readList, writeList } from './utils/storage';

const IDEA_BANK_APP_URL = '/idea-bank/';

const STORAGE_KEYS = {
  shoes: 'cxr542-today-shoes-v1',
  marathon: 'cxr542-marathon-log-v1',
};

const FONT_PRESETS = [
  {
    id: 'focus',
    name: '집중 모드',
    css: "font-family: 'Pretendard', sans-serif; letter-spacing: 0.01em; font-weight: 600;",
  },
  {
    id: 'reading',
    name: '가독성 모드',
    css: "font-family: 'Noto Serif KR', serif; line-height: 1.7; font-weight: 500;",
  },
  {
    id: 'poster',
    name: '포스터 모드',
    css: "font-family: 'SUIT', sans-serif; letter-spacing: 0.04em; font-weight: 800;",
  },
];

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('ko-KR');
}

function findNavItem(id) {
  return PORTAL_NAV_ITEMS.find((item) => item.id === id);
}

function moduleHasEmbed(id) {
  return Boolean(findNavItem(id)?.embedPath);
}

function readModuleFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('m');
  if (fromQuery && NAV_IDS.includes(fromQuery) && fromQuery !== 'home') return fromQuery;
  const fromHash = window.location.hash.replace(/^#\/?/, '');
  if (fromHash && NAV_IDS.includes(fromHash) && fromHash !== 'home') return fromHash;
  return 'home';
}

function HomeModule({ onOpenModule, labels }) {
  const cards = PORTAL_NAV_ITEMS.filter((item) => item.id !== 'home');
  const snapshots = useMemo(() => getHomeSnapshots(), []);

  return (
    <section className="module-panel">
      <h2>cxr542 포털</h2>
      <p>업무 외 모든 개발 서비스를 한 곳에서 열고, 각 모듈 데이터와 바로 연결됩니다.</p>
      <ul className="home-cards">
        {cards.map((item) => (
          <li key={item.id} className={`home-card home-card--${item.id}`}>
            <button type="button" className="home-card-btn" onClick={() => onOpenModule(item.id)}>
              <strong>
                <span className="home-card__icon" aria-hidden="true">
                  {item.icon}
                </span>{' '}
                {labels[item.id] || item.defaultLabel}
              </strong>
              <span>{MODULE_HINTS[item.id]}</span>
              <span className="home-card-snapshot">{snapshots[item.id]}</span>
              <em className="home-card-cta">{item.homeCta || '모듈 열기 →'}</em>
            </button>
            {item.externalUrl ? (
              <div className="home-card__extra">
                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="home-card__external"
                >
                  {item.externalLabel || '외부 앱'} ↗
                </a>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function VisionFontModule({ onGoHome }) {
  const [selected, setSelected] = useState(FONT_PRESETS[0]);
  const [sampleText, setSampleText] = useState('오늘도 꾸준히 만들고 개선한다.');
  const [copied, setCopied] = useState('');

  const copyCss = async () => {
    await navigator.clipboard.writeText(selected.css);
    setCopied('CSS가 복사되었습니다.');
  };

  return (
    <>
      <ModuleLinkBar
        hint={
          <>
            포털 홈 카드와 연결된 <strong>vision-font</strong> — 프리셋 미리보기 후 CSS를 복사합니다.
          </>
        }
        actions={
          <button type="button" className="btn-ghost" onClick={onGoHome}>
            ← 포털 홈
          </button>
        }
      />
      <section className="module-panel">
      <h2>vision-font</h2>
      <p>폰트 프리셋을 빠르게 적용하고 CSS 코드를 복사할 수 있습니다.</p>
      <div className="stack-row">
        {FONT_PRESETS.map((preset) => (
          <button key={preset.id} className={`chip ${selected.id === preset.id ? 'active' : ''}`} onClick={() => setSelected(preset)}>
            {preset.name}
          </button>
        ))}
      </div>
      <textarea className="field" rows={3} value={sampleText} onChange={(e) => setSampleText(e.target.value)} />
      <div className="preview-box" style={{ fontFamily: selected.id === 'reading' ? "'Noto Serif KR', serif" : "'Pretendard', sans-serif", fontWeight: selected.id === 'poster' ? 800 : 600, letterSpacing: selected.id === 'poster' ? '0.04em' : '0.01em', lineHeight: selected.id === 'reading' ? 1.7 : 1.5 }}>
        {sampleText}
      </div>
      <code>{selected.css}</code>
      <button className="btn-primary" onClick={copyCss}>CSS 복사</button>
      {copied && <small className="hint">{copied}</small>}
    </section>
    </>
  );
}

function TodayShoesModule({ onGoHome }) {
  const external = findNavItem('today-shoes');
  const [items, setItems] = useState(() => readList(STORAGE_KEYS.shoes));
  const [model, setModel] = useState('');
  const [feeling, setFeeling] = useState('');
  const [tag, setTag] = useState('');

  const addItem = (e) => {
    e.preventDefault();
    if (!model.trim()) return;
    const next = [{ id: `shoe-${Date.now()}`, model: model.trim(), feeling: feeling.trim(), tag: tag.trim(), createdAt: new Date().toISOString() }, ...items];
    setItems(next);
    writeList(STORAGE_KEYS.shoes, next);
    setModel('');
    setFeeling('');
    setTag('');
  };

  return (
    <>
      <ModuleLinkBar
        hint={
          <>
            포털에서 착화 메모를 남기고, 사진·AI 분석은{' '}
            <strong>{external?.externalLabel || 'Expo 앱'}</strong>과 연결됩니다.
          </>
        }
        actions={
          <>
            <button type="button" className="btn-ghost" onClick={onGoHome}>
              ← 포털 홈
            </button>
            {external?.externalUrl ? (
              <a className="btn-primary" href={external.externalUrl} target="_blank" rel="noopener noreferrer">
                Expo 앱 열기
              </a>
            ) : null}
          </>
        }
      />
      <section className="module-panel">
      <h2>today-shoes</h2>
      <form className="grid-form" onSubmit={addItem}>
        <input className="field" placeholder="신발 모델" value={model} onChange={(e) => setModel(e.target.value)} />
        <input className="field" placeholder="착화 느낌" value={feeling} onChange={(e) => setFeeling(e.target.value)} />
        <input className="field" placeholder="태그 (예: 러닝/출근)" value={tag} onChange={(e) => setTag(e.target.value)} />
        <button className="btn-primary" type="submit">기록 추가</button>
      </form>
      <ul className="list">
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.model}</strong>
            <span>{item.feeling || '느낌 미입력'} / {item.tag || '태그 없음'}</span>
            <small>{formatDate(item.createdAt)}</small>
          </li>
        ))}
      </ul>
    </section>
    </>
  );
}

function MarathonModule({ onGoHome }) {
  const external = findNavItem('marathon');
  const [logs, setLogs] = useState(() => readList(STORAGE_KEYS.marathon));
  const [distance, setDistance] = useState('');
  const [pace, setPace] = useState('');
  const [duration, setDuration] = useState('');
  const [memo, setMemo] = useState('');

  const summary = useMemo(() => summarizeMonthlyDistance(logs, new Date()), [logs]);

  const addLog = (e) => {
    e.preventDefault();
    if (!distance) return;
    const next = [{ id: `run-${Date.now()}`, distance: Number(distance), pace: pace.trim(), duration: duration.trim(), memo: memo.trim(), createdAt: new Date().toISOString() }, ...logs];
    setLogs(next);
    writeList(STORAGE_KEYS.marathon, next);
    setDistance('');
    setPace('');
    setDuration('');
    setMemo('');
  };

  return (
    <>
      <ModuleLinkBar
        hint={
          <>
            포털 MVP 기록장과 연결됩니다. PB·대회 통계는{' '}
            <strong>{external?.externalLabel || 'GitHub Pages'}</strong> 기록장을 사용하세요.
          </>
        }
        actions={
          <>
            <button type="button" className="btn-ghost" onClick={onGoHome}>
              ← 포털 홈
            </button>
            {external?.externalUrl ? (
              <a className="btn-primary" href={external.externalUrl} target="_blank" rel="noopener noreferrer">
                전체 기록장 열기
              </a>
            ) : null}
          </>
        }
      />
      <section className="module-panel">
      <h2>마라톤 기록장</h2>
      <p className="hint">이번 달 {summary.count}회 / 총 {summary.totalKm.toFixed(1)}km</p>
      <form className="grid-form" onSubmit={addLog}>
        <input className="field" type="number" step="0.1" placeholder="거리(km)" value={distance} onChange={(e) => setDistance(e.target.value)} />
        <input className="field" placeholder="페이스 (예: 5m30s)" value={pace} onChange={(e) => setPace(e.target.value)} />
        <input className="field" placeholder="시간 (예: 00:42:10)" value={duration} onChange={(e) => setDuration(e.target.value)} />
        <input className="field" placeholder="메모" value={memo} onChange={(e) => setMemo(e.target.value)} />
        <button className="btn-primary" type="submit">기록 저장</button>
      </form>
      <ul className="list">
        {logs.map((log) => (
          <li key={log.id}>
            <strong>{log.distance}km</strong>
            <span>페이스 {log.pace || '-'} / 시간 {log.duration || '-'}</span>
            <small>{log.memo || '메모 없음'} · {formatDate(log.createdAt)}</small>
          </li>
        ))}
      </ul>
    </section>
    </>
  );
}

function IdeaBankModule({ onGoHome }) {
  return (
    <section className="idea-bank-embed">
      <div className="idea-bank-embed__bar module-link-bar">
        <p className="hint module-link-bar__hint" style={{ margin: 0 }}>
          포털 홈과 연결 · 아이디어·JSON은 <strong>이 포털 도메인</strong>에 저장됩니다.
          예전 <a href="https://cxr542.github.io/cxr542-ai/projects/idea-bank/" target="_blank" rel="noopener noreferrer">GitHub Pages</a> 데이터는 앱 안 <strong>JSON 가져오기</strong>로 1회 이전하세요.
        </p>
        <div className="module-link-bar__actions">
          <button type="button" className="btn-ghost" onClick={onGoHome}>
            ← 포털 홈
          </button>
          <a className="btn-primary" href={IDEA_BANK_APP_URL} target="_blank" rel="noopener noreferrer">
            전체 화면으로 열기
          </a>
        </div>
      </div>
      <iframe
        className="idea-bank-embed__frame"
        src={IDEA_BANK_APP_URL}
        title="idea-bank 아이디어 노트"
        loading="lazy"
      />
    </section>
  );
}

function ModuleContent({ active, onOpenModule, onGoHome, labels }) {
  if (active === 'vision-font') return <VisionFontModule onGoHome={onGoHome} />;
  if (active === 'today-shoes') return <TodayShoesModule onGoHome={onGoHome} />;
  if (active === 'marathon') return <MarathonModule onGoHome={onGoHome} />;
  if (active === 'idea-bank') return <IdeaBankModule onGoHome={onGoHome} />;
  return <HomeModule onOpenModule={onOpenModule} labels={labels} />;
}

function App() {
  const [activeModule, setActiveModule] = useState(readModuleFromUrl);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [navLabelsOpen, setNavLabelsOpen] = useState(false);
  const { labels, updateLabels, resetLabels, defaults } = useNavLabels();

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeModule === 'home') {
      url.searchParams.delete('m');
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
      return;
    }
    url.searchParams.set('m', activeModule);
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
  }, [activeModule]);

  const goHome = () => setActiveModule('home');
  const activeTitle = labels[activeModule] || findNavItem(activeModule)?.defaultLabel;

  return (
    <div className={`portal-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <PortalSidebar
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        labels={labels}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        onOpenNavLabels={() => setNavLabelsOpen(true)}
      />
      <main className={`content${moduleHasEmbed(activeModule) ? ' content--embed' : ''}`}>
        <header className="content-header">
          <h2>{activeTitle}</h2>
          <span>v0.1.0 MVP</span>
        </header>
        <ModuleContent
          active={activeModule}
          onOpenModule={setActiveModule}
          onGoHome={goHome}
          labels={labels}
        />
      </main>
      <NavLabelsModal
        isOpen={navLabelsOpen}
        onClose={() => setNavLabelsOpen(false)}
        labels={labels}
        defaults={defaults}
        onSave={updateLabels}
        onReset={resetLabels}
      />
    </div>
  );
}

export default App;
