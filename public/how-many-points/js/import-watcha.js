(function (global) {
  "use strict";

  /** 왓챠피디아 export CSV: ID,URL,Title,Type,Year,Directors,WatchedAt,Rating,Review,Spoiler */

  function parseCsvLine(line) {
    var out = [];
    var cur = "";
    var inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i += 1;
          } else inQ = false;
        } else cur += ch;
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  function mapWatchaType(t) {
    var u = String(t || "").toUpperCase();
    if (u === "MOVIE" || u === "MOVIES") return "movie";
    if (u === "TV" || u === "TV_SEASONS" || u === "SERIES") return "series";
    if (u === "BOOK" || u === "BOOKS") return "book";
    if (u === "WEBTOON" || u === "WEBTOONS") return "webtoon";
    return "other";
  }

  function parseWatchaCsv(text) {
    text = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!text) return [];
    var lines = text.split(/\r?\n/).filter(function (l) {
      return l.trim();
    });
    if (!lines.length) return [];

    var header = parseCsvLine(lines[0]).map(function (h) {
      return h.trim().toLowerCase();
    });
    var start = 0;
    if (
      header.indexOf("title") >= 0 ||
      header[0] === "id" ||
      header.join(",").indexOf("title") >= 0
    ) {
      start = 1;
    }

    var items = [];
    for (var li = start; li < lines.length; li++) {
      var cols = parseCsvLine(lines[li]);
      if (!cols.length || !cols[2] && !cols[0]) continue;

      var row = {};
      if (header.length >= 3 && start === 1) {
        header.forEach(function (key, i) {
          row[key] = cols[i];
        });
        items.push({
          externalId: row.id || cols[0],
          sourceUrl: row.url || cols[1],
          title: row.title || cols[2],
          contentType: mapWatchaType(row.type || cols[3]),
          year: row.year || cols[4],
          directors: row.directors || cols[5],
          watchedAt: row.watchedat || row.watched_at || cols[6],
          rating: row.rating || cols[7],
          review: row.review || cols[8],
          source: "watcha",
        });
      } else {
        items.push({
          externalId: cols[0],
          sourceUrl: cols[1],
          title: cols[2],
          contentType: mapWatchaType(cols[3]),
          year: cols[4],
          directors: cols[5],
          watchedAt: cols[6],
          rating: cols[7],
          review: cols[8],
          source: "watcha",
        });
      }
    }
    return items;
  }

  global.HowManyPointsWatchaImport = {
    parseWatchaCsv: parseWatchaCsv,
  };
})(window);
