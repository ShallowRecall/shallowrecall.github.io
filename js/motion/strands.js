/*
 * Vanilla renderer for the Strands animation shipped by moxuna.com.
 * Shader source is kept verbatim in strands-shader.js.
 */

import { STRANDS_VERT, STRANDS_FRAG } from './strands-shader.js';

const MAX_COLORS = 8;
const DEFAULT_COLORS = ['#ff4242', '#7c3aed', '#06b6d4', '#eab308'];
const DEFAULT_OPTIONS = {
  colors: DEFAULT_COLORS,
  count: 3,
  speed: 0.5,
  amplitude: 1,
  waviness: 1,
  thickness: 0.7,
  glow: 2.6,
  taper: 3,
  spread: 1,
  hueShift: 0,
  intensity: 0.6,
  saturation: 1.5,
  opacity: 1,
  scale: 1.5,
  maxDevicePixelRatio: 2
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function hexToRgb(hex) {
  const clean = String(hex || '#ffffff').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
  const value = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(value)) return [1, 1, 1];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[strands] shader error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl) {
  const vertex = compile(gl, gl.VERTEX_SHADER, STRANDS_VERT);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, STRANDS_FRAG);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[strands] link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function paletteFor(colors) {
  const list = (Array.isArray(colors) && colors.length ? colors : DEFAULT_COLORS)
    .slice(0, MAX_COLORS)
    .map(hexToRgb);
  const flat = new Float32Array(MAX_COLORS * 3);
  for (let index = 0; index < MAX_COLORS; index += 1) {
    flat.set(list[Math.min(index, list.length - 1)], index * 3);
  }
  return flat;
}

export function mountStrands(container, userOptions = {}) {
  if (!container) return () => {};
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.backgroundColor = 'transparent';

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    depth: false,
    stencil: false
  });
  if (!gl) {
    container.dataset.motionFallback = 'strands';
    return () => {};
  }

  const program = createProgram(gl);
  if (!program) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    container.dataset.motionFallback = 'strands';
    return () => {};
  }

  container.appendChild(canvas);
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const names = [
    'uTime', 'uResolution', 'uColors', 'uColorCount', 'uStrandCount', 'uSpeed',
    'uAmplitude', 'uWaviness', 'uThickness', 'uGlow', 'uTaper', 'uSpread',
    'uHueShift', 'uIntensity', 'uOpacity', 'uScale', 'uSaturation'
  ];
  const uniforms = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
  const palette = paletteFor(options.colors);
  const colorCount = Math.min((Array.isArray(options.colors) ? options.colors : DEFAULT_COLORS).length, MAX_COLORS);
  const strandCount = clamp(Math.round(options.count), 1, 12);
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  let raf = 0;
  let visible = true;
  let lost = false;
  let width = 1;
  let height = 1;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, Math.max(0.5, options.maxDevicePixelRatio));
    const nextWidth = Math.max(1, Math.round(container.offsetWidth * dpr));
    const nextHeight = Math.max(1, Math.round(container.offsetHeight * dpr));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;
  };

  const draw = (time) => {
    if (lost) return;
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform1f(uniforms.uTime, reduced ? 0 : time);
    gl.uniform2f(uniforms.uResolution, width, height);
    gl.uniform3fv(uniforms.uColors, palette);
    gl.uniform1i(uniforms.uColorCount, colorCount);
    gl.uniform1i(uniforms.uStrandCount, strandCount);
    gl.uniform1f(uniforms.uSpeed, options.speed);
    gl.uniform1f(uniforms.uAmplitude, options.amplitude);
    gl.uniform1f(uniforms.uWaviness, options.waviness);
    gl.uniform1f(uniforms.uThickness, options.thickness);
    gl.uniform1f(uniforms.uGlow, options.glow);
    gl.uniform1f(uniforms.uTaper, options.taper);
    gl.uniform1f(uniforms.uSpread, options.spread);
    gl.uniform1f(uniforms.uHueShift, options.hueShift);
    gl.uniform1f(uniforms.uIntensity, options.intensity);
    gl.uniform1f(uniforms.uOpacity, options.opacity);
    gl.uniform1f(uniforms.uScale, options.scale);
    gl.uniform1f(uniforms.uSaturation, options.saturation);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const frame = (now) => {
    raf = 0;
    resize();
    if (visible && !document.hidden) draw(now * 0.001);
    if (!reduced) raf = requestAnimationFrame(frame);
  };

  const wake = () => {
    if (!raf && !lost) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
  };

  const onLost = (event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (!reduced) draw(performance.now() * 0.001);
  });
  resizeObserver.observe(container);

  let intersection = null;
  if (typeof IntersectionObserver !== 'undefined') {
    intersection = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) wake();
    }, { threshold: 0.01 });
    intersection.observe(container);
  }

  canvas.addEventListener('webglcontextlost', onLost);
  resize();
  draw(performance.now() * 0.001);
  if (!reduced) wake();

  return () => {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('webglcontextlost', onLost);
    resizeObserver.disconnect();
    intersection?.disconnect();
    gl.deleteBuffer(buffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
  };
}
