(function () {
  "use strict";

  var Store = window.GeminiTunerStore;
  var Characters = window.GeminiTunerCharacters;
  var SIDEBAR_KEY = "gemini-tuner-sidebar-collapsed";
  var CHAT_ACTIVE_MS = 8000;

  var METER_LABEL = {
    waiting: "Meter: 대화를 기다리는 중…",
    dom: "Meter: DOM 추정 (글자÷4)",
    network: "Meter: API (usageMetadata)",
  };

  var state = { view: "dashboard", data: Store.load() };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatKrw(usd, rate) {
    return "≈ ₩" + Math.round(usd * rate).toLocaleString("ko-KR");
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function persist() {
    state.data = Store.save(state.data);
  }

  function isChatActive() {
    return state.data.recentChatAt && Date.now() - state.data.recentChatAt < CHAT_ACTIVE_MS;
  }

  function overallMood() {
    var pct = Store.budgetPct(state.data);
    if (pct >= state.data.warnPct) return "warn";
    if (isChatActive()) return "active";
    return "idle";
  }

  function navigateToView(view) {
    state.view = view;
    ProjectShell.setActiveView(view);
    document.querySelectorAll(".gt-panel").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-panel") === view);
    });
    if (view === "dashboard") renderDashboard();
    if (view === "sessions") renderSessions();
    if (view === "settings") renderSettings();
    if (view === "character") renderCharacterPanel();
  }

  function renderCharacterPanel() {
    var hero = $("gt-char-preview");
    if (Characters && hero) {
      Characters.renderHero(hero, {
        budgetPct: Store.budgetPct(state.data),
        warnPct: state.data.warnPct,
        totalTokens: state.data.totalTokens,
        active: isChatActive(),
        msgId: "gt-char-preview-msg",
        hintId: "gt-char-preview-hint",
      });
    }
  }

  function renderSidePanel() {
    var pct = Store.budgetPct(state.data);
    var warn = pct >= state.data.warnPct;
    var lt = state.data.lastTurn || { input: 0, output: 0, total: 0 };
    var panel = $("gt-sidepanel");
    if (panel) panel.classList.toggle("is-warn", warn);

    var badge = $("gt-panel-badge");
    if (badge) {
      badge.textContent = warn ? "⚠ 경고" : isChatActive() ? "감시 중" : "FinOps";
      badge.classList.toggle("gt-panel-badge--warn", warn);
    }

    setText("gt-panel-tokens", state.data.totalTokens.toLocaleString());
    setText("gt-panel-cost", "$" + state.data.sessionCostUsd.toFixed(4));
    setText("gt-panel-cost-krw", formatKrw(state.data.sessionCostUsd, state.data.usdToKrw));
    setText("gt-panel-limit", "/ $" + Number(state.data.budgetUsd).toFixed(2));
    setText("gt-panel-pct", "월 예산의 " + pct.toFixed(1) + "%");

    var bar = $("gt-panel-bar");
    if (bar) {
      bar.style.width = pct + "%";
      bar.className = "gt-panel-bar" + (pct >= 100 ? " is-red" : warn ? " is-yellow" : "");
    }

    setText("gt-turn-in", (lt.input || 0) + " tk");
    setText("gt-turn-out", (lt.output || 0) + " tk");
    setText("gt-turn-total", (lt.total || 0) + " tk");
    setText("gt-meter-status", METER_LABEL[state.data.meterMode] || METER_LABEL.waiting);
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function renderDashboard() {
    var mood = overallMood();
    var budgetPct = Store.budgetPct(state.data);
    var charWrap = $("gt-char-wrap");

    if (Characters && charWrap) {
      Characters.renderHero(charWrap, {
        budgetPct: budgetPct,
        warnPct: state.data.warnPct,
        totalTokens: state.data.totalTokens,
        active: mood === "active",
      });
    }
    if (Characters) {
      Characters.renderQuotaGrid($("gt-quota-grid"), state.data);
    }

    var shortSlider = $("quota-short");
    var longSlider = $("quota-long");
    if (shortSlider && String(shortSlider.value) !== String(state.data.quotaShortPct)) {
      shortSlider.value = state.data.quotaShortPct;
    }
    if (longSlider && String(longSlider.value) !== String(state.data.quotaLongPct)) {
      longSlider.value = state.data.quotaLongPct;
    }
    var shortVal = $("quota-short-val");
    var longVal = $("quota-long-val");
    if (shortVal) shortVal.textContent = state.data.quotaShortPct + "%";
    if (longVal) longVal.textContent = state.data.quotaLongPct + "%";

    renderSidePanel();

    var pct = budgetPct;
    var warn = pct >= state.data.warnPct;
    var widget = $("gt-finops-widget");
    if (widget) widget.classList.toggle("is-warn", warn);

    var tokensEl = $("gt-total-tokens");
    var costEl = $("gt-cost-usd");
    var krwEl = $("gt-cost-krw");
    var pctEl = $("gt-budget-pct");
    var bar = $("gt-budget-bar");
    if (tokensEl) tokensEl.textContent = state.data.totalTokens.toLocaleString();
    if (costEl) costEl.textContent = "$" + state.data.sessionCostUsd.toFixed(2);
    if (krwEl) krwEl.textContent = formatKrw(state.data.sessionCostUsd, state.data.usdToKrw);
    if (pctEl) pctEl.textContent = pct + "%";
    if (bar) {
      bar.style.width = pct + "%";
      bar.classList.toggle("is-warn", warn);
    }
  }

  function renderSessions() {
    var list = $("gt-sessions-list");
    if (!list) return;
    if (!state.data.sessions.length) {
      list.innerHTML = '<li class="gt-note">세션이 없습니다. 데모 채팅 + 로 gemini.google.com 대화를 시뮬레이션하세요.</li>';
      return;
    }
    list.innerHTML = state.data.sessions
      .map(function (s) {
        return (
          "<li><span><strong>" +
          escapeHtml(s.title) +
          '</strong><br><small style="color:#64748b">' +
          formatTime(s.at) +
          "</small></span><span>" +
          s.tokens.toLocaleString() +
          " tok · $" +
          s.costUsd.toFixed(2) +
          "</span></li>"
        );
      })
      .join("");
  }

  function renderSettings() {
    if ($("field-budget")) $("field-budget").value = state.data.budgetUsd;
    if ($("field-krw")) $("field-krw").value = state.data.usdToKrw;
    if ($("field-warn")) $("field-warn").value = state.data.warnPct;
  }

  function simulateChat() {
    var input = 200 + Math.floor(Math.random() * 1800);
    var output = 600 + Math.floor(Math.random() * 3600);
    var total = input + output;
    var cost = total * 0.000004;

    state.data.totalTokens += total;
    state.data.sessionCostUsd = Math.round((state.data.sessionCostUsd + cost) * 100) / 100;
    state.data.lastTurn = { input: input, output: output, total: total };
    state.data.meterMode = Math.random() > 0.35 ? "network" : "dom";
    state.data.recentChatAt = Date.now();
    state.data.sessions.unshift({
      id: "s-" + Date.now(),
      title: "gemini.google.com · 데모 대화",
      tokens: total,
      costUsd: Math.round(cost * 100) / 100,
      at: Date.now(),
    });
    if (state.data.sessions.length > 12) state.data.sessions.length = 12;
    persist();
    renderDashboard();
    if (state.view === "sessions") renderSessions();
  }

  function tickIdle() {
    if (isChatActive()) return;
    if (state.data.meterMode === "network") state.data.meterMode = "dom";
    persist();
    if (state.view === "dashboard") renderDashboard();
  }

  function exportJson() {
    var blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gemini-tuner-demo.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJson(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        state.data = Store.save(Object.assign(Store.load(), JSON.parse(String(reader.result))));
        renderDashboard();
        renderSessions();
        renderSettings();
        if (state.view === "character") renderCharacterPanel();
        alert("가져오기 완료");
      } catch (e) {
        alert("JSON 형식이 올바르지 않습니다.");
      }
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    document.querySelectorAll(".project-nav-item[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        navigateToView(btn.getAttribute("data-view"));
      });
    });
    var sim = $("btn-simulate-chat");
    if (sim) sim.addEventListener("click", simulateChat);
    var reset = $("btn-reset-demo");
    if (reset) {
      reset.addEventListener("click", function () {
        if (!confirm("데모 데이터를 초기화할까요?")) return;
        state.data = Store.save(JSON.parse(JSON.stringify(Store.DEFAULT)));
        renderDashboard();
        renderSessions();
        renderSettings();
      });
    }
    var saveSettings = $("btn-save-settings");
    if (saveSettings) {
      saveSettings.addEventListener("click", function () {
        state.data.budgetUsd = Number($("field-budget").value) || 20;
        state.data.usdToKrw = Number($("field-krw").value) || 1350;
        state.data.warnPct = Number($("field-warn").value) || 80;
        persist();
        renderDashboard();
        alert("설정을 저장했습니다.");
        if (window.ProjectShell) {
          ProjectShell.notifyTaskDone({
            module: "GeminiTuner",
            action: "설정 저장 완료",
            title: "FinOps settings",
          });
        }
      });
    }
    var shortSlider = $("quota-short");
    var longSlider = $("quota-long");
    function onQuotaInput() {
      if (shortSlider) state.data.quotaShortPct = Number(shortSlider.value) || 0;
      if (longSlider) state.data.quotaLongPct = Number(longSlider.value) || 0;
      persist();
      renderDashboard();
    }
    if (shortSlider) shortSlider.addEventListener("input", onQuotaInput);
    if (longSlider) longSlider.addEventListener("input", onQuotaInput);
    var exportBtn = $("btn-export");
    var importFile = $("import-file");
    if (exportBtn) exportBtn.addEventListener("click", exportJson);
    if (importFile) {
      importFile.addEventListener("change", function () {
        importJson(importFile.files && importFile.files[0]);
        importFile.value = "";
      });
    }
  }

  function init() {
    if (window.ProjectShell) {
      ProjectShell.init({
        storageKey: SIDEBAR_KEY,
        shellId: "app-shell",
        railToggleId: "sidebar-toggle",
        toolbarToggleId: "sidebar-toggle-toolbar",
        mobileTabs: true,
        onViewChange: navigateToView,
      });
      ProjectShell.initBranding({
        storageKey: "gemini-tuner-branding-v1",
        titleSuffix: " · 웹 데모",
        defaults: {
          title: "GeminiTuner",
          tagline: "gemini.google.com FinOps · 스파클 캐릭터 · 한도 위젯",
        },
      });
    }
    bindEvents();
    navigateToView("dashboard");
    setInterval(tickIdle, 4000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
