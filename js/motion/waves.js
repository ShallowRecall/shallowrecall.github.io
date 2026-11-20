/*
 * Vanilla Canvas2D adapter for the Waves effect used by moxuna.com.
 * Based on the React Bits Waves implementation and its original Perlin field.
 * Upstream: https://github.com/DavidHDev/react-bits
 */
const P = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];

class Vector2 {
  constructor(x, y) { this.x = x; this.y = y; }
  dot(other) { return this.x * other.x + this.y * other.y; }
}

class Perlin {
  constructor(seedValue) {
    this.gradients = [new Vector2(1,1),new Vector2(-1,1),new Vector2(1,-1),new Vector2(-1,-1),new Vector2(1,0),new Vector2(-1,0),new Vector2(1,0),new Vector2(-1,0),new Vector2(0,1),new Vector2(0,-1),new Vector2(0,1),new Vector2(0,-1)];
    this.permutation = [];
    this.gradientPermutation = [];
    this.seed(seedValue);
  }
  seed(value) {
    let seed = value;
    if (seed > 0 && seed < 1) seed *= 65536;
    seed = Math.floor(seed);
    if (seed < 256) seed |= seed << 8;
    for (let i = 0; i < 256; i += 1) {
      const v = i & 1 ? P[i] ^ (seed & 255) : P[i] ^ ((seed >> 8) & 255);
      this.permutation[i] = v;
      this.permutation[i + 256] = v;
      this.gradientPermutation[i] = this.gradients[v % 12];
      this.gradientPermutation[i + 256] = this.gradients[v % 12];
    }
  }
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(a, b, t) { return (1 - t) * a + t * b; }
  perlin2(x, y) {
    let xi = Math.floor(x);
    let yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    xi &= 255;
    yi &= 255;
    const g00 = this.gradientPermutation[xi + this.permutation[yi]].dot(new Vector2(xf, yf));
    const g10 = this.gradientPermutation[xi + 1 + this.permutation[yi]].dot(new Vector2(xf - 1, yf));
    const g01 = this.gradientPermutation[xi + this.permutation[yi + 1]].dot(new Vector2(xf, yf - 1));
    const g11 = this.gradientPermutation[xi + 1 + this.permutation[yi + 1]].dot(new Vector2(xf - 1, yf - 1));
    const u = this.fade(xf);
    return this.lerp(this.lerp(g00, g10, u), this.lerp(g01, g11, u), this.fade(yf));
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function mountWaves(container, userOptions = {}) {
  if (!container) return () => {};
  const options = {
    lineColor: '#ffffff',
    backgroundColor: '#111315',
    waveSpeedX: 0.01,
    waveSpeedY: 0.01,
    waveAmpX: 42,
    waveAmpY: 24,
    xGap: 12,
    yGap: 36,
    friction: 0.9,
    tension: 0.01,
    maxCursorMove: 120,
    ...userOptions
  };
  const canvas = document.createElement('canvas');
  canvas.className = 'waves__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    container.dataset.motionFallback = 'waves';
    return () => {};
  }
  container.appendChild(canvas);

  const noise = new Perlin(Math.random());
  const cursor = { x: -10, y: 0, lastX: 0, lastY: 0, smoothX: 0, smoothY: 0, smoothVelocity: 0, angle: 0, initialized: false };
  const view = { width: 1, height: 1 };
  const reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  let lines = [];
  let raf = 0;
  let visible = true;
  let time = 0;

  const resize = () => {
    const rect = container.getBoundingClientRect();
    view.width = Math.max(1, rect.width);
    view.height = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(view.width * dpr));
    canvas.height = Math.max(1, Math.round(view.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = Math.ceil((view.width + 200) / options.xGap);
    const rows = Math.ceil((view.height + 30) / options.yGap);
    const left = (view.width - options.xGap * cols) / 2;
    const top = (view.height - options.yGap * rows) / 2;
    lines = Array.from({ length: cols + 1 }, (_, col) => Array.from({ length: rows + 1 }, (_, row) => ({
      x: left + options.xGap * col,
      y: top + options.yGap * row,
      wave: { x: 0, y: 0 },
      cursor: { x: 0, y: 0, velocityX: 0, velocityY: 0 }
    })));
  };

  const onPointerMove = (event) => {
    const rect = container.getBoundingClientRect();
    cursor.x = event.clientX - rect.left;
    cursor.y = event.clientY - rect.top;
    if (!cursor.initialized) {
      cursor.smoothX = cursor.x;
      cursor.smoothY = cursor.y;
      cursor.lastX = cursor.x;
      cursor.lastY = cursor.y;
      cursor.initialized = true;
    }
    wake();
  };

  const point = (node, withCursor = true) => ({
    x: node.x + node.wave.x + (withCursor ? node.cursor.x : 0),
    y: node.y + node.wave.y + (withCursor ? node.cursor.y : 0)
  });

  const render = (elapsed) => {
    cursor.smoothX += (cursor.x - cursor.smoothX) * 0.08;
    cursor.smoothY += (cursor.y - cursor.smoothY) * 0.08;
    const dx = cursor.x - cursor.lastX;
    const dy = cursor.y - cursor.lastY;
    const distance = Math.hypot(dx, dy);
    cursor.smoothVelocity += (distance - cursor.smoothVelocity) * 0.08;
    cursor.smoothVelocity = Math.min(100, cursor.smoothVelocity);
    cursor.lastX = cursor.x;
    cursor.lastY = cursor.y;
    cursor.angle = Math.atan2(dy, dx);

    for (const line of lines) {
      for (const node of line) {
        const s = 12 * noise.perlin2((node.x + elapsed * options.waveSpeedX) * 0.002, (node.y + elapsed * options.waveSpeedY) * 0.0015);
        node.wave.x = Math.cos(s) * options.waveAmpX;
        node.wave.y = Math.sin(s) * options.waveAmpY;
        const range = Math.max(175, cursor.smoothVelocity);
        const dist = Math.hypot(node.x - cursor.smoothX, node.y - cursor.smoothY);
        if (dist < range) {
          const falloff = 1 - dist / range;
          const weight = Math.cos(0.001 * dist) * falloff;
          node.cursor.velocityX += Math.cos(cursor.angle) * weight * range * cursor.smoothVelocity * 0.00065;
          node.cursor.velocityY += Math.sin(cursor.angle) * weight * range * cursor.smoothVelocity * 0.00065;
        }
        node.cursor.velocityX += -node.cursor.x * options.tension;
        node.cursor.velocityY += -node.cursor.y * options.tension;
        node.cursor.velocityX *= options.friction;
        node.cursor.velocityY *= options.friction;
        node.cursor.x = clamp(node.cursor.x + 2 * node.cursor.velocityX, -options.maxCursorMove, options.maxCursorMove);
        node.cursor.y = clamp(node.cursor.y + 2 * node.cursor.velocityY, -options.maxCursorMove, options.maxCursorMove);
      }
    }

    ctx.clearRect(0, 0, view.width, view.height);
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.beginPath();
    ctx.strokeStyle = options.lineColor;
    ctx.lineWidth = 1;
    for (const line of lines) {
      const first = point(line[0], false);
      ctx.moveTo(first.x, first.y);
      line.forEach((node, index) => {
        const p = point(node, index !== line.length - 1);
        ctx.lineTo(p.x, p.y);
      });
    }
    ctx.stroke();
  };

  const frame = (now) => {
    raf = 0;
    if (!visible || document.hidden) return;
    if (!time) time = now;
    render(reduced ? 0 : now);
    if (!reduced) raf = requestAnimationFrame(frame);
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const resizeObserver = new ResizeObserver(() => { resize(); if (reduced) render(0); });
  resizeObserver.observe(container);
  container.addEventListener('pointermove', onPointerMove, { passive: true });
  const intersection = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible) wake();
  });
  intersection.observe(container);
  const onVisibility = () => { if (!document.hidden) wake(); };
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  wake();

  return () => {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    intersection.disconnect();
    container.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.remove();
  };
}
