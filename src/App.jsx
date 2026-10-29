import { useEffect, useState } from 'react';
import './App.css';
import ReleaseNotesPanel from './components/ReleaseNotesPanel';
import { RELEASE_NOTES_MODULE_ID } from './constants/releaseNotes';

import {
  fetchWikiAdminConfig,
  isWikiLocalDevServerAvailable,
  resolveWikiFrameUrl,
  WIKI_DEV_PATH_HOME,
  WIKI_DEV_PATH_ADMIN_TOPICS,
  WIKI_DEV_PATH_REGISTER_NL,
  WIKI_DEV_PATH_REGISTER_NEW,
  WIKI_DEV_SETUP_COMMANDS,
  wikiDevFrameUrl,
  wikiStaticFrameUrl,
  WIKI_DEV_API_DEFAULT_URL,
} from './utils/aiSynapseWikiDev';
import { TODAY_SHOES_APP_URL } from './utils/todayShoesDev';
import {
  GEMINI_TUNER_APP_URL,
  GEMINI_TUNER_GITHUB_PAGES_URL,
  GEMINI_TUNER_REPO_URL,
} from './utils/geminiTunerDev';
import { VISION_FONT_APP_URL } from './utils/visionFontDev';

import Workspace from './components/Workspace';
import ToolFrame from './components/ToolFrame';
import { PORTAL_NAV_ITEMS } from './constants/portalNav';
const findNavItem = id => PORTAL_NAV_ITEMS.find(item => item.id === id);
const IDEA_BANK_APP_URL = '/idea-bank/index.html';
const PROMPT_COLLECTION_APP_URL = '/prompt-collection/index.html';
const HOW_MANY_POINTS_APP_URL = '/how-many-points/index.html';
const WHO_ARE_YOU_APP_URL = '/who-are-you/index.html';
const MARATHON_LOG_APP_URL = '/marathon-log/index.html';

