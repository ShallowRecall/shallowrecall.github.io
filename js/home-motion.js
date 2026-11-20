import { mountStrands } from './motion/strands.js';
import { mountWaves } from './motion/waves.js';
import { mountLiquidEther } from './motion/liquid-ether.js';
import { mountNeonCursor } from './motion/cursor-neon.js';

const cleanup = [];
const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
const HOME_INTRO_KEY = 'recall:home-intro-seen:v1';

function syncHomeIntroSkip() {
  const root = document.documentElement;
  if (!document.getElementById('home-motion-stack')) {
    root.classList.remove('home-intro-skipped');
    return;
  }
  if (root.classList.contains('home-intro-first')) return;
  let seen = false;
  try {
    seen = sessionStorage.getItem(HOME_INTRO_KEY) === '1';
  } catch (error) {
    seen = false;
  }
  if (seen) root.classList.add('home-intro-skipped');
}

function resetSkippedHomeScroll() {
  if (!document.documentElement.classList.contains('home-intro-skipped')) return;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash === '#content-inner') {
    history.replaceState(null, '', location.pathname + location.search);
  }
  const reset = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  reset();
  requestAnimationFrame(reset);
  setTimeout(reset, 80);
  setTimeout(reset, 220);
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smoothstep = (value) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

function on(target, event, handler, options) {
  if (!target) return;
  target.addEventListener(event, handler, options);
  cleanup.push(() => target.removeEventListener(event, handler, options));
}

function addCleanup(fn) {
  cleanup.push(fn);
}

function initReveals() {
  const items = [...document.querySelectorAll('.home-motion-reveal')];
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach((item) => observer.observe(item));
  addCleanup(() => observer.disconnect());
}

function initCounts() {
  const counters = [...document.querySelectorAll('[data-count-to]')];
  if (!counters.length) return;
  const animate = (el) => {
    if (el.dataset.counted === '1') return;
    el.dataset.counted = '1';
    const target = Number(el.dataset.countTo || 0);
    const suffix = el.dataset.countSuffix || '';
    const duration = reducedMotion ? 0 : Number(el.dataset.countDuration || 1400);
    if (!duration) { el.textContent = target.toLocaleString('en-US') + suffix; return; }
    const start = performance.now();
    const tick = (now) => {
      const p = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en-US') + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) {
    counters.forEach(animate);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animate(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.55 });
  counters.forEach((counter) => observer.observe(counter));
  addCleanup(() => observer.disconnect());
}

function initScrollExpand() {
  const sections = [...document.querySelectorAll('[data-scroll-expand]')];
  sections.forEach((section) => {
    const frame = section.querySelector('.home-motion-expand-frame');
    const media = section.querySelector('.home-motion-expand-media');
    const title = section.querySelector('.home-motion-expand-title');
    const overlay = section.querySelector('.home-motion-expand-overlay');
    const scrim = section.querySelector('.home-motion-expand-scrim');
    if (!frame || !media) return;
    let target = 0;
    let current = 0;
    let raf = 0;
    const paint = (progress) => {
      const p = smoothstep(progress);
      const width = 64 + 36 * p;
      const height = 62 + 38 * p;
      const insetX = (100 - width) / 2;
      const insetY = (100 - height) / 2;
      const radius = 8 * (1 - p);
      frame.style.clipPath = 'inset(' + insetY + '% ' + insetX + '% ' + insetY + '% ' + insetX + '% round ' + radius + 'px)';
      media.style.transform = 'scale(' + (1.16 - 0.16 * p) + ')';
      if (scrim) scrim.style.opacity = String(0.12 * p);
      if (title) {
        const fade = smoothstep((p - 0.4) / 0.48);
        title.style.opacity = String(1 - fade);
        title.style.transform = 'translate3d(0,' + (-28 * fade) + 'px,0) scale(' + (1 + 0.06 * fade) + ')';
      }
      if (overlay) {
        const show = smoothstep((p - 0.68) / 0.32);
        overlay.style.opacity = String(show);
        overlay.style.transform = 'translate3d(0,' + (18 * (1 - show)) + 'px,0)';
      }
    };
    if (reducedMotion) { paint(1); return; }
    const measure = () => {
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, section.offsetHeight - window.innerHeight);
      target = clamp(-rect.top / distance, 0, 1);
      if (!raf) raf = requestAnimationFrame(animate);
    };
    const animate = () => {
      raf = 0;
      current += (target - current) * 0.14;
      if (Math.abs(target - current) < 0.0008) current = target;
      paint(current);
      if (current !== target) raf = requestAnimationFrame(animate);
    };
    on(window, 'scroll', measure, { passive: true });
    on(window, 'resize', measure, { passive: true });
    paint(0);
    measure();
  });
}

