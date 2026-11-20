/**
 * Ripple Distortion hero background.
 *
 * Adapted from React Bits RippleDistortion:
 * https://github.com/DavidHDev/react-bits/tree/main/src/content/Animations/RippleDistortion
 *
 * Shaders and interaction behavior follow the upstream component. This module
 * replaces the React wrapper with a small lifecycle adapter for Hexo/Pjax and
 * adds the auto-ripple option used by moxuna.com.
 */
import {
  Renderer,
  Program,
  Mesh,
  Geometry,
  Triangle,
  Texture,
  RenderTarget
} from './vendor/ogl.js';

const MAX_WAVES = 100;
const QUALITY_SCALE = { low: 0.4, medium: 0.7, high: 1 };
const START_SCALE = 1.5;
const LIFE_CONSTANT = Math.log(500);
const glsl = (...lines) => lines.join('\n');

const DEFAULTS = {
  src: '',
  brushSize: 190,
  strength: 0.16,
  swirl: 1.25,
  rings: 5,
  spread: 4.2,
  fade: 2.6,
  spacing: 10,
  dispersion: 0.06,
  glint: 0.2,
  tint: '#22d3ee',
  tintAmount: 0.12,
  grayscale: true,
  highlightColor: '#ffffff',
  trigger: 'both',
  clickStrength: 1.55,
  quality: 'medium',
  autoRippleInterval: 1050
};

const waveVertex = glsl(
  'precision highp float;',
  '',
  'attribute vec2 position;',
  'attribute vec2 uv;',
  'attribute vec2 iOffset;',
  'attribute vec2 iScale;',
  'attribute float iOpacity;',
  '',
  'varying vec2 vUv;',
  'varying float vOpacity;',
  '',
  'void main() {',
  '  vUv = uv;',
  '  vOpacity = iOpacity;',
  '  gl_Position = vec4(iOffset + position * iScale, 0.0, 1.0);',
  '}'
);

const waveFragment = glsl(
  'precision highp float;',
  '',
  'varying vec2 vUv;',
  'varying float vOpacity;',
  '',
  'uniform float uRings;',
  '',
  'const float PI = 3.141592653589793;',
  'const float EDGE = 0.006737947;',
  '',
  'void main() {',
  '  vec2 p = vUv * 2.0 - 1.0;',
  '  float r = dot(p, p);',
  '  if (r > 1.0) discard;',
  '',
  '  float brush = (exp(-r * 5.0) - EDGE) / (1.0 - EDGE);',
  '  brush *= 0.55 + 0.45 * cos(sqrt(r) * PI * 2.0 * uRings);',
  '',
  '  gl_FragColor = vec4(vec3(brush * vOpacity * vOpacity), 1.0);',
  '}'
);

const screenVertex = glsl(
  'precision highp float;',
  'attribute vec2 position;',
  'attribute vec2 uv;',
  'varying vec2 vUv;',
  'void main() {',
  '  vUv = uv;',
  '  gl_Position = vec4(position, 0.0, 1.0);',
  '}'
);

