(function () {
  "use strict";

  var grid = document.getElementById("grid");
  var empty = document.getElementById("empty");
  var result = document.getElementById("result");
  var progress = document.getElementById("progress");
  var progressBar = document.getElementById("progress-bar");
  var progressText = document.getElementById("progress-text");
  var selectedCount = document.getElementById("selected-count");
  var pageTitle = document.getElementById("page-title");
  var pageSource = document.getElementById("page-source");
  var downloadBtn = document.getElementById("btn-download");
  var inExtension = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;

  var DEMO_IMAGES = [
    { url: "demo/a.png", width: 800, height: 600, source: "demo" },
    { url: "demo/b.png", width: 640, height: 640, source: "demo" },
    { url: "demo/c.png", width: 900, height: 700, source: "demo" },
    { url: "demo/d.png", width: 720, height: 720, source: "demo" }
  ];

  function cards() {
    return Array.prototype.slice.call(grid.querySelectorAll(".card"));
  }

  function updateCount() {
    var selected = cards().filter(function (card) {
      return card.querySelector("input").checked;
    }).length;
    selectedCount.textContent = "已选 " + selected;
    downloadBtn.disabled = selected === 0;
  }

  function renderImages(payload) {
    var images = (payload && payload.images) || [];
    grid.innerHTML = "";
    result.hidden = true;
    if (!images.length) {
      empty.hidden = false;
      updateCount();
      return;
    }
    empty.hidden = true;
    pageTitle.textContent = (payload.pageTitle || "商品图片").slice(0, 80);
    pageSource.textContent = payload.pageUrl || "";

    images.forEach(function (item, index) {
      var card = document.createElement("article");
      card.className = "card";
      card.dataset.url = item.url;
      card.innerHTML =
        '<div class="thumb"><img alt="商品图 ' +
        (index + 1) +
        '" /></div>' +
        '<div class="meta"><label><input type="checkbox" checked /> 图 ' +
        String(index + 1).padStart(3, "0") +
        "</label><span class=\"size\">测量中</span></div>";
      grid.appendChild(card);
      loadThumb(card.querySelector("img"), card.querySelector(".size"), item);
    });
    updateCount();
  }

  function loadThumb(img, sizeEl, item) {
    var url = item.url;
    var applySize = function (w, h) {
      if (w && h && (w < 100 || h < 100)) {
        img.closest(".card").remove();
        updateCount();
        if (!cards().length) empty.hidden = false;
        return;
      }
      sizeEl.textContent = w && h ? w + " × " + h : "尺寸未知";
    };

    if (inExtension) {
      fetch(url)
        .then(function (res) {
          if (!res.ok) throw new Error("bad status");
          return res.blob();
        })
        .then(function (blob) {
          var objectUrl = URL.createObjectURL(blob);
          img.onload = function () {
            applySize(img.naturalWidth, img.naturalHeight);
          };
          img.onerror = function () {
            applySize(item.width, item.height);
          };
          img.src = objectUrl;
        })
        .catch(function () {
          img.src = url;
          img.onload = function () {
            applySize(img.naturalWidth, img.naturalHeight);
          };
          img.onerror = function () {
            applySize(item.width, item.height);
            sizeEl.textContent = "无法预览";
          };
        });
      return;
    }

    img.src = url;
    img.onload = function () {
      applySize(img.naturalWidth, img.naturalHeight);
    };
    img.onerror = function () {
      applySize(item.width, item.height);
    };
  }

  document.getElementById("btn-all").addEventListener("click", function () {
    cards().forEach(function (card) {
      card.querySelector("input").checked = true;
    });
    updateCount();
  });

  document.getElementById("btn-invert").addEventListener("click", function () {
    cards().forEach(function (card) {
      var box = card.querySelector("input");
      box.checked = !box.checked;
    });
    updateCount();
  });

  document.getElementById("btn-demo").addEventListener("click", function () {
    renderImages({
      images: DEMO_IMAGES,
      pageTitle: "布局预览",
      pageUrl: "file://gallery-demo"
    });
  });

  grid.addEventListener("change", updateCount);

  downloadBtn.addEventListener("click", function () {
    var urls = cards()
      .filter(function (card) {
        return card.querySelector("input").checked;
      })
      .map(function (card) {
        return card.dataset.url;
      });
    if (!urls.length) return;
    if (!inExtension) {
      result.hidden = false;
      result.className = "result is-error";
      result.textContent = "当前不在扩展环境中，无法调用 chrome.downloads。请从 Chrome 加载扩展后使用。";
      return;
    }

    downloadBtn.disabled = true;
    progress.hidden = false;
    result.hidden = true;
    progressBar.style.width = "0%";
    progressText.textContent = "开始下载 0 / " + urls.length;

    var port = chrome.runtime.connect({ name: "download" });
    port.onMessage.addListener(function (message) {
      if (message.type === "DOWNLOAD_PROGRESS") {
        var pct = Math.round((message.done / message.total) * 100);
        progressBar.style.width = pct + "%";
        progressText.textContent =
          (message.ok ? "已完成 " : "失败 ") +
          message.filename +
          "（" +
          message.done +
          " / " +
          message.total +
          "）";
      }
      if (message.type === "DOWNLOAD_DONE") {
        progressBar.style.width = "100%";
        result.hidden = false;
        result.className = message.failed ? "result is-error" : "result";
        result.textContent =
          "下载完成：成功 " +
          message.success +
          " 张，失败 " +
          message.failed +
          " 张。文件名为 商品图_001.png 起，保存在浏览器默认下载目录。";
        downloadBtn.disabled = false;
        port.disconnect();
      }
    });
    port.postMessage({ type: "DOWNLOAD_SELECTED", urls: urls });
  });

  if (inExtension) {
    chrome.runtime.sendMessage({ type: "GET_IMAGES" }, function (payload) {
      if (chrome.runtime.lastError || !payload || !payload.images || !payload.images.length) {
        empty.hidden = false;
        return;
      }
      renderImages(payload);
    });
  } else {
    empty.hidden = false;
  }

  updateCount();
})();
