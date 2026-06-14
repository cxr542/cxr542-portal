import { useEffect, useState } from 'react';
import './App.css';
import EnvironmentBadge from './components/EnvironmentBadge';
import NavLabelsModal from './components/NavLabelsModal';
import NavOrderModal from './components/NavOrderModal';
import PortalSidebar from './components/PortalSidebar';
import ReleaseNotesPanel from './components/ReleaseNotesPanel';
import {
  PORTAL_NAV_ITEMS,
  RELEASE_NOTES_MODULE_ID,
  SIDEBAR_COLLAPSED_KEY,
  isRoutableModuleId,
} from './constants/portalNav';
import { RELEASE_NOTES_LABEL, latestReleaseVersion } from './constants/releaseNotes';
import { useNavLabels } from './hooks/useNavLabels';
import { useNavOrder } from './hooks/useNavOrder';
import { getWorkspaceUrl } from './constants/workspaceUrl';
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

const IDEA_BANK_APP_URL = '/idea-bank/index.html';
const PROMPT_COLLECTION_APP_URL = '/prompt-collection/index.html';
const HOW_MANY_POINTS_APP_URL = '/how-many-points/index.html';
const WHO_ARE_YOU_APP_URL = '/who-are-you/index.html';
const MARATHON_LOG_APP_URL = '/marathon-log/index.html';

const PROJECT_BOARD_SECTIONS = [
  {
    key: 'active',
    title: 'Active Projects',
    description: '현재 진행 중인 개인 프로젝트를 바로 엽니다.',
    ids: ['who-are-you', 'vision-font', 'today-shoes', 'ai-synapse-wiki'],
  },
  {
    key: 'experiments',
    title: 'Experiments',
    description: '실험 중인 도구와 후보 프로젝트를 모아둡니다.',
    ids: ['marathon', 'idea-bank', 'prompt-collection', 'gemini-tuner'],
  },
  {
    key: 'paused',
    title: 'Paused',
    description: '잠시 멈춘 프로젝트는 유지 여부를 따로 검토합니다.',
    ids: ['how-many-points'],
  },
  {
    key: 'ideas',
    title: 'Ideas',
    description: '아직 구현 전인 개인 프로젝트 후보를 정리합니다.',
    ids: [],
  },
];

const IDEAS_PLACEHOLDER_CARD = {
  id: 'ideas-placeholder',
  icon: '💭',
  defaultLabel: 'Ideas',
  boardStatus: 'Ideas',
  boardDescription: '아직 구현 전인 개인 프로젝트 후보를 모아둘 예정입니다.',
  boardNextAction: '신규 아이디어 입력 방식을 정합니다.',
  boardSection: 'ideas',
  isPlaceholder: true,
};

const PORTAL_FONT_SCALE_KEY = 'cxr542-portal-font-scale';
const FONT_SCALE_OPTIONS = new Set(['small', 'normal', 'large']);
const FONT_SCALE_VALUES = {
  small: '93.75%',
  normal: '100%',
  large: '112.5%',
};

function readFontScale() {
  try {
    const saved = localStorage.getItem(PORTAL_FONT_SCALE_KEY);
    return FONT_SCALE_OPTIONS.has(saved) ? saved : 'normal';
  } catch {
    return 'normal';
  }
}

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function findNavItem(id) {
  return PORTAL_NAV_ITEMS.find((item) => item.id === id);
}

function moduleHasEmbed(id) {
  return Boolean(findNavItem(id)?.embedPath);
}

function getProjectBoardItems(navItems) {
  const itemsById = new Map(navItems.filter((item) => item.id !== 'home').map((item) => [item.id, item]));
  return PROJECT_BOARD_SECTIONS.map((section) => ({
    ...section,
    items: section.ids
      .map((id) => itemsById.get(id))
      .filter(Boolean),
  }));
}

function readModuleFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('m');
  if (fromQuery && isRoutableModuleId(fromQuery) && fromQuery !== 'home') return fromQuery;
  const fromHash = window.location.hash.replace(/^#\/?/, '');
  if (fromHash && isRoutableModuleId(fromHash) && fromHash !== 'home') return fromHash;
  return 'home';
}

