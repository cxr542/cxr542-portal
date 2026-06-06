(function () {
  "use strict";

  var SIDEBAR_KEY = "how-many-points-sidebar-collapsed";
  var TYPE_LABEL = {
    movie: "영화",
    series: "시리즈",
    book: "책",
    webtoon: "웹툰",
    other: "기타",
  };
  var TYPE_ICON = {
    movie: "🎬",
    series: "📺",
    book: "📚",
    webtoon: "💬",
    other: "📦",
  };
  var renderSeq = 0;
  var state = {
    view: "library",
    typeFilter: "all",
    search: "",
    sort: "recent",
    editId: null,
    isNew: false,
    draft: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function starsHtml(rating, sizeClass) {
    var r = Number(rating) || 0;
    var full = Math.floor(r);
    var half = r - full >= 0.25 && r - full < 0.75;
    var html =
      '<span class="stars ' +
      (sizeClass || "") +
      '" aria-label="' +
      (r ? r + "점" : "미평가") +
      '">';
    for (var i = 1; i <= 5; i++) {
      if (i <= full) html += '<span class="star star--on">★</span>';
      else if (i === full + 1 && half) html += '<span class="star star--half">★</span>';
      else html += '<span class="star">★</span>';
    }
    html += '<span class="stars__num">' + (r ? r.toFixed(1) : "—") + "</span></span>";
    return html;
  }

  function posterStyle(item) {
    if (item.posterUrl) {
      return (
        'background-image:url("' +
        escapeHtml(item.posterUrl).replace(/"/g, "") +
        '")'
      );
    }
    var hues = { movie: "340", series: "220", book: "35", webtoon: "280", other: "160" };
    var h = hues[item.contentType] || "200";
    return "background:linear-gradient(145deg,hsl(" + h + " 55% 28%),hsl(" + h + " 40% 18%))";
  }

  function filterList(list) {
    return list.filter(function (item) {
      if (state.typeFilter !== "all" && item.contentType !== state.typeFilter) return false;
      if (state.search) {
        var q = state.search.toLowerCase();
        return (
          (item.title || "").toLowerCase().indexOf(q) >= 0 ||
          (item.titleAlt || "").toLowerCase().indexOf(q) >= 0 ||
          (item.review || "").toLowerCase().indexOf(q) >= 0 ||
          (item.directors || "").toLowerCase().indexOf(q) >= 0
        );
      }
      return true;
    });
  }

  function sortList(list) {
    var sorted = list.slice();
    sorted.sort(function (a, b) {
      if (state.sort === "rating-desc") {
        return (b.rating || 0) - (a.rating || 0) || (b.updatedAt || "").localeCompare(a.updatedAt || "");
      }
      if (state.sort === "rating-asc") {
        return (a.rating || 0) - (b.rating || 0) || (a.updatedAt || "").localeCompare(b.updatedAt || "");
      }
      if (state.sort === "title") {
        return (a.title || "").localeCompare(b.title || "", "ko");
      }
      return (b.updatedAt || b.watchedAt || "").localeCompare(a.updatedAt || a.watchedAt || "");
    });
    return sorted;
  }

  function countByType(list) {
    var c = { all: list.length, movie: 0, series: 0, book: 0, webtoon: 0, other: 0 };
    list.forEach(function (item) {
      if (c[item.contentType] !== undefined) c[item.contentType] += 1;
      else c.other += 1;
    });
    return c;
  }

  function avgRating(list) {
    var rated = list.filter(function (i) {
      return i.rating > 0;
    });
    if (!rated.length) return null;
    var sum = rated.reduce(function (s, i) {
      return s + i.rating;
    }, 0);
    return Math.round((sum / rated.length) * 10) / 10;
  }

  function updateNavCounts(list) {
    var c = countByType(list);
    var allEl = $("nav-count-all");
    if (allEl) allEl.textContent = String(c.all);
    ["movie", "series", "book", "webtoon"].forEach(function (t) {
      var el = $("nav-count-" + t);
      if (el) el.textContent = String(c[t]);
    });
  }

  function renderTypeChips(list) {
    var nav = $("type-filter");
    if (!nav || state.view !== "library") {
      if (nav) nav.hidden = true;
      return;
    }
    nav.hidden = false;
    var c = countByType(list);
    var chips = [
      { id: "all", label: "전체" },
      { id: "movie", label: TYPE_LABEL.movie },
      { id: "series", label: TYPE_LABEL.series },
      { id: "book", label: TYPE_LABEL.book },
      { id: "webtoon", label: TYPE_LABEL.webtoon },
    ];
    nav.innerHTML = chips
      .map(function (ch) {
        var active = state.typeFilter === ch.id;
        return (
          '<button type="button" class="type-chip' +
          (active ? " is-active" : "") +
          '" data-type="' +
          ch.id +
          '">' +
          escapeHtml(ch.label) +
          ' <span class="type-chip__n">' +
          c[ch.id] +
          "</span></button>"
        );
      })
      .join("");
    nav.querySelectorAll(".type-chip").forEach(function (btn) {
      btn.onclick = function () {
        state.typeFilter = btn.getAttribute("data-type");
        render();
      };
    });
  }

  function renderLibrary(list) {
    list = sortList(filterList(list));
    var avg = avgRating(list);
    var meta =
      '<p class="list-meta list-meta--context">⭐ <strong>내 평가</strong> · ' +
      list.length +
      "건" +
      (avg ? ' · 평균 <strong class="accent">' + avg + "</strong>점" : "") +
      "</p>";

    if (!list.length) {
      $("content").innerHTML =
        meta +
        '<div class="empty empty--watcha">' +
        '<p class="empty__eyebrow">왓챠피디아 평점 이관</p>' +
        "<h2>이전에 남긴 별점을 먼저 가져오세요.</h2>" +
        "<p>왓챠피디아에서 CSV를 만든 뒤 가져오면, 이후 평점은 이곳에서 계속 추가하고 JSON으로 백업할 수 있습니다.</p>" +
        '<div class="empty__actions">' +
        '<button type="button" class="btn btn--primary" id="empty-open-import">왓챠 평점 가져오기</button>' +
        '<button type="button" class="btn" id="empty-open-new">직접 평가 추가</button>' +
        "</div>" +
        '<p class="empty__note">운영·로컬·모바일은 저장소가 분리됩니다. 한 번 가져온 뒤 JSON보내기로 백업해두면 다른 기기에도 옮길 수 있어요.</p>' +
        "</div>";
      $("empty-open-import").onclick = function () {
        state.view = "import";
        render();
      };
      $("empty-open-new").onclick = function () {
        state.view = "edit";
        state.isNew = true;
        state.editId = null;
        state.draft = null;
        render();
      };
      return;
    }

    $("content").innerHTML =
      meta +
      '<div class="rating-grid">' +
      list
        .map(function (item) {
          return (
            '<article class="rating-card" data-id="' +
            escapeHtml(item.id) +
            '">' +
            '<div class="rating-card__poster" style="' +
            posterStyle(item) +
            '"><span class="rating-card__type">' +
            escapeHtml(TYPE_ICON[item.contentType] || "📦") +
            "</span></div>" +
            '<div class="rating-card__body">' +
            '<h3 class="rating-card__title">' +
            escapeHtml(item.title) +
            "</h3>" +
            (item.year
              ? '<p class="rating-card__year">' + escapeHtml(String(item.year)) + "</p>"
              : "") +
            starsHtml(item.rating, "stars--sm") +
            (item.review
              ? '<p class="rating-card__review">' + escapeHtml(item.review.slice(0, 80)) + "</p>"
              : "") +
            "</div></article>"
          );
        })
        .join("") +
      "</div>";

    $("content").querySelectorAll(".rating-card").forEach(function (card) {
      card.onclick = function () {
        state.editId = card.getAttribute("data-id");
        state.isNew = false;
        state.draft = null;
        state.view = "edit";
        render();
      };
    });
  }

  function renderStats(all) {
    var c = countByType(all);
    var avg = avgRating(all);
    var byType = HowManyPointsDb.CONTENT_TYPES.map(function (t) {
      var subset = all.filter(function (i) {
        return i.contentType === t;
      });
      var a = avgRating(subset);
      return (
        '<li><span class="stat-row__label">' +
        escapeHtml(TYPE_ICON[t] + " " + TYPE_LABEL[t]) +
        "</span>" +
        '<span class="stat-row__val">' +
        subset.length +
        "건" +
        (a ? " · 평균 " + a : "") +
        "</span></li>"
      );
    }).join("");

    $("content").innerHTML =
      '<div class="stats-panel">' +
      "<h2>📊 내 평가 요약</h2>" +
      '<p class="stats-hero">' +
      (avg
        ? '전체 평균 <strong class="accent">' + avg + "</strong> / 5.0"
        : "아직 평균을 낼 평가가 없습니다") +
      "</p>" +
      '<p class="list-meta">총 <strong>' +
      c.all +
      "</strong>건 · 영화 " +
      c.movie +
      " · 시리즈 " +
      c.series +
      " · 책 " +
      c.book +
      " · 웹툰 " +
      c.webtoon +
      "</p>" +
      '<ul class="stat-list">' +
      byType +
      "</ul></div>";
  }

  var WATCHA_SCRIPT_LOCAL = "/how-many-points/assets/watchapedia_export_v2.js";
  var WATCHA_SCRIPT_V1 = "/how-many-points/assets/watchapedia_export.js";

  function copyWatchaScript(btn) {
    return fetch(WATCHA_SCRIPT_LOCAL)
      .then(function (res) {
        if (!res.ok) throw new Error("fetch");
        return res.text();
      })
      .then(function (text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(text);
        }
        var ta = $("watcha-script-fallback");
        if (!ta) throw new Error("clipboard");
        ta.value = text;
        ta.hidden = false;
        ta.focus();
        ta.select();
        document.execCommand("copy");
        return undefined;
      })
      .then(function () {
        if (btn) {
          btn.textContent = "✓ 복사됨!";
          setTimeout(function () {
            btn.textContent = "📋 ① v2 스크립트 복사 (403 대응)";
          }, 2000);
        }
      });
  }

  function renderImport() {
    $("content").innerHTML =
      '<div class="import-panel">' +
      "<h2>📥 왓챠피디아에서 가져오기</h2>" +
      '<div class="import-faq import-faq--err">' +
      "<h3>🚫 <code>403 Forbidden</code> — 전체 공개·내 평가 페이지인데도?</h3>" +
      "<p>설정은 맞습니다. <strong>왓챠가 비공식 API를 막은 경우</strong>가 많습니다 (2025~). 사용자 잘못이 아닙니다.</p>" +
      '<p class="import-faq__action"><strong>→ 아래 「① v2 스크립트 복사」</strong>를 쓰세요. API가 403이면 <strong>화면에 보이는 평가만</strong> 자동 수집합니다. 목록 <strong>끝까지 스크롤</strong> 후 기다리세요.</p>' +
      '<ol class="import-faq__ol">' +
      "<li>평가 탭에서 Snippet Run</li>" +
      "<li>알림 후 스크롤이 끝날 때까지 대기 → CSV 저장</li>" +
      "<li>일부만 들어가면: 왓챠가 API·화면 모두 제한 → <strong>너는몇점? 수동 입력</strong></li>" +
      "</ol></div>" +
      '<div class="import-faq import-faq--warn">' +
      "<h3>⚠️ <code>Unexpected identifier 'pasting'</code> 가 났나요?</h3>" +
      "<p><code>allow pasting</code> 을 <strong>먼저</strong>만 치면 Chrome이 <strong>자바스크립트 코드</strong>로 실행해 위 오류가 납니다. 정상이 아닙니다.</p>" +
      "<p><strong>Console 순서 (반드시 이 순서):</strong></p>" +
      '<ol class="import-faq__ol">' +
      "<li>스크립트 복사 후 Console에서 <strong>먼저 Ctrl+V</strong> (막히면서 노란 경고 표시)</li>" +
      "<li>경고에 적힌 문구를 입력줄에 <strong>손으로</strong> 입력 후 Enter<br>" +
      "· 영문 Chrome: <code>allow pasting</code><br>" +
      "· 한글/다른 언어: 경고 문장에 나온 <strong>그 문구 그대로</strong> (영어가 안 통할 수 있음)</li>" +
      "<li>다시 <strong>Ctrl+V</strong> → Enter</li>" +
      "</ol>" +
      "<p><strong>가장 쉬움:</strong> 아래 <strong>방법 A Snippets</strong> — Console을 쓰지 않습니다.</p></div>" +
      '<p class="import-panel__lead">먼저 <strong>스크립트 복사</strong> 버튼을 누른 뒤, A 또는 B 중 하나를 진행하세요.</p>' +
      '<button type="button" class="btn btn--primary btn--copy-script" id="btn-copy-watcha-script">📋 ① v2 스크립트 복사 (403 대응)</button>' +
      '<p class="import-panel__note">예전 API 전용 스크립트: <a href="' +
      WATCHA_SCRIPT_V1 +
      '" target="_blank" rel="noopener">watchapedia_export.js (v1)</a></p>' +
      '<details class="import-details import-details--open" open>' +
      "<summary><strong>✅ 방법 A — Snippets</strong> (Console 말고 여기, 추천)</summary>" +
      '<ol class="import-steps">' +
      "<li><a href=\"https://pedia.watcha.com\" target=\"_blank\" rel=\"noopener\">왓챠피디아</a> 탭에서 로그인 (포털 탭 말고 <strong>왓챠 탭</strong>에서 F12)</li>" +
      "<li>① 스크립트 복사 (위 버튼)</li>" +
      "<li>왓챠 탭 <kbd>F12</kbd> → 개발자 도구가 열림</li>" +
      "<li><strong>가장 쉬운 열기:</strong> <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → <code>snippet</code> 입력 → <strong>Create new snippet</strong> (새 스니펫 만들기) 선택</li>" +
      "<li>오른쪽(가운데)에 열린 빈 코드 칸에 <kbd>Ctrl</kbd>+<kbd>V</kbd> 붙여넣기 → <kbd>Ctrl</kbd>+<kbd>S</kbd> 저장</li>" +
      "<li>왼쪽에 생긴 파일 이름 우클릭 → <strong>Run</strong> (실행) · 또는 코드 칸 클릭 후 <kbd>Ctrl</kbd>+<kbd>Enter</kbd></li>" +
      "<li><code>내아이디-watcha.csv</code> 다운로드</li>" +
      "</ol>" +
      '<details class="import-subdetails"><summary>Snippets / + New snippet 을 눈으로 찾고 싶을 때</summary>' +
      '<pre class="import-map">브라우저 (왓챠 페이지)\n┌─────────────────────────────────────────┐\n│  [Elements] [Console] [Sources] ...  ← ② Sources(소스) 클릭\n├──────────┬──────────────────────────────────┤\n│ Page     │  (코드 편집 영역)                 │\n│ Snippets │←③ 이 글자 탭 클릭                  │\n│  [ + ]   │←④ 또는 여기 + / New snippet      │\n└──────────┴──────────────────────────────────┘\n※ 왼쪽에 Snippets가 없으면: 왼쪽 맨 아래 &gt;&gt; 눌러 숨김 메뉴 확인</pre>' +
      '<p class="import-panel__note">Edge도 비슷합니다. 상단 <strong>소스</strong> → 왼쪽 <strong>코드 조각</strong>(Snippets).</p></details></details>' +
      '<details class="import-details">' +
      "<summary>방법 B — Console (순서 틀리면 SyntaxError)</summary>" +
      '<ol class="import-steps">' +
      "<li>① 스크립트 복사 → Console 탭</li>" +
      "<li><strong>먼저</strong> <kbd>Ctrl</kbd>+<kbd>V</kbd> (붙여넣기 시도 → 노란 경고)</li>" +
      "<li>경고에 나온 문구를 입력줄에 손으로 입력 → Enter</li>" +
      "<li>다시 <kbd>Ctrl</kbd>+<kbd>V</kbd> → Enter</li>" +
      "</ol></details>" +
      '<div class="import-step-card"><span class="import-step-card__n">마지막</span>' +
      "<p>CSV를 아래 <strong>왓챠 CSV 가져오기</strong>로 선택</p></div>" +
      '<details class="import-details"><summary>복사 버튼이 안 될 때</summary>' +
      '<p class="import-panel__note">아래 칸을 클릭 → <kbd>Ctrl</kbd>+<kbd>A</kbd> 전체 선택 → <kbd>Ctrl</kbd>+<kbd>C</kbd> 복사</p>' +
      '<textarea class="watcha-script-fallback" id="watcha-script-fallback" readonly hidden placeholder="스크립트 불러오는 중…"></textarea>' +
      '<button type="button" class="btn" id="btn-load-watcha-script">스크립트 칸에 불러오기</button></details>' +
      '<p class="import-panel__note import-panel__note--muted">ℹ️ <code>Images loaded lazily…</code> 메시지는 왓챠 페이지 일반 알림이라 무시해도 됩니다.</p>' +
      '<p class="import-panel__warn">⚠️ 왓챠 사이트가 바뀌면 스크립트가 멈출 수 있습니다. <a href="https://github.com/erinyskim/watchapedia-export" target="_blank" rel="noopener">원본 저장소</a></p>' +
      '<p class="import-panel__note">영화·TV(시리즈)만 CSV에 들어갑니다. 책·웹툰은 앱에서 직접 입력하세요.</p>' +
      '<div class="import-actions">' +
      '<label class="btn btn--primary">왓챠 CSV 가져오기<input type="file" id="import-csv" accept=".csv,text/csv" hidden /></label>' +
      '<label class="btn">JSON 가져오기<input type="file" id="import-json" accept="application/json,.json" hidden /></label>' +
      "</div></div>";

    $("btn-copy-watcha-script").onclick = function () {
      var btn = $("btn-copy-watcha-script");
      copyWatchaScript(btn).catch(function () {
        window.alert(
          "자동 복사에 실패했습니다.\n「복사가 안 될 때」를 펼쳐 「스크립트 칸에 불러오기」를 누른 뒤 Ctrl+A, Ctrl+C 하세요."
        );
        var det = document.querySelector(".import-details");
        if (det) det.open = true;
      });
    };
    $("btn-load-watcha-script").onclick = function () {
      fetch(WATCHA_SCRIPT_LOCAL)
        .then(function (r) {
          return r.text();
        })
        .then(function (text) {
          var ta = $("watcha-script-fallback");
          ta.value = text;
          ta.hidden = false;
          ta.focus();
          ta.select();
        })
        .catch(function () {
          window.alert("스크립트를 불러오지 못했습니다. 새로고침 후 다시 시도하세요.");
        });
    };
    $("import-csv").onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var items = HowManyPointsWatchaImport.parseWatchaCsv(reader.result);
          if (!items.length) {
            window.alert("CSV에서 항목을 찾지 못했습니다.");
            return;
          }
          var merge = !window.confirm(
            items.length +
              "건을 가져옵니다.\n\n확인 = 기존 데이터와 병합(같은 왓챠 ID는 덮어쓰기)\n취소 = 전체 교체 후 가져오기"
          );
          HowManyPointsDb.importItems(items, !merge).then(function () {
            state.view = "library";
            render();
            if (window.ProjectShell) {
              ProjectShell.notifyTaskDone({
                module: "너는몇점?",
                action: "왓챠 CSV 가져오기 완료",
                title: items.length + "건 반영",
              });
            }
            window.alert(items.length + "건을 반영했습니다.");
          });
        } catch (err) {
          console.error(err);
          window.alert("CSV 처리 중 오류가 났습니다.");
        }
      };
      reader.readAsText(f, "UTF-8");
      e.target.value = "";
    };
    $("import-json").onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          var replace = window.confirm("기존 데이터를 모두 지우고 가져올까요?\n취소 = 병합");
          HowManyPointsDb.importPayload(data, replace).then(function () {
            state.view = "library";
            render();
          });
        } catch (err) {
          window.alert("JSON 형식이 올바르지 않습니다.");
        }
      };
      reader.readAsText(f);
      e.target.value = "";
    };
  }

  function ratingPickerHtml(value) {
    var html = '<div class="rating-picker" id="rating-picker">';
    for (var half = 1; half <= 10; half++) {
      var v = half / 2;
      html +=
        '<button type="button" class="rating-picker__btn' +
        (value === v ? " is-selected" : "") +
        '" data-rating="' +
        v +
        '" title="' +
        v +
        '점">' +
        "★" +
        "</button>";
    }
    html += "</div>";
    return html;
  }

  function bindRatingPicker() {
    var picker = $("rating-picker");
    if (!picker) return;
    picker.querySelectorAll(".rating-picker__btn").forEach(function (btn) {
      btn.onclick = function () {
        state.draft.rating = Number(btn.getAttribute("data-rating"));
        renderEditForm();
      };
    });
  }

  function renderEditForm() {
    var d = state.draft;
    if (!d) return;
    var typeOptions = HowManyPointsDb.CONTENT_TYPES.map(function (t) {
      return (
        '<option value="' +
        t +
        '"' +
        (d.contentType === t ? " selected" : "") +
        ">" +
        escapeHtml(TYPE_LABEL[t]) +
        "</option>"
      );
    }).join("");

    $("content").innerHTML =
      '<div class="edit-form">' +
      "<h2>" +
      (state.isNew ? "✨ 새 평가" : escapeHtml(d.title)) +
      "</h2>" +
      (d.rating ? '<div class="edit-form__stars">' + starsHtml(d.rating) + "</div>" : "") +
      '<label class="field-label">제목</label>' +
      '<input class="field-input" id="f-title" type="text" value="' +
      escapeHtml(d.title || "") +
      '" />' +
      '<label class="field-label">부제·원제 (선택)</label>' +
      '<input class="field-input" id="f-title-alt" type="text" value="' +
      escapeHtml(d.titleAlt || "") +
      '" />' +
      '<label class="field-label">종류</label>' +
      '<select class="field-input" id="f-type">' +
      typeOptions +
      "</select>" +
      '<div class="field-row">' +
      '<div><label class="field-label">연도</label><input class="field-input" id="f-year" type="number" min="1900" max="2100" value="' +
      (d.year || "") +
      '" /></div>' +
      '<div><label class="field-label">본 날짜</label><input class="field-input" id="f-watched" type="date" value="' +
      (d.watchedAt ? String(d.watchedAt).slice(0, 10) : "") +
      '" /></div></div>' +
      '<label class="field-label">감독·작가 (선택)</label>' +
      '<input class="field-input" id="f-directors" type="text" value="' +
      escapeHtml(d.directors || "") +
      '" />' +
      '<label class="field-label">포스터 URL (선택)</label>' +
      '<input class="field-input" id="f-poster" type="url" placeholder="https://…" value="' +
      escapeHtml(d.posterUrl || "") +
      '" />' +
      '<label class="field-label">평점 (0.5~5)</label>' +
      ratingPickerHtml(d.rating) +
      '<label class="field-label">한줄평·리뷰</label>' +
      '<textarea class="field-textarea" id="f-review" placeholder="감상을 남겨 보세요">' +
      escapeHtml(d.review || "") +
      "</textarea>" +
      (d.sourceUrl
        ? '<p class="field-hint">원본: <a href="' +
          escapeHtml(d.sourceUrl) +
          '" target="_blank" rel="noopener">왓챠피디아</a></p>'
        : "") +
      '<div class="form-actions">' +
      '<button type="button" class="btn btn--primary" id="btn-save">저장</button>' +
      '<button type="button" class="btn" id="btn-back">목록</button>' +
      (!state.isNew ? '<button type="button" class="btn btn--danger" id="btn-delete">삭제</button>' : "") +
      "</div></div>";

    bindRatingPicker();
    $("btn-save").onclick = saveEdit;
    $("btn-back").onclick = function () {
      state.view = "library";
      render();
    };
    var del = $("btn-delete");
    if (del) {
      del.onclick = function () {
        if (!window.confirm("이 평가를 삭제할까요?")) return;
        HowManyPointsDb.deleteRating(state.editId).then(function () {
          state.view = "library";
          render();
        });
      };
    }
  }

  function syncDraft() {
    var t = $("f-title");
    var ta = $("f-title-alt");
    var ty = $("f-type");
    var y = $("f-year");
    var w = $("f-watched");
    var dir = $("f-directors");
    var po = $("f-poster");
    var rev = $("f-review");
    if (t) state.draft.title = t.value;
    if (ta) state.draft.titleAlt = ta.value;
    if (ty) state.draft.contentType = ty.value;
    if (y) state.draft.year = y.value ? Number(y.value) : null;
    if (w) state.draft.watchedAt = w.value || null;
    if (dir) state.draft.directors = dir.value;
    if (po) state.draft.posterUrl = po.value.trim();
    if (rev) state.draft.review = rev.value;
  }

  function saveEdit() {
    syncDraft();
    if (!state.draft.title.trim()) {
      window.alert("제목을 입력하세요.");
      return;
    }
    if (!state.draft.rating) {
      window.alert("평점을 선택하세요 (0.5~5).");
      return;
    }
    var now = new Date().toISOString();
    var save = function (id) {
      var item = HowManyPointsDb.normalizeItem(
        Object.assign({}, state.draft, { id: id, updatedAt: now }),
        {}
      );
      if (state.isNew) item.createdAt = now;
      return HowManyPointsDb.putRating(item).then(function () {
        state.view = "library";
        render();
      });
    };
    if (state.isNew) {
      HowManyPointsDb.listRatings().then(function (list) {
        var ids = {};
        list.forEach(function (r) {
          ids[r.id] = true;
        });
        save(HowManyPointsDb.slugFromTitle(state.draft.title, ids));
      });
      return;
    }
    save(state.draft.id);
  }

  function loadEdit() {
    HowManyPointsDb.getRating(state.editId).then(function (item) {
      if (!item) {
        state.view = "library";
        render();
        return;
      }
      state.draft = Object.assign({}, item);
      renderEditForm();
    });
  }

  function newRating() {
    state.isNew = true;
    state.editId = null;
    state.draft = {
      title: "",
      titleAlt: "",
      contentType: state.typeFilter !== "all" ? state.typeFilter : "movie",
      year: null,
      directors: "",
      posterUrl: "",
      rating: null,
      review: "",
      watchedAt: null,
      source: "manual",
    };
    state.view = "edit";
    render();
  }

  function render() {
    var seq = ++renderSeq;
    if (window.ProjectShell) {
      ProjectShell.setActiveView(state.view === "edit" ? "sketch" : state.view);
    }
    var sortEl = $("sort-select");
    if (sortEl && sortEl.value !== state.sort) sortEl.value = state.sort;

    HowManyPointsDb.listRatings()
      .then(function (list) {
        if (seq !== renderSeq) return;
        updateNavCounts(list);
        renderTypeChips(list);
        if (state.view === "edit") {
          if (!state.draft && !state.isNew) loadEdit();
          else renderEditForm();
          return;
        }
        if (state.view === "import") {
          renderImport();
          return;
        }
        if (state.view === "stats") {
          renderStats(list);
          return;
        }
        renderLibrary(list);
      })
      .catch(function (err) {
        console.error(err);
        $("content").innerHTML = '<p class="empty">목록을 불러오지 못했습니다.</p>';
      });
  }

  function exportJson() {
    HowManyPointsDb.listRatings().then(function (list) {
      var blob = new Blob(
        [JSON.stringify(HowManyPointsDb.exportPayload(list), null, 2) + "\n"],
        { type: "application/json" }
      );
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "how-many-points-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function bindUi() {
    if (window.ProjectShell) {
      ProjectShell.init({
        storageKey: SIDEBAR_KEY,
        shellId: "app-shell",
        railToggleId: "sidebar-toggle",
        toolbarToggleId: "sidebar-toggle-toolbar",
      });
      ProjectShell.initBranding({
        storageKey: "how-many-points-branding",
        defaults: {
          title: "너는몇점?",
          tagline: "영화·시리즈·책·웹툰 — 나만의 평점 아카이브",
        },
        titleSuffix: "",
      });
    }

    document.querySelectorAll(".nav-item[data-view]").forEach(function (btn) {
      btn.onclick = function () {
        var next = btn.getAttribute("data-view");
        if (next === "library") {
          var tf = btn.getAttribute("data-type-filter");
          if (tf) state.typeFilter = tf;
        }
        if (next === "edit" && !state.editId && !state.isNew) {
          newRating();
          return;
        }
        state.view = next;
        render();
      };
    });

    var searchEl = $("search");
    if (searchEl) {
      searchEl.oninput = function (e) {
        state.search = e.target.value.trim();
        if (state.view === "library") render();
      };
    }
    var sortEl = $("sort-select");
    if (sortEl) {
      sortEl.onchange = function (e) {
        state.sort = e.target.value;
        render();
      };
    }
    $("btn-new").onclick = newRating;
    $("btn-export").onclick = exportJson;
    $("import-json-toolbar").onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          var replace = window.confirm("기존 데이터를 모두 지우고 가져올까요?\n취소 = 병합");
          HowManyPointsDb.importPayload(data, replace).then(render);
        } catch (err) {
          window.alert("JSON 형식이 올바르지 않습니다.");
        }
      };
      reader.readAsText(f);
      e.target.value = "";
    };
  }

  HowManyPointsDb.getStorageMode()
    .then(function () {
      return HowManyPointsDb.seedIfEmpty();
    })
    .then(function () {
      bindUi();
      render();
    })
    .catch(function (err) {
      console.error(err);
      $("content").innerHTML = '<p class="empty">저장소를 사용할 수 없습니다.</p>';
    });
})();
