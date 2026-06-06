(function () {
  "use strict";

  var SIDEBAR_COLLAPSED_KEY = "prompt-collection-sidebar-collapsed";
  var BACKUP_REMINDER_KEY = "prompt-collection-last-export-at";
  var BACKUP_NUDGE_DAYS = 14;
  var renderSeq = 0;
  var state = {
    view: "list",
    search: "",
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

  function previewBody(body) {
    var t = (body || "").replace(/\s+/g, " ").trim();
    return t.length > 140 ? t.slice(0, 140) + "…" : t;
  }

  function filterPrompts(prompts) {
    return prompts.filter(function (p) {
      if (state.view === "pinned" && !p.pinned) return false;
      if (state.search) {
        var q = state.search.toLowerCase();
        return (
          (p.title || "").toLowerCase().indexOf(q) >= 0 ||
          (p.body || "").toLowerCase().indexOf(q) >= 0
        );
      }
      return true;
    });
  }

  function resetListFilters() {
    state.search = "";
    var searchEl = $("search");
    if (searchEl) searchEl.value = "";
  }

  function updateNavCounts(prompts) {
    var pinned = 0;
    prompts.forEach(function (p) {
      if (p.pinned) pinned += 1;
    });
    var allEl = $("nav-count-all");
    var pinnedEl = $("nav-count-pinned");
    if (allEl) {
      allEl.textContent = String(prompts.length);
      allEl.title = prompts.length ? "전체 " + prompts.length + "건" : "저장된 프롬프트 없음";
    }
    if (pinnedEl) pinnedEl.textContent = String(pinned);
  }

  function listMetaHtml(filteredCount, prompts) {
    var total = prompts.length;
    if (state.view === "pinned") {
      var pinnedTotal = prompts.filter(function (p) {
        return p.pinned;
      }).length;
      return (
        '<p class="list-meta list-meta--context">📌 <strong>고정함</strong>만 표시 · ' +
        filteredCount +
        "개 (고정 " +
        pinnedTotal +
        " · 전체 " +
        total +
        "건)</p>"
      );
    }
    if (filteredCount === total) {
      return (
        '<p class="list-meta list-meta--context">📋 <strong>전체 프롬프트</strong> · ' +
        filteredCount +
        "개</p>"
      );
    }
    return (
      '<p class="list-meta list-meta--context">📋 <strong>전체 프롬프트</strong> · ' +
      filteredCount +
      '개 표시 <span class="list-meta__dim">(전체 ' +
      total +
      "건)</span></p>"
    );
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        document.body.removeChild(ta);
        resolve();
      } catch (e) {
        document.body.removeChild(ta);
        reject(e);
      }
    });
  }

  function renderList(prompts) {
    prompts = Array.isArray(prompts) ? prompts : [];
    var filtered = filterPrompts(prompts);
    filtered.sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });
    if (!filtered.length) {
      $("content").innerHTML =
        '<p class="empty">📝 이 목록에 맞는 프롬프트가 없어요.</p>' +
        '<p class="list-meta">✨ <strong>새 프롬프트</strong>로 Keep에 두던 문구를 옮겨 보세요.</p>';
      return;
    }
    $("content").innerHTML =
      listMetaHtml(filtered.length, prompts) +
      filtered
        .map(function (p) {
          return (
            '<article class="prompt-card" data-id="' +
            escapeHtml(p.id) +
            '"><div class="prompt-card__body">' +
            '<p class="prompt-card__title">' +
            escapeHtml(p.title) +
            "</p>" +
            '<p class="prompt-card__preview">' +
            escapeHtml(previewBody(p.body)) +
            "</p>" +
            '<div class="pill-row">' +
            (p.pinned ? '<span class="pill pill--pin">고정</span>' : "") +
            '<button type="button" class="btn-copy-inline" data-copy-id="' +
            escapeHtml(p.id) +
            '" title="본문 복사">복사</button>' +
            "</div></div></article>"
          );
        })
        .join("");

    $("content").querySelectorAll(".prompt-card").forEach(function (card) {
      card.onclick = function (e) {
        if (e.target.closest(".btn-copy-inline")) return;
        state.editId = card.getAttribute("data-id");
        state.isNew = false;
        state.draft = null;
        state.view = "edit";
        render();
      };
    });

    $("content").querySelectorAll(".btn-copy-inline").forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-copy-id");
        PromptCollectionDb.getPrompt(id).then(function (p) {
          if (!p || !p.body) {
            window.alert("복사할 본문이 없습니다.");
            return;
          }
          copyText(p.body).then(
            function () {
              btn.textContent = "복사됨";
              setTimeout(function () {
                btn.textContent = "복사";
              }, 1500);
            },
            function () {
              window.alert("복사에 실패했습니다. 편집 화면에서 직접 선택해 복사하세요.");
            }
          );
        });
      };
    });

    if (window.ProjectShell && window.ProjectShell.bindInlineTitles) {
      ProjectShell.bindInlineTitles($("content"), ".prompt-card__title", function (id, title) {
        return PromptCollectionDb.getPrompt(id).then(function (p) {
          if (!p) return;
          p.title = title.trim() || p.title;
          p.updatedAt = new Date().toISOString();
          return PromptCollectionDb.putPrompt(p).then(function () {
            return PromptCollectionDb.listPrompts();
          });
        }).then(function (list) {
          if (list) updateNavCounts(list);
        });
      });
    }
  }

  function renderEditForm() {
    var d = state.draft;
    if (!d) {
      $("content").innerHTML = '<p class="empty">편집할 프롬프트를 찾을 수 없습니다.</p>';
      return;
    }
    $("content").innerHTML =
      '<div class="sketch-form">' +
      "<h2>" +
      (state.isNew ? "✨ 새 프롬프트" : escapeHtml(d.title)) +
      "</h2>" +
      '<label class="field-label" for="f-title">제목</label>' +
      '<input class="field-input" id="f-title" type="text" value="' +
      escapeHtml(d.title || "") +
      '" placeholder="예: 코드 리뷰 요청" />' +
      '<label class="field-label" for="f-body">프롬프트 본문</label>' +
      '<textarea class="sketch-body" id="f-body" placeholder="AI·업무에 붙여 넣을 전체 문구">' +
      escapeHtml(d.body || "") +
      "</textarea>" +
      '<label class="field-label"><input type="checkbox" id="f-pinned"' +
      (d.pinned ? " checked" : "") +
      " /> 고정</label>" +
      '<div class="form-actions">' +
      '<button type="button" class="btn btn--primary" id="btn-save">저장</button>' +
      '<button type="button" class="btn" id="btn-copy-body">본문 복사</button>' +
      '<button type="button" class="btn" id="btn-back">목록</button>' +
      (!state.isNew
        ? '<button type="button" class="btn btn--danger" id="btn-delete">삭제</button>'
        : "") +
      "</div></div>";

    $("btn-save").onclick = saveEdit;
    $("btn-back").onclick = function () {
      state.view = "list";
      render();
    };
    var copyBtn = $("btn-copy-body");
    if (copyBtn) {
      copyBtn.onclick = function () {
        syncDraftFromForm();
        var body = (state.draft.body || "").trim();
        if (!body) {
          window.alert("복사할 본문을 입력하세요.");
          return;
        }
        copyText(body).then(
          function () {
            copyBtn.textContent = "복사됨";
            setTimeout(function () {
              copyBtn.textContent = "본문 복사";
            }, 1500);
          },
          function () {
            window.alert("복사에 실패했습니다.");
          }
        );
      };
    }
    var del = $("btn-delete");
    if (del) {
      del.onclick = function () {
        if (!window.confirm("이 프롬프트를 삭제할까요?")) return;
        PromptCollectionDb.deletePrompt(state.editId).then(function () {
          state.view = "list";
          render();
        });
      };
    }
  }

  function syncDraftFromForm() {
    var t = $("f-title");
    var b = $("f-body");
    var p = $("f-pinned");
    if (t) state.draft.title = t.value;
    if (b) state.draft.body = b.value;
    if (p) state.draft.pinned = p.checked;
  }

  function saveEdit() {
    syncDraftFromForm();
    if (!state.draft.title.trim()) {
      window.alert("제목을 입력하세요.");
      return;
    }
    var now = new Date().toISOString();
    var save = function (id) {
      var item = Object.assign({}, state.draft, {
        id: id,
        title: state.draft.title.trim(),
        body: state.draft.body || "",
        updatedAt: now,
      });
      if (state.isNew) item.createdAt = now;
      return PromptCollectionDb.putPrompt(item).then(function () {
        state.editId = item.id;
        state.isNew = false;
        state.view = "list";
        render();
        if (window.ProjectShell) {
          ProjectShell.notifyTaskDone({
            module: "프롬프트 모음",
            action: "프롬프트 저장 완료",
            title: item.title,
          });
        }
      });
    };
    if (state.isNew) {
      PromptCollectionDb.listPrompts().then(function (list) {
        var ids = {};
        list.forEach(function (p) {
          ids[p.id] = true;
        });
        save(PromptCollectionDb.slugFromTitle(state.draft.title, ids));
      });
      return;
    }
    save(state.draft.id);
  }

  function loadEdit() {
    if (state.isNew) {
      state.draft = { id: "", title: "", body: "", pinned: false };
      renderEditForm();
      return;
    }
    PromptCollectionDb.getPrompt(state.editId)
      .then(function (p) {
        if (!p) {
          $("content").innerHTML =
            '<p class="empty">프롬프트를 찾을 수 없습니다. 목록으로 돌아갑니다.</p>';
          state.view = "list";
          state.editId = null;
          setTimeout(render, 1200);
          return;
        }
        state.draft = Object.assign({}, p);
        renderEditForm();
      })
      .catch(function (err) {
        console.error(err);
        $("content").innerHTML =
          '<p class="empty">불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.</p>';
      });
  }

  function render() {
    var seq = ++renderSeq;
    if (window.ProjectShell) {
      ProjectShell.setActiveView(state.view === "edit" ? "sketch" : state.view);
    }
    PromptCollectionDb.listPrompts()
      .then(function (prompts) {
        if (seq !== renderSeq) return;
        try {
          updateNavCounts(prompts);
          if (state.view === "edit") {
            if (!state.draft && !state.isNew) loadEdit();
            else renderEditForm();
            return;
          }
          renderList(prompts);
        } catch (err) {
          console.error(err);
          $("content").innerHTML =
            '<p class="empty">목록을 표시하는 중 오류가 났습니다.</p>';
        }
      })
      .catch(function (err) {
        if (seq !== renderSeq) return;
        console.error(err);
        $("content").innerHTML =
          '<p class="empty">저장소에서 목록을 읽지 못했습니다. 다른 탭을 닫고 새로고침해 주세요.</p>';
      });
  }

  function exportJson() {
    PromptCollectionDb.listPrompts().then(function (prompts) {
      var payload = PromptCollectionDb.exportPayload(prompts);
      var blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], {
        type: "application/json",
      });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download =
        "prompt-collection-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(url);
      recordExportBackup();
    });
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var replace = window.confirm(
          "기존 데이터를 모두 지우고 가져올까요?\n취소 = 병합(같은 id는 덮어쓰기)"
        );
        PromptCollectionDb.importPayload(data, replace).then(render);
      } catch (err) {
        window.alert("JSON 형식이 올바르지 않습니다.");
      }
    };
    reader.readAsText(file);
  }

  function newPrompt() {
    state.isNew = true;
    state.editId = null;
    state.draft = { id: "", title: "", body: "", pinned: false };
    state.view = "edit";
    render();
  }

  function bindUi() {
    if (window.ProjectShell) {
      ProjectShell.init({
        storageKey: SIDEBAR_COLLAPSED_KEY,
        shellId: "app-shell",
        railToggleId: "sidebar-toggle",
        toolbarToggleId: "sidebar-toggle-toolbar",
      });
      ProjectShell.initBranding({
        storageKey: "prompt-collection-branding",
        defaults: {
          title: "프롬프트 모음",
          tagline: "Keep에 두던 프롬프트를 제목·본문으로 정리",
        },
        titleSuffix: "",
      });
    }
    document.querySelectorAll(".nav-item[data-view]").forEach(function (btn) {
      btn.onclick = function () {
        var next = btn.getAttribute("data-view");
        if (next === "list") resetListFilters();
        state.view = next;
        if (state.view === "edit" && !state.editId && !state.isNew) {
          newPrompt();
          return;
        }
        render();
      };
    });
    var searchEl = $("search");
    if (searchEl) {
      searchEl.oninput = function (e) {
        state.search = e.target.value.trim();
        if (state.view === "list" || state.view === "pinned") render();
      };
    }
    $("btn-new").onclick = newPrompt;
    $("btn-export").onclick = exportJson;
    $("import-file").onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importJson(f);
      e.target.value = "";
    };
  }

  function recordExportBackup() {
    try {
      localStorage.setItem(BACKUP_REMINDER_KEY, new Date().toISOString());
    } catch (e) {}
    updateStorageBanner();
  }

  function isProdHost() {
    return (
      location.protocol !== "file:" &&
      (location.hostname === "cxr542.github.io" ||
        location.hostname.endsWith(".github.io") ||
        location.hostname.endsWith(".vercel.app"))
    );
  }

  function backupNudgeText() {
    if (!isProdHost()) return "";
    try {
      var raw = localStorage.getItem(BACKUP_REMINDER_KEY);
      if (!raw) return " · 💾 JSON 백업 권장";
      var days = (Date.now() - new Date(raw).getTime()) / 86400000;
      if (days >= BACKUP_NUDGE_DAYS) {
        return " · 💾 백업 " + Math.floor(days) + "일 경과";
      }
    } catch (e) {}
    return "";
  }

  function updateStorageBanner(mode) {
    if (mode === undefined && window.PromptCollectionDb) {
      PromptCollectionDb.getStorageMode().then(updateStorageBanner);
      return;
    }
    var meta = document.querySelector(".app-banner__meta");
    if (!meta) return;
    var storeLabel =
      mode === "indexeddb"
        ? "IndexedDB"
        : mode === "localstorage"
          ? "localStorage"
          : mode
            ? "저장 불가"
            : "내 브라우저에만";
    if (!mode) {
      meta.textContent = "🔒 내 브라우저에만 · JSON 백업 가능";
      return;
    }
    meta.textContent =
      "🔒 " +
      storeLabel +
      " · 내 브라우저에만" +
      (mode === "localstorage" ? " (IndexedDB 제한 → localStorage)" : "") +
      " · JSON 백업 가능" +
      backupNudgeText();
  }

  function showInitError(err) {
    console.error(err);
    var msg = (err && err.message) || String(err);
    var hint =
      "데이터를 저장할 수 없습니다. 브라우저에서 이 사이트의 저장소를 허용해 주세요.";
    if (location.protocol === "file:") {
      hint = "npm run dev 또는 배포 URL로 열어 주세요.";
    }
    $("content").innerHTML =
      '<p class="empty">' +
      escapeHtml(hint) +
      (msg ? "<br><small>" + escapeHtml(msg) + "</small>" : "") +
      "</p>";
  }

  PromptCollectionDb.getStorageMode()
    .then(function (mode) {
      updateStorageBanner(mode);
      return PromptCollectionDb.seedIfEmpty();
    })
    .then(function () {
      bindUi();
      render();
    })
    .catch(showInitError);
})();