function initScrollFloat() {
  const items = [...document.querySelectorAll('[data-scroll-float]')];
  items.forEach((item) => {
    const text = item.textContent || '';
    item.textContent = '';
    const chars = [...text].map((char) => {
      const span = document.createElement('span');
      span.className = 'home-motion-char';
      span.textContent = char === ' ' ? '\u00a0' : char;
      item.appendChild(span);
      return span;
    });
    if (reducedMotion) {
      chars.forEach((char) => { char.style.opacity = '1'; char.style.transform = 'none'; });
      return;
    }
    const paint = () => {
      const rect = item.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const raw = (vh * 0.9 - rect.top) / (vh * 0.82 + rect.height);
      const progress = clamp(raw, 0, 1);
      chars.forEach((char, index) => {
        const local = smoothstep((progress - (index / Math.max(1, chars.length)) * 0.46) / 0.54);
        char.style.opacity = String(local);
        char.style.transform = 'translate3d(0,' + (1 - local) * 72 + 'px,0) scale(' + (0.7 + 0.3 * local) + ',' + (2.3 - 1.3 * local) + ')';
      });
    };
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; paint(); });
    };
    on(window, 'scroll', schedule, { passive: true });
    on(window, 'resize', schedule, { passive: true });
    paint();
  });
}

