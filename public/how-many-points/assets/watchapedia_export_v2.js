/**
 * watchapedia export v2 — API 403 시 DOM 수집 fallback
 * 원본: erinyskim/watchapedia-export (API 경로)
 */
(async function () {
  "use strict";

  function userIdFromPage() {
    var m = location.pathname.match(/\/users\/([^/]+)/);
    if (m) return m[1];
    var a = document.querySelector('a[href*="/users/"]');
    if (a) {
      var hm = a.href.match(/\/users\/([^/?#]+)/);
      if (hm) return hm[1];
    }
    return null;
  }

  function watchaHeaders() {
    var h = {
      "x-watcha-client": "watcha-WebApp",
      "x-watcha-client-language": "ko",
      "x-watcha-client-region": "KR",
      "x-watcha-client-version": "2.1.0",
      Accept: "application/json",
      Referer: location.href,
    };
    var keys = [
      "access_token",
      "watcha_access_token",
      "WATCHA_ACCESS_TOKEN",
      "token",
    ];
    for (var i = 0; i < keys.length; i++) {
      try {
        var v = localStorage.getItem(keys[i]);
        if (v && v.length > 10) {
          h.Authorization = "Bearer " + v.replace(/^Bearer\s+/i, "");
          break;
        }
      } catch (e) {}
    }
    return h;
  }

  function apiGet(path) {
    return fetch("https://api-pedia.watcha.com" + path, {
      credentials: "include",
      headers: watchaHeaders(),
    }).then(function (res) {
      if (!res.ok) {
        var err = new Error("HTTP " + res.status);
        err.status = res.status;
        throw err;
      }
      return res.json();
    }).then(function (j) {
      return j.result;
    });
  }

  function rowFromApi(e) {
    var code = e.content.code;
    var type = e.content.content_type === "tv_seasons" ? "TV" : "MOVIE";
    var rating = +e.user_content_action.rating / 2;
    return {
      id: code,
      url: "https://pedia.watcha.com/ko-KR/contents/" + code,
      title: e.content.title,
      type: type,
      year: e.content.year || "",
      directors: (e.content.director_names || []).join(),
      watchedAt: e.user_content_action.watched_at || e.created_at || "",
      rating: rating,
      review: (e.text || "").trim(),
      spoiler: e.spoiler || "",
    };
  }

  async function fetchAll(contentType, onChunk) {
    var path =
      "/api/users/" +
      userId +
      "/contents/" +
      contentType +
      "/ratings?size=30";
    var items = [];
    var page = await apiGet(path);
    (page.result || []).forEach(function (e) {
      items.push(rowFromApi(e));
    });
    if (onChunk) onChunk(items.length);
    var next = page.next_uri;
    while (next) {
      if (next.indexOf("http") === 0) {
        try {
          var u = new URL(next);
          next = u.pathname + u.search;
        } catch (e) {}
      }
      page = await apiGet(next);
      (page.result || []).forEach(function (e) {
        items.push(rowFromApi(e));
      });
      if (onChunk) onChunk(items.length);
      next = page.next_uri;
    }
    return items;
  }

  function parseRatingText(text) {
    if (!text) return null;
    var m = text.match(/(\d+(?:\.\d+)?)\s*\/\s*5/);
    if (m) return Math.min(5, +m[1]);
    m = text.match(/(\d+(?:\.\d+)?)\s*점/);
    if (m) return Math.min(5, +m[1]);
    m = text.match(/별점\s*(\d+(?:\.\d+)?)/);
    if (m) return Math.min(5, +m[1]);
    return null;
  }

  async function scrollCollect(maxRounds) {
    var seen = {};
    var items = [];
    var prevH = 0;
    for (var round = 0; round < maxRounds; round++) {
      document.querySelectorAll('a[href*="/contents/"]').forEach(function (a) {
        var hm = a.href.match(/\/contents\/([^/?#]+)/);
        if (!hm || seen[hm[1]]) return;
        var card =
          a.closest("article") ||
          a.closest("li") ||
          a.closest('[class*="card" i]') ||
          a.closest('[class*="Card"]') ||
          a.parentElement &&
            a.parentElement.parentElement;
        var title = (a.getAttribute("title") || a.textContent || "").trim();
        if (!title || title.length < 2) return;
        var blob = card ? card.innerText || "" : "";
        var rating = parseRatingText(blob);
        seen[hm[1]] = true;
        items.push({
          id: hm[1],
          url: "https://pedia.watcha.com/ko-KR/contents/" + hm[1],
          title: title.split("\n")[0].slice(0, 200),
          type: "MOVIE",
          year: "",
          directors: "",
          watchedAt: "",
          rating: rating || "",
          review: "",
          spoiler: "",
        });
      });
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(function (r) {
        setTimeout(r, 800);
      });
      if (document.body.scrollHeight === prevH) break;
      prevH = document.body.scrollHeight;
    }
    return items;
  }

  function downloadCsv(filename, rows) {
    var header =
      "ID,URL,Title,Type,Year,Directors,WatchedAt,Rating,Review,Spoiler";
    var body = rows
      .map(function (r) {
        return [
          r.id,
          r.url,
          String(r.title).replace(/"/g, '""'),
          r.type,
          r.year,
          r.directors,
          r.watchedAt,
          r.rating,
          String(r.review || "").replace(/"/g, '""'),
          r.spoiler,
        ]
          .map(function (c) {
            return '"' + String(c == null ? "" : c) + '"';
          })
          .join(",");
      })
      .join("\n");
    var blob = new Blob(["\ufeff" + header + "\n" + body + "\n"], {
      type: "text/csv;charset=utf-8",
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  var userId = userIdFromPage();
  if (!userId) {
    alert(
      "프로필 URL이 아닙니다.\n예: pedia.watcha.com/…/users/내아이디 평가 탭에서 다시 실행하세요."
    );
    return;
  }

  var bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:99999;padding:12px 16px;background:#1a1a2e;color:#fff;font:14px sans-serif;";
  bar.textContent = "왓챠보내기 v2…";
  document.body.appendChild(bar);

  var rows = [];
  try {
    bar.textContent = "API로 영화 목록 요청 중…";
    var movies = await fetchAll("movies", function (n) {
      bar.textContent = "API 영화 " + n + "건…";
    });
    bar.textContent = "API로 시리즈 목록 요청 중…";
    var tv = await fetchAll("tv_seasons", function (n) {
      bar.textContent = "API 시리즈 " + n + "건…";
    });
    rows = movies.concat(tv);
  } catch (err) {
    console.warn("API export failed", err);
    if (err.status === 403) {
      bar.textContent =
        "API 403 → 페이지에서 보이는 평가만 수집합니다 (스크롤 중)…";
      alert(
        "왓챠 API가 403으로 막혀 있습니다.\n" +
          "지금 보이는 평가 카드만 모읍니다. 목록 끝까지 스크롤한 뒤 기다려 주세요.\n" +
          "(전체 평가는 일부만 들어갈 수 있습니다)"
      );
      rows = await scrollCollect(40);
    } else {
      document.body.removeChild(bar);
      alert("보내기 실패: " + (err.message || err));
      return;
    }
  }

  document.body.removeChild(bar);
  if (!rows.length) {
    alert("가져올 평가를 찾지 못했습니다. 평가 탭에서 스크롤 후 다시 시도하세요.");
    return;
  }
  downloadCsv(userId + "-watcha.csv", rows);
  alert(
    rows.length +
      "건 CSV 저장했습니다.\n너는몇점? → 가져오기 → 왓챠 CSV 가져오기"
  );
})();
