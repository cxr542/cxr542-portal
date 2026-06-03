(function () {
  "use strict";

  var S = window.VisionFontSettings;
  var SIDEBAR_KEY = "vision-font-sidebar-collapsed";

  var SAMPLE_ARTICLE = [
    "오늘 아침 공원을 지나며 마라톤 연습을 하는 사람들을 자주 봅니다.",
    "시력이 나빠지면 작은 글자를 읽을 때 눈이 쉽게 피로해집니다. Vision Font는 짧은 시력 테스트로 읽기에 편한 글자 크기·줄간격·자간을 맞춥니다.",
    "모바일 앱에서는 WebView에 CSS를 주입해 위키뉴스 같은 페이지도 읽기 쉽게 바꿉니다. 이 웹 데모에서는 아래 샘플 기사에 맞춤 스타일을 바로 적용해 볼 수 있습니다.",
    "설정은 이 포털 도메인의 localStorage에 저장되며, JSON으로 보내기·가져오기할 수 있습니다.",
  ];

  var state = {
    view: "test",
    testStep: 1,
    settings: S.load(),
    readerUrl: "",
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

  function persistSettings() {
    state.settings = S.save(state.settings);
  }

  function navigateToView(view) {
    state.view = view;
    ProjectShell.setActiveView(view);
    qsaPanels().forEach(function (panel) {
      panel.classList.toggle("is-active", panel.getAttribute("data-panel") === view);
    });
    if (view === "settings") renderSettings();
    if (view === "reader") renderReader();
    if (view === "test") renderTest();
  }

  function qsaPanels() {
    return Array.prototype.slice.call(document.querySelectorAll(".vf-panel"));
  }

  function renderTest() {
    var step = S.TEST_STEPS[state.testStep - 1];
    if (!step) {
      state.testStep = 1;
      step = S.TEST_STEPS[0];
    }
    var meta = $("vf-test-meta");
    var line = $("vf-test-line");
    if (meta) {
      meta.textContent =
        "단계 " + step.step + " / " + S.TEST_STEPS.length + " · 글자 높이 약 " + step.sizePx + "px";
    }
    if (line) {
      line.textContent = step.line;
      line.style.fontSize = step.sizePx + "px";
    }
  }

  function finishTestAtStep(stepNum) {
    state.settings = S.settingsFromStep(stepNum);
    persistSettings();
    state.testStep = 1;
    navigateToView("settings");
  }

  function onTestNext() {
    if (state.testStep >= S.TEST_STEPS.length) {
      finishTestAtStep(5);
      return;
    }
    state.testStep += 1;
    renderTest();
  }

  function onTestStop() {
    finishTestAtStep(state.testStep);
  }

  function renderSettings() {
    var s = state.settings;
    var levelEl = $("vf-level-badge");
    if (levelEl) levelEl.textContent = "레벨 " + s.level;

    var fs = $("vf-range-font");
    var lh = $("vf-range-line");
    var ls = $("vf-range-spacing");
    if (fs) {
      fs.value = s.fontSize;
      $("vf-val-font").textContent = s.fontSize + "px";
    }
    if (lh) {
      lh.value = Math.round(s.lineHeight * 100);
      $("vf-val-line").textContent = s.lineHeight.toFixed(2);
    }
    if (ls) {
      ls.value = Math.round(s.letterSpacing * 100);
      $("vf-val-spacing").textContent = s.letterSpacing.toFixed(2) + "em";
    }

    var preview = $("vf-settings-preview");
    var cssOut = $("vf-css-output");
    if (preview) {
      preview.innerHTML =
        "<p>맞춤 설정이 적용된 미리보기입니다. 눈이 편한지 확인한 뒤 기사 읽기로 이동하세요.</p>" +
        "<p>" +
        escapeHtml(SAMPLE_ARTICLE[1]) +
        "</p>";
      S.applyToElement(preview, s);
    }
    if (cssOut) cssOut.textContent = S.toCss(s);
  }

  function syncSettingsFromSliders() {
    var fs = $("vf-range-font");
    var lh = $("vf-range-line");
    var ls = $("vf-range-spacing");
    if (!fs || !lh || !ls) return;
    state.settings.fontSize = Number(fs.value);
    state.settings.lineHeight = Number(lh.value) / 100;
    state.settings.letterSpacing = Number(ls.value) / 100;
    persistSettings();
    renderSettings();
  }

  function renderReader() {
    var sample = $("vf-reader-sample");
    if (sample) {
      sample.innerHTML = SAMPLE_ARTICLE.map(function (p) {
        return "<p>" + escapeHtml(p) + "</p>";
      }).join("");
      S.applyToElement(sample, state.settings);
    }
    var frame = $("vf-reader-frame");
    var hint = $("vf-reader-url-hint");
    if (frame && state.readerUrl) {
      frame.src = state.readerUrl;
      frame.hidden = false;
      if (hint) {
        hint.hidden = false;
        hint.textContent =
          "외부 페이지는 보안상 CSS를 바꿀 수 없습니다. Expo 앱 WebView에서만 주입됩니다.";
      }
    } else if (frame) {
      frame.removeAttribute("src");
      frame.hidden = true;
      if (hint) hint.hidden = true;
    }
  }

  function loadReaderUrl() {
    var input = $("vf-url-input");
    if (!input) return;
    var raw = (input.value || "").trim();
    if (!raw) return;
    try {
      var url = new URL(raw.indexOf("://") >= 0 ? raw : "https://" + raw);
      state.readerUrl = url.href;
      renderReader();
    } catch (e) {
      alert("올바른 URL을 입력해 주세요.");
    }
  }

  function exportJson() {
    var blob = new Blob([JSON.stringify(state.settings, null, 2)], {
      type: "application/json",
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vision-font-settings.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJson(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result || "{}"));
        state.settings = S.normalize(data);
        persistSettings();
        if (state.view === "settings") renderSettings();
        if (state.view === "reader") renderReader();
        alert("설정을 가져왔습니다.");
      } catch (e) {
        alert("JSON 형식이 올바르지 않습니다.");
      }
    };
    reader.readAsText(file);
  }

  function copyCss() {
    var text = S.toCss(state.settings);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          alert("CSS를 복사했습니다.");
        },
        function () {
          prompt("CSS 복사:", text);
        }
      );
    } else {
      prompt("CSS 복사:", text);
    }
  }

  function bindEvents() {
    qsaPanels();
    document.querySelectorAll(".project-nav-item[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var view = btn.getAttribute("data-view");
        if (view) navigateToView(view);
      });
    });

    var nextBtn = $("btn-test-next");
    var stopBtn = $("btn-test-stop");
    if (nextBtn) nextBtn.addEventListener("click", onTestNext);
    if (stopBtn) stopBtn.addEventListener("click", onTestStop);

    ["vf-range-font", "vf-range-line", "vf-range-spacing"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("input", syncSettingsFromSliders);
    });

    var applyPreset = $("btn-apply-level");
    if (applyPreset) {
      applyPreset.addEventListener("click", function () {
        var level = Number(($("vf-preset-level") || {}).value) || state.settings.level;
        var preset = S.presetForLevel(level);
        state.settings = S.normalize(
          Object.assign({}, preset, { level: level, testedAt: state.settings.testedAt })
        );
        persistSettings();
        renderSettings();
      });
    }

    var goReader = $("btn-go-reader");
    if (goReader) goReader.addEventListener("click", function () {
      navigateToView("reader");
    });

    var loadUrl = $("btn-load-url");
    if (loadUrl) loadUrl.addEventListener("click", loadReaderUrl);
    var urlInput = $("vf-url-input");
    if (urlInput) {
      urlInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") loadReaderUrl();
      });
    }

    var exportBtn = $("btn-export");
    var importFile = $("import-file");
    if (exportBtn) exportBtn.addEventListener("click", exportJson);
    if (importFile) {
      importFile.addEventListener("change", function () {
        importJson(importFile.files && importFile.files[0]);
        importFile.value = "";
      });
    }

    var copyBtn = $("btn-copy-css");
    if (copyBtn) copyBtn.addEventListener("click", copyCss);

    var retest = $("btn-retest");
    if (retest) {
      retest.addEventListener("click", function () {
        state.testStep = 1;
        navigateToView("test");
      });
    }
  }

  function buildPresetOptions() {
    var sel = $("vf-preset-level");
    if (!sel) return;
    sel.innerHTML = "";
    [1, 2, 3, 4, 5].forEach(function (lv) {
      var opt = document.createElement("option");
      opt.value = String(lv);
      opt.textContent = "레벨 " + lv + " (약 " + S.presetForLevel(lv).fontSize + "px)";
      if (lv === state.settings.level) opt.selected = true;
      sel.appendChild(opt);
    });
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
        storageKey: "vision-font-branding-v1",
        titleSuffix: " · 웹 데모",
        defaults: {
          title: "vision-font",
          tagline: "시력 맞춤 기사 리더 · 웹 데모",
        },
      });
    }
    buildPresetOptions();
    bindEvents();
    if (state.settings.testedAt) {
      navigateToView("settings");
    } else {
      navigateToView("test");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
