(function (global) {
  "use strict";

  var SEED_RACES = global.MarathonKeepSeed || [];
  var storageMode = "supabase";

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
    if (raw && raw.recordKind === "run" && global.MarathonRunLog) {
      return global.MarathonRunLog.normalizeRunLog(raw);
    }
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
    return Promise.resolve(global.PortalCloud.list("marathon-log"));
  }

  function getRace(id) {
    return Promise.resolve(global.PortalCloud.read("marathon-log", id));
  }

  function putRace(race) {

    return global.PortalCloud.write("marathon-log", race.id, race);
  }

  function deleteRace(id) {
    return global.PortalCloud.write("marathon-log", id, null);
  }

  function clearAll() {
    return global.PortalCloud.clear("marathon-log");
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

  function seedIfEmpty() { return listRaces(); }

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
      return listRaces();
    });
  }

  function getStorageMode() { return Promise.resolve("supabase"); }

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
