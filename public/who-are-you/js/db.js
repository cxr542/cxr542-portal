(function (global) {
  "use strict";

  var DB_NAME = "who-are-you";
  var DB_VERSION = 1;
  var EXPORT_VERSION = 1;
  var LS_BUNDLE = "who-are-you-bundle";
  var LS_SUMMARY = "who-are-you-summary";

  var STORES = [
    "profile",
    "employments",
    "projects",
    "educations",
    "certifications",
    "documents",
  ];

  var dbPromise = null;
  var storageMode = "indexeddb";
  var storageReady = null;

  function probeIndexedDB() {
    return new Promise(function (resolve) {
      if (!global.indexedDB) {
        resolve(false);
        return;
      }
      var name = "__way_probe_" + Date.now();
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
        e.target.result.close();
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
        localStorage.setItem("__way_probe__", "1");
        localStorage.removeItem("__way_probe__");
        storageMode = "localstorage";
        return "localstorage";
      } catch (e) {
        storageMode = "none";
        return "none";
      }
    });
    return storageReady;
  }

  function defaultBundle() {
    return {
      profile: defaultProfile(),
      employments: [],
      projects: [],
      educations: [],
      certifications: [],
      documents: [],
    };
  }

  function defaultProfile() {
    return {
      id: "profile",
      name: "",
      nameEn: "",
      email: "",
      phone: "",
      headline: "",
      summary: "",
      targetRole: "",
      skills: [],
      links: [],
      updatedAt: new Date().toISOString(),
    };
  }

  function lsReadBundle() {
    try {
      var raw = localStorage.getItem(LS_BUNDLE);
      if (!raw) return defaultBundle();
      var b = JSON.parse(raw);
      return Object.assign(defaultBundle(), b);
    } catch (e) {
      return defaultBundle();
    }
  }

  function lsWriteBundle(bundle) {
    localStorage.setItem(LS_BUNDLE, JSON.stringify(bundle));
    syncSummary(bundle);
  }

  function syncSummary(bundle) {
    try {
      localStorage.setItem(
        LS_SUMMARY,
        JSON.stringify({
          employments: (bundle.employments || []).length,
          projects: (bundle.projects || []).length,
          documents: (bundle.documents || []).length,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (e) {}
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
        STORES.forEach(function (name) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: "id" });
          }
        });
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
        reject(req.error || new Error("idb"));
      };
    });
  }

  function runTx(storeName, mode, run) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, mode);
        var store = tx.objectStore(storeName);
        var settled = false;
        function finish(err, val) {
          if (settled) return;
          settled = true;
          if (err) reject(err);
          else resolve(val);
        }
        try {
          var out = run(store);
          if (out && typeof out.then === "function") {
            out.then(
              function (v) {
                finish(null, v);
              },
              finish
            );
          } else {
            tx.oncomplete = function () {
              finish(null, out);
            };
          }
        } catch (err) {
          finish(err);
        }
        tx.onerror = function () {
          finish(tx.error || new Error("tx"));
        };
      });
    });
  }

  function slug(title, existing) {
    var base = String(title)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\uac00-\ud7a3-]/g, "")
      .slice(0, 32);
    if (!base) base = "item";
    var id = base;
    var n = 2;
    while (existing[id]) {
      id = base + "-" + n;
      n += 1;
    }
    return id;
  }

  function getAllStore(storeName) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        return lsReadBundle()[storeName] || [];
      }
      if (mode === "none") return Promise.reject(new Error("storage-unavailable"));
      if (storeName === "profile") {
        return runTx("profile", "readonly", function (store) {
          return idbRequest(store.get("profile")).then(function (p) {
            return p || defaultProfile();
          });
        });
      }
      return runTx(storeName, "readonly", function (store) {
        return idbRequest(store.getAll());
      });
    });
  }

  function putStoreItem(storeName, item) {
    item.updatedAt = new Date().toISOString();
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        var b = lsReadBundle();
        if (storeName === "profile") {
          b.profile = item;
        } else {
          var list = b[storeName] || [];
          var i = list.findIndex(function (x) {
            return x.id === item.id;
          });
          if (i >= 0) list[i] = item;
          else list.push(item);
          b[storeName] = list;
        }
        lsWriteBundle(b);
        return item;
      }
      if (mode === "none") return Promise.reject(new Error("storage-unavailable"));
      return runTx(storeName, "readwrite", function (store) {
        return idbRequest(store.put(item)).then(function () {
          return refreshIdbSummary();
        });
      }).then(function () {
        return item;
      });
    });
  }

  function deleteStoreItem(storeName, id) {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        var b = lsReadBundle();
        b[storeName] = (b[storeName] || []).filter(function (x) {
          return x.id !== id;
        });
        lsWriteBundle(b);
        return;
      }
      if (mode === "none") return Promise.reject(new Error("storage-unavailable"));
      return runTx(storeName, "readwrite", function (store) {
        return idbRequest(store.delete(id));
      }).then(refreshIdbSummary);
    });
  }

  function refreshIdbSummary() {
    return loadBundle().then(function (b) {
      syncSummary(b);
    });
  }

  function loadBundle() {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") return lsReadBundle();
      if (mode === "none") return Promise.reject(new Error("storage-unavailable"));
      return Promise.all(
        STORES.map(function (name) {
          return getAllStore(name);
        })
      ).then(function (parts) {
        var bundle = {
          profile: parts[0] || defaultProfile(),
          employments: parts[1] || [],
          projects: parts[2] || [],
          educations: parts[3] || [],
          certifications: parts[4] || [],
          documents: parts[5] || [],
        };
        syncSummary(bundle);
        return bundle;
      });
    });
  }

  function saveProfile(profile) {
    profile.id = "profile";
    return putStoreItem("profile", profile);
  }

  function clearBundle() {
    return initStorage().then(function (mode) {
      if (mode === "localstorage") {
        lsWriteBundle(defaultBundle());
        return;
      }
      return Promise.all(
        STORES.map(function (name) {
          return runTx(name, "readwrite", function (store) {
            return idbRequest(store.clear());
          });
        })
      ).then(function () {
        return saveProfile(defaultProfile());
      });
    });
  }

  function importBundle(data, replace) {
    var incoming = {
      profile: data.profile || defaultProfile(),
      employments: data.employments || [],
      projects: data.projects || [],
      educations: data.educations || [],
      certifications: data.certifications || [],
      documents: data.documents || [],
    };
    incoming.profile.id = "profile";
    var run = replace ? clearBundle() : Promise.resolve();
    return run.then(function () {
      return saveProfile(incoming.profile).then(function () {
        var lists = ["employments", "projects", "educations", "certifications", "documents"];
        return lists.reduce(function (chain, storeName) {
          return chain.then(function () {
            return Promise.all(
              (incoming[storeName] || []).map(function (item) {
                if (!item.id) item.id = slug(item.title || item.projectName || item.companyName || "item", {});
                return putStoreItem(storeName, item);
              })
            );
          });
        }, Promise.resolve());
      });
    });
  }

  function exportPayload(bundle) {
    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      bundle: bundle,
    };
  }

  function seedIfEmpty() {
    return loadBundle().then(function (b) {
      if (!b.profile.name && !b.employments.length && !b.documents.length) {
        return fetch("data/default-bundle.json", { cache: "no-store" })
          .then(function (res) {
            if (!res.ok) throw new Error("seed-not-found");
            return res.json();
          })
          .then(function (seed) {
            return importBundle(seed.bundle || seed, true).then(loadBundle);
          })
          .catch(function () {
            return b;
          });
      }
      return b;
    });
  }

  global.WhoAreYouDb = {
    DOCUMENT_CATEGORIES: {
      motivation: "지원동기",
      growth: "성장과정",
      strength: "성격·장단점",
      vision: "입사 후 포부",
      full: "통합 자기소개서",
      custom: "기타",
    },
    EMPLOYMENT_TYPES: {
      regular: "정규직",
      contract: "계약직",
      freelance: "프리랜서",
    },
    loadBundle: loadBundle,
    saveProfile: saveProfile,
    getProfile: function () {
      return getAllStore("profile");
    },
    listEmployments: function () {
      return getAllStore("employments");
    },
    listProjects: function () {
      return getAllStore("projects");
    },
    listEducations: function () {
      return getAllStore("educations");
    },
    listCertifications: function () {
      return getAllStore("certifications");
    },
    listDocuments: function () {
      return getAllStore("documents");
    },
    putEmployment: function (item) {
      return putStoreItem("employments", item);
    },
    putProject: function (item) {
      return putStoreItem("projects", item);
    },
    putEducation: function (item) {
      return putStoreItem("educations", item);
    },
    putCertification: function (item) {
      return putStoreItem("certifications", item);
    },
    putDocument: function (item) {
      return putStoreItem("documents", item);
    },
    deleteEmployment: function (id) {
      return deleteStoreItem("employments", id);
    },
    deleteProject: function (id) {
      return deleteStoreItem("projects", id);
    },
    deleteEducation: function (id) {
      return deleteStoreItem("educations", id);
    },
    deleteCertification: function (id) {
      return deleteStoreItem("certifications", id);
    },
    deleteDocument: function (id) {
      return deleteStoreItem("documents", id);
    },
    getItem: function (storeName, id) {
      return getAllStore(storeName).then(function (list) {
        if (storeName === "profile") return list;
        return (list || []).find(function (x) {
          return x.id === id;
        });
      });
    },
    importBundle: importBundle,
    exportPayload: exportPayload,
    seedIfEmpty: seedIfEmpty,
    slug: slug,
    getStorageMode: function () {
      return initStorage().then(function () {
        return storageMode;
      });
    },
  };
})(window);
