/**
 * 商品图提取核心：可被 content script 与本地 mock 页共用。
 * 挂到 globalThis.ProductImageExtract，避免打包工具依赖。
 */
(function (root) {
  "use strict";

  var MIN_SIZE = 100;
  var SKIP_EXT = /\.(svg|ico|gif)(\?|$)/i;
  var SKIP_KEYWORD =
    /icon|logo|sprite|avatar|qrcode|emoticon|favicon|loading|placeholder|pixel|blank|spacer|badge|btn_|button/i;
  var SIZE_IN_NAME = /[_\/](\d{1,4})x(\d{1,4})(?:[._]|$)/i;
  var LAZY_ATTRS = [
    "src",
    "data-src",
    "data-lazy-src",
    "data-original",
    "data-ks-lazyload",
    "data-lazy-img",
    "data-lazyload-src",
    "data-img",
    "data-image",
    "data-url"
  ];

  function isProductDetailPage(loc) {
    loc = loc || root.location;
    var host = loc.hostname || "";
    var path = loc.pathname || "";
    var params = new URLSearchParams(loc.search || "");

    if (host.indexOf("taobao.com") !== -1) {
      if (/item\.htm/i.test(path) && params.get("id")) return true;
      if (/\/item\//i.test(path)) return true;
      return false;
    }
    if (host.indexOf("tmall.com") !== -1) {
      return /item\.htm/i.test(path);
    }
    if (host.indexOf("jd.com") !== -1) {
      if (/item\.jd\.com/i.test(host) && /\.html$/i.test(path)) return true;
      if (/item\.m\.jd\.com/i.test(host) && /\/product\//i.test(path)) return true;
      return false;
    }
    if (host.indexOf("pinduoduo.com") !== -1 || host.indexOf("yangkeduo.com") !== -1) {
      return /goods\.html/i.test(path) && !!params.get("goods_id");
    }
    return false;
  }

  function toAbsoluteUrl(raw, baseHref) {
    if (!raw || typeof raw !== "string") return "";
    var value = raw.trim().replace(/^['"]|['"]$/g, "");
    if (!value) return "";
    if (/^data:/i.test(value)) return "";
    if (/^blob:/i.test(value)) return "";
    if (/^javascript:/i.test(value)) return "";
    try {
      var url = new URL(value, baseHref || root.location.href);
      if (url.protocol === "http:") url.protocol = "https:";
      if (url.protocol !== "https:") return "";
      return url.href;
    } catch (err) {
      return "";
    }
  }

  function pickLargestFromSrcset(srcset, baseHref) {
    if (!srcset) return "";
    var best = { url: "", width: -1 };
    srcset.split(",").forEach(function (part) {
      var bits = part.trim().split(/\s+/);
      var url = toAbsoluteUrl(bits[0], baseHref);
      if (!url) return;
      var descriptor = bits[1] || "1x";
      var width = 1;
      if (/w$/i.test(descriptor)) width = parseInt(descriptor, 10) || 1;
      else if (/x$/i.test(descriptor)) width = Math.round(parseFloat(descriptor) * 1000);
      if (width >= best.width) {
        best = { url: url, width: width };
      }
    });
    return best.url;
  }

  function upgradeImageUrl(href) {
    if (!href) return href;
    try {
      var url = new URL(href);
      var path = url.pathname;

      path = path.replace(/_\d+x\d+(q\d+)?\.(jpg|jpeg|png|webp)$/i, "");
      path = path.replace(/_\.webp$/i, "");
      path = path.replace(/\.jpg_\d+x\d+q\d+\.jpg$/i, ".jpg");
      path = path.replace(/\/s\d+x\d+_jfs\//i, "/s800x800_jfs/");

      url.pathname = path;
      return url.href;
    } catch (err) {
      return href;
    }
  }

  function dedupeKey(href) {
    try {
      var url = new URL(href);
      ["t", "timestamp", "time", "_t", "cache"].forEach(function (key) {
        url.searchParams.delete(key);
      });
      url.hash = "";
      return url.origin + url.pathname + url.search;
    } catch (err) {
      return href;
    }
  }

  function shouldSkipUrl(href) {
    if (!href) return true;
    if (SKIP_EXT.test(href)) return true;
    if (SKIP_KEYWORD.test(href)) return true;
    var match = href.match(SIZE_IN_NAME);
    if (match) {
      var w = parseInt(match[1], 10);
      var h = parseInt(match[2], 10);
      if (w > 0 && h > 0 && (w < MIN_SIZE || h < MIN_SIZE)) return true;
    }
    return false;
  }

  function pushCandidate(bucket, seen, raw, extra) {
    extra = extra || {};
    var href = upgradeImageUrl(toAbsoluteUrl(raw, extra.baseHref));
    if (shouldSkipUrl(href)) return;
    var key = dedupeKey(href);
    if (seen.has(key)) return;
    seen.add(key);
    bucket.push({
      url: href,
      width: extra.width || 0,
      height: extra.height || 0,
      source: extra.source || "unknown"
    });
  }

  function collectFromImg(doc, bucket, seen) {
    var images = doc.querySelectorAll("img");
    images.forEach(function (img) {
      // 只用解码后的自然尺寸过滤。布局宽高常是懒加载占位，不能当商品图尺寸。
      var width = img.naturalWidth || 0;
      var height = img.naturalHeight || 0;
      if (width && height && (width < MIN_SIZE || height < MIN_SIZE)) return;

      var srcsetUrl = pickLargestFromSrcset(img.getAttribute("srcset") || img.getAttribute("data-srcset"));
      if (srcsetUrl) {
        pushCandidate(bucket, seen, srcsetUrl, {
          width: width,
          height: height,
          source: "srcset"
        });
      }

      LAZY_ATTRS.forEach(function (attr) {
        var value = img.getAttribute(attr);
        if (value) {
          pushCandidate(bucket, seen, value, {
            width: width,
            height: height,
            source: attr
          });
        }
      });

      if (img.currentSrc) {
        pushCandidate(bucket, seen, img.currentSrc, {
          width: width,
          height: height,
          source: "currentSrc"
        });
      }
    });
  }

  function collectFromBackground(doc, bucket, seen) {
    var nodes = doc.querySelectorAll("*");
    var limit = Math.min(nodes.length, 2500);
    for (var i = 0; i < limit; i++) {
      var node = nodes[i];
      var bg = "";
      try {
        bg = root.getComputedStyle(node).backgroundImage;
      } catch (err) {
        continue;
      }
      if (!bg || bg === "none") continue;
      var matches = bg.match(/url\(([^)]+)\)/g);
      if (!matches) continue;
      matches.forEach(function (chunk) {
        var inner = chunk.replace(/^url\(/, "").replace(/\)$/, "");
        pushCandidate(bucket, seen, inner, { source: "background" });
      });
    }
  }

  function collectProductImages(doc) {
    doc = doc || root.document;
    var bucket = [];
    var seen = new Set();
    collectFromImg(doc, bucket, seen);
    collectFromBackground(doc, bucket, seen);
    return bucket;
  }

  root.ProductImageExtract = {
    MIN_SIZE: MIN_SIZE,
    isProductDetailPage: isProductDetailPage,
    collectProductImages: collectProductImages,
    upgradeImageUrl: upgradeImageUrl,
    toAbsoluteUrl: toAbsoluteUrl
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