function HomeModule({ onOpenModule, labels, navItems }) {
  const boardSections = getProjectBoardItems(navItems);
  const totalCards = boardSections.reduce((sum, section) => sum + section.items.length, 0) + 1;
  const activeCount = boardSections.find((section) => section.key === 'active')?.items.length || 0;
  const experimentCount = boardSections.find((section) => section.key === 'experiments')?.items.length || 0;
  const pausedCount = boardSections.find((section) => section.key === 'paused')?.items.length || 0;
  const ideaCount = 1;

  return (
    <section className="home-module" aria-labelledby="portal-home-title">
      <div className="home-hero">
        <div className="home-hero__copy">
          <span className="home-eyebrow">Personal project portal</span>
          <h2 id="portal-home-title">cxr542-ai-portal</h2>
          <p>
            개인 프로젝트를 상태별로 분류해 한 화면에서 정리합니다.
            자주 쓰는 모듈은 왼쪽 메뉴에서 순서와 이름을 바꿀 수 있습니다.
          </p>
        </div>
        <dl className="home-metrics" aria-label="포털 구성 요약">
          <div>
            <dt>{totalCards}</dt>
            <dd>프로젝트 카드</dd>
          </div>
          <div>
            <dt>{activeCount}</dt>
            <dd>Active Projects</dd>
          </div>
          <div>
            <dt>{experimentCount}</dt>
            <dd>Experiments</dd>
          </div>
          <div>
            <dt>{pausedCount + ideaCount}</dt>
            <dd>Paused + Ideas</dd>
          </div>
        </dl>
      </div>

      {boardSections.map((section) => (
        <section
          key={section.key}
          className={`board-section board-section--${section.key}`}
          aria-labelledby={`board-${section.key}`}
        >
          <div className="board-section__head">
            <div>
              <div className="home-eyebrow home-eyebrow--section">{section.title}</div>
              <h3 id={`board-${section.key}`}>{section.title}</h3>
              <p>{section.description}</p>
            </div>
            <span className={`board-badge board-badge--${section.key}`}>{section.title}</span>
          </div>

          <div className={`board-grid board-grid--${section.key}`}>
            {section.items.length > 0 ? (
              section.items.map((item) => (
                <article key={item.id} className={`project-card project-card--${item.id}`}>
                  <div className="project-card__top">
                    <div className="project-card__icon" aria-hidden="true">
                      {item.icon}
                    </div>
                    <div className="project-card__meta">
                      <span className="project-card__status">{item.boardStatus || 'Active'}</span>
                      <h4>{labels[item.id] || item.defaultLabel}</h4>
                      <p>{item.boardDescription}</p>
                    </div>
                  </div>
                  <div className="project-card__bottom">
                    <div className="project-card__next">
                      <span>Next</span>
                      <strong>{item.boardNextAction}</strong>
                    </div>
                    <div className="project-card__actions">
                      <button type="button" className="project-card__open" onClick={() => onOpenModule(item.id)}>
                        {item.homeCta || '열기 →'}
                      </button>
                      {item.externalUrl ? (
                        <a
                          href={item.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="project-card__external"
                        >
                          {item.externalLabel || '외부 링크'}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <article className="project-card project-card--placeholder">
                <div className="project-card__top">
                  <div className="project-card__icon" aria-hidden="true">
                    {IDEAS_PLACEHOLDER_CARD.icon}
                  </div>
                  <div className="project-card__meta">
                    <span className="project-card__status">{IDEAS_PLACEHOLDER_CARD.boardStatus}</span>
                    <h4>{IDEAS_PLACEHOLDER_CARD.defaultLabel}</h4>
                    <p>{IDEAS_PLACEHOLDER_CARD.boardDescription}</p>
                  </div>
                </div>
                <div className="project-card__bottom">
                  <div className="project-card__next">
                    <span>Next</span>
                    <strong>{IDEAS_PLACEHOLDER_CARD.boardNextAction}</strong>
                  </div>
                  <div className="project-card__actions">
                    <button type="button" className="project-card__open project-card__open--disabled" disabled>
                      준비 중
                    </button>
                  </div>
                </div>
              </article>
            )}
          </div>
        </section>
      ))}
    </section>
  );
}

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
      <iframe
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
      <iframe
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
      <iframe
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
          이고, 데모 설정은 <strong>이 포털 도메인</strong> localStorage에 저장됩니다.
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
      <iframe
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
          포털 홈과 연결 · 대회 기록·PB·통계는 <strong>이 포털 도메인</strong>에 저장됩니다.
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
      <iframe
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
          데이터는 <strong>이 포털 도메인</strong> 브라우저 저장소에만 있으며, JSON 보내기로 백업하세요.
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
      <iframe
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
      <iframe
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
      <iframe
        className="module-embed__frame"
        src={WHO_ARE_YOU_APP_URL}
        title="나는누구?"
        loading="lazy"
      />
    </section>
  );
}

function ModuleContent({ active, onOpenModule, onGoHome, labels, navItems }) {
  if (active === RELEASE_NOTES_MODULE_ID) return <ReleaseNotesPanel onGoHome={onGoHome} />;
  if (active === 'vision-font') return <VisionFontModule onGoHome={onGoHome} />;
  if (active === 'today-shoes') return <TodayShoesModule onGoHome={onGoHome} />;
  if (active === 'marathon') return <MarathonLogModule onGoHome={onGoHome} />;
  if (active === 'idea-bank') return <IdeaBankModule onGoHome={onGoHome} />;
  if (active === 'prompt-collection') return <PromptCollectionModule onGoHome={onGoHome} />;
  if (active === 'how-many-points') return <HowManyPointsModule onGoHome={onGoHome} />;
  if (active === 'who-are-you') return <WhoAreYouModule onGoHome={onGoHome} />;
  if (active === 'ai-synapse-wiki') return <AiSynapseWikiModule onGoHome={onGoHome} />;
  if (active === 'gemini-tuner') return <GeminiTunerModule onGoHome={onGoHome} />;
  return <HomeModule onOpenModule={onOpenModule} labels={labels} navItems={navItems} />;
}

function App() {
  const [activeModule, setActiveModule] = useState(readModuleFromUrl);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [fontScale, setFontScale] = useState(readFontScale);
  const [navLabelsOpen, setNavLabelsOpen] = useState(false);
  const [navOrderOpen, setNavOrderOpen] = useState(false);
  const { labels, updateLabels, resetLabels, defaults } = useNavLabels();
  const { navItems, order, setOrder, resetOrder } = useNavOrder();

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(PORTAL_FONT_SCALE_KEY, fontScale);
    } catch {
      /* ignore */
    }
    document.documentElement.style.fontSize =
      FONT_SCALE_VALUES[fontScale] || FONT_SCALE_VALUES.normal;
  }, [fontScale]);

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
  const activeTitle =
    activeModule === RELEASE_NOTES_MODULE_ID
      ? RELEASE_NOTES_LABEL
      : labels[activeModule] || findNavItem(activeModule)?.defaultLabel;
  const workspaceUrl = getWorkspaceUrl();

  return (
    <div className={`portal-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <PortalSidebar
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        navItems={navItems}
        labels={labels}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        fontScale={fontScale}
        onFontScaleChange={setFontScale}
        onOpenNavLabels={() => setNavLabelsOpen(true)}
        onOpenNavOrder={() => setNavOrderOpen(true)}
      />
      <main className={`content${moduleHasEmbed(activeModule) ? ' content--embed' : ''}`}>
        <header className="content-header">
          <div className="content-header__start">
            <a className="btn-workspace" href={workspaceUrl} title="cxr542 Workspace 랜딩">
              ← Workspace
            </a>
            <h2>{activeTitle}</h2>
          </div>
          <div className="content-header__meta">
            <EnvironmentBadge className="portal-env-badge--header" compact />
            <span className="content-header__version">v{latestReleaseVersion()}</span>
          </div>
        </header>
        <ModuleContent
          active={activeModule}
          onOpenModule={setActiveModule}
          onGoHome={goHome}
          labels={labels}
          navItems={navItems}
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
      <NavOrderModal
        isOpen={navOrderOpen}
        onClose={() => setNavOrderOpen(false)}
        order={order}
        labels={labels}
        defaults={defaults}
        onSave={setOrder}
        onReset={resetOrder}
      />
    </div>
  );
}

export default App;
