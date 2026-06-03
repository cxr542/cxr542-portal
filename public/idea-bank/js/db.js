(function (global) {
  "use strict";

  var DB_NAME = "idea-bank";
  /** IndexedDB schema — 올릴 때는 onupgradeneeded 마이그레이션 필수. 운영 배포 전 로컬 검증. */
  var DB_VERSION = 1;
  var EXPORT_FORMAT_VERSION = 1;
  var STORE = "ideas";
  var LS_IDEAS_KEY = "idea-bank-ideas";
  var dbPromise = null;
  var storageMode = "indexeddb";
  var storageReady = null;

  function probeIndexedDB() {
    return new Promise(function (resolve) {
      if (!global.indexedDB) {
        resolve(false);
        return;
      }
      var name = "__idea_bank_probe_" + Date.now();
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
        localStorage.setItem("__idea_bank_probe__", "1");
        localStorage.removeItem("__idea_bank_probe__");
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
      var raw = localStorage.getItem(LS_IDEAS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function lsWrite(list) {
    localStorage.setItem(LS_IDEAS_KEY, JSON.stringify(list));
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
          store.createIndex("targetCategory", "targetCategory", { unique: false });
        }
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onblocked = function () {
        console.warn("idea-bank: IndexedDB upgrade blocked — close other tabs.");
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
    if (!base) base = "idea";
    var id = base;
    var n = 2;
    while (existingIds[id]) {
      id = base + "-" + n;
      n += 1;
    }
    return id;
  }

  function defaultSeed() {
    var now = new Date().toISOString();
    return [
      {
        id: "marathon-log",
        title: "마라톤 기록장",
        body:
          "Keep에 흩어진 대회 기록을 JSON으로 관리하고 싶다.\n\n오늘뭐신지(신발)와 역할 분리. 로컬 저장 + export.\n→ projects/marathon-log MVP 배포, hub hobby 승격 완료.",
        targetCategory: "hobby",
        hubProjectId: "marathon-log",
        status: "promoted",
        promotedAt: now,
        promoteProgress: {
          app: true,
          "projects-json": true,
          "intro-manifest": true,
          "catalog-map": true,
          "build-hub": true,
          push: true,
        },
        pinned: true,
        tags: ["Running", "product"],
        images: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hub-admin",
        title: "허브 admin 모드",
        body: "catalog 편집을 Git 없이…",
        targetCategory: "work",
        hubProjectId: "hub-admin",
        status: "active",
        promoteProgress: {
          app: false,
          "projects-json": false,
          "intro-manifest": false,
          "catalog-map": false,
          "build-hub": false,
          push: false,
        },
        pinned: false,
        tags: ["product"],
        images: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  function listIdeas() {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        return lsRead();
      }
      if (mode === "none") {
        return Promise.reject(new Error("storage-unavailable"));
      }
      return runTx("readonly", function (store) {
        return idbRequest(store.getAll()).then(function (rows) {
          return rows || [];
        });
      });
    });
  }

  function getIdea(id) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        return lsRead().find(function (idea) {
          return idea.id === id;
        });
      }
      if (mode === "none") {
        return Promise.reject(new Error("storage-unavailable"));
      }
      return runTx("readonly", function (store) {
        return idbRequest(store.get(id));
      });
    });
  }

  function putIdea(idea) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        var list = lsRead();
        var i = list.findIndex(function (item) {
          return item.id === idea.id;
        });
        if (i >= 0) list[i] = idea;
        else list.push(idea);
        lsWrite(list);
        return;
      }
      if (mode === "none") {
        return Promise.reject(new Error("storage-unavailable"));
      }
      return runTx("readwrite", function (store) {
        return idbRequest(store.put(idea));
      });
    });
  }

  function deleteIdea(id) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        lsWrite(
          lsRead().filter(function (idea) {
            return idea.id !== id;
          })
        );
        return;
      }
      if (mode === "none") {
        return Promise.reject(new Error("storage-unavailable"));
      }
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
      if (mode === "none") {
        return Promise.reject(new Error("storage-unavailable"));
      }
      return runTx("readwrite", function (store) {
        return idbRequest(store.clear());
      });
    });
  }

  function seedIfEmpty() {
    return listIdeas().then(function (items) {
      if (items.length) return items;
      var seed = defaultSeed();
      return Promise.all(seed.map(putIdea)).then(function () {
        return seed;
      });
    });
  }

  function exportPayload(ideas) {
    return {
      version: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      ideas: ideas.map(function (i) {
        return Object.assign({}, i);
      }),
    };
  }

  function importPayload(data, replace) {
    var ideas = (data && data.ideas) || [];
    if (!Array.isArray(ideas)) {
      return Promise.reject(new Error("invalid"));
    }
    var run = replace ? clearAll() : Promise.resolve();
    return run.then(function () {
      return Promise.all(
        ideas.map(function (raw) {
          var now = new Date().toISOString();
          return putIdea({
            id: raw.id || slugFromTitle(raw.title || "idea", {}),
            title: raw.title || "제목 없음",
            body: raw.body || "",
            targetCategory: raw.targetCategory || "study",
            hubProjectId: raw.hubProjectId || raw.id,
            status: raw.status || "active",
            promotedAt: raw.promotedAt || null,
            promoteProgress: raw.promoteProgress || null,
            pinned: !!raw.pinned,
            tags: Array.isArray(raw.tags) ? raw.tags : [],
            images: Array.isArray(raw.images) ? raw.images : [],
            createdAt: raw.createdAt || now,
            updatedAt: raw.updatedAt || now,
          });
        })
      );
    });
  }

  global.IdeaBankDb = {
    listIdeas: listIdeas,
    getIdea: getIdea,
    putIdea: putIdea,
    deleteIdea: deleteIdea,
    seedIfEmpty: seedIfEmpty,
    slugFromTitle: slugFromTitle,
    exportPayload: exportPayload,
    importPayload: importPayload,
    getStorageMode: getStorageMode,
  };
})(window);
