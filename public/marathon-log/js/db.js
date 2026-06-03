(function (global) {
  "use strict";

  var DB_NAME = "marathon-log";
  var DB_VERSION = 1;
  var STORE = "races";
  var SEED_VERSION = 3;
  var SEED_VERSION_KEY = "marathon-log-seed-version";
  var LS_RACES_KEY = "marathon-log-races";

  var SEED_RACES = global.MarathonKeepSeed || [];
  var storageMode = "indexeddb";
  var storageReady = null;

  function probeIndexedDB() {
    return new Promise(function (resolve) {
      if (!global.indexedDB) {
        resolve(false);
        return;
      }
      var name = "__marathon_log_probe_" + Date.now();
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
        localStorage.setItem("__marathon_log_probe__", "1");
        localStorage.removeItem("__marathon_log_probe__");
        storageMode = "localstorage";
        return "localstorage";
      } catch (e) {
        storageMode = "none";
        return "none";
      }
    });
    return storageReady;
  }

  function openDb() {
    return initStorage().then(function (mode) {
      if (mode !== "indexeddb") {
        return Promise.reject(new Error("indexeddb-unavailable"));
      }
      return new Promise(function (resolve, reject) {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = function () {
          reject(req.error || new Error("idb-open"));
        };
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(STORE)) {
            var store = db.createObjectStore(STORE, { keyPath: "id" });
            store.createIndex("date", "date", { unique: false });
            store.createIndex("distance", "distance", { unique: false });
          }
        };
        req.onsuccess = function () {
          resolve(req.result);
        };
      });
    });
  }

  function txStore(mode) {
    return openDb().then(function (db) {
      return db.transaction(STORE, mode).objectStore(STORE);
    });
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function lsRead() {
    try {
      var raw = localStorage.getItem(LS_RACES_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function lsWrite(list) {
    localStorage.setItem(LS_RACES_KEY, JSON.stringify(list));
  }

  function getSeedVersion() {
    try {
      return parseInt(localStorage.getItem(SEED_VERSION_KEY) || "0", 10);
    } catch (e) {
      return 0;
    }
  }

  function setSeedVersion(v) {
    try {
      localStorage.setItem(SEED_VERSION_KEY, String(v));
    } catch (e) {
      /* ignore */
    }
  }

  function newId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "race-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeChip(raw, status) {
    var chipRaw = String(raw || "").trim();
    if (status !== "finished" && status !== "dnf") return chipRaw;
    if (global.MarathonTime && MarathonTime.normalizeChipTimeInput) {
      return MarathonTime.normalizeChipTimeInput(chipRaw);
    }
    return chipRaw;
  }

  function normalizeRace(raw) {
    var now = new Date().toISOString();
    var status = raw.status || "finished";
    return {
      id: raw.id || newId(),
      date: raw.date || "",
      name: String(raw.name || "").trim(),
      distance: raw.distance || "full",
      chipTime: normalizeChip(raw.chipTime, status),
      goal: String(raw.goal || "").trim(),
      weather: String(raw.weather || "").trim(),
      notes: String(raw.notes || "").trim(),
      status: status,
      createdAt: raw.createdAt || now,
      updatedAt: now,
    };
  }

  function listRaces() {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        return lsRead();
      }
      if (mode === "none") {
        return Promise.reject(new Error("storage-unavailable"));
      }
      return txStore("readonly").then(function (store) {
        return reqToPromise(store.getAll());
      });
    });
  }

  function getRace(id) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        return lsRead().find(function (r) {
          return r.id === id;
        });
      }
      if (mode === "none") {
        return Promise.reject(new Error("storage-unavailable"));
      }
      return txStore("readonly").then(function (store) {
        return reqToPromise(store.get(id));
      });
    });
  }

  function putRace(race) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        var list = lsRead();
        var i = list.findIndex(function (r) {
          return r.id === race.id;
        });
        if (i >= 0) list[i] = race;
        else list.push(race);
        lsWrite(list);
        return;
      }
      if (mode === "none") {
        return Promise.reject(new Error("storage-unavailable"));
      }
      return txStore("readwrite").then(function (store) {
        return reqToPromise(store.put(race));
      });
    });
  }

  function deleteRace(id) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        lsWrite(
          lsRead().filter(function (r) {
            return r.id !== id;
          })
        );
        return;
      }
      if (mode === "none") {
        return Promise.reject(new Error("storage-unavailable"));
      }
      return txStore("readwrite").then(function (store) {
        return reqToPromise(store.delete(id));
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
      return txStore("readwrite").then(function (store) {
        return reqToPromise(store.clear());
      });
    });
  }

  function seedAll() {
    if (!SEED_RACES.length) {
      return Promise.reject(new Error("no-seed"));
    }
    var now = new Date().toISOString();
    return clearAll().then(function () {
      return Promise.all(
        SEED_RACES.map(function (r) {
          return putRace(
            normalizeRace(Object.assign({}, r, { createdAt: now, updatedAt: now }))
          );
        })
      );
    });
  }

  function seedIfEmpty() {
    return listRaces().then(function (items) {
      var ver = getSeedVersion();
      var needsKeepSeed = ver < SEED_VERSION && SEED_RACES.length;
      if (!items.length) {
        if (!SEED_RACES.length) return items;
        return seedAll().then(function () {
          setSeedVersion(SEED_VERSION);
          return listRaces();
        });
      }
      if (needsKeepSeed) {
        return seedAll().then(function () {
          setSeedVersion(SEED_VERSION);
          return listRaces();
        });
      }
      return items;
    });
  }

  function exportPayload(races) {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: "marathon-log",
      storage: storageMode,
      races: races.map(function (r) {
        return Object.assign({}, r);
      }),
    };
  }

  function importPayload(data, replace) {
    var races = (data && data.races) || [];
    if (!Array.isArray(races)) {
      return Promise.reject(new Error("invalid"));
    }
    var run = replace ? clearAll() : Promise.resolve();
    return run.then(function () {
      return Promise.all(
        races.map(function (raw) {
          return putRace(normalizeRace(raw));
        })
      );
    });
  }

  function reseedFromKeep() {
    if (!SEED_RACES.length) {
      return Promise.reject(new Error("no-seed"));
    }
    return seedAll().then(function () {
      setSeedVersion(SEED_VERSION);
      return listRaces();
    });
  }

  function getStorageMode() {
    return initStorage().then(function () {
      return storageMode;
    });
  }

  global.MarathonDb = {
    listRaces: listRaces,
    getRace: getRace,
    putRace: putRace,
    deleteRace: deleteRace,
    seedIfEmpty: seedIfEmpty,
    reseedFromKeep: reseedFromKeep,
    normalizeRace: normalizeRace,
    exportPayload: exportPayload,
    importPayload: importPayload,
    newId: newId,
    getStorageMode: getStorageMode,
  };
})(window);
