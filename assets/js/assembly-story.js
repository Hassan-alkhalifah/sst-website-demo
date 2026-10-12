/* Scroll is the timeline; nothing captures wheel or touch input. */
(function () {
  'use strict';
  const section = document.getElementById('engineering-in-motion');
  if (!section) return;
  const source = document.currentScript.src;
  const base = new URL('../', source);
  const stage = section.querySelector('.assembly-stage');
  const canvas = section.querySelector('canvas');
  const viewport = section.querySelector('.assembly-viewport');
  const frameElement = section.querySelector('.assembly-frame');
  const steps = Array.from(section.querySelectorAll('[data-assembly-step]'));
  const captions = Array.from(section.querySelectorAll('[data-assembly-caption]'));
  const toggle = section.querySelector('.assembly-toggle');
  const cutawayToggle = section.querySelector('.assembly-cutaway');
  const intro = section.querySelector('.assembly-intro');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  let scene = null, loading = false, failed = false, visible = false, paused = false;
  let cutaway = false;
  let target = 0, progress = 0, selected = -1, frame = 0, lastTime = 0;
  let pointer = {x:0,y:0}, targetPointer = {x:0,y:0};
  const clamp = n => Math.max(0, Math.min(1, n));
  let headerHeight = 120;
  const staticMode = () => reduced.matches || failed || innerHeight - headerHeight < (innerWidth <= 760 ? 620 : 560);
  const stagePositions = [0, .34, .70, 1];

  function updateLabels() {
    const arabic = document.documentElement.lang === 'ar';
    canvas.setAttribute('aria-label', arabic ? 'نموذج أسطوانة هيدروليكية يوضح العمود والمكبس وأختام المكبس ورأس الأسطوانة وصامولة التثبيت' : '3D hydraulic cylinder with a rod, piston, wear bands, gland seals and retaining nut');
    cutawayToggle.querySelector('[data-cutaway-label]').textContent = arabic ? (cutaway ? 'عرض الجسم الخارجي' : 'شاهد الداخل') : (cutaway ? 'Show exterior' : 'View inside');
    section.querySelector('.assembly-fallback').alt = arabic ? 'رسم توضيحي لتجميع أسطوانة هيدروليكية' : 'Illustrative hydraulic cylinder assembly';
    section.querySelector('.assembly-steps').setAttribute('aria-label', arabic ? 'مراحل التجميع الهيدروليكي' : 'Hydraulic assembly stages');
    toggle.setAttribute('aria-label', arabic ? (paused ? 'متابعة حركة التمرير' : 'إيقاف حركة التمرير') : (paused ? 'Resume scroll animation' : 'Pause scroll animation'));
    const hints = staticMode()
      ? ['Choose a stage to explore the hydraulic system.', 'اختر مرحلة لاستكشاف النظام الهيدروليكي.']
      : paused ? ['Animation paused. Resume whenever you’re ready.', 'الحركة متوقفة. تابع عندما تكون مستعدًا.']
        : ['Scroll to see a hydraulic system come together.', 'مرّر الصفحة لترى النظام الهيدروليكي يتكامل.'];
    intro.textContent = hints[arabic ? 1 : 0];
  }

  function showStep(value) {
    const next = Math.min(3, Math.floor(value * 4));
    if (next === selected) return;
    selected = next;
    captions.forEach((caption, i) => { caption.hidden = i !== next; });
    steps.forEach((button, i) => {
      if (i === next) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      button.classList.toggle('is-complete', i < next);
    });
    section.dataset.stage = String(next + 1);
  }

  function readScroll() {
    if (staticMode() || paused || !scene) return;
    const rect = section.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(section).getPropertyValue('--story-header')) || 0;
    target = clamp((top - rect.top) / Math.max(1, section.offsetHeight - stage.offsetHeight));
  }

  function tick(time) {
    frame = 0;
    if (!scene || !visible || document.hidden) { lastTime = 0; return; }
    const dt = lastTime ? Math.min(64, time - lastTime) : 16;
    lastTime = time;
    const ease = reduced.matches ? 1 : 1 - Math.exp(-dt / 85);
    progress += (target - progress) * ease;
    pointer.x += (targetPointer.x - pointer.x) * ease;
    pointer.y += (targetPointer.y - pointer.y) * ease;
    if (Math.abs(target - progress) < .0002) progress = target;
    showStep(progress);
    scene.setProgress(progress);
    scene.setPointer(pointer.x, pointer.y);
    scene.render();
    if (Math.abs(target - progress) > .0002 || Math.abs(targetPointer.x - pointer.x) + Math.abs(targetPointer.y - pointer.y) > .001) schedule();
    else lastTime = 0;
  }

  function schedule() {
    if (!frame && scene && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }

  // The layout owns the composition: hand the 3D camera the rectangle the
  // stylesheet reserves, expressed as fractions of the canvas.
  function applyFrame() {
    if (!scene || !frameElement) return;
    const canvasRect = viewport.getBoundingClientRect();
    const boxRect = frameElement.getBoundingClientRect();
    if (canvasRect.width < 1 || canvasRect.height < 1) return;
    scene.setFrame({
      x0: (boxRect.left - canvasRect.left) / canvasRect.width,
      y0: (boxRect.top - canvasRect.top) / canvasRect.height,
      x1: (boxRect.right - canvasRect.left) / canvasRect.width,
      y1: (boxRect.bottom - canvasRect.top) / canvasRect.height
    });
  }

  function resize() {
    const header = document.querySelector('.site-header');
    headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    section.style.setProperty('--story-header', headerHeight + 'px');
    section.classList.toggle('is-static', staticMode());
    if (scene) { scene.resize(viewport.clientWidth, viewport.clientHeight); applyFrame(); }
    if (reduced.matches || !fine.matches) targetPointer = {x:0,y:0};
    readScroll(); updateLabels(); schedule();
  }

  function loadScript(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(path, base).href;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load local 3D assets'));
      document.head.appendChild(script);
    });
  }

  function fallback() {
    failed = true;
    canvas.setAttribute('aria-hidden', 'true');
    section.classList.remove('is-ready');
    section.classList.add('is-static');
    if (scene) { scene.dispose(); scene = null; }
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    resize();
  }

  async function initialize() {
    if (loading || scene || failed) return;
    loading = true;
    try {
      await loadScript('vendor/three-0.186.0.min.js');
      await loadScript('js/hydraulic-scene.js?v=20260918-studio4');
      scene = window.SSTHydraulicScene.create(canvas);
      canvas.removeAttribute('aria-hidden');
      section.classList.add('is-ready');
      if (reduced.matches) target = progress = 1;
      resize();
      progress = target;
      showStep(progress);
      scene.setProgress(progress);
      scene.render();
    } catch (error) {
      fallback();
    }
  }

  steps.forEach((button, index) => {
    button.addEventListener('click', () => {
      target = stagePositions[index];
      if (staticMode() || paused || !scene) {
        progress = reduced.matches || !scene ? target : progress;
        if (reduced.matches || !scene) showStep(target);
        schedule();
      } else {
        const top = parseFloat(getComputedStyle(section).getPropertyValue('--story-header')) || 0;
        const y = scrollY + section.getBoundingClientRect().top - top + target * (section.offsetHeight - stage.offsetHeight);
        window.scrollTo({top:y, behavior:'smooth'});
      }
    });
  });

  toggle.addEventListener('click', () => {
    paused = !paused;
    toggle.setAttribute('aria-pressed', String(paused));
    if (paused) { target = progress; targetPointer = {x:0,y:0}; }
    else readScroll();
    updateLabels(); schedule();
  });
  cutawayToggle.addEventListener('click', () => {
    if (!scene) return;
    cutaway = !cutaway;
    cutawayToggle.setAttribute('aria-pressed', String(cutaway));
    scene.setCutaway(cutaway);
    updateLabels(); schedule();
  });
  stage.addEventListener('pointermove', event => {
    if (!fine.matches || reduced.matches || paused) return;
    const rect = stage.getBoundingClientRect();
    targetPointer = {x:(event.clientX - rect.left) / rect.width * 2 - 1,y:(event.clientY - rect.top) / rect.height * 2 - 1};
    schedule();
  }, {passive:true});
  stage.addEventListener('pointerleave', () => { targetPointer = {x:0,y:0}; schedule(); });
  window.addEventListener('scroll', () => { if (visible) { readScroll(); schedule(); } }, {passive:true});
  window.addEventListener('resize', resize, {passive:true});
  document.addEventListener('sst:langchange', () => { updateLabels(); resize(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
    else { readScroll(); schedule(); }
  });
  reduced.addEventListener('change', () => {
    paused = false; toggle.setAttribute('aria-pressed','false');
    if (reduced.matches) target = progress = 1;
    resize(); showStep(target);
  });
  fine.addEventListener('change', resize);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); });
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) { initialize(); readScroll(); schedule(); }
    else if (frame) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
  }, {rootMargin:'250px 0px'});
  observer.observe(section);
  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(stage);
  showStep(0); resize();
})();
