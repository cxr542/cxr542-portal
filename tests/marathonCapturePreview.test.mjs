import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import vm from 'node:vm';
import { MemoryDocument, settle } from './helpers/howManyPointsHarness.mjs';

async function previewFixture() {
  const document = new MemoryDocument(readFileSync(new URL('../public/marathon-log/index.html', import.meta.url), 'utf8'));
  const readers = [];
  const images = [];
  const saved = [];
  const context = {
    document, Date, Math, Promise,
    location: { protocol: 'http:', hostname: 'localhost' },
    MarathonDb: {
      getStorageMode: () => Promise.resolve('supabase'),
      seedIfEmpty: () => Promise.resolve(),
      listRaces: () => Promise.resolve(saved),
      putRace: async run => { saved.push(structuredClone(run)); },
    },
    MarathonEvents: { suggestEventNames: () => [] },
    MarathonWeather: { getKmaApiKey: () => '' },
    FileReader: class {
      constructor() { readers.push(this); }
      readAsDataURL() {}
    },
    Image: class {
      constructor() { images.push(this); }
      decode() { return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
    },
  };
  context.window = context;
  for (const script of ['time', 'run-log', 'app']) vm.runInNewContext(readFileSync(new URL(`../public/marathon-log/js/${script}.js`, import.meta.url), 'utf8'), context);
  await settle();
  const preview = document.getElementById('run-capture-preview');
  const error = document.getElementById('run-capture-error');
  const input = document.getElementById('run-capture-file');
  return {
    preview, error, readers, images, saved,
    draft(memo) {
      document.getElementById('run-capture-memo').value = memo;
      document.getElementById('btn-create-run').onclick();
      return document.getElementById('run-draft-image');
    },
    async save() {
      document.getElementById('run-draft-form').onsubmit({ preventDefault() {} });
      await settle();
    },
    select(file = { type: 'image/png' }) { input.onchange({ target: { files: file ? [file] : [], value: '' } }); },
    read(index, result) { readers[index].result = result; readers[index].onload(); },
  };
}

for (const pending of ['read', 'decode', 'read-error', 'decode-error']) {
  test(`saving a memo draft invalidates an outstanding ${pending} and keeps the next draft image-free`, async () => {
    const app = await previewFixture();
    app.select();
    if (pending.startsWith('decode')) app.read(0, 'data:image/png;base64,obsolete');
    app.draft('Synthetic first memo');
    await app.save();
    assert.equal(app.saved.length, 1);
    assert.equal(app.saved[0].imageData, '');
    assert.equal(app.preview.hidden, true);
    assert.equal(app.preview.src, '');

    if (pending === 'read') {
      app.read(0, 'data:image/png;base64,obsolete');
      if (app.images.length) app.images[0].resolve();
    }
    if (pending === 'decode') app.images[0].resolve();
    if (pending === 'read-error') app.readers[0].onerror();
    if (pending === 'decode-error') app.images[0].reject(new Error('Obsolete decode failure'));
    await settle();

    assert.equal(app.preview.hidden, true);
    assert.equal(app.preview.src, '');
    assert.equal(app.error.hidden, true);
    const nextDraftImage = app.draft('Synthetic next memo');
    assert.equal(nextDraftImage.hidden, true);
    assert.equal(nextDraftImage.src, '');
  });
}

test('a preview waits for successful image decoding before becoming visible', async () => {
  const app = await previewFixture();
  app.select();
  app.read(0, 'data:image/png;base64,synthetic-a');
  assert.equal(app.preview.hidden, true);
  app.images[0].resolve();
  await settle();
  assert.equal(app.preview.hidden, false);
  assert.equal(app.preview.src, 'data:image/png;base64,synthetic-a');
});

for (const failure of ['read', 'decode', 'type']) {
  test(`${failure} failure hides a previous preview and reports an error`, async () => {
    const app = await previewFixture();
    app.preview.hidden = false;
    app.preview.src = 'data:image/png;base64,old';
    app.select(failure === 'type' ? { type: 'text/plain' } : undefined);
    if (failure === 'read') app.readers[0].onerror();
    if (failure === 'decode') { app.read(0, 'data:image/png;base64,bad'); app.images[0].reject(new Error('Synthetic decode failure')); }
    await settle();
    assert.equal(app.preview.hidden, true);
    assert.equal(app.error.hidden, false);
    assert.ok(app.error.textContent);
  });
}

test('cancelling a file choice keeps the last valid preview', async () => {
  const app = await previewFixture();
  app.select();
  app.read(0, 'data:image/png;base64,kept');
  app.images[0].resolve();
  await settle();
  app.select(null);
  assert.equal(app.preview.hidden, false);
  assert.equal(app.preview.src, 'data:image/png;base64,kept');
});

for (const stale of ['read', 'decode', 'failure']) {
  test(`an obsolete ${stale} result cannot overwrite a newer file`, async () => {
    const app = await previewFixture();
    app.select();
    if (stale !== 'read') app.read(0, 'data:image/png;base64,old');
    app.select();
    app.read(1, 'data:image/png;base64,new');
    app.images.at(-1).resolve();
    await settle();
    if (stale === 'read') {
      app.read(0, 'data:image/png;base64,old');
      if (app.images.length === 2) app.images[1].resolve();
    }
    if (stale === 'decode') app.images[0].resolve();
    if (stale === 'failure') app.images[0].reject(new Error('Obsolete decode failure'));
    await settle();
    assert.equal(app.preview.src, 'data:image/png;base64,new');
    assert.equal(app.preview.hidden, false);
    assert.equal(app.error.hidden, true);
  });
}
