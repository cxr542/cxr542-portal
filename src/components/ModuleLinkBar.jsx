export default function ModuleLinkBar({ hint, children, actions }) {
  return (
    <div className="module-link-bar">
      {hint ? (
        <p className="hint module-link-bar__hint" style={{ margin: 0 }}>
          {hint}
        </p>
      ) : null}
      {children}
      {actions ? <div className="module-link-bar__actions">{actions}</div> : null}
    </div>
  );
}
