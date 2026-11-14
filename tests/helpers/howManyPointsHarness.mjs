import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createPortalStorage } from '../../src/cloud/storage.js';

const root = new URL('../../', import.meta.url);

class MemoryElement {
  constructor(document, attributes) {
    this.document = document;
    this.attributes = attributes;
    this.value = '';
    this.hidden = false;
    this.textContent = '';
    this.children = [];
    this.classList = { toggle() {}, add() {}, remove() {}, contains: () => false };
  }

  set innerHTML(value) {
    this.html = value;
    this.children = this.document.parse(value);
  }

  get innerHTML() { return this.html || ''; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, handler) { this[`on${type}`] = handler; }
  reset() {}
  querySelector(selector) {
    const pool = this.children.length ? this.children : this.document.initial;
    if (selector === 'label:not(.data-menu__key)') {
      return pool.find(element => element.tagName === 'label' && element.attributes.class !== 'data-menu__key');
    }
    return null;
  }
  querySelectorAll(selector) {
    return this.children.filter(element =>
      (element.attributes.class || '').split(/\s+/).includes(selector.slice(1)));
  }
}

export class MemoryDocument {
  constructor(html) {
    this.elements = new Map();
    this.initial = this.parse(html);
    this.body = new MemoryElement(this, {});
  }

  parse(html) {
    return Array.from(html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi), match => {
      const attributes = Object.fromEntries(Array.from(
        match[2].matchAll(/([\w-]+)="([^"]*)"/g), attribute => [attribute[1], attribute[2]]));
      const element = new MemoryElement(this, attributes);
      element.tagName = match[1];
      element.textContent = html.slice(match.index + match[0].length).split('<', 1)[0];
      if (attributes.id) this.elements.set(attributes.id, element);
      return element;
    });
  }

  getElementById(id) { return this.elements.get(id) ?? null; }
  addEventListener() {}
  querySelector(selector) {
    if (selector === '.app-banner .storage-hint') {
      return this.initial.find(element => (element.attributes.class || '').split(/\s+/).includes('storage-hint'));
    }
    return null;
  }
  querySelectorAll(selector) {
    if (selector === '.nav-item[data-view]') {
      return this.initial.filter(element => element.attributes['data-view']);
    }
    return [];
  }
}

export async function settle() {
  await new Promise(resolve => setImmediate(resolve));
}

export async function createSyntheticCloud(existing = []) {
  const keyOf = (namespace, key) => JSON.stringify([namespace, key]);
  const rows = new Map(existing.map(value => [keyOf('how-many-points', value.id), {
    namespace: 'how-many-points', key: value.id, value: structuredClone(value), revision: 1,
  }]));
  const controls = { failWrites: false, failKeys: new Set(), lostKeys: new Set(), beforeWrite: async () => {} };
  const calls = [];
  const client = {
    from() { return { select() { return { order() { return this; }, async range(start, end) {
      return { data: structuredClone([...rows.values()].slice(start, end + 1)), error: null };
    } }; } }; },
    async rpc(name, args) {
      if (name !== 'portal_write') throw new TypeError('Unexpected synthetic RPC');
      const { p_namespace: namespace, p_key: key, p_value: value, p_revision: revision } = args;
      calls.push({ namespace, key, value: structuredClone(value) });
      await controls.beforeWrite(namespace, key);
      const id = keyOf(namespace, key);
      if ((controls.failWrites && namespace === 'how-many-points') || controls.failKeys.has(id)) {
        return { data: null, error: new Error('Synthetic storage failure') };
      }
      if ((rows.get(id)?.revision || 0) !== revision) return { data: null, error: new Error('portal_write_conflict') };
      const row = { namespace, key, value: structuredClone(value), revision: revision + 1 };
      rows.set(id, row);
      if (controls.lostKeys.has(id)) return { data: null, error: new Error('Synthetic response lost') };
      return { data: [structuredClone(row)], error: null };
    },
  };
  const cloud = createPortalStorage(client);
  await cloud.load();
  return { cloud, controls, calls, serverRecords: () => structuredClone([...rows.values()]) };
}

export async function loadRatings({ existing = [], confirm = true, shell } = {}) {
  const synthetic = await createSyntheticCloud(existing);
  const alerts = [];
  const imports = [];
  const diagnostics = [];
  const document = new MemoryDocument(readFileSync(new URL('public/how-many-points/index.html', root), 'utf8'));
  const storage = synthetic.controls;
  const context = {
    document, Date, Math, Promise,
    console: { error: (...args) => diagnostics.push(args), warn: (...args) => diagnostics.push(args) },
    PortalCloud: synthetic.cloud, PortalStorage: synthetic.cloud.settings,
    fetch() { throw new TypeError('Network forbidden in synthetic tests'); },
    FileReader: class {
      readAsText(file) {
        this.result = file.contents;
        this.onload();
      }
    },
    confirm: () => confirm,
    alert: message => alerts.push(message),
  };
  context.window = context;
  if (shell) context.ProjectShell = {
    init() {}, initBranding() {}, setActiveView() {}, ...shell,
  };
  for (const name of ['db', 'import-watcha', 'app']) {
    vm.runInNewContext(readFileSync(new URL(`public/how-many-points/js/${name}.js`, root), 'utf8'), context);
  }
  await settle();
  const db = context.HowManyPointsDb;
  const importItems = db.importItems;
  db.importItems = (items, replace) => {
    imports.push({ replace });
    return importItems(items, replace);
  };
  const nav = view => document.initial.find(element => element.attributes['data-view'] === view);
  return {
    alerts, imports, document, storage, db, diagnostics, ...synthetic,
    failRender() {
      Object.defineProperty(document.getElementById('content'), 'innerHTML', {
        set() { throw new TypeError('Synthetic render failure'); },
      });
    },
    failParsing() {
      context.HowManyPointsWatchaImport.parseWatchaCsv = () => { throw new SyntaxError('Synthetic invalid CSV'); };
    },
    async open(view) {
      nav(view).onclick();
      await settle();
    },
    async importCsv(contents) {
      nav('import').onclick();
      await settle();
      document.getElementById('import-csv').onchange({ target: { files: [{ contents }], value: 'synthetic.csv' } });
      await settle();
    },
    async records() { return JSON.parse(JSON.stringify(await db.listRatings())); },
  };
}

export function csvRow({ id = 'new', title = 'Synthetic film', rating = 4, review = 'Synthetic review' } = {}) {
  return `ID,URL,Title,Type,Year,Directors,WatchedAt,Rating,Review,Spoiler\n${id},,${title},MOVIE,2020,,,${rating},${review},`;
}

export const existingRating = {
  id: 'watcha-kept', externalId: 'kept', title: 'Preserved synthetic film',
  source: 'watcha', contentType: 'movie', rating: 4.5, review: 'Preserved review',
  createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
};
