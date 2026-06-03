(function (global) {
  "use strict";

  var LS_KEY = "vision-font-settings-v1";

  var TEST_STEPS = [
    { step: 1, sizePx: 52, line: "가나다라마" },
    { step: 2, sizePx: 40, line: "바사아자차" },
    { step: 3, sizePx: 30, line: "카타파하" },
    { step: 4, sizePx: 22, line: "사자차카" },
    { step: 5, sizePx: 16, line: "파하카타" },
  ];

  /** step에서 멈춤 → 필요한 글꼴 크기 레벨 (1=가장 큼, 5=가장 작은 글 필요) */
  var STEP_TO_LEVEL = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };

  var LEVEL_PRESETS = {
    1: { fontSize: 22, lineHeight: 1.5, letterSpacing: 0, fontFamily: "'Noto Sans KR', sans-serif" },
    2: { fontSize: 24, lineHeight: 1.55, letterSpacing: 0.02, fontFamily: "'Noto Sans KR', sans-serif" },
    3: { fontSize: 28, lineHeight: 1.62, letterSpacing: 0.04, fontFamily: "'Noto Sans KR', sans-serif" },
    4: { fontSize: 32, lineHeight: 1.72, letterSpacing: 0.06, fontFamily: "'Noto Sans KR', sans-serif" },
    5: { fontSize: 38, lineHeight: 1.85, letterSpacing: 0.08, fontFamily: "'Noto Sans KR', sans-serif" },
  };

  var DEFAULT_SETTINGS = {
    level: 3,
    fontSize: 28,
    lineHeight: 1.62,
    letterSpacing: 0.04,
    fontFamily: "'Noto Sans KR', sans-serif",
    testedAt: null,
  };

  function levelFromStep(step) {
    return STEP_TO_LEVEL[step] || 3;
  }

  function presetForLevel(level) {
    return LEVEL_PRESETS[level] || LEVEL_PRESETS[3];
  }

  function settingsFromStep(step) {
    var level = levelFromStep(step);
    var preset = presetForLevel(level);
    return {
      level: level,
      fontSize: preset.fontSize,
      lineHeight: preset.lineHeight,
      letterSpacing: preset.letterSpacing,
      fontFamily: preset.fontFamily,
      testedAt: new Date().toISOString(),
    };
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "object") return Object.assign({}, DEFAULT_SETTINGS);
    var level = Number(raw.level);
    if (!LEVEL_PRESETS[level]) level = DEFAULT_SETTINGS.level;
    var preset = presetForLevel(level);
    return {
      level: level,
      fontSize: Number(raw.fontSize) || preset.fontSize,
      lineHeight: Number(raw.lineHeight) || preset.lineHeight,
      letterSpacing:
        raw.letterSpacing === 0 || raw.letterSpacing
          ? Number(raw.letterSpacing)
          : preset.letterSpacing,
      fontFamily: raw.fontFamily || preset.fontFamily,
      testedAt: raw.testedAt || null,
    };
  }

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      return normalize(raw);
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function save(settings) {
    var next = normalize(settings);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch (e) {}
    return next;
  }

  function toCss(settings) {
    var s = normalize(settings);
    return (
      "font-family: " +
      s.fontFamily +
      "; font-size: " +
      s.fontSize +
      "px; line-height: " +
      s.lineHeight +
      "; letter-spacing: " +
      s.letterSpacing +
      "em;"
    );
  }

  function applyToElement(el, settings) {
    if (!el) return;
    var s = normalize(settings);
    el.style.fontFamily = s.fontFamily;
    el.style.fontSize = s.fontSize + "px";
    el.style.lineHeight = String(s.lineHeight);
    el.style.letterSpacing = s.letterSpacing + "em";
  }

  global.VisionFontSettings = {
    LS_KEY: LS_KEY,
    TEST_STEPS: TEST_STEPS,
    STEP_TO_LEVEL: STEP_TO_LEVEL,
    LEVEL_PRESETS: LEVEL_PRESETS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    levelFromStep: levelFromStep,
    presetForLevel: presetForLevel,
    settingsFromStep: settingsFromStep,
    normalize: normalize,
    load: load,
    save: save,
    toCss: toCss,
    applyToElement: applyToElement,
  };
})(window);
