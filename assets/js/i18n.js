/* ==========================================================================
   i18n.js — Bilingual EN/AR controller
   Content for both languages lives in the HTML (data-lang-only="en|ar").
   This script only flips <html lang/dir>, persists the choice, and keeps
   every language toggle's label in sync. No fetch, works from file://.
   A tiny inline snippet in <head> applies the saved language pre-paint
   to avoid a flash; this file wires up the interactive toggle.
   ========================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "sst-lang";
  var html = document.documentElement;

  function store(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
  }

  function apply(lang) {
    var isAr = lang === "ar";
    html.lang = isAr ? "ar" : "en";
    html.dir = isAr ? "rtl" : "ltr";

    // Each toggle shows the language it will switch TO.
    var toggles = document.querySelectorAll("[data-lang-switch]");
    for (var i = 0; i < toggles.length; i++) {
      var label = toggles[i].querySelector("[data-switch-label]");
      if (label) label.textContent = isAr ? "EN" : "العربية";
      toggles[i].setAttribute(
        "aria-label",
        isAr ? "Switch to English" : "التبديل إلى اللغة العربية"
      );
    }

    document.dispatchEvent(
      new CustomEvent("sst:langchange", { detail: { lang: lang } })
    );
  }

  // Sync label/state on load (language itself was applied pre-paint in <head>).
  apply(html.lang === "ar" ? "ar" : "en");

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-lang-switch]");
    if (!btn) return;
    e.preventDefault();
    var next = html.lang === "ar" ? "en" : "ar";
    store(next);
    apply(next);
  });
})();
