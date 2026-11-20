/*
 * Vanilla WebGL2 adapter for React Bits LiquidEther.
 * Upstream: https://github.com/DavidHDev/react-bits
 * Shader sources: shaders.js (vendored, see REACT_BITS_LICENSE.txt).
 */
import {
  VERTEX,
  SPLAT,
  SMOOTH,
  DIVERGENCE,
  PRESSURE,
  PROJECT,
  ADVECT,
  DISPLAY
} from './shaders.js';

const PIXEL_BUDGET = 2.4e6;
const MAX_CELLS = 140000;
const PRESSURE_STEPS = 32;
const PALETTE_SIZE = 256;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const keepFor = (persistence, dt) => Math.pow(0.5, dt / (0.35 + persistence * persistence * 12));

function parseColor(value) {
  const text = String(value || '').trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].replace(/./g, (digit) => digit + digit) : hex[1];
    return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16) / 255);
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((channel) => clamp(parseFloat(channel) / 255, 0, 1));
  return null;
}

const toLinear = (channel) => (channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4));

function buildPalette(colors) {
  const stops = [];
  colors.forEach((color) => {
    const parsed = parseColor(color);
    if (parsed) stops.push(parsed);
  });
  if (!stops.length) stops.push([1, 1, 1]);
  const values = stops.map((color) => color.map(toLinear));
  const data = new Uint8Array(PALETTE_SIZE * 4);
  for (let index = 0; index < PALETTE_SIZE; index += 1) {
    const t = clamp((index / (PALETTE_SIZE - 1)) * values.length - 0.5, 0, values.length - 1);
    const from = Math.min(Math.floor(t), Math.max(values.length - 2, 0));
    const to = Math.min(from + 1, values.length - 1);
    const k = t - from;
    const eased = k * k * (3 - 2 * k);
    for (let channel = 0; channel < 3; channel += 1) {
      const value = values[from][channel] + (values[to][channel] - values[from][channel]) * eased;
      data[index * 4 + channel] = Math.round(clamp(value, 0, 1) * 255);
    }
    data[index * 4 + 3] = 255;
  }
  return data;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn('[liquid-ether] shader error:', gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function link(gl, fragmentSource) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = vertex && fragment ? gl.createProgram() : null;
  if (!vertex || !fragment || !program) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[liquid-ether] link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let index = 0; index < count; index += 1) {
    const info = gl.getActiveUniform(program, index);
    if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

export function mountLiquidEther(container, userOptions = {}) {
  if (!container) return () => {};
  const p = {
    colors: ['#5227FF', '#FF9FFC', '#B497CF'],
    intensity: 1,
    mouseForce: 20,
    cursorSize: 100,
    persistence: 0.75,
    viscosity: 0,
    resolution: 0.5,
    bounceEdges: false,
    clickBurst: true,
    autoDemo: true,
    autoSpeed: 0.5,
    autoIntensity: 2.2,
    autoResumeDelay: 3000,
    autoRampDuration: 0.6,
    intro: true,
    lightMode: false,
    backgroundColor: 'transparent',
    maxDevicePixelRatio: 2,
    interactive: false,
    isActive: null,
    ...userOptions
  };
  const canvas = document.createElement('canvas');
  canvas.className = 'liquid-ether__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance'
  });
  if (!gl || (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float'))) {
    container.dataset.motionFallback = 'liquid-ether';
    return () => {};
  }
  container.appendChild(canvas);

  const programs = {
    splat: link(gl, SPLAT),
    smooth: link(gl, SMOOTH),
    divergence: link(gl, DIVERGENCE),
    pressure: link(gl, PRESSURE),
    project: link(gl, PROJECT),
    advect: link(gl, ADVECT),
    display: link(gl, DISPLAY)
  };
  if (Object.values(programs).some((entry) => !entry)) {
    canvas.remove();
    return () => {};
  }

  const reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  const vao = gl.createVertexArray();
  const size = { width: 1, height: 1 };
  const grid = { width: 0, height: 0 };
  const targets = {};
  const pointer = { x: 0, y: 0, fromX: 0, fromY: 0, dx: 0, dy: 0, inside: false, ready: false, moved: false, last: 0 };
  const auto = { phase: Math.random() * 100, x: 0, y: 0, ready: false, ramp: 0 };
  const opening = { active: p.intro && !reduced, time: 0 };
  const splats = [];
  const puffs = [];
  const background = p.backgroundColor === 'transparent' ? [0, 0, 0, 0] : [...(parseColor(p.backgroundColor) || [0, 0, 0]), 1];
  let energy = 1;
  let lastInput = -Infinity;
  let raf = 0;
  let last = 0;
  let visible = true;
  let pageVisible = document.visibilityState !== 'hidden';
  let lost = false;
  let paletteKey = '';

  const paletteTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const updatePalette = () => {
    const key = p.colors.join(',');
    if (key === paletteKey) return;
    paletteKey = key;
    gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, PALETTE_SIZE, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, buildPalette(p.colors));
  };

  const makeTarget = (width, height, channels) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0,
      channels === 2 ? gl.RG16F : gl.R16F,
      width, height, 0,
      channels === 2 ? gl.RG : gl.RED,
      gl.HALF_FLOAT, null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture, framebuffer };
  };

  const dropTargets = () => {
    Object.keys(targets).forEach((key) => {
      gl.deleteTexture(targets[key].texture);
      gl.deleteFramebuffer(targets[key].framebuffer);
      delete targets[key];
    });
  };

  const resize = () => {
    const rect = container.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const ratio = Math.min(window.devicePixelRatio || 1, p.maxDevicePixelRatio, Math.sqrt(PIXEL_BUDGET / (cssWidth * cssHeight)));
    const width = Math.max(1, Math.round(cssWidth * ratio));
    const height = Math.max(1, Math.round(cssHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    size.width = cssWidth;
    size.height = cssHeight;
    const base = p.resolution * 0.5;
    const scale = base * Math.min(1, Math.sqrt(MAX_CELLS / (cssWidth * cssHeight * base * base)));
    const gridWidth = clamp(Math.round(cssWidth * scale), 16, 1024);
    const gridHeight = clamp(Math.round(cssHeight * scale), 16, 1024);
    if (gridWidth === grid.width && gridHeight === grid.height) return;
    dropTargets();
    grid.width = gridWidth;
    grid.height = gridHeight;
    targets.velocity = makeTarget(gridWidth, gridHeight, 2);
    targets.velocityNext = makeTarget(gridWidth, gridHeight, 2);
    targets.divergence = makeTarget(gridWidth, gridHeight, 1);
    targets.pressure = makeTarget(gridWidth, gridHeight, 1);
    targets.pressureNext = makeTarget(gridWidth, gridHeight, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const swap = (a, b) => {
    const held = targets[a];
    targets[a] = targets[b];
    targets[b] = held;
  };
  const bindTexture = (unit, texture, location) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(location, unit);
  };
  const run = (entry, output, bind) => {
    gl.useProgram(entry.program);
    gl.uniform2f(entry.uniforms.uTexel, 1 / grid.width, 1 / grid.height);
    bind(entry.uniforms);
    gl.bindFramebuffer(gl.FRAMEBUFFER, output ? output.framebuffer : null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const simulate = (dt) => {
    gl.viewport(0, 0, grid.width, grid.height);
    const walls = p.bounceEdges ? 1 : 0;
    splats.forEach((splat) => {
      run(programs.splat, targets.velocityNext, (u) => {
        bindTexture(0, targets.velocity.texture, u.uVelocity);
        gl.uniform2f(u.uSize, size.width, size.height);
        gl.uniform4f(u.uSegment, splat.ax, splat.ay, splat.bx, splat.by);
        gl.uniform2f(u.uForce, splat.vx, splat.vy);
        gl.uniform1f(u.uRadius, splat.radius);
      });
      swap('velocity', 'velocityNext');
    });
    splats.length = 0;
    const passes = Math.ceil(p.viscosity * 4);
    for (let pass = 0; pass < passes; pass += 1) {
      run(programs.smooth, targets.velocityNext, (u) => {
        bindTexture(0, targets.velocity.texture, u.uVelocity);
        gl.uniform1f(u.uAmount, Math.min(1, p.viscosity * 4 - pass) * 0.9);
      });
      swap('velocity', 'velocityNext');
    }
    run(programs.divergence, targets.divergence, (u) => {
      bindTexture(0, targets.velocity.texture, u.uVelocity);
      gl.uniform1f(u.uWalls, walls);
    });
    for (let iteration = 0; iteration < PRESSURE_STEPS; iteration += 1) {
      run(programs.pressure, targets.pressureNext, (u) => {
        bindTexture(0, targets.pressure.texture, u.uPressure);
        bindTexture(1, targets.divergence.texture, u.uDivergence);
        gl.uniform1f(u.uWalls, walls);
      });
      swap('pressure', 'pressureNext');
    }
    run(programs.project, targets.velocityNext, (u) => {
      bindTexture(0, targets.pressure.texture, u.uPressure);
      bindTexture(1, targets.velocity.texture, u.uVelocity);
      gl.uniform1f(u.uWalls, walls);
    });
    swap('velocity', 'velocityNext');
    run(programs.advect, targets.velocityNext, (u) => {
      bindTexture(0, targets.velocity.texture, u.uVelocity);
      gl.uniform2f(u.uStep, dt / size.width, dt / size.height);
      gl.uniform1f(u.uKeep, keepFor(p.persistence, dt));
      gl.uniform1f(u.uWalls, walls);
    });
    swap('velocity', 'velocityNext');
  };

  const render = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    run(programs.display, null, (u) => {
      bindTexture(0, targets.velocity.texture, u.uVelocity);
      bindTexture(1, paletteTexture, u.uPalette);
      gl.uniform2f(u.uSimSize, grid.width, grid.height);
      gl.uniform1f(u.uSpeedScale, (1.25 * p.intensity) / (0.84 * Math.max(size.width, size.height)));
      gl.uniform1f(u.uLight, p.lightMode ? 1 : 0);
      gl.uniform4f(u.uBackground, background[0], background[1], background[2], background[3]);
    });
  };

  const wander = (t) => {
    const x = 0.62 * Math.sin(t * 0.83 + 1.3) + 0.38 * Math.sin(t * 1.71 + 0.4);
    const y = 0.6 * Math.sin(t * 1.07 + 2.1) + 0.4 * Math.cos(t * 0.61 + 0.7);
    return [(0.5 + 0.41 * x) * size.width, (0.5 + 0.41 * y) * size.height];
  };
  const sweep = (t) => {
    const k = clamp(t / 1.4, 0, 1);
    const eased = 1 - Math.pow(1 - k, 3);
    const angle = -0.6 + eased * 3.6;
    const reach = 0.08 + 0.3 * eased;
    return [(0.5 + Math.cos(angle) * reach * 1.1) * size.width, (0.5 + Math.sin(angle) * reach * (size.width / size.height) * 0.75) * size.height];
  };
  const addStroke = (from, to, dt, scale, radius) => {
    splats.push({
      ax: from[0], ay: from[1], bx: to[0], by: to[1],
      vx: clamp(((to[0] - from[0]) / dt) * scale, -6000, 6000),
      vy: clamp(((to[1] - from[1]) / dt) * scale, -6000, 6000),
      radius
    });
  };

  const frame = (now) => {
    raf = 0;
    if (lost) return;
    updatePalette();
    const dt = clamp((now - last) / 1000 || 0, 0, 1 / 30);
    last = Math.max(last, now);
    const pace = Math.min(1, dt * 60);
    const idle = now - lastInput > p.autoResumeDelay && !pointer.inside;

    if (opening.active && dt > 0) {
      const from = sweep(opening.time);
      opening.time += dt;
      const fade = Math.sin(Math.min(1, opening.time / 1.4) * Math.PI);
      addStroke(from, sweep(opening.time), dt, 0.2 * fade, p.cursorSize);
      energy = 1;
      if (opening.time > 1.4) opening.active = false;
    } else if (p.autoDemo && !reduced && idle && dt > 0) {
      auto.ramp = Math.min(1, auto.ramp + dt / p.autoRampDuration);
      auto.phase += dt * p.autoSpeed * 1.6;
      const spot = wander(auto.phase);
      if (auto.ready) {
        const gust = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(auto.phase * 2.6), 2);
        const scale = (p.mouseForce / 20) * 0.45 * p.autoIntensity * auto.ramp * auto.ramp * gust * pace;
        addStroke([auto.x, auto.y], spot, dt, scale, p.cursorSize);
      }
      auto.x = spot[0];
      auto.y = spot[1];
      auto.ready = true;
      energy = 1;
    } else {
      auto.ramp = 0;
    }

    if (pointer.moved && dt > 0 && p.interactive) {
      pointer.moved = false;
      const span = Math.max(now - pointer.last, 8) / 1000;
      addStroke([pointer.fromX, pointer.fromY], [pointer.x, pointer.y], span, (p.mouseForce / 20) * 0.15 * pace, p.cursorSize);
      pointer.fromX = pointer.x;
      pointer.fromY = pointer.y;
      pointer.last = now;
      energy = 1;
    }

    const puff = puffs.shift();
    if (puff) splats.push(puff);
    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND);
    if (dt > 0) simulate(dt);
    render();
    energy *= keepFor(p.persistence, dt);
    const busy = opening.active || (p.autoDemo && !reduced) || energy > 0.002 || puffs.length > 0 || (pointer.moved && p.interactive);
    if (busy && visible && pageVisible) raf = requestAnimationFrame(frame);
  };

  const wake = () => {
    if (raf || lost || !visible || !pageVisible) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const locate = (event) => {
    const rect = container.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: rect.bottom - event.clientY,
      inside: event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
    };
  };
  const onPointerMove = (event) => {
    if (!p.interactive || (typeof p.isActive === 'function' && !p.isActive())) {
      pointer.inside = false;
      pointer.ready = false;
      return;
    }
    const spot = locate(event);
    pointer.inside = spot.inside;
    if (!spot.inside) {
      pointer.ready = false;
      return;
    }
    lastInput = performance.now();
    opening.active = false;
    if (!pointer.ready) {
      pointer.fromX = spot.x;
      pointer.fromY = spot.y;
      pointer.x = spot.x;
      pointer.y = spot.y;
      pointer.last = lastInput;
      pointer.ready = true;
    }
    const travelX = spot.x - pointer.x;
    const travelY = spot.y - pointer.y;
    if (Math.hypot(travelX, travelY) > 0.5) {
      pointer.dx = pointer.dx * 0.7 + travelX * 0.3;
      pointer.dy = pointer.dy * 0.7 + travelY * 0.3;
    }
    pointer.x = spot.x;
    pointer.y = spot.y;
    pointer.moved = true;
    wake();
  };
  const onPointerDown = (event) => {
    if (!p.interactive || (typeof p.isActive === 'function' && !p.isActive())) return;
    const spot = locate(event);
    if (!spot.inside) return;
    lastInput = performance.now();
    if (!p.clickBurst || reduced) return;
    const angle = Math.hypot(pointer.dx, pointer.dy) > 1 ? Math.atan2(pointer.dy, pointer.dx) : Math.random() * Math.PI * 2;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const reach = p.cursorSize * 0.5;
    const push = 1400 * (p.mouseForce / 20);
    puffs.push({
      ax: spot.x - dirX * reach, ay: spot.y - dirY * reach,
      bx: spot.x + dirX * reach, by: spot.y + dirY * reach,
      vx: dirX * push, vy: dirY * push,
      radius: p.cursorSize * 0.9
    });
    if (puffs.length > 4) puffs.shift();
    energy = 1;
    wake();
  };
  const onLeave = () => {
    pointer.inside = false;
    pointer.ready = false;
  };
  const onPointerUp = (event) => { if (event.pointerType !== 'mouse') onLeave(); };
  const onLost = (event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('webglcontextlost', onLost);

  const resizeObserver = new ResizeObserver(() => { resize(); render(); wake(); });
  resizeObserver.observe(container);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    wake();
  });
  intersection.observe(container);
  const onVisibility = () => {
    pageVisible = document.visibilityState !== 'hidden';
    wake();
  };
  document.addEventListener('visibilitychange', onVisibility);

  resize();
  wake();

  return () => {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    intersection.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onLost);
    if (!gl.isContextLost()) {
      dropTargets();
      gl.deleteTexture(paletteTexture);
      gl.deleteVertexArray(vao);
      Object.values(programs).forEach((entry) => gl.deleteProgram(entry.program));
    }
    canvas.remove();
  };
}
