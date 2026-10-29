# 개인용 아이디·비밀번호 로그인

포털은 회원가입 없이 하나의 계정만 사용한다. 아이디는 서버의 PORTAL_LOGIN_ID,
Supabase Auth 계정은 PORTAL_ACCOUNT_EMAIL / PORTAL_OWNER_USER_ID로 연결한다.
비밀번호는 Supabase Auth에서 검증하며 소스·Vercel 환경변수에 비밀번호를 넣지 않는다.

## 최초 계정 준비 — 사용자가 직접 수행

1. Supabase home → Authentication → Users → Add user → Create new user.
2. 내부 계정 이메일은 `portal-owner@cxr542.invalid`로 입력한다.
3. 사용할 비밀번호는 관리 화면에서 직접 입력한다. 채팅이나 소스에 기록하지 않는다.
4. Auto Confirm User를 선택하고 계정을 생성한다. 이메일 수신이나 확인 링크를 사용하지 않는다.
5. 생성된 User UID를 해당 포털의 유일한 소유자로 설정한다.

home의 기존 다른 앱 사용자·가입 설정은 변경하지 않는다. 공개 회원가입을 숨기는 것에 더해,
portal_account 테이블의 단일 소유자 UUID를 portal_documents RLS에서도 검사한다.
다른 Auth 계정이 직접 Supabase에 로그인해도 포털 문서를 읽거나 쓸 수 없다.

## 서버 설정

- PORTAL_LOGIN_ID: 사용할 아이디
- PORTAL_ACCOUNT_EMAIL: 위 내부 계정 이메일
- PORTAL_OWNER_USER_ID: 위 계정의 Supabase Auth UUID

기존 Supabase 공개 URL·publishable key를 사용한다. privileged/service_role 키가 필요하지 않다.
클라이언트는 같은 origin의 POST /api/portal-login으로 입력을 전달하고, 검증된 Supabase 세션을
받아 기존 RLS 기반 저장소에 연결한다. 로그인 응답은 no-store이며 내부 이메일은 노출하지 않는다.
서버 설정이 없거나 소유자 UUID가 맞지 않으면 로그인은 거부된다.

## DB 적용

supabase/portal-single-account.sql은 한 번 적용한다. portal_account의 쓰기 권한은
브라우저에 주지 않는다. 관리자만 계정 UUID를 등록한다. 단일 행 제약으로 두 번째
소유자를 만들 수 없다. 기존 portal_documents 데이터는 삭제하거나 다른 사용자에게 이전하지 않는다.

## 복구

비밀번호를 잊으면 Supabase Dashboard에서 해당 계정의 비밀번호를 재설정한다.
계정 UUID를 바꾸면 기존 데이터의 소유권은 자동으로 옮겨지지 않으므로 임의로 계정을 재생성하지 않는다.
