/* Honest local draft handling, with optional production data-endpoint. */
(() => {
  'use strict';
  const ar = () => document.documentElement.lang === 'ar';
  const t = (en, arabic) => ar() ? arabic : en;
  const bi = (en, arabic) => `<span data-lang-only="en">${en}</span><span data-lang-only="ar">${arabic}</span>`;
  document.querySelectorAll('form[data-form]').forEach(form => {
    const endpoint = form.dataset.endpoint;
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector('.form-status');
    const isApplication = !!form.elements.cv;
    if (!endpoint) {
      button.innerHTML = bi('Prepare email draft', 'تجهيز مسودة البريد');
      const note = document.createElement('p');
      note.className = 'prototype-note';
      note.innerHTML = bi('Demo: your details stay in this browser. Review a draft, then send it from your email app.', 'عرض تجريبي: تبقى بياناتك في هذا المتصفح. راجع المسودة ثم أرسلها من تطبيق البريد.');
      button.before(note);
    }
    // Native select options cannot reliably be hidden by CSS in every browser.
    const pairs = [];
    form.querySelectorAll('select').forEach(select => {
      const options = [...select.options];
      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        if (option.dataset.langOnly === 'en' && options[i + 1]?.dataset.langOnly === 'ar') {
          const arabic = options[++i];
          const english = option.textContent;
          option.value = option.getAttribute('value') ?? english;
          option.removeAttribute('data-lang-only');
          pairs.push({ option, english, arabic: arabic.textContent });
          arabic.remove();
        }
      }
    });
    const localize = () => pairs.forEach(pair => { pair.option.textContent = ar() ? pair.arabic : pair.english; });
    document.addEventListener('sst:langchange', localize); localize();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (form.elements.company_website?.value.trim()) return;
      if (!form.reportValidity()) return;
      if (endpoint) {
        button.disabled = true;
        try {
          const response = await fetch(endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
          if (!response.ok) throw new Error('Submission failed');
          status.className = 'form-status is-success';
          status.textContent = t('Your message has been sent. Thank you.', 'تم إرسال رسالتك. شكرًا لك.');
          form.reset();
        } catch {
          status.className = 'form-status is-error';
          status.textContent = t('Unable to send. Your details are still here. Please try again or contact SST directly.', 'تعذّر الإرسال. ما زالت بياناتك محفوظة هنا. حاول مجددًا أو تواصل مباشرةً مع الشركة.');
        } finally { button.disabled = false; }
        return;
      }
      const lines = [];
      for (const [key, value] of new FormData(form)) {
        if (key === 'company_website') continue;
        if (value instanceof File) { if (value.name) lines.push(`${t('CV to attach manually', 'السيرة الذاتية المطلوب إرفاقها يدويًا')}: ${value.name}`); continue; }
        const field = form.elements.namedItem(key);
        const label = field?.labels?.[0];
        const localized = label?.querySelector(`[data-lang-only="${ar() ? 'ar' : 'en'}"]`);
        const displayValue = field?.tagName === 'SELECT' ? field.selectedOptions[0]?.textContent : value;
        lines.push(`${localized?.textContent || key}: ${displayValue}`);
      }
      const subject = isApplication ? 'SST — Career application' : 'SST — Website enquiry';
      const body = `${subject}\n\n${lines.join('\n')}`;
      status.className = 'form-status is-success';
      status.replaceChildren();
      const message = document.createElement('p');
      message.textContent = t('Your draft is ready. Nothing has been sent.', 'مسودتك جاهزة. لم يتم إرسال أي شيء.');
      const preview = document.createElement('pre'); preview.className = 'enquiry-review'; preview.textContent = body;
      const actions = document.createElement('div'); actions.className = 'form-draft';
      const email = document.createElement('a'); email.className = 'btn btn--accent';
      email.href = `mailto:Sales@sst-sa.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      email.textContent = t('Open email draft', 'فتح مسودة البريد');
      const download = document.createElement('button'); download.type = 'button'; download.className = 'btn btn--outline';
      download.textContent = t('Download copy', 'تنزيل نسخة');
      download.addEventListener('click', () => window.SST_DOWNLOAD(body, isApplication ? 'SST-application.txt' : 'SST-message.txt'));
      actions.append(email, download); status.append(message, preview, actions);
      if (isApplication) { const note = document.createElement('p'); note.className = 'prototype-note'; note.textContent = t('Attach your CV manually in your email app. This demo does not upload files.', 'أرفق سيرتك الذاتية يدويًا في تطبيق البريد. هذا العرض لا يرفع الملفات.'); status.append(note); }
      status.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    });
  });
})();
