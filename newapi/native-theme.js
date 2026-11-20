(() => {
  'use strict';

  const RIPPLE_URL = 'https://www.shallowrecall.top/js/hero-ripple.js?v=4.0.0';
  const RIPPLE_TEXTURE = 'https://www.shallowrecall.top/img/hero-ripple-texture.webp';
  let enhanceQueued = false;
  let rippleModulePromise = null;
  let revealObserver = null;
  let pricingPromise = null;
  const boundScrollHosts = new WeakSet();
  let scrollFrame = 0;

  const pageName = () => {
    const path = (location.pathname || '/').replace(/\/+$/, '') || '/';
    if (path === '/') return 'home';
    if (path.startsWith('/pricing')) return 'pricing';
    if (path.startsWith('/rankings')) return 'rankings';
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

  const ensureRevealObserver = () => {
    if (!revealObserver && 'IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '40px 0px' });
    }
    return revealObserver;
  };

  const revealElements = (elements) => {
    const observer = ensureRevealObserver();
    Array.from(elements).filter(Boolean).forEach((element, index) => {
      if (element.dataset.recallReveal === '1') return;
      element.dataset.recallReveal = '1';
      element.classList.add('recall-reveal');
      element.style.transitionDelay = Math.min(index * 55, 330) + 'ms';
      if (observer) observer.observe(element);
      else element.classList.add('is-visible');
    });
  };

  const animateCounters = (root = document) => {
    root.querySelectorAll('[data-count-to]').forEach((element) => {
      if (element.dataset.counted === '1') return;
      element.dataset.counted = '1';
      const target = Number(element.dataset.countTo || 0);
      const suffix = element.dataset.countSuffix || '';
      const duration = 1400;
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = Math.round(target * eased).toLocaleString('en-US') + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  const ensureTabBar = () => {
    const shell = document.querySelector('.app-layout > .semi-layout-header');
    const bar = shell && shell.querySelector(':scope > header');
    if (!shell || !bar) return;
    shell.classList.add('recall-tab-shell');
    bar.classList.add('recall-tab-bar');

    if (!bar.querySelector('.recall-tab-progress')) {
      const progress = document.createElement('span');
      progress.className = 'recall-tab-progress';
      progress.innerHTML = '<i></i>';
      bar.appendChild(progress);
    }

    const page = pageName();
    const activeHref = page === 'home' ? '/' : page === 'auth' ? '/login' : page === 'console' ? '/console' : '/' + page;
    let activeLink = null;
    bar.querySelectorAll('nav a').forEach((link) => {
      const active = link.getAttribute('href') === activeHref;
      link.classList.toggle('is-active', active);
      if (active) {
        activeLink = link;
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    const nav = bar.querySelector('nav');
    if (nav && activeLink && nav.scrollWidth > nav.clientWidth) {
      requestAnimationFrame(() => {
        nav.scrollLeft = Math.max(0, activeLink.offsetLeft - (nav.clientWidth - activeLink.clientWidth) / 2);
      });
    }
  };

  const scrollHost = () => {
    if (pageName() === 'pricing') return document.querySelector('.pricing-content');
    return document.querySelector('main.semi-layout-content') || document.scrollingElement;
  };

  const updateScrollEffects = () => {
    scrollFrame = 0;
    const host = scrollHost();
    if (!host) return;
    const isRoot = host === document.scrollingElement;
    const top = isRoot ? (window.scrollY || 0) : (host.scrollTop || 0);
    const max = isRoot
      ? Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      : Math.max(1, host.scrollHeight - host.clientHeight);
    const pageProgress = Math.min(1, Math.max(0, top / max));
    const heroProgress = Math.min(1, Math.max(0, top / 260));
    document.body.style.setProperty('--recall-page-progress', pageProgress.toFixed(4));
    document.body.style.setProperty('--recall-hero-scroll', heroProgress.toFixed(4));

    const shell = document.querySelector('.app-layout > .semi-layout-header');
    if (shell) {
      const scrolled = top > 18;
      if (shell.classList.contains('is-scrolled') !== scrolled) {
        shell.classList.toggle('is-scrolled', scrolled);
      }
    }
    const progress = document.querySelector('.recall-tab-progress i');
    if (progress) progress.style.setProperty('--recall-progress-width', (pageProgress * 100).toFixed(2) + '%');
  };

  const scheduleScrollEffects = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(updateScrollEffects);
  };

  const bindScrollHosts = () => {
    const host = scrollHost();
    if (host && !boundScrollHosts.has(host)) {
      boundScrollHosts.add(host);
      host.addEventListener('scroll', scheduleScrollEffects, { passive: true });
    }
    scheduleScrollEffects();
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

    revealElements(Array.from(document.querySelectorAll('.pricing-content .semi-card')).filter((card) => !card.closest('.pricing-search-header')));
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
    revealElements([shell, ...content.querySelectorAll('h2, p, li')]);
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  const money = (value) => {
    if (!Number.isFinite(value) || value <= 0) return '—';
    if (value >= 1000) return '¥' + Math.round(value).toLocaleString('en-US');
    return '¥' + value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  const modelPrice = (model) => {
    if (model.quota_type !== 0) return Number(model.model_price || 0) * 7.3;
    return Number(model.model_ratio || 0) * 2 * 7.3;
  };

  const ensureRankingsNav = () => {
    const nav = document.querySelector('.app-layout > .semi-layout-header nav');
    if (!nav || nav.querySelector('a[href="/rankings"]')) return;
    const docs = Array.from(nav.querySelectorAll('a')).find((link) => (link.getAttribute('href') || '').includes('docs.newapi.pro'));
    const link = document.createElement('a');
    link.href = '/rankings';
    link.innerHTML = '<span>排行榜</span>';
    link.className = docs ? docs.className : 'flex-shrink-0 flex items-center gap-1 font-semibold rounded-md transition-all duration-200 ease-in-out p-2 hover:text-semi-color-primary';
    if (docs) docs.before(link);
    else nav.appendChild(link);
  };

  const enhanceRankings = () => {
    const main = document.querySelector('main.semi-layout-content');
    if (!main) return;
    let root = document.getElementById('recall-rankings-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'recall-rankings-root';
      main.appendChild(root);
    }
    if (root.dataset.ready === '1') {
      loadRipple();
      return;
    }
    if (root.dataset.loading === '1') return;
    root.dataset.loading = '1';
    root.innerHTML = '<div class="recall-rank-loading">正在生成模型供给排行…</div>';

    if (!pricingPromise) {
      pricingPromise = fetch('/api/pricing', { credentials: 'omit' })
        .then((response) => {
          if (!response.ok) throw new Error('pricing request failed: ' + response.status);
          return response.json();
        });
    }

    pricingPromise.then((payload) => {
      const models = Array.isArray(payload?.data) ? payload.data : [];
      const vendors = Array.isArray(payload?.vendors) ? payload.vendors : [];
      const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
      const coverage = new Map();
      models.forEach((model) => {
        const vendor = vendorById.get(model.vendor_id) || '未知供应商';
        const current = coverage.get(vendor) || { count: 0, models: [] };
        current.count += 1;
        current.models.push(model.model_name);
        coverage.set(vendor, current);
      });
      const ranked = Array.from(coverage.entries()).sort((a, b) => b[1].count - a[1].count);
      const max = ranked[0]?.[1].count || 1;
      const priced = models
        .map((model) => ({ model, price: modelPrice(model), vendor: vendorById.get(model.vendor_id) || '未知供应商' }))
        .filter((item) => item.price > 0)
        .sort((a, b) => a.price - b.price)
        .slice(0, 7);

      const rankRows = ranked.map(([vendor, item], index) => `
        <div class="recall-rank-row">
          <div class="recall-rank-no">${String(index + 1).padStart(2, '0')}</div>
          <div class="recall-rank-name"><strong>${escapeHtml(vendor)}</strong><span>${escapeHtml(item.models.slice(0, 2).join(' · '))}</span></div>
          <div class="recall-rank-bar"><i data-width="${Math.max(8, item.count / max * 100)}%"></i></div>
          <div class="recall-rank-count">${item.count} 个</div>
        </div>`).join('');

      const priceRows = priced.map(({ model, price, vendor }) => `
        <div class="recall-price-leader">
          <div><strong>${escapeHtml(model.model_name)}</strong><span>${escapeHtml(vendor)} · 输入价格</span></div>
          <b>${money(price)}</b>
        </div>`).join('');

      root.innerHTML = `
        <section class="recall-rank-hero">
          <div id="hero-ripple-canvas" data-src="${RIPPLE_TEXTURE}"></div>
          <div class="recall-rank-hero-inner">
            <p class="recall-hero-kicker">RANKINGS · MODEL ECOSYSTEM</p>
            <h1>排行榜<span> 看见生态。</span></h1>
            <p>从当前模型目录自动生成供应商覆盖榜与价格梯度，帮助你快速判断模型供给、选择范围与接入成本。</p>
            <div class="recall-rank-stats">
              <div><strong data-count-to="${models.length}">0</strong><span>已收录模型</span></div>
              <div><strong data-count-to="${vendors.length}">0</strong><span>供应商</span></div>
              <div><strong>${escapeHtml(ranked[0]?.[0] || '—')}</strong><span>覆盖第一</span></div>
            </div>
          </div>
        </section>
        <div class="recall-rank-grid">
          <section class="recall-rank-panel">
            <div class="recall-rank-panel-head"><h2>模型供给榜。</h2><p>按当前可用模型目录统计，不代表实时调用量</p></div>
            ${rankRows}
          </section>
          <aside class="recall-rank-panel">
            <div class="recall-rank-panel-head"><h2>价格梯度。</h2><p>当前目录中输入价格最低的模型</p></div>
            ${priceRows}
          </aside>
        </div>`;
      root.dataset.ready = '1';
      root.dataset.loading = '0';
      animateCounters(root);
      revealElements([root.querySelector('.recall-rank-hero'), ...root.querySelectorAll('.recall-rank-panel')]);
      requestAnimationFrame(() => {
        root.querySelectorAll('.recall-rank-bar i').forEach((bar) => {
          bar.style.width = bar.dataset.width || '0%';
        });
      });
      loadRipple();
      scheduleScrollEffects();
    }).catch((error) => {
      root.dataset.loading = '0';
      root.innerHTML = '<div class="recall-rank-loading">排行榜数据加载失败，请刷新页面重试。</div>';
      console.warn('[Recall Theme] rankings failed', error);
    });
  };
  const enhance = () => {
    if (enhanceQueued) return;
    enhanceQueued = true;
    requestAnimationFrame(() => {
      enhanceQueued = false;
      forceDarkTheme();
      const page = pageName();
      ensureTabBar();
      ensureRankingsNav();
      bindScrollHosts();
      if (page !== 'rankings') document.getElementById('recall-rankings-root')?.remove();
      if (page === 'pricing') enhancePricing();
      if (page === 'about') enhanceAbout();
      if (page === 'rankings') enhanceRankings();
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
  window.addEventListener('scroll', scheduleScrollEffects, { passive: true });
  window.addEventListener('resize', scheduleScrollEffects, { passive: true });
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