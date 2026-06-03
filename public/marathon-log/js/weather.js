(function (global) {
  "use strict";

  var STORAGE_KEY = "marathon-log-kma-key";

  var STATIONS = [
    { id: "108", name: "서울", lat: 37.57, lon: 126.98, keywords: ["서울", "jtbc", "한강", "새해"] },
    { id: "159", name: "부산", lat: 35.1, lon: 129.03, keywords: ["부산", "해운대"] },
    { id: "143", name: "대구", lat: 35.88, lon: 128.63, keywords: ["대구", "fwd"] },
    { id: "101", name: "춘천", lat: 37.88, lon: 127.73, keywords: ["춘천"] },
    { id: "156", name: "광주", lat: 35.17, lon: 126.89, keywords: ["광주"] },
    { id: "133", name: "대전", lat: 36.37, lon: 127.36, keywords: ["대전"] },
    { id: "112", name: "인천", lat: 37.48, lon: 126.62, keywords: ["인천"] },
    { id: "152", name: "울산", lat: 35.59, lon: 129.35, keywords: ["울산"] },
    { id: "131", name: "청주", lat: 36.63, lon: 127.44, keywords: ["청주", "충북"] },
    { id: "146", name: "전주", lat: 35.82, lon: 127.15, keywords: ["전주", "경주", "벚꽃"] },
  ];

  var KMA_BASE =
    "https://apis.data.go.kr/1365188/AsosDalyInfoService/getWthrDataList";

  function getKmaApiKey() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setKmaApiKey(key) {
    try {
      if (key) localStorage.setItem(STORAGE_KEY, key);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function resolveStation(eventName) {
    var text = String(eventName || "").toLowerCase();
    for (var i = 0; i < STATIONS.length; i++) {
      var st = STATIONS[i];
      for (var j = 0; j < st.keywords.length; j++) {
        if (text.indexOf(st.keywords[j]) >= 0) return st;
      }
    }
    return STATIONS[0];
  }

  function deriveLabelFromObs(sumRn, avgRhm, avgWs, minTa, maxTa) {
    var rn = parseFloat(sumRn);
    var rh = parseFloat(avgRhm);
    var ws = parseFloat(avgWs);
    var min = parseFloat(minTa);
    var max = parseFloat(maxTa);
    var label = "맑음";
    if (!isNaN(rn) && rn >= 1) label = "비";
    else if (!isNaN(rn) && rn > 0) label = "약한 비";
    else if (!isNaN(ws) && ws >= 7) label = "바람";
    else if (!isNaN(rh) && rh >= 75) label = "흐림";
    if (!isNaN(max) && max <= 5 && label === "맑음") label = "추움";
    if (!isNaN(min) && min <= 0 && label === "맑음") label = "추움";
    return label;
  }

  function wmoLabel(code) {
    var c = Number(code);
    if (c === 0) return "맑음";
    if (c === 1 || c === 2) return "구름 조금";
    if (c === 3) return "흐림";
    if (c === 45 || c === 48) return "안개";
    if (c >= 51 && c <= 57) return "이슬비";
    if (c >= 61 && c <= 67) return "비";
    if (c >= 71 && c <= 77) return "눈";
    if (c >= 80 && c <= 82) return "소나기";
    if (c >= 95) return "뇌우";
    return "흐림";
  }

  function formatWeather(label, minTa, maxTa, extra) {
    var min = parseFloat(minTa);
    var max = parseFloat(maxTa);
    var temp = "";
    if (!isNaN(min) && !isNaN(max)) {
      temp = Math.round(min) === Math.round(max) ? Math.round(max) + "°C" : Math.round(min) + "~" + Math.round(max) + "°C";
    } else if (!isNaN(max)) {
      temp = Math.round(max) + "°C";
    }
    var parts = [label];
    if (temp) parts.push(temp);
    if (extra) parts.push(extra);
    return parts.join(" ");
  }

  function formatFromKmaItem(item, stationName) {
    var label = deriveLabelFromObs(item.sumRn, item.avgRhm, item.avgWs, item.minTa, item.maxTa);
    var text = formatWeather(label, item.minTa, item.maxTa);
    return {
      text: text,
      source: "kma",
      hint: "기상청 ASOS · " + (stationName || item.stnNm || "관측소"),
    };
  }

  function formatFromOpenMeteo(daily, stationName) {
    var label = wmoLabel(daily.weather_code && daily.weather_code[0]);
    var min = daily.temperature_2m_min && daily.temperature_2m_min[0];
    var max = daily.temperature_2m_max && daily.temperature_2m_max[0];
    var wind = daily.windspeed_10m_max && daily.windspeed_10m_max[0];
    if (wind >= 30) label = "바람";
    return {
      text: formatWeather(label, min, max),
      source: "openmeteo",
      hint: stationName + " 인근 · Open-Meteo (API 키 없을 때)",
    };
  }

  function fetchKmaDaily(dateStr, station, serviceKey) {
    var dt = dateStr.replace(/-/g, "");
    var url =
      KMA_BASE +
      "?serviceKey=" +
      encodeURIComponent(serviceKey) +
      "&pageNo=1&numOfRows=10&dataType=JSON&dataCd=ASOS&dateCd=DAY" +
      "&startDt=" +
      dt +
      "&endDt=" +
      dt +
      "&stnIds=" +
      station.id;

    return fetch(url)
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        var body = data && data.response && data.response.body;
        if (!body || String(body.resultCode) !== "00") {
          var msg = (body && body.resultMsg) || "기상청 응답 없음";
          throw new Error(msg);
        }
        var items = body.items && body.items.item;
        if (!items) throw new Error("해당 날짜 관측값 없음");
        var item = Array.isArray(items) ? items[0] : items;
        return formatFromKmaItem(item, station.name);
      });
  }

  function parseDateOnly(str) {
    if (!str || str.length < 10) return null;
    var p = str.split("-").map(Number);
    if (p.length < 3 || p.some(isNaN)) return null;
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function dayDiff(a, b) {
    var da = parseDateOnly(typeof a === "string" ? a : formatYmd(a));
    var db = parseDateOnly(typeof b === "string" ? b : formatYmd(b));
    if (!da || !db) return 9999;
    return Math.round(Math.abs(da.getTime() - db.getTime()) / 86400000);
  }

  function formatYmd(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function fetchOpenMeteoDaily(dateStr, station) {
    var dailyParams =
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max";
    var todayStr = formatYmd(new Date());
    var diff = dayDiff(todayStr, dateStr);
    var url;

    if (diff <= 15) {
      url =
        "https://api.open-meteo.com/v1/forecast?latitude=" +
        station.lat +
        "&longitude=" +
        station.lon +
        "&daily=" +
        dailyParams +
        "&timezone=Asia%2FSeoul&past_days=15&forecast_days=0";
    } else {
      url =
        "https://archive-api.open-meteo.com/v1/archive?latitude=" +
        station.lat +
        "&longitude=" +
        station.lon +
        "&start_date=" +
        dateStr +
        "&end_date=" +
        dateStr +
        "&daily=" +
        dailyParams +
        "&timezone=Asia%2FSeoul";
    }

    return fetch(url)
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.daily || !data.daily.time) {
          throw new Error("날씨 데이터 없음");
        }
        var idx = data.daily.time.indexOf(dateStr);
        if (idx < 0) throw new Error("해당 날짜 데이터 없음");
        var slice = {
          weather_code: [data.daily.weather_code[idx]],
          temperature_2m_min: [data.daily.temperature_2m_min[idx]],
          temperature_2m_max: [data.daily.temperature_2m_max[idx]],
          windspeed_10m_max: [data.daily.windspeed_10m_max[idx]],
        };
        return formatFromOpenMeteo(slice, station.name);
      });
  }

  function fetchWeatherForRace(dateStr, eventName) {
    if (!dateStr) {
      return Promise.reject(new Error("날짜를 먼저 선택하세요."));
    }
    var today = new Date().toISOString().slice(0, 10);
    if (dateStr > today) {
      return Promise.reject(new Error("미래 날짜는 과거 관측·재분석 데이터를 조회할 수 없습니다."));
    }

    var station = resolveStation(eventName);
    var serviceKey = getKmaApiKey();

    if (serviceKey) {
      return fetchKmaDaily(dateStr, station, serviceKey).catch(function (kmaErr) {
        return fetchOpenMeteoDaily(dateStr, station).then(function (result) {
          result.hint =
            "기상청 조회 실패 → " +
            station.name +
            " 추정 · Open-Meteo (" +
            (kmaErr && kmaErr.message ? kmaErr.message : "CORS/키 확인") +
            ")";
          return result;
        });
      });
    }

    return fetchOpenMeteoDaily(dateStr, station).then(function (result) {
      result.hint =
        station.name +
        " · Open-Meteo (기상청 ASOS는 데이터 ▾에서 API 키 설정)";
      return result;
    });
  }

  global.MarathonWeather = {
    getKmaApiKey: getKmaApiKey,
    setKmaApiKey: setKmaApiKey,
    resolveStation: resolveStation,
    fetchWeatherForRace: fetchWeatherForRace,
  };
})(window);
