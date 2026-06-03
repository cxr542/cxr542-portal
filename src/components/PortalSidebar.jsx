import { useEffect, useState } from 'react';
import EnvironmentBadge from './EnvironmentBadge';
import { PORTAL_NAV_ITEMS } from '../constants/portalNav';

export default function PortalSidebar({
  activeModule,
  onModuleChange,
  labels,
  onOpenNavLabels,
  collapsed,
  onCollapsedChange,
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

  const railLabel = collapsed ? '펼침' : '접기';

  return (
    <aside className="sidebar" id="portal-sidebar" aria-label="포털 메뉴">
      <div className="sidebar__head">
        <h1>
          <span className="sidebar__logo-icon" aria-hidden="true">
            ⚡
          </span>
          <span className="sidebar__logo-text">cxr542</span>
        </h1>
        <div className="sidebar__env-row">
          <p className="sidebar__sub">개인 개발 포털</p>
          <EnvironmentBadge className="portal-env-badge--sidebar" compact />
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="주 메뉴">
        {PORTAL_NAV_ITEMS.map((item) => {
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
        <div className="sidebar__settings-wrap">
          <button
            type="button"
            className={`nav-btn nav-btn--utility${settingsOpen ? ' is-open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen((open) => !open);
            }}
            {...navTooltipProps({ id: 'settings', icon: '⚙️', defaultLabel: '설정', tooltip: '메뉴 이름·환경 설정' })}
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
                ✏️ 메뉴 이름 변경
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="sidebar-rail"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls="portal-sidebar"
          title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
        >
          <span className="sidebar-rail__label">{railLabel}</span>
          <span className="sidebar-rail__icon" aria-hidden="true">
            {collapsed ? '›' : '‹'}
          </span>
        </button>
      </div>
    </aside>
  );
}