function initDriftWall() {
  const wall = document.querySelector('.home-motion-drift-wall');
  if (!wall) return;
  const plane = wall.querySelector('.home-motion-drift-plane');
  if (!plane) return;
  let activeTile = null;
  const setActiveTile = (event) => {
    const candidate = document.elementsFromPoint(event.clientX, event.clientY).map((element) => element.closest('.home-motion-drift-tile')).find(Boolean) || null;
    if (candidate === activeTile) return;
    if (activeTile) activeTile.classList.remove('is-neon-hover');
    activeTile = candidate;
    if (activeTile) activeTile.classList.add('is-neon-hover');
    wall.classList.toggle('is-hovering-tile', Boolean(activeTile));
  };
  if (reducedMotion) { plane.style.transform = 'translate(-50%, -50%) scale(1.04)'; return; }
  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let raf = 0;
  const animate = () => {
    raf = 0;
    x += (targetX - x) * 0.08;
    y += (targetY - y) * 0.08;
    plane.style.transform = 'translate(-50%, -50%) scale(1.04) translate3d(' + (x * 12) + 'px,' + (-y * 12) + 'px,0)';
    if (Math.abs(targetX - x) > 0.001 || Math.abs(targetY - y) > 0.001) raf = requestAnimationFrame(animate);
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(animate); };
  const onMove = (event) => {
    const rect = wall.getBoundingClientRect();
    targetX = clamp((event.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5);
    targetY = clamp((event.clientY - rect.top) / rect.height - 0.5, -0.5, 0.5);
    setActiveTile(event);
    wake();
  };
  const onLeave = () => {
    targetX = 0;
    targetY = 0;
    if (activeTile) activeTile.classList.remove('is-neon-hover');
    activeTile = null;
    wall.classList.remove('is-hovering-tile');
    wake();
  };
  on(wall, 'pointermove', onMove, { passive: true });
  on(wall, 'pointerleave', onLeave);
  animate();
}

function initRequestJourney() {
  const section = document.querySelector('[data-request-journey]');
  if (!section) return;
  const panel = section.querySelector('.home-motion-journey-panel');
  const latency = section.querySelector('[data-journey-latency]');
  const tokens = section.querySelector('[data-journey-tokens]');
  const progressBar = section.querySelector('.home-motion-journey-progress > span');
  const stages = [...section.querySelectorAll('[data-journey-stage]')];
  const providers = [...section.querySelectorAll('[data-journey-provider]')];
  let raf = 0;
  const paint = () => {
    raf = 0;
    const rect = section.getBoundingClientRect();
    const distance = Math.max(1, section.offsetHeight - window.innerHeight);
    const progress = clamp(-rect.top / distance, 0, 1);
    if (panel) panel.style.setProperty('--journey-progress', String(progress));
    if (latency) latency.textContent = Math.round(684 * clamp(progress / 0.78, 0, 1)).toLocaleString('en-US');
    if (tokens) tokens.textContent = Math.round(1280 * clamp((progress - 0.42) / 0.58, 0, 1)).toLocaleString('en-US');
    if (progressBar) progressBar.style.transform = 'scaleX(' + progress + ')';
    const active = Math.min(3, Math.floor(progress * 4));
    stages.forEach((stage, index) => stage.toggleAttribute('data-active', index <= active));
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
  on(window, 'scroll', schedule, { passive: true });
  on(window, 'resize', schedule, { passive: true });
  if (panel) {
    on(panel, 'pointermove', (event) => {
      const rect = panel.getBoundingClientRect();
      const px = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const py = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      panel.style.setProperty('--journey-pointer-x', px * 100 + '%');
      panel.style.setProperty('--journey-pointer-y', py * 100 + '%');
      panel.style.setProperty('--journey-tilt-x', (0.5 - py) * 5 + 'deg');
      panel.style.setProperty('--journey-tilt-y', (px - 0.5) * 7 + 'deg');
    }, { passive: true });
    on(panel, 'pointerleave', () => {
      panel.style.setProperty('--journey-pointer-x', '50%');
      panel.style.setProperty('--journey-pointer-y', '45%');
      panel.style.setProperty('--journey-tilt-x', '0deg');
      panel.style.setProperty('--journey-tilt-y', '0deg');
    });
  }
  providers.forEach((button) => {
    const activate = () => providers.forEach((item) => item.classList.toggle('is-active', item === button));
    on(button, 'click', activate);
    on(button, 'pointerenter', activate);
    on(button, 'focus', activate);
  });
  paint();
}

function initCursorFluid() {
  const hero = document.querySelector('#page-header.full_page');
  const liquidSection = document.querySelector('.home-motion-liquid-section');
  const isActive = () => {
    const y = window.scrollY;
    const start = (hero?.offsetHeight || window.innerHeight) * 0.86;
    const end = liquidSection
      ? liquidSection.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.65
      : Number.POSITIVE_INFINITY;
    return y > start && y < end;
  };
  cleanup.push(mountNeonCursor({
    colors: ['#0485f7', '#22d3ee', '#7c3aed', '#ff9ffc'],
    isActive
  }));
}
function initNeonNav() {
  const nav = document.querySelector('.home-neon-nav');
  if (!nav) return;
  const content = document.getElementById('content-inner');
  const sync = () => {
    const scrolled = window.scrollY > 18;
    nav.classList.toggle('is-scrolled', scrolled);
    if (!content) {
      nav.classList.remove('is-over-content');
      return;
    }
    const contentTop = content.getBoundingClientRect().top + window.scrollY - 96;
    nav.classList.toggle('is-over-content', scrolled && window.scrollY >= contentTop);
  };
  on(window, 'scroll', sync, { passive: true });
  sync();
}
function initCanvasEffects() {
  if (!reducedMotion) initCursorFluid();

  const strands = document.getElementById('home-motion-strands');
  if (strands) {
    cleanup.push(mountStrands(strands, {
      colors: ['#FF4242', '#7C3AED', '#06B6D4', '#EAB308'],
      count: 4,
      speed: 0.45,
      amplitude: 1.05,
      waviness: 1,
      thickness: 0.68,
      glow: 3,
      taper: 3.1,
      spread: 1.2,
      hueShift: 0,
      intensity: 0.72,
      saturation: 1.15,
      opacity: 0.92,
      scale: 1.7
    }));
  }
  const waves = document.getElementById('home-motion-waves');
  if (waves) {
    cleanup.push(mountWaves(waves, {
      backgroundColor: '#111315',
      friction: 0.9,
      lineColor: '#ffffff',
      maxCursorMove: 120,
      tension: 0.01,
      waveAmpX: 42,
      waveAmpY: 24,
      waveSpeedX: 0.01,
      waveSpeedY: 0.01,
      xGap: 12,
      yGap: 36
    }));
  }
  const liquid = document.getElementById('home-motion-liquid');
  if (liquid) {
    cleanup.push(mountLiquidEther(liquid, {
      colors: ['#5227FF', '#FF9FFC', '#B497CF'],
      mouseForce: 20,
      cursorSize: 100,
      isViscous: false,
      viscous: 30,
      iterationsViscous: 32,
      iterationsPoisson: 32,
      resolution: 0.5,
      isBounce: false,
      autoDemo: true,
      autoSpeed: 0.5,
      autoIntensity: 2.2,
      takeoverDuration: 0.25,
      autoResumeDelay: 3000,
      autoRampDuration: 0.6,
      interactive: false,
      viscosity: 0,
      bounceEdges: false
    }));
  }
}

function destroy() {
  while (cleanup.length) {
    const fn = cleanup.pop();
    try { fn(); } catch (error) { console.warn('[home-motion] cleanup failed:', error); }
  }
}

function init() {
  destroy();
  syncHomeIntroSkip();
  if (!document.getElementById('home-motion-stack')) return;
  if (document.documentElement.classList.contains('home-intro-skipped')) {
    resetSkippedHomeScroll();
    return;
  }
  initNeonNav();
  initCanvasEffects();
  initReveals();
  initCounts();
  initScrollExpand();
  initScrollFloat();
  initDriftWall();
  initRequestJourney();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
document.addEventListener('pjax:send', destroy);
document.addEventListener('pjax:complete', () => {
  document.documentElement.classList.remove('home-intro-first');
  syncHomeIntroSkip();
  resetSkippedHomeScroll();
  init();
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  document.documentElement.classList.remove('home-intro-first');
  syncHomeIntroSkip();
  resetSkippedHomeScroll();
  init();
});
window.addEventListener('popstate', () => {
  document.documentElement.classList.remove('home-intro-first');
  syncHomeIntroSkip();
  resetSkippedHomeScroll();
});
window.addEventListener('pagehide', destroy);
