(function (global) {
  "use strict";

  var EXPORT_FORMAT_VERSION = 1;
  var importPlans = new WeakMap();

  var CONTENT_TYPES = ["movie", "series", "book", "webtoon", "other"];

  function getStorageMode() { return Promise.resolve("supabase"); }

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
    return Promise.resolve(global.PortalCloud.list("how-many-points"));
  }

  function getRating(id) {
    return Promise.resolve(global.PortalCloud.read("how-many-points", id));
  }

  function putRating(item) {

    return global.PortalCloud.write("how-many-points", item.id, item);
  }

  function deleteRating(id) {
    return global.PortalCloud.write("how-many-points", id, null);
  }

  async function prepareImport(items, options) {
    await global.PortalCloud.flush();
    await global.PortalCloud.load();
    var existing = await listRatings();
    var plan = global.HowManyPointsImportPlan.build(existing, items, options || {});
    var preview = Object.freeze(Object.assign({}, plan.summary));
    plan.records = global.PortalCloud.snapshot("how-many-points");
    plan.overwrite = !!(options && options.overwrite === true);
    plan.backup = Object.assign(exportPayload(plan.records.filter(function (r) { return r.value !== null; }).map(function (r) { return r.value; })), { records: plan.records });
    importPlans.set(preview, plan);
    return preview;
  }

  async function createImportBackup(preview) {
    var plan = importPlans.get(preview);
    if (!plan) throw new Error("미리보기를 다시 생성하세요.");
    var id = plan.backupAttemptKey || global.crypto.randomUUID();
    plan.backupAttemptKey = id;
    await global.PortalCloud.retry("how-many-points-backups", id);
    if (!global.PortalCloud.has("how-many-points-backups", id)) {
      await global.PortalCloud.write("how-many-points-backups", id, plan.backup);
    }
    plan.backupKey = id;
    return JSON.stringify(plan.backup, null, 2);
  }

  async function commitImport(preview) {
    var plan = importPlans.get(preview);
    if (!plan || !plan.backupKey) throw new Error("JSON 백업을 먼저 저장하세요.");
    importPlans.delete(preview);
    return global.PortalCloud.mergeRatings({
      p_snapshot: plan.records,
      p_changes: plan.writes,
      p_backup_key: plan.backupKey,
      p_overwrite: plan.overwrite,
    });
  }

  async function importItems(items, replace) {
    if (replace) throw new Error("전체 교체는 지원하지 않습니다. 미리보기에서 병합하세요.");
    var preview = await prepareImport(items);
    await createImportBackup(preview);
    return commitImport(preview);
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
    if (!data || (data.version !== undefined && data.version !== EXPORT_FORMAT_VERSION) || !Array.isArray(data.ratings)) {
      return Promise.reject(new Error("지원하지 않는 JSON 백업 형식입니다."));
    }
    return importItems(data.ratings, replace);
  }

  function seedIfEmpty() { return listRatings(); }

  global.HowManyPointsDb = {
    CONTENT_TYPES: CONTENT_TYPES,
    listRatings: listRatings,
    getRating: getRating,
    putRating: putRating,
    deleteRating: deleteRating,
    importItems: importItems,
    prepareImport: prepareImport,
    createImportBackup: createImportBackup,
    commitImport: commitImport,
    exportPayload: exportPayload,
    importPayload: importPayload,
    seedIfEmpty: seedIfEmpty,
    slugFromTitle: slugFromTitle,
    normalizeRating: normalizeRating,
    normalizeItem: normalizeItem,
    getStorageMode: getStorageMode,
  };
})(window);
