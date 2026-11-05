(function (global) {
  "use strict";

  /** 왓챠피디아 export CSV: ID,URL,Title,Type,Year,Directors,WatchedAt,Rating,Review,Spoiler */

  function parseCsvRecords(line) {
    var rows = [];
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
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && line[i + 1] === "\n") i += 1;
        out.push(cur);
        if (out.some(function (cell) { return cell.trim(); })) rows.push(out);
        out = [];
        cur = "";
      } else cur += ch;
    }
    if (inQ) throw new Error("CSV 따옴표가 닫히지 않았습니다.");
    out.push(cur);
    if (out.some(function (cell) { return cell.trim(); })) rows.push(out);
    return rows;
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
    var lines = parseCsvRecords(text);
    if (!lines.length) return [];

    var header = lines[0].map(function (h) {
      return h.trim().toLowerCase();
    });
    var start = 0;
    if (
      header.indexOf("title") >= 0 ||
      header[0] === "id" ||
      header.join(",").indexOf("title") >= 0
    ) {
      start = 1;
      if (header.indexOf("id") < 0 || header.indexOf("title") < 0 || new Set(header).size !== header.length) {
        throw new Error("CSV 헤더에는 중복 없는 ID와 Title 열이 필요합니다.");
      }
    }

    var items = [];
    for (var li = start; li < lines.length; li++) {
      var cols = lines[li];
      if (start === 1 && cols.length !== header.length) throw new Error("CSV " + (li + 1) + "번째 레코드의 열 수가 다릅니다.");
      if (!cols.length || !cols[2] && !cols[0]) continue;

      var row = {};
      if (header.length >= 3 && start === 1) {
        header.forEach(function (key, i) {
          row[key] = cols[i];
        });
        items.push({
          externalId: row.id,
          sourceUrl: row.url || "",
          title: row.title,
          contentType: mapWatchaType(row.type),
          year: row.year || "",
          directors: row.directors || "",
          watchedAt: row.watchedat || row.watched_at || "",
          rating: row.rating || "",
          review: row.review || "",
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