const compositeFragment = glsl(
  'precision highp float;',
  '',
  'varying vec2 vUv;',
  '',
  'uniform sampler2D uTexture;',
  'uniform sampler2D uDisplacement;',
  'uniform vec2 uResolution;',
  'uniform vec2 uTextureSize;',
  'uniform vec2 uTexel;',
  'uniform vec3 uTint;',
  'uniform vec3 uHighlight;',
  'uniform float uStrength;',
  'uniform float uSwirl;',
  'uniform float uDispersion;',
  'uniform float uGlint;',
  'uniform float uTintAmount;',
  'uniform float uGrayscale;',
  '',
  'const float TAU = 6.283185307179586;',
  '',
  'vec2 coverUV(vec2 uv) {',
  '  vec2 safe = max(uTextureSize, vec2(1.0));',
  '  vec2 s = uResolution / safe;',
  '  vec2 scaledSize = safe * max(s.x, s.y);',
  '  vec2 offset = (uResolution - scaledSize) * 0.5;',
  '  return (uv * uResolution - offset) / scaledSize;',
  '}',
  '',
  'void main() {',
  '  float amount = texture2D(uDisplacement, vUv).r;',
  '  vec2 base = coverUV(vUv);',
  '',
  '  float theta = amount * uSwirl * TAU;',
  '  vec2 dir = vec2(sin(theta), cos(theta));',
  '  vec2 push = dir * amount * uStrength;',
  '',
  '  vec3 color;',
  '  if (uDispersion > 0.001) {',
  '    float split = uDispersion * 0.25;',
  '    color.r = texture2D(uTexture, base + push * (1.0 + split)).r;',
  '    color.g = texture2D(uTexture, base + push).g;',
  '    color.b = texture2D(uTexture, base + push * (1.0 - split)).b;',
  '  } else {',
  '    color = texture2D(uTexture, base + push).rgb;',
  '  }',
  '',
  '  if (uGrayscale > 0.001) {',
  '    color = mix(color, vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), uGrayscale);',
  '  }',
  '',
  '  if (uTintAmount > 0.001) {',
  '    color = mix(color, color * uTint * 1.9, clamp(amount * 1.6, 0.0, 1.0) * uTintAmount);',
  '  }',
  '',
  '  if (uGlint > 0.001) {',
  '    float ex = texture2D(uDisplacement, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uDisplacement, vUv - vec2(uTexel.x, 0.0)).r;',
  '    float ey = texture2D(uDisplacement, vUv + vec2(0.0, uTexel.y)).r - texture2D(uDisplacement, vUv - vec2(0.0, uTexel.y)).r;',
  '    vec3 normal = normalize(vec3(-ex * 26.0, -ey * 26.0, 1.0));',
  '    vec3 light = normalize(vec3(-0.35, 0.55, 1.0));',
  '    float raw = pow(max(dot(normal, light), 0.0), 22.0);',
  '    float flatSpec = pow(max(light.z, 0.0), 22.0);',
  '    color += uHighlight * clamp((raw - flatSpec) / max(1.0 - flatSpec, 0.0001), 0.0, 1.0) * uGlint;',
  '  }',
  '',
  '  gl_FragColor = vec4(color, 1.0);',
  '}'
);

