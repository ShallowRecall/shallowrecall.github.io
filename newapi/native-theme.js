(() => {
  'use strict';

  const RIPPLE_URL = 'https://www.shallowrecall.top/js/hero-ripple.js?v=4.0.0';
  const RIPPLE_TEXTURE = 'https://www.shallowrecall.top/img/hero-ripple-texture.webp';
  let enhanceQueued = false;
  let rippleModulePromise = null;
  let revealObserver = null;

  const pageName = () => {
    const path = (location.pathname || '/').replace(/\/+$/, '') || '/';
    if (path === '/') return 'home';
    if (path.startsWith('/pricing')) return 'pricing';
    if (path.startsWith('/about')) return 'about';
    if (path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/reset') || path.startsWith('/oauth')) return 'auth';
    if (path.startsWith('/console') || path.startsWith('/dashboard') || path.startsWith('/token') || path.startsWith('/log') || path.startsWith('/personal') || path.startsWith('/topup') || path.startsWith('/channel') || path.startsWith('/models') || path.startsWith('/user') || path.startsWith('/setting')) return 'console';
    return 'other';
  };

  const forceDarkTheme = () => {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('color-scheme', 'dark');
    if (document.body) {
      document.body.setAttribute('theme-mode', 'dark');
      const page = pageName();
      if (document.body.dataset.recallPage !== page) {
        document.body.dataset.recallPage = page;
      }
    }
  };

  const addKicker = (root, text, className) => {
    if (!root || root.querySelector('.' + className)) return;
    const kicker = document.createElement('p');
    kicker.className = className;
    kicker.textContent = text;
    root.prepend(kicker);
  };

  const addMeta = (root, items) => {
    if (!root || root.querySelector('.recall-native-meta')) return;
    const row = document.createElement('div');
    row.className = 'recall-native-meta';
    items.forEach((item) => {
      const chip = document.createElement('span');
      chip.textContent = item;
      row.appendChild(chip);
    });
    const description = Array.from(root.querySelectorAll('p')).find((node) => node.textContent.trim().length > 0);
    if (description) description.insertAdjacentElement('afterend', row);
    else root.appendChild(row);
  };

  const loadRipple = async () => {
    const mount = document.getElementById('hero-ripple-canvas');
    if (!mount || mount.dataset.rippleReady === '1') return;
    try {
      if (!rippleModulePromise) {
        rippleModulePromise = import(RIPPLE_URL);
      }
      await rippleModulePromise;
      requestAnimationFrame(() => document.dispatchEvent(new Event('pjax:complete')));
    } catch (error) {
      console.warn('[Recall Theme] ripple failed', error);
    }
  };

  const enhancePricing = () => {
    const banner = document.querySelector('.pricing-search-header .semi-card-cover > div');
    if (!banner) return;
    banner.classList.add('recall-pricing-banner');

    const content = banner.querySelector(':scope > .relative.z-10');
    if (content) content.classList.add('recall-hero-content');
    const text = content && content.querySelector('.flex-1.min-w-0');
    if (text) {
      addKicker(text, 'MODEL CATALOG · LIVE PRICING', 'recall-hero-kicker');
      addMeta(text, ['统一接口', '实时目录', '人民币计价']);
    }

    let mount = banner.querySelector('#hero-ripple-canvas');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'hero-ripple-canvas';
      mount.className = 'recall-native-ripple';
      mount.dataset.src = RIPPLE_TEXTURE;
      banner.prepend(mount);
    }
    loadRipple();

    if (!revealObserver && 'IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '40px 0px' });
    }

    document.querySelectorAll('.pricing-content .semi-card').forEach((card) => {
      if (card.closest('.pricing-search-header') || card.dataset.recallReveal === '1') return;
      card.dataset.recallReveal = '1';
      card.classList.add('recall-reveal');
      if (revealObserver) revealObserver.observe(card);
      else card.classList.add('is-visible');
    });
  };

  const enhanceAbout = () => {
    const shell = document.querySelector('main.semi-layout-content > div');
    if (!shell) return;
    shell.classList.add('recall-about-shell');
    const content = shell.firstElementChild;
    if (!content) return;
    addKicker(content, 'ABOUT RECALL API · ONE ENDPOINT', 'recall-about-kicker');

    if (!content.querySelector('.recall-about-badges')) {
      const badges = document.createElement('div');
      badges.className = 'recall-about-badges';
      ['OpenAI Compatible', 'Unified Gateway', 'Invite Only'].forEach((label) => {
        const chip = document.createElement('span');
        chip.textContent = label;
        badges.appendChild(chip);
      });
      const firstParagraph = content.querySelector('p');
      if (firstParagraph) firstParagraph.insertAdjacentElement('beforebegin', badges);
      else content.appendChild(badges);
    }
  };

  const enhance = () => {
    if (enhanceQueued) return;
    enhanceQueued = true;
    requestAnimationFrame(() => {
      enhanceQueued = false;
      forceDarkTheme();
      const page = pageName();
      if (page === 'pricing') enhancePricing();
      if (page === 'about') enhanceAbout();
    });
  };

  let scheduleTimer = 0;
  const scheduleEnhance = () => {
    clearTimeout(scheduleTimer);
    scheduleTimer = window.setTimeout(enhance, 80);
  };

  const wrapHistory = (method) => {
    const original = history[method];
    if (typeof original !== 'function' || original.__recallWrapped) return;
    const wrapped = function (...args) {
      if (document.getElementById('hero-ripple-canvas')) {
        document.dispatchEvent(new Event('pjax:send'));
      }
      const result = original.apply(this, args);
      scheduleEnhance();
      return result;
    };
    wrapped.__recallWrapped = true;
    history[method] = wrapped;
  };

  window.addEventListener('popstate', scheduleEnhance);
  window.addEventListener('hashchange', scheduleEnhance);
  document.addEventListener('pointermove', (event) => {
    document.body?.style.setProperty('--recall-mx', event.clientX + 'px');
    document.body?.style.setProperty('--recall-my', event.clientY + 'px');
  }, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance, { once: true });
  } else {
    enhance();
  }

  wrapHistory('pushState');
  wrapHistory('replaceState');

  new MutationObserver(scheduleEnhance).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'theme-mode']
  });

  let settleTicks = 0;
  const settleTimer = window.setInterval(() => {
    enhance();
    settleTicks += 1;
    if (settleTicks >= 30) window.clearInterval(settleTimer);
  }, 500);
})();