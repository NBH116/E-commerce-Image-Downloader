/**
 * 图提取 ImageGrab 官网交互脚本
 * 1. 移动端汉堡菜单开关
 * 2. 吸顶导航滚动阴影
 * 3. 导航当前区块高亮（scroll spy）
 * 4. 滚动入场动画（IntersectionObserver）
 */

(function () {
  "use strict";

  // 标记 JS 可用，用于启用入场动画的初始隐藏态
  document.documentElement.classList.add("js");

  var navbar = document.getElementById("navbar");
  var hamburger = document.getElementById("hamburger");
  var nav = document.getElementById("nav");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));

  /* ---------- 1. 汉堡菜单 ---------- */
  function closeMenu() {
    navbar.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
  }

  hamburger.addEventListener("click", function () {
    var open = navbar.classList.toggle("open");
    hamburger.setAttribute("aria-expanded", String(open));
  });

  // 点击导航链接后收起菜单（移动端）
  navLinks.forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });

  /* ---------- 2. 吸顶导航阴影 ---------- */
  function onScrollShadow() {
    if (window.scrollY > 10) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  }
  onScrollShadow();
  window.addEventListener("scroll", onScrollShadow, { passive: true });

  /* ---------- 3. scroll spy：高亮当前区块 ---------- */
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute("href");
      if (!id || id.charAt(0) !== "#") return null;
      return document.querySelector(id);
    })
    .filter(Boolean);

  // 用 IntersectionObserver 判断哪个区块在视口中央
  var spy = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = "#" + entry.target.id;
        navLinks.forEach(function (link) {
          var isActive = link.getAttribute("href") === id;
          link.classList.toggle("active", isActive);
        });
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );

  sections.forEach(function (section) {
    spy.observe(section);
  });

  /* ---------- 4. 滚动入场动画 ---------- */
  var revealItems = document.querySelectorAll(".reveal");
  var revealObserver = new IntersectionObserver(
    function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target); // 只触发一次
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  revealItems.forEach(function (item) {
    revealObserver.observe(item);
  });
})();
