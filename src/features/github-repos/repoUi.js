// Shared UI constants and formatters (no JSX).

const ERROR_VIEWS = {
  session_required: { icon: '🔑', title: '포털에 다시 로그인해 주세요', hint: '로그인 세션이 만료되었거나 소유자 계정이 아닙니다.' },
  unauthorized: { icon: '🔒', title: 'GitHub 인증이 필요합니다', hint: 'GitHub 연결 토큰이 없거나 만료되었습니다. 포털 관리자가 토큰을 다시 등록하면 복구됩니다.' },
  forbidden: { icon: '⛔', title: '접근 권한이 없습니다', hint: '토큰에 이 저장소 목록을 읽을 권한이 없습니다. Private 저장소는 읽기 권한이 필요합니다.' },
  rate_limited: { icon: '⏳', title: 'GitHub 요청 한도에 도달했습니다', hint: '한도가 초기화되면 다시 불러올 수 있습니다.' },
  not_configured: { icon: '⚙', title: 'GitHub 연동 설정 전입니다', hint: '서버에 GitHub 연결이 아직 설정되지 않았습니다.' },
  network: { icon: '📡', title: 'GitHub에 연결하지 못했습니다', hint: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.' },
  invalid_response: { icon: '⚠', title: '응답을 해석하지 못했습니다', hint: '잠시 후 다시 시도해 주세요. 계속되면 관리자에게 알려 주세요.' },
  unknown: { icon: '⚠', title: '저장소 목록을 불러오지 못했습니다', hint: '잠시 후 다시 시도해 주세요.' },
};

export function formatClock(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export function errorView(code) {
  return ERROR_VIEWS[code] || ERROR_VIEWS.unknown;
}

export const DETAIL_TABS = ['개요', 'README', '메모'];

export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const REPO_STATUSES = ['개발 중', '운영 중', '운영 확인 필요', '실험', '검토', '보관 검토', '보관'];

const count = new Intl.NumberFormat('ko-KR');
const dateTime = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDateTime(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? dateTime.format(date) : '';
}
const visibilityLabels = { public: 'Public', private: 'Private', internal: 'Internal' };

export function formatCount(value) {
  return Number.isFinite(value) ? count.format(value) : '—';
}

export function visibilityLabel(value) {
  return visibilityLabels[value] ?? '—';
}
