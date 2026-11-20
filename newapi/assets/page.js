(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const palette = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#60a5fa', '#f97316', '#c084fc', '#2dd4bf', '#facc15', '#f472b6'];
  const money = (value) => {
    if (!Number.isFinite(value) || value <= 0) return '—';
    if (value >= 1000) return '¥' + Math.round(value).toLocaleString('en-US');
    return '¥' + value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };
  const hash = (text) => Array.from(String(text || '')).reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const vendorColor = (name) => palette[hash(name) % palette.length];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const splitTags = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  const modelPrice = (model) => {
    if (model.quota_type !== 0) return { input: Number(model.model_price || 0) * 7.3, output: 0, unit: '次' };
    const ratio = Number(model.model_ratio || 0);
    const groupRatio = 1;
    const input = ratio * 2 * 7.3 * groupRatio;
    const output = input * Number(model.completion_ratio || 1);
    return { input, output, unit: '1M Tokens' };
  };
  const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 }) : null;
  const observeReveals = (root = document) => {
    $$('.reveal', root).forEach((el) => {
      if (revealObserver) revealObserver.observe(el);
      else el.classList.add('is-visible');
    });
  };
  const animateCounts = (root = document) => {
    $$('[data-count]', root).forEach((el) => {
      if (el.dataset.counted === '1') return;
      el.dataset.counted = '1';
      const target = Number(el.dataset.count || 0);
      const suffix = el.dataset.suffix || '';
      const start = performance.now();
      const duration = 1100;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-US') + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };
  const showModal = (html) => {
    const modal = $('#modelModal');
    if (!modal) return;
    $('#modelModalBody').innerHTML = html;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };
  const closeModal = () => {
    const modal = $('#modelModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  };
  const openModel = (model, vendorName) => {
    const p = modelPrice(model);
    const tags = splitTags(model.tags);
    const endpoints = model.supported_endpoint_types || [];
    const groups = model.enable_groups || [];
    const icon = escapeHtml(vendorName.slice(0, 1));
    showModal(`
      <div class="modal-head">
        <div><h3>${escapeHtml(model.model_name)}</h3><p><span class="vendor-badge"><i class="vendor-dot" style="--vendor:${vendorColor(vendorName)}"></i>${escapeHtml(vendorName)}</span></p></div>
        <button class="modal-close" type="button" data-modal-close aria-label="关闭">×</button>
      </div>
      <div class="modal-grid">
        <div class="modal-item"><span>输入价格</span><strong>${money(p.input)} / ${p.unit}</strong></div>
        <div class="modal-item"><span>输出价格</span><strong>${p.output ? money(p.output) + ' / ' + p.unit : '—'}</strong></div>
        <div class="modal-item"><span>可用分组</span><strong>${escapeHtml(groups.join(' / ') || 'default')}</strong></div>
        <div class="modal-item"><span>端点类型</span><strong>${escapeHtml(endpoints.join(' / ') || 'openai')}</strong></div>
        <div class="modal-item"><span>计费方式</span><strong>${model.quota_type === 0 ? '按量计费' : '按次计费'}</strong></div>
        <div class="modal-item"><span>模型标识</span><strong>${escapeHtml(model.model_name)}</strong></div>
      </div>
      ${tags.length ? `<div class="tag-row" style="margin-top:14px">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
    `);
  };
  const initPricing = async () => {
    const grid = $('#modelGrid');
    if (!grid) return;
    let payload;
    try {
      const response = await fetch('/newapi/assets/pricing.json', { credentials: 'omit' });
      payload = await response.json();
    } catch (error) {
      grid.innerHTML = '<div class="empty-state">模型数据加载失败，请刷新页面重试。</div>';
      return;
    }
    const models = payload.data || [];
    const vendors = payload.vendors || [];
    const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
    const vendorCounts = new Map();
    models.forEach((model) => {
      const name = vendorById.get(model.vendor_id) || '未知供应商';
      vendorCounts.set(name, (vendorCounts.get(name) || 0) + 1);
    });
    const setStat = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };
    setStat('#hero-model-count', models.length);
    setStat('#hero-vendor-count', vendors.length);
    setStat('#hero-price-version', '实时');
    const vendorChips = $('#vendorChips');
    if (vendorChips) {
      vendorChips.innerHTML = '<button class="filter-chip is-active" type="button" data-vendor="all">全部 ' + models.length + '</button>' + Array.from(vendorCounts.entries()).sort((a,b) => b[1]-a[1]).map(([name,count]) => `<button class="filter-chip" type="button" data-vendor="${escapeHtml(name)}">${escapeHtml(name)} <span>${count}</span></button>`).join('');
    }
    const groupChips = $('#groupChips');
    if (groupChips) {
      const groups = new Set();
      models.forEach((model) => (model.enable_groups || []).forEach((group) => groups.add(group)));
      groupChips.innerHTML = '<button class="filter-chip is-active" type="button" data-group="all">全部分组</button>' + Array.from(groups).sort().map((group) => `<button class="filter-chip" type="button" data-group="${escapeHtml(group)}">${escapeHtml(group)}</button>`).join('');
    }
    const state = { vendor: 'all', group: 'all', query: '', sort: 'default' };
    const render = () => {
      const filtered = models.filter((model) => {
        const vendor = vendorById.get(model.vendor_id) || '未知供应商';
        const groups = model.enable_groups || [];
        const haystack = [model.model_name, vendor, model.tags, ...(model.supported_endpoint_types || [])].join(' ').toLowerCase();
        return (state.vendor === 'all' || vendor === state.vendor) && (state.group === 'all' || groups.includes(state.group)) && (!state.query || haystack.includes(state.query));
      });
      const priced = filtered.map((model) => ({ model, p: modelPrice(model), vendor: vendorById.get(model.vendor_id) || '未知供应商' }));
      priced.sort((a,b) => {
        if (state.sort === 'price-asc') return (a.p.input || Number.MAX_SAFE_INTEGER) - (b.p.input || Number.MAX_SAFE_INTEGER);
        if (state.sort === 'price-desc') return (b.p.input || 0) - (a.p.input || 0);
        if (state.sort === 'name') return a.model.model_name.localeCompare(b.model.model_name);
        return 0;
      });
      grid.innerHTML = priced.length ? priced.map(({ model, p, vendor }, index) => {
        const tags = splitTags(model.tags).slice(0, 3);
        const endpoints = (model.supported_endpoint_types || []).slice(0, 3);
        return `<article class="model-card reveal" data-model-name="${escapeHtml(model.model_name)}" tabindex="0" role="button" aria-label="查看 ${escapeHtml(model.model_name)}">
          <div class="model-top"><span class="vendor-badge"><i class="vendor-dot" style="--vendor:${vendorColor(vendor)}"></i>${escapeHtml(vendor)}</span><span class="model-index">${String(index + 1).padStart(3,'0')}</span></div>
          <h3 class="model-name">${escapeHtml(model.model_name)}</h3>
          <div class="tag-row">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
          <div class="model-prices"><div class="price-box"><span>输入</span><strong>${money(p.input)}<small>/${p.unit}</small></strong></div><div class="price-box"><span>输出</span><strong>${p.output ? money(p.output) + '<small>/' + p.unit + '</small>' : '—'}</strong></div></div>
          <div class="endpoint-row">${endpoints.map((endpoint) => `<span class="endpoint">${escapeHtml(endpoint)}</span>`).join('')}</div>
        </article>`;
      }).join('') : '<div class="empty-state">没有匹配的模型，试试更换筛选条件。</div>';
      const resultCount = $('#resultCount');
      if (resultCount) resultCount.textContent = '显示 ' + filtered.length + ' / ' + models.length + ' 个模型';
      observeReveals(grid);
    };
    document.addEventListener('click', (event) => {
      const chip = event.target.closest('.filter-chip');
      if (chip) {
        if (chip.dataset.vendor !== undefined) { state.vendor = chip.dataset.vendor; $$('.filter-chip[data-vendor]').forEach((el) => el.classList.toggle('is-active', el === chip)); }
        if (chip.dataset.group !== undefined) { state.group = chip.dataset.group; $$('.filter-chip[data-group]').forEach((el) => el.classList.toggle('is-active', el === chip)); }
        render();
        return;
      }
      const card = event.target.closest('.model-card');
      if (card) {
        const model = models.find((item) => item.model_name === card.dataset.modelName);
        if (model) openModel(model, vendorById.get(model.vendor_id) || '未知供应商');
        return;
      }
      if (event.target.closest('[data-modal-close]') || event.target.id === 'modelModal') closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
      if (event.key === 'Enter' && event.target.classList?.contains('model-card')) event.target.click();
    });
    $('#searchInput')?.addEventListener('input', (event) => { state.query = event.target.value.trim().toLowerCase(); render(); });
    $('#sortSelect')?.addEventListener('change', (event) => { state.sort = event.target.value; render(); });
    render();
    animateCounts();
  };
  const initRankings = async () => {
    const board = $('#rankBoard');
    if (!board) return;
    let payload;
    try { payload = await (await fetch('/newapi/assets/pricing.json')).json(); }
    catch { board.innerHTML = '<div class="empty-state">排行榜数据加载失败，请刷新页面重试。</div>'; return; }
    const models = payload.data || [];
    const vendors = payload.vendors || [];
    const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
    const stats = new Map();
    models.forEach((model) => {
      const vendor = vendorById.get(model.vendor_id) || '未知供应商';
      const current = stats.get(vendor) || { count: 0, models: [] };
      current.count += 1; current.models.push(model.model_name); stats.set(vendor, current);
    });
    const ranked = Array.from(stats.entries()).sort((a,b) => b[1].count - a[1].count);
    const max = ranked[0]?.[1].count || 1;
    board.innerHTML = ranked.map(([vendor, item], index) => `<div class="rank-row reveal"><div class="rank-no">${String(index + 1).padStart(2,'0')}</div><div class="rank-name"><strong>${escapeHtml(vendor)}</strong><span>${item.models.slice(0,2).map(escapeHtml).join(' · ') || '模型目录'}</span></div><div class="rank-bar"><i style="--target:${Math.max(8, item.count / max * 100)}%"></i></div><div class="rank-count">${item.count} 个</div></div>`).join('');
    const priced = models.map((model) => ({ model, p: modelPrice(model), vendor: vendorById.get(model.vendor_id) || '未知供应商' })).filter((item) => item.p.input > 0).sort((a,b) => a.p.input - b.p.input).slice(0, 7);
    const leaders = $('#priceLeaders');
    if (leaders) leaders.innerHTML = priced.map(({ model, p, vendor }) => `<div class="price-leader"><div class="price-leader-name"><strong>${escapeHtml(model.model_name)}</strong><span>${escapeHtml(vendor)} · 输入价格</span></div><div class="price-leader-value">${money(p.input)}</div></div>`).join('');
    const setStat = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };
    setStat('#rank-model-count', models.length);
    setStat('#rank-vendor-count', vendors.length);
    setStat('#rank-top-vendor', ranked[0]?.[0] || '—');
    observeReveals(board);
    animateCounts();
    requestAnimationFrame(() => $$('.rank-bar i', board).forEach((el) => { el.style.width = el.style.getPropertyValue('--target') || '0%'; }));
  };
  document.addEventListener('DOMContentLoaded', () => {
    observeReveals();
    animateCounts();
    const page = document.body.dataset.page;
    if (page === 'pricing') initPricing();
    if (page === 'rankings') initRankings();
  });
})();
