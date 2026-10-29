const NAME = 'prompt-collection-central';
let pending;
function open() {
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('cache', { keyPath: 'key' });
      request.result.createObjectStore('drafts', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { pending = null; reject(request.error); };
    request.onblocked = () => { pending = null; reject(new Error('다른 프롬프트 탭을 닫아 주세요.')); };
  });
  return pending;
}
async function transact(store, mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(tx.error || request.error || new Error('로컬 저장 실패'));
  });
}
export const cache = {
  get: owner => transact('cache','readonly',s => s.get(owner)),
  put: (owner, items, complete = false) => transact('cache','readwrite',s => s.put({ key: owner, items, complete, savedAt: new Date().toISOString() })),
  draft: (owner, item) => transact('drafts','readwrite',s => s.put({ ...item, key: `${owner}:${item.draft_id}`, owner, savedAt: new Date().toISOString() })),
  drafts: async owner => (await transact('drafts','readonly',s => s.getAll())).filter(d => d.owner === owner),
  removeDraft: (owner, id) => transact('drafts','readwrite',s => s.delete(`${owner}:${id}`)),
};
