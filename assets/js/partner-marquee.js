/* Partner logo marquee. The track always travels right to left, in both languages.
   The deeper the pointer sits in either edge zone, the faster it runs; over the
   centre it slows so a logo can be picked out. Clone sets are hidden from screen
   readers and the tab order, so each partner is met once. Reduced motion leaves
   a plain horizontal scroller. */
(function () {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const BASE_SPEED = 44;   // px per second at rest
  const READ_SPEED = 12;   // pointer resting over the centre
  const TOP_SPEED = 420;   // pointer at the outermost edge
  const EDGE_SHARE = 0.2;  // share of the width that counts as an edge zone
  const EDGE_MAX = 280;    // px cap for that zone on wide screens
  const DRAG_THRESHOLD = 6;
  const MAX_FLING = 2600;
  const MAX_SKEW = 3.5;    // degrees of lean at top speed
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  document.querySelectorAll('[data-marquee]').forEach(setup);

  function setup(root) {
    const viewport = root.querySelector('.pm-viewport');
    const track = root.querySelector('.pm-track');
    const firstSet = track && track.querySelector('.pm-set');
    if (!viewport || !firstSet) return;

    let x = 0, speed = BASE_SPEED, target = BASE_SPEED, setWidth = 0;
    let frame = 0, last = 0, visible = false, focused = false;
    let drag = null, suppressClick = false, pointer = null, hot = null;

    firstSet.querySelectorAll('a, img').forEach(el => el.setAttribute('draggable', 'false'));

    const isStatic = () => root.classList.contains('is-static');

    // Clones stay clickable (inert would make them dead to the pointer) but are
    // removed from the accessibility tree and the tab order.
    function addClone() {
      const clone = firstSet.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('a').forEach(a => a.setAttribute('tabindex', '-1'));
      track.appendChild(clone);
    }

    // One set plus enough clones to cover the viewport while the first set slides out.
    function measure() {
      setWidth = firstSet.offsetWidth;
      if (!setWidth) return;
      const needed = 1 + Math.ceil(viewport.clientWidth / setWidth);
      while (track.children.length < needed) addClone();
      wrap();
      paint();
    }

    // While a logo holds keyboard focus the offset may sit briefly above zero; folding
    // it back would swap the focused logo for its hidden clone.
    function wrap() {
      if (!setWidth || focused) return;
      while (x <= -setWidth) x += setWidth;
      while (x > 0) x -= setWidth;
    }

    function paint() {
      if (isStatic()) return;
      // Lean into the direction of travel once the strip runs faster than its resting pace.
      const surplus = clamp((Math.abs(speed) - BASE_SPEED) / (TOP_SPEED - BASE_SPEED), 0, 1);
      const skew = surplus * MAX_SKEW * Math.sign(speed);
      track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0) skewX(' + skew.toFixed(2) + 'deg)';
    }

    function shouldRun() {
      if (!visible || isStatic()) return false;
      return !(focused && Math.abs(speed) < 0.5 && !drag);
    }

    function tick(now) {
      frame = 0;
      const dt = Math.min(last ? now - last : 16, 64) / 1000;
      last = now;
      if (!(drag && drag.moved)) {
        const goal = focused ? 0 : target;
        // Picking up speed answers faster than shedding it, which reads as momentum.
        const tau = Math.abs(goal) > Math.abs(speed) ? 0.22 : 0.5;
        speed += (goal - speed) * (1 - Math.exp(-dt / tau));
        x -= speed * dt;
        wrap();
      }
      paint();
      trackHover();
      if (shouldRun()) frame = requestAnimationFrame(tick);
      else { last = 0; if (focused) speed = 0; }
    }

    function start() {
      if (!frame && shouldRun()) frame = requestAnimationFrame(tick);
    }

    // :hover only refreshes when the mouse moves, so a logo sliding under a still
    // cursor would keep a stale highlight. The logo under the pointer is tracked here.
    function trackHover() {
      const hit = pointer && !(drag && drag.moved) ? document.elementFromPoint(pointer.x, pointer.y) : null;
      const logo = hit && viewport.contains(hit) ? hit.closest('.pm-logo > a') : null;
      if (logo === hot) return;
      if (hot) hot.classList.remove('is-hot');
      if (logo) logo.classList.add('is-hot');
      hot = logo;
    }

    function edgeAt(clientX) {
      const rect = viewport.getBoundingClientRect();
      const zone = Math.min(rect.width * EDGE_SHARE, EDGE_MAX);
      const px = clientX - rect.left;
      if (px < zone) return { side: 'left', depth: clamp(1 - px / zone, 0, 1) };
      if (px > rect.width - zone) return { side: 'right', depth: clamp((px - (rect.width - zone)) / zone, 0, 1) };
      return { side: '', depth: 0 };
    }

    function aim(edge) {
      // An eased curve keeps the first step into a zone gentle and the very edge fast.
      target = edge.side ? READ_SPEED + (TOP_SPEED - READ_SPEED) * Math.pow(edge.depth, 1.5) : READ_SPEED;
      if (edge.side) root.dataset.edge = edge.side;
      else delete root.dataset.edge;
      root.style.setProperty('--pm-depth', edge.depth.toFixed(3));
      start();
    }

    function rest() {
      target = BASE_SPEED;
      delete root.dataset.edge;
      delete root.dataset.hover;
      root.style.setProperty('--pm-depth', '0');
      start();
    }

    // Moving the strip by hand ends keyboard focus, so wrapping can resume.
    function releaseFocus() {
      if (focused && viewport.contains(document.activeElement)) document.activeElement.blur();
    }

    viewport.addEventListener('pointerenter', e => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') root.dataset.hover = '';
    });
    viewport.addEventListener('pointerleave', () => {
      pointer = null;
      trackHover();
      // A press that slid out before it became a drag never sees its pointerup here.
      if (drag && !drag.moved && drag.type !== 'touch') drag = null;
      if (!drag) rest();
    });

    viewport.addEventListener('pointerdown', e => {
      if (e.button !== 0 || isStatic()) return;
      suppressClick = false;
      drag = { id: e.pointerId, type: e.pointerType, startX: e.clientX, lastX: e.clientX, lastT: e.timeStamp, velocity: 0, moved: false };
      // Touch has no hover: pressing and holding an edge does the same job.
      if (e.pointerType === 'touch') aim(edgeAt(e.clientX));
    });

    viewport.addEventListener('pointermove', e => {
      if (drag && e.pointerId === drag.id) {
        if (e.pointerType !== 'touch') pointer = { x: e.clientX, y: e.clientY };
        if (!drag.moved && Math.abs(e.clientX - drag.startX) > DRAG_THRESHOLD) {
          drag.moved = true;
          releaseFocus();
          viewport.setPointerCapture(e.pointerId);
          root.classList.add('is-dragging');
          delete root.dataset.edge;
          root.style.setProperty('--pm-depth', '0');
          start();
        }
        if (drag.moved) {
          const step = e.clientX - drag.lastX;
          const instant = -step / Math.max(e.timeStamp - drag.lastT, 1) * 1000;
          drag.velocity = drag.velocity * 0.6 + instant * 0.4;
          drag.lastX = e.clientX;
          drag.lastT = e.timeStamp;
          speed = drag.velocity;
          x += step;
          wrap();
          paint();
        }
        return;
      }
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
        pointer = { x: e.clientX, y: e.clientY };
        trackHover();
        aim(edgeAt(e.clientX));
      }
    });

    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const { moved, type } = drag;
      // A finger or cursor that stopped before letting go should not fling the strip.
      if (e.timeStamp - drag.lastT > 90) drag.velocity = 0;
      if (moved) {
        speed = clamp(drag.velocity, -MAX_FLING, MAX_FLING);
        suppressClick = true;
        // The click that follows a drag arrives in this same task; nothing later should be eaten.
        setTimeout(() => { suppressClick = false; }, 0);
        root.classList.remove('is-dragging');
      }
      drag = null;
      const inside = e.type === 'pointerup' && viewport.contains(document.elementFromPoint(e.clientX, e.clientY));
      if (type !== 'touch' && inside) aim(edgeAt(e.clientX));
      else rest();
      start();
    }
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    // A drag that ends over a logo must not open that partner's site.
    viewport.addEventListener('click', e => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    }, true);

    // Horizontal trackpad swipes move the strip directly.
    viewport.addEventListener('wheel', e => {
      if (isStatic() || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      releaseFocus();
      x -= e.deltaX;
      wrap();
      paint();
    }, { passive: false });

    // Bring the focused logo fully inside the strip, clear of the faded edges.
    function reveal(item) {
      if (!item || isStatic()) return;
      viewport.scrollLeft = 0;
      const inset = viewport.clientWidth * 0.08 + 8;
      const offset = item.offsetLeft;
      x = clamp(x, inset - offset, viewport.clientWidth - inset - item.offsetWidth - offset);
      paint();
    }

    // Keyboard focus stops the strip and holds the focused logo in view. Focus that
    // arrives by mouse (not :focus-visible) lets it run on.
    viewport.addEventListener('focusin', e => {
      focused = e.target.matches(':focus-visible');
      if (focused) {
        speed = 0;
        reveal(e.target.closest('.pm-logo'));
      } else {
        wrap();
        paint();
      }
      start();
    });
    viewport.addEventListener('focusout', e => {
      if (viewport.contains(e.relatedTarget)) return;
      focused = false;
      wrap();
      paint();
      start();
    });
    // The browser may still scroll the clipped viewport toward a focused logo;
    // fold that scroll into the transform instead.
    viewport.addEventListener('scroll', () => {
      if (isStatic() || !viewport.scrollLeft) return;
      x -= viewport.scrollLeft;
      viewport.scrollLeft = 0;
      wrap();
      paint();
    });

    function applyMotionPreference() {
      root.classList.toggle('is-static', reduced.matches);
      root.classList.toggle('is-live', !reduced.matches);
      if (reduced.matches) {
        track.style.transform = '';
        x = 0;
        return;
      }
      viewport.scrollLeft = 0;
      measure();
      start();
    }

    reduced.addEventListener('change', applyMotionPreference);
    document.addEventListener('sst:langchange', measure);
    if ('ResizeObserver' in window) {
      const resize = new ResizeObserver(measure);
      resize.observe(viewport);
      resize.observe(firstSet);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        if (visible) start();
      }, { rootMargin: '120px 0px' }).observe(root);
    } else {
      visible = true;
    }

    applyMotionPreference();
  }
})();
