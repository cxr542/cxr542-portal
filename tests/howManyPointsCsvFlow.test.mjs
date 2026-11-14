import assert from 'node:assert/strict';
import { test } from 'vitest';
import { csvRow, existingRating, loadRatings } from './helpers/howManyPointsHarness.mjs';

test('confirming CSV import selects non-replacing storage', async () => {
  const app = await loadRatings({ existing: [existingRating] });
  await app.importCsv(csvRow());
  assert.deepEqual(app.imports, [{ replace: false }]);
});

test('cancelling CSV import performs no save and preserves the library', async () => {
  const app = await loadRatings({ existing: [existingRating], confirm: false });
  await app.importCsv(csvRow());
  assert.deepEqual(app.imports, []);
  assert.deepEqual(await app.records(), [existingRating]);
});

test('empty CSV does not call storage', async () => {
  const app = await loadRatings({ existing: [existingRating] });
  await app.importCsv('');
  assert.deepEqual(app.imports, []);
  assert.deepEqual(await app.records(), [existingRating]);
});

test('CSV parsing failure does not call storage', async () => {
  const app = await loadRatings({ existing: [existingRating] });
  app.failParsing();
  await app.importCsv(csvRow());
  assert.deepEqual(app.imports, []);
  assert.deepEqual(await app.records(), [existingRating]);
});

test('adding a CSV item keeps unrelated existing records unchanged', async () => {
  const app = await loadRatings({ existing: [existingRating] });
  await app.importCsv(csvRow());
  const records = await app.records();
  assert.equal(records.length, 2);
  assert.deepEqual(records.find(item => item.id === existingRating.id), existingRating);
  assert.equal(records.find(item => item.externalId === 'new').rating, 4);
});

test('reimporting the same external ID retains identity and updates using the existing policy', async () => {
  const app = await loadRatings({ existing: [existingRating] });
  await app.importCsv(csvRow({ id: 'kept', rating: 2, review: 'Updated synthetic review' }));
  const [record] = await app.records();
  assert.equal((await app.records()).length, 1);
  assert.equal(record.id, existingRating.id);
  assert.equal(record.createdAt, existingRating.createdAt);
  assert.equal(record.rating, 2);
  assert.equal(record.review, 'Updated synthetic review');
});

test('storage rejection reports failure without a success message or lost records', async () => {
  const app = await loadRatings({ existing: [existingRating] });
  app.storage.failWrites = true;
  await app.importCsv(csvRow());
  assert.equal(app.alerts.length, 1);
  assert.match(app.alerts[0], /오류|실패/);
  assert.doesNotMatch(app.alerts[0], /반영했습니다/);
  assert.deepEqual(await app.records(), [existingRating]);
});

for (const mode of ['missing', 'success', 'throw', 'reject']) {
  test(`stored CSV remains successful when optional notification is ${mode}`, async () => {
    let notifications = 0;
    const shell = {};
    if (mode !== 'missing') shell.notifyTaskDone = () => {
      notifications += 1;
      if (mode === 'throw') throw new TypeError('Synthetic notification failure');
      return mode === 'reject' ? Promise.reject(new Error('Synthetic notification rejection')) : Promise.resolve();
    };
    const app = await loadRatings({ existing: [existingRating], shell });
    await app.importCsv(csvRow());
    assert.equal((await app.records()).length, 2);
    assert.deepEqual(app.alerts, ['1건을 반영했습니다.']);
    assert.equal(notifications, mode === 'missing' ? 0 : 1);
    assert.equal(app.diagnostics.length, ['throw', 'reject'].includes(mode) ? 1 : 0);
  });
}

test('render failure after persistence reports saved data rather than storage failure', async () => {
  const app = await loadRatings({ existing: [existingRating] });
  await app.open('import');
  const handler = app.document.getElementById('import-csv').onchange;
  app.failRender();
  handler({ target: { files: [{ contents: csvRow() }], value: 'synthetic.csv' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await app.records()).length, 2);
  assert.equal(app.alerts.length, 1);
  assert.match(app.alerts[0], /저장.*완료.*화면/);
  assert.doesNotMatch(app.alerts[0], /CSV 저장 중 오류/);
  assert.equal(app.diagnostics.length, 1);
});

function twoRows() {
  return csvRow({ id: 'first' }) + '\n' + csvRow({ id: 'second' }).split('\n')[1];
}

test('a later CSV failure reports confirmed partial writes and stops without retry', async () => {
  const app = await loadRatings({ existing: [existingRating] });
  app.storage.failKeys.add(JSON.stringify(['how-many-points', 'watcha-second']));
  await app.importCsv(twoRows());
  assert.match(app.alerts[0], /부분 저장: 1건/);
  assert.equal(app.alerts.length, 1);
  assert.deepEqual((await app.records()).map(row => row.id).sort(), ['watcha-first', existingRating.id].sort());
  assert.equal(app.calls.length, 2);
  await app.importCsv(csvRow({ id: 'third' }));
  assert.equal(app.calls.length, 2);
  assert.match(app.alerts[1], /이전 CSV 저장 결과/);
});

test('a lost first response reports unknown outcome even when the synthetic server committed', async () => {
  const app = await loadRatings({ existing: [existingRating] });
  app.storage.lostKeys.add(JSON.stringify(['how-many-points', 'watcha-first']));
  await app.importCsv(twoRows());
  assert.match(app.alerts[0], /저장 결과 불명/);
  assert.equal(app.serverRecords().filter(row => row.namespace === 'how-many-points').length, 2);
  assert.deepEqual(await app.records(), [existingRating]);
  assert.equal(app.calls.length, 1);
});

test('a successful CSV is not reported as failed because an unrelated settings flush fails', async () => {
  const app = await loadRatings({ existing: [existingRating] });
  app.storage.failKeys.add(JSON.stringify(['settings', 'theme']));
  app.cloud.settings.setItem('theme', 'dark');
  await app.importCsv(csvRow());
  await assert.rejects(app.cloud.flush());
  assert.deepEqual(app.alerts, ['1건을 반영했습니다.']);
  assert.equal((await app.records()).length, 2);
});
