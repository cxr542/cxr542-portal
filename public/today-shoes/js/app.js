(function () {
  "use strict";

  var Store = window.TodayShoesStore;
  var Analysis = window.TodayShoesAnalysis;
  var SIDEBAR_KEY = "today-shoes-sidebar-collapsed";

  var state = {
    view: "home",
    shoes: [],
    detailId: null,
    draft: {
      images: { front: "", left: "", right: "" },
      geminiAnalyzed: false,
      fields: {
        displayName: "",
        brand: "",
        model: "",
        traits: "",
        bestFor: "",
        caution: "",
      },
    },
    analyzing: false,
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

  function readFileDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function reloadShoes() {
    state.shoes = Store.load();
  }

  function navigateToView(view) {
    state.view = view;
    if (view !== "detail") state.detailId = null;
    ProjectShell.setActiveView(view === "detail" ? "closet" : view);
    document.querySelectorAll(".ts-panel").forEach(function (panel) {
      var panelView = panel.getAttribute("data-panel");
      var active =
        panelView === view || (view === "detail" && panelView === "detail");
      panel.classList.toggle("is-active", active);
    });
    if (view === "home") renderHome();
    if (view === "closet" || view === "detail") renderCloset();
    if (view === "add") renderAdd();
    if (view === "guide") renderGuide();
    if (view === "links") renderLinks();
  }

  function aiCount() {
    return state.shoes.filter(function (s) {
      return s.geminiAnalyzed;
    }).length;
  }

  function renderHome() {
    var countEl = $("ts-count-shoes");
    var aiEl = $("ts-count-ai");
    var recentEl = $("ts-recent-grid");
    if (countEl) countEl.textContent = String(state.shoes.length);
    if (aiEl) {
      aiEl.textContent = state.shoes.length ? aiCount() + "/" + state.shoes.length : "0";
    }
    if (!recentEl) return;
    if (!state.shoes.length) {
      recentEl.innerHTML = '<p class="ts-empty">신발장이 비어 있습니다. 사진을 등록해 보세요.</p>';
      return;
    }
    recentEl.innerHTML = state.shoes
      .slice(0, 4)
      .map(function (s) {
        return shoeCardHtml(s);
      })
      .join("");
    bindShoeCards(recentEl);
  }

  function shoeCardHtml(s) {
    return (
      '<button type="button" class="ts-shoe-card" data-id="' +
      escapeHtml(s.id) +
      '">' +
      '<div class="ts-shoe-card__thumb" style="background-image:url(\'' +
      escapeHtml(s.imageUri) +
      '\')"></div>' +
      '<div class="ts-shoe-card__body"><strong>' +
      escapeHtml(s.nickname) +
      "</strong>" +
      (s.brand ? "<small>" + escapeHtml(s.brand) + "</small>" : "") +
      (s.geminiAnalyzed ? '<span class="ts-badge-ai">AI</span>' : "") +
      "</div></button>"
    );
  }

  function bindShoeCards(root) {
    (root || document).querySelectorAll(".ts-shoe-card[data-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openDetail(btn.getAttribute("data-id"));
      });
    });
  }

  function renderCloset() {
    var grid = $("ts-closet-grid");
    if (!grid) return;
    if (!state.shoes.length) {
      grid.innerHTML =
        '<p class="ts-empty">등록된 신발이 없습니다. <strong>등록</strong> 탭에서 사진을 추가하세요.</p>';
      return;
    }
    grid.innerHTML = state.shoes.map(shoeCardHtml).join("");
    bindShoeCards(grid);
    renderDetail();
  }

  function openDetail(id) {
    state.detailId = id;
    navigateToView("detail");
  }

  function renderDetail() {
    var wrap = $("ts-detail-wrap");
    if (!wrap) return;
    if (!state.detailId) {
      wrap.innerHTML = "";
      return;
    }
    var shoe = state.shoes.find(function (s) {
      return s.id === state.detailId;
    });
    if (!shoe) {
      wrap.innerHTML = '<p class="ts-empty">항목을 찾을 수 없습니다.</p>';
      return;
    }
    wrap.innerHTML =
      '<div class="ts-detail">' +
      '<div class="ts-detail__hero" style="background-image:url(\'' +
      escapeHtml(shoe.imageUri) +
      "')\"></div>" +
      "<h3 style=\"margin:0\">" +
      escapeHtml(shoe.nickname) +
      "</h3>" +
      (shoe.brand || shoe.model
        ? "<p style=\"margin:0;color:var(--shell-muted)\">" +
          escapeHtml([shoe.brand, shoe.model].filter(Boolean).join(" · ")) +
          "</p>"
        : "") +
      '<p class="ts-detail__meta">' +
      escapeHtml(shoe.traits || "") +
      (shoe.recommendation ? "\n\n" + escapeHtml(shoe.recommendation) : "") +
      "</p>" +
      '<div class="ts-actions">' +
      '<button type="button" class="btn" id="btn-detail-back">← 신발장</button>' +
      '<button type="button" class="btn btn--danger" id="btn-detail-delete">삭제</button>' +
      "</div></div>";

    var back = $("btn-detail-back");
    var del = $("btn-detail-delete");
    if (back) back.addEventListener("click", function () {
      navigateToView("closet");
    });
    if (del) {
      del.addEventListener("click", function () {
        if (!confirm("이 신발을 삭제할까요?")) return;
        Store.remove(shoe.id);
        reloadShoes();
        navigateToView("closet");
      });
    }
  }

  function renderAdd() {
    ["front", "left", "right"].forEach(function (angle) {
      var slot = document.querySelector('.ts-upload-slot[data-angle="' + angle + '"]');
      var preview = slot && slot.querySelector(".ts-upload-preview");
      var uri = state.draft.images[angle];
      if (slot) slot.classList.toggle("has-image", Boolean(uri));
      if (preview) {
        preview.style.backgroundImage = uri ? "url('" + uri + "')" : "none";
      }
    });
    var f = state.draft.fields;
    if ($("field-display-name")) $("field-display-name").value = f.displayName;
    if ($("field-brand")) $("field-brand").value = f.brand;
    if ($("field-model")) $("field-model").value = f.model;
    if ($("field-traits")) $("field-traits").value = f.traits;
    if ($("field-best-for")) $("field-best-for").value = f.bestFor;
    if ($("field-caution")) $("field-caution").value = f.caution;
    if ($("field-api-key")) $("field-api-key").value = Store.loadApiKey();
  }

  function readDraftFieldsFromForm() {
    state.draft.fields = {
      displayName: ($("field-display-name") || {}).value || "",
      brand: ($("field-brand") || {}).value || "",
      model: ($("field-model") || {}).value || "",
      traits: ($("field-traits") || {}).value || "",
      bestFor: ($("field-best-for") || {}).value || "",
      caution: ($("field-caution") || {}).value || "",
    };
  }

  function onImageSelected(angle, file) {
    if (!file) return;
    readFileDataUrl(file).then(function (uri) {
      state.draft.images[angle] = uri;
      renderAdd();
    });
  }

  function runAnalysis() {
    var frontInput = $("file-front");
    var file = frontInput && frontInput.files && frontInput.files[0];
    if (!file && !state.draft.images.front) {
      alert("정면 사진을 먼저 선택해 주세요.");
      return;
    }
    state.analyzing = true;
    var btn = $("btn-analyze");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "분석 중…";
    }
    var promise = file
      ? Analysis.analyzeImage(file)
      : Promise.resolve(Analysis.mockAnalysis());
    promise
      .then(function (result) {
        state.draft.geminiAnalyzed = result.fromVision === true;
        state.draft.fields = {
          displayName: result.displayName,
          brand: result.brand,
          model: result.model,
          traits: result.traits,
          bestFor: result.bestFor,
          caution: result.caution,
        };
        renderAdd();
      })
      .finally(function () {
        state.analyzing = false;
        if (btn) {
          btn.disabled = false;
          btn.textContent = "AI 분석 (정면)";
        }
      });
  }

  function saveShoe() {
    readDraftFieldsFromForm();
    var front = state.draft.images.front;
    if (!front) {
      alert("정면 사진이 필요합니다.");
      return;
    }
    var fields = state.draft.fields;
    var nickname = fields.displayName.trim() || "러닝화";
    Store.add({
      imageUri: front,
      imageUris: {
        front: front,
        left: state.draft.images.left || undefined,
        right: state.draft.images.right || undefined,
      },
      nickname: nickname,
      brand: fields.brand.trim() || undefined,
      model: fields.model.trim() || undefined,
      traits: fields.traits.trim() || undefined,
      recommendation: Store.formatRecommendation(fields),
      createdAt: Date.now(),
      source: "album",
      geminiAnalyzed: state.draft.geminiAnalyzed,
    });
    state.draft = {
      images: { front: "", left: "", right: "" },
      geminiAnalyzed: false,
      fields: {
        displayName: "",
        brand: "",
        model: "",
        traits: "",
        bestFor: "",
        caution: "",
      },
    };
    ["front", "left", "right"].forEach(function (a) {
      var input = $("file-" + a);
      if (input) input.value = "";
    });
    reloadShoes();
    alert("신발장에 저장했습니다.");
    navigateToView("closet");
  }

  function renderGuide() {
    /* static in HTML */
  }

  function renderLinks() {
    if ($("field-api-key-links")) {
      $("field-api-key-links").value = Store.loadApiKey();
    }
  }

  function exportJson() {
    var blob = new Blob([JSON.stringify(state.shoes, null, 2)], {
      type: "application/json",
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "today-shoes-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJson(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result || "[]"));
        var n = Store.importList(data);
        reloadShoes();
        navigateToView("closet");
        alert(n ? n + "켤레를 가져왔습니다." : "가져올 항목이 없습니다.");
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

    ["front", "left", "right"].forEach(function (angle) {
      var input = $("file-" + angle);
      if (input) {
        input.addEventListener("change", function () {
          onImageSelected(angle, input.files && input.files[0]);
        });
      }
    });

    var analyzeBtn = $("btn-analyze");
    if (analyzeBtn) analyzeBtn.addEventListener("click", runAnalysis);
    var saveBtn = $("btn-save-shoe");
    if (saveBtn) saveBtn.addEventListener("click", saveShoe);

    var exportBtn = $("btn-export");
    var importFile = $("import-file");
    if (exportBtn) exportBtn.addEventListener("click", exportJson);
    if (importFile) {
      importFile.addEventListener("change", function () {
        importJson(importFile.files && importFile.files[0]);
        importFile.value = "";
      });
    }

    function saveApiKeyFromForm() {
      var key =
        ($("field-api-key-links") || {}).value || ($("field-api-key") || {}).value || "";
      Store.saveApiKey(key);
      alert("API 키를 저장했습니다.");
    }
    var saveKey = $("btn-save-api-key");
    var saveKeyLinks = $("btn-save-api-key-links");
    if (saveKey) saveKey.addEventListener("click", saveApiKeyFromForm);
    if (saveKeyLinks) saveKeyLinks.addEventListener("click", saveApiKeyFromForm);

    var toolbarAdd = $("btn-toolbar-add");
    if (toolbarAdd) {
      toolbarAdd.addEventListener("click", function () {
        navigateToView("add");
      });
    }

    var legacyBtn = $("btn-import-legacy");
    if (legacyBtn) {
      legacyBtn.addEventListener("click", function () {
        var n = Store.importPortalLegacy();
        reloadShoes();
        renderHome();
        alert(n ? n + "건의 포털 MVP 메모를 가져왔습니다." : "가져올 MVP 메모가 없습니다.");
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
        storageKey: "today-shoes-branding-v1",
        titleSuffix: " · 웹 데모",
        defaults: {
          title: "오늘뭐신지",
          tagline: "러닝화 사진 신발장 · 웹 데모",
        },
      });
    }
    Store.seedDemoIfEmpty();
    reloadShoes();
    bindEvents();
    navigateToView("home");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
