export function shouldWarnAboutRemoteChange(data, userId, embedded = false) {
  if (data?.userId !== userId || typeof data.namespace !== 'string' || typeof data.key !== 'string') return false;
  // Embedded tools receive the portal theme through their presentation bridge.
  // They never read or write this setting, so their loaded document revisions remain valid.
  return !(embedded && data.namespace === 'settings' && data.key === 'cxr542-portal-theme');
}
