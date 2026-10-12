/* Demo build only: the home page is the one published page. Links to the other
   pages stay in place but show a short notice instead of leaving the page. */
(function () {
  'use strict';
  const strip = path => path.replace(/index\.html$/, '');

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.demo-toast{position:fixed;left:50%;bottom:24px;z-index:1300;max-width:calc(100% - 32px);padding:13px 20px;border-radius:6px;background:#171b2c;color:#fff;font:500 13px/1.5 Inter,Cairo,system-ui,sans-serif;box-shadow:0 18px 50px #171b2c40;text-align:center;' +
    'opacity:0;transform:translate(-50%,12px);pointer-events:none;transition:opacity .3s,transform .4s cubic-bezier(.2,.8,.2,1)}' +
    '.demo-toast.is-shown{opacity:1;transform:translate(-50%,0)}' +
    '</style>');

  // Created up front so screen readers already know the live region when it speaks.
  const toast = document.createElement('div');
  toast.className = 'demo-toast';
  toast.setAttribute('role', 'status');
  document.body.appendChild(toast);
  let timer = 0;

  function notice() {
    const arabic = document.documentElement.lang === 'ar';
    toast.textContent = arabic
      ? 'هذا العرض التجريبي يتضمن الصفحة الرئيسية فقط.'
      : 'This demo includes the home page only.';
    toast.classList.add('is-shown');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('is-shown'), 2800);
  }

  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const url = new URL(link.getAttribute('href'), location.href);
    // Partner sites, phone and email links keep working; so do links within the home page.
    if (url.origin !== location.origin || strip(url.pathname) === strip(location.pathname)) return;
    e.preventDefault();
    notice();
  }, true);
})();
