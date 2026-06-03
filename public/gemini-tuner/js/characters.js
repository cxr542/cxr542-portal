(function (global) {
  "use strict";

  /** Chrome 확장·tuner_ui_demo.html과 동일한 Gemini 스파클 캐릭터 */
  function gradId(prefix, suffix) {
    return prefix + "-" + (suffix || "main");
  }

  function sparkleHappy(suffix) {
    var g = gradId("gt-char-grad-h", suffix);
    return (
      '<svg class="gt-char-svg gt-char-happy" viewBox="0 0 60 60" aria-hidden="true">' +
      '<defs><linearGradient id="' +
      g +
      '" x1="0" y1="0" x2="60" y2="60" gradientUnits="userSpaceOnUse">' +
      '<stop stop-color="#38bdf8"/><stop offset="0.5" stop-color="#a855f7"/><stop offset="1" stop-color="#ec4899"/>' +
      "</linearGradient></defs>" +
      '<path d="M30 8 C30 22 18 30 4 30 C18 30 30 38 30 52 C30 38 42 30 56 30 C42 30 30 22 30 8Z" fill="url(#' +
      g +
      ')"/>' +
      '<path d="M22 30 Q25 26 28 30" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path d="M32 30 Q35 26 38 30" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' +
      "</svg>"
    );
  }

  function sparkleWarn(suffix) {
    var g = gradId("gt-char-grad-w", suffix);
    return (
      '<svg class="gt-char-svg gt-char-warn" viewBox="0 0 60 60" aria-hidden="true">' +
      '<defs><linearGradient id="' +
      g +
      '" x1="0" y1="0" x2="60" y2="60" gradientUnits="userSpaceOnUse">' +
      '<stop stop-color="#fbbf24"/><stop offset="1" stop-color="#ea580c"/>' +
      "</linearGradient></defs>" +
      '<path d="M30 8 C30 22 18 30 4 30 C18 30 30 38 30 52 C30 38 42 30 56 30 C42 30 30 22 30 8Z" fill="url(#' +
      g +
      ')"/>' +
      '<ellipse cx="24" cy="30" rx="2.5" ry="1" fill="#fff" opacity="0.8"/>' +
      '<ellipse cx="36" cy="30" rx="2.5" ry="1" fill="#fff" opacity="0.8"/>' +
      "</svg>"
    );
  }

  function moodFromBudget(pct, warnPct) {
    if (pct >= warnPct) return "warn";
    return "happy";
  }

  function heroMessage(pct, warnPct, totalTokens) {
    if (pct >= 100) return "예산 한도에 거의 다 닿았어요!";
    if (pct >= warnPct) return "비용이 많이 쌓이고 있어요";
    if (totalTokens > 0) return "잘 쓰고 있어요!";
    return "안녕하세요! 질문을 보내 보세요";
  }

  function renderHero(wrapEl, opts) {
    if (!wrapEl) return;
    var pct = opts.budgetPct || 0;
    var warnPct = opts.warnPct != null ? opts.warnPct : 80;
    var mood = moodFromBudget(pct, warnPct);
    var active = Boolean(opts.active);

    wrapEl.className = "gt-char-wrap" + (mood === "warn" ? " gt-mood-warn" : "") + (active ? " gt-mood-active" : "");
    wrapEl.innerHTML = sparkleHappy("hero") + sparkleWarn("hero");
    wrapEl.setAttribute("data-mood", mood);

    var msg = document.getElementById(opts.msgId || "gt-char-msg");
    var hint = document.getElementById(opts.hintId || "gt-char-hint");
    if (msg) msg.textContent = heroMessage(pct, warnPct, opts.totalTokens || 0);
    if (hint) {
      hint.textContent =
        "이번 달 예상 비용 " +
        pct +
        "% · 토큰 " +
        (opts.totalTokens || 0).toLocaleString() +
        (active ? " · Gemini Web 활동 중" : "");
    }
  }

  function renderQuotaSlot(container, side, pct, label, resetLabel) {
    var low = pct <= 20;
    var suffix = "quota-" + side;
    return (
      '<div class="gt-quota-col' +
      (low ? " is-low" : "") +
      '">' +
      '<div class="gt-quota-head">' +
      '<span class="gt-quota-badge">' +
      label +
      "</span>" +
      '<div class="gt-char-wrap gt-char-wrap--sm' +
      (low ? " gt-mood-warn" : " gt-mood-happy") +
      '">' +
      sparkleHappy(suffix) +
      sparkleWarn(suffix) +
      "</div>" +
      "</div>" +
      '<div class="gt-quota-val' +
      (low ? " is-warn" : side === "short" ? " is-yellow" : " is-purple") +
      '">' +
      pct +
      "%</div>" +
      '<div class="gt-progress"><div class="gt-progress__bar' +
      (low ? " is-warn" : side === "short" ? " is-short" : " is-long") +
      '" style="width:' +
      pct +
      '%"></div></div>' +
      '<small class="gt-quota-reset">' +
      escapeHtml(resetLabel) +
      "</small>" +
      "</div>"
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderQuotaGrid(gridEl, data) {
    if (!gridEl) return;
    var shortPct = data.quotaShortPct != null ? data.quotaShortPct : 55;
    var longPct = data.quotaLongPct != null ? data.quotaLongPct : 86;
    gridEl.innerHTML =
      renderQuotaSlot(null, "short", shortPct, "5h", "리셋 5시간 후") +
      renderQuotaSlot(null, "long", longPct, "1w", "리셋 다음 주");
    var widget = document.getElementById("gt-quota-widget");
    if (widget) widget.classList.toggle("is-warn", shortPct <= 20 || longPct <= 20);
  }

  global.GeminiTunerCharacters = {
    moodFromBudget: moodFromBudget,
    heroMessage: heroMessage,
    renderHero: renderHero,
    renderQuotaGrid: renderQuotaGrid,
    sparkleHappy: sparkleHappy,
    sparkleWarn: sparkleWarn,
  };
})(window);
