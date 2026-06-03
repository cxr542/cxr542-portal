(function (global) {
  "use strict";

  var DB_NAME = "how-many-points";
  var DB_VERSION = 1;
  var EXPORT_FORMAT_VERSION = 1;
  var STORE = "ratings";
  var LS_KEY = "how-many-points-ratings";
  var dbPromise = null;
  var storageMode = "indexeddb";
  var storageReady = null;

  var CONTENT_TYPES = ["movie", "series", "book", "webtoon", "other"];

  function probeIndexedDB() {
    return new Promise(function (resolve) {
      if (!global.indexedDB) {
        resolve(false);
        return;
      }
      var name = "__hmp_probe_" + Date.now();
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
        } catch (err) {}
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
        localStorage.setItem("__hmp_probe__", "1");
        localStorage.removeItem("__hmp_probe__");
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
          store.createIndex("contentType", "contentType", { unique: false });
        }
      };
      req.onsuccess = function () {
        resolve(req.result);
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
              function (v) {
                finish(null, v);
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
        }
        tx.onerror = function () {
          finish(tx.error || new Error("tx failed"));
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
      .slice(0, 40);
    if (!base) base = "item";
    var id = base;
    var n = 2;
    while (existingIds[id]) {
      id = base + "-" + n;
      n += 1;
    }
    return id;
  }

  function normalizeRating(raw) {
    var n = Number(raw);
    if (!isFinite(n) || n <= 0) return null;
    if (n > 5) n = 5;
    n = Math.round(n * 2) / 2;
    return Math.max(0.5, Math.min(5, n));
  }

  function normalizeItem(raw, existingIds) {
    var now = new Date().toISOString();
    var type = String(raw.contentType || raw.type || "other").toLowerCase();
    if (type === "tv" || type === "tv_seasons") type = "series";
    if (type === "movie" || type === "movies") type = "movie";
    if (CONTENT_TYPES.indexOf(type) < 0) type = "other";

    var id =
      raw.id ||
      (raw.externalId ? "watcha-" + raw.externalId : null) ||
      slugFromTitle(raw.title || "제목 없음", existingIds || {});

    if (existingIds && existingIds[id] && raw._mergeId) {
      id = raw._mergeId;
    }

    return {
      id: id,
      contentType: type,
      title: String(raw.title || "제목 없음").trim(),
      titleAlt: raw.titleAlt ? String(raw.titleAlt).trim() : "",
      year: raw.year ? Number(raw.year) || null : null,
      directors: raw.directors ? String(raw.directors).trim() : "",
      posterUrl: raw.posterUrl ? String(raw.posterUrl).trim() : "",
      rating: normalizeRating(raw.rating),
      review: raw.review ? String(raw.review) : "",
      watchedAt: raw.watchedAt || raw.watched_at || null,
      sourceUrl: raw.sourceUrl || raw.url || "",
      externalId: raw.externalId || raw.watchaId || "",
      source: raw.source || (raw.externalId || raw.watchaId ? "watcha" : "manual"),
      createdAt: raw.createdAt || now,
      updatedAt: raw.updatedAt || now,
    };
  }

  function listRatings() {
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

  function getRating(id) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        return lsRead().find(function (r) {
          return r.id === id;
        });
      }
      if (mode === "none") return Promise.reject(new Error("storage-unavailable"));
      return runTx("readonly", function (store) {
        return idbRequest(store.get(id));
      });
    });
  }

  function putRating(item) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        var list = lsRead();
        var i = list.findIndex(function (x) {
          return x.id === item.id;
        });
        if (i >= 0) list[i] = item;
        else list.push(item);
        lsWrite(list);
        return;
      }
      if (mode === "none") return Promise.reject(new Error("storage-unavailable"));
      return runTx("readwrite", function (store) {
        return idbRequest(store.put(item));
      });
    });
  }

  function deleteRating(id) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        lsWrite(
          lsRead().filter(function (r) {
            return r.id !== id;
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

  function buildIdMap(list) {
    var map = {};
    list.forEach(function (r) {
      map[r.id] = true;
      if (r.externalId) map["watcha-" + r.externalId] = r.id;
    });
    return map;
  }

  function importItems(items, replace) {
    if (!Array.isArray(items)) return Promise.reject(new Error("invalid"));
    var run = replace ? clearAll() : Promise.resolve();
    return run.then(function () {
      return listRatings().then(function (existing) {
        var idMap = buildIdMap(existing);
        return Promise.all(
          items.map(function (raw) {
            var ext = raw.externalId || raw.watchaId;
            var mergeId = ext && idMap["watcha-" + ext] ? idMap["watcha-" + ext] : null;
            if (mergeId) raw._mergeId = mergeId;
            var item = normalizeItem(raw, idMap);
            idMap[item.id] = true;
            if (item.externalId) idMap["watcha-" + item.externalId] = item.id;
            item.updatedAt = new Date().toISOString();
            if (mergeId) {
              return getRating(mergeId).then(function (prev) {
                if (prev) {
                  item.createdAt = prev.createdAt;
                  if (!item.posterUrl && prev.posterUrl) item.posterUrl = prev.posterUrl;
                }
                return putRating(item);
              });
            }
            return putRating(item);
          })
        );
      });
    });
  }

  function exportPayload(ratings) {
    return {
      version: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      ratings: ratings.map(function (r) {
        return Object.assign({}, r);
      }),
    };
  }

  function importPayload(data, replace) {
    var ratings = (data && data.ratings) || [];
    return importItems(ratings, replace);
  }

  function seedIfEmpty() {
    return listRatings();
  }

  global.HowManyPointsDb = {
    CONTENT_TYPES: CONTENT_TYPES,
    listRatings: listRatings,
    getRating: getRating,
    putRating: putRating,
    deleteRating: deleteRating,
    importItems: importItems,
    exportPayload: exportPayload,
    importPayload: importPayload,
    seedIfEmpty: seedIfEmpty,
    slugFromTitle: slugFromTitle,
    normalizeRating: normalizeRating,
    normalizeItem: normalizeItem,
    getStorageMode: getStorageMode,
  };
})(window);
