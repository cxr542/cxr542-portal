import { useMemo, useState } from 'react';
import './App.css';
import { summarizeMonthlyDistance } from './utils/marathon';
import { readList, writeList } from './utils/storage';

const STORAGE_KEYS = {
  shoes: 'cxr542-today-shoes-v1',
  marathon: 'cxr542-marathon-log-v1',
  ideas: 'cxr542-idea-bank-v1',
};

const MODULES = [
  { id: 'home', label: '포털 홈' },
  { id: 'vision-font', label: 'vision-font' },
  { id: 'today-shoes', label: 'today-shoes' },
  { id: 'marathon', label: '마라톤 기록장' },
  { id: 'idea-bank', label: '아이디어 뱅크' },
];

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

function formatDate(iso) {
  return new Date(iso).toLocaleString('ko-KR');
}

function HomeModule() {
  return (
    <section className="module-panel">
      <h2>cxr542 포털</h2>
      <p>업무 외 모든 개발 서비스(vision-font, today-shoes, 마라톤 기록장, 아이디어 뱅크)를 한 곳에서 관리합니다.</p>
      <ul className="home-cards">
        {MODULES.filter((item) => item.id !== 'home').map((item) => (
          <li key={item.id}>
            <strong>{item.label}</strong>
            <span>모듈로 이동해 기능을 바로 사용하세요.</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VisionFontModule() {
  const [selected, setSelected] = useState(FONT_PRESETS[0]);
  const [sampleText, setSampleText] = useState('오늘도 꾸준히 만들고 개선한다.');
  const [copied, setCopied] = useState('');

  const copyCss = async () => {
    await navigator.clipboard.writeText(selected.css);
    setCopied('CSS가 복사되었습니다.');
  };

  return (
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
  );
}

function TodayShoesModule() {
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
  );
}

function MarathonModule() {
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
  );
}

function IdeaBankModule() {
  const [ideas, setIdeas] = useState(() => readList(STORAGE_KEYS.ideas));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  const addIdea = (e) => {
    e.preventDefault();
    const title = name.trim();
    if (!title) {
      setMessage('아이디어 이름을 입력하세요.');
      return;
    }
    if (ideas.some((idea) => idea.name.toLowerCase() === title.toLowerCase())) {
      setMessage('동일한 이름의 아이디어가 이미 있습니다.');
      return;
    }
    const next = [{ id: `idea-${Date.now()}`, name: title, description: description.trim(), createdAt: new Date().toISOString() }, ...ideas];
    setIdeas(next);
    writeList(STORAGE_KEYS.ideas, next);
    setName('');
    setDescription('');
    setMessage('아이디어가 등록되었습니다.');
  };

  const removeIdea = (id) => {
    const next = ideas.filter((idea) => idea.id !== id);
    setIdeas(next);
    writeList(STORAGE_KEYS.ideas, next);
  };

  return (
    <section className="module-panel">
      <h2>아이디어 뱅크</h2>
      <form className="grid-form" onSubmit={addIdea}>
        <input className="field" placeholder="서비스 이름" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field" placeholder="설명 (선택)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className="btn-primary" type="submit">아이디어 등록</button>
      </form>
      {message && <p className="hint">{message}</p>}
      <ul className="list">
        {ideas.map((idea) => (
          <li key={idea.id}>
            <div>
              <strong>{idea.name}</strong>
              <span>{idea.description || '설명 없음'}</span>
              <small>{formatDate(idea.createdAt)}</small>
            </div>
            <button className="btn-ghost" type="button" onClick={() => removeIdea(idea.id)}>삭제</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ModuleContent({ active }) {
  if (active === 'vision-font') return <VisionFontModule />;
  if (active === 'today-shoes') return <TodayShoesModule />;
  if (active === 'marathon') return <MarathonModule />;
  if (active === 'idea-bank') return <IdeaBankModule />;
  return <HomeModule />;
}

function App() {
  const [activeModule, setActiveModule] = useState('home');

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <h1>cxr542</h1>
        <p>개인 개발 포털</p>
        <nav>
          {MODULES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-btn ${activeModule === item.id ? 'active' : ''}`}
              onClick={() => setActiveModule(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="content">
        <header className="content-header">
          <h2>{MODULES.find((item) => item.id === activeModule)?.label}</h2>
          <span>v0.1.0 MVP</span>
        </header>
        <ModuleContent active={activeModule} />
      </main>
    </div>
  );
}

export default App;
