(function () {
  "use strict";

  var SIDEBAR_KEY = "who-are-you-sidebar-collapsed";
  var renderSeq = 0;
  var bundleCache = null;
  var state = {
    view: "dashboard",
    editStore: null,
    editId: null,
    isNew: false,
    draft: null,
    search: "",
  };

  var STORE_VIEWS = {
    employments: "employments",
    projects: "projects",
    educations: "educations",
    certifications: "certifications",
    documents: "documents",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtPeriod(start, end, isCurrent) {
    var s = start ? String(start).slice(0, 7).replace("-", ".") : "—";
    var e = isCurrent ? "현재" : end ? String(end).slice(0, 7).replace("-", ".") : "—";
    return s + " ~ " + e;
  }

  function loadBundle() {
    return WhoAreYouDb.loadBundle().then(function (b) {
      bundleCache = b;
      return b;
    });
  }

  function updateNavCounts(b) {
    var set = function (id, n) {
      var el = $(id);
      if (el) el.textContent = String(n);
    };
    set("nav-count-employments", b.employments.length);
    set("nav-count-projects", b.projects.length);
    set("nav-count-educations", b.educations.length);
    set("nav-count-certs", b.certifications.length);
    set("nav-count-documents", b.documents.length);
  }

  function updateToolbar(b) {
    var search = $("search");
    var add = $("btn-add");
    if (search) {
      var showSearch = state.view === "documents" || STORE_VIEWS[state.view];
      search.hidden = !showSearch;
    }
    if (add) {
      var labels = {
        employments: "근무경력",
        projects: "기술경력",
        educations: "학력",
        certifications: "자격·교육",
        documents: "자기소개서",
      };
      if (labels[state.view]) {
        add.hidden = false;
        add.textContent = "＋ " + labels[state.view] + " 추가";
      } else if (state.view === "profile") {
        add.hidden = false;
        add.textContent = "프로필 저장";
      } else {
        add.hidden = true;
      }
    }
  }

  function completeness(b) {
    var checks = [
      { ok: !!(b.profile.name && b.profile.summary), label: "프로필·요약" },
      { ok: b.employments.length > 0, label: "근무경력 1건 이상" },
      { ok: b.projects.length > 0, label: "기술경력(프로젝트) 1건 이상" },
      { ok: b.documents.length > 0, label: "자기소개서 1건 이상" },
    ];
    var done = checks.filter(function (c) {
      return c.ok;
    }).length;
    return { checks: checks, done: done, total: checks.length };
  }

  function renderDashboard(b) {
    var c = completeness(b);
    var pct = Math.round((c.done / c.total) * 100);
    $("content").innerHTML =
      '<div class="dash">' +
      '<header class="dash-hero">' +
      "<h2>" +
      (b.profile.name ? escapeHtml(b.profile.name) : "이름을 입력해 주세요") +
      "</h2>" +
      (b.profile.headline
        ? '<p class="dash-hero__sub">' + escapeHtml(b.profile.headline) + "</p>"
        : "") +
      '<div class="dash-meter"><div class="dash-meter__fill" style="width:' +
      pct +
      '%"></div></div>' +
      '<p class="dash-meter__label">경력·자소서 완성도 <strong>' +
      pct +
      "%</strong> (" +
      c.done +
      "/" +
      c.total +
      ")</p></header>" +
      '<div class="dash-grid">' +
      cardStat("🏢", "근무경력", b.employments.length, "employments") +
      cardStat("💼", "기술경력", b.projects.length, "projects") +
      cardStat("📝", "자기소개서", b.documents.length, "documents") +
      cardStat("🎓", "학력", b.educations.length, "educations") +
      "</div>" +
      '<section class="dash-check"><h3>체크리스트</h3><ul>' +
      c.checks
        .map(function (ch) {
          return (
            "<li class" +
            (ch.ok ? " is-done" : "") +
            ">" +
            (ch.ok ? "✓" : "○") +
            " " +
            escapeHtml(ch.label) +
            "</li>"
          );
        })
        .join("") +
      "</ul></section>" +
      '<section class="dash-ref"><h3>career.sw.or.kr 대응</h3>' +
      '<table class="ref-table"><thead><tr><th>공식 항목</th><th>이 앱</th></tr></thead><tbody>' +
      "<tr><td>근무경력</td><td>근무경력 메뉴</td></tr>" +
      "<tr><td>기술경력(프로젝트)</td><td>기술경력 메뉴</td></tr>" +
      "<tr><td>학력·자격·교육</td><td>학력 / 자격·교육</td></tr>" +
      "<tr><td>자기소개·이력서 문단</td><td>자기소개서</td></tr>" +
      "</tbody></table></section></div>";
    $("content").querySelectorAll("[data-goto]").forEach(function (btn) {
      btn.onclick = function () {
        state.view = btn.getAttribute("data-goto");
        render();
      };
    });
  }

  function cardStat(icon, label, n, view) {
    return (
      '<button type="button" class="dash-card" data-goto="' +
      view +
      '"><span class="dash-card__icon">' +
      icon +
      '</span><span class="dash-card__n">' +
      n +
      '</span><span class="dash-card__label">' +
      escapeHtml(label) +
      "</span></button>"
    );
  }

  function filterList(list, fields) {
    if (!state.search) return list;
    var q = state.search.toLowerCase();
    return list.filter(function (item) {
      return fields.some(function (f) {
        return String(item[f] || "")
          .toLowerCase()
          .includes(q);
      });
    });
  }

  function renderProfile(b) {
    var p = state.draft || b.profile;
    $("content").innerHTML =
      '<form class="edit-panel" id="profile-form">' +
      "<h2>🪪 인적·프로필</h2>" +
      field("이름", "f-name", p.name) +
      field("영문 이름", "f-name-en", p.nameEn) +
      '<div class="field-row">' +
      field("이메일", "f-email", p.email, "email") +
      field("연락처", "f-phone", p.phone) +
      "</div>" +
      field("한 줄 헤드라인", "f-headline", p.headline) +
      field("지원 직무·포지션", "f-role", p.targetRole) +
      '<label class="field-label">경력 요약 (3~5문장)</label><textarea class="field-textarea field-textarea--tall" id="f-summary">' +
      escapeHtml(p.summary || "") +
      "</textarea>" +
      '<label class="field-label">기술 스택 (쉼표 구분)</label><input class="field-input" id="f-skills" value="' +
      escapeHtml((p.skills || []).join(", ")) +
      '" />' +
      '<div class="form-actions"><button type="submit" class="btn btn--primary">저장</button></div></form>';
    $("profile-form").onsubmit = function (e) {
      e.preventDefault();
      var skills = $("f-skills").value.split(/[,，]/).map(function (s) {
        return s.trim();
      }).filter(Boolean);
      var profile = {
        id: "profile",
        name: $("f-name").value.trim(),
        nameEn: $("f-name-en").value.trim(),
        email: $("f-email").value.trim(),
        phone: $("f-phone").value.trim(),
        headline: $("f-headline").value.trim(),
        targetRole: $("f-role").value.trim(),
        summary: $("f-summary").value,
        skills: skills,
        links: p.links || [],
      };
      WhoAreYouDb.saveProfile(profile).then(function () {
        state.draft = null;
        render();
        if (window.ProjectShell) {
          ProjectShell.notifyTaskDone({
            module: "나는누구?",
            action: "프로필 저장 완료",
            title: profile.name || "profile",
          });
        }
      });
    };
  }

  function field(label, id, val, type) {
    return (
      '<label class="field-label" for="' +
      id +
      '">' +
      escapeHtml(label) +
      '</label><input class="field-input" id="' +
      id +
      '" type="' +
      (type || "text") +
      '" value="' +
      escapeHtml(val || "") +
      '" />'
    );
  }

  function renderEmploymentList(b) {
    var list = filterList(b.employments.slice().sort(byDateDesc), [
      "companyName",
      "department",
      "duties",
    ]);
    if (state.editStore === "employments" && (state.isNew || state.editId)) {
      renderEmploymentForm(b);
      return;
    }
    $("content").innerHTML =
      sectionHead("근무경력", "정규직·계약직 근무 사실 (career.sw 근무경력)") +
      timelineHtml(list, "employment") +
      emptyHint(list.length, "근무경력");
    bindListClicks("employments");
  }

  function renderProjectList(b) {
    var list = filterList(b.projects.slice().sort(byDateDesc), [
      "projectName",
      "client",
      "employer",
      "tasks",
      "techStack",
    ]);
    if (state.editStore === "projects" && (state.isNew || state.editId)) {
      renderProjectForm(b);
      return;
    }
    $("content").innerHTML =
      sectionHead("기술경력", "참여사업·수행업무 (career.sw 기술경력)") +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      "<th>참여사업명</th><th>기간</th><th>발주처</th><th>소속사</th><th>직위</th><th>평점</th></tr></thead><tbody>" +
      list
        .map(function (p) {
          return (
            '<tr class="data-row" data-store="projects" data-id="' +
            escapeHtml(p.id) +
            '"><td><strong>' +
            escapeHtml(p.projectName) +
            '</strong><br><span class="muted">' +
            escapeHtml((p.tasks || "").slice(0, 60)) +
            "</span></td><td>" +
            fmtPeriod(p.startDate, p.endDate) +
            "</td><td>" +
            escapeHtml(p.client || "—") +
            "</td><td>" +
            escapeHtml(p.employer || "—") +
            "</td><td>" +
            escapeHtml(p.position || "—") +
            "</td><td>" +
            starsMini(p.rating) +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>" +
      emptyHint(list.length, "기술경력");
    bindListClicks("projects");
  }

  function starsMini(r) {
    if (!r) return "—";
    return '<span class="mini-stars">' + Number(r).toFixed(1) + " ★</span>";
  }

  function byDateDesc(a, b) {
    return (b.startDate || "").localeCompare(a.startDate || "");
  }

  function sectionHead(title, sub) {
    return '<header class="section-head"><h2>' + escapeHtml(title) + "</h2><p>" + escapeHtml(sub) + "</p></header>";
  }

  function emptyHint(n, label) {
    if (n) return "";
    return '<p class="empty">아직 ' + escapeHtml(label) + "이 없습니다. 상단 ＋ 추가를 눌러 보세요.</p>";
  }

  function timelineHtml(list, kind) {
    if (!list.length) return "";
    return (
      '<ol class="timeline">' +
      list
        .map(function (item) {
          var title =
            kind === "employment"
              ? item.companyName
              : item.school || item.name || item.title;
          var sub =
            kind === "employment"
              ? WhoAreYouDb.EMPLOYMENT_TYPES[item.employmentType] +
                " · " +
                (item.department || "") +
                " " +
                (item.position || "")
              : item.degree || item.issuer || "";
          return (
            '<li class="timeline__item"><button type="button" class="timeline__card" data-store="' +
            (kind === "employment" ? "employments" : kind) +
            '" data-id="' +
            escapeHtml(item.id) +
            '"><span class="timeline__period">' +
            fmtPeriod(item.startDate, item.endDate, item.isCurrent) +
            "</span><strong>" +
            escapeHtml(title) +
            '</strong><span class="timeline__sub">' +
            escapeHtml(sub.trim()) +
            "</span></button></li>"
          );
        })
        .join("") +
      "</ol>"
    );
  }

  function renderEducationList(b) {
    var list = filterList(b.educations.slice().sort(byDateDesc), ["school", "major"]);
    if (state.editStore === "educations" && (state.isNew || state.editId)) {
      renderEducationForm();
      return;
    }
    $("content").innerHTML =
      sectionHead("학력", "학교·전공·학위") +
      timelineHtml(
        list.map(function (e) {
          return Object.assign({}, e, { school: e.school });
        }),
        "educations"
      ) +
      emptyHint(list.length, "학력");
    bindListClicks("educations");
  }

  function renderCertList(b) {
    var list = filterList(b.certifications.slice().sort(byDateDesc), ["name", "issuer"]);
    if (state.editStore === "certifications" && (state.isNew || state.editId)) {
      renderCertForm();
      return;
    }
    $("content").innerHTML =
      sectionHead("자격·교육", "국가기술자격·교육 이수") +
      '<ul class="simple-list">' +
      list
        .map(function (c) {
          return (
            '<li><button type="button" class="simple-list__btn" data-store="certifications" data-id="' +
            escapeHtml(c.id) +
            '"><strong>' +
            escapeHtml(c.name) +
            "</strong> · " +
            escapeHtml(c.issuer || "") +
            " · " +
            escapeHtml(c.certDate || "") +
            "</button></li>"
          );
        })
        .join("") +
      "</ul>" +
      emptyHint(list.length, "자격");
    bindListClicks("certifications");
  }

  function renderDocumentList(b) {
    var list = filterList(b.documents.slice().sort(function (a, b2) {
      return (b2.updatedAt || "").localeCompare(a.updatedAt || "");
    }), ["title", "body", "targetCompany"]);
    if (state.editStore === "documents" && (state.isNew || state.editId)) {
      renderDocumentForm();
      return;
    }
    var cats = WhoAreYouDb.DOCUMENT_CATEGORIES;
    $("content").innerHTML =
      sectionHead("자기소개서", "항목별·통합 문서 — 한글 원고 관리") +
      '<div class="doc-grid">' +
      list
        .map(function (d) {
          return (
            '<article class="doc-card" data-store="documents" data-id="' +
            escapeHtml(d.id) +
            '"><span class="doc-card__cat">' +
            escapeHtml(cats[d.category] || d.category) +
            "</span><h3>" +
            escapeHtml(d.title) +
            "</h3>" +
            (d.targetCompany ? '<p class="muted">→ ' + escapeHtml(d.targetCompany) + "</p>" : "") +
            '<p class="doc-card__preview">' +
            escapeHtml((d.body || "").slice(0, 120)) +
            '</p><span class="doc-card__meta">' +
            (d.body ? d.body.length + "자" : "0자") +
            "</span></article>"
          );
        })
        .join("") +
      "</div>" +
      emptyHint(list.length, "자기소개서");
    bindListClicks("documents");
  }

  function bindListClicks(store) {
    $("content").querySelectorAll("[data-store]").forEach(function (el) {
      el.onclick = function () {
        state.editStore = el.getAttribute("data-store");
        state.editId = el.getAttribute("data-id");
        state.isNew = false;
        state.draft = null;
        openEdit(store, state.editId);
      };
    });
  }

  function openEdit(store, id) {
    state.editStore = store;
    state.view = STORE_VIEWS[store] || store;
    if (!id) {
      state.isNew = true;
      state.draft = newDraft(store);
      render();
      return;
    }
    WhoAreYouDb.getItem(store, id).then(function (item) {
      state.draft = Object.assign({}, item);
      state.isNew = false;
      state.editId = id;
      render();
    });
  }

  function newDraft(store) {
    var now = new Date().toISOString().slice(0, 10);
    if (store === "employments")
      return {
        companyName: "",
        businessNo: "",
        department: "",
        position: "",
        employmentType: "regular",
        startDate: now,
        endDate: "",
        isCurrent: false,
        duties: "",
      };
    if (store === "projects")
      return {
        projectName: "",
        startDate: now,
        endDate: "",
        client: "",
        employer: "",
        position: "",
        tasks: "",
        techStack: "",
        rating: null,
      };
    if (store === "educations")
      return { school: "", major: "", degree: "", startDate: "", endDate: "" };
    if (store === "certifications")
      return { name: "", issuer: "", certDate: "", certNo: "", kind: "cert" };
    if (store === "documents")
      return { title: "", category: "motivation", body: "", targetCompany: "" };
    return {};
  }

  function formWrap(title, inner, store) {
    return (
      '<form class="edit-panel" id="edit-form"><h2>' +
      escapeHtml(title) +
      "</h2>" +
      inner +
      '<div class="form-actions">' +
      '<button type="submit" class="btn btn--primary">저장</button>' +
      '<button type="button" class="btn" id="btn-cancel">취소</button>' +
      (state.isNew ? "" : '<button type="button" class="btn btn--danger" id="btn-del">삭제</button>') +
      "</div></form>"
    );
  }

  var PUT_FN = {
    employments: WhoAreYouDb.putEmployment,
    projects: WhoAreYouDb.putProject,
    educations: WhoAreYouDb.putEducation,
    certifications: WhoAreYouDb.putCertification,
    documents: WhoAreYouDb.putDocument,
  };

  var DELETE_FN = {
    employments: WhoAreYouDb.deleteEmployment,
    projects: WhoAreYouDb.deleteProject,
    educations: WhoAreYouDb.deleteEducation,
    certifications: WhoAreYouDb.deleteCertification,
    documents: WhoAreYouDb.deleteDocument,
  };

  function bindForm(saveFn, store) {
    $("edit-form").onsubmit = function (e) {
      e.preventDefault();
      saveFn();
    };
    $("btn-cancel").onclick = function () {
      state.editStore = null;
      state.editId = null;
      state.draft = null;
      render();
    };
    var del = $("btn-del");
    if (del && DELETE_FN[store]) {
      del.onclick = function () {
        if (!confirm("삭제할까요?")) return;
        DELETE_FN[store](state.editId).then(function () {
          state.editStore = null;
          state.editId = null;
          render();
        });
      };
    }
  }

  function renderEmploymentForm(b) {
    var d = state.draft;
    var types = Object.keys(WhoAreYouDb.EMPLOYMENT_TYPES)
      .map(function (k) {
        return (
          '<option value="' +
          k +
          '"' +
          (d.employmentType === k ? " selected" : "") +
          ">" +
          WhoAreYouDb.EMPLOYMENT_TYPES[k] +
          "</option>"
        );
      })
      .join("");
    $("content").innerHTML = formWrap(
      state.isNew ? "근무경력 추가" : "근무경력 수정",
      field("회사명", "f-co", d.companyName) +
        field("사업자등록번호", "f-biz", d.businessNo) +
        '<div class="field-row">' +
        field("부서", "f-dept", d.department) +
        field("직위", "f-pos", d.position) +
        "</div>" +
        '<label class="field-label">고용 형태</label><select class="field-input" id="f-type">' +
        types +
        "</select>" +
        '<div class="field-row">' +
        field("시작", "f-start", d.startDate, "month") +
        field("종료", "f-end", d.endDate, "month") +
        "</div>" +
        '<label class="field-label"><input type="checkbox" id="f-current"' +
        (d.isCurrent ? " checked" : "") +
        " /> 재직 중</label>" +
        '<label class="field-label">담당 업무</label><textarea class="field-textarea" id="f-duties">' +
        escapeHtml(d.duties || "") +
        "</textarea>",
      "employments"
    );
    bindForm(function () {
      saveListItem("employments", {
        companyName: $("f-co").value.trim(),
        businessNo: $("f-biz").value.trim(),
        department: $("f-dept").value.trim(),
        position: $("f-pos").value.trim(),
        employmentType: $("f-type").value,
        startDate: $("f-start").value,
        endDate: $("f-end").value,
        isCurrent: $("f-current").checked,
        duties: $("f-duties").value,
      });
    }, "employments");
  }

  function renderProjectForm(b) {
    var d = state.draft;
    var empOpts =
      '<option value="">—</option>' +
      b.employments
        .map(function (e) {
          return (
            '<option value="' +
            escapeHtml(e.id) +
            '"' +
            (d.employmentId === e.id ? " selected" : "") +
            ">" +
            escapeHtml(e.companyName) +
            "</option>"
          );
        })
        .join("");
    $("content").innerHTML = formWrap(
      state.isNew ? "기술경력 추가" : "기술경력 수정",
      field("참여사업명", "f-pn", d.projectName) +
        '<div class="field-row">' +
        field("참여 시작", "f-ps", d.startDate, "month") +
        field("참여 종료", "f-pe", d.endDate, "month") +
        "</div>" +
        field("발주처", "f-client", d.client) +
        field("소속사", "f-employer", d.employer) +
        field("직위", "f-pos", d.position) +
        '<label class="field-label">연결 근무처</label><select class="field-input" id="f-emp-link">' +
        empOpts +
        "</select>" +
        '<label class="field-label">수행 업무</label><textarea class="field-textarea field-textarea--tall" id="f-tasks">' +
        escapeHtml(d.tasks || "") +
        "</textarea>" +
        field("기술 스택", "f-tech", d.techStack) +
        field("자체 평가 (1~5, 선택)", "f-rating", d.rating || "", "number"),
      "projects"
    );
    bindForm(function () {
      saveListItem("projects", {
        projectName: $("f-pn").value.trim(),
        startDate: $("f-ps").value,
        endDate: $("f-pe").value,
        client: $("f-client").value.trim(),
        employer: $("f-employer").value.trim(),
        position: $("f-pos").value.trim(),
        employmentId: $("f-emp-link").value,
        tasks: $("f-tasks").value,
        techStack: $("f-tech").value.trim(),
        rating: $("f-rating").value ? Number($("f-rating").value) : null,
      });
    }, "projects");
  }

  function renderEducationForm() {
    var d = state.draft;
    $("content").innerHTML = formWrap(
      state.isNew ? "학력 추가" : "학력 수정",
      field("학교명", "f-school", d.school) +
        field("전공", "f-major", d.major) +
        field("학위", "f-degree", d.degree) +
        '<div class="field-row">' +
        field("입학", "f-start", d.startDate, "month") +
        field("졸업", "f-end", d.endDate, "month") +
        "</div>",
      "educations"
    );
    bindForm(function () {
      saveListItem("educations", {
        school: $("f-school").value.trim(),
        major: $("f-major").value.trim(),
        degree: $("f-degree").value.trim(),
        startDate: $("f-start").value,
        endDate: $("f-end").value,
      });
    }, "educations");
  }

  function renderCertForm() {
    var d = state.draft;
    $("content").innerHTML = formWrap(
      state.isNew ? "자격·교육 추가" : "수정",
      '<label class="field-label">구분</label><select class="field-input" id="f-kind"><option value="cert"' +
      (d.kind === "cert" ? " selected" : "") +
      '>자격</option><option value="edu"' +
      (d.kind === "edu" ? " selected" : "") +
      ">교육</option></select>" +
        field("명칭", "f-name", d.name) +
        field("발급·주관", "f-issuer", d.issuer) +
        field("취득·수료일", "f-date", d.certDate, "month") +
        field("등록번호", "f-no", d.certNo),
      "certifications"
    );
    bindForm(function () {
      saveListItem("certifications", {
        kind: $("f-kind").value,
        name: $("f-name").value.trim(),
        issuer: $("f-issuer").value.trim(),
        certDate: $("f-date").value,
        certNo: $("f-no").value.trim(),
      });
    }, "certifications");
  }

  function renderDocumentForm() {
    var d = state.draft;
    var opts = Object.keys(WhoAreYouDb.DOCUMENT_CATEGORIES)
      .map(function (k) {
        return (
          '<option value="' +
          k +
          '"' +
          (d.category === k ? " selected" : "") +
          ">" +
          WhoAreYouDb.DOCUMENT_CATEGORIES[k] +
          "</option>"
        );
      })
      .join("");
    $("content").innerHTML = formWrap(
      state.isNew ? "자기소개서 추가" : "자기소개서 수정",
      field("문서 제목", "f-title", d.title) +
        '<label class="field-label">항목</label><select class="field-input" id="f-cat">' +
        opts +
        "</select>" +
        field("지원 회사 (선택)", "f-target", d.targetCompany) +
        '<label class="field-label">본문 <span id="char-count" class="char-count"></span></label>' +
        '<textarea class="field-textarea field-textarea--doc" id="f-body">' +
        escapeHtml(d.body || "") +
        "</textarea>",
      "documents"
    );
    var body = $("f-body");
    var count = $("char-count");
    function upd() {
      count.textContent = body.value.length + "자";
    }
    body.oninput = upd;
    upd();
    bindForm(function () {
      saveListItem("documents", {
        title: $("f-title").value.trim(),
        category: $("f-cat").value,
        targetCompany: $("f-target").value.trim(),
        body: $("f-body").value,
      });
    }, "documents");
  }

  function saveListItem(store, fields) {
    var put = PUT_FN[store];
    var titleKey =
      store === "employments"
        ? "companyName"
        : store === "projects"
          ? "projectName"
          : store === "educations"
            ? "school"
            : store === "documents"
              ? "title"
              : "name";
    if (!fields[titleKey] || !String(fields[titleKey]).trim()) {
      alert("필수 항목을 입력하세요.");
      return;
    }
    var save = function (id) {
      var item = Object.assign({}, state.draft, fields, { id: id });
      put(item).then(function () {
        state.editStore = null;
        state.editId = null;
        state.draft = null;
        render();
        if (window.ProjectShell) {
          ProjectShell.notifyTaskDone({
            module: "나는누구?",
            action: "항목 저장 완료",
            title: fields[titleKey],
          });
        }
      });
    };
    if (state.isNew) {
      WhoAreYouDb.loadBundle().then(function (b) {
        var ids = {};
        (b[store] || []).forEach(function (x) {
          ids[x.id] = true;
        });
        save(WhoAreYouDb.slug(fields[titleKey], ids));
      });
    } else save(state.draft.id);
  }

  function renderPreview(b) {
    var p = b.profile;
    var docs = b.documents
      .map(function (d) {
        return (
          '<section class="print-sec"><h3>' +
          escapeHtml(WhoAreYouDb.DOCUMENT_CATEGORIES[d.category] || d.category) +
          " — " +
          escapeHtml(d.title) +
          '</h3><div class="print-body">' +
          nl2br(d.body) +
          "</div></section>"
        );
      })
      .join("");
    $("content").innerHTML =
      '<div class="print-doc" id="print-area">' +
      '<header class="print-head"><h1>' +
      escapeHtml(p.name || "이력서") +
      "</h1>" +
      (p.headline ? "<p>" + escapeHtml(p.headline) + "</p>" : "") +
      '<p class="print-contact">' +
      [p.email, p.phone, p.targetRole].filter(Boolean).map(escapeHtml).join(" · ") +
      "</p>" +
      (p.summary ? '<section class="print-sec"><h3>경력 요약</h3><p>' + nl2br(p.summary) + "</p></section>" : "") +
      '<section class="print-sec"><h3>근무경력</h3><table class="print-table"><thead><tr><th>기간</th><th>회사</th><th>부서/직위</th><th>담당</th></tr></thead><tbody>' +
      b.employments
        .map(function (e) {
          return (
            "<tr><td>" +
            fmtPeriod(e.startDate, e.endDate, e.isCurrent) +
            "</td><td>" +
            escapeHtml(e.companyName) +
            "</td><td>" +
            escapeHtml((e.department || "") + " " + (e.position || "")) +
            "</td><td>" +
            escapeHtml((e.duties || "").slice(0, 80)) +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></section>" +
      '<section class="print-sec"><h3>기술경력</h3><table class="print-table print-table--tech"><thead><tr><th>사업명</th><th>기간</th><th>발주처</th><th>소속</th><th>수행업무</th></tr></thead><tbody>' +
      b.projects
        .map(function (pr) {
          return (
            "<tr><td>" +
            escapeHtml(pr.projectName) +
            "</td><td>" +
            fmtPeriod(pr.startDate, pr.endDate) +
            "</td><td>" +
            escapeHtml(pr.client || "") +
            "</td><td>" +
            escapeHtml(pr.employer || "") +
            "</td><td>" +
            escapeHtml((pr.tasks || "").slice(0, 100)) +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></section>" +
      (b.educations.length
        ? '<section class="print-sec"><h3>학력</h3><ul>' +
          b.educations
            .map(function (ed) {
              return (
                "<li>" +
                escapeHtml(ed.school) +
                " " +
                escapeHtml(ed.major) +
                " " +
                escapeHtml(ed.degree) +
                " (" +
                fmtPeriod(ed.startDate, ed.endDate) +
                ")</li>"
              );
            })
            .join("") +
          "</ul></section>"
        : "") +
      docs +
      "</div>" +
      '<div class="form-actions no-print"><button type="button" class="btn btn--primary" id="btn-print">인쇄 / PDF 저장</button></div>';
    $("btn-print").onclick = function () {
      window.print();
    };
  }

  function nl2br(t) {
    return escapeHtml(t || "").replace(/\n/g, "<br>");
  }

  function renderImport() {
    $("content").innerHTML =
      '<div class="import-panel">' +
      "<h2>📥 가져오기</h2>" +
      "<p>기존 한글 문서·JSON을 이 앱 구조로 옮깁니다.</p>" +
      '<label class="btn btn--primary">JSON 파일<input type="file" id="import-json" accept=".json" hidden /></label>' +
      '<section class="import-paste"><h3>자기소개서 붙여넣기</h3>' +
      "<p>제목 줄에 <code>## 지원동기</code> 형태로 구분하면 여러 문서로 나뉩니다.</p>" +
      '<textarea class="field-textarea field-textarea--doc" id="paste-md" placeholder="## 지원동기\n...\n\n## 성장과정\n..."></textarea>' +
      '<button type="button" class="btn btn--primary" id="btn-paste">문서로 분할 저장</button></section></div>';
    $("import-json").onchange = function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          var bundle = data.bundle || data;
          var replace = confirm("전체 교체할까요? 취소 = 병합");
          WhoAreYouDb.importBundle(bundle, replace).then(function () {
            state.view = "dashboard";
            render();
          });
        } catch (err) {
          alert("JSON 오류");
        }
      };
      reader.readAsText(f);
      e.target.value = "";
    };
    $("btn-paste").onclick = function () {
      var text = $("paste-md").value.trim();
      if (!text) return;
      var parts = text.split(/^##\s+/m).filter(Boolean);
      var map = {
        지원동기: "motivation",
        성장과정: "growth",
        "성격·장단점": "strength",
        성격장단점: "strength",
        "입사 후 포부": "vision",
        입사후포부: "vision",
      };
      var docs = parts.map(function (block) {
        var lines = block.split("\n");
        var title = lines[0].trim();
        var body = lines.slice(1).join("\n").trim();
        return {
          title: title,
          category: map[title] || "custom",
          body: body,
        };
      });
      WhoAreYouDb.loadBundle().then(function (b) {
        var ids = {};
        b.documents.forEach(function (d) {
          ids[d.id] = true;
        });
        return Promise.all(
          docs.map(function (d) {
            return WhoAreYouDb.putDocument({
              id: WhoAreYouDb.slug(d.title, ids),
              title: d.title,
              category: d.category,
              body: d.body,
              targetCompany: "",
            });
          })
        );
      }).then(function () {
        alert(docs.length + "개 문서로 저장했습니다.");
        state.view = "documents";
        render();
      });
    };
  }

  function render() {
    var seq = ++renderSeq;
    if (window.ProjectShell) ProjectShell.setActiveView(state.view);
    updateToolbar(bundleCache);
    loadBundle()
      .then(function (b) {
        if (seq !== renderSeq) return;
        bundleCache = b;
        updateNavCounts(b);
        if (state.view === "dashboard") renderDashboard(b);
        else if (state.view === "profile") renderProfile(b);
        else if (state.view === "employments") renderEmploymentList(b);
        else if (state.view === "projects") renderProjectList(b);
        else if (state.view === "educations") renderEducationList(b);
        else if (state.view === "certifications") renderCertList(b);
        else if (state.view === "documents") renderDocumentList(b);
        else if (state.view === "preview") renderPreview(b);
        else if (state.view === "import") renderImport();
      })
      .catch(function (err) {
        console.error(err);
        $("content").innerHTML = '<p class="empty">데이터를 불러오지 못했습니다.</p>';
      });
  }

  function exportJson() {
    loadBundle().then(function (b) {
      var blob = new Blob([JSON.stringify(WhoAreYouDb.exportPayload(b), null, 2)], {
        type: "application/json",
      });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "who-are-you-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
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
        storageKey: "who-are-you-branding",
        defaults: {
          title: "나는누구?",
          tagline: "자기소개서·SW기술자형 경력 — 한글 문서를 구조화",
        },
        titleSuffix: "",
      });
    }
    document.querySelectorAll(".nav-item[data-view]").forEach(function (btn) {
      btn.onclick = function () {
        state.view = btn.getAttribute("data-view");
        state.editStore = null;
        state.editId = null;
        state.draft = null;
        render();
      };
    });
    $("search").oninput = function (e) {
      state.search = e.target.value.trim();
      render();
    };
    $("btn-export").onclick = exportJson;
    $("btn-add").onclick = function () {
      if (state.view === "profile") {
        $("profile-form").requestSubmit();
        return;
      }
      if (STORE_VIEWS[state.view]) {
        state.isNew = true;
        state.editId = null;
        state.draft = newDraft(state.view);
        state.editStore = state.view;
        render();
      }
    };
  }

  WhoAreYouDb.seedIfEmpty()
    .then(function () {
      bindUi();
      render();
    })
    .catch(function (err) {
      console.error(err);
      $("content").innerHTML = '<p class="empty">저장소를 사용할 수 없습니다.</p>';
    });
})();
