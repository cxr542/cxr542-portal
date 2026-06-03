(function (global) {
  "use strict";

  var cfg = {};

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function isDrawerMode() {
    return global.matchMedia("(max-width: 1024px)").matches;
  }

  function openDrawer() {
    document.body.classList.add("project-nav-open");
    var backdrop = qs("#" + (cfg.backdropId || "project-nav-backdrop"));
    if (backdrop) {
      backdrop.hidden = false;
      backdrop.setAttribute("aria-hidden", "false");
    }
    qsa('[id="' + (cfg.navToggleId || "project-nav-toggle") + '"], .project-nav-toggle').forEach(
      function (btn) {
        btn.setAttribute("aria-expanded", "true");
      }
    );
  }

  function closeDrawer() {
    document.body.classList.remove("project-nav-open");
    var backdrop = qs("#" + (cfg.backdropId || "project-nav-backdrop"));
    if (backdrop) {
      backdrop.hidden = true;
      backdrop.setAttribute("aria-hidden", "true");
    }
    qsa('[id="' + (cfg.navToggleId || "project-nav-toggle") + '"], .project-nav-toggle').forEach(
      function (btn) {
        btn.setAttribute("aria-expanded", "false");
      }
    );
  }

  function applyCollapsed(collapsed) {
    var shell = qs("#" + (cfg.shellId || "app-shell"));
    if (shell) shell.classList.toggle("is-sidebar-collapsed", collapsed);
    document.documentElement.classList.toggle("project-sidebar-collapsed-boot", collapsed);
    var rail = qs("#" + (cfg.railToggleId || "sidebar-toggle"));
    if (rail) {
      rail.setAttribute("aria-expanded", collapsed ? "false" : "true");
      var label = collapsed ? "메뉴 펼치기" : "메뉴 접기";
      rail.setAttribute("aria-label", label);
      rail.title = label;
      var railLabel = rail.querySelector(".project-sidebar-rail__label, .sidebar-rail__label");
      if (railLabel) railLabel.textContent = collapsed ? "펼침" : "접기";
    }
    qsa(".project-nav-toggle, #" + (cfg.toolbarToggleId || "sidebar-toggle-toolbar")).forEach(
      function (btn) {
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      }
    );
  }

  function setActiveView(view) {
    if (!view) return;
    qsa(".project-nav-item[data-view], .nav-item[data-view]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-view") === view);
    });
    qsa(".project-mobile-tab[data-view]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-view") === view);
    });
  }

  function bindDrawer() {
    var toggleSel =
      cfg.navToggleSelector ||
      "#project-nav-toggle, #sidebar-toggle-toolbar, .project-nav-toggle";
    qsa(toggleSel).forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!isDrawerMode()) return;
        if (document.body.classList.contains("project-nav-open")) closeDrawer();
        else openDrawer();
      });
    });
    var backdrop = qs("#" + (cfg.backdropId || "project-nav-backdrop"));
    if (backdrop) {
      backdrop.addEventListener("click", closeDrawer);
    }
    qsa(".project-nav-item[data-view], .nav-item[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (isDrawerMode()) closeDrawer();
      });
    });
    global.matchMedia("(max-width: 1024px)").addEventListener("change", function () {
      if (!isDrawerMode()) closeDrawer();
    });
  }

  function bindCollapse(storageKey) {
    var collapseEnabled = cfg.enableCollapse !== false;
    var collapsed = false;
    if (collapseEnabled) {
      try {
        collapsed = localStorage.getItem(storageKey) === "1";
      } catch (e) {}
      applyCollapsed(collapsed);
    }

    function onToggle() {
      if (isDrawerMode()) {
        if (document.body.classList.contains("project-nav-open")) closeDrawer();
        else openDrawer();
        return;
      }
      if (!collapseEnabled) return;
      var shell = qs("#" + (cfg.shellId || "app-shell"));
      collapsed = shell && shell.classList.contains("is-sidebar-collapsed");
      collapsed = !collapsed;
      try {
        localStorage.setItem(storageKey, collapsed ? "1" : "0");
      } catch (e) {}
      applyCollapsed(collapsed);
    }

    if (collapseEnabled) {
      var rail = qs("#" + (cfg.railToggleId || "sidebar-toggle"));
      if (rail) rail.addEventListener("click", onToggle);
    }
    qsa(".project-nav-toggle, #" + (cfg.toolbarToggleId || "sidebar-toggle-toolbar")).forEach(
      function (btn) {
        btn.addEventListener("click", function () {
          if (isDrawerMode()) return;
          if (!collapseEnabled) return;
          onToggle();
        });
      }
    );
  }

  function bindMobileTabs() {
    qsa(".project-mobile-tab[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var view = btn.getAttribute("data-view");
        if (cfg.onViewChange) cfg.onViewChange(view, { source: "mobile-tab" });
      });
    });
  }

  function init(options) {
    cfg = options || {};
    var storageKey = cfg.storageKey || "project-sidebar-collapsed";
    bindDrawer();
    bindCollapse(storageKey);
    if (cfg.mobileTabs) bindMobileTabs();
    closeDrawer();
  }

  function loadBranding(storageKey) {
    try {
      var data = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (data.subtitle && !data.tagline) data.tagline = data.subtitle;
      return data;
    } catch (e) {
      return {};
    }
  }

  function saveBranding(storageKey, data) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (e) {}
  }

  function syncBrandingUi(options, data) {
    var titleEl = qs(options.titleSelector || "#app-banner-title");
    var taglineEl = qs(options.taglineSelector || "#app-banner-tagline");
    var title = data.title || options.defaults.title || "";
    var tagline = data.tagline || data.subtitle || options.defaults.tagline || "";
    if (titleEl) titleEl.textContent = title;
    if (taglineEl) taglineEl.textContent = tagline;
    if (options.pageTitle !== false && title) {
      document.title = title + (options.titleSuffix || "");
    }
    if (options.syncSidebar !== false) {
      var sideTitle = qs("#app-brand-title");
      var sideSub = qs("#app-brand-sub");
      if (sideTitle) sideTitle.textContent = title;
      if (sideSub) sideSub.textContent = tagline;
    }
  }

  function beginInlineEdit(el, onCommit) {
    if (!el || el.dataset.editing === "1") return;
    el.dataset.editing = "1";
    var isTagline = el.classList.contains("app-banner__tagline");
    var field = document.createElement("input");
    field.type = "text";
    field.className = "project-brand-input";
    if (isTagline) field.classList.add("app-banner__tagline-input");
    field.value = el.textContent;
    el.style.display = "none";
    el.parentNode.insertBefore(field, el.nextSibling);
    field.focus();
    field.select();

    function finish(save) {
      if (save) {
        var val = field.value.trim() || el.textContent;
        el.textContent = val;
        if (onCommit) onCommit(val);
      }
      field.remove();
      el.style.display = "";
      delete el.dataset.editing;
    }

    field.addEventListener("blur", function () {
      finish(true);
    });
    field.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });
  }

  function bindBrandField(el, label, onCommit) {
    if (!el || el.closest(".project-brand-editable-wrap")) return;
    el.classList.add("project-brand-editable");
    el.setAttribute("title", label + " (더블클릭 또는 ✏️)");

    var wrap = document.createElement("span");
    wrap.className = "project-brand-editable-wrap";
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "project-brand-edit-btn";
    btn.setAttribute("aria-label", label);
    btn.innerHTML = '<span aria-hidden="true">✏️</span>';
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      beginInlineEdit(el, onCommit);
    });
    wrap.appendChild(btn);

    el.addEventListener("dblclick", function (e) {
      e.preventDefault();
      e.stopPropagation();
      beginInlineEdit(el, onCommit);
    });
  }

  function initBranding(options) {
    options = options || {};
    if (!options.storageKey) return;
    var data = loadBranding(options.storageKey);
    syncBrandingUi(options, data);

    var titleEl = qs(options.titleSelector || "#app-banner-title");
    var taglineEl = qs(options.taglineSelector || "#app-banner-tagline");

    function persist(field, value) {
      var next = loadBranding(options.storageKey);
      next[field] = value;
      saveBranding(options.storageKey, next);
      syncBrandingUi(options, next);
    }

    if (titleEl) {
      bindBrandField(titleEl, "제목 수정", function (val) {
        persist("title", val);
      });
    }
    if (taglineEl) {
      bindBrandField(taglineEl, "소개 문구 수정", function (val) {
        persist("tagline", val);
      });
    }
  }

  function bindInlineTitles(root, selector, onSave) {
    qsa(selector, root).forEach(function (el) {
      el.classList.add("inline-title-editable");
      el.setAttribute("title", "더블클릭하여 제목 수정");
      el.addEventListener("dblclick", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var card = el.closest("[data-id]");
        if (!card) return;
        var id = card.getAttribute("data-id");
        beginInlineEdit(el, function (val) {
          if (onSave) onSave(id, val, el);
        });
      });
    });
  }

  global.ProjectShell = {
    init: init,
    setActiveView: setActiveView,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    isDrawerMode: isDrawerMode,
    initBranding: initBranding,
    bindInlineTitles: bindInlineTitles,
  };
})(window);
