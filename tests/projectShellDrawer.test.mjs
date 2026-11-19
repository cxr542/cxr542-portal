import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import vm from 'node:vm';

function shellFixture() {
  const listeners = new Map();
  const classes = new Set();
  const document = {
    readyState: 'loading', activeElement: null,
    body: { classList: { add: key => classes.add(key), remove: key => classes.delete(key), contains: key => classes.has(key) } },
    addEventListener(type, handler) { listeners.set(type, [...(listeners.get(type) || []), handler]); },
    querySelector: selector => selector === '#project-nav-backdrop' ? backdrop : null,
    querySelectorAll: selector => selector.includes('data-view') ? [nav] : [toggle],
  };
  function element() {
    return {
      attributes: {}, handlers: {}, isConnected: true, disabled: false, hidden: false,
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(type, handler) { this.handlers[type] = handler; },
      getClientRects: () => [{}],
      focus() { document.activeElement = this; },
      click() { this.focus(); this.handlers.click({ currentTarget: this, target: this }); },
    };
  }
  const toggle = element();
  // Both drawer and desktop-collapse register click handlers on this button.
  toggle.addEventListener = function(type, handler) {
    const previous = this.handlers[type];
    this.handlers[type] = event => { previous?.(event); handler(event); };
  };
  const nav = element();
  const backdrop = element();
  let mobile = true;
  let resize;
  const context = { document, Promise, console, localStorage: { getItem: () => null },
    matchMedia: () => ({ matches: mobile, addEventListener: (_type, handler) => { resize = handler; } }),
  };
  context.window = context;
  vm.runInNewContext(readFileSync(new URL('../public/shared/js/project-shell.js', import.meta.url), 'utf8'), context);
  context.ProjectShell.init({ enableCollapse: false });
  return {
    toggle, nav, backdrop, document,
    open: () => classes.has('project-nav-open'),
    key(options = {}) {
      const event = { key: 'Escape', target: { closest: () => null }, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, ...options };
      for (const handler of listeners.get('keydown') || []) handler(event);
    },
    desktop() { mobile = false; resize(); },
  };
}

test('Escape closes the open mobile drawer and returns focus to its opener', () => {
  const app = shellFixture();
  app.toggle.click();
  app.document.activeElement = app.nav;
  app.key();
  assert.equal(app.open(), false);
  assert.equal(app.document.activeElement, app.toggle);
  assert.equal(app.toggle.attributes['aria-expanded'], 'false');
  assert.equal(app.backdrop.hidden, true);
});

for (const condition of ['handled', 'editing', 'closed', 'desktop']) {
  test(`Escape preserves unrelated state when ${condition}`, () => {
    const app = shellFixture();
    if (condition !== 'closed') app.toggle.click();
    if (condition === 'desktop') app.desktop();
    const wasOpen = app.open();
    app.document.activeElement = app.nav;
    app.key(condition === 'handled' ? { defaultPrevented: true } : condition === 'editing' ? { target: { closest: () => ({}) } } : {});
    assert.equal(app.open(), wasOpen);
    assert.equal(app.document.activeElement, app.nav);
  });
}

for (const action of ['toggle', 'backdrop', 'nav']) {
  test(`${action} click continues to close the drawer without overriding focus`, () => {
    const app = shellFixture();
    app.toggle.click();
    app[action].click();
    assert.equal(app.open(), false);
    assert.equal(app.document.activeElement, app[action]);
  });
}
