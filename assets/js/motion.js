/* Progressive motion enhancement. No external libraries or continuous idle loop. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const spatial = matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let frameId = 0;
  let previousTime = 0;
  let geometryDirty = true;
  let revealObserver;
  let depthObserver;

  // The image remains a normal local photo when motion is disabled or unsupported.
  const layers = [...document.querySelectorAll('.showcase__visual, .service-photo')]
    .map(element => {
      element.classList.add('motion-frame');
      return { element, visible: false, hero: element.classList.contains('showcase__visual'),
        x: 0, y: 0, scroll: 0, targetX: 0, targetY: 0, targetScroll: 0 };
    });

  function active() { return !reduced.matches && spatial.matches && !document.hidden; }
  function requestFrame() {
    if (!frameId && active()) frameId = requestAnimationFrame(render);
  }

  function render(time) {
    frameId = 0;
    if (!active()) return;
    // Time-based interpolation keeps the same weight at 60Hz and 120Hz.
    const delta = previousTime ? Math.min(time - previousTime, 48) : 16;
    previousTime = time;
    const ease = 1 - Math.exp(-delta / 95);
    if (geometryDirty) {
      const viewportHeight = innerHeight;
      layers.forEach(layer => {
        if (!layer.visible) return;
        const bounds = layer.element.getBoundingClientRect();
        const progress = (viewportHeight / 2 - bounds.top - bounds.height / 2) / (viewportHeight / 2 + bounds.height / 2);
        layer.targetScroll = clamp(progress, -1, 1) * (layer.hero ? 32 : 26);
      });
      geometryDirty = false;
    }
    let unsettled = false;
    layers.forEach(layer => {
      if (!layer.visible) return;
      for (const [value, target] of [['x', 'targetX'], ['y', 'targetY'], ['scroll', 'targetScroll']]) {
        const remaining = layer[target] - layer[value];
        layer[value] = Math.abs(remaining) < .03 ? layer[target] : layer[value] + remaining * ease;
        if (Math.abs(remaining) >= .03) unsettled = true;
      }
      const style = layer.element.style;
      style.setProperty('--depth-x', `${layer.x.toFixed(2)}px`);
      style.setProperty('--depth-y', `${layer.y.toFixed(2)}px`);
      style.setProperty('--scroll-depth', `${layer.scroll.toFixed(2)}px`);
      style.setProperty('--depth-rx', `${(-layer.y * .16).toFixed(2)}deg`);
      style.setProperty('--depth-ry', `${(layer.x * .16).toFixed(2)}deg`);
    });
    if (unsettled) requestFrame();
    else previousTime = 0;
  }

  layers.forEach(layer => {
    if (!layer.hero) return;
    layer.element.addEventListener('pointermove', event => {
      if (!active() || event.pointerType === 'touch') return;
      const bounds = layer.element.getBoundingClientRect();
      const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
      const y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
      layer.targetX = (x - .5) * 16;
      layer.targetY = (y - .5) * 12;
      layer.element.style.setProperty('--light-x', `${x * 100}%`);
      layer.element.style.setProperty('--light-y', `${y * 100}%`);
      layer.element.style.setProperty('--depth-light', '1');
      requestFrame();
    }, { passive: true });
    layer.element.addEventListener('pointerleave', () => {
      layer.targetX = 0;
      layer.targetY = 0;
      layer.element.style.setProperty('--depth-light', '0');
      requestFrame();
    });
  });

  function geometryChanged() { geometryDirty = true; requestFrame(); }
  addEventListener('scroll', geometryChanged, { passive: true });
  addEventListener('resize', geometryChanged, { passive: true });
  document.addEventListener('sst:langchange', geometryChanged);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; previousTime = 0; }
    else geometryChanged();
  });

  const revealTargets = [...document.querySelectorAll(
    '.section-top, .service-layout > div, .about-layout > div, .closing__inner > div, .closing__inner > button, .page-hero__inner > h1, .page-hero__inner > p'
  )];
  function syncPreference() {
    root.classList.toggle('motion-enabled', !reduced.matches);
    cancelAnimationFrame(frameId);
    frameId = 0;
    previousTime = 0;
    layers.forEach(layer => {
      layer.x = layer.y = layer.scroll = layer.targetX = layer.targetY = layer.targetScroll = 0;
      for (const property of ['--depth-x', '--depth-y', '--scroll-depth', '--depth-rx', '--depth-ry', '--depth-light']) {
        layer.element.style.removeProperty(property);
      }
    });
    if (reduced.matches) {
      revealTargets.forEach(element => element.classList.add('is-revealed'));
      revealObserver?.disconnect();
    }
    geometryChanged();
  }

  if ('IntersectionObserver' in window) {
    depthObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const layer = layers.find(item => item.element === entry.target);
        layer.visible = entry.isIntersecting;
        layer.element.classList.toggle('is-depth-visible', layer.visible);
        if (!layer.visible) { layer.targetX = 0; layer.targetY = 0; }
      });
      geometryChanged();
    }, { rootMargin: '40px' });
    layers.forEach(layer => depthObserver.observe(layer.element));
    if (!reduced.matches) {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: .12, rootMargin: '0px 0px -24px 0px' });
      revealTargets.forEach((element, index) => {
        element.classList.add('motion-reveal');
        element.style.setProperty('--reveal-delay', `${index % 2 * 85}ms`);
        revealObserver.observe(element);
      });
    }
  }
  reduced.addEventListener('change', syncPreference);
  spatial.addEventListener('change', syncPreference);
  syncPreference();
})();
