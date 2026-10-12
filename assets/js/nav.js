/* ==========================================================================
   nav.js — Header behavior: sticky shadow, mobile menu, accessible dropdowns,
   scroll-reveal, dynamic year. Vanilla, no dependencies.
   ========================================================================== */
(function () {
  "use strict";

  document.documentElement.classList.remove("no-js");

  var header   = document.querySelector(".site-header");
  var toggle   = document.querySelector(".nav-toggle");
  var nav      = document.querySelector(".nav");
  var backdrop = document.querySelector(".nav-backdrop");
  var DESKTOP  = "(min-width: 1041px)";

  /* ---- Sticky header shadow ---------------------------------------------- */
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- Mobile menu ------------------------------------------------------- */
  function setMenu(open) {
    if (!nav) return;
    nav.classList.toggle("is-open", open);
    if (backdrop) backdrop.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      setMenu(!nav.classList.contains("is-open"));
    });
  }
  if (backdrop) backdrop.addEventListener("click", function () { setMenu(false); });

  /* ---- Dropdowns (click/keyboard disclosure) ----------------------------- */
  var dropParents = document.querySelectorAll(".nav__item.has-dropdown > .nav__link");

  function closeAll(except) {
    document.querySelectorAll(".nav__item.has-dropdown.is-open").forEach(function (item) {
      if (item === except) return;
      item.classList.remove("is-open");
      var t = item.querySelector(":scope > .nav__link");
      if (t) t.setAttribute("aria-expanded", "false");
    });
  }

  dropParents.forEach(function (trigger) {
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");
    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      var item = trigger.parentElement;
      var willOpen = !item.classList.contains("is-open");
      closeAll(item);
      item.classList.toggle("is-open", willOpen);
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav__item.has-dropdown")) closeAll(null);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var expanded = document.querySelector('.has-dropdown.is-open > .nav__link');
      var menuWasOpen = nav && nav.classList.contains('is-open');
      closeAll(null); setMenu(false);
      if (!document.querySelector('dialog[open]')) {
        if (menuWasOpen && toggle) toggle.focus();
        else if (expanded) expanded.focus();
      }
    }
    if (e.key === 'Tab' && nav && nav.classList.contains('is-open')) {
      var items = Array.from(header.querySelectorAll('a,button')).filter(function (el) {
        return el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
      });
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items[items.length - 1].focus(); }
      if (!e.shiftKey && document.activeElement === items[items.length - 1]) { e.preventDefault(); items[0].focus(); }
    }
  });
  if (nav) nav.addEventListener('click', function (event) {
    if (event.target.closest('a,[data-enquiry]')) setMenu(false);
  });

  /* ---- Reset on resize to desktop ---------------------------------------- */
  window.addEventListener("resize", function () {
    if (window.matchMedia(DESKTOP).matches) { setMenu(false); }
  });

  /* ---- Reveal on scroll -------------------------------------------------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---- Dynamic year ------------------------------------------------------ */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---- Logo fallback: show the brand name if its logo file is missing ----
     Cards/items use <img data-logo>; drop an official PNG into
     assets/img/logos/<name>.png and it appears automatically. */
  function logoFallback(img) {
    var card = img.closest(".logo-card");
    if (card) {
      card.classList.add("logo-card--text");
      var box = img.closest(".logo-card__img");
      (box || img).remove();
      return;
    }
    var item = img.closest(".client-logos__item");
    if (item) {
      var span = document.createElement("span");
      span.className = "client-logos__text";
      span.textContent = img.getAttribute("alt") || "";
      img.replaceWith(span);
    }
  }
  document.querySelectorAll("img[data-logo]").forEach(function (img) {
    img.addEventListener("error", function () { logoFallback(img); });
    if (img.complete && img.naturalWidth === 0) logoFallback(img);
  });
})();
