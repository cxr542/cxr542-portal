(function () {
  "use strict";

  var CAT_LABEL = { work: "업무 도우미", study: "공부·실험", hobby: "러닝·취미" };
  var STATUS_LABEL = { inbox: "inbox", reviewing: "reviewing", planning: "planning", building: "building", launched: "launched", paused: "paused", active: "노트 중", promoted: "승격 완료" };
  var SIDEBAR_COLLAPSED_KEY = "idea-bank-sidebar-collapsed";
  var BACKUP_REMINDER_KEY = "idea-bank-last-export-at";
  var BACKUP_NUDGE_DAYS = 14;
  var renderSeq = 0;
  var state = {
    view: "list",
    filter: "all",
    statusFilter: "all",
    search: "",
    editId: null,
    isNew: false,
    draft: null,
    images: [],
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

  var PROMOTE_STEP_IDS = [
    "app",
    "projects-json",
    "intro-manifest",
    "catalog-map",
    "build-hub",
    "push",
  ];

  var promoteFallback = {
    PROMOTE_STEPS: PROMOTE_STEP_IDS.map(function (id) {
      return { id: id };
    }),
    defaultProgress: function () {
      var p = {};
      PROMOTE_STEP_IDS.forEach(function (id) {
        p[id] = false;
      });
      return p;
    },
    normalizeProgress: function (raw) {
      var p = promoteFallback.defaultProgress();
      if (raw && typeof raw === "object") {
        PROMOTE_STEP_IDS.forEach(function (id) {
          if (raw[id]) p[id] = true;
        });
      }
      return p;
    },
    progressDoneCount: function (progress) {
      var n = 0;
      PROMOTE_STEP_IDS.forEach(function (id) {
        if (progress && progress[id]) n += 1;
      });
      return n;
    },
    renderPromotePanel: function () {
      return (
        '<section class="promote-panel">' +
        '<p class="promote-panel__lead">허브 체크리스트 스크립트(hub-checklist.js)가 로드되지 않았습니다. ' +
        "브라우저 광고·추적 차단을 이 사이트에서 끄거나, 강력 새로고침(Ctrl+Shift+R) 후 다시 시도해 주세요.</p>" +
        "</section>"
      );
    },
    copyText: function () {
      return Promise.reject(new Error("checklist unavailable"));
    },
  };

  function promote() {
    return typeof IdeaBankPromote !== "undefined" ? IdeaBankPromote : promoteFallback;
  }

  function previewBody(body) {
    var t = (body || "").replace(/\s+/g, " ").trim();
    return t.length > 120 ? t.slice(0, 120) + "…" : t;
  }

  function formatIdeaDate(idea) {
    var value = idea.updatedAt || idea.createdAt;
    var date = new Date(value);
    return value && !isNaN(date.getTime()) ? date.toLocaleDateString("ko-KR") : "날짜 없음";
  }

  function titleFromBody(body) {
    var firstLine = String(body || "").split(/\r?\n/).find(function (line) { return line.trim(); }) || "";
    firstLine = firstLine.trim();
    return firstLine.length > 30 ? firstLine.slice(0, 29) + "…" : firstLine;
  }

  function quickCaptureHtml() {
    return '<section class="quick-capture" aria-label="빠른 아이디어 입력"><div class="quick-capture__surface"><label class="sr-only" for="quick-body">빠른 아이디어 입력</label><textarea id="quick-body" class="quick-capture__body" placeholder="떠오른 아이디어를 바로 적어두세요&#10;복사한 문구를 붙여넣고 저장해도 좋아요"></textarea><div class="quick-capture__actions"><button type="button" class="quick-capture__paste" id="btn-quick-paste">붙여넣기</button><button type="button" class="quick-capture__save" id="btn-quick-save" aria-label="아이디어 저장">저장</button></div></div><p class="quick-capture__notice" id="quick-capture-notice" role="status" aria-live="polite"></p></section>';
  }

  function setQuickNotice(message, isError) {
    var notice = $("quick-capture-notice");
    if (!notice) return;
    notice.textContent = message;
    notice.classList.toggle("is-error", !!isError);
  }

  function saveQuickCapture() {
    var input = $("quick-body");
    var body = input ? input.value.trim() : "";
    if (!body) {
      setQuickNotice("아이디어 내용을 입력해 주세요.", true);
      if (input) input.focus();
      return;
    }
    IdeaBankDb.listIdeas().then(function (ideas) {
      var ids = {};
      ideas.forEach(function (idea) { ids[idea.id] = true; });
      var now = new Date().toISOString();
      var title = titleFromBody(body);
      return IdeaBankDb.putIdea({ id: IdeaBankDb.slugFromTitle(title, ids), title: title, body: body, status: "inbox", source: "quick-capture", tags: [], links: "", memo: "", pinned: false, targetCategory: "study", createdAt: now, updatedAt: now });
    }).then(function () {
      if (input) input.value = "";
      state.search = "";
      state.filter = "all";
      state.statusFilter = "all";
      render();
      setTimeout(function () { setQuickNotice("저장했어요. 나중에 정리하면 돼요."); }, 0);
    }).catch(function () { setQuickNotice("저장하지 못했습니다. Supabase 로그인과 연결을 확인해 주세요.", true); });
  }

  function pasteQuickCapture() {
    var input = $("quick-body");
    if (!input || !navigator.clipboard || !navigator.clipboard.readText) {
      setQuickNotice("붙여넣기가 안 되면 입력창을 길게 눌러 직접 붙여넣어 주세요", true);
      return;
    }
    navigator.clipboard.readText().then(function (value) {
      input.value = value;
      input.focus();
      setQuickNotice("클립보드 내용을 입력창에 붙여넣었어요.");
    }).catch(function () { setQuickNotice("붙여넣기가 안 되면 입력창을 길게 눌러 직접 붙여넣어 주세요", true); });
  }

  function bindQuickCapture() {
    var save = $("btn-quick-save");
    var paste = $("btn-quick-paste");
    if (save) save.onclick = saveQuickCapture;
    if (paste) paste.onclick = pasteQuickCapture;
  }

  function ideaStatus(idea) {
    return idea && idea.status === "promoted" ? "promoted" : "active";
  }

  function filterIdeas(ideas) {
    return ideas.filter(function (idea) {
      if (state.view === "pinned" && !idea.pinned) return false;
      if (state.statusFilter === "active" && ideaStatus(idea) === "promoted") return false;
      if (state.statusFilter === "promoted" && ideaStatus(idea) !== "promoted") return false;
      if (state.filter !== "all" && idea.targetCategory !== state.filter) return false;
      if (state.search) {
        var q = state.search.toLowerCase();
        return (
          (idea.title || "").toLowerCase().indexOf(q) >= 0 ||
          (idea.body || "").toLowerCase().indexOf(q) >= 0
        );
      }
      return true;
    });
  }

  function resetListFilters() {
    state.filter = "all";
    state.statusFilter = "all";
    state.search = "";
    var searchEl = $("search");
    if (searchEl) searchEl.value = "";
  }

  function countByCategory(ideas, catId) {
    if (catId === "all") return ideas.length;
    return ideas.filter(function (idea) {
      return idea.targetCategory === catId;
    }).length;
  }

  function countIdeasByStatus(ideas) {
    var active = 0;
    var promoted = 0;
    ideas.forEach(function (idea) {
      if (ideaStatus(idea) === "promoted") promoted += 1;
      else active += 1;
    });
    return { total: ideas.length, active: active, promoted: promoted };
  }

  function updateNavCounts(ideas) {
    var counts = countIdeasByStatus(ideas);
    var pinned = 0;
    ideas.forEach(function (idea) {
      if (idea.pinned) pinned += 1;
    });
    var allEl = $("nav-count-all");
    var pinnedEl = $("nav-count-pinned");
    if (allEl) {
      allEl.textContent = String(counts.total);
      allEl.title =
        counts.total === 0
          ? "저장된 아이디어 없음"
          : "전체 " +
            counts.total +
            "건 (노트 중 " +
            counts.active +
            " · 승격 " +
            counts.promoted +
            ") — 승격된 아이디어도 포함";
    }
    if (pinnedEl) pinnedEl.textContent = String(pinned);
  }

  function renderCatFilter(ideas) {
    var nav = $("cat-filter");
    if (!nav) return;
    if (state.view !== "list") {
      nav.hidden = true;
      nav.innerHTML = "";
      return;
    }
    nav.hidden = false;
    ideas = ideas || [];
    var counts = countIdeasByStatus(ideas);
    var chips = [
      { id: "all", label: "전체", kind: "cat", n: ideas.length },
      { id: "work", label: CAT_LABEL.work, kind: "cat", n: countByCategory(ideas, "work") },
      { id: "study", label: CAT_LABEL.study, kind: "cat", n: countByCategory(ideas, "study") },
      { id: "hobby", label: CAT_LABEL.hobby, kind: "cat", n: countByCategory(ideas, "hobby") },
      { id: "all", label: "상태·전체", kind: "status", n: counts.total },
      { id: "active", label: "🌱 노트 중", kind: "status", n: counts.active },
      { id: "promoted", label: "🚀 승격됨", kind: "status", n: counts.promoted },
    ];
    nav.innerHTML = chips
      .map(function (c) {
        var active =
          c.kind === "cat"
            ? state.filter === c.id
            : state.statusFilter === c.id;
        var nBadge = ' <span class="cat-chip__n">' + c.n + "</span>";
        return (
          '<button type="button" class="cat-chip cat-chip--' +
          c.kind +
          (active ? " is-active" : "") +
          '" data-kind="' +
          c.kind +
          '" data-filter="' +
          c.id +
          '">' +
          escapeHtml(c.label) +
          nBadge +
          "</button>"
        );
      })
      .join("");
    $("cat-filter").querySelectorAll(".cat-chip").forEach(function (btn) {
      btn.onclick = function () {
        var kind = btn.getAttribute("data-kind");
        var id = btn.getAttribute("data-filter");
        if (kind === "status") state.statusFilter = id;
        else state.filter = id;
        render();
      };
    });
  }

  function listMetaHtml(filteredCount, ideas) {
    var total = ideas.length;
    if (state.view === "pinned") {
      var pinnedTotal = ideas.filter(function (i) {
        return i.pinned;
      }).length;
      return (
        '<p class="list-meta list-meta--context">📌 <strong>고정함</strong>만 표시 중 · ' +
        filteredCount +
        "개 (고정 " +
        pinnedTotal +
        " · 전체 " +
        total +
        "건)</p>"
      );
    }
    var html =
      '<p class="list-meta list-meta--context">📋 <strong>전체 아이디어</strong> · ';
    if (filteredCount === total) {
      html += filteredCount + "개</p>";
    } else {
      html +=
        filteredCount +
        '개 표시 <span class="list-meta__dim">(전체 ' +
        total +
        "건 중)</span></p>";
    }
    return html;
  }

  function renderList(ideas) {
    ideas = Array.isArray(ideas) ? ideas : [];
    var statusCounts = countIdeasByStatus(ideas);
    var filtered = filterIdeas(ideas);
    filtered.sort(function (a, b) {
      return (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "");
    });
    if (!filtered.length) {
      var emptyMsg =
        '<p class="empty">💭 이 목록에 맞는 아이디어가 없어요.</p>';
      if (
        state.view === "list" &&
        state.statusFilter === "active" &&
        statusCounts.promoted > 0
      ) {
        emptyMsg +=
          '<p class="list-meta">🚀 승격 완료 ' +
          statusCounts.promoted +
          "건은 「승격됨」 필터에서 보세요. 승격해도 노트에서 자동 삭제되지 않습니다.</p>";
      } else {
        emptyMsg +=
          '<p class="list-meta">✨ <strong>새 아이디어</strong>로 첫 메모를 남겨 보세요.</p>';
      }
      $("content").innerHTML = state.view === "list" ? '<section class="idea-feed idea-feed--empty"><p class="idea-feed__label">최근 아이디어</p>' + emptyMsg + "</section>" + quickCaptureHtml() : emptyMsg;
      if (state.view === "list") bindQuickCapture();
      return;
    }
    var listHtml = state.view === "list" ? '<section class="idea-feed"><p class="idea-feed__label">최근 아이디어</p>' : "";
    listHtml += listMetaHtml(filtered.length, ideas);
    if (
      state.view === "list" &&
      filtered.length < ideas.length &&
      state.statusFilter === "active"
    ) {
      listHtml +=
        '<p class="list-meta">🚀 승격된 아이디어는 위 「🚀 승격됨」 칩을 눌러 보세요.</p>';
    }
    var messageHtml = filtered
        .map(function (idea) {
          return (
            '<article class="idea-message" data-id="' +
            escapeHtml(idea.id) +
            '" role="button" tabindex="0"><div class="idea-message__body">' +
            '<p class="idea-message__title">' +
            escapeHtml(idea.title) +
            "</p>" +
            '<p class="idea-message__preview">' +
            escapeHtml(previewBody(idea.body)) +
            "</p>" +
            '<div class="idea-message__meta">' +
            '<span class="idea-message__status">' +
            escapeHtml(STATUS_LABEL[idea.status] || idea.status || "inbox") +
            "</span>" +
            '<span class="idea-message__date">' +
            escapeHtml(formatIdeaDate(idea)) +
            "</span>" +
            (idea.pinned ? '<span class="idea-message__pin">고정</span>' : "") +
            (Array.isArray(idea.tags)
              ? idea.tags.map(function (tag) { return '<span class="idea-message__tag">#' + escapeHtml(tag) + "</span>"; }).join("")
              : "") +
            "</div></div></article>"
          );
        })
        .join("");
    if (state.view === "list") {
      $("content").innerHTML = listHtml + messageHtml + "</section>" + quickCaptureHtml();
    } else {
      $("content").innerHTML = listHtml + messageHtml;
    }
    if (state.view === "list") bindQuickCapture();
    $("content").querySelectorAll(".idea-message").forEach(function (card) {
      var openIdea = function () {
        state.editId = card.getAttribute("data-id");
        state.isNew = false;
        state.draft = null;
        state.view = "sketch";
        render();
      };
      card.onclick = openIdea;
      card.onkeydown = function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openIdea();
        }
      };
    });
    if (window.ProjectShell && window.ProjectShell.bindInlineTitles) {
      ProjectShell.bindInlineTitles($("content"), ".idea-message__title", function (id, title) {
        return IdeaBankDb.getIdea(id).then(function (idea) {
          if (!idea) return;
          idea.title = title.trim() || idea.title;
          idea.updatedAt = new Date().toISOString();
          return IdeaBankDb.putIdea(idea).then(function () {
            return IdeaBankDb.listIdeas();
          });
        }).then(function (ideas) {
          if (ideas) updateNavCounts(ideas);
        });
      });
    }
  }

  function renderCatRadios(selected) {
    return ["work", "study", "hobby"]
      .map(function (c) {
        return (
          '<button type="button" class="cat-radio cat-radio--' +
          c +
          (selected === c ? " is-selected" : "") +
          '" data-cat="' +
          c +
          '">' +
          escapeHtml(CAT_LABEL[c]) +
          "</button>"
        );
      })
      .join("");
  }

  function renderImages() {
    var html = state.images
      .map(function (img, i) {
        return (
          '<div class="img-thumb"><img src="' +
          escapeHtml(img.dataUrl) +
          '" alt="" /><button type="button" data-rm-img="' +
          i +
          '" aria-label="삭제">×</button></div>'
        );
      })
      .join("");
    html +=
      '<div class="img-thumb" id="img-paste-hint" tabindex="0">+ 붙여넣기</div>';
    return html;
  }

  function statusOptionsHtml(selected) {
    return Object.keys(STATUS_LABEL)
      .map(function (status) {
        return '<option value="' + escapeHtml(status) + '"' + (selected === status ? " selected" : "") + ">" + escapeHtml(STATUS_LABEL[status]) + "</option>";
      })
      .join("");
  }

  function renderSketchForm() {
    var d = state.draft;
    if (!d) {
      $("content").innerHTML =
        '<p class="empty">편집할 아이디어를 찾을 수 없습니다.</p>';
      return;
    }
    $("content").innerHTML =
      '<div class="sketch-form">' +
      "<h2>" +
      (state.isNew ? "✨ 새 아이디어" : escapeHtml(d.title)) +
      "</h2>" +
      '<label class="field-label">제목</label>' +
      '<input class="field-input" id="f-title" type="text" value="' +
      escapeHtml(d.title || "") +
      '" />' +
      '<label class="field-label">상태</label>' +
      '<select class="field-input" id="f-status">' + statusOptionsHtml(d.status || "inbox") + "</select>" +
      '<label class="field-label">태그</label>' +
      '<input class="field-input" id="f-tags" type="text" value="' + escapeHtml((d.tags || []).join(", ")) + '" placeholder="예: product, running" />' +
      '<label class="field-label">허브 프로젝트 ID (폴더·catalog id)</label>' +
      '<input class="field-input field-input--mono" id="f-hub-id" type="text" value="' +
      escapeHtml(d.hubProjectId || d.id || "") +
      '" placeholder="예: marathon-log" />' +
      '<p class="field-hint">projects/<strong>이 ID</strong>/ · ai/projects.json · intro/manifest</p>' +
      '<span class="field-label">목표 카테고리 (허브 승격 시)</span>' +
      '<div class="cat-radios" id="cat-radios">' +
      renderCatRadios(d.targetCategory) +
      "</div>" +
      '<label class="field-label">본문</label>' +
      '<textarea class="sketch-body" id="f-body">' +
      escapeHtml(d.body || "") +
      "</textarea>" +
      '<label class="field-label">링크</label>' +
      '<input class="field-input" id="f-links" type="url" value="' + escapeHtml(d.links || "") + '" placeholder="https://" />' +
      '<label class="field-label">메모</label>' +
      '<textarea class="sketch-body sketch-body--compact" id="f-memo">' + escapeHtml(d.memo || "") + "</textarea>" +
      '<label class="field-label"><input type="checkbox" id="f-pinned"' +
      (d.pinned ? " checked" : "") +
      " /> 고정</label>" +
      '<span class="field-label">이미지 (Ctrl+V)</span>' +
      '<div class="img-grid" id="img-grid">' +
      renderImages() +
      "</div>" +
      '<div class="form-actions">' +
      '<button type="button" class="btn btn--primary" id="btn-save">저장</button>' +
      '<button type="button" class="btn" id="btn-back">목록</button>' +
      (!state.isNew
        ? '<button type="button" class="btn btn--danger" id="btn-delete">삭제</button>'
        : "") +
      "</div>" +
      promote().renderPromotePanel(d, CAT_LABEL, escapeHtml) +
      "</div>";

    try {
      bindPromotePanel();

      var catRadios = $("cat-radios");
      if (catRadios) {
        catRadios.querySelectorAll(".cat-radio").forEach(function (btn) {
          btn.onclick = function () {
            state.draft.targetCategory = btn.getAttribute("data-cat");
            syncDraftFromForm();
            renderSketchForm();
          };
        });
      }
      var btnSave = $("btn-save");
      if (btnSave) btnSave.onclick = saveSketch;
      var btnBack = $("btn-back");
      if (btnBack) {
        btnBack.onclick = function () {
          state.view = "list";
          render();
        };
      }
      var del = $("btn-delete");
      if (del) {
        del.onclick = function () {
          if (!window.confirm("이 아이디어를 삭제할까요?")) return;
          IdeaBankDb.deleteIdea(state.editId).then(function () {
            state.view = "list";
            render();
          });
        };
      }
      var imgGrid = $("img-grid");
      if (imgGrid) {
        imgGrid.querySelectorAll("[data-rm-img]").forEach(function (btn) {
          btn.onclick = function (e) {
            e.stopPropagation();
            var i = Number(btn.getAttribute("data-rm-img"));
            state.images.splice(i, 1);
            renderSketchForm();
          };
        });
      }
      var pasteHint = $("img-paste-hint");
      if (pasteHint) {
        pasteHint.onpaste = handlePaste;
        pasteHint.onclick = function () {
          pasteHint.focus();
        };
      }
      document.onpaste = handlePaste;
    } catch (err) {
      console.error(err);
      $("content").innerHTML +=
        '<p class="empty">편집 화면 연결 중 오류가 났습니다. 콘솔을 확인하거나 새로고침해 주세요.</p>';
    }
  }

  function handlePaste(e) {
    if (state.view !== "sketch") return;
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") === 0) {
        e.preventDefault();
        var file = items[i].getAsFile();
        if (!file || file.size > 2 * 1024 * 1024) {
          window.alert("이미지는 2MB 이하만 지원합니다.");
          return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) {
          state.images.push({
            id: "img-" + Date.now(),
            mime: file.type,
            dataUrl: ev.target.result,
          });
          renderSketchForm();
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }

  function bindPromotePanel() {
    var panel = document.querySelector(".promote-panel");
    if (!panel) return;

    panel.querySelectorAll(".status-chip").forEach(function (btn) {
      btn.onclick = function () {
        state.draft.status = btn.getAttribute("data-status");
        if (state.draft.status === "promoted" && !state.draft.promotedAt) {
          state.draft.promotedAt = new Date().toISOString();
        }
        syncDraftFromForm();
        renderSketchForm();
      };
    });

    panel.querySelectorAll("[data-promote-step]").forEach(function (box) {
      box.onchange = function () {
        if (!state.draft.promoteProgress) {
          state.draft.promoteProgress = promote().defaultProgress();
        }
        state.draft.promoteProgress[box.getAttribute("data-promote-step")] = box.checked;
      };
    });

    panel.querySelectorAll("[data-copy-snippet]").forEach(function (btn) {
      btn.onclick = function () {
        var stepId = btn.getAttribute("data-copy-snippet");
        var pre = document.getElementById("snippet-" + stepId);
        if (!pre) return;
        promote().copyText(pre.textContent).then(
          function () {
            btn.textContent = "복사됨";
            setTimeout(function () {
              btn.textContent = "복사";
            }, 1500);
          },
          function () {
            window.alert("복사에 실패했습니다. 코드 블록을 직접 선택해 복사하세요.");
          }
        );
      };
    });
  }

  function syncDraftFromForm() {
    var t = $("f-title");
    var b = $("f-body");
    var p = $("f-pinned");
    var status = $("f-status");
    var tags = $("f-tags");
    var links = $("f-links");
    var memo = $("f-memo");
    var hubId = $("f-hub-id");
    if (t) state.draft.title = t.value;
    if (b) state.draft.body = b.value;
    if (p) state.draft.pinned = p.checked;
    if (status) state.draft.status = status.value;
    if (tags) {
      state.draft.tags = tags.value.split(",").map(function (tag) { return tag.trim(); }).filter(Boolean);
    }
    if (links) state.draft.links = links.value.trim();
    if (memo) state.draft.memo = memo.value.trim();
    if (hubId) {
      state.draft.hubProjectId = hubId.value.trim() || state.draft.id;
    }
    state.draft.images = state.images.slice();
    var panel = document.querySelector(".promote-panel");
    if (panel) {
      if (!state.draft.promoteProgress) {
        state.draft.promoteProgress = promote().defaultProgress();
      }
      panel.querySelectorAll("[data-promote-step]").forEach(function (box) {
        state.draft.promoteProgress[box.getAttribute("data-promote-step")] = box.checked;
      });
    }
  }

  function saveSketch() {
    syncDraftFromForm();
    if (!state.draft.body.trim()) {
      window.alert("아이디어 내용을 입력하세요.");
      return;
    }
    var now = new Date().toISOString();
    var save = function (id) {
      var idea = Object.assign({}, state.draft, {
        id: id,
        title: state.draft.title.trim() || titleFromBody(state.draft.body),
        body: state.draft.body || "",
        updatedAt: now,
        images: state.images.slice(),
      });
      if (state.isNew) {
        idea.createdAt = now;
        if (!idea.status) idea.status = "inbox";
      }
      if (!idea.promoteProgress) {
        idea.promoteProgress = promote().defaultProgress();
      }
      idea.hubProjectId = (idea.hubProjectId || idea.id || "").trim();
      if (!idea.hubProjectId) idea.hubProjectId = idea.id;
      return IdeaBankDb.putIdea(idea).then(function () {
        state.editId = idea.id;
        state.isNew = false;
        state.view = "list";
        render();
        if (window.ProjectShell) {
          ProjectShell.notifyTaskDone({
            module: "아이디어 뱅크",
            action: "아이디어 저장 완료",
            title: idea.title,
          });
        }
      });
    };
    if (state.isNew) {
      IdeaBankDb.listIdeas().then(function (ideas) {
        var ids = {};
        ideas.forEach(function (i) {
          ids[i.id] = true;
        });
        save(IdeaBankDb.slugFromTitle(state.draft.title, ids));
      });
      return;
    }
    save(state.draft.id);
  }

  function loadSketch() {
    if (state.isNew) {
      state.draft = {
        id: "",
        title: "",
        body: "",
        targetCategory: "study",
        pinned: false,
        status: "inbox",
        hubProjectId: "",
        promoteProgress: promote().defaultProgress(),
        tags: [],
      };
      state.images = [];
      renderSketchForm();
      return;
    }
    IdeaBankDb.getIdea(state.editId)
      .then(function (idea) {
        if (!idea) {
          $("content").innerHTML =
            '<p class="empty">아이디어 「' +
            escapeHtml(state.editId || "") +
            "」를 찾을 수 없습니다. 목록으로 돌아갑니다.</p>";
          state.view = "list";
          state.editId = null;
          setTimeout(function () {
            render();
          }, 1200);
          return;
        }
        state.draft = Object.assign(
          {
            promoteProgress: promote().defaultProgress(),
            hubProjectId: idea.id,
            status: "inbox",
          },
          idea
        );
        state.draft.promoteProgress = promote().normalizeProgress(
          state.draft.promoteProgress
        );
        if (!state.draft.hubProjectId) state.draft.hubProjectId = state.draft.id;
        state.images = Array.isArray(idea.images) ? idea.images.slice() : [];
        renderSketchForm();
      })
      .catch(function (err) {
        console.error(err);
        $("content").innerHTML =
          '<p class="empty">아이디어를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.</p>';
      });
  }

  function render() {
    var seq = ++renderSeq;
    if (window.ProjectShell) {
      ProjectShell.setActiveView(state.view);
    }
    IdeaBankDb.listIdeas()
      .then(function (ideas) {
        if (seq !== renderSeq) return;
        try {
          updateNavCounts(ideas);
          renderCatFilter(ideas);
          if (state.view === "sketch") {
            if (!state.draft && !state.isNew) {
              loadSketch();
            } else {
              renderSketchForm();
            }
            return;
          }
          renderList(ideas);
        } catch (err) {
          console.error(err);
          $("content").innerHTML =
            '<p class="empty">목록을 표시하는 중 오류가 났습니다. 새로고침해 주세요.</p>';
        }
      })
      .catch(function (err) {
        if (seq !== renderSeq) return;
        console.error(err);
        $("content").innerHTML =
          '<p class="empty">저장소에서 목록을 읽지 못했습니다. 다른 idea-bank 탭을 닫고 새로고침해 주세요.</p>';
      });
  }

  function exportJson() {
    IdeaBankDb.listIdeas().then(function (ideas) {
      var payload = IdeaBankDb.exportPayload(ideas);
      var blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], {
        type: "application/json",
      });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "idea-bank-" + new Date().toISOString().slice(0, 10) + ".json";
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
          "기존 데이터를 모두 지우고 가져올까요?\n취소 = 병합(덮어쓰기)"
        );
        IdeaBankDb.importPayload(data, replace).then(function () {
          render();
        });
      } catch (err) {
        window.alert("JSON 형식이 올바르지 않습니다.");
      }
    };
    reader.readAsText(file);
  }

  function newSketch() {
    IdeaBankDb.listIdeas()
      .then(function (ideas) {
        var ids = {};
        ideas.forEach(function (i) {
          ids[i.id] = true;
        });
        state.isNew = true;
        state.editId = null;
        var newId = IdeaBankDb.slugFromTitle("new-idea", ids);
        state.draft = {
          id: newId,
          title: "",
          body: "",
          targetCategory: "study",
          pinned: false,
          status: "inbox",
          hubProjectId: newId,
          promoteProgress: promote().defaultProgress(),
          tags: [],
        };
        state.images = [];
        state.view = "sketch";
        render();
      })
      .catch(function (err) {
        console.error(err);
        window.alert("새 아이디어를 열 수 없습니다. Supabase 로그인과 연결을 확인해 주세요.");
      });
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
        storageKey: "idea-bank-branding",
        defaults: {
          title: "idea-bank",
          tagline: "서비스 만들기 전, 생각을 모아 두는 아이디어 노트",
        },
        titleSuffix: " · 아이디어 노트",
      });
    }
    document.querySelectorAll(".nav-item[data-view]").forEach(function (btn) {
      btn.onclick = function () {
        var next = btn.getAttribute("data-view");
        if (next === "list") resetListFilters();
        state.view = next;
        if (state.view === "sketch" && !state.editId && !state.isNew) {
          newSketch();
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
    var btnNew = $("btn-new");
    if (btnNew) btnNew.onclick = newSketch;
    var btnExport = $("btn-export");
    if (btnExport) btnExport.onclick = exportJson;
    $("import-file").onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importJson(f);
      e.target.value = "";
    };
  }

  function recordExportBackup() {
    try {
      globalThis.PortalStorage.setItem(BACKUP_REMINDER_KEY, new Date().toISOString());
    } catch (e) {}
    updateStorageBanner();
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
      var raw = globalThis.PortalStorage.getItem(BACKUP_REMINDER_KEY);
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

  function updateStorageBanner() {
    var meta = document.querySelector(".app-banner__meta, .app-banner .storage-hint");
    if (meta) meta.textContent = "Supabase · 계정별 저장 · JSON 백업 가능";
  }

  function showInitError(err) {
    console.error(err);
    var msg = (err && err.message) || String(err);
    var hint =
      "데이터를 저장할 수 없습니다. Supabase 로그인과 네트워크 연결을 확인해 주세요.";
    if (location.protocol === "file:") {
      hint =
        "HTML 파일을 직접 연 경우 저장소가 막힙니다. GitHub Pages URL 또는 npm run preview로 열어 주세요.";
    }
    $("content").innerHTML =
      '<p class="empty">' +
      escapeHtml(hint) +
      (msg ? "<br><small>" + escapeHtml(msg) + "</small>" : "") +
      "</p>";
  }

  IdeaBankDb.getStorageMode()
    .then(function (mode) {
      updateStorageBanner(mode);
      return IdeaBankDb.seedIfEmpty();
    })
    .then(function () {
      bindUi();
      render();
    })
    .catch(showInitError);
})();
