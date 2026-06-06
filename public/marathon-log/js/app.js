(function () {
  "use strict";

  var DIST_LABEL = {
    full: "풀",
    half: "하프",
    "10k": "10K",
    "5k": "5K",
    "32k": "32K",
    "50k": "50K",
  };

  var STATUS_LABEL = {
    finished: "완주",
    dnf: "DNF",
    dns: "DNS",
    planned: "예정",
    postponed: "연기",
  };
  var BACKUP_REMINDER_KEY = "marathon-log-last-export-at";
  var BACKUP_NUDGE_DAYS = 14;

  var state = {
    screen: "dashboard",
    year: "all",
    dist: "all",
    races: [],
    detailId: null,
    editId: null,
    importReplace: false,
    weatherManualEdit: false,
    weatherTimer: null,
    weatherFetchToken: 0,
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

  function badgeClass(d) {
    if (d === "full") return "badge badge--full";
    if (d === "half") return "badge badge--half";
    if (d === "5k") return "badge badge--5k";
    if (d === "32k") return "badge badge--32k";
    if (d === "50k") return "badge badge--50k";
    return "badge badge--10k";
  }

  function distLabel(d) {
    return DIST_LABEL[d] || d;
  }

  function displayTime(r) {
    var st = r.status || "finished";
    if (st === "dns") return "DNS";
    if (st === "dnf") return r.chipTime ? "DNF " + r.chipTime : "DNF";
    if (st === "postponed") return "연기";
    if (st === "planned") return "예정";
    return r.chipTime || "—";
  }

  function isFinishedRace(r) {
    return (r.status || "finished") === "finished" && MarathonTime.isValidChipTime(r.chipTime);
  }

  function matchesDistFilter(r, dist) {
    if (dist === "all") return true;
    if (dist === "other") return r.distance === "32k" || r.distance === "50k";
    return r.distance === dist;
  }

  function sortedRaces(races) {
    return races.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
  }

  function filteredRaces() {
    return sortedRaces(state.races).filter(function (r) {
      var y = r.date.slice(0, 4);
      if (state.year !== "all" && y !== state.year) return false;
      if (!matchesDistFilter(r, state.dist)) return false;
      return true;
    });
  }

  function tabForScreen(id) {
    if (id === "input") return "input";
    return "dashboard";
  }

  function showScreen(id) {
    state.screen = id;
    document.querySelectorAll(".screen").forEach(function (el) {
      el.classList.toggle("is-active", el.id === "screen-" + id);
    });
    var activeTab = tabForScreen(id);
    if (window.ProjectShell) {
      ProjectShell.setActiveView(activeTab);
    }
    document.body.classList.toggle("project-hide-mobile-tabs", id === "detail");
    var sub = {
      dashboard: "PB · 대회 기록 대시보드",
      input: state.editId ? "기록 수정" : "새 기록 입력",
      detail: "대회 상세",
    };
    $("header-sub").textContent = sub[id] || "";
    closeDataMenu();
  }

  function navigateToView(view) {
    if (view === "input" && state.screen !== "input") {
      resetForm();
    }
    showScreen(view);
    if (view === "input") {
      renderNameSuggestions();
      scheduleWeatherFetch(true);
    }
  }

  function closeDataMenu() {
    $("data-menu").classList.remove("is-open");
    $("btn-data-menu").setAttribute("aria-expanded", "false");
  }

  function toggleDataMenu() {
    var open = $("data-menu").classList.toggle("is-open");
    $("btn-data-menu").setAttribute("aria-expanded", open ? "true" : "false");
  }

  function updateNavCounts() {
    var allEl = $("nav-count-all");
    if (allEl) allEl.textContent = String(state.races.length);
  }

  function renderList() {
    var list = $("race-list");
    var items = filteredRaces();
    if (!items.length) {
      list.innerHTML =
        '<li class="race-list--empty">기록이 없습니다. 「기록 입력」에서 등록하세요.</li>';
      return;
    }
    list.innerHTML = items
      .map(function (r) {
        return (
          '<li class="race-card" data-id="' +
          escapeHtml(r.id) +
          '">' +
          '<div class="race-card__top">' +
          '<h3 class="race-card__name">' +
          escapeHtml(r.name) +
          "</h3>" +
          '<span class="race-card__time' +
          (isFinishedRace(r) ? "" : " race-card__time--muted") +
          '">' +
          escapeHtml(displayTime(r)) +
          "</span>" +
          "</div>" +
          '<p class="race-card__meta">' +
          '<span class="' +
          badgeClass(r.distance) +
          '">' +
          distLabel(r.distance) +
          "</span>" +
          (r.status && r.status !== "finished"
            ? " · " + (STATUS_LABEL[r.status] || r.status)
            : "") +
          " · " +
          escapeHtml(r.date) +
          "</p>" +
          (r.notes
            ? '<p class="race-card__note">' + escapeHtml(r.notes) + "</p>"
            : "") +
          "</li>"
        );
      })
      .join("");
    list.querySelectorAll(".race-card").forEach(function (card) {
      card.addEventListener("click", function () {
        openDetail(card.getAttribute("data-id"));
      });
    });
    if (window.ProjectShell && window.ProjectShell.bindInlineTitles) {
      ProjectShell.bindInlineTitles(list, ".race-card__name", function (id, title) {
        var race = state.races.find(function (r) {
          return r.id === id;
        });
        if (!race) return;
        race.name = title.trim() || race.name;
        return MarathonDb.putRace(race).then(function () {
          updateNavCounts();
        });
      });
    }
  }

  function renderYearChips() {
    var years = {};
    state.races.forEach(function (r) {
      if (r.date) years[r.date.slice(0, 4)] = true;
    });
    var el = $("year-chips");
    var html =
      '<button type="button" class="chip' +
      (state.year === "all" ? " is-active" : "") +
      '" data-year="all">전체</button>';
    Object.keys(years)
      .sort()
      .reverse()
      .forEach(function (y) {
        html +=
          '<button type="button" class="chip' +
          (state.year === y ? " is-active" : "") +
          '" data-year="' +
          y +
          '">' +
          y +
          "</button>";
      });
    el.innerHTML = html;
    el.querySelectorAll(".chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.year = btn.getAttribute("data-year");
        el.querySelectorAll(".chip").forEach(function (c) {
          c.classList.toggle("is-active", c === btn);
        });
        renderList();
      });
    });
  }

  function openDetail(id) {
    var r = state.races.find(function (x) {
      return x.id === id;
    });
    if (!r) return;
    state.detailId = id;
    $("detail-body").innerHTML =
      '<div class="detail-hero">' +
      "<h2>" +
      escapeHtml(r.name) +
      "</h2>" +
      '<p style="margin:0;font-size:0.8125rem;color:var(--muted)">' +
      escapeHtml(r.date) +
      ' · <span class="' +
      badgeClass(r.distance) +
      '">' +
      distLabel(r.distance) +
      "</span>" +
      (r.status && r.status !== "finished"
        ? " · " + (STATUS_LABEL[r.status] || r.status)
        : "") +
      "</p>" +
      '<p class="big-time">' +
      escapeHtml(displayTime(r)) +
      "</p>" +
      '<p style="margin:0;font-size:0.8125rem;color:var(--muted)">목표: ' +
      escapeHtml(r.goal || "—") +
      "</p>" +
      "</div>" +
      '<div class="detail-grid">' +
      '<div class="detail-cell"><span>결과</span>' +
      escapeHtml(STATUS_LABEL[r.status] || "완주") +
      "</div>" +
      '<div class="detail-cell"><span>날씨</span>' +
      escapeHtml(r.weather || "—") +
      "</div>" +
      "</div>" +
      '<p class="section-title">메모</p>' +
      '<div class="detail-note">' +
      escapeHtml(r.notes || "메모 없음") +
      "</div>" +
      '<div class="detail-actions">' +
      '<button type="button" class="btn-edit" id="btn-detail-edit">수정</button>' +
      '<button type="button" class="btn-delete" id="btn-detail-delete">삭제</button>' +
      "</div>";
    $("btn-detail-edit").addEventListener("click", function () {
      startEdit(id);
    });
    $("btn-detail-delete").addEventListener("click", function () {
      confirmDelete(id);
    });
    showScreen("detail");
  }

  function startEdit(id) {
    var r = state.races.find(function (x) {
      return x.id === id;
    });
    if (!r) return;
    state.editId = id;
    $("field-date").value = r.date;
    $("field-name").value = r.name;
    $("field-distance").value = r.distance;
    $("field-status").value = r.status || "finished";
    $("field-chip").value = r.chipTime;
    $("field-goal").value = r.goal || "";
    $("field-weather").value = r.weather || "";
    $("field-notes").value = r.notes || "";
    $("btn-save").textContent = "수정 저장";
    state.weatherManualEdit = true;
    clearFormError();
    renderNameSuggestions();
    setWeatherHint("", "");
    showScreen("input");
  }

  function resetForm() {
    state.editId = null;
    state.weatherManualEdit = false;
    $("race-form").reset();
    $("field-date").value = new Date().toISOString().slice(0, 10);
    $("field-status").value = "finished";
    $("btn-save").textContent = "기록 저장";
    clearFormError();
    renderNameSuggestions();
    scheduleWeatherFetch(true);
  }

  function clearFormError() {
    var el = $("form-error");
    el.hidden = true;
    el.textContent = "";
  }

  function showFormError(msg) {
    var el = $("form-error");
    el.hidden = false;
    el.textContent = msg;
  }

  function renderNameSuggestions() {
    var wrap = $("name-suggestions");
    var list = $("name-suggestions-list");
    var dateVal = $("field-date").value;
    if (!dateVal) {
      wrap.hidden = true;
      list.innerHTML = "";
      return;
    }
    var items = MarathonEvents.suggestEventNames(dateVal, state.races);
    if (!items.length) {
      wrap.hidden = true;
      list.innerHTML = "";
      return;
    }
    wrap.hidden = false;
    list.innerHTML = items
      .map(function (item, i) {
        var distHint = item.distance ? DIST_LABEL[item.distance] || item.distance : "";
        var meta = [distHint, item.hint].filter(Boolean).join(" · ");
        return (
          '<button type="button" class="name-suggestion" data-idx="' +
          i +
          '">' +
          escapeHtml(item.name) +
          (meta
            ? '<span class="name-suggestion__meta">' + escapeHtml(meta) + "</span>"
            : "") +
          "</button>"
        );
      })
      .join("");
    list.querySelectorAll(".name-suggestion").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-idx"), 10);
        applyNameSuggestion(items[idx]);
      });
    });
  }

  function applyNameSuggestion(item) {
    if (!item) return;
    $("field-name").value = item.name;
    if (item.distance) {
      $("field-distance").value = item.distance;
    }
    state.weatherManualEdit = false;
    scheduleWeatherFetch(true);
    $("field-name").focus();
  }

  function setWeatherHint(text, kind) {
    var el = $("weather-hint");
    if (!text) {
      el.hidden = true;
      el.textContent = "";
      el.className = "weather-hint";
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = "weather-hint" + (kind ? " is-" + kind : "");
  }

  function scheduleWeatherFetch(immediate) {
    if (state.weatherTimer) clearTimeout(state.weatherTimer);
    if (state.weatherManualEdit) return;
    if (state.screen !== "input") return;
    var delay = immediate ? 0 : 450;
    state.weatherTimer = setTimeout(function () {
      fetchWeatherAuto(false);
    }, delay);
  }

  function fetchWeatherAuto(force) {
    if (!force && state.weatherManualEdit) return;
    var dateVal = $("field-date").value;
    var nameVal = $("field-name").value.trim();
    if (!dateVal) {
      setWeatherHint("");
      return;
    }

    var token = ++state.weatherFetchToken;
    var btn = $("btn-fetch-weather");
    btn.disabled = true;
    setWeatherHint("기상 정보 조회 중…", "loading");

    MarathonWeather.fetchWeatherForRace(dateVal, nameVal)
      .then(function (result) {
        if (token !== state.weatherFetchToken) return;
        if (!force && state.weatherManualEdit) return;
        $("field-weather").value = result.text;
        setWeatherHint(result.hint, result.source === "kma" ? "" : "");
      })
      .catch(function (err) {
        if (token !== state.weatherFetchToken) return;
        setWeatherHint((err && err.message) || "날씨 조회 실패", "error");
      })
      .finally(function () {
        if (token === state.weatherFetchToken) btn.disabled = false;
      });
  }

  function loadKmaKeyField() {
    var key = MarathonWeather.getKmaApiKey();
    if ($("kma-api-key")) $("kma-api-key").value = key;
  }

  function saveKmaKey() {
    var key = ($("kma-api-key").value || "").trim();
    MarathonWeather.setKmaApiKey(key);
    closeDataMenu();
    if (state.screen === "input" && $("field-date").value) {
      state.weatherManualEdit = false;
      scheduleWeatherFetch(true);
    }
  }

  function readForm() {
    return {
      date: $("field-date").value,
      name: $("field-name").value.trim(),
      distance: $("field-distance").value,
      status: $("field-status").value,
      chipTime: $("field-chip").value.trim(),
      goal: $("field-goal").value.trim(),
      weather: $("field-weather").value.trim(),
      notes: $("field-notes").value.trim(),
    };
  }

  function validateForm(data) {
    if (!data.date) return "날짜를 입력하세요.";
    if (!data.name) return "대회명을 입력하세요.";
    if (!data.distance) return "거리를 선택하세요.";
    var st = data.status || "finished";
    if (st === "finished") {
      if (!data.chipTime) return "칩 기록을 입력하세요.";
      if (!MarathonTime.isValidChipTime(data.chipTime)) {
        return "칩 기록 형식: H:MM:SS 또는 M:SS (예: 3:41:58, 48:12)";
      }
    }
    if (st === "dnf" && data.chipTime && !MarathonTime.isValidChipTime(data.chipTime)) {
      return "DNF 기록 시간 형식이 올바르지 않습니다.";
    }
    return null;
  }

  function saveRace(e) {
    if (e) e.preventDefault();
    var data = readForm();
    var err = validateForm(data);
    if (err) {
      showFormError(err);
      return;
    }
    clearFormError();
    var existing = state.editId
      ? state.races.find(function (r) {
          return r.id === state.editId;
        })
      : null;
    var race = MarathonDb.normalizeRace(
      Object.assign({}, data, {
        id: state.editId || MarathonDb.newId(),
        createdAt: existing ? existing.createdAt : undefined,
      })
    );
    MarathonDb.putRace(race)
      .then(function () {
        return refreshRaces();
      })
      .then(function () {
        resetForm();
        showScreen("dashboard");
        if (window.ProjectShell) {
          ProjectShell.notifyTaskDone({
            module: "마라톤 기록장",
            action: existing ? "대회 기록 수정 완료" : "대회 기록 저장 완료",
            title: race.name || race.date || "대회 기록",
          });
        }
      })
      .catch(function () {
        showFormError("저장에 실패했습니다.");
      });
  }

  function confirmDelete(id) {
    var r = state.races.find(function (x) {
      return x.id === id;
    });
    if (!r) return;
    if (!window.confirm('「' + r.name + "」 기록을 삭제할까요?")) return;
    MarathonDb.deleteRace(id)
      .then(function () {
        return refreshRaces();
      })
      .then(function () {
        state.detailId = null;
        showScreen("dashboard");
      });
  }

  function findPb(distance) {
    var candidates = state.races.filter(function (r) {
      return r.distance === distance && isFinishedRace(r);
    });
    if (!candidates.length) return null;
    candidates.sort(function (a, b) {
      return MarathonTime.compareChipTime(a.chipTime, b.chipTime);
    });
    return candidates[0];
  }

  function pbSub(race) {
    if (!race) return "기록 없음";
    var y = race.date ? race.date.slice(0, 4) : "";
    var shortName = race.name.length > 8 ? race.name.slice(0, 8) + "…" : race.name;
    return (y ? y + " " : "") + shortName;
  }

  function renderKeepMotto() {
    var el = $("keep-motto");
    var meta = window.MarathonKeepMeta;
    if (!meta || !el) return;
    el.hidden = false;
    el.innerHTML =
      "<strong>나의 다짐</strong> " +
      escapeHtml(meta.motto) +
      " · 목표 페이스 " +
      escapeHtml(meta.targetPace);
  }

  function renderDashboard() {
    renderKeepMotto();
    var fullPb = findPb("full");
    var halfPb = findPb("half");
    var tenkPb = findPb("10k");
    var year = String(new Date().getFullYear());
    var yearRaces = state.races.filter(function (r) {
      return r.date && r.date.slice(0, 4) === year;
    });
    var counts = { full: 0, half: 0, "10k": 0, "5k": 0 };
    yearRaces.forEach(function (r) {
      if ((r.status || "finished") !== "finished") return;
      if (counts[r.distance] != null) counts[r.distance] += 1;
    });

    $("stats-grid").innerHTML =
      '<div class="stat-card">' +
      '<div class="label">풀 PB</div>' +
      '<div class="value">' +
      escapeHtml(fullPb ? fullPb.chipTime : "—") +
      "</div>" +
      '<div class="sub">' +
      escapeHtml(pbSub(fullPb)) +
      "</div></div>" +
      '<div class="stat-card">' +
      '<div class="label">하프 PB</div>' +
      '<div class="value">' +
      escapeHtml(halfPb ? halfPb.chipTime : "—") +
      "</div>" +
      '<div class="sub">' +
      escapeHtml(pbSub(halfPb)) +
      "</div></div>" +
      '<div class="stat-card">' +
      '<div class="label">10K PB</div>' +
      '<div class="value">' +
      escapeHtml(tenkPb ? tenkPb.chipTime : "—") +
      "</div>" +
      '<div class="sub">' +
      escapeHtml(pbSub(tenkPb)) +
      "</div></div>" +
      '<div class="stat-card stat-card--wide">' +
      '<div class="label">' +
      year +
      "년 완주</div>" +
      '<div class="value">' +
      yearRaces.length +
      "회</div>" +
      '<div class="sub">풀 ' +
      counts.full +
      " · 하프 " +
      counts.half +
      " · 10K " +
      counts["10k"] +
      " · 5K " +
      counts["5k"] +
      "</div></div>";
  }

  function refreshRaces() {
    return MarathonDb.listRaces().then(function (races) {
      state.races = races;
      updateNavCounts();
      renderDashboard();
      renderYearChips();
      renderList();
    });
  }

  function exportJson() {
    MarathonDb.listRaces().then(function (races) {
      var payload = MarathonDb.exportPayload(races);
      var blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "marathon-log-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
      recordExportBackup();
      closeDataMenu();
    });
  }

  function handleImportFile(file, replace) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        MarathonDb.importPayload(data, replace)
          .then(function () {
            return refreshRaces();
          })
          .then(function () {
            closeDataMenu();
            showScreen("dashboard");
          })
          .catch(function () {
            window.alert("JSON 형식이 올바르지 않습니다.");
          });
      } catch (e) {
        window.alert("JSON 파싱에 실패했습니다.");
      }
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    $("dist-chips").addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (!btn) return;
      state.dist = btn.getAttribute("data-dist");
      document.querySelectorAll("#dist-chips .chip").forEach(function (c) {
        c.classList.toggle("is-active", c === btn);
      });
      renderList();
    });

    $("btn-back-dashboard").addEventListener("click", function () {
      showScreen("dashboard");
    });

    document.querySelectorAll(".nav-item[data-view], .project-nav-item[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        navigateToView(btn.getAttribute("data-view"));
      });
    });

    $("field-date").addEventListener("change", function () {
      renderNameSuggestions();
      scheduleWeatherFetch(true);
    });
    $("field-date").addEventListener("input", function () {
      renderNameSuggestions();
      scheduleWeatherFetch(false);
    });

    $("field-name").addEventListener("input", function () {
      scheduleWeatherFetch(false);
    });
    $("field-name").addEventListener("change", function () {
      scheduleWeatherFetch(true);
    });

    $("field-weather").addEventListener("input", function () {
      state.weatherManualEdit = true;
      setWeatherHint("직접 입력 중 (자동 조회 일시 중지)", "");
    });

    $("btn-fetch-weather").addEventListener("click", function () {
      state.weatherManualEdit = false;
      fetchWeatherAuto(true);
    });

    $("btn-save-kma-key").addEventListener("click", saveKmaKey);

    $("btn-reseed-keep").addEventListener("click", function () {
      if (
        !window.confirm(
          "Keep 메모 25건으로 기록을 덮어씁니다. 지금까지 수정·추가한 내용은 사라집니다. 계속할까요?"
        )
      ) {
        return;
      }
      MarathonDb.reseedFromKeep()
        .then(function () {
          return refreshRaces();
        })
        .then(function () {
          closeDataMenu();
          showScreen("dashboard");
        })
        .catch(function (err) {
          window.alert(
            "Keep 기록을 불러오지 못했습니다.\n" +
              ((err && err.message) || "")
          );
        });
    });

    $("race-form").addEventListener("submit", saveRace);

    $("btn-data-menu").addEventListener("click", function (e) {
      e.stopPropagation();
      toggleDataMenu();
    });

    document.addEventListener("click", function () {
      closeDataMenu();
    });

    $("data-menu").addEventListener("click", function (e) {
      e.stopPropagation();
    });

    $("btn-export").addEventListener("click", exportJson);

    $("import-file").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      handleImportFile(file, false);
      e.target.value = "";
    });

    $("data-menu").querySelector("label:not(.data-menu__key)").addEventListener("click", function () {
      state.importReplace = false;
    });

    $("btn-import-replace").addEventListener("click", function () {
      state.importReplace = true;
      $("import-file-hidden").click();
    });

    $("import-file-hidden").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (file && state.importReplace) {
        if (
          !window.confirm("기존 기록을 모두 지우고 가져올까요?")
        ) {
          e.target.value = "";
          return;
        }
        handleImportFile(file, true);
      }
      e.target.value = "";
      state.importReplace = false;
    });
  }

  function updateStorageBanner(mode) {
    var hint = document.querySelector(".app-banner .storage-hint");
    if (!hint) return;
    var storeLabel =
      mode === "indexeddb"
        ? "IndexedDB"
        : mode === "localstorage"
          ? "localStorage"
          : "저장 불가";
    hint.textContent =
      "🔒 " +
      storeLabel +
      " · 내 브라우저에만" +
      (mode === "localstorage"
        ? " (IndexedDB 제한 → localStorage)"
        : "") +
      " · JSON 백업 권장" +
      backupNudgeText();
  }

  function recordExportBackup() {
    try {
      localStorage.setItem(BACKUP_REMINDER_KEY, new Date().toISOString());
    } catch (e) {}
    MarathonDb.getStorageMode().then(updateStorageBanner);
  }

  function isProdHost() {
    return (
      location.protocol !== "file:" &&
      (location.hostname === "cxr542.github.io" ||
        location.hostname.endsWith(".github.io"))
    );
  }

  function backupNudgeText() {
    if (!isProdHost()) return "";
    try {
      var raw = localStorage.getItem(BACKUP_REMINDER_KEY);
      if (!raw) {
        return " · 💾 JSON 백업 권장";
      }
      var days = (Date.now() - new Date(raw).getTime()) / 86400000;
      if (days >= BACKUP_NUDGE_DAYS) {
        return " · 💾 백업 " + Math.floor(days) + "일 경과";
      }
    } catch (e) {}
    return "";
  }

  function showInitError(err) {
    var msg = (err && err.message) || String(err);
    var hint =
      "저장소를 열 수 없습니다. " +
      (location.protocol === "file:"
        ? "HTML 파일 직접 열기 대신 npm run preview 또는 GitHub Pages URL을 사용하세요."
        : "브라우저 설정에서 사이트 데이터·쿠키 저장을 허용해 주세요.");
    if (msg === "no-seed") {
      hint = "Keep 시드(keep-seed.js)를 불러오지 못했습니다. 페이지를 새로고침하세요.";
    }
    $("race-list").innerHTML =
      '<li class="race-list--empty">' +
      escapeHtml(hint) +
      "<br><small>" +
      escapeHtml(msg) +
      "</small></li>";
  }

  function init() {
    if (window.ProjectShell) {
      ProjectShell.init({
        storageKey: "marathon-log-sidebar-collapsed",
        shellId: "app-shell",
        railToggleId: "sidebar-toggle",
        toolbarToggleId: "sidebar-toggle-toolbar",
        mobileTabs: true,
        onViewChange: navigateToView,
      });
      ProjectShell.initBranding({
        storageKey: "marathon-log-branding",
        defaults: {
          title: "마라톤 기록",
          tagline: "대회 기록 · PB · 통계",
        },
      });
    }
    bindEvents();
    loadKmaKeyField();
    resetForm();
    MarathonDb.getStorageMode()
      .then(function (mode) {
        updateStorageBanner(mode);
        return MarathonDb.seedIfEmpty();
      })
      .then(function () {
        return refreshRaces();
      })
      .catch(showInitError);
  }

  init();
})();
