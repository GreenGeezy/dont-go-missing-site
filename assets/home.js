/* Don't Go Missing: home page interactions. No tracking, no external requests. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  var os = document.documentElement.getAttribute("data-os") || "desktop";

  /* ---------- Hero promo video ---------- */
  var video = document.getElementById("promo-video");
  var frame = document.getElementById("promo-frame");
  if (video && frame) {
    var soundBtn = frame.querySelector(".video-sound");
    var playBtn = frame.querySelector(".video-play");
    var bar = frame.querySelector(".video-progress span");
    var chapters = Array.prototype.slice.call(document.querySelectorAll(".video-chapters button"));
    var autoplay = !reduceMotion && !saveData;
    var userPaused = false;
    var visible = false;

    function tryPlay() {
      if (video.preload !== "auto") video.preload = "auto";
      var p = video.play();
      if (p && p.catch) {
        p.catch(function () {
          playBtn.hidden = false;
        });
      }
    }

    function setSound(on) {
      video.muted = !on;
      video.loop = !on;
      soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
      soundBtn.querySelector("span").textContent = on ? "Mute" : "Watch with sound";
    }

    if (!autoplay) playBtn.hidden = false;

    playBtn.addEventListener("click", function () {
      playBtn.hidden = true;
      userPaused = false;
      tryPlay();
    });

    soundBtn.addEventListener("click", function () {
      var turningOn = video.muted;
      setSound(turningOn);
      if (turningOn) {
        video.currentTime = 0;
        playBtn.hidden = true;
        userPaused = false;
        tryPlay();
      }
    });

    video.addEventListener("click", function () {
      if (video.paused) {
        userPaused = false;
        playBtn.hidden = true;
        tryPlay();
      } else {
        userPaused = true;
        video.pause();
        playBtn.hidden = false;
      }
    });

    // With sound on, play once and then go back to a silent loop.
    video.addEventListener("ended", function () {
      setSound(false);
      video.currentTime = 0;
      tryPlay();
    });

    chapters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        video.currentTime = parseFloat(btn.getAttribute("data-start")) + 0.05;
        userPaused = false;
        playBtn.hidden = true;
        tryPlay();
      });
    });

    function tick() {
      var d = video.duration || 30;
      var t = video.currentTime;
      bar.style.width = (Math.min(t / d, 1) * 100).toFixed(2) + "%";
      chapters.forEach(function (btn) {
        var a = parseFloat(btn.getAttribute("data-start"));
        var b = parseFloat(btn.getAttribute("data-end"));
        var on = t >= a && t < b && (t > 0 || !video.paused);
        btn.classList.toggle("is-active", on);
        if (on) btn.setAttribute("aria-current", "true");
        else btn.removeAttribute("aria-current");
      });
      if (!video.paused) requestAnimationFrame(tick);
    }
    video.addEventListener("play", function () {
      playBtn.hidden = true;
      requestAnimationFrame(tick);
    });
    video.addEventListener("seeked", tick);

    // Only play while the video is on screen; start loading after the page has loaded.
    function start() {
      if (!("IntersectionObserver" in window)) {
        if (autoplay) tryPlay();
        return;
      }
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && autoplay && !userPaused) tryPlay();
        else if (!visible && !video.paused) video.pause();
      }, { threshold: 0.35 }).observe(frame);
    }
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) video.pause();
      else if (visible && autoplay && !userPaused) tryPlay();
    });
  }

  /* ---------- "How it works" showcase (tabs with real app screens) ---------- */
  var showcase = document.querySelector("[data-showcase]");
  if (showcase) {
    var tabs = Array.prototype.slice.call(showcase.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
    var current = 0;
    var timer = null;
    var STEP_MS = 5000;
    var stopped = reduceMotion;
    var caption = showcase.querySelector(".showcase-caption");

    showcase.style.setProperty("--showcase-ms", STEP_MS + "ms");

    function select(i, focus) {
      current = (i + tabs.length) % tabs.length;
      tabs.forEach(function (t, k) {
        var on = k === current;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        panels[k].classList.toggle("is-active", on);
      });
      if (caption) {
        var t = tabs[current];
        caption.innerHTML = "<b>" + t.querySelector("b").textContent + "</b>" + t.querySelector("small").textContent;
      }
      if (focus) tabs[current].focus();
      // Restart the progress line animation on the selected tab.
      if (showcase.classList.contains("is-auto")) {
        showcase.classList.remove("is-auto");
        void showcase.offsetWidth;
        showcase.classList.add("is-auto");
      }
    }

    function stopAuto() {
      stopped = true;
      clearInterval(timer);
      timer = null;
      showcase.classList.remove("is-auto");
    }

    function runAuto(on) {
      if (stopped) return;
      if (on && !timer) {
        showcase.classList.add("is-auto");
        select(current);
        timer = setInterval(function () { select(current + 1); }, STEP_MS);
      } else if (!on && timer) {
        clearInterval(timer);
        timer = null;
        showcase.classList.remove("is-auto");
      }
    }

    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () {
        stopAuto();
        select(i);
      });
      t.addEventListener("keydown", function (e) {
        var k = e.key;
        var next = k === "ArrowDown" || k === "ArrowRight" ? current + 1 :
          k === "ArrowUp" || k === "ArrowLeft" ? current - 1 :
          k === "Home" ? 0 : k === "End" ? tabs.length - 1 : null;
        if (next === null) return;
        e.preventDefault();
        stopAuto();
        select(next, true);
      });
    });

    select(0);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        runAuto(entries[0].isIntersecting);
      }, { threshold: 0.45 }).observe(showcase);
    }
  }

  /* ---------- Pricing: iPhone / Android toggle ---------- */
  var toggle = document.querySelector(".plat-toggle");
  if (toggle) {
    var platTabs = Array.prototype.slice.call(toggle.querySelectorAll('[role="tab"]'));
    var choose = function (plat, focus) {
      platTabs.forEach(function (b) {
        var on = b.getAttribute("data-plat") === plat;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        document.getElementById(b.getAttribute("aria-controls")).hidden = !on;
        if (on && focus) b.focus();
      });
    };
    platTabs.forEach(function (b) {
      b.addEventListener("click", function () { choose(b.getAttribute("data-plat")); });
      b.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          var other = platTabs.filter(function (x) { return x !== b; })[0];
          choose(other.getAttribute("data-plat"), true);
        }
      });
    });
    toggle.hidden = false;
    document.getElementById("pricing").classList.add("has-plat-toggle");
    choose(os === "android" ? "android" : "ios");
  }

  /* ---------- Floating mobile CTA: appears once the hero is out of view ---------- */
  var sticky = document.getElementById("sticky-cta");
  var hero = document.getElementById("top");
  if (sticky && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      sticky.classList.toggle("is-visible", !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);
  } else if (sticky) {
    sticky.classList.add("is-visible");
  }
})();
