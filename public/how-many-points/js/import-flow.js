(function (global) {
  "use strict";
  var busy = false;

  function download(json) {
    var url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    var link = document.createElement("a");
    link.href = url;
    link.download = "how-many-points-before-import-" + Date.now() + ".json";
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  async function open(file, format, onDone) {
    if (busy || !file) return;
    busy = true;
    var dialog;
    var previousFocus = document.activeElement;
    try {
      var text = await file.text();
      var items;
      if (format === "csv") items = global.HowManyPointsWatchaImport.parseWatchaCsv(text);
      else {
        var data = JSON.parse(text);
        if (!data || (data.version !== undefined && data.version !== 1) || !Array.isArray(data.ratings)) throw new Error("평점 JSON 백업 형식이 아닙니다.");
        items = data.ratings;
      }
      var preview = await global.HowManyPointsDb.prepareImport(items, { format: format });
      dialog = document.createElement("dialog");
      dialog.className = "safe-import";
      dialog.setAttribute("aria-labelledby", "safe-import-title");
      dialog.innerHTML = '<h2 id="safe-import-title">' + (format === "csv" ? "왓챠 CSV" : "JSON") + ' 가져오기 미리보기</h2>' +
        '<p id="safe-import-summary"></p><p>기존 작품은 삭제하지 않습니다. 기본값은 기존 평점·리뷰와 나머지 정보 모두 유지입니다.</p>' +
        '<label class="safe-import-option"><input type="checkbox" id="safe-import-overwrite"> 중복 작품의 정보를 파일 값으로 덮어쓰기 (빈 평점·리뷰 포함)</label>' +
        '<p id="safe-import-status" role="status" aria-live="polite">병합 전에 현재 전체 데이터를 JSON으로 백업합니다.</p>' +
        '<label class="safe-import-option" id="safe-import-download-label" hidden><input type="checkbox" id="safe-import-downloaded"> 다운로드 폴더에서 JSON 백업 파일을 확인했습니다</label>' +
        '<div class="safe-import-actions"><button type="button" class="btn" id="safe-import-cancel" autofocus>취소</button>' +
        '<button type="button" class="btn" id="safe-import-backup">백업 저장</button>' +
        '<button type="button" class="btn btn--primary" id="safe-import-commit" disabled>확인 후 병합</button></div>';
      document.body.append(dialog);
      var find = function (id) { return dialog.querySelector("#safe-import-" + id); };
      var updateSummary = function () {
        find("summary").textContent = "신규 " + preview.added + "건 · 중복 " + preview.duplicates + "건 · 차이 있음 " + preview.changed +
          "건 · 변경 예정 " + preview.updated + "건 · 파일 내 반복 " + preview.repeated + "건 · 병합 후 총 " + preview.total + "건";
      };
      updateSummary();
      dialog.showModal();
      await new Promise(function (resolve) {
        var saving = false;
        var backedUp = false;
        var diskConfirmed = false;
        var previewRevision = 0;
        dialog.oncancel = function (event) { if (saving) event.preventDefault(); };
        dialog.onclose = resolve;
        find("cancel").onclick = function () { dialog.close(); };
        find("overwrite").onchange = async function () {
          var revision = ++previewRevision;
          find("backup").disabled = true;
          find("commit").disabled = true;
          try {
            var updated = await global.HowManyPointsDb.prepareImport(items, { format: format, overwrite: find("overwrite").checked });
            if (revision !== previewRevision) return;
            preview = updated;
            updateSummary();
            find("backup").disabled = false;
          } catch (error) { find("status").textContent = error.message; }
        };
        find("downloaded").onchange = function () { find("commit").disabled = !(backedUp && (diskConfirmed || find("downloaded").checked)); };
        find("backup").onclick = async function () {
          saving = true;
          find("backup").disabled = find("overwrite").disabled = find("cancel").disabled = true;
          try {
            var handle = global.showSaveFilePicker ? await global.showSaveFilePicker({ suggestedName: "how-many-points-before-import.json", types: [{ description: "JSON 백업", accept: { "application/json": [".json"] } }] }) : null;
            find("status").textContent = "전체 JSON 백업을 클라우드에 저장하는 중…";
            var json = await global.HowManyPointsDb.createImportBackup(preview);
            if (handle) {
              var writable = await handle.createWritable();
              await writable.write(json);
              await writable.close();
              diskConfirmed = true;
            } else {
              download(json);
              find("download-label").hidden = false;
            }
            backedUp = true;
            find("status").textContent = diskConfirmed ? "클라우드 백업과 파일 저장을 완료했습니다. 확인 후 병합하세요." : "클라우드 백업 완료. 브라우저는 다운로드 완료를 확인할 수 없습니다. 파일 확인란을 선택하세요.";
            find("commit").disabled = !diskConfirmed;
          } catch (error) {
            find("status").textContent = "백업을 완료하지 못해 가져오기를 중단했습니다. 기존 데이터는 유지됩니다. " + error.message;
            find("backup").disabled = false;
          } finally { saving = false; find("cancel").disabled = false; }
        };
        find("commit").onclick = async function () {
          if (!backedUp || !(diskConfirmed || find("downloaded").checked) || saving) return;
          saving = true;
          find("commit").disabled = find("cancel").disabled = find("downloaded").disabled = true;
          find("status").textContent = "병합 저장 중…";
          try {
            await global.HowManyPointsDb.commitImport(preview);
            find("status").textContent = "병합 완료: 총 " + preview.total + "건. 기존 데이터와 자동 백업을 보존했습니다.";
            find("cancel").textContent = "닫기";
            await onDone();
          } catch (error) {
            find("status").textContent = "병합 결과 확인 필요: " + error.message + " 오류가 발생한 DB 트랜잭션은 전체 취소됩니다. 통신이 끊겼다면 커밋 여부가 불명확할 수 있습니다. 새로 불러와 총건수를 확인한 뒤 파일을 다시 선택하세요. 자동 백업은 클라우드에 보존되어 있습니다.";
          } finally { saving = false; find("cancel").disabled = false; }
        };
      });
    } catch (error) { global.alert("가져오기를 시작하지 못했습니다. 기존 데이터는 유지됩니다. " + error.message); }
    finally {
      if (dialog) dialog.remove();
      busy = false;
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    }
  }

  function downloadLatestBackup() {
    var backups = global.PortalCloud.list("how-many-points-backups").sort(function (a, b) { return b.exportedAt.localeCompare(a.exportedAt); });
    if (!backups.length) { global.alert("자동 백업이 없습니다."); return; }
    download(JSON.stringify(backups[0], null, 2));
  }

  global.HowManyPointsImportFlow = { open: open, downloadLatestBackup: downloadLatestBackup };
})(window);
