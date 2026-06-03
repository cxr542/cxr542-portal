# AI-Synapse Wiki 개선 가이드

포털(`/ai-synapse-wiki/`)과 [AI-Synapse-Wiki](https://github.com/cxr542/AI-Synapse-Wiki) 저장소를 함께 다루는 순서입니다.

## 현재 구조 (이해)

| 레이어 | 역할 | 한계 |
|--------|------|------|
| **포털 정적 빌드** | `public/ai-synapse-wiki/` — 읽기·검색·Synapse UI · 관리 화면 | `VITE_ADMIN_ENABLED=true` 로 빌드(`wiki:sync`) |
| **포털 운영 API** | `api/admin/*` — GitHub Contents API | Vercel `GITHUB_TOKEN` + `WIKI_ADMIN_PIN` |
| **Wiki Vite dev** | `scripts/vite-admin-api.mjs` — 등록·편집·삭제 | 포트 **5174** 권장 |
| **포털 dev 프록시** | `5173`의 `/api/admin` → `5174` | Wiki dev가 떠 있어야 함 |

운영에서도 포털 **AI-Synapse Wiki** 모듈에서 주제 등록·편집 가능(저장소에 커밋). **검색·홈 목록** 반영은 `wiki:sync` 후 배포가 필요합니다.

---

## 1단계 — 지금 바로 (주제 등록·편집)

```bash
# 터미널 1 — Wiki
cd AI-Synapse-Wiki   # 또는 cxr542-portal/.cache/AI-Synapse-Wiki
npm install
copy .env.example .env   # Windows (없을 때)
# .env 에 VITE_ADMIN_ENABLED=true 필수 — 없으면 「관리 비활성화」만 보임
$env:VITE_BASE="/ai-synapse-wiki/"
npm run dev -- --port 5174 --host localhost

# 터미널 2 — 포털
cd cxr542-portal
npm run dev
```

포털 → **AI-Synapse Wiki** → **연결 다시 확인** → **편집(Wiki dev)** → 주제 등록.

- 관리 PIN 기본값: `1234` (`.env`의 `VITE_ADMIN_PIN`, 비우면 PIN 없음)
- 자연어 초안: `WIKI_TOPIC_LLM_API_KEY` (Gemini) — [docs/WIKI-REGISTER.md](https://github.com/cxr542/AI-Synapse-Wiki/blob/main/docs/WIKI-REGISTER.md)

연결 확인만 할 때:

```bash
npm run wiki:check
```

---

## 2단계 — 읽기용 정적 빌드 갱신

포털에 넣은 빌드가 오래되면 주제·검색이 빈약합니다.

```bash
cd cxr542-portal
npm run wiki:sync
```

- 저장소: [github.com/cxr542/AI-Synapse-Wiki](https://github.com/cxr542/AI-Synapse-Wiki) — 없으면 `.cache/AI-Synapse-Wiki`에 자동 클론·pull
- `VITE_BASE=/ai-synapse-wiki/`로 `vite build` 후 `public/ai-synapse-wiki/` 복사
- 반영 버전은 `public/ai-synapse-wiki/SYNC.txt` 참고
- upstream `npm run build`는 tsc 오류가 있어 sync는 `vite build`만 사용 (포털 배포용)

다른 경로의 클론을 쓰려면: `set WIKI_ROOT=C:\path\to\AI-Synapse-Wiki` 후 `npm run wiki:sync`

---

## 3단계 — Wiki 본체 품질 (저장소)

| 목표 | 작업 |
|------|------|
| 새 주제·Synapse | `docs/topics/*.md` 편집 → `npm run build:entries` (dev/build 시 자동) |
| 수집 파이프라인 | [Ai-Synapse](https://github.com/cxr542/Ai-Synapse) 연동 — SETUP.md |
| 테스트·린트 | `npm test`, `npm run lint` |
| Hermes 알림 | `npm run notify` |
| 사용자/관리 분리 | [PLAN-USER-ADMIN.md](https://github.com/cxr542/AI-Synapse-Wiki/blob/main/docs/PLAN-USER-ADMIN.md) |

---

## 4단계 — 포털 UX (이 저장소)

- [x] 관리 API 상태 배지·연결 다시 확인
- [x] 정적 / Wiki dev iframe 모드 전환
- [x] `wiki:check`, `wiki:sync` 스크립트
- [ ] (선택) 운영 MVP에 최근 동기화 일자 표시
- [ ] (선택) PR Preview에서도 Wiki dev URL 안내

---

## 5단계 — 배포·운영

### Vercel 환경 변수 (편집 API)

| 변수 | 용도 |
|------|------|
| `GITHUB_TOKEN` | `cxr542/AI-Synapse-Wiki` 쓰기 (fine-grained: Contents R/W) |
| `WIKI_ADMIN_PIN` | Wiki 관리 화면 PIN (`x-wiki-admin-pin` 헤더) |
| `WIKI_GITHUB_REPO` | (선택) 기본 `cxr542/AI-Synapse-Wiki` |
| `WIKI_ADMIN_API_URL` | (선택) 자체 Wiki dev URL — 설정 시 GitHub 대신 프록시 |

### 배포 순서

1. `npm run wiki:sync` (`VITE_ADMIN_ENABLED=true` 포함 빌드)
2. `npm test` · `npm run build`
3. main 머지 → Vercel production
4. 포털 → Wiki → **연결 다시 확인** → 주제 등록
5. 주제 저장 후 읽기 목록 갱신: 다시 `wiki:sync` + 배포

---

## 자주 하는 실수

| 증상 | 원인 | 해결 |
|------|------|------|
| 주제 등록 API 없음 | Wiki dev 미기동 | 5174에서 `npm run dev` |
| 프록시 실패 | 포트 불일치 | `WIKI_DEV_API_URL=http://127.0.0.1:5174 npm run dev` |
| 등록 버튼 눌러도 저장 안 됨 | 정적 모드 iframe | **편집(Wiki dev)** 모드로 전환 |
| 5173 충돌 | Wiki·포털 동시 기본 포트 | Wiki만 `--port 5174` |
| 검색에 새 주제 없음 | 정적 빌드 미갱신 | `npm run wiki:sync` |

---

## 관련 파일

- `src/utils/aiSynapseWikiDev.js` — URL·API 헬퍼
- `vite.config.js` — `/api/admin` 프록시
- `public/ai-synapse-wiki/` — 정적 SPA
- `docs/module-specs.md` — 모듈 요약
