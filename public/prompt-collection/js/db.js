(function (global) {
  "use strict";

  var DB_NAME = "prompt-collection";
  var DB_VERSION = 1;
  var EXPORT_FORMAT_VERSION = 1;
  var STORE = "prompts";
  var LS_KEY = "prompt-collection-prompts";
  var dbPromise = null;
  var storageMode = "indexeddb";
  var storageReady = null;

  function probeIndexedDB() {
    return new Promise(function (resolve) {
      if (!global.indexedDB) {
        resolve(false);
        return;
      }
      var name = "__prompt_collection_probe_" + Date.now();
      var req;
      try {
        req = indexedDB.open(name, 1);
      } catch (e) {
        resolve(false);
        return;
      }
      req.onerror = function () {
        resolve(false);
      };
      req.onupgradeneeded = function (e) {
        e.target.result.createObjectStore("t");
      };
      req.onsuccess = function (e) {
        var db = e.target.result;
        db.close();
        try {
          indexedDB.deleteDatabase(name);
        } catch (err) {
          /* ignore */
        }
        resolve(true);
      };
    });
  }

  function initStorage() {
    if (storageReady) return storageReady;
    storageReady = probeIndexedDB().then(function (ok) {
      if (ok) {
        storageMode = "indexeddb";
        return "indexeddb";
      }
      try {
        localStorage.setItem("__prompt_collection_probe__", "1");
        localStorage.removeItem("__prompt_collection_probe__");
        storageMode = "localstorage";
        return "localstorage";
      } catch (e) {
        storageMode = "none";
        return "none";
      }
    });
    return storageReady;
  }

  function getStorageMode() {
    return initStorage().then(function () {
      return storageMode;
    });
  }

  function lsRead() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function lsWrite(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = function () {
        dbPromise = null;
        reject(req.error || new Error("idb-open"));
      };
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onblocked = function () {
        console.warn("prompt-collection: IndexedDB upgrade blocked — close other tabs.");
      };
    });
    return dbPromise;
  }

  function idbRequest(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error || new Error("IndexedDB request failed"));
      };
    });
  }

  function runTx(mode, run) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var store = tx.objectStore(STORE);
        var settled = false;
        function finish(err, value) {
          if (settled) return;
          settled = true;
          if (err) reject(err);
          else resolve(value);
        }
        try {
          var outcome = run(store);
          if (outcome && typeof outcome.then === "function") {
            outcome.then(
              function (value) {
                finish(null, value);
              },
              function (err) {
                finish(err);
              }
            );
          } else {
            tx.oncomplete = function () {
              finish(null, outcome);
            };
          }
        } catch (err) {
          finish(err);
          return;
        }
        tx.onerror = function () {
          finish(tx.error || new Error("IndexedDB transaction failed"));
        };
        tx.onabort = function () {
          finish(tx.error || new Error("IndexedDB transaction aborted"));
        };
      });
    });
  }

  function slugFromTitle(title, existingIds) {
    var base = String(title)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\uac00-\ud7a3-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36);
    if (!base) base = "prompt";
    var id = base;
    var n = 2;
    while (existingIds[id]) {
      id = base + "-" + n;
      n += 1;
    }
    return id;
  }

  function listPrompts() {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") return lsRead();
      if (mode === "none") return Promise.reject(new Error("storage-unavailable"));
      return runTx("readonly", function (store) {
        return idbRequest(store.getAll()).then(function (rows) {
          return rows || [];
        });
      });
    });
  }

  function getPrompt(id) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        return lsRead().find(function (p) {
          return p.id === id;
        });
      }
      if (mode === "none") return Promise.reject(new Error("storage-unavailable"));
      return runTx("readonly", function (store) {
        return idbRequest(store.get(id));
      });
    });
  }

  function putPrompt(prompt) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        var list = lsRead();
        var i = list.findIndex(function (item) {
          return item.id === prompt.id;
        });
        if (i >= 0) list[i] = prompt;
        else list.push(prompt);
        lsWrite(list);
        return;
      }
      if (mode === "none") return Promise.reject(new Error("storage-unavailable"));
      return runTx("readwrite", function (store) {
        return idbRequest(store.put(prompt));
      });
    });
  }

  function deletePrompt(id) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        lsWrite(
          lsRead().filter(function (p) {
            return p.id !== id;
          })
        );
        return;
      }
      if (mode === "none") return Promise.reject(new Error("storage-unavailable"));
      return runTx("readwrite", function (store) {
        return idbRequest(store.delete(id));
      });
    });
  }

  function clearAll() {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        lsWrite([]);
        return;
      }
      if (mode === "none") return Promise.reject(new Error("storage-unavailable"));
      return runTx("readwrite", function (store) {
        return idbRequest(store.clear());
      });
    });
  }

  function defaultSeed() {
    var now = new Date().toISOString();
    return [
      {
        id: "line-stamp-12",
        title: "나만의 이모티콘 만들기",
        body:
          "첨부된 사진을 바탕으로 Z세대 스타일의 귀여운 손그림 LINE 스탬프 12종을 만들어줘.\n\n" +
          "- 스타일: 세련된 미니멀 드로잉, '하찮은데 힙한' 감성, 파스텔톤 포인트.\n" +
          "- 12가지 표정: 1.감동, 2.멍때리기, 3.오열, 4.삐짐, 5.선글라스(자신감), 6.볼꼬집, 7.어쩔?, 8.최고, 9.당황, 10.꿀잠, 11.잔망윙크, 12.경악.\n" +
          "- 특징: 사진 속 인물의 특징 유지, 흰색 배경, 스티커 외곽선 처리",
        pinned: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  function seedIfEmpty() {
    return listPrompts().then(function (items) {
      if (items.length) return items;
      var seed = defaultSeed();
      return Promise.all(seed.map(putPrompt)).then(function () {
        return seed;
      });
    });
  }

  function exportPayload(prompts) {
    return {
      version: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      prompts: prompts.map(function (p) {
        return Object.assign({}, p);
      }),
    };
  }

  function importPayload(data, replace) {
    var prompts = (data && data.prompts) || (data && data.ideas) || [];
    if (!Array.isArray(prompts)) {
      return Promise.reject(new Error("invalid"));
    }
    var run = replace ? clearAll() : Promise.resolve();
    return run.then(function () {
      return Promise.all(
        prompts.map(function (raw) {
          var now = new Date().toISOString();
          return putPrompt({
            id: raw.id || slugFromTitle(raw.title || "prompt", {}),
            title: raw.title || "제목 없음",
            body: raw.body || "",
            pinned: !!raw.pinned,
            createdAt: raw.createdAt || now,
            updatedAt: raw.updatedAt || now,
          });
        })
      );
    });
  }

  global.PromptCollectionDb = {
    listPrompts: listPrompts,
    getPrompt: getPrompt,
    putPrompt: putPrompt,
    deletePrompt: deletePrompt,
    seedIfEmpty: seedIfEmpty,
    slugFromTitle: slugFromTitle,
    exportPayload: exportPayload,
    importPayload: importPayload,
    getStorageMode: getStorageMode,
  };
})(window);
