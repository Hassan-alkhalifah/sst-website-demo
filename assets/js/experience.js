/* Progressive enhancement: bilingual product explorer and visual catalogue. */
(() => {
  'use strict';
  const products = [
    { id: 'hoses', icon: 'layers', en: 'Hoses', ar: 'الخراطيم', title: ['Engineered to flow.', 'مصمّمة لتدوم.'], description: ['From hydraulic assemblies to industrial transfer lines. Precisely assembled hoses for the pressure, temperature and conditions your operation demands.', 'من التجميعات الهيدروليكية إلى خطوط النقل الصناعية. خراطيم مجمّعة بدقة لتلبية متطلبات الضغط والحرارة وظروف التشغيل.'], tags: [['Hydraulic', 'Industrial', 'Thermoplastic'], ['هيدروليكية', 'صناعية', 'حرارية']] },
    { id: 'seals', icon: 'oring', en: 'Seals & O-rings', ar: 'الأختام وحلقات O', title: ['Small parts. Big impact.', 'قطع صغيرة. أثر كبير.'], description: ['Precision sealing for reliable performance. Explore rod, piston, wiper and rotary seals, with O-rings and custom profiles for your application.', 'حلول إحكام دقيقة لأداء موثوق. اكتشف أختام القضبان والمكابس والكاشطات والأختام الدوّارة وحلقات O والمقاطع المخصّصة لتطبيقك.'], tags: [['Custom profiles', 'Rod & piston', 'O-rings'], ['مقاطع مخصّصة', 'قضبان ومكابس', 'حلقات O']] },
    { id: 'fittings', icon: 'fitting', en: 'Fittings', ar: 'الوصلات', title: ['Every connection counts.', 'كل اتصال يصنع الفارق.'], description: ['The right connection for your system. Fittings, adapters, valves and tubing in a range of materials and thread standards, matched to your specification.', 'الاتصال المناسب لنظامك. وصلات ومحوّلات وصمامات وأنابيب بخامات ومعايير قلاوظ متنوعة، وفق مواصفاتك.'], tags: [['Adapters & valves', 'Stainless steel', 'Custom assemblies'], ['محوّلات وصمامات', 'ستانلس ستيل', 'تجميعات مخصّصة']] },
    { id: 'cylinders', icon: 'cylinder', en: 'Cylinders', ar: 'الأسطوانات', title: ['Power in motion.', 'قوّة تُحرّك أعمالك.'], description: ['Hydraulic and pneumatic cylinders to move your operation forward. Supply, rebuilding and testing, supported by specialist maintenance expertise.', 'أسطوانات هيدروليكية وهوائية تدفع أعمالك إلى الأمام. توريد وإعادة بناء واختبار، مدعومة بخبرات صيانة متخصصة.'], tags: [['Hydraulic', 'Pneumatic', 'Rebuild & repair'], ['هيدروليكية', 'هوائية', 'إعادة بناء وإصلاح']] }
  ];
  window.SST_PRODUCTS = products;
  const ar = () => document.documentElement.lang === 'ar';
  const bi = (en, arabic) => `<span data-lang-only="en">${en}</span><span data-lang-only="ar">${arabic}</span>`;
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const tabs = document.getElementById('product-tabs');
  const stage = document.getElementById('product-stage');
  let active = 0;
  function showProduct(index, animate = true) {
    active = index;
    const p = products[index];
    tabs.querySelectorAll('[role="tab"]').forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    stage.setAttribute('aria-labelledby', `tab-${p.id}`);
    stage.innerHTML = `<div class="product-stage__image"><img src="assets/img/product-${p.id}.webp" alt="${ar() ? p.ar : p.en}" width="1500" height="1000" loading="lazy"></div><div class="product-stage__copy"><span class="kicker">${bi(p.en, p.ar)}</span><h3>${bi(...p.title)}</h3><p>${bi(...p.description)}</p><div class="product-tags">${p.tags[0].map((t, i) => `<span>${bi(t, p.tags[1][i])}</span>`).join('')}</div><div class="product-stage__actions"><a class="btn btn--accent" href="products-${p.id}.html">${bi('Explore range', 'استكشف المجموعة')}${icon('arrow')}</a><button class="text-link" type="button" data-enquiry="${p.id}">${bi('Add to enquiry', 'أضف إلى الاستفسار')}<span aria-hidden="true">+</span></button></div></div>`;
    if (animate) { stage.classList.remove('is-changing'); requestAnimationFrame(() => stage.classList.add('is-changing')); }
  }
  if (tabs && stage) {
    // Warm the four small, local photos so tab changes do not flash an empty frame.
    products.forEach(p => { const preload = new Image(); preload.src = `assets/img/product-${p.id}.webp`; });
    tabs.innerHTML = products.map((p, i) => `<button type="button" class="product-tab" id="tab-${p.id}" role="tab" aria-controls="product-stage" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}"><span class="tab-number">0${i + 1}</span>${bi(p.en, p.ar)}</button>`).join('');
    tabs.addEventListener('click', event => {
      const tab = event.target.closest('[role="tab"]');
      if (tab) showProduct([...tabs.children].indexOf(tab));
    });
    tabs.addEventListener('keydown', event => {
      let next = active;
      if (event.key === 'ArrowRight') next += ar() ? -1 : 1;
      else if (event.key === 'ArrowLeft') next += ar() ? 1 : -1;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = products.length - 1;
      else return;
      event.preventDefault();
      next = (next + products.length) % products.length;
      showProduct(next);
      tabs.children[next].focus();
    });
    showProduct(0, false);
  }
  const page = location.pathname.split('/').pop();
  const current = products.find(p => page === `products-${p.id}.html`);
  const pageHero = document.querySelector('.page-hero');
  const photoPages = { 'about.html': 'workshop-service', 'services.html': 'workshop-service', 'supply-chain.html': 'product-fittings', 'products.html': 'hero-hydraulics', 'careers.html': 'workshop-service' };
  if (pageHero && (current || photoPages[page])) {
    pageHero.classList.add('has-photo');
    const image = document.createElement('img');
    image.className = 'interior-photo';
    image.src = `assets/img/${current ? `product-${current.id}` : photoPages[page]}.webp`;
    image.alt = current ? `${current.en} — illustrative product photography` : 'Illustrative industrial photography';
    image.width = 1500; image.height = 1000;
    pageHero.querySelector('.page-hero__inner').append(image);
    if (current) pageHero.querySelector('.page-hero__inner').insertAdjacentHTML('beforeend', `<button class="btn btn--accent detail-enquiry" data-enquiry="${current.id}">${bi('Enquire about this range', 'استفسر عن هذه المجموعة')}${icon('arrow')}</button>`);
  }
  const catalogue = page === 'products.html' ? document.querySelector('.grid--2') : null;
  let filterCatalogue = () => {};
  if (catalogue) {
    catalogue.before(Object.assign(document.createElement('div'), { className: 'catalog-search', innerHTML: `<label for="product-search">${bi('Find a component', 'ابحث عن مكوّن')}</label><input id="product-search" type="search" autocomplete="off"><span class="catalog-count" role="status"></span>` }));
    const empty = Object.assign(document.createElement('p'), { className: 'catalog-empty', hidden: true, innerHTML: bi('No matching range. Try “hose”, “seal”, “fitting” or “cylinder”.', 'لا توجد مجموعة مطابقة. جرّب خراطيم أو أختام أو وصلات أو أسطوانات.') });
    catalogue.after(empty);
    const cards = [...catalogue.querySelectorAll('a.feature-card')];
    cards.forEach((card, i) => {
      const p = products[i];
      card.insertAdjacentHTML('afterbegin', `<img class="catalog-image" src="assets/img/product-${p.id}.webp" alt="${p.en}" loading="lazy" width="1500" height="1000">`);
    });
    filterCatalogue = () => {
      const search = document.getElementById('product-search');
      search.placeholder = ar() ? 'خراطيم، أختام، وصلات...' : 'Hoses, seals, fittings…';
      const q = search.value.trim().toLocaleLowerCase();
      let visible = 0;
      cards.forEach(card => { card.hidden = !card.textContent.toLocaleLowerCase().includes(q); if (!card.hidden) visible++; });
      empty.hidden = visible > 0;
      document.querySelector('.catalog-count').textContent = ar() ? `${visible} مجموعات` : `${visible} ${visible === 1 ? 'range' : 'ranges'}`;
    };
    document.getElementById('product-search').addEventListener('input', filterCatalogue);
    filterCatalogue();
  }
  // Quote-specific calls to action open the builder; ordinary contact links keep their destination.
  document.querySelectorAll('.cta a[href="contact.html"]').forEach(link => {
    if (/quote|عرض سعر/i.test(link.textContent)) link.setAttribute('data-enquiry', current?.id || '');
  });
  document.addEventListener('sst:langchange', () => { if (tabs) showProduct(active, false); filterCatalogue(); });
})();
