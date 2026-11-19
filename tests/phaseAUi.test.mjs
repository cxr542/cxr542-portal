import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import vm from 'node:vm';
import { existingRating, loadRatings, MemoryDocument, settle } from './helpers/howManyPointsHarness.mjs';

test('an empty library offers onboarding', async () => {
  const app = await loadRatings();
  const controls = app.document.getElementById('content').children;
  assert.ok(controls.some(element => element.attributes.id === 'empty-open-import'));
  assert.ok(controls.some(element => element.attributes.id === 'empty-open-new'));
});

test('a search miss can reset filters and restore existing ratings without changing storage', async () => {
  const app = await loadRatings({ existing: [existingRating] });
  const search = app.document.getElementById('search');
  search.value = 'missing synthetic title';
  search.oninput({ target: search });
  await settle();
  const controls = app.document.getElementById('content').children;
  assert.ok(!controls.some(element => element.attributes.id === 'empty-open-import'));
  app.document.getElementById('clear-library-filters').onclick();
  await settle();
  assert.equal(search.value, '');
  assert.ok(app.document.getElementById('content').children.some(element => element.attributes['data-id'] === existingRating.id));
  assert.deepEqual(await app.records(), [existingRating]);
});

test('a type filter miss can restore all content types', async () => {
  const app = await loadRatings({ existing: [existingRating] });
  const seriesChip = app.document.getElementById('type-filter').querySelectorAll('.type-chip')
    .find(element => element.attributes['data-type'] === 'series');
  seriesChip.onclick();
  await settle();
  app.document.getElementById('clear-library-filters').onclick();
  await settle();
  assert.ok(app.document.getElementById('content').children.some(element => element.attributes['data-id'] === existingRating.id));
});

test('new rating inputs have associated labels and the rating group has a name', async () => {
  const app = await loadRatings();
  app.document.getElementById('btn-new').onclick();
  await settle();
  const controls = app.document.getElementById('content').children;
  const inputs = controls.filter(element => ['input', 'select', 'textarea'].includes(element.tagName));
  assert.equal(inputs.length, 8);
  for (const input of inputs) {
    const label = controls.find(element => element.tagName === 'label' && element.attributes.for === input.attributes.id);
    assert.ok(label?.textContent.trim(), `Missing label for ${input.attributes.id}`);
  }
  const picker = app.document.getElementById('rating-picker');
  assert.equal(picker.attributes.role, 'group');
  assert.ok(app.document.getElementById(picker.attributes['aria-labelledby']).textContent.trim());
});

test('search has an explicit accessible name', async () => {
  const app = await loadRatings();
  assert.ok(app.document.getElementById('search').attributes['aria-label']?.trim());
});

for (const name of ['Synthetic long marathon championship', '긴 이름의 합성 마라톤 & 기록 <대회>']) {
  test(`PB renders the complete competition name: ${name}`, async () => {
    const document = new MemoryDocument(readFileSync(new URL('../public/marathon-log/index.html', import.meta.url), 'utf8'));
    const context = {
      document, Date, Math, Promise,
      location: { protocol: 'https:', hostname: 'synthetic.invalid' },
      MarathonDb: {
        getStorageMode: () => Promise.resolve('localstorage'),
        seedIfEmpty: () => Promise.resolve(),
        listRaces: () => Promise.resolve([{
          id: 'synthetic-race', name, distance: 'full', status: 'finished',
          date: '2020-01-01', chipTime: '3:30:00',
        }]),
      },
      MarathonEvents: { suggestEventNames: () => [] },
      MarathonWeather: { getKmaApiKey: () => '' },
    };
    context.window = context;
    for (const script of ['time', 'app']) {
      vm.runInNewContext(readFileSync(new URL(`../public/marathon-log/js/${script}.js`, import.meta.url), 'utf8'), context);
    }
    await settle();
    const expected = name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    assert.ok(document.getElementById('stats-grid').innerHTML.includes(`2020 ${expected}`));
    assert.ok(document.getElementById('stats-grid').innerHTML.includes('3:30:00'));
  });
}
