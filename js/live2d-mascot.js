/* ==========================================================================
 * Live2D 看板娘 —— 大肥鱼 / 克劳德 / 龙娘
 * --------------------------------------------------------------------------
 * 依赖（_config.butterfly.yml 的 inject.bottom 按顺序注入，均为 defer）：
 *   /js/vendor/pixi.min.js
 *   /js/vendor/live2dcubismcore.min.js
 *   /js/vendor/pixi-live2d-display-cubism4.min.js
 *   /js/live2d-mascot.js   ← 本文件
 *
 * 功能：
 *   - 角色切换（记住上次选择）
 *   - 动作 / 表情面板（从模型的 model3.json 动态读取，换模型不用改代码）
 *   - 拖动换位置（记住）、双击复位
 *   - 点一下看板娘 → 随机动作 + 随机表情
 *   - 收起 / 展开（收起后留一个圆钮，随时叫回来）
 *
 * 设计要点：
 *   1. 容器挂在 document.body 下（#body-wrap 之外），Butterfly 的 pjax 只替换
 *      #body-wrap 等节点，换页不会把看板娘刷掉；pjax:complete 只做兜底重建。
 *   2. 每个角色先 HEAD 探测素材是否存在：缺失的角色在面板里置灰并提示放置路径。
 *   3. 任何异常都只 console.warn 一次并隐藏容器，不影响页面其它功能。
 *
 * 加人 / 换人只改 MODELS（配合 source/live2d/<id>/ 放素材）。
 * ========================================================================== */

