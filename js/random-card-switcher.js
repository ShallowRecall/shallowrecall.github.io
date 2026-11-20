(() => {
  const EYE_DESIGN = "eye";
  const designs = [
    { id: "portal", label: "传送门", title: "随便逛逛", desc: "随机抵达一篇文章" },
    { id: "terminal", label: "终端", title: "随便逛逛", desc: "执行一次随机访问" },
    { id: "plane", label: "纸飞机", title: "随便逛逛", desc: "飞向一篇未知文章" },
    { id: "box", label: "盲盒", title: "抽一篇文章", desc: "打开一个知识盲盒" },
    { id: "stars", label: "星图", title: "随机跃迁", desc: "前往一个文章节点" },
    { id: EYE_DESIGN, label: "眼睛", title: "随便逛逛", desc: "他们正在盯着下一篇文章" },
  ];
  const cycleDuration = 60 * 60 * 1000;
  const switchInterval = Math.round(cycleDuration / designs.length);
  const randomCardSelector = "#recent-posts > .swiper_container_card #random";
  const sceneSelector = `${randomCardSelector} .rce-stage`;
  const state = {
    mouseX: window.innerWidth / 2,
    mouseY: window.innerHeight / 2,
    purpleBlinking: false,
    blackBlinking: false,
  };

  let renderFrame = 0;
  let activeScene = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const getSceneVisual = () => `
    <div class="rce-stage" aria-hidden="true">
      <div class="rce-scene">
        <div class="rce-character rce-purple" data-rce-character="purple">
          <div class="rce-face rce-face-slow rce-purple-face" data-rce-face="purple">
            <span class="rce-eye" data-rce-eye="purple-1"><i class="rce-pupil" data-rce-pupil="purple-1"></i></span>
            <span class="rce-eye" data-rce-eye="purple-2"><i class="rce-pupil" data-rce-pupil="purple-2"></i></span>
          </div>
        </div>

        <div class="rce-character rce-black" data-rce-character="black">
          <div class="rce-face rce-face-slow rce-black-face" data-rce-face="black">
            <span class="rce-eye" data-rce-eye="black-1"><i class="rce-pupil" data-rce-pupil="black-1"></i></span>
            <span class="rce-eye" data-rce-eye="black-2"><i class="rce-pupil" data-rce-pupil="black-2"></i></span>
          </div>
        </div>

        <div class="rce-character rce-orange" data-rce-character="orange">
          <div class="rce-face rce-face-fast rce-orange-face" data-rce-face="orange">
            <i class="rce-pupil" data-rce-pupil="orange-1"></i>
            <i class="rce-pupil" data-rce-pupil="orange-2"></i>
          </div>
        </div>

        <div class="rce-character rce-yellow" data-rce-character="yellow">
          <div class="rce-face rce-face-fast rce-yellow-face" data-rce-face="yellow">
            <i class="rce-pupil" data-rce-pupil="yellow-1"></i>
            <i class="rce-pupil" data-rce-pupil="yellow-2"></i>
          </div>
          <i class="rce-mouth" data-rce-mouth></i>
        </div>
      </div>
    </div>`;

  const getEyeLinkVisual = () => `
    <span class="rce-brand">
      <span class="rce-brand-mark"><img src="/img/favicon.png" alt=""></span>
      <strong>ShallowRecall</strong>
    </span>
    <span class="rce-copy">
      <strong>随便逛逛 <span class="rce-arrow" aria-hidden="true">→</span></strong>
      <small>他们正在盯着下一篇文章</small>
    </span>`;

  const getElements = scene => ({
    purpleCharacter: scene.querySelector('[data-rce-character="purple"]'),
    blackCharacter: scene.querySelector('[data-rce-character="black"]'),
    orangeCharacter: scene.querySelector('[data-rce-character="orange"]'),
    yellowCharacter: scene.querySelector('[data-rce-character="yellow"]'),
    purpleFace: scene.querySelector('[data-rce-face="purple"]'),
    blackFace: scene.querySelector('[data-rce-face="black"]'),
    orangeFace: scene.querySelector('[data-rce-face="orange"]'),
    yellowFace: scene.querySelector('[data-rce-face="yellow"]'),
    yellowMouth: scene.querySelector('[data-rce-mouth]'),
    purpleEye1: scene.querySelector('[data-rce-eye="purple-1"]'),
    purpleEye2: scene.querySelector('[data-rce-eye="purple-2"]'),
    blackEye1: scene.querySelector('[data-rce-eye="black-1"]'),
    blackEye2: scene.querySelector('[data-rce-eye="black-2"]'),
    purplePupil1: scene.querySelector('[data-rce-pupil="purple-1"]'),
    purplePupil2: scene.querySelector('[data-rce-pupil="purple-2"]'),
    blackPupil1: scene.querySelector('[data-rce-pupil="black-1"]'),
    blackPupil2: scene.querySelector('[data-rce-pupil="black-2"]'),
    orangePupil1: scene.querySelector('[data-rce-pupil="orange-1"]'),
    orangePupil2: scene.querySelector('[data-rce-pupil="orange-2"]'),
    yellowPupil1: scene.querySelector('[data-rce-pupil="yellow-1"]'),
    yellowPupil2: scene.querySelector('[data-rce-pupil="yellow-2"]'),
  });

  const calculatePupilPosition = (element, maxDistance) => {
    if (!element) return { x: 0, y: 0 };

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = state.mouseX - centerX;
    const deltaY = state.mouseY - centerY;
    const distance = Math.min(Math.hypot(deltaX, deltaY), maxDistance);
    const angle = Math.atan2(deltaY, deltaX);

    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  };

  const calculatePosition = element => {
    if (!element) return { faceX: 0, faceY: 0, bodySkew: 0 };

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 3;
    const deltaX = state.mouseX - centerX;
    const deltaY = state.mouseY - centerY;

    return {
      faceX: clamp(deltaX / 20, -15, 15),
      faceY: clamp(deltaY / 30, -10, 10),
      bodySkew: clamp(-deltaX / 120, -6, 6),
    };
  };

  const setPupilTranslation = (pupil, position) => {
    if (pupil) pupil.style.transform = `translate(${position.x}px, ${position.y}px)`;
  };

  const updateEyeBall = (eye, pupil, options) => {
    if (!eye || !pupil) return;

    const { size, maxDistance, blinking } = options;
    eye.style.width = `${size}px`;
    eye.style.height = blinking ? "2px" : `${size}px`;
    pupil.style.display = blinking ? "none" : "block";

    if (!blinking) {
      setPupilTranslation(pupil, calculatePupilPosition(eye, maxDistance));
    }
  };

  const updatePupil = (pupil, maxDistance) => {
    setPupilTranslation(pupil, calculatePupilPosition(pupil, maxDistance));
  };

  const render = () => {
    renderFrame = 0;
    const scene = document.querySelector(sceneSelector);
    if (!scene) return;

    if (activeScene !== scene) {
      activeScene = scene;
      scene._rceElements = getElements(scene);
    }

    const refs = scene._rceElements;
    if (!refs) return;

    const positions = {
      purple: calculatePosition(refs.purpleCharacter),
      black: calculatePosition(refs.blackCharacter),
      orange: calculatePosition(refs.orangeCharacter),
      yellow: calculatePosition(refs.yellowCharacter),
    };

    refs.purpleCharacter.style.transform = `skewX(${positions.purple.bodySkew}deg)`;
    refs.blackCharacter.style.transform = `skewX(${positions.black.bodySkew}deg)`;
    refs.orangeCharacter.style.transform = `skewX(${positions.orange.bodySkew}deg)`;
    refs.yellowCharacter.style.transform = `skewX(${positions.yellow.bodySkew}deg)`;

    refs.purpleFace.style.left = `${45 + positions.purple.faceX}px`;
    refs.purpleFace.style.top = `${40 + positions.purple.faceY}px`;
    refs.blackFace.style.left = `${26 + positions.black.faceX}px`;
    refs.blackFace.style.top = `${32 + positions.black.faceY}px`;
    refs.orangeFace.style.left = `${82 + positions.orange.faceX}px`;
    refs.orangeFace.style.top = `${90 + positions.orange.faceY}px`;
    refs.yellowFace.style.left = `${52 + positions.yellow.faceX}px`;
    refs.yellowFace.style.top = `${40 + positions.yellow.faceY}px`;
    refs.yellowMouth.style.left = `${40 + positions.yellow.faceX}px`;
    refs.yellowMouth.style.top = `${88 + positions.yellow.faceY}px`;

    updateEyeBall(refs.purpleEye1, refs.purplePupil1, {
      size: 18,
      maxDistance: 5,
      blinking: state.purpleBlinking,
    });
    updateEyeBall(refs.purpleEye2, refs.purplePupil2, {
      size: 18,
      maxDistance: 5,
      blinking: state.purpleBlinking,
    });
    updateEyeBall(refs.blackEye1, refs.blackPupil1, {
      size: 16,
      maxDistance: 4,
      blinking: state.blackBlinking,
    });
    updateEyeBall(refs.blackEye2, refs.blackPupil2, {
      size: 16,
      maxDistance: 4,
      blinking: state.blackBlinking,
    });
    updatePupil(refs.orangePupil1, 5);
    updatePupil(refs.orangePupil2, 5);
    updatePupil(refs.yellowPupil1, 5);
    updatePupil(refs.yellowPupil2, 5);
  };

  const scheduleRender = () => {
    if (!renderFrame) renderFrame = window.requestAnimationFrame(render);
  };

  const scheduleBlink = (key, delay = Math.random() * 4000 + 3000) => {
    window.setTimeout(() => {
      state[key] = true;
      scheduleRender();

      window.setTimeout(() => {
        state[key] = false;
        scheduleRender();
        scheduleBlink(key);
      }, 150);
    }, delay);
  };

  const getVisualHtml = id => {
    const visualMap = {
      portal: `
        <div class="rc-stage rc-portal-stage" aria-hidden="true">
          <i class="rc-portal-core"></i>
          <i class="rc-spark"></i>
          <i class="rc-spark"></i>
          <i class="rc-spark"></i>
        </div>`,
      terminal: `
        <div class="rc-stage rc-terminal-stage" aria-hidden="true">
          <span>&gt; random_post.exe</span>
          <span>&gt; scanning articles</span>
          <span>&gt; launch</span>
        </div>`,
      plane: `
        <div class="rc-stage rc-plane-stage" aria-hidden="true">
          <i class="rc-plane-shape"></i>
        </div>`,
      box: `
        <div class="rc-stage rc-box-stage" aria-hidden="true">
          <i class="rc-confetti"></i>
          <i class="rc-box-shape"></i>
        </div>`,
      stars: `
        <div class="rc-stage rc-stars-stage" aria-hidden="true">
          <i class="rc-warp-dot"></i>
        </div>`,
      [EYE_DESIGN]: getSceneVisual(),
    };

    return visualMap[id] || visualMap.portal;
  };

  const renderAction = (link, design) => {
    link.innerHTML = `
      <span class="rc-copy">
        <strong>${design.title}<span class="rc-arrow" aria-hidden="true">→</span></strong>
        <small>${design.desc}</small>
      </span>`;
  };

  const renderRandomCard = (random, designIndex = 0) => {
    if (!random) return;

    const normalizedIndex = ((designIndex % designs.length) + designs.length) % designs.length;
    const design = designs[normalizedIndex];
    const link = random.querySelector("#random-hover");
    if (!link) return;

    const oldStage = random.querySelector(".rce-stage, .rc-stage");
    if (oldStage) oldStage.remove();

    const oldSwitcher = random.querySelector(".rc-switcher");
    if (oldSwitcher) oldSwitcher.remove();

    random.classList.add("random-card-enhanced");
    random.dataset.design = design.id;
    random.dataset.designIndex = String(normalizedIndex);
    random.insertAdjacentHTML("afterbegin", getVisualHtml(design.id));

    if (design.id === EYE_DESIGN) {
      link.innerHTML = getEyeLinkVisual();
    } else {
      renderAction(link, design);
    }

    link.setAttribute("aria-label", "随便逛逛：随机打开一篇文章");
    activeScene = design.id === EYE_DESIGN ? null : activeScene;
    if (design.id === EYE_DESIGN) scheduleRender();
  };

  const startAutoCycle = random => {
    if (random._randomCardCycleTimer) clearInterval(random._randomCardCycleTimer);

    random._randomCardCycleTimer = setInterval(() => {
      if (!document.body.contains(random)) {
        clearInterval(random._randomCardCycleTimer);
        return;
      }

      const currentIndex = Number(random.dataset.designIndex || 0);
      renderRandomCard(random, currentIndex + 1);
    }, switchInterval);
  };

  const initRandomCard = (attempt = 0) => {
    const random = document.querySelector(randomCardSelector);
    if (!random || !random.querySelector("#random-hover")) {
      if (attempt < 40) window.setTimeout(() => initRandomCard(attempt + 1), 150);
      return;
    }

    if (!random._randomCardInitialized) {
      random._randomCardInitialized = true;
      renderRandomCard(random, designs.length - 1);
    }

    startAutoCycle(random);
  };

  window.addEventListener("pointermove", event => {
    state.mouseX = event.clientX;
    state.mouseY = event.clientY;
    if (document.body.contains(activeScene)) scheduleRender();
  }, { passive: true });

  window.addEventListener("resize", scheduleRender, { passive: true });

  document.addEventListener("DOMContentLoaded", () => initRandomCard());
  document.addEventListener("pjax:success", () => window.setTimeout(() => initRandomCard(), 300));
  initRandomCard();

  scheduleBlink("purpleBlinking");
  scheduleBlink("blackBlinking");
  scheduleRender();
})();