function VisionFontModule({ onGoHome }) {
  return (
    <section className="module-embed">
      <div className="module-embed__bar module-link-bar">
        <p className="hint module-link-bar__hint" style={{ margin: 0 }}>
          <strong>시력 테스트</strong>로 맞춘 글꼴·크기로 기사를 읽습니다. 설정은{' '}
          <strong>이 포털 도메인</strong>에 저장되며 JSON으로 백업할 수 있습니다.
        </p>
        <div className="module-link-bar__actions">
          <button type="button" className="btn-ghost" onClick={onGoHome}>
            ← 포털 홈
          </button>
          <a
            className="btn-primary"
            href={VISION_FONT_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            전체 화면으로 열기
          </a>
        </div>
      </div>
      <ToolFrame
        className="module-embed__frame"
        src={VISION_FONT_APP_URL}
        title="vision-font"
        loading="lazy"
      />
    </section>
  );
}

function TodayShoesModule({ onGoHome }) {
  return (
    <section className="module-embed">
      <div className="module-embed__bar module-link-bar">
        <p className="hint module-link-bar__hint" style={{ margin: 0 }}>
          <strong>신발장</strong>에 3각도 사진을 등록하고 Gemini·기본 분석으로 특성을 정리합니다. 데이터는{' '}
          <strong>이 포털 도메인</strong>에 저장되며, 예전 포털 MVP 메모는 앱 안에서 가져올 수 있습니다.
        </p>
        <div className="module-link-bar__actions">
          <button type="button" className="btn-ghost" onClick={onGoHome}>
            ← 포털 홈
          </button>
          <a
            className="btn-primary"
            href={TODAY_SHOES_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            전체 화면으로 열기
          </a>
        </div>
      </div>
      <ToolFrame
        className="module-embed__frame"
        src={TODAY_SHOES_APP_URL}
        title="today-shoes"
        loading="lazy"
      />
    </section>
  );
}

function AiSynapseWikiModule({ onGoHome }) {
  const localDevServer = isWikiLocalDevServerAvailable();
  const [wikiMode, setWikiMode] = useState('static');
  const [wikiFrameSrc, setWikiFrameSrc] = useState(() => wikiStaticFrameUrl('/'));
  const [adminApi, setAdminApi] = useState({ status: 'checking' });
  const [adminCheckGen, setAdminCheckGen] = useState(0);

  const adminConnected = adminApi.status === 'connected';
  const canUseLocalDev = localDevServer && adminConnected;

  const openWikiPath = (path, preferLocalDev = false) => {
    const useDev = localDevServer && preferLocalDev && adminConnected;
    if (useDev && wikiMode !== 'dev') setWikiMode('dev');
    setWikiFrameSrc(resolveWikiFrameUrl(useDev ? 'dev' : 'static', path));
  };

  const goStaticPath = (path) => {
    setWikiMode('static');
    setWikiFrameSrc(wikiStaticFrameUrl(path));
  };

  useEffect(() => {
    let cancelled = false;
    setAdminApi((prev) => ({ ...prev, status: 'checking' }));
    fetchWikiAdminConfig()
      .then((cfg) => {
        if (cancelled) return;
        setAdminApi({
          status: 'connected',
          llmConfigured: Boolean(cfg.llmConfigured),
          protectMode: Boolean(cfg.protectMode),
        });
        if (localDevServer) {
          setWikiMode('dev');
          setWikiFrameSrc(wikiDevFrameUrl(WIKI_DEV_PATH_HOME));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAdminApi({
            status: 'offline',
            error: err instanceof Error ? err.message : '연결 실패',
          });
          setWikiMode('static');
          setWikiFrameSrc(wikiStaticFrameUrl('/'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [adminCheckGen, localDevServer]);

  useEffect(() => {
    if (!canUseLocalDev && wikiMode === 'dev') {
      setWikiMode('static');
      setWikiFrameSrc(wikiStaticFrameUrl('/'));
    }
  }, [canUseLocalDev, wikiMode]);

  const apiBadge =
    adminApi.status === 'connected' ? (
      <span className="wiki-api-badge wiki-api-badge--ok">편집 API 연결됨</span>
    ) : adminApi.status === 'checking' ? (
      <span className="wiki-api-badge">API 확인 중…</span>
    ) : (
      <span className="wiki-api-badge wiki-api-badge--off">편집 API 없음</span>
    );

  return (
    <section className="module-embed">
      <div className="module-embed__bar module-link-bar wiki-embed-bar">
        <div className="wiki-embed-bar__meta">
          <p className="hint module-link-bar__hint" style={{ margin: 0 }}>
            {localDevServer ? (
              <>
                <strong>{wikiMode === 'dev' ? '편집(Wiki dev)' : '읽기(정적)'}</strong> · API{' '}
                <code>{WIKI_DEV_API_DEFAULT_URL}</code>
              </>
            ) : (
              <>
                <strong>읽기·편집</strong> — 포털 정적 Wiki + 관리 API
                {adminConnected ? ' (GitHub 저장)' : ''}. 저장 후 읽기 갱신:{' '}
                <code>npm run wiki:sync</code> · 배포
              </>
            )}
          </p>
          {apiBadge}
          {adminConnected ? (
            <p className="wiki-embed-bar__detail hint">
              주제 등록·편집은 아래 Wiki 화면 <strong>/admin</strong> 메뉴 또는 바로가기
              {adminApi.llmConfigured ? ' · 자연어(Gemini)' : localDevServer ? ' · 자연어=Wiki dev' : ''}
              {adminApi.protectMode ? ' · 보호 모드' : ''}
            </p>
          ) : null}
          {localDevServer ? (
            <div className="wiki-mode-toggle" role="group" aria-label="Wiki 표시 모드">
              <button
                type="button"
                className={`wiki-mode-btn${wikiMode === 'static' ? ' is-active' : ''}`}
                onClick={() => {
                  setWikiMode('static');
                  setWikiFrameSrc(wikiStaticFrameUrl('/'));
                }}
              >
                읽기(정적)
              </button>
              <button
                type="button"
                className={`wiki-mode-btn${wikiMode === 'dev' ? ' is-active' : ''}`}
                disabled={!canUseLocalDev}
                title={canUseLocalDev ? undefined : 'Wiki dev(5174) 실행 후 사용'}
                onClick={() => {
                  setWikiMode('dev');
                  setWikiFrameSrc(wikiDevFrameUrl(WIKI_DEV_PATH_HOME));
                }}
              >
                편집(Wiki dev)
              </button>
            </div>
          ) : null}
        </div>
        <div className="module-link-bar__actions">
          <button type="button" className="btn-ghost" onClick={onGoHome}>
            ← 포털 홈
          </button>
          <button type="button" className="btn-ghost" onClick={() => goStaticPath('/')}>
            Wiki 홈
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={!adminConnected}
            onClick={() =>
              localDevServer
                ? openWikiPath(WIKI_DEV_PATH_REGISTER_NL, true)
                : goStaticPath('/admin/topics/register/nl')
            }
          >
            주제 등록(자연어)
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={!adminConnected}
            onClick={() =>
              localDevServer
                ? openWikiPath(WIKI_DEV_PATH_REGISTER_NEW, true)
                : goStaticPath('/admin/topics/register/new')
            }
          >
            주제 등록(수동)
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={!adminConnected}
            onClick={() =>
              localDevServer
                ? openWikiPath(WIKI_DEV_PATH_ADMIN_TOPICS, true)
                : goStaticPath('/admin/topics')
            }
          >
            주제 목록
          </button>
          {adminApi.status !== 'connected' ? (
            <button type="button" className="btn-ghost" onClick={() => setAdminCheckGen((n) => n + 1)}>
              연결 다시 확인
            </button>
          ) : null}
          <a className="btn-primary" href={wikiFrameSrc} target="_blank" rel="noopener noreferrer">
            전체 화면
          </a>
        </div>
      </div>
      {adminApi.status === 'offline' ? (
        <div className="wiki-api-setup" role="status">
          <p>
            <strong>편집 API</strong>가 필요합니다. 운영(Vercel):{' '}
            <code>GITHUB_TOKEN</code> + <code>WIKI_ADMIN_PIN</code> · 로컬: Wiki dev 5174.{' '}
            <code>docs/ai-synapse-wiki-improve.md</code>
          </p>
          {localDevServer ? (
            <ol>
              <li>
                Wiki: <code>{WIKI_DEV_SETUP_COMMANDS.wiki}</code>
              </li>
              <li>
                Wiki <code>.env</code>: <code>VITE_ADMIN_ENABLED=true</code>
              </li>
              <li>
                확인: <code>{WIKI_DEV_SETUP_COMMANDS.check}</code>
              </li>
              <li>
                포털: <code>{WIKI_DEV_SETUP_COMMANDS.portal}</code> → 연결 다시 확인
              </li>
            </ol>
          ) : (
            <ol>
              <li>
                Vercel 환경 변수: <code>GITHUB_TOKEN</code>(repo 쓰기), <code>WIKI_ADMIN_PIN</code>
              </li>
              <li>또는 <code>WIKI_ADMIN_API_URL</code>에 Wiki dev 서버 URL</li>
              <li>연결 다시 확인 → 주제 등록</li>
              <li>
                읽기 반영: <code>{WIKI_DEV_SETUP_COMMANDS.sync}</code> 후 배포
              </li>
            </ol>
          )}
          {adminApi.error ? <p className="wiki-api-setup__err">마지막 확인: {adminApi.error}</p> : null}
        </div>
      ) : null}
      <ToolFrame
        className="module-embed__frame"
        src={wikiFrameSrc}
        title="AI-Synapse Wiki"
        loading="lazy"
      />
    </section>
  );
}

function GeminiTunerModule({ onGoHome }) {
  const external = findNavItem('gemini-tuner');

  return (
    <section className="module-embed">
      <div className="module-embed__bar module-link-bar">
        <p className="hint module-link-bar__hint" style={{ margin: 0 }}>
          <strong>FinOps 패널·스파클·한도 위젯</strong> 웹 데모입니다. gemini.google.com에서의 실제
          사용은{' '}
          <a href={GEMINI_TUNER_REPO_URL} target="_blank" rel="noopener noreferrer">
            Chrome 확장
          </a>
          이고, 데모 설정은 <strong>로그인한 계정의 Supabase</strong>에 저장됩니다.
        </p>
        <div className="module-link-bar__actions">
          <button type="button" className="btn-ghost" onClick={onGoHome}>
            ← 포털 홈
          </button>
          <a
            className="btn-ghost"
            href={GEMINI_TUNER_GITHUB_PAGES_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Pages 소개
          </a>
          {external?.externalUrl ? (
            <a className="btn-ghost" href={external.externalUrl} target="_blank" rel="noopener noreferrer">
              {external.externalLabel || 'Chrome 확장'}
            </a>
          ) : null}
          <a
            className="btn-primary"
            href={GEMINI_TUNER_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            전체 화면으로 열기
          </a>
        </div>
      </div>
      <ToolFrame
        className="module-embed__frame"
        src={GEMINI_TUNER_APP_URL}
        title="GeminiTuner"
        loading="lazy"
      />
    </section>
  );
}

function MarathonLogModule({ onGoHome }) {
  return (
    <section className="module-embed">
      <div className="module-embed__bar module-link-bar">
        <p className="hint module-link-bar__hint" style={{ margin: 0 }}>
          포털 홈과 연결 · 대회 기록·PB·통계는 <strong>로그인한 계정의 Supabase</strong>에 저장됩니다.
          예전{' '}
          <a href="https://cxr542.github.io/cxr542-ai/projects/marathon-log/" target="_blank" rel="noopener noreferrer">
            GitHub Pages
          </a>{' '}
          데이터는 기록장 안 <strong>JSON 가져오기</strong>로 1회 이전하세요.
        </p>
        <div className="module-link-bar__actions">
          <button type="button" className="btn-ghost" onClick={onGoHome}>
            ← 포털 홈
          </button>
          <a className="btn-primary" href={MARATHON_LOG_APP_URL} target="_blank" rel="noopener noreferrer">
            전체 화면으로 열기
          </a>
        </div>
      </div>
      <ToolFrame
        className="module-embed__frame"
        src={MARATHON_LOG_APP_URL}
        title="마라톤 기록장"
        loading="lazy"
      />
    </section>
  );
}

function IdeaBankModule({ onGoHome }) {
  return (
    <section className="module-embed">
      <div className="module-embed__bar module-link-bar">
        <p className="hint module-link-bar__hint" style={{ margin: 0 }}>
          포털 홈과 연결 · 아이디어·JSON은 <strong>로그인한 계정의 Supabase</strong>에 저장됩니다.
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
      <ToolFrame
        className="module-embed__frame"
        src={IDEA_BANK_APP_URL}
        title="idea-bank 아이디어 노트"
        loading="lazy"
      />
    </section>
  );
}

function PromptCollectionModule({ onGoHome }) {
  return (
    <section className="module-embed">
      <div className="module-embed__bar module-link-bar">
        <p className="hint module-link-bar__hint" style={{ margin: 0 }}>
          Google Keep에 두던 프롬프트를 <strong>제목·본문</strong>으로 정리합니다.
          데이터는 <strong>로그인한 계정의 Supabase</strong>에 저장되며, JSON 보내기로 백업할 수 있습니다.
        </p>
        <div className="module-link-bar__actions">
          <button type="button" className="btn-ghost" onClick={onGoHome}>
            ← 포털 홈
          </button>
          <a
            className="btn-primary"
            href={PROMPT_COLLECTION_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            전체 화면으로 열기
          </a>
        </div>
      </div>
      <ToolFrame
        className="module-embed__frame"
        src={PROMPT_COLLECTION_APP_URL}
        title="프롬프트 모음"
        loading="lazy"
      />
    </section>
  );
}

function HowManyPointsModule({ onGoHome }) {
  return (
    <section className="module-embed">
      <div className="module-embed__bar module-link-bar">
        <p className="hint module-link-bar__hint" style={{ margin: 0 }}>
          왓챠피디아처럼 <strong>영화·시리즈·책·웹툰</strong> 평점을 모읍니다.
          공식 API는 없어 <strong>가져오기</strong>에서 커뮤니티 CSV 스크립트 안내를 따르세요.
        </p>
        <div className="module-link-bar__actions">
          <button type="button" className="btn-ghost" onClick={onGoHome}>
            ← 포털 홈
          </button>
          <a
            className="btn-primary"
            href={HOW_MANY_POINTS_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            전체 화면으로 열기
          </a>
        </div>
      </div>
      <ToolFrame
        className="module-embed__frame"
        src={HOW_MANY_POINTS_APP_URL}
        title="너는몇점?"
        loading="lazy"
      />
    </section>
  );
}

function WhoAreYouModule({ onGoHome }) {
  return (
    <section className="module-embed">
      <div className="module-embed__bar module-link-bar">
        <p className="hint module-link-bar__hint" style={{ margin: 0 }}>
          <strong>자기소개서·근무·기술·학력</strong>을 career.sw.or.kr 항목 구조로 정리합니다.
          한글 원고는 <strong>가져오기</strong>에서 <code>## 항목</code> 붙여넣기 또는 JSON으로 옮길 수 있습니다.
        </p>
        <div className="module-link-bar__actions">
          <button type="button" className="btn-ghost" onClick={onGoHome}>
            ← 포털 홈
          </button>
          <a
            className="btn-primary"
            href={WHO_ARE_YOU_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            전체 화면으로 열기
          </a>
        </div>
      </div>
      <ToolFrame
        className="module-embed__frame"
        src={WHO_ARE_YOU_APP_URL}
        title="나는누구?"
        loading="lazy"
      />
    </section>
  );
}

function App() {
  const renderModule = (active, onGoHome) => {
    if (active === RELEASE_NOTES_MODULE_ID) return <ReleaseNotesPanel onGoHome={onGoHome} />;
    const components = {'vision-font':VisionFontModule,'today-shoes':TodayShoesModule,marathon:MarathonLogModule,'idea-bank':IdeaBankModule,'prompt-collection':PromptCollectionModule,'how-many-points':HowManyPointsModule,'who-are-you':WhoAreYouModule,'ai-synapse-wiki':AiSynapseWikiModule,'gemini-tuner':GeminiTunerModule};
    const Module = components[active];
    return Module ? <Module onGoHome={onGoHome}/> : null;
  };
  return <Workspace renderModule={renderModule}/>;
}
export default App;
