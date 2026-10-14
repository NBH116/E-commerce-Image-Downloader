/**
 * 详情页注入悬浮按钮，提取商品图后交给 service worker。
 */
(function () {
  "use strict";

  var extract = globalThis.ProductImageExtract;
  if (!extract || !extract.isProductDetailPage(location)) return;
  if (document.getElementById("eid-extract-btn")) return;

  var BUTTON_ID = "eid-extract-btn";

  function setBusy(button, busy) {
    button.disabled = busy;
    button.textContent = busy ? "提取中…" : "获取图片";
    button.classList.toggle("is-busy", busy);
  }

  function extractAndSend(button) {
    setBusy(button, true);
    try {
      var images = extract.collectProductImages(document);
      if (!images.length) {
        setBusy(button, false);
        button.classList.add("is-empty");
        button.textContent = "未找到图片";
        setTimeout(function () {
          button.classList.remove("is-empty");
          button.textContent = "获取图片";
        }, 1800);
        return;
      }

      chrome.runtime.sendMessage(
        {
          type: "EXTRACTED_IMAGES",
          images: images,
          pageTitle: document.title || "",
          pageUrl: location.href
        },
        function () {
          setBusy(button, false);
          if (chrome.runtime.lastError) {
            button.textContent = "发送失败";
            setTimeout(function () {
              button.textContent = "获取图片";
            }, 1800);
          }
        }
      );
    } catch (err) {
      setBusy(button, false);
      button.textContent = "提取失败";
      setTimeout(function () {
        button.textContent = "获取图片";
      }, 1800);
    }
  }

  function mountButton() {
    var button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "eid-extract-btn";
    button.textContent = "获取图片";
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      extractAndSend(button);
    });
    document.documentElement.appendChild(button);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountButton, { once: true });
  } else {
    mountButton();
  }
})();
