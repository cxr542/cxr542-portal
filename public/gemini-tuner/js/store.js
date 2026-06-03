(function (global) {
  "use strict";

  var LS_KEY = "gemini-tuner-demo-v1";

  var DEFAULT = {
    budgetUsd: 20,
    usdToKrw: 1350,
    warnPct: 80,
    quotaShortPct: 55,
    quotaLongPct: 86,
    totalTokens: 128400,
    sessionCostUsd: 0.42,
    meterMode: "dom",
    lastTurn: { input: 1240, output: 3180, total: 4420 },
    recentChatAt: 0,
    sessions: [
      {
        id: "s1",
        title: "gemini.google.com · 요약",
        tokens: 4200,
        costUsd: 0.08,
        at: Date.now() - 3600000,
      },
      {
        id: "s2",
        title: "gemini.google.com · 코드 리뷰",
        tokens: 18500,
        costUsd: 0.19,
        at: Date.now() - 7200000,
      },
    ],
  };

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (!raw || typeof raw !== "object") return JSON.parse(JSON.stringify(DEFAULT));
      var merged = Object.assign(JSON.parse(JSON.stringify(DEFAULT)), raw, {
        sessions: Array.isArray(raw.sessions) ? raw.sessions : DEFAULT.sessions,
        lastTurn: Object.assign({}, DEFAULT.lastTurn, raw.lastTurn || {}),
      });
      delete merged.providers;
      return merged;
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT));
    }
  }

  function save(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) {
      /* ignore */
    }
    return data;
  }

  function monthUsageUsd(data) {
    return Number(data.sessionCostUsd) || 0;
  }

  function budgetPct(data) {
    var budget = Number(data.budgetUsd) || 1;
    return Math.min(100, Math.round((monthUsageUsd(data) / budget) * 100));
  }

  global.GeminiTunerStore = {
    LS_KEY: LS_KEY,
    DEFAULT: DEFAULT,
    load: load,
    save: save,
    monthUsageUsd: monthUsageUsd,
    budgetPct: budgetPct,
  };
})(window);