function hexToRGB(hex) {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((char) => char + char).join('')
    : clean;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return [1, 1, 1];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function createRippleDistortion(mount, userOptions = {}) {
  if (!mount) return () => {};
  const options = { ...DEFAULTS, ...userOptions };
  const reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !options.src) {
    mount.dataset.rippleState = 'static';
    return () => {};
  }

  let renderer;
  try {
    renderer = new Renderer({
      alpha: false,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2)
    });
  } catch (error) {
    mount.dataset.rippleState = 'static';
    if (window.console) console.warn('[hero-ripple] WebGL unavailable:', error);
    return () => {};
  }

  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 1);
  const canvas = gl.canvas;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 320ms ease';
  mount.appendChild(canvas);
  mount.dataset.rippleState = 'loading';

  const imageTexture = new Texture(gl, {
    generateMipmaps: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE
  });

  let disposed = false;
  const image = new window.Image();
  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.onload = () => {
    if (disposed) return;
    imageTexture.image = image;
    compositeUniforms.uTextureSize.value = [
      image.naturalWidth || 1,
      image.naturalHeight || 1
    ];
    canvas.style.opacity = '1';
    mount.dataset.rippleState = 'ready';
  };
  image.onerror = () => {
    if (disposed) return;
    mount.dataset.rippleState = 'fallback';
  };
  image.src = options.src;

  const offsets = new Float32Array(MAX_WAVES * 2);
  const scales = new Float32Array(MAX_WAVES * 2);
  const opacities = new Float32Array(MAX_WAVES);

  const waves = Array.from({ length: MAX_WAVES }, () => ({
    x: 0,
    y: 0,
    scale: START_SCALE,
    target: START_SCALE,
    size: 1,
    opacity: 0
  }));
  let currentWave = 0;

  const geometry = new Geometry(gl, {
    position: {
      size: 2,
      data: new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    },
    uv: {
      size: 2,
      data: new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    },
    iOffset: { instanced: 1, size: 2, data: offsets },
    iScale: { instanced: 1, size: 2, data: scales },
    iOpacity: { instanced: 1, size: 1, data: opacities }
  });

  const waveUniforms = { uRings: { value: options.rings } };
  const waveProgram = new Program(gl, {
    vertex: waveVertex,
    fragment: waveFragment,
    uniforms: waveUniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    cullFace: false
  });
  waveProgram.setBlendFunc(gl.ONE, gl.ONE);
  const waveMesh = new Mesh(gl, { geometry, program: waveProgram, frustumCulled: false });

  const displacementTarget = new RenderTarget(gl, {
    width: 2,
    height: 2,
    depth: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE
  });

  const compositeUniforms = {
    uTexture: { value: imageTexture },
    uDisplacement: { value: displacementTarget.texture },
    uResolution: { value: [1, 1] },
    uTextureSize: { value: [1, 1] },
    uTexel: { value: [1, 1] },
    uTint: { value: hexToRGB(options.tint) },
    uHighlight: { value: hexToRGB(options.highlightColor) },
    uStrength: { value: options.strength },
    uSwirl: { value: options.swirl },
    uDispersion: { value: options.dispersion },
    uGlint: { value: options.glint },
    uTintAmount: { value: options.tintAmount },
    uGrayscale: { value: options.grayscale ? 1 : 0 }
  };

  const compositeMesh = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, {
      vertex: screenVertex,
      fragment: compositeFragment,
      uniforms: compositeUniforms,
      depthTest: false,
      depthWrite: false
    })
  });

  let width = 1;
  let height = 1;
  let resizePending = false;

  const resize = () => {
    width = Math.max(1, mount.clientWidth);
    height = Math.max(1, mount.clientHeight);
    renderer.setSize(width, height);
    compositeUniforms.uResolution.value = [width, height];

    const scale = QUALITY_SCALE[options.quality] || QUALITY_SCALE.high;
    const fieldWidth = Math.max(2, Math.round(width * scale));
    const fieldHeight = Math.max(2, Math.round(height * scale));
    displacementTarget.setSize(fieldWidth, fieldHeight);
    compositeUniforms.uTexel.value = [1 / fieldWidth, 1 / fieldHeight];
  };

  const setNewWave = (x, y, power) => {
    const wave = waves[currentWave];
    currentWave = (currentWave + 1) % MAX_WAVES;
    wave.x = x;
    wave.y = y;
    wave.scale = START_SCALE * power;
    wave.target = START_SCALE * Math.max(1, options.spread) * power;
    wave.size = Math.max(1, options.brushSize);
    wave.opacity = 1;
  };

  const localPoint = (clientX, clientY) => {
    const rect = mount.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }
    return [clientX - rect.left, rect.height - (clientY - rect.top)];
  };

  let previousX = 0;
  let previousY = 0;
  const onMove = (event) => {
    if (options.trigger === 'click') return;
    const point = localPoint(event.clientX, event.clientY);
    if (!point) return;
    const step = Math.max(1, options.spacing);
    if (Math.abs(point[0] - previousX) > step || Math.abs(point[1] - previousY) > step) {
      setNewWave(point[0], point[1], 1);
      previousX = point[0];
      previousY = point[1];
    }
  };

  const onDown = (event) => {
    if (options.trigger === 'hover') return;
    const point = localPoint(event.clientX, event.clientY);
    if (!point) return;
    setNewWave(point[0], point[1], Math.max(1, options.clickStrength));
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });

  let raf = 0;
  let previousTime = 0;
  let running = false;
  let visible = document.visibilityState !== 'hidden';
  let inView = true;

  const renderFrame = (now) => {
    const delta = previousTime ? Math.min(0.05, (now - previousTime) / 1000) : 0;
    previousTime = now;
    const growth = 1 - Math.exp(-delta * 1.09);
    const decay = Math.exp((-delta * LIFE_CONSTANT) / Math.max(0.15, options.fade));

    for (let index = 0; index < MAX_WAVES; index += 1) {
      const wave = waves[index];
      if (wave.opacity <= 0) {
        opacities[index] = 0;
        continue;
      }

      wave.opacity *= decay;
      wave.scale += (wave.target - wave.scale) * growth;

      if (wave.opacity < 0.002) {
        wave.opacity = 0;
        opacities[index] = 0;
        continue;
      }

      const half = (wave.scale * wave.size) / 2;
      offsets[index * 2] = (wave.x / width) * 2 - 1;
      offsets[index * 2 + 1] = (wave.y / height) * 2 - 1;
      scales[index * 2] = (half / width) * 2;
      scales[index * 2 + 1] = (half / height) * 2;
      opacities[index] = wave.opacity;
    }

    geometry.attributes.iOffset.needsUpdate = true;
    geometry.attributes.iScale.needsUpdate = true;
    geometry.attributes.iOpacity.needsUpdate = true;

    renderer.render({ scene: waveMesh, target: displacementTarget, clear: true });
    renderer.render({ scene: compositeMesh });
  };

  const loop = (now) => {
    if (!running) return;
    if (!visible || !inView) {
      running = false;
      raf = 0;
      return;
    }
    if (resizePending) {
      resizePending = false;
      resize();
    }
    renderFrame(now);
    raf = requestAnimationFrame(loop);
  };

  const start = () => {
    if (running || !visible || !inView) return;
    running = true;
    previousTime = 0;
    raf = requestAnimationFrame(loop);
  };

  const stop = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => { resizePending = true; })
    : null;
  if (resizeObserver) resizeObserver.observe(mount);
  resize();

  const onResize = () => { resizePending = true; };
  const onVisibility = () => {
    visible = document.visibilityState !== 'hidden';
    if (visible && inView) start();
    else stop();
  };
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  let intersectionObserver = null;
  if (typeof IntersectionObserver === 'function') {
    intersectionObserver = new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      if (visible && inView) start();
      else stop();
    }, { threshold: 0.01 });
    intersectionObserver.observe(mount);
  }

  let autoStartTimer = 0;
  let autoIntervalTimer = 0;
  if (options.autoRippleInterval > 0) {
    let tick = 0;
    const addAutoWave = () => {
      tick += 1;
      setNewWave(
        width * (0.5 + 0.28 * Math.sin(1.7 * tick)),
        height * (0.5 + 0.22 * Math.cos(1.3 * tick)),
        1.1
      );
    };
    autoStartTimer = window.setTimeout(addAutoWave, 300);
    autoIntervalTimer = window.setInterval(addAutoWave, options.autoRippleInterval);
  }

  start();

  return () => {
    disposed = true;
    stop();
    window.clearTimeout(autoStartTimer);
    window.clearInterval(autoIntervalTimer);
    if (resizeObserver) resizeObserver.disconnect();
    if (intersectionObserver) intersectionObserver.disconnect();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    document.removeEventListener('visibilitychange', onVisibility);
    image.onload = null;
    image.onerror = null;
    image.src = '';
    if (canvas.parentNode === mount) mount.removeChild(canvas);
    const extension = gl.getExtension('WEBGL_lose_context');
    if (extension) extension.loseContext();
    delete mount.dataset.rippleState;
  };
}

let disposeCurrent = null;
let activeMount = null;

function destroy() {
  if (disposeCurrent) disposeCurrent();
  disposeCurrent = null;
  if (activeMount) delete activeMount.dataset.rippleReady;
  activeMount = null;
}

function init() {
  destroy();
  const mount = document.getElementById('hero-ripple-canvas');
  if (!mount || mount.dataset.rippleReady === '1') return;
  mount.dataset.rippleReady = '1';
  activeMount = mount;
  disposeCurrent = createRippleDistortion(mount, {
    src: mount.dataset.src,
    brushSize: 190,
    strength: 0.16,
    swirl: 1.25,
    rings: 5,
    spread: 4.2,
    fade: 2.6,
    spacing: 10,
    dispersion: 0.06,
    glint: 0.2,
    tint: '#22d3ee',
    tintAmount: 0.12,
    highlightColor: '#ffffff',
    grayscale: true,
    trigger: 'both',
    clickStrength: 1.55,
    quality: 'medium',
    autoRippleInterval: 1050
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

document.addEventListener('pjax:send', destroy);
document.addEventListener('pjax:complete', init);
window.addEventListener('pagehide', destroy);
