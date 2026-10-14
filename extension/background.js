/**
 * Service worker：暂存提取结果、打开图库页、转换 PNG 并下载。
 */
const STORAGE_KEY = "extracted";
const DOWNLOAD_CONCURRENCY = 3;

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || !message.type) return;

  if (message.type === "EXTRACTED_IMAGES") {
    handleExtracted(message)
      .then(function () {
        sendResponse({ ok: true });
      })
      .catch(function (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      });
    return true;
  }

  if (message.type === "GET_IMAGES") {
    chrome.storage.session.get(STORAGE_KEY).then(function (data) {
      sendResponse(data[STORAGE_KEY] || null);
    });
    return true;
  }

  return false;
});

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name !== "download") return;
  port.onMessage.addListener(function (message) {
    if (!message || message.type !== "DOWNLOAD_SELECTED") return;
    downloadSelected(message.urls || [], port).catch(function (err) {
      port.postMessage({
        type: "DOWNLOAD_DONE",
        success: 0,
        failed: (message.urls || []).length,
        errors: [{ url: "", error: String(err && err.message ? err.message : err) }]
      });
    });
  });
});

async function handleExtracted(message) {
  await chrome.storage.session.set({
    [STORAGE_KEY]: {
      images: message.images || [],
      pageTitle: message.pageTitle || "",
      pageUrl: message.pageUrl || "",
      ts: Date.now()
    }
  });
  await chrome.tabs.create({
    url: chrome.runtime.getURL("gallery.html")
  });
}

async function downloadSelected(urls, port) {
  var total = urls.length;
  var success = 0;
  var failed = 0;
  var errors = [];

  await mapPool(urls, DOWNLOAD_CONCURRENCY, async function (url, index) {
    var filename = "商品图_" + String(index + 1).padStart(3, "0") + ".png";
    try {
      await convertAndDownload(url, filename);
      success += 1;
      port.postMessage({
        type: "DOWNLOAD_PROGRESS",
        done: success + failed,
        total: total,
        filename: filename,
        ok: true
      });
    } catch (err) {
      failed += 1;
      var error = String(err && err.message ? err.message : err);
      errors.push({ url: url, error: error });
      port.postMessage({
        type: "DOWNLOAD_PROGRESS",
        done: success + failed,
        total: total,
        filename: filename,
        ok: false,
        error: error
      });
    }
  });

  port.postMessage({
    type: "DOWNLOAD_DONE",
    success: success,
    failed: failed,
    errors: errors
  });
}

async function convertAndDownload(url, filename) {
  var response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error("拉取失败 " + response.status);
  }
  var blob = await response.blob();
  var bitmap = await createImageBitmap(blob);
  var canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  var ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  var pngBlob = await canvas.convertToBlob({ type: "image/png" });
  var downloadUrl = await blobToDownloadUrl(pngBlob);
  try {
    await chrome.downloads.download({
      url: downloadUrl,
      filename: filename,
      saveAs: false,
      conflictAction: "uniquify"
    });
  } finally {
    if (downloadUrl.indexOf("blob:") === 0) {
      await revokeBlobUrl(downloadUrl);
    }
  }
}

async function blobToDownloadUrl(blob) {
  try {
    await ensureOffscreen();
    var buffer = await blob.arrayBuffer();
    var result = await chrome.runtime.sendMessage({
      type: "CREATE_BLOB_URL",
      buffer: buffer,
      mime: "image/png"
    });
    if (result && result.url) return result.url;
  } catch (err) {
    // 退回 data URL，避免 offscreen 不可用时完全失败
  }
  return bufferToDataUrl(await blob.arrayBuffer());
}

async function revokeBlobUrl(url) {
  try {
    await chrome.runtime.sendMessage({ type: "REVOKE_BLOB_URL", url: url });
  } catch (err) {
    // ignore
  }
}

async function ensureOffscreen() {
  var contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"]
  });
  if (contexts && contexts.length) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["BLOBS"],
    justification: "为 PNG 下载创建 blob URL"
  });
}

function bufferToDataUrl(buffer) {
  var bytes = new Uint8Array(buffer);
  var binary = "";
  var chunk = 0x8000;
  for (var i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return "data:image/png;base64," + btoa(binary);
}

async function mapPool(items, limit, fn) {
  var cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      var index = cursor;
      cursor += 1;
      await fn(items[index], index);
    }
  }
  var workers = [];
  var count = Math.min(limit, items.length);
  for (var i = 0; i < count; i++) workers.push(worker());
  await Promise.all(workers);
}
