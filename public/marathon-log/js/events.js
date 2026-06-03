(function (global) {
  "use strict";

  /** 대표 개최일(MM-DD). 실제 대회는 연도마다 ±수일 차이날 수 있음 */
  var EVENT_CATALOG = [
    { mmdd: "01-31", name: "인사이더런", distance: "10k" },
    { mmdd: "02-21", name: "동계국제마라톤", distance: "32k" },
    { mmdd: "02-23", name: "런데이", distance: "5k" },
    { mmdd: "03-01", name: "삼일절마라톤", distance: "5k" },
    { mmdd: "03-15", name: "서울동아마라톤", distance: "full" },
    { mmdd: "03-17", name: "서울마라톤", distance: "full" },
    { mmdd: "03-19", name: "서울마라톤", distance: "full" },
    { mmdd: "03-30", name: "인천국제하프마라톤", distance: "half" },
    { mmdd: "04-14", name: "안산시 육상연맹회장배", distance: "10k" },
    { mmdd: "04-19", name: "경기마라톤", distance: "full" },
    { mmdd: "04-20", name: "경기마라톤", distance: "full" },
    { mmdd: "05-10", name: "화성효마라톤", distance: "5k" },
    { mmdd: "05-12", name: "인천국제하프마라톤", distance: "half" },
    { mmdd: "05-16", name: "서울한강울트라마라톤", distance: "50k" },
    { mmdd: "05-25", name: "인천영종국제도시마라톤", distance: "10k" },
    { mmdd: "04-07", name: "경주 벚꽃마라톤", distance: "10k" },
    { mmdd: "05-05", name: "서울하프마라톤", distance: "half" },
    { mmdd: "05-19", name: "대전 마라톤", distance: "full" },
    { mmdd: "06-02", name: "부산 마라톤", distance: "full" },
    { mmdd: "06-14", name: "인천광역시육상연맹회장배", distance: "half" },
    { mmdd: "09-20", name: "공주백제마라톤", distance: "full" },
    { mmdd: "09-28", name: "대부도하프마라톤", distance: "half" },
    { mmdd: "09-29", name: "춘천마라톤", distance: "full" },
    { mmdd: "10-03", name: "국제국민마라톤", distance: "10k" },
    { mmdd: "10-17", name: "경주국제마라톤", distance: "full" },
    { mmdd: "10-26", name: "춘천마라톤", distance: "full" },
    { mmdd: "11-03", name: "JTBC 마라톤", distance: "10k" },
    { mmdd: "11-16", name: "MBN 서울마라톤", distance: "half" },
    { mmdd: "11-17", name: "손기정평화마라톤", distance: "half" },
    { mmdd: "12-06", name: "한강시민마라톤", distance: "10k" },
    { mmdd: "11-10", name: "광주 마라톤", distance: "full" },
    { mmdd: "12-01", name: "FWD 대구 마라톤", distance: "full" },
  ];

  var CATALOG_NEAR_DAYS = 3;

  function parseDateOnly(str) {
    if (!str || str.length < 10) return null;
    var parts = str.split("-").map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function dayDiff(a, b) {
    return Math.round(Math.abs(a.getTime() - b.getTime()) / 86400000);
  }

  function mmddFromDateStr(str) {
    return str.length >= 10 ? str.slice(5, 10) : "";
  }

  function suggestEventNames(dateStr, pastRaces) {
    if (!dateStr) return [];

    var selected = parseDateOnly(dateStr);
    if (!selected) return [];

    var mmdd = mmddFromDateStr(dateStr);
    var year = dateStr.slice(0, 4);
    var seen = {};
    var out = [];

    function add(entry) {
      var key = entry.name.trim().toLowerCase();
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(entry);
    }

    (pastRaces || []).forEach(function (r) {
      if (!r.date || !r.name) return;
      if (r.date.slice(5, 10) === mmdd) {
        add({
          name: r.name,
          distance: r.distance || null,
          source: "history",
          hint: r.date.slice(0, 4) + "년 기록",
        });
      }
    });

    EVENT_CATALOG.forEach(function (ev) {
      var evDate = parseDateOnly(year + "-" + ev.mmdd);
      if (!evDate) return;
      var diff = dayDiff(selected, evDate);
      if (diff === 0 || diff <= CATALOG_NEAR_DAYS) {
        add({
          name: ev.name,
          distance: ev.distance || null,
          source: "catalog",
          hint: diff === 0 ? "대표 개최일" : "±" + diff + "일",
        });
      }
    });

    out.sort(function (a, b) {
      var rank = { history: 0, catalog: 1 };
      var ra = rank[a.source] != null ? rank[a.source] : 2;
      var rb = rank[b.source] != null ? rank[b.source] : 2;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, "ko");
    });

    return out;
  }

  global.MarathonEvents = {
    suggestEventNames: suggestEventNames,
  };
})(window);
