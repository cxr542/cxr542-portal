(function (global) {
  "use strict";

  var HUB_PAGES = "https://cxr542.github.io/cxr542-ai";
  var HUB_REPO = "https://github.com/cxr542/cxr542-ai";

  var PROMOTE_STEPS = [
    {
      id: "app",
      label: "projects/{id}/ 앱 구현",
      detail: "index.html 등 GitHub Pages에서 열 수 있는 앱을 만듭니다.",
    },
    {
      id: "projects-json",
      label: "ai/projects.json 항목 추가",
      detail: "허브 카탈로그에 카드로 노출됩니다.",
      snippet: function (idea) {
        var id = projectId(idea);
        var cat = idea.targetCategory || "study";
        return (
          '{\n  "id": "' +
          id +
          '",\n  "title": "' +
          escapeJsonString(idea.title || "제목") +
          '",\n  "summary": "' +
          escapeJsonString(summaryFromBody(idea)) +
          '",\n  "category": "' +
          cat +
          '",\n  "status": "demo",\n  "tags": [],\n  "links": [\n    {\n      "label": "소개",\n      "url": "' +
          HUB_PAGES +
          "/intro/" +
          id +
          '.html"\n    },\n    {\n      "label": "앱",\n      "url": "' +
          HUB_PAGES +
          "/projects/" +
          id +
          '/"\n    }\n  ]\n}'
        );
      },
    },
    {
      id: "intro-manifest",
      label: "intro/manifest.json + build:intros",
      detail: "npm run build:intros 로 intro/{id}.html 생성",
      snippet: function (idea) {
        var id = projectId(idea);
        return (
          '"' +
          id +
          '": {\n  "title": "' +
          escapeJsonString(idea.title || "제목") +
          '",\n  "lead": "' +
          escapeJsonString(summaryFromBody(idea)) +
          '",\n  "links": [\n    { "label": "앱 열기", "href": "' +
          HUB_PAGES +
          "/projects/" +
          id +
          '/" }\n  ]\n}'
        );
      },
    },
    {
      id: "catalog-map",
      label: "scripts/build-catalog.mjs CATEGORY_BY_ID",
      detail: '예: "my-project": "hobby" 한 줄 추가',
      snippet: function (idea) {
        return '"' + projectId(idea) + '": "' + (idea.targetCategory || "study") + '"';
      },
    },
    {
      id: "build-hub",
      label: "npm run build:hub",
      detail: "catalog.json 재생성 (intros + catalog)",
    },
    {
      id: "push",
      label: "git push → GitHub Pages",
      detail: "배포 후 허브 목표 카테고리 탭에서 항목이 보이는지 확인합니다.",
    },
  ];

  function projectId(idea) {
    return (idea && (idea.hubProjectId || idea.id)) || "my-project";
  }

  function escapeJsonString(s) {
    return String(s)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r/g, "")
      .replace(/\n/g, "\\n")
      .slice(0, 200);
  }

  function summaryFromBody(idea) {
    var t = (idea.body || "").replace(/\s+/g, " ").trim();
    if (t.length > 80) t = t.slice(0, 80) + "…";
    return t || (idea.title || "") + " — idea-bank에서 승격";
  }

  function defaultProgress() {
    var p = {};
    PROMOTE_STEPS.forEach(function (s) {
      p[s.id] = false;
    });
    return p;
  }

  function normalizeProgress(raw) {
    var p = defaultProgress();
    if (raw && typeof raw === "object") {
      Object.keys(p).forEach(function (k) {
        if (raw[k]) p[k] = true;
      });
    }
    return p;
  }

  function progressDoneCount(progress) {
    var n = 0;
    PROMOTE_STEPS.forEach(function (s) {
      if (progress[s.id]) n += 1;
    });
    return n;
  }

  function hubCategoryLabel(cat, CAT_LABEL) {
    return (CAT_LABEL && CAT_LABEL[cat]) || cat;
  }

  function renderPromotePanel(idea, CAT_LABEL, escapeHtml, onProgressChange) {
    var id = projectId(idea);
    var cat = idea.targetCategory || "study";
    var progress = normalizeProgress(idea.promoteProgress);
    var done = progressDoneCount(progress);
    var total = PROMOTE_STEPS.length;
    var isPromoted = idea.status === "promoted";

    var html =
      '<section class="promote-panel" aria-labelledby="promote-heading">' +
      '<h3 id="promote-heading">🚀 허브 승격 체크리스트</h3>' +
      '<p class="promote-panel__lead">아이디어 노트는 자동으로 허브에 안 올라갑니다. 서비스로 만들 준비가 되면 아래를 Git에 반영해 ' +
      '<strong>' +
      escapeHtml(hubCategoryLabel(cat, CAT_LABEL)) +
      "</strong> 탭에 공개하세요.</p>" +
      '<p class="promote-panel__meta">프로젝트 ID: <code>' +
      escapeHtml(id) +
      "</code> · 진행 " +
      done +
      "/" +
      total +
      "</p>" +
      '<div class="promote-status-row">' +
      '<button type="button" class="status-chip' +
      (!isPromoted ? " is-active" : "") +
      '" data-status="active">승격 대기</button>' +
      '<button type="button" class="status-chip' +
      (isPromoted ? " is-active" : "") +
      '" data-status="promoted">승격 완료</button>' +
      "</div>" +
      '<ol class="promote-checklist">';

    PROMOTE_STEPS.forEach(function (step, i) {
      var checked = progress[step.id] ? " checked" : "";
      var snippet = step.snippet ? step.snippet(idea) : "";
      html +=
        '<li class="promote-step">' +
        '<label class="promote-step__head">' +
        '<input type="checkbox" data-promote-step="' +
        escapeHtml(step.id) +
        '"' +
        checked +
        " />" +
        "<span>" +
        escapeHtml(step.label.replace("{id}", id)) +
        "</span></label>" +
        '<p class="promote-step__detail">' +
        escapeHtml(step.detail.replace("{id}", id).replace("{cat}", cat)) +
        "</p>";
      if (snippet) {
        html +=
          '<pre class="promote-snippet" id="snippet-' +
          escapeHtml(step.id) +
          '">' +
          escapeHtml(snippet) +
          '</pre><button type="button" class="btn btn--small" data-copy-snippet="' +
          escapeHtml(step.id) +
          '">복사</button>';
      }
      if (step.id === "push" && isPromoted) {
        html +=
          '<p class="promote-links"><a href="' +
          HUB_PAGES +
          "/#/" +
          cat +
          "/" +
          encodeURIComponent(id) +
          '" target="_blank" rel="noopener noreferrer">허브에서 열기</a> · " +
          '<a href="' +
          HUB_PAGES +
          "/projects/" +
          encodeURIComponent(id) +
          '/" target="_blank" rel="noopener noreferrer">앱 URL</a></p>';
      }
      html += "</li>";
    });

    html +=
      "</ol>" +
      '<p class="promote-panel__foot"><a href="' +
      HUB_PAGES +
      '/" target="_blank" rel="noopener noreferrer">cxr542-hub</a> · <a href="' +
      HUB_REPO +
      '" target="_blank" rel="noopener noreferrer">Repo</a></p></section>';

    return html;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  global.IdeaBankPromote = {
    HUB_PAGES: HUB_PAGES,
    HUB_REPO: HUB_REPO,
    PROMOTE_STEPS: PROMOTE_STEPS,
    projectId: projectId,
    defaultProgress: defaultProgress,
    normalizeProgress: normalizeProgress,
    progressDoneCount: progressDoneCount,
    renderPromotePanel: renderPromotePanel,
    copyText: copyText,
  };
})(window);
