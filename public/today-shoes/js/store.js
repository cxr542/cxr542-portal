(function (global) {
  "use strict";

  var LS_KEY = "today-shoes-shoes-v1";
  var API_KEY_LS = "today-shoes-gemini-api-key";
  var PORTAL_LEGACY_KEY = "cxr542-today-shoes-v1";

  function randomId() {
    return Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  }

  function formatRecommendation(fields) {
    var name = (fields.displayName || "러닝화").trim();
    var lines = [name];
    if (fields.brand || fields.model) {
      lines.push([fields.brand, fields.model].filter(Boolean).join(" · "));
    }
    if (fields.traits) lines.push(fields.traits.trim());
    if (fields.bestFor) lines.push("추천 용도:\n" + fields.bestFor.trim());
    if (fields.caution) lines.push("참고:\n" + fields.caution.trim());
    return lines.filter(Boolean).join("\n\n");
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    var imageUri = String(raw.imageUri || raw.imageUris?.front || "").trim();
    if (!imageUri) return null;
    var imageUris = raw.imageUris && typeof raw.imageUris === "object" ? raw.imageUris : { front: imageUri };
    return {
      id: String(raw.id || randomId()),
      imageUri: imageUri,
      imageUris: imageUris,
      nickname: String(raw.nickname || raw.model || "러닝화").trim(),
      brand: raw.brand ? String(raw.brand) : undefined,
      model: raw.model ? String(raw.model) : undefined,
      traits: raw.traits ? String(raw.traits) : raw.feeling ? String(raw.feeling) : undefined,
      recommendation: String(raw.recommendation || ""),
      createdAt: Number(raw.createdAt) || Date.now(),
      source: raw.source === "camera" || raw.source === "album" ? raw.source : "album",
      geminiAnalyzed: raw.geminiAnalyzed === true,
    };
  }

  function load() {
    try {
      var raw = JSON.parse(globalThis.PortalStorage.getItem(LS_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw
        .map(normalize)
        .filter(Boolean)
        .sort(function (a, b) {
          return b.createdAt - a.createdAt;
        });
    } catch (e) {
      return [];
    }
  }

  function save(shoes) {
    try {
      globalThis.PortalStorage.setItem(LS_KEY, JSON.stringify(shoes));
    } catch (e) {
      alert("저장 요청을 처리하지 못했습니다. 계정·저장의 저장 상태를 확인해 주세요.");
    }
    return shoes;
  }

  function importList(rows) {
    if (!Array.isArray(rows)) return 0;
    var list = rows
      .map(normalize)
      .filter(Boolean)
      .sort(function (a, b) {
        return b.createdAt - a.createdAt;
      });
    save(list);
    return list.length;
  }

  function add(shoe) {
    var next = normalize(shoe);
    if (!next) throw new Error("저장할 신발 정보가 없습니다.");
    var list = load();
    list.unshift(next);
    save(list);
    return next;
  }

  function remove(id) {
    save(load().filter(function (s) {
      return s.id !== id;
    }));
  }

  function update(id, patch) {
    save(
      load().map(function (s) {
        if (s.id !== id) return s;
        return normalize(Object.assign({}, s, patch, { id: s.id }));
      })
    );
  }

  function importPortalLegacy() {
    try {
      var raw = JSON.parse(globalThis.PortalStorage.getItem(PORTAL_LEGACY_KEY) || "[]");
      if (!Array.isArray(raw) || !raw.length) return 0;
      var existing = load();
      var ids = {};
      existing.forEach(function (s) {
        ids[s.id] = true;
      });
      var added = 0;
      raw.forEach(function (row) {
        if (!row || !row.model) return;
        var id = "legacy-" + (row.id || randomId());
        if (ids[id]) return;
        var shoe = normalize({
          id: id,
          imageUri:
            "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#374151" width="100%" height="100%"/><text x="50%" y="50%" fill="#9ca3af" font-size="20" text-anchor="middle" dy=".3em">👟</text></svg>'
            ),
          nickname: row.model,
          traits: row.feeling || "",
          recommendation: row.tag ? "추천 용도:\n" + row.tag : "",
          createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
          geminiAnalyzed: false,
        });
        if (shoe) {
          existing.push(shoe);
          added += 1;
        }
      });
      if (added) save(existing);
      return added;
    } catch (e) {
      return 0;
    }
  }

  function seedDemoIfEmpty() { return false; }

  function loadApiKey() {
    try {
      return (globalThis.PortalStorage.getItem(API_KEY_LS) || "").trim();
    } catch (e) {
      return "";
    }
  }

  function saveApiKey(key) {
    try {
      globalThis.PortalStorage.setItem(API_KEY_LS, (key || "").trim());
    } catch (e) {}
  }

  global.TodayShoesStore = {
    LS_KEY: LS_KEY,
    API_KEY_LS: API_KEY_LS,
    formatRecommendation: formatRecommendation,
    load: load,
    save: save,
    add: add,
    remove: remove,
    update: update,
    importPortalLegacy: importPortalLegacy,
    seedDemoIfEmpty: seedDemoIfEmpty,
    loadApiKey: loadApiKey,
    saveApiKey: saveApiKey,
    importList: importList,
  };
})(window);
