(function (global) {
  "use strict";

  var S = global.TodayShoesStore;

  function mockAnalysis() {
    return {
      displayName: "러닝화 (웹 데모)",
      brand: "",
      model: "",
      traits: "API 키 없이 저장된 기본 분석입니다. 설정에서 Google AI 키를 넣으면 Gemini 분석을 시도합니다.",
      bestFor: "데일리 조깅 · 가벼운 러닝",
      caution: "실제 착화감·마모는 사용 환경마다 다릅니다.",
      fromVision: false,
    };
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        var base64 = result.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function buildGeminiBody(base64, mime) {
    return {
      contents: [
        {
          parts: [
            {
              text:
                "러닝화 사진을 분석해 JSON만 반환하세요. 필드: brand, model, displayName(한국어), traits(2~3문장), bestFor, caution. 모르면 빈 문자열.",
            },
            { inline_data: { mime_type: mime || "image/jpeg", data: base64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            brand: { type: "string" },
            model: { type: "string" },
            displayName: { type: "string" },
            traits: { type: "string" },
            bestFor: { type: "string" },
            caution: { type: "string" },
          },
          required: ["brand", "model", "displayName", "traits", "bestFor", "caution"],
        },
      },
    };
  }

  function parseGeminiJson(text) {
    var raw = String(text || "").trim();
    var json = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    var data = JSON.parse(json);
    return {
      displayName: String(data.displayName || "").trim() || "러닝화",
      brand: String(data.brand || "").trim(),
      model: String(data.model || "").trim(),
      traits: String(data.traits || "").trim(),
      bestFor: String(data.bestFor || "").trim(),
      caution: String(data.caution || "").trim(),
      fromVision: true,
    };
  }

  function analyzeWithGemini(file, apiKey) {
    return fileToBase64(file).then(function (base64) {
      var mime = file.type || "image/jpeg";
      var url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        encodeURIComponent(apiKey);
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildGeminiBody(base64, mime)),
      }).then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            var msg = body.error?.message || res.statusText || "Gemini 요청 실패";
            throw new Error(msg);
          }
          var parts = body.candidates?.[0]?.content?.parts || [];
          var text = parts.map(function (p) {
            return p.text || "";
          }).join("");
          return parseGeminiJson(text);
        });
      });
    });
  }

  function analyzeImage(file) {
    var key = S.loadApiKey();
    if (!key || key.length < 20) {
      return Promise.resolve(mockAnalysis());
    }
    return analyzeWithGemini(file, key).catch(function (err) {
      console.warn("Gemini analysis failed", err);
      var m = mockAnalysis();
      m.traits = "Gemini 분석 실패: " + (err.message || err) + " — 기본 문구로 저장할 수 있습니다.";
      return m;
    });
  }

  global.TodayShoesAnalysis = {
    mockAnalysis: mockAnalysis,
    analyzeImage: analyzeImage,
  };
})(window);
