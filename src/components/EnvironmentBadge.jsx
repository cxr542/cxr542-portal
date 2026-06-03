import { useMemo } from 'react';
import { resolvePortalEnvironment } from '../utils/portalEnvironment';

export default function EnvironmentBadge({ className = '', compact = false }) {
  const env = useMemo(() => resolvePortalEnvironment(), []);

  return (
    <span
      className={`portal-env-badge ${env.className}${className ? ` ${className}` : ''}`}
      title={env.title}
      aria-label={`배포 환경: ${env.label}`}
    >
      <span className="portal-env-badge__long">{env.label}</span>
      <span className="portal-env-badge__short">{env.shortLabel}</span>
      {compact ? null : <span className="portal-env-badge__host">{window.location.hostname}</span>}
    </span>
  );
}
