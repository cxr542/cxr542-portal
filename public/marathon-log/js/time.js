(function (global) {
  "use strict";

  /** Parse chip time to total seconds. Supports H:MM:SS, HH:MM:SS, M:SS, MM:SS */
  function parseChipTime(str) {
    if (!str || typeof str !== "string") return null;
    var s = str.trim();
    if (!s) return null;
    var parts = s.split(":").map(function (p) {
      return parseInt(p, 10);
    });
    if (parts.some(function (n) {
      return isNaN(n) || n < 0;
    })) {
      return null;
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return null;
  }

  function formatChipTime(totalSeconds) {
    if (totalSeconds == null || isNaN(totalSeconds)) return "—";
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var sec = totalSeconds % 60;
    if (h > 0) {
      return h + ":" + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
    }
    return m + ":" + String(sec).padStart(2, "0");
  }

  function isValidChipTime(str) {
    if (!str || typeof str !== "string") return false;
    var u = str.trim().toUpperCase();
    if (u === "DNS" || u === "DNF") return false;
    return parseChipTime(str) !== null;
  }

  /** Keep 등에서 H:MM:SS:ms 형태 정리 */
  function normalizeChipTimeInput(str) {
    if (!str || typeof str !== "string") return "";
    var s = str.trim();
    var upper = s.toUpperCase();
    if (upper === "DNS" || upper === "DNF") return upper;
    s = s.replace(/\./g, ":");
    var parts = s.split(":").map(function (p) {
      return parseInt(p, 10);
    });
    if (parts.length < 2 || parts.some(function (n) {
      return isNaN(n) || n < 0;
    })) {
      return str.trim();
    }
    if (parts.length >= 3) {
      var h = parts[0];
      var m = parts[1];
      var sec = parts[2];
      if (h > 0) {
        return h + ":" + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
      }
      return m + ":" + String(sec).padStart(2, "0");
    }
    return parts[0] + ":" + String(parts[1]).padStart(2, "0");
  }

  function compareChipTime(a, b) {
    var sa = parseChipTime(a);
    var sb = parseChipTime(b);
    if (sa == null && sb == null) return 0;
    if (sa == null) return 1;
    if (sb == null) return -1;
    return sa - sb;
  }

  global.MarathonTime = {
    parseChipTime: parseChipTime,
    formatChipTime: formatChipTime,
    isValidChipTime: isValidChipTime,
    normalizeChipTimeInput: normalizeChipTimeInput,
    compareChipTime: compareChipTime,
  };
})(window);
