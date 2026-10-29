(function (global) {
  "use strict";

  var EXPORT_FORMAT_VERSION = 1;

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

  function clearAll() {
    return global.PortalCloud.clear("how-many-points");
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

  function seedIfEmpty() { return listRatings(); }

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
