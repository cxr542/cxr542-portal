# 실제 로컬 Supabase 검증

2026-10-28, Supabase CLI 2.122.0과 Docker로 별도 프로젝트 `cxr542-prompts-native-20261028`를 실행했습니다. 기존 클라우드 home/office 프로젝트와 다른 Docker 프로젝트는 수정하지 않았습니다. 클라우드 리소스 생성 비용은 0이며 로컬 디스크·메모리를 사용합니다.

## 재실행

이 worktree의 무시된 `.cache/supabase-native/supabase/config.toml`에 격리 설정이 있습니다. API 56421, DB 56422를 사용하고 전용 Docker network `cxr542-prompts-native`의 기본 바인딩은 127.0.0.1입니다. seed, Storage, Realtime, Studio, SMTP, Edge Runtime, Analytics는 비활성화했습니다. 루트 auth.enable_signup=false로 공개 가입을 막고 auth.email.enable_signup=true로 이메일 로그인 공급자를 켰습니다. 테스트 계정만 로컬 관리자 API로 생성·확인합니다. 운영 데이터는 복사하지 않았습니다.

```sh
npx --yes supabase@2.122.0 start --workdir .cache/supabase-native --network-id cxr542-prompts-native --exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
umask 077
npx --yes supabase@2.122.0 status --workdir .cache/supabase-native -o json > .cache/supabase-native/status.json
node scripts/check-prompts-native.mjs
```

최초 구성에서는 저장소의 SQL 파일만 해당 로컬 프로젝트의 supabase/migrations로 복사했습니다. 재실행은 새 임의 계정을 만들므로 다른 실행의 데이터에 의존하지 않습니다. 이 명령은 이미 구성한 전용 로컬 환경의 재실행 절차입니다. 새 머신에서 실행하려면 동일한 포트·전용 네트워크·비활성화 설정을 먼저 구성해야 합니다.

status.json, accounts.json과 CLI 로그에는 로컬 자격 증명이 포함될 수 있으므로 공유하거나 커밋하지 않습니다. 서버 검증에는 publishable key와 실제 사용자 토큰을 사용합니다. 로컬 service-role key는 검증 스크립트의 테스트 계정 생성에만 사용하고 브라우저에 전달하지 않습니다.

## 결과

9/9 통과. `.cache/supabase-native/results.json`에 비밀정보 없는 시나리오별 결과가 있습니다. 실제 Auth HTTP 요청과 PostgREST RPC를 사용하며 PostgreSQL 동시 트랜잭션 및 RLS를 실행했습니다. 만료 검사는 로컬 서명키로 만든 유효 서명 토큰의 수락을 먼저 확인하고 동일 서명의 만료 토큰 거절을 검사합니다.

클라우드 Preview, 실제 iPhone Safari, GPT Actions OAuth/PKCE 파일럿은 이 결과에 포함되지 않습니다. 로컬 서비스를 공개 터널로 노출하지 않습니다. 운영 DB 적용과 Production 배포는 별도 승인 대상입니다.

검토 후 전용 스택만 중지하려면 다음 명령을 사용합니다. 로컬 백업을 남기며 다른 프로젝트를 중지하지 않습니다.

```sh
npx --yes supabase@2.122.0 stop --workdir .cache/supabase-native --project-id cxr542-prompts-native-20261028
```
