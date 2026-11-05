(function (global) {
  "use strict";

  function identity(item) {
    var ext = String(item.externalId || item.watchaId || "").trim();
    return ext ? JSON.stringify([String(item.source || "watcha").trim().toLowerCase(), ext]) : null;
  }

  function build(existing, incoming, options) {
    if (!Array.isArray(incoming) || !incoming.length) throw new Error("가져올 항목이 없습니다.");
    var byIdentity = new Map();
    var byId = new Map();
    var usedIds = Object.create(null);
    existing.forEach(function (item) {
      var key = identity(item);
      if (key) {
        if (byIdentity.has(key)) throw new Error("기존 데이터에 중복 출처 ID가 있습니다. 원본을 보존하고 가져오기를 중단합니다.");
        byIdentity.set(key, item);
      }
      byId.set(item.id, item);
      usedIds[item.id] = true;
    });
    var writes = new Map();
    var seen = new Set();
    var summary = { added: 0, duplicates: 0, changed: 0, updated: 0, repeated: 0, total: existing.length };
    incoming.forEach(function (raw) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw) || typeof raw.title !== "string" || !raw.title.trim()) {
        throw new Error("제목이 없는 항목이 있습니다. 파일을 확인하세요.");
      }
      if (options.format === "csv" && !String(raw.externalId || "").trim()) {
        throw new Error("왓챠 ID가 없는 CSV 행이 있습니다.");
      }
      if (raw.id !== undefined && (typeof raw.id !== "string" || !raw.id.trim())) throw new Error("항목 ID 형식이 올바르지 않습니다.");
      ["externalId", "watchaId", "source", "review"].forEach(function (field) {
        if (raw[field] !== undefined && raw[field] !== null && typeof raw[field] !== "string") throw new Error("항목의 " + field + " 형식이 올바르지 않습니다.");
      });
      var key = identity(raw);
      var token = key || (raw.id ? "id:" + raw.id : null);
      if (token && seen.has(token)) { summary.repeated += 1; return; }
      if (token) seen.add(token);
      var prev = key ? byIdentity.get(key) : byId.get(raw.id);
      if (prev && identity(prev) !== key) prev = null;
      var item = global.HowManyPointsDb.normalizeItem(raw, usedIds);
      if (prev) {
        summary.duplicates += 1;
        item.id = prev.id;
        item.createdAt = prev.createdAt;
        item.posterUrl = item.posterUrl || prev.posterUrl;
        var changed = Object.keys(item).some(function (field) {
          return ["id", "createdAt", "updatedAt"].indexOf(field) < 0 && item[field] !== prev[field];
        });
        if (changed) summary.changed += 1;
        if (changed && options.overwrite === true) {
          writes.set(item.id, Object.assign({}, prev, item));
          summary.updated += 1;
        }
        return;
      }
      var base = item.id;
      var suffix = 2;
      while (usedIds[item.id]) { item.id = base + "-" + suffix; suffix += 1; }
      usedIds[item.id] = true;
      writes.set(item.id, item);
      summary.added += 1;
    });
    summary.total += summary.added;
    return { summary: summary, writes: Array.from(writes.values()) };
  }

  global.HowManyPointsImportPlan = { build: build };
})(window);
