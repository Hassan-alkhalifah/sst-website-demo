/* Three-step enquiry builder. Draft data stays in memory; sending is user-controlled. */
(() => {
  'use strict';
  const products = window.SST_PRODUCTS || [];
  const ar = () => document.documentElement.lang === 'ar';
  const text = (en, arabic) => ar() ? arabic : en;
  const bi = (en, arabic) => `<span data-lang-only="en">${en}</span><span data-lang-only="ar">${arabic}</span>`;
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  let selected = products[0]?.id || 'hoses';
  let step = 0;
  let opener;
  const dialog = document.createElement('dialog');
  dialog.className = 'enquiry-dialog';
  dialog.setAttribute('aria-labelledby', 'enquiry-title');
  dialog.innerHTML = `<div class="enquiry-head"><div><span class="kicker">${bi('LET’S FIND YOUR SOLUTION', 'لنجد الحل المناسب لك')}</span><h2 id="enquiry-title">${bi('Build your enquiry', 'جهّز استفسارك')}</h2></div><button type="button" class="dialog-close" data-close aria-label="Close enquiry">×</button></div><div class="enquiry-body"><div class="enquiry-progress" aria-hidden="true"><span></span><span></span><span></span></div><section data-step="0"><h3 class="enquiry-step-title" tabindex="-1">${bi('01 / What can we help with?', '01 / كيف يمكننا مساعدتك؟')}</h3><p class="enquiry-description">${bi('Choose a product range to get started. You can describe service or custom requirements in the next step.', 'اختر مجموعة منتجات للبدء. يمكنك وصف احتياجات الخدمة أو التصنيع المخصّص في الخطوة التالية.')}</p><div class="category-options">${products.map(p => `<button class="category-option" type="button" data-category="${p.id}" aria-pressed="false">${icon(p.icon)}${bi(p.en, p.ar)}</button>`).join('')}</div><div class="enquiry-controls"><small>${bi('A simple, 3-step enquiry', 'استفسار بسيط في 3 خطوات')}</small><button class="btn btn--accent" data-next type="button">${bi('Continue', 'متابعة')}${icon('arrow')}</button></div></section><section data-step="1" hidden><h3 class="enquiry-step-title" tabindex="-1">${bi('02 / Tell us what you need', '02 / أخبرنا بما تحتاجه')}</h3><p class="enquiry-description">${bi('Add the details that matter. Fields marked * are required.', 'أضف التفاصيل المهمة. الحقول المعلّمة بـ * مطلوبة.')}</p><form id="enquiry-form"><div class="enquiry-row"><div class="field"><label for="q-name">${bi('Your name *', 'اسمك *')}</label><input id="q-name" name="name" required autocomplete="name" maxlength="100"></div><div class="field"><label for="q-email">${bi('Work email *', 'بريد العمل *')}</label><input id="q-email" name="email" type="email" required autocomplete="email" maxlength="150"></div></div><div class="enquiry-row"><div class="field"><label for="q-company">${bi('Company', 'الشركة')}</label><input id="q-company" name="company" autocomplete="organization" maxlength="150"></div><div class="field"><label for="q-urgency">${bi('Timeline', 'الإطار الزمني')}</label><select id="q-urgency" name="urgency"><option value="Planning">${text('Planning ahead', 'تخطيط مسبق')}</option><option value="This month">${text('This month', 'خلال هذا الشهر')}</option><option value="Urgent">${text('Urgent requirement', 'احتياج عاجل')}</option></select></div></div><div class="field"><label for="q-details">${bi('Your requirement *', 'متطلباتك *')}</label><textarea id="q-details" name="details" required maxlength="2500"></textarea></div><p class="prototype-note">${bi('This demo prepares a draft. Nothing is submitted automatically. For an emergency, call +966 54 769 9688.', 'يُجهّز هذا العرض مسودة فقط، ولا يُرسل أي شيء تلقائيًا. للطوارئ، اتصل على +966 54 769 9688.')}</p><div class="enquiry-controls"><button class="btn btn--outline" type="button" data-back>${bi('Back', 'رجوع')}</button><button class="btn btn--accent" type="submit">${bi('Review enquiry', 'مراجعة الاستفسار')}${icon('arrow')}</button></div></form></section><section data-step="2" hidden><div class="review-success">${icon('check')}</div><h3 class="enquiry-step-title" tabindex="-1">${bi('Your enquiry is ready.', 'استفسارك جاهز.')}</h3><p class="enquiry-description">${bi('Review your details, then open your email app to send the draft to SST. You can also save a copy.', 'راجع التفاصيل، ثم افتح تطبيق البريد لإرسال المسودة إلى الحلول البسيطة. يمكنك أيضًا حفظ نسخة.')}</p><pre class="enquiry-review"></pre><p class="prototype-note">${bi('Prepared locally · Not sent · Email opens in your own mail app', 'أُعدّ محليًا · لم يُرسل · يُفتح البريد في تطبيقك')}</p><div class="enquiry-controls"><button class="btn btn--outline" type="button" data-back>${bi('Edit details', 'تعديل التفاصيل')}</button><a class="btn btn--accent" data-email>${bi('Open email draft', 'فتح مسودة البريد')}${icon('arrow')}</a></div><button type="button" class="text-link" data-download style="margin-top:22px;background:none">${bi('Download a copy', 'تنزيل نسخة')}</button><p class="dialog-feedback" role="status"></p></section></div>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  function select(id) {
    selected = products.some(p => p.id === id) ? id : selected;
    dialog.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === selected)));
  }
  function draft() {
    const data = new FormData(form);
    const p = products.find(item => item.id === selected);
    const timeline = { Planning: text('Planning ahead', 'تخطيط مسبق'), 'This month': text('This month', 'خلال هذا الشهر'), Urgent: text('Urgent requirement', 'احتياج عاجل') };
    return `${text('SST — Product enquiry', 'الحلول البسيطة — استفسار عن المنتجات')}\n\n${text('Product range', 'مجموعة المنتجات')}: ${ar() ? p.ar : p.en}\n${text('Name', 'الاسم')}: ${data.get('name')}\n${text('Email', 'البريد الإلكتروني')}: ${data.get('email')}\n${text('Company', 'الشركة')}: ${data.get('company') || '—'}\n${text('Timeline', 'الإطار الزمني')}: ${timeline[data.get('urgency')]}\n\n${text('Requirement', 'المتطلبات')}:\n${data.get('details')}`;
  }
  function show(index, focus = true) {
    step = index;
    dialog.querySelectorAll('[data-step]').forEach(section => { section.hidden = Number(section.dataset.step) !== index; });
    dialog.querySelectorAll('.enquiry-progress span').forEach((item, i) => item.classList.toggle('active', i <= index));
    if (index === 2) {
      const body = draft();
      dialog.querySelector('.enquiry-review').textContent = body;
      const product = products.find(p => p.id === selected);
      dialog.querySelector('[data-email]').href = `mailto:Sales@sst-sa.com?subject=${encodeURIComponent(`SST enquiry — ${product.en}`)}&body=${encodeURIComponent(body)}`;
      dialog.querySelector('.dialog-feedback').textContent = '';
    }
    if (focus) dialog.querySelector(`[data-step="${index}"] .enquiry-step-title`).focus();
    dialog.scrollTop = 0;
  }
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-enquiry]');
    if (!trigger) return;
    event.preventDefault();
    opener = trigger;
    select(trigger.dataset.enquiry || selected);
    show(0, false);
    dialog.showModal();
    dialog.querySelector('[data-close]').focus();
  });
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-close')) dialog.close();
    if (button.dataset.category) select(button.dataset.category);
    if (button.hasAttribute('data-next')) show(1);
    if (button.hasAttribute('data-back')) show(Math.max(0, step - 1));
    if (button.hasAttribute('data-download')) {
      window.SST_DOWNLOAD(draft(), 'SST-enquiry.txt');
      dialog.querySelector('.dialog-feedback').textContent = text('Your copy is downloaded. Your enquiry has not been sent.', 'تم تنزيل نسختك. لم يُرسل الاستفسار.');
    }
  });
  form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity()) show(2); });
  dialog.addEventListener('close', () => {
    const visibleOpener = opener?.isConnected && opener.getClientRects().length && getComputedStyle(opener).visibility !== 'hidden';
    if (visibleOpener) opener.focus();
    else document.querySelector('.nav-toggle')?.focus();
  });
  function localize() {
    dialog.querySelector('[data-close]').setAttribute('aria-label', text('Close enquiry', 'إغلاق الاستفسار'));
    const labels = ar() ? ['تخطيط مسبق', 'خلال هذا الشهر', 'احتياج عاجل'] : ['Planning ahead', 'This month', 'Urgent requirement'];
    [...form.elements.urgency.options].forEach((option, i) => { option.textContent = labels[i]; });
    form.elements.details.placeholder = text('Application, quantity, dimensions, pressure rating or repair needs…', 'التطبيق والكمية والأبعاد والضغط المطلوب أو احتياجات الإصلاح…');
    if (step === 2) show(2, false);
  }
  document.addEventListener('sst:langchange', localize);
  select(selected); localize();
  window.SST_DOWNLOAD = (content, filename) => {
    const url = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();
