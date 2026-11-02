(() => {
  const designs = [
    { id: "portal", label: "传送门", title: "随便逛逛", desc: "随机抵达一篇文章" },
    { id: "terminal", label: "终端", title: "随便逛逛", desc: "执行一次随机访问" },
    { id: "plane", label: "纸飞机", title: "随便逛逛", desc: "飞向一篇未知文章" },
    { id: "box", label: "盲盒", title: "抽一篇文章", desc: "打开一个知识盲盒" },
    { id: "stars", label: "星图", title: "随机跃迁", desc: "前往一个文章节点" },
    { id: "people", label: "小人", title: "随便逛逛", desc: "他们正在盯着下一篇文章" }
  ];

  const cycleDuration = 60 * 60 * 1000;
  const switchInterval = Math.round(cycleDuration / designs.length);

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
      people: `
        <div class="rc-stage rc-people-stage" aria-hidden="true">
          <i class="rc-mimic-orbit"></i>
          <span class="rc-person rc-p1">
            <i class="rc-head"><span class="rc-eye"><b></b></span><span class="rc-eye"><b></b></span></i>
          </span>
          <span class="rc-person rc-p2">
            <i class="rc-head"><span class="rc-eye"><b></b></span><span class="rc-eye"><b></b></span></i>
          </span>
          <span class="rc-person rc-p3">
            <i class="rc-head"><span class="rc-eye"><b></b></span><span class="rc-eye"><b></b></span></i>
          </span>
          <span class="rc-person rc-p4">
            <i class="rc-head"><span class="rc-eye"><b></b></span><span class="rc-eye"><b></b></span></i>
          </span>
        </div>`
    };

    return visualMap[id] || visualMap.portal;
  };

  const renderAction = (link, design) => {
    link.classList.add("rc-action");
    link.innerHTML = `
      <span class="rc-copy">
        <strong>${design.title}<span class="rc-arrow" aria-hidden="true">→</span></strong>
        <small>${design.desc}</small>
      </span>`;
  };

  const setupPeopleFollow = random => {
    const people = random.querySelectorAll(".rc-person");
    if (!people.length) return;

    if (random._randomCardBlinkTimer) clearInterval(random._randomCardBlinkTimer);

    if (!random._randomCardPeopleBound) {
      random._randomCardPeopleBound = true;

      random.addEventListener("pointermove", event => {
        if (random.dataset.design !== "people") return;

        const rect = random.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const lookX = Math.max(-4, Math.min(4, ((x / rect.width) - 0.5) * 10));
        const lookY = Math.max(-3, Math.min(3, ((y / rect.height) - 0.45) * 8));

        random.style.setProperty("--rc-look-x", `${lookX}px`);
        random.style.setProperty("--rc-look-y", `${lookY}px`);
      });

      random.addEventListener("pointerleave", () => {
        random.style.setProperty("--rc-look-x", "0px");
        random.style.setProperty("--rc-look-y", "0px");
      });
    }

    random._randomCardBlinkTimer = setInterval(() => {
      if (random.dataset.design !== "people") return;

      const person = people[Math.floor(Math.random() * people.length)];
      person.classList.add("is-blinking");
      window.setTimeout(() => person.classList.remove("is-blinking"), 260);
    }, 1300);
  };

  function renderRandomCard(random, designIndex = 0) {
    const normalizedIndex = ((designIndex % designs.length) + designs.length) % designs.length;
    const design = designs[normalizedIndex];
    const link = random.querySelector("#random-hover");
    if (!link) return;

    random.classList.add("random-card-enhanced");
    random.dataset.design = design.id;
    random.dataset.designIndex = String(normalizedIndex);

    const oldStage = random.querySelector(".rc-stage");
    if (oldStage) oldStage.remove();

    const oldSwitcher = random.querySelector(".rc-switcher");
    if (oldSwitcher) oldSwitcher.remove();

    random.insertAdjacentHTML("afterbegin", getVisualHtml(design.id));
    renderAction(link, design);

    if (design.id === "people") setupPeopleFollow(random);
    else if (random._randomCardBlinkTimer) clearInterval(random._randomCardBlinkTimer);
  }

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
    const random = document.querySelector("#recent-posts > .swiper_container_card #random");

    if (!random || !random.querySelector("#random-hover")) {
      if (attempt < 40) window.setTimeout(() => initRandomCard(attempt + 1), 150);
      return;
    }

    renderRandomCard(random, 5);
    startAutoCycle(random);
  };

  document.addEventListener("DOMContentLoaded", () => initRandomCard());
  document.addEventListener("pjax:success", () => window.setTimeout(() => initRandomCard(), 300));
  initRandomCard();
})();
