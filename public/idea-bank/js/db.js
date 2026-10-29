(function (global) {
  "use strict";

  var EXPORT_FORMAT_VERSION = 1;

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function titleFromBody(body) {
    var firstLine = text(body).split(/\r?\n/).find(function (line) { return line.trim(); }) || "";
    firstLine = firstLine.trim();
    return firstLine.length > 30 ? firstLine.slice(0, 29) + "…" : firstLine;
  }

  function normalizeIdea(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    var now = new Date().toISOString();
    var body = text(typeof source.body === "string" ? source.body : (source.content || source.rawText));
    var title = text(source.title || source.name) || titleFromBody(body) || "제목 없음";
    return Object.assign({}, source, {
      id: text(source.id) || slugFromTitle(title, {}),
      title: title,
      body: body,
      content: body,
      rawText: body,
      summary: text(source.summary) || title,
      tags: Array.isArray(source.tags) ? source.tags.filter(function (tag) { return text(tag); }) : [],
      status: text(source.status) || "inbox",
      source: text(source.source) || "quick-capture",
      links: text(source.links),
      memo: text(source.memo),
      targetCategory: text(source.targetCategory) || "study",
      hubProjectId: text(source.hubProjectId) || text(source.id),
      pinned: !!source.pinned,
      images: Array.isArray(source.images) ? source.images : [],
      createdAt: text(source.createdAt) || now,
      updatedAt: text(source.updatedAt) || text(source.createdAt) || now,
    });
  }

  function getStorageMode() { return Promise.resolve("supabase"); }

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

  function listIdeas() {
    return Promise.resolve(global.PortalCloud.list("idea-bank")).then(function (rows) { return rows.map(normalizeIdea); });
  }

  function getIdea(id) {
    return Promise.resolve(global.PortalCloud.read("idea-bank", id)).then(function (idea) {
      return idea ? normalizeIdea(idea) : null;
    });
  }

  function putIdea(idea) {
    idea = normalizeIdea(idea);
    return global.PortalCloud.write("idea-bank", idea.id, idea);
  }

  function deleteIdea(id) {
    return global.PortalCloud.write("idea-bank", id, null);
  }

  function clearAll() {
    return global.PortalCloud.clear("idea-bank");
  }

  function seedIfEmpty() { return listIdeas(); }

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
          return putIdea(normalizeIdea(Object.assign({}, raw, {
            id: raw.id || slugFromTitle(raw.title || raw.body || "idea", {}),
            createdAt: raw.createdAt || now,
            updatedAt: raw.updatedAt || now,
          })));
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
    normalizeIdea: normalizeIdea,
    titleFromBody: titleFromBody,
  };
})(window);