(function () {
  'use strict';

  if (window.__l2dMascotInited) return;
  window.__l2dMascotInited = true;

  var CONFIG = {
    // 看板娘高度（px），与旧 koharu 的 display.height 300 对齐
    height: 300,
    // 初始位置（距左边 / 下边），可拖动改变并记住
    left: 0,
    bottom: 0,
    // 窄屏不渲染（沿用旧配置 mobile.show=false 的行为）
    mobileMaxWidth: 768,
    // 自动随机动作的间隔（毫秒），0 表示只播 idle
    extraMotionInterval: 18000,
    // 气泡默认停留时长（毫秒）
    bubbleDuration: 6200,
    storage: {
      model: 'shallowrecall:l2d-model',
      pos: 'shallowrecall:l2d-pos',
      variant: 'shallowrecall:l2d-variant',
      imagePaused: 'shallowrecall:l2d-image-paused',
      spritePaused: 'shallowrecall:l2d-sprite-paused',
      collapsed: 'shallowrecall:l2d-collapsed'
    },
    // 动作组名 -> 中文标签（组名来自 model3.json）
    motionLabels: {
      idle: '待机',
      aidale: '小动作',
      bubble: '吹泡泡',
      selfie: '自拍',
      selfiequick: '秒拍',
      ketchup: '番茄酱',
      openlid: '开盖',
      splash: '喷水'
    }
  };

  // 角色表：加人/换人只改这里
  var MODELS = [
    {
      id: 'dafeiyu',
      name: '大肥鱼',
      type: 'live2d',
      path: '/live2d/dafeiyu/c_0120.model3.json',
      scale: 1,
      credit: {
        text: '大肥鱼 © 上善无形 / ZipZipPipe / 氵六青 · CC BY-NC-SA 4.0',
        href: 'https://github.com/Andersen216/dsh-whale-girl-live2d'
      },
      lines: ['今天也要记得喝水。', '慢慢来，代码会写好的。', '累了就摸一会儿鱼。']
    },
    {
      id: 'claude',
      name: '克劳德',
      // 社区只有透明 WebM，暂无 Cubism 模型。把 idle.webm 放进
      // source/live2d/claude/ 即可自动生效；若拿到 Cubism 4 皮套，
      // 把 type 改成 'live2d'、path 指向 model3.json。
      type: 'video',
      path: '/live2d/claude/idle.webm',
      // 素材是 960x540 的透明 WebM，两侧留白很多；videoAspect = 可见宽度/高度
      videoAspect: 0.62,
      credit: {
        text: 'Claude 娘 · 同人二创动作包（Plaguedoctorhere）· 非商业自用',
        href: 'https://github.com/Plaguedoctorhere/dsh-pet-character-packs'
      },
      lines: ['先想清楚，再开始写。', '这个边界条件检查了吗？', '需要我陪你一起看代码吗？']
    },
    {
      id: 'longniang',
      name: '龙娘',
      // 龙娘（GPT 龙娘）同上：透明 WebM 放在 source/live2d/longniang/
      type: 'video',
      path: '/live2d/longniang/idle.webm',
      videoAspect: 0.62,
      credit: {
        text: '龙娘 · 同人二创动作包（Plaguedoctorhere）· 非商业自用',
        href: 'https://github.com/Plaguedoctorhere/dsh-pet-character-packs'
      },
      lines: ['龙娘在这里，继续写吧。', '坐久了要起来活动一下。', '今天也要有一点小进展。']
    }
  ];

  // AI 娘化图鉴：使用公开的 8×9 逐帧桌宠图集。原有三个角色保持不变。
  var GIJINKA_CHARACTERS = [
    {
      slug: 'deepseek',
      name: 'DeepSeek 娘',
      lines: ['蓝发鲸鱼娘，今天也在认真摸鱼。', '先喝口水，再继续写吧。']
    },
    {
      slug: 'gpt',
      name: 'GPT 娘',
      lines: ['小龙娘会陪你把这行代码看完。', '别忘了给今天留一点休息时间。']
    },
    {
      slug: 'claude',
      name: 'Claude 娘',
      file: 'claude-openpet',
      lines: ['先想清楚，再开始写。', '边界条件检查过了吗？']
    },
    {
      slug: 'grok',
      name: 'Grok 娘',
      lines: ['换个角度想想，也许答案就在旁边。', '犀利一点，但对自己温柔一点。']
    },
    {
      slug: 'gemini',
      name: 'Gemini 娘',
      lines: ['异色瞳正在寻找更好的解法。', '把问题拆小一点就好办了。']
    },
    {
      slug: 'kimi',
      name: 'Kimi 娘',
      lines: ['长文档也可以慢慢读完。', '需要我陪你梳理一下思路吗？']
    },
    {
      slug: 'glm',
      name: 'GLM 娘',
      lines: ['狐耳女仆已就位。', '今天的任务，一件一件完成。']
    },
    {
      slug: 'qwen',
      name: 'Qwen 娘',
      lines: ['蓝紫衣裙的小助手在这里。', '代码跑起来之前，先确认输入。']
    }
  ];

  GIJINKA_CHARACTERS.forEach(function (character) {
    MODELS.push({
      id: 'gijinka-' + character.slug,
      name: character.name,
      type: 'sprite',
      path: '/live2d/ai-gijinka/sprites/' + (character.file || character.slug) + '.webp',
      credit: {
        text: 'Q 版逐帧动作包 · ' + character.name + ' · 非商业展示',
        href: 'https://github.com/fywdy/chatgpt-chibi-pets'
      },
      lines: character.lines
    });
  });

  // 逐帧图集：8 列 × 9 行，单格 192 × 208。
  var SPRITE_ROWS = {
    idle: { row: 0, frames: 6, durations: [280, 110, 110, 140, 140, 320] },
    waving: { row: 3, frames: 4, durations: [140, 140, 140, 280] },
    jumping: { row: 4, frames: 5, durations: [140, 140, 140, 140, 280] },
    failed: { row: 5, frames: 8, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
    waiting: { row: 6, frames: 6, durations: [150, 150, 150, 150, 150, 260] },
    running: { row: 7, frames: 6, durations: [120, 120, 120, 120, 120, 220] },
    review: { row: 8, frames: 6, durations: [150, 150, 150, 150, 150, 280] }
  };

  var SPRITE_ACTIONS = [
    { id: 'waving', label: '挥挥手', line: '你好呀。' },
    { id: 'jumping', label: '跳一下', line: '跳一下，活动活动。' },
    { id: 'waiting', label: '等你回来', line: '我在这里等你。' },
    { id: 'running', label: '认真工作', line: '正在认真工作中。' },
    { id: 'review', label: '检查一下', line: '让我检查一下。' },
    { id: 'failed', label: '委屈一下', line: '这次没做好……' }
  ];

  // 立绘角色的手动动作。全部作用于整张透明立绘，不影响页面布局。
  var IMAGE_ACTIONS = [
    {
      id: 'jump',
      label: '跳一下',
      duration: 720,
      line: '跳一下，活动活动。',
      frames: [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-34px) scale(1.02)', offset: 0.32 },
        { transform: 'translateY(0) scale(0.985)', offset: 0.64 },
        { transform: 'translateY(-8px) scale(1.01)', offset: 0.82 },
        { transform: 'translateY(0) scale(1)' }
      ]
    },
    {
      id: 'shake',
      label: '摇摇头',
      duration: 760,
      line: '这样摇头是不行哦。',
      frames: [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-4deg)', offset: 0.18 },
        { transform: 'rotate(4deg)', offset: 0.38 },
        { transform: 'rotate(-3deg)', offset: 0.58 },
        { transform: 'rotate(2deg)', offset: 0.76 },
        { transform: 'rotate(0deg)' }
      ]
    },
    {
      id: 'swing',
      label: '开心摇摆',
      duration: 980,
      line: '今天也要开心一点。',
      frames: [
        { transform: 'translateY(0) rotate(-1deg)' },
        { transform: 'translateY(-9px) rotate(2.4deg)', offset: 0.24 },
        { transform: 'translateY(-4px) rotate(-2.4deg)', offset: 0.5 },
        { transform: 'translateY(-8px) rotate(1.6deg)', offset: 0.74 },
        { transform: 'translateY(0) rotate(-1deg)' }
      ]
    },
    {
      id: 'shy',
      label: '害羞',
      duration: 900,
      line: '别一直盯着看啦。',
      frames: [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(5px) scale(0.94)', offset: 0.3 },
        { transform: 'translateY(-2px) scale(1.025)', offset: 0.7 },
        { transform: 'translateY(0) scale(1)' }
      ]
    },
    {
      id: 'close',
      label: '靠近一点',
      duration: 760,
      line: '再靠近一点也可以。',
      frames: [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-7px) scale(1.085)', offset: 0.45 },
        { transform: 'translateY(0) scale(1)' }
      ]
    },
    {
      id: 'turn',
      label: '转身看看',
      duration: 980,
      line: '看看这边。',
      frames: [
        { transform: 'perspective(700px) rotateY(0deg)' },
        { transform: 'perspective(700px) rotateY(-17deg)', offset: 0.3 },
        { transform: 'perspective(700px) rotateY(17deg)', offset: 0.66 },
        { transform: 'perspective(700px) rotateY(0deg)' }
      ]
    }
  ];

  var REDUCE = false;
  try {
    REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  var state = {
    root: null,
    stage: null,
    btn: null,
    menu: null,
    bubble: null,
    bubbleTimer: null,
    current: null,
    entries: [], // [{item, available}]
    settingsById: {}, // model3.json 内容缓存
    variants: {}, // 图片角色的造型选择
    app: null,
    video: null,
    image: null,
    art: null,
    artTilt: null,
    artAnim: null,
    imagePaused: false,
    spriteCanvas: null,
    spriteCtx: null,
    spriteImage: null,
    spriteTimer: null,
    spriteEpoch: 0,
    spritePaused: false,
    variantBtn: null,
    model: null, // Live2DModel 实例
    ticker: null,
    pos: { x: CONFIG.left, y: CONFIG.bottom },
    collapsed: false,
    bound: false,
    expressionName: null
  };

  var warned = false;
  // 其余角色的后台素材探测；菜单先打开时立刻触发，不干等空闲
  var probeRestDeferred = null;
  function warn(msg, err) {
    if (warned) return;
    warned = true;
    if (err) console.warn('[live2d-mascot] ' + msg, err);
    else console.warn('[live2d-mascot] ' + msg);
  }

  function dirOf(p) {
    return p.replace(/\/[^/]+$/, '/');
  }

  function store(key, val) {
    try {
      window.localStorage.setItem(key, val);
    } catch (e) {}
  }

  function read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  /* ---------------- 素材探测 ---------------- */

  function probe(url) {
    if (typeof fetch !== 'function') return Promise.resolve(false);
    return fetch(url, { method: 'HEAD', cache: 'no-store' })
      .then(function (res) {
        return !!(res && res.ok);
      })
      .catch(function () {
        return false;
      });
  }

  function resolveModels() {
    return Promise.all(
      MODELS.map(function (item) {
        return probe(item.path).then(function (ok) {
          return { item: item, available: ok };
        });
      })
    );
  }

  // 读 model3.json，给「动作 / 表情」面板提供数据
  function loadSettings(item) {
    if (state.settingsById[item.id] !== undefined) return Promise.resolve(state.settingsById[item.id]);
    if (item.type !== 'live2d' || typeof fetch !== 'function') {
      state.settingsById[item.id] = null;
      return Promise.resolve(null);
    }
    return fetch(item.path, { cache: 'force-cache' })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (json) {
        var fr = (json && json.FileReferences) || {};
        var motions = Object.keys(fr.Motions || {}).filter(function (g) {
          return g !== 'idle';
        });
        var expressions = (fr.Expressions || []).map(function (e) {
          return e.Name || '';
        }).filter(Boolean);
        var out = { motions: motions, expressions: expressions };
        state.settingsById[item.id] = out;
        return out;
      })
      .catch(function () {
        state.settingsById[item.id] = null;
        return null;
      });
  }

  /* ---------------- DOM ---------------- */

  function buildShell() {
    var root = document.createElement('div');
    root.id = 'l2d-mascot';
    root.style.setProperty('--l2d-h', CONFIG.height + 'px');

    var stage = document.createElement('div');
    stage.className = 'l2d-stage';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'l2d-switch';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', '看板娘菜单');
    btn.title = '看板娘菜单';
    btn.textContent = '☺';

    var menu = document.createElement('ul');
    menu.className = 'l2d-menu';

    var bubble = document.createElement('div');
    bubble.className = 'l2d-bubble';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');
    bubble.setAttribute('aria-hidden', 'true');

    stage.appendChild(bubble);
    stage.appendChild(btn);
    stage.appendChild(menu);
    root.appendChild(stage);
    document.body.appendChild(root);

    state.root = root;
    state.stage = stage;
    state.btn = btn;
    state.menu = menu;
    state.bubble = bubble;

    applyPos();

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });

    if (!state.bound) {
      state.bound = true;
      document.addEventListener('click', function (e) {
        if (!state.root || !state.root.contains(e.target)) closeMenu();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMenu();
      });
    }

    return root;
  }

  function applyPos() {
    if (!state.root) return;
    state.root.style.left = state.pos.x + 'px';
    state.root.style.bottom = state.pos.y + 'px';
  }

  function clampPos() {
    var vw = window.innerWidth || 1024;
    var vh = window.innerHeight || 768;
    var maxX = Math.max(0, vw - 60);
    var maxY = Math.max(0, vh - 60);
    state.pos.x = Math.min(Math.max(state.pos.x, -160), maxX);
    state.pos.y = Math.min(Math.max(state.pos.y, 0), maxY);
  }

  function buildMenu() {
    var menu = state.menu;
    menu.textContent = '';

    function section(title) {
      var li = document.createElement('li');
      li.className = 'l2d-sec';
      li.textContent = title;
      menu.appendChild(li);
    }

    function entry(label, opts) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.appendChild(document.createTextNode(label));
      if (opts.title) b.title = opts.title;
      if (opts.current) b.setAttribute('aria-current', 'true');
      if (opts.disabled) b.disabled = true;
      else if (opts.onClick) b.addEventListener('click', opts.onClick);
      li.appendChild(b);
      menu.appendChild(li);
      return b;
    }

    // ---- 角色 ----
    section('角色');
    state.entries.forEach(function (en) {
      var item = en.item;
      var checking = en.available === null;
      entry(item.name, {
        disabled: checking || !en.available,
        current: state.current && state.current.id === item.id,
        title: checking
          ? '正在检测素材…'
          : en.available
            ? state.current && state.current.id === item.id
              ? '当前角色'
              : '切换到' + item.name
            : '素材未放置：把模型放到 ' + dirOf(item.path) + ' 后刷新即可',
        onClick: function () {
          if (state.current && state.current.id === item.id) return;
          closeMenu();
          switchTo(item);
        }
      });
    });

    // ---- 动作 / 表情（Live2D 使用模型动作，立绘使用手动动效）----
    var settings = state.current ? state.settingsById[state.current.id] : null;
    var isImage = !!(state.current && state.current.type === 'image');
    var isSprite = !!(state.current && state.current.type === 'sprite');

    if (settings && settings.motions && settings.motions.length) {
      section('动作');
      settings.motions.forEach(function (group) {
        var label = CONFIG.motionLabels[group] || group;
        entry(label, {
          title: '播放动作：' + label,
          onClick: function () {
            closeMenu();
            if (state.model) playMotion(state.model, group);
          }
        });
      });
    }

    if (isImage) {
      section('动作');
      IMAGE_ACTIONS.forEach(function (action) {
        entry(action.label, {
          title: '播放动作：' + action.label,
          onClick: function () {
            closeMenu();
            playImageAction(action, true);
          }
        });
      });
    }

    if (isSprite) {
      section('动作');
      SPRITE_ACTIONS.forEach(function (action) {
        entry(action.label, {
          title: '播放动作：' + action.label,
          onClick: function () {
            closeMenu();
            playSpriteAction(action, true);
          }
        });
      });
    }

    if (settings && settings.expressions && settings.expressions.length) {
      section('表情');
      entry('还原表情', {
        title: '清掉当前表情',
        onClick: function () {
          resetExpression();
        }
      });
      settings.expressions.forEach(function (name) {
        entry(name, {
          current: state.expressionName === name,
          title: '表情：' + name,
          onClick: function () {
            applyExpression(name);
          }
        });
      });
    }

    // ---- 造型（目前只有 DeepSeek 娘有 Q 版）----
    if (state.current && state.current.variants && state.current.variants.q) {
      section('造型');
      var qActive = variantKey(state.current) === 'q';
      entry(qActive ? '切换原版立绘' : '切换 Q 版立绘', {
        current: qActive,
        title: qActive ? '恢复常规比例立绘' : '切换到 Q 版立绘',
        onClick: function () {
          toggleVariant(state.current);
          closeMenu();
        }
      });
    }

    // ---- 设置 ----
    section('设置');
    if (isSprite) {
      entry(state.spritePaused ? '恢复待机动画' : '暂停待机动画', {
        title: state.spritePaused ? '继续逐帧待机动画' : '暂停逐帧待机动画',
        onClick: function () {
          setSpritePaused(!state.spritePaused);
          closeMenu();
        }
      });
    }
    if (isImage) {
      entry(state.imagePaused ? '恢复待机动作' : '暂停待机动作', {
        title: state.imagePaused ? '继续自动呼吸和摇摆' : '暂停自动呼吸和摇摆',
        onClick: function () {
          setImagePaused(!state.imagePaused);
          closeMenu();
        }
      });
    }
    entry('复位位置', {
      title: '把看板娘放回左下角',
      onClick: function () {
        state.pos.x = CONFIG.left;
        state.pos.y = CONFIG.bottom;
        applyPos();
        store(CONFIG.storage.pos, JSON.stringify(state.pos));
        closeMenu();
      }
    });
    entry(state.collapsed ? '展开看板娘' : '收起看板娘', {
      title: state.collapsed ? '把看板娘叫回来' : '暂时收起，随时可叫回',
      onClick: function () {
        setCollapsed(!state.collapsed);
        closeMenu();
      }
    });

    // ---- 署名 ----
    var credit = state.current && state.current.credit;
    if (credit) {
      var li = document.createElement('li');
      var box = document.createElement('span');
      box.className = 'l2d-credit';
      var a = document.createElement('a');
      a.href = credit.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer nofollow';
      a.textContent = credit.text;
      box.appendChild(a);
      li.appendChild(box);
      menu.appendChild(li);
    }
  }

  function hideBubble() {
    if (state.bubbleTimer) {
      clearTimeout(state.bubbleTimer);
      state.bubbleTimer = null;
    }
    if (!state.bubble) return;
    state.bubble.classList.remove('is-visible');
    state.bubble.setAttribute('aria-hidden', 'true');
  }

  function showBubble(text, duration) {
    if (!state.bubble || !text) return;
    if (state.bubbleTimer) clearTimeout(state.bubbleTimer);
    state.bubble.textContent = text;
    state.bubble.setAttribute('aria-hidden', 'false');
    state.bubble.classList.add('is-visible');
    state.bubbleTimer = setTimeout(hideBubble, duration || CONFIG.bubbleDuration);
  }

  function pickLine() {
    var lines = (state.current && state.current.lines) || [];
    if (!lines.length) return '今天也要好好生活。';
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function showGreeting() {
    if (state.collapsed) return;
    showBubble(pickLine(), 7200);
  }

  function reactBubble() {
    if (!state.stage || REDUCE) {
      showBubble(pickLine(), 4800);
      return;
    }
    state.stage.classList.remove('is-reacting');
    void state.stage.offsetWidth;
    state.stage.classList.add('is-reacting');
    setTimeout(function () {
      if (state.stage) state.stage.classList.remove('is-reacting');
    }, 520);
    showBubble(pickLine(), 4800);
  }

  function openMenu() {
    hideBubble();
    if (probeRestDeferred) probeRestDeferred();
    // 每次打开都重建，保证「当前角色 / 当前表情 / 收起状态」是最新的
    loadSettings(state.current || {}).then(buildMenu);
    state.menu.classList.add('is-open');
    state.btn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    if (!state.menu) return;
    state.menu.classList.remove('is-open');
    state.btn.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    if (state.menu.classList.contains('is-open')) closeMenu();
    else openMenu();
  }

  /* ---------------- 渲染器 ---------------- */

  function teardown() {
    hideBubble();
    if (state.ticker) {
      clearInterval(state.ticker);
      state.ticker = null;
    }
    if (state.app) {
      try {
        state.app.destroy(true, { children: true, texture: true, baseTexture: true });
      } catch (e) {}
      state.app = null;
    }
    if (state.video) {
      try {
        state.video.pause();
        state.video.removeAttribute('src');
        state.video.load();
        state.video.remove();
      } catch (e) {}
      state.video = null;
    }
    state.model = null;
    state.expressionName = null;
    stopSpriteTimer();
    state.spriteEpoch += 1;
    state.spriteCanvas = null;
    state.spriteCtx = null;
    state.spriteImage = null;
    if (state.artAnim) {
      try {
        state.artAnim.cancel();
      } catch (e) {}
      state.artAnim = null;
    }
    state.image = null;
    state.art = null;
    state.artTilt = null;
    state.variantBtn = null;
    if (state.stage) {
      Array.prototype.slice.call(state.stage.children).forEach(function (el) {
        if (el !== state.btn && el !== state.menu && el !== state.bubble) el.remove();
      });
    }
  }

  function playMotion(model, group) {
    try {
      var p = model.motion(group);
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }

  function applyExpression(name) {
    var model = state.model;
    if (!model) return;
    try {
      var p = model.expression(name);
      if (p && typeof p.catch === 'function') p.catch(function () {});
      state.expressionName = name;
    } catch (e) {}
    buildMenu();
  }

  function resetExpression() {
    var model = state.model;
    if (!model) return;
    try {
      var im = model.internalModel;
      if (im && im.expressionManager && im.expressionManager.resetExpression) {
        im.expressionManager.resetExpression();
      } else {
        model.expression();
      }
    } catch (e) {}
    state.expressionName = null;
    buildMenu();
  }

  function randomReact() {
    if (state.current && state.current.type === 'sprite' && !REDUCE) {
      playSpriteAction(SPRITE_ACTIONS[Math.floor(Math.random() * SPRITE_ACTIONS.length)], true);
      return;
    }
    var model = state.model;
    reactBubble();
    if (state.current && state.current.type === 'image' && !REDUCE) {
      playImageAction(IMAGE_ACTIONS[Math.floor(Math.random() * IMAGE_ACTIONS.length)], false);
      return;
    }
    if (!model || REDUCE) return;
    var settings = state.settingsById[state.current.id];
    if (!settings) return;
    if (settings.motions && settings.motions.length) {
      playMotion(model, settings.motions[Math.floor(Math.random() * settings.motions.length)]);
    }
    if (settings.expressions && settings.expressions.length) {
      var name = settings.expressions[Math.floor(Math.random() * settings.expressions.length)];
      try {
        var p = model.expression(name);
        if (p && typeof p.catch === 'function') p.catch(function () {});
        state.expressionName = name;
      } catch (e) {}
    }
  }

  function playImageAction(action, announce) {
    if (
      !action ||
      REDUCE ||
      !state.art ||
      !state.art.isConnected ||
      typeof state.art.animate !== 'function'
    ) {
      return;
    }
    if (state.artAnim) {
      try {
        state.artAnim.cancel();
      } catch (e) {}
    }
    var anim = state.art.animate(action.frames, {
      duration: action.duration,
      easing: 'cubic-bezier(0.2, 0.82, 0.25, 1)',
      fill: 'none'
    });
    state.artAnim = anim;
    anim.onfinish = function () {
      if (state.artAnim === anim) state.artAnim = null;
    };
    anim.oncancel = function () {
      if (state.artAnim === anim) state.artAnim = null;
    };
    if (announce) showBubble(action.line || pickLine(), 4600);
  }

  function setImagePaused(value) {
    state.imagePaused = !!value;
    store(CONFIG.storage.imagePaused, state.imagePaused ? '1' : '0');
    if (state.art) state.art.classList.toggle('is-motion-paused', state.imagePaused);
    if (state.imagePaused && state.artTilt) {
      state.artTilt.style.setProperty('--l2d-tilt-x', '0deg');
      state.artTilt.style.setProperty('--l2d-tilt-y', '0deg');
    }
    if (state.imagePaused && state.artAnim) {
      try {
        state.artAnim.cancel();
      } catch (e) {}
      state.artAnim = null;
    }
  }

  function stopSpriteTimer() {
    if (state.spriteTimer) {
      clearTimeout(state.spriteTimer);
      state.spriteTimer = null;
    }
  }

  function drawSpriteFrame(row, col) {
    var canvas = state.spriteCanvas;
    var ctx = state.spriteCtx;
    var img = state.spriteImage;
    if (!canvas || !ctx || !img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, col * 192, row * 208, 192, 208, 0, 0, canvas.width, canvas.height);
  }

  function playSpriteRow(key, loop, onDone) {
    var spec = SPRITE_ROWS[key];
    if (!spec || !state.spriteImage || !state.spriteCtx) return;
    stopSpriteTimer();
    var epoch = state.spriteEpoch;
    var index = 0;

    function step() {
      if (epoch !== state.spriteEpoch || !state.spriteImage) return;
      drawSpriteFrame(spec.row, index);
      var delay = spec.durations[index] || 150;
      index += 1;

      if (index >= spec.frames) {
        if (loop) {
          index = 0;
        } else {
          state.spriteTimer = setTimeout(function () {
            if (epoch !== state.spriteEpoch) return;
            if (onDone) onDone();
            else if (!state.spritePaused) playSpriteRow('idle', true);
          }, delay);
          return;
        }
      }
      state.spriteTimer = setTimeout(step, delay);
    }

    step();
  }

  function playSpriteAction(action, announce) {
    if (!action || REDUCE || !state.spriteImage) return;
    playSpriteRow(action.id, false, function () {
      if (!state.spritePaused) playSpriteRow('idle', true);
    });
    if (announce) showBubble(action.line || pickLine(), 4600);
  }

  function setSpritePaused(value) {
    state.spritePaused = !!value;
    store(CONFIG.storage.spritePaused, state.spritePaused ? '1' : '0');
    if (state.spritePaused) stopSpriteTimer();
    else if (state.current && state.current.type === 'sprite') playSpriteRow('idle', true);
  }

  // 拖动 + 单击（拖过就不算点击）
  function enableDrag(el) {
    var start = null;
    var moved = false;

    el.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, left: state.pos.x, bottom: state.pos.y };
      moved = false;
      if (el.setPointerCapture) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    });

    el.addEventListener('pointermove', function (e) {
      if (!start) return;
      var dx = e.clientX - start.x;
      var dy = e.clientY - start.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      moved = true;
      state.pos.x = start.left + dx;
      state.pos.y = start.bottom - dy;
      clampPos();
      applyPos();
    });

    el.addEventListener('pointerup', function () {
      if (!start) return;
      var wasMoved = moved;
      start = null;
      if (wasMoved) {
        store(CONFIG.storage.pos, JSON.stringify(state.pos));
      } else {
        randomReact();
      }
    });

    el.addEventListener('pointercancel', function () {
      start = null;
    });

    el.addEventListener('dblclick', function () {
      state.pos.x = CONFIG.left;
      state.pos.y = CONFIG.bottom;
      applyPos();
      store(CONFIG.storage.pos, JSON.stringify(state.pos));
    });
  }

  function renderLive2d(item) {
    var PIXI = window.PIXI;
    var live2d = PIXI && PIXI.live2d;
    if (!live2d || !live2d.Live2DModel) {
      return Promise.reject(
        new Error('pixi-live2d-display / Cubism Core 未加载，检查 inject.bottom 的脚本顺序')
      );
    }

    var app = new PIXI.Application({
      transparent: true,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      width: 1,
      height: CONFIG.height
    });
    app.view.setAttribute('role', 'img');
    app.view.setAttribute('aria-label', item.name);
    state.app = app;
    state.stage.insertBefore(app.view, state.btn);

    return live2d.Live2DModel.from(item.path, {
      autoInteract: !REDUCE,
      idleMotionGroup: 'idle'
    }).then(function (model) {
      app.stage.addChild(model);
      state.model = model;

      // 用未缩放的局部包围盒算缩放，避免不同版本 width/height 语义差异
      var box = model.getLocalBounds();
      var srcH = box.height || 1;
      var s = (CONFIG.height / srcH) * (item.scale || 1);
      model.scale.set(s);
      model.x = -box.x * s + 6;
      model.y = CONFIG.height - (box.y + box.height) * s;
      app.renderer.resize(Math.max(1, Math.ceil(box.width * s + 12)), CONFIG.height);

      playMotion(model, 'idle');
      enableDrag(app.view);

      var settings = state.settingsById[item.id];
      var extras = (settings && settings.motions) || [];
      if (!REDUCE && CONFIG.extraMotionInterval > 0 && extras.length) {
        state.ticker = setInterval(function () {
          playMotion(model, extras[Math.floor(Math.random() * extras.length)]);
        }, CONFIG.extraMotionInterval);
      }
    });
  }

  /* ---- 视频类角色自适应：量出人物在画面里的包围盒，再缩放到看板娘框内 ---- */

  // 把「可见包围盒」映射到目标框：纯函数，便于离线验证
  function computeFit(bbox, videoW, videoH, targetH, pad) {
    if (!bbox || !(bbox.width > 0) || !(bbox.height > 0)) return null;
    if (!(videoW > 0) || !(videoH > 0)) return null;

    var scale = (targetH - pad * 2) / bbox.height;
    return {
      scale: scale,
      boxW: Math.round(bbox.width * scale + pad * 2),
      boxH: targetH,
      // 视频元素自身的尺寸
      videoW: Math.round(videoW * scale),
      videoH: Math.round(videoH * scale),
      // 让包围盒左下角落在 (pad, targetH - pad)
      left: Math.round(pad - bbox.x * scale),
      top: Math.round(targetH - pad - (bbox.y + bbox.height) * scale)
    };
  }

  function unionBox(a, b) {
    if (!a) return b;
    if (!b) return a;
    var minX = Math.min(a.x, b.x);
    var minY = Math.min(a.y, b.y);
    var maxX = Math.max(a.x + a.width, b.x + b.width);
    var maxY = Math.max(a.y + a.height, b.y + b.height);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  // 扫描一帧的非透明像素范围（隔 2 像素采样，够用且快）
  function scanAlpha(ctx, w, h) {
    var data;
    try {
      data = ctx.getImageData(0, 0, w, h).data;
    } catch (e) {
      return null;
    }
    var minX = w;
    var minY = h;
    var maxX = -1;
    var maxY = -1;
    for (var y = 0; y < h; y += 2) {
      for (var x = 0; x < w; x += 2) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  // 抽几帧取并集，兼顾动作（挥手/走动）时的最大范围
  function measureAlphaBBox(video) {
    return new Promise(function (resolve) {
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      if (!vw || !vh) return resolve(null);

      var canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      var ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      var dur = isFinite(video.duration) ? video.duration : 0;
      var times = [0.15, 0.6, 1.2];
      var box = null;
      var i = 0;
      var done = false;

      var timer = setTimeout(finish, 2500);
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(box);
      }

      function next() {
        if (done) return;
        if (i >= times.length) return finish();
        var t = times[i];
        i += 1;
        if (dur && t > dur - 0.05) return next();

        var onSeeked = function () {
          video.removeEventListener('seeked', onSeeked);
          try {
            ctx.clearRect(0, 0, vw, vh);
            ctx.drawImage(video, 0, 0, vw, vh);
            box = unionBox(box, scanAlpha(ctx, vw, vh));
          } catch (e) {}
          next();
        };
        video.addEventListener('seeked', onSeeked);
        try {
          video.currentTime = t;
        } catch (e) {
          video.removeEventListener('seeked', onSeeked);
          next();
        }
      }

      next();
    });
  }

  function renderVideo(item) {
    var h = CONFIG.height;
    var pad = 6;
    // 量测完成前的临时尺寸，量完会按人物实际大小改掉
    var fallbackW = Math.max(1, Math.round(h * (item.videoAspect || 0.62)));

    var wrap = document.createElement('div');
    wrap.className = 'l2d-video';
    wrap.style.height = h + 'px';
    wrap.style.width = fallbackW + 'px';

    var video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-label', item.name);
    video.src = item.path;
    video.style.height = h + 'px';
    video.style.opacity = '0'; // 量好尺寸再显示，避免闪一下小图

    wrap.appendChild(video);
    state.video = video;
    state.stage.insertBefore(wrap, state.btn);
    enableDrag(wrap);

    function applyFit(fit) {
      if (!state.root || !wrap.isConnected) return;
      if (fit) {
        wrap.style.width = fit.boxW + 'px';
        wrap.style.height = fit.boxH + 'px';
        video.style.width = fit.videoW + 'px';
        video.style.height = fit.videoH + 'px';
        video.style.left = fit.left + 'px';
        video.style.top = fit.top + 'px';
        video.style.transform = 'none';
      }
      video.style.opacity = '1';
    }

    function start() {
      var p = video.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    }

    var measured = false;
    function onReady() {
      if (measured) return;
      measured = true;
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      // 先暂停再抽帧测量，避免边播边 seek 的不确定性
      try {
        video.pause();
      } catch (e) {}
      measureAlphaBBox(video)
        .then(function (box) {
          applyFit(computeFit(box, vw, vh, h, pad));
          try {
            video.currentTime = 0;
          } catch (e) {}
          start();
        })
        .catch(function () {
          applyFit(null);
          start();
        });
    }

    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('error', function () {
      onReady();
    });

    // 兜底：3 秒还没量出来就直接按临时尺寸显示，避免一直隐身
    setTimeout(function () {
      if (!measured) {
        measured = true;
        applyFit(null);
        start();
      }
    }, 3000);

    return Promise.resolve();
  }

  /* ---- 静态立绘角色：按 300px 高显示，可选 Q 版 ---- */

  function variantKey(item) {
    if (!item || !item.variants || !item.variants.q) return 'normal';
    return state.variants[item.id] === 'q' ? 'q' : 'normal';
  }

  function variantSource(item, key) {
    if (key === 'q' && item.variants && item.variants.q) return item.variants.q;
    return null;
  }

  function syncVariantButton(item, key) {
    if (!state.variantBtn) return;
    var qActive = key === 'q';
    state.variantBtn.textContent = qActive ? '原版' : 'Q版';
    state.variantBtn.title = qActive ? '切换到原版立绘' : '切换到 Q 版立绘';
    state.variantBtn.setAttribute('aria-label', state.variantBtn.title);
    state.variantBtn.setAttribute('aria-pressed', qActive ? 'true' : 'false');
  }

  function applyVariant(item, key) {
    var source = variantSource(item, key);
    if (state.image) {
      state.image.src = source ? source.path : item.path;
      state.image.alt = item.name + (source ? ' · ' + source.label : '');
    }
    syncVariantButton(item, key);
  }

  function toggleVariant(item) {
    if (!item || !item.variants || !item.variants.q) return;
    var next = variantKey(item) === 'q' ? 'normal' : 'q';
    state.variants[item.id] = next;
    store(CONFIG.storage.variant, JSON.stringify(state.variants));
    applyVariant(item, next);
    if (state.menu && state.menu.classList.contains('is-open')) buildMenu();
  }

  function renderSprite(item) {
    var canvas = document.createElement('canvas');
    canvas.className = 'l2d-sprite-canvas';
    canvas.width = 384;
    canvas.height = 416;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', item.name + ' Q 版动态桌宠');

    var ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('无法创建精灵图 Canvas'));
    ctx.imageSmoothingEnabled = true;

    var epoch = state.spriteEpoch + 1;
    state.spriteEpoch = epoch;
    state.spriteCanvas = canvas;
    state.spriteCtx = ctx;
    state.spriteImage = null;

    state.stage.insertBefore(canvas, state.btn);
    enableDrag(canvas);

    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        if (epoch !== state.spriteEpoch) return;
        state.spriteImage = img;
        drawSpriteFrame(SPRITE_ROWS.idle.row, 0);
        if (!state.spritePaused && !REDUCE) playSpriteRow('idle', true);
        resolve();
      };
      img.onerror = function () {
        reject(new Error('动态桌宠图集加载失败：' + item.path));
      };
      img.src = item.path;
    });
  }

  function renderImage(item) {
    var key = variantKey(item);
    var source = variantSource(item, key);

    var figure = document.createElement('div');
    figure.className = 'l2d-art';

    var tilt = document.createElement('div');
    tilt.className = 'l2d-art-tilt';

    var img = document.createElement('img');
    img.alt = item.name + (source ? ' · ' + source.label : '');
    img.decoding = 'async';
    img.draggable = false;
    tilt.appendChild(img);

    state.art = figure;
    state.artTilt = tilt;
    state.image = img;
    figure.classList.toggle('is-motion-paused', state.imagePaused);

    if (item.variants && item.variants.q) {
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'l2d-variant';
      state.variantBtn = toggle;
      syncVariantButton(item, key);
      toggle.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
      });
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleVariant(item);
      });
      figure.appendChild(toggle);
    }

    figure.insertBefore(tilt, figure.firstChild);
    state.stage.insertBefore(figure, state.btn);
    enableDrag(figure);
    enableArtParallax(figure, tilt);

    return new Promise(function (resolve) {
      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        img.classList.add('is-loaded');
        resolve();
      }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      img.src = source ? source.path : item.path;
      if (img.complete) done();
    });
  }

  function enableArtParallax(figure, tilt) {
    if (REDUCE || !tilt) return;
    var frame = 0;
    var pending = null;

    function apply() {
      frame = 0;
      if (!pending || !tilt.isConnected) return;
      tilt.style.setProperty('--l2d-tilt-x', pending.x.toFixed(2) + 'deg');
      tilt.style.setProperty('--l2d-tilt-y', pending.y.toFixed(2) + 'deg');
    }

    figure.addEventListener('pointermove', function (e) {
      if (state.imagePaused) return;
      var rect = figure.getBoundingClientRect();
      if (!(rect.width > 0) || !(rect.height > 0)) return;
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      pending = { x: -y * 4.5, y: x * 5.5 };
      if (!frame) frame = window.requestAnimationFrame(apply);
    });

    function reset() {
      pending = { x: 0, y: 0 };
      if (!frame) frame = window.requestAnimationFrame(apply);
    }

    figure.addEventListener('pointerleave', reset);
    figure.addEventListener('pointercancel', reset);
  }

  function render(item) {
    teardown();
    state.current = item;
    if (state.root) state.root.classList.remove('is-hidden');

    return loadSettings(item)
      .then(function () {
        if (item.type === 'sprite') return renderSprite(item);
        if (item.type === 'image') return renderImage(item);
        return item.type === 'video' ? renderVideo(item) : renderLive2d(item);
      })
      .then(function () {
        showGreeting();
      })
      .catch(function (err) {
        warn('渲染「' + item.name + '」失败：' + item.path, err);
        teardown();
        if (state.root) state.root.classList.add('is-hidden');
      });
  }

  function switchTo(item) {
    store(CONFIG.storage.model, item.id);
    return render(item).then(buildMenu);
  }

  /* ---------------- 收起 / 展开 ---------------- */

  function setCollapsed(v) {
    state.collapsed = !!v;
    store(CONFIG.storage.collapsed, state.collapsed ? '1' : '0');
    if (state.root) state.root.classList.toggle('is-collapsed', state.collapsed);
    if (state.collapsed) hideBubble();
    else if (state.current) showGreeting();
    if (state.btn) {
      state.btn.textContent = state.collapsed ? '🐟' : '☺';
      state.btn.title = state.collapsed ? '展开看板娘' : '看板娘菜单';
    }
  }

  /* ---------------- 生命周期 ---------------- */

  function isMobile() {
    try {
      return window.matchMedia('(max-width: ' + CONFIG.mobileMaxWidth + 'px)').matches;
    } catch (e) {
      return false;
    }
  }

  function restorePrefs() {
    // 位置：优先用记住的
    try {
      var saved = JSON.parse(read(CONFIG.storage.pos) || 'null');
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
        state.pos = { x: saved.x, y: saved.y };
      }
    } catch (e) {}

    try {
      var savedVariants = JSON.parse(read(CONFIG.storage.variant) || '{}');
      if (savedVariants && typeof savedVariants === 'object') {
        state.variants = savedVariants;
      }
    } catch (e) {}

    state.imagePaused = read(CONFIG.storage.imagePaused) === '1';
    state.spritePaused = read(CONFIG.storage.spritePaused) === '1';
  }

  // 首屏只探测「要显示的那个角色」，其余角色的可用性交给后台补探测：
  // 11 个 HEAD 全部等完再渲染，等于把看板娘的出现推迟了一个最慢请求的时延。
  function boot() {
    if (state.root) return;
    if (isMobile()) return;

    restorePrefs();

    var savedModel = read(CONFIG.storage.model);
    var candidates = MODELS.filter(function (m) {
      return m.id === savedModel;
    }).concat(
      MODELS.filter(function (m) {
        return m.id !== savedModel;
      })
    );

    // available: null 表示还没探测到，菜单里显示「检测中」
    state.entries = MODELS.map(function (item) {
      return { item: item, available: null };
    });

    var started = false;
    function attempt(index) {
      if (started || index >= candidates.length) {
        if (!started) {
          warn(
            '没有任何可用模型素材，看板娘不渲染。可放置位置：' +
              MODELS.map(function (m) {
                return m.path;
              }).join(' / ')
          );
        }
        return;
      }
      probe(candidates[index].path).then(function (ok) {
        if (!ok) return attempt(index + 1);
        if (started || state.root) return;
        started = true;
        startWith(candidates[index]);
      });
    }
    attempt(0);

    // 其余角色的可用性只在第一次打开角色菜单时探测：
    // 不开菜单的访客，页面只拉当前角色的素材，一个多余的请求都不发。
    var probing = false;
    probeRestDeferred = function () {
      if (probing) return;
      probing = true;
      probeRestDeferred = null;
      resolveModels().then(function (entries) {
        state.entries = entries;
        if (!started) return;
        // 菜单开着就把「检测中 / 不可用」更新掉
        if (state.menu && state.menu.classList.contains('is-open')) buildMenu();
      });
    };
  }

  function startWith(item) {
    buildShell();
    clampPos();
    applyPos();

    // 有素材就把按钮露出来（只有一个角色也给，否则用户找不到入口）
    state.btn.classList.add('is-visible');

    if (read(CONFIG.storage.collapsed) === '1') setCollapsed(true);

    render(item).then(buildMenu);
  }

  function ensureMounted() {
    if (state.root && document.body.contains(state.root)) return;
    state.root = null;
    boot();
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  // 给离线验证用：暴露纯函数，不参与运行时逻辑
  window.__l2dMascotInternals = {
    computeFit: computeFit,
    unionBox: unionBox,
    scanAlpha: scanAlpha
  };

  onReady(boot);
  document.addEventListener('pjax:complete', ensureMounted);
  window.addEventListener('resize', function () {
    clampPos();
    applyPos();
  });
})();
