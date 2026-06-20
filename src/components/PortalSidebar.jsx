import { useEffect, useState } from 'react';
import EnvironmentBadge from './EnvironmentBadge';
import { RELEASE_NOTES_LABEL, RELEASE_NOTES_MODULE_ID } from '../constants/releaseNotes';
import { getWorkspaceUrl } from '../constants/workspaceUrl';

export default function PortalSidebar({
  activeModule,
  onModuleChange,
  navItems,
  labels,
  onOpenNavLabels,
  onOpenNavOrder,
  collapsed,
  onCollapsedChange,
  fontScale,
  onFontScaleChange,
  favoriteIds,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onDocClick = () => setSettingsOpen(false);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [settingsOpen]);

  const navTooltipProps = (item) => {
    const text = item.tooltip || labels[item.id] || item.defaultLabel;
    return collapsed
      ? { 'data-nav-tooltip': text, 'aria-label': text }
      : { title: text };
  };

  const collapseLabel = collapsed ? '메뉴 펼치기' : '메뉴 접기';
  const workspaceUrl = getWorkspaceUrl();
  const favoritesById = new Map(navItems.map((item) => [item.id, item]));
  const favoriteItems = favoriteIds.map((id) => favoritesById.get(id)).filter(Boolean);

  return (
    <aside className="sidebar" id="portal-sidebar" aria-label="포털 메뉴">
      <div className="sidebar__head">
        <h1>
          <span className="sidebar__logo-icon" aria-hidden="true">
            🧭
          </span>
          <span className="sidebar__logo-text">cxr542</span>
        </h1>
        <div className="sidebar__env-row">
          <p className="sidebar__sub">개인 개발 포털</p>
          <EnvironmentBadge className="portal-env-badge--sidebar" compact />
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="주 메뉴">
        <section className="sidebar-favorites" aria-labelledby="sidebar-favorites-title">
          <span id="sidebar-favorites-title" className="sidebar-favorites__title">자주 쓰는 도구</span>
          {favoriteItems.length > 0 ? (
            favoriteItems.map((item) => {
              const label = labels[item.id] || item.defaultLabel;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-btn nav-btn--favorite${activeModule === item.id ? ' active' : ''}`}
                  onClick={() => onModuleChange(item.id)}
                  {...navTooltipProps(item)}
                >
                  <span className="nav-btn__icon" aria-hidden="true">{item.icon}</span>
                  <span className="nav-btn__label">{label}</span>
                </button>
              );
            })
          ) : (
            <p className="sidebar-favorites__empty">자주 쓰는 도구를 추가해보세요.</p>
          )}
        </section>
        {navItems.map((item) => {
          const label = labels[item.id] || item.defaultLabel;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-btn${activeModule === item.id ? ' active' : ''}`}
              onClick={() => onModuleChange(item.id)}
              {...navTooltipProps(item)}
            >
              <span className="nav-btn__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-btn__label">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar__bottom">
        <a
          className="nav-btn nav-btn--workspace"
          href={workspaceUrl}
          title="cxr542 Workspace 랜딩"
          {...navTooltipProps({
            id: 'workspace',
            icon: '↩',
            defaultLabel: '← Workspace',
            tooltip: 'Workspace 랜딩으로',
          })}
        >
          <span className="nav-btn__icon" aria-hidden="true">
            ↩
          </span>
          <span className="nav-btn__label">← Workspace</span>
        </a>
        <button
          type="button"
          className={`nav-btn nav-btn--utility${activeModule === RELEASE_NOTES_MODULE_ID ? ' active' : ''}`}
          onClick={() => onModuleChange(RELEASE_NOTES_MODULE_ID)}
          {...navTooltipProps({
            id: RELEASE_NOTES_MODULE_ID,
            icon: '📋',
            defaultLabel: RELEASE_NOTES_LABEL,
            tooltip: '포털·모듈 변경 이력',
          })}
        >
          <span className="nav-btn__icon" aria-hidden="true">
            📋
          </span>
          <span className="nav-btn__label">{RELEASE_NOTES_LABEL}</span>
        </button>

        <button
          type="button"
          className="nav-btn nav-btn--utility nav-btn--collapse"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls="portal-sidebar"
          {...navTooltipProps({
            id: 'collapse',
            icon: collapsed ? '📖' : '📕',
            defaultLabel: collapseLabel,
            tooltip: collapseLabel,
          })}
        >
          <span className="nav-btn__icon" aria-hidden="true">
            {collapsed ? '📖' : '📕'}
          </span>
          <span className="nav-btn__label">{collapseLabel}</span>
        </button>

        <div className="sidebar__settings-wrap">
          <button
            type="button"
            className={`nav-btn nav-btn--utility${settingsOpen ? ' is-open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen((open) => !open);
            }}
            {...navTooltipProps({
              id: 'settings',
              icon: '⚙️',
              defaultLabel: '설정',
              tooltip: '메뉴 이름·순서·글자 크기 설정',
            })}
            aria-expanded={settingsOpen}
            aria-haspopup="menu"
          >
            <span className="nav-btn__icon" aria-hidden="true">
              ⚙️
            </span>
            <span className="nav-btn__label">설정</span>
            <span className="nav-btn__caret" aria-hidden="true">
              ▾
            </span>
          </button>
          {settingsOpen && (
            <div
              className="sidebar__settings-popover"
              role="menu"
              aria-label="설정"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="sidebar__settings-item"
                role="menuitem"
                onClick={() => {
                  setSettingsOpen(false);
                  onOpenNavLabels();
                }}
              >
                <span aria-hidden="true">✏️</span>
                <span>메뉴 이름 변경</span>
              </button>
              <button
                type="button"
                className="sidebar__settings-item"
                role="menuitem"
                onClick={() => {
                  setSettingsOpen(false);
                  onOpenNavOrder();
                }}
              >
                <span aria-hidden="true">↕️</span>
                <span>메뉴 순서 변경</span>
              </button>
              <div className="sidebar__settings-field" role="group" aria-label="글자 크기">
                <span className="sidebar__settings-field-label">글자 크기</span>
                <div className="sidebar__font-options">
                  {[
                    ['small', '작게'],
                    ['normal', '기본'],
                    ['large', '크게'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`sidebar__font-option${fontScale === value ? ' is-active' : ''}`}
                      onClick={() => onFontScaleChange(value)}
                      aria-pressed={fontScale === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
