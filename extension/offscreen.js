chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (!message || !message.type) return;

  if (message.type === "CREATE_BLOB_URL") {
    var blob = new Blob([message.buffer], { type: message.mime || "image/png" });
    sendResponse({ url: URL.createObjectURL(blob) });
    return true;
  }

  if (message.type === "REVOKE_BLOB_URL" && message.url) {
    URL.revokeObjectURL(message.url);
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
