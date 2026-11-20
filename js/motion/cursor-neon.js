/*
 * Vanilla port of the SplashCursor fluid-dye cursor used by moxuna.com.
 * Upstream implementation: React Bits SplashCursor.
 * Source: https://github.com/DavidHDev/react-bits
 * Adapted for Hexo / Pjax lifecycle and the homepage Strands palette.
 */

const STRANDS_CONFIG = {
  colors: ['#FF4242', '#7C3AED', '#06B6D4', '#EAB308'],
  count: 4,
  speed: 0.45,
  amplitude: 1.05,
  waviness: 1,
  thickness: 0.68,
  glow: 3,
  taper: 3.1,
  spread: 1.2,
  hueShift: 0,
  intensity: 0.72,
  saturation: 1.15,
  opacity: 0.92,
  scale: 1.7
};

const DEFAULT_SPLASH_OPTIONS = {
  SIM_RESOLUTION: 96,
  DYE_RESOLUTION: 720,
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 4,
  VELOCITY_DISSIPATION: 2.4,
  PRESSURE: 0.1,
  PRESSURE_ITERATIONS: 20,
  CURL: 3,
  SPLAT_RADIUS: 0.16,
  SPLAT_FORCE: 4200,
  SHADING: true,
  COLOR_UPDATE_SPEED: 7,
  BACK_COLOR: { r: 0, g: 0, b: 0 },
  TRANSPARENT: true,
  RAINBOW_MODE: false,
  COLOR: '#0485f7',
  COLOR_TRANSITION_SPEED: 10
};

const parseHex = (hex) => {
  const value = String(hex).replace('#', '');
  const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16)
  };
};

const toHex = (value) => Math.round(value).toString(16).padStart(2, '0');

function strandColorAt({ clientX, clientY, time, bounds, config = STRANDS_CONFIG }) {
  const height = Math.max(bounds.height, 1);
  const x = (clientX - bounds.left - bounds.width * 0.5) / height / config.scale;
  const y = (height * 0.5 - (clientY - bounds.top)) / height / config.scale;
  const envelope = 0.06 + 0.94 * config.intensity;
  const taper = Math.pow(Math.max(Math.cos(x * Math.PI * 1.3), 0), config.taper);
  const clock = time * config.speed;
  let best = 0;
  let distance = Infinity;

  for (let index = 0; index < config.count; index += 1) {
    const offset = 1.7 * index * config.spread;
    const frequency = (2 + 0.35 * index) * config.waviness;
    const phase = 1.4 + 1.2 * index;
    const center = (
      0.6 * Math.sin(x * frequency + clock * phase + offset)
      + 0.4 * Math.sin(x * frequency * 1.1 - clock * phase * 0.7 + 1.7 * offset)
    ) * (0.1 + 0.02 * envelope) * taper * config.amplitude;
    const current = Math.abs(y - center);
    if (current < distance) {
      distance = current;
      best = index;
    }
  }

  const hue = best / config.count + 0.3 * x + 0.04 * time + config.hueShift;
  const scaled = (hue - Math.floor(hue)) * config.colors.length;
  const fromIndex = Math.floor(scaled);
  const toIndex = (fromIndex + 1) % config.colors.length;
  const mix = scaled - fromIndex;
  const from = parseHex(config.colors[fromIndex]);
  const to = parseHex(config.colors[toIndex]);
  return '#' + toHex(from.r + (to.r - from.r) * mix)
    + toHex(from.g + (to.g - from.g) * mix)
    + toHex(from.b + (to.b - from.b) * mix);
}

function resolveSplashColor(clientX, clientY, time, fallback) {
  const section = document.querySelector('.home-motion-strands-section');
  const canvas = document.querySelector('#home-motion-strands');
  if (!section || !canvas) return fallback;
  const bounds = section.getBoundingClientRect();
  if (clientY < bounds.top || clientY > bounds.bottom) return fallback;
  return strandColorAt({
    clientX,
    clientY,
    time,
    bounds: canvas.getBoundingClientRect(),
    config: STRANDS_CONFIG
  });
}

function startSplashCursor(
  canvas,
  {
    SIM_RESOLUTION = 128,
    DYE_RESOLUTION = 1440,
    CAPTURE_RESOLUTION = 512,
    DENSITY_DISSIPATION = 3.5,
    VELOCITY_DISSIPATION = 2,
    PRESSURE = 0.1,
    PRESSURE_ITERATIONS = 20,
    CURL = 3,
    SPLAT_RADIUS = 0.2,
    SPLAT_FORCE = 6000,
    SHADING = true,
    COLOR_UPDATE_SPEED = 10,
    BACK_COLOR = { r: 0.5, g: 0, b: 0 },
    TRANSPARENT = true,
    RAINBOW_MODE = true,
    COLOR = '#ff0000',
    COLOR_RESOLVER,
    COLOR_TRANSITION_SPEED = 10
  },
  activeCheck
) {

          const t = SIM_RESOLUTION;
          const i = DYE_RESOLUTION;
          const o = DENSITY_DISSIPATION;
          const a = VELOCITY_DISSIPATION;
          const l = PRESSURE;
          const u = PRESSURE_ITERATIONS;
          const c = CURL;
          const d = SPLAT_RADIUS;
          const m = SPLAT_FORCE;
          const h = SHADING;
          const x = COLOR_UPDATE_SPEED;
          const v = RAINBOW_MODE;
          const g = COLOR;
          const w = COLOR_RESOLVER;
          const y = COLOR_TRANSITION_SPEED;
          let e, r, n, s, f, p;
          const S = canvas;
          let A = [
              {
                id: -1,
                texcoordX: 0,
                texcoordY: 0,
                prevTexcoordX: 0,
                prevTexcoordY: 0,
                deltaX: 0,
                deltaY: 0,
                down: !1,
                moved: !1,
                color: { r: 0, g: 0, b: 0 },
              },
            ],
            T = {
              SIM_RESOLUTION: t,
              DYE_RESOLUTION: i,
              DENSITY_DISSIPATION: o,
              VELOCITY_DISSIPATION: a,
              PRESSURE: l,
              PRESSURE_ITERATIONS: u,
              CURL: c,
              SPLAT_RADIUS: d,
              SPLAT_FORCE: m,
              SHADING: h,
              COLOR_UPDATE_SPEED: x,
              RAINBOW_MODE: v,
              COLOR: g,
              COLOR_RESOLVER: w,
              COLOR_TRANSITION_SPEED: y,
            },
            R = (function (e) {
              let t,
                i,
                r,
                n = {
                  alpha: !0,
                  depth: !1,
                  stencil: !1,
                  antialias: !1,
                  preserveDrawingBuffer: !1,
                },
                s = e.getContext("webgl2", n);
              if (
                (s ||
                  (s =
                    e.getContext("webgl", n) ||
                    e.getContext("experimental-webgl", n)),
                !s)
              )
                return null;
              let o = "drawBuffers" in s,
                a = !1,
                l = null;
              (o
                ? (s.getExtension("EXT_color_buffer_float"),
                  (a = !!s.getExtension("OES_texture_float_linear")))
                : ((l = s.getExtension("OES_texture_half_float")),
                  (a = !!s.getExtension("OES_texture_half_float_linear"))),
                s.clearColor(0, 0, 0, 1));
              let u = o ? s.HALF_FLOAT : (l && l.HALF_FLOAT_OES) || 0;
              return (o
                ? ((t = C(s, s.RGBA16F, s.RGBA, u)),
                  (i = C(s, s.RG16F, s.RG, u)),
                  (r = C(s, s.R16F, s.RED, u)))
                : ((t = C(s, s.RGBA, s.RGBA, u)),
                  (i = C(s, s.RGBA, s.RGBA, u)),
                  (r = C(s, s.RGBA, s.RGBA, u))),
              t && i && r)
                ? {
                    gl: s,
                    ext: {
                      formatRGBA: t,
                      formatRG: i,
                      formatR: r,
                      halfFloatTexType: u,
                      supportLinearFiltering: a,
                    },
                  }
                : null;
            })(S);
          if (!R) return null;
          let { gl: E, ext: N } = R;
          function C(e, t, i, r) {
            if (
              !(function (e, t, i, r) {
                let n = e.createTexture();
                if (!n) return !1;
                (e.bindTexture(e.TEXTURE_2D, n),
                  e.texParameteri(
                    e.TEXTURE_2D,
                    e.TEXTURE_MIN_FILTER,
                    e.NEAREST,
                  ),
                  e.texParameteri(
                    e.TEXTURE_2D,
                    e.TEXTURE_MAG_FILTER,
                    e.NEAREST,
                  ),
                  e.texParameteri(
                    e.TEXTURE_2D,
                    e.TEXTURE_WRAP_S,
                    e.CLAMP_TO_EDGE,
                  ),
                  e.texParameteri(
                    e.TEXTURE_2D,
                    e.TEXTURE_WRAP_T,
                    e.CLAMP_TO_EDGE,
                  ),
                  e.texImage2D(e.TEXTURE_2D, 0, t, 4, 4, 0, i, r, null));
                let s = e.createFramebuffer();
                return (
                  !!s &&
                  (e.bindFramebuffer(e.FRAMEBUFFER, s),
                  e.framebufferTexture2D(
                    e.FRAMEBUFFER,
                    e.COLOR_ATTACHMENT0,
                    e.TEXTURE_2D,
                    n,
                    0,
                  ),
                  e.checkFramebufferStatus(e.FRAMEBUFFER) ===
                    e.FRAMEBUFFER_COMPLETE)
                );
              })(e, t, i, r)
            ) {
              if ("drawBuffers" in e)
                switch (t) {
                  case e.R16F:
                    return C(e, e.RG16F, e.RG, r);
                  case e.RG16F:
                    return C(e, e.RGBA16F, e.RGBA, r);
                }
              return null;
            }
            return { internalFormat: t, format: i };
          }
          function D(e, t) {
            let i =
                arguments.length > 2 && void 0 !== arguments[2]
                  ? arguments[2]
                  : null,
              r = (function (e, t) {
                if (!t) return e;
                let i = "";
                for (let e of t)
                  i += `#define ${e}
`;
                return i + e;
              })(t, i),
              n = E.createShader(e);
            if (!n) return null;
            if (
              (E.shaderSource(n, r),
              E.compileShader(n),
              !E.getShaderParameter(n, E.COMPILE_STATUS))
            )
              throw Error(E.getShaderInfoLog(n) ?? "Shader compilation failed");
            return n;
          }
          function M(e, t) {
            if (!e || !t) return null;
            let i = E.createProgram();
            if (!i) return null;
            if (
              (E.attachShader(i, e),
              E.attachShader(i, t),
              E.linkProgram(i),
              !E.getProgramParameter(i, E.LINK_STATUS))
            )
              throw Error(E.getProgramInfoLog(i) ?? "Shader linking failed");
            return i;
          }
          function L(e) {
            let t = {},
              i = E.getProgramParameter(e, E.ACTIVE_UNIFORMS);
            for (let r = 0; r < i; r++) {
              let i = E.getActiveUniform(e, r);
              i && (t[i.name] = E.getUniformLocation(e, i.name));
            }
            return t;
          }
          N.supportLinearFiltering ||
            ((T.DYE_RESOLUTION = 256), (T.SHADING = !1));
          class I {
            program;
            uniforms;
            constructor(e, t) {
              ((this.program = M(e, t)),
                (this.uniforms = this.program ? L(this.program) : {}));
            }
            bind() {
              this.program && E.useProgram(this.program);
            }
          }
          let z = D(
              E.VERTEX_SHADER,
              `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform vec2 texelSize;

      void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `,
            ),
            F = D(
              E.FRAGMENT_SHADER,
              `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      uniform sampler2D uTexture;

      void main () {
          gl_FragColor = texture2D(uTexture, vUv);
      }
    `,
            ),
            k = D(
              E.FRAGMENT_SHADER,
              `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      uniform sampler2D uTexture;
      uniform float value;

      void main () {
          gl_FragColor = value * texture2D(uTexture, vUv);
      }
    `,
            ),
            P = `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      uniform sampler2D uDithering;
      uniform vec2 ditherScale;
      uniform vec2 texelSize;

      vec3 linearToGamma (vec3 color) {
          color = max(color, vec3(0));
          return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
      }

      void main () {
          vec3 c = texture2D(uTexture, vUv).rgb;
          #ifdef SHADING
              vec3 lc = texture2D(uTexture, vL).rgb;
              vec3 rc = texture2D(uTexture, vR).rgb;
              vec3 tc = texture2D(uTexture, vT).rgb;
              vec3 bc = texture2D(uTexture, vB).rgb;

              float dx = length(rc) - length(lc);
              float dy = length(tc) - length(bc);

              vec3 n = normalize(vec3(dx, dy, length(texelSize)));
              vec3 l = vec3(0.0, 0.0, 1.0);

              float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
              c *= diffuse;
          #endif

          float a = max(c.r, max(c.g, c.b));
          gl_FragColor = vec4(c, a);
      }
    `,
            O = D(
              E.FRAGMENT_SHADER,
              `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;

      void main () {
          vec2 p = vUv - point.xy;
          p.x *= aspectRatio;
          vec3 splat = exp(-dot(p, p) / radius) * color;
          vec3 base = texture2D(uTarget, vUv).xyz;
          gl_FragColor = vec4(base + splat, 1.0);
      }
    `,
            ),
            B = D(
              E.FRAGMENT_SHADER,
              `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform vec2 dyeTexelSize;
      uniform float dt;
      uniform float dissipation;

      vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
          vec2 st = uv / tsize - 0.5;
          vec2 iuv = floor(st);
          vec2 fuv = fract(st);

          vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
          vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
          vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
          vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

          return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
      }

      void main () {
          #ifdef MANUAL_FILTERING
              vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
              vec4 result = bilerp(uSource, coord, dyeTexelSize);
          #else
              vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
              vec4 result = texture2D(uSource, coord);
          #endif
          float decay = 1.0 + dissipation * dt;
          gl_FragColor = result / decay;
      }
    `,
              N.supportLinearFiltering ? null : ["MANUAL_FILTERING"],
            ),
            U = D(
              E.FRAGMENT_SHADER,
              `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;

      void main () {
          float L = texture2D(uVelocity, vL).x;
          float R = texture2D(uVelocity, vR).x;
          float T = texture2D(uVelocity, vT).y;
          float B = texture2D(uVelocity, vB).y;

          vec2 C = texture2D(uVelocity, vUv).xy;
          if (vL.x < 0.0) { L = -C.x; }
          if (vR.x > 1.0) { R = -C.x; }
          if (vT.y > 1.0) { T = -C.y; }
          if (vB.y < 0.0) { B = -C.y; }

          float div = 0.5 * (R - L + T - B);
          gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
      }
    `,
            ),
            Y = D(
              E.FRAGMENT_SHADER,
              `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;

      void main () {
          float L = texture2D(uVelocity, vL).y;
          float R = texture2D(uVelocity, vR).y;
          float T = texture2D(uVelocity, vT).x;
          float B = texture2D(uVelocity, vB).x;
          float vorticity = R - L - T + B;
          gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
      }
    `,
            ),
            G = D(
              E.FRAGMENT_SHADER,
              `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      uniform sampler2D uCurl;
      uniform float curl;
      uniform float dt;

      void main () {
          float L = texture2D(uCurl, vL).x;
          float R = texture2D(uCurl, vR).x;
          float T = texture2D(uCurl, vT).x;
          float B = texture2D(uCurl, vB).x;
          float C = texture2D(uCurl, vUv).x;

          vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
          force /= length(force) + 0.0001;
          force *= curl * C;
          force.y *= -1.0;

          vec2 velocity = texture2D(uVelocity, vUv).xy;
          velocity += force * dt;
          velocity = min(max(velocity, -1000.0), 1000.0);
          gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `,
            ),
            X = D(
              E.FRAGMENT_SHADER,
              `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uDivergence;

      void main () {
          float L = texture2D(uPressure, vL).x;
          float R = texture2D(uPressure, vR).x;
          float T = texture2D(uPressure, vT).x;
          float B = texture2D(uPressure, vB).x;
          float C = texture2D(uPressure, vUv).x;
          float divergence = texture2D(uDivergence, vUv).x;
          float pressure = (L + R + B + T - divergence) * 0.25;
          gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
      }
    `,
            ),
            H = D(
              E.FRAGMENT_SHADER,
              `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uVelocity;

      void main () {
          float L = texture2D(uPressure, vL).x;
          float R = texture2D(uPressure, vR).x;
          float T = texture2D(uPressure, vT).x;
          float B = texture2D(uPressure, vB).x;
          vec2 velocity = texture2D(uVelocity, vUv).xy;
          velocity.xy -= vec2(R - L, T - B);
          gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `,
            ),
            $ = (() => {
              let e = E.createBuffer();
              if (!e) throw Error("Unable to create WebGL vertex buffer");
              (E.bindBuffer(E.ARRAY_BUFFER, e),
                E.bufferData(
                  E.ARRAY_BUFFER,
                  new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
                  E.STATIC_DRAW,
                ));
              let t = E.createBuffer();
              if (!t) throw Error("Unable to create WebGL index buffer");
              return (
                E.bindBuffer(E.ELEMENT_ARRAY_BUFFER, t),
                E.bufferData(
                  E.ELEMENT_ARRAY_BUFFER,
                  new Uint16Array([0, 1, 2, 0, 2, 3]),
                  E.STATIC_DRAW,
                ),
                E.vertexAttribPointer(0, 2, E.FLOAT, !1, 0, 0),
                E.enableVertexAttribArray(0),
                function (e) {
                  let t =
                    arguments.length > 1 &&
                    void 0 !== arguments[1] &&
                    arguments[1];
                  E &&
                    (e
                      ? (E.viewport(0, 0, e.width, e.height),
                        E.bindFramebuffer(E.FRAMEBUFFER, e.fbo))
                      : (E.viewport(
                          0,
                          0,
                          E.drawingBufferWidth,
                          E.drawingBufferHeight,
                        ),
                        E.bindFramebuffer(E.FRAMEBUFFER, null)),
                    t &&
                      (E.clearColor(0, 0, 0, 1), E.clear(E.COLOR_BUFFER_BIT)),
                    E.drawElements(E.TRIANGLES, 6, E.UNSIGNED_SHORT, 0));
                }
              );
            })(),
            V = new I(z, F),
            W = new I(z, k),
            q = new I(z, O),
            Z = new I(z, B),
            K = new I(z, U),
            Q = new I(z, Y),
            J = new I(z, G),
            ee = new I(z, X),
            et = new I(z, H),
            ei = new (class {
              vertexShader;
              fragmentShaderSource;
              programs;
              activeProgram;
              uniforms;
              constructor(e, t) {
                ((this.vertexShader = e),
                  (this.fragmentShaderSource = t),
                  (this.programs = {}),
                  (this.activeProgram = null),
                  (this.uniforms = {}));
              }
              setKeywords(e) {
                let t = 0;
                for (let i of e)
                  t += (function (e) {
                    if (!e.length) return 0;
                    let t = 0;
                    for (let i = 0; i < e.length; i++)
                      t = ((t << 5) - t + e.charCodeAt(i)) | 0;
                    return t;
                  })(i);
                let i = this.programs[t];
                if (null == i) {
                  let r = D(E.FRAGMENT_SHADER, this.fragmentShaderSource, e);
                  ((i = M(this.vertexShader, r)), (this.programs[t] = i));
                }
                i !== this.activeProgram &&
                  (i && (this.uniforms = L(i)), (this.activeProgram = i));
              }
              bind() {
                this.activeProgram && E.useProgram(this.activeProgram);
              }
            })(z, P);
          function er(e, t, i, r, n, s) {
            E.activeTexture(E.TEXTURE0);
            let o = E.createTexture();
            if (!o) throw Error("Unable to create WebGL texture");
            (E.bindTexture(E.TEXTURE_2D, o),
              E.texParameteri(E.TEXTURE_2D, E.TEXTURE_MIN_FILTER, s),
              E.texParameteri(E.TEXTURE_2D, E.TEXTURE_MAG_FILTER, s),
              E.texParameteri(E.TEXTURE_2D, E.TEXTURE_WRAP_S, E.CLAMP_TO_EDGE),
              E.texParameteri(E.TEXTURE_2D, E.TEXTURE_WRAP_T, E.CLAMP_TO_EDGE),
              E.texImage2D(E.TEXTURE_2D, 0, i, e, t, 0, r, n, null));
            let a = E.createFramebuffer();
            if (!a) throw Error("Unable to create WebGL framebuffer");
            (E.bindFramebuffer(E.FRAMEBUFFER, a),
              E.framebufferTexture2D(
                E.FRAMEBUFFER,
                E.COLOR_ATTACHMENT0,
                E.TEXTURE_2D,
                o,
                0,
              ),
              E.viewport(0, 0, e, t),
              E.clear(E.COLOR_BUFFER_BIT));
            let l = 1 / e,
              u = 1 / t;
            return {
              texture: o,
              fbo: a,
              width: e,
              height: t,
              texelSizeX: l,
              texelSizeY: u,
              attach: (e) => (
                E.activeTexture(E.TEXTURE0 + e),
                E.bindTexture(E.TEXTURE_2D, o),
                e
              ),
            };
          }
          function en(e, t, i, r, n, s) {
            let o = er(e, t, i, r, n, s),
              a = er(e, t, i, r, n, s);
            return {
              width: e,
              height: t,
              texelSizeX: o.texelSizeX,
              texelSizeY: o.texelSizeY,
              read: o,
              write: a,
              swap() {
                let e = this.read;
                ((this.read = this.write), (this.write = e));
              },
            };
          }
          function es(e, t, i, r, n, s, o) {
            var a;
            let l;
            return e.width === t && e.height === i
              ? e
              : ((a = e.read),
                (l = er(t, i, r, n, s, o)),
                V.bind(),
                V.uniforms.uTexture &&
                  E.uniform1i(V.uniforms.uTexture, a.attach(0)),
                $(l, !1),
                (e.read = l),
                (e.write = er(t, i, r, n, s, o)),
                (e.width = t),
                (e.height = i),
                (e.texelSizeX = 1 / t),
                (e.texelSizeY = 1 / i),
                e);
          }
          function eo() {
            let t = ea(T.SIM_RESOLUTION),
              i = ea(T.DYE_RESOLUTION),
              o = N.halfFloatTexType,
              a = N.formatRGBA,
              l = N.formatRG,
              u = N.formatR,
              c = N.supportLinearFiltering ? E.LINEAR : E.NEAREST;
            (E.disable(E.BLEND),
              (e = e
                ? es(e, i.width, i.height, a.internalFormat, a.format, o, c)
                : en(i.width, i.height, a.internalFormat, a.format, o, c)),
              (r = r
                ? es(r, t.width, t.height, l.internalFormat, l.format, o, c)
                : en(t.width, t.height, l.internalFormat, l.format, o, c)),
              (n = er(
                t.width,
                t.height,
                u.internalFormat,
                u.format,
                o,
                E.NEAREST,
              )),
              (s = er(
                t.width,
                t.height,
                u.internalFormat,
                u.format,
                o,
                E.NEAREST,
              )),
              (f = en(
                t.width,
                t.height,
                u.internalFormat,
                u.format,
                o,
                E.NEAREST,
              )));
          }
          function ea(e) {
            let t = E.drawingBufferWidth,
              i = E.drawingBufferHeight,
              r = t / i,
              n = Math.round(e),
              s = Math.round(e * (r < 1 ? 1 / r : r));
            return t > i ? { width: s, height: n } : { width: n, height: s };
          }
          function el(e) {
            return Math.floor(e * (window.devicePixelRatio || 1));
          }
          ((p = []), T.SHADING && p.push("SHADING"), ei.setKeywords(p), eo());
          let eu = Date.now(),
            ec = 0,
            ed = null,
            em = !1,
            eh = eg(T.COLOR);
          function ex() {
            em ||
              ((em = !0),
              (function t() {
                var i;
                let o,
                  a,
                  l,
                  u,
                  c,
                  d,
                  m =
                    ((a = Math.min(
                      (a = ((o = Date.now()) - eu) / 1e3),
                      0.016666,
                    )),
                    (eu = o),
                    a);
                ((l = el(S.clientWidth)),
                  (u = el(S.clientHeight)),
                  (S.width !== l || S.height !== u) &&
                    ((S.width = l), (S.height = u), 1) &&
                    eo(),
                  (function (e) {
                    var t;
                    let i;
                    if (T.COLOR_RESOLVER) {
                      let t = 1 - Math.exp(-T.COLOR_TRANSITION_SPEED * e);
                      A.forEach((e) => {
                        e.color = {
                          r: e.color.r + (eh.r - e.color.r) * t,
                          g: e.color.g + (eh.g - e.color.g) * t,
                          b: e.color.b + (eh.b - e.color.b) * t,
                        };
                      });
                      return;
                    }
                    (ec += e * T.COLOR_UPDATE_SPEED) >= 1 &&
                      ((t = ec),
                      (ec = 0 == (i = 1) ? 0 : ((t - 0) % i) + 0),
                      A.forEach((e) => {
                        e.color = ew();
                      }));
                  })(m),
                  (function () {
                    for (let e of A)
                      e.moved &&
                        ((e.moved = !1),
                        (function (e) {
                          let t = e.deltaX * T.SPLAT_FORCE,
                            i = e.deltaY * T.SPLAT_FORCE;
                          ef(e.texcoordX, e.texcoordY, t, i, e.color);
                        })(e));
                  })(),
                  (function (t) {
                    (E.disable(E.BLEND),
                      Q.bind(),
                      Q.uniforms.texelSize &&
                        E.uniform2f(
                          Q.uniforms.texelSize,
                          r.texelSizeX,
                          r.texelSizeY,
                        ),
                      Q.uniforms.uVelocity &&
                        E.uniform1i(Q.uniforms.uVelocity, r.read.attach(0)),
                      $(s),
                      J.bind(),
                      J.uniforms.texelSize &&
                        E.uniform2f(
                          J.uniforms.texelSize,
                          r.texelSizeX,
                          r.texelSizeY,
                        ),
                      J.uniforms.uVelocity &&
                        E.uniform1i(J.uniforms.uVelocity, r.read.attach(0)),
                      J.uniforms.uCurl &&
                        E.uniform1i(J.uniforms.uCurl, s.attach(1)),
                      J.uniforms.curl && E.uniform1f(J.uniforms.curl, T.CURL),
                      J.uniforms.dt && E.uniform1f(J.uniforms.dt, t),
                      $(r.write),
                      r.swap(),
                      K.bind(),
                      K.uniforms.texelSize &&
                        E.uniform2f(
                          K.uniforms.texelSize,
                          r.texelSizeX,
                          r.texelSizeY,
                        ),
                      K.uniforms.uVelocity &&
                        E.uniform1i(K.uniforms.uVelocity, r.read.attach(0)),
                      $(n),
                      W.bind(),
                      W.uniforms.uTexture &&
                        E.uniform1i(W.uniforms.uTexture, f.read.attach(0)),
                      W.uniforms.value &&
                        E.uniform1f(W.uniforms.value, T.PRESSURE),
                      $(f.write),
                      f.swap(),
                      ee.bind(),
                      ee.uniforms.texelSize &&
                        E.uniform2f(
                          ee.uniforms.texelSize,
                          r.texelSizeX,
                          r.texelSizeY,
                        ),
                      ee.uniforms.uDivergence &&
                        E.uniform1i(ee.uniforms.uDivergence, n.attach(0)));
                    for (let e = 0; e < T.PRESSURE_ITERATIONS; e++)
                      (ee.uniforms.uPressure &&
                        E.uniform1i(ee.uniforms.uPressure, f.read.attach(1)),
                        $(f.write),
                        f.swap());
                    (et.bind(),
                      et.uniforms.texelSize &&
                        E.uniform2f(
                          et.uniforms.texelSize,
                          r.texelSizeX,
                          r.texelSizeY,
                        ),
                      et.uniforms.uPressure &&
                        E.uniform1i(et.uniforms.uPressure, f.read.attach(0)),
                      et.uniforms.uVelocity &&
                        E.uniform1i(et.uniforms.uVelocity, r.read.attach(1)),
                      $(r.write),
                      r.swap(),
                      Z.bind(),
                      Z.uniforms.texelSize &&
                        E.uniform2f(
                          Z.uniforms.texelSize,
                          r.texelSizeX,
                          r.texelSizeY,
                        ),
                      !N.supportLinearFiltering &&
                        Z.uniforms.dyeTexelSize &&
                        E.uniform2f(
                          Z.uniforms.dyeTexelSize,
                          r.texelSizeX,
                          r.texelSizeY,
                        ));
                    let i = r.read.attach(0);
                    (Z.uniforms.uVelocity &&
                      E.uniform1i(Z.uniforms.uVelocity, i),
                      Z.uniforms.uSource && E.uniform1i(Z.uniforms.uSource, i),
                      Z.uniforms.dt && E.uniform1f(Z.uniforms.dt, t),
                      Z.uniforms.dissipation &&
                        E.uniform1f(
                          Z.uniforms.dissipation,
                          T.VELOCITY_DISSIPATION,
                        ),
                      $(r.write),
                      r.swap(),
                      !N.supportLinearFiltering &&
                        Z.uniforms.dyeTexelSize &&
                        E.uniform2f(
                          Z.uniforms.dyeTexelSize,
                          e.texelSizeX,
                          e.texelSizeY,
                        ),
                      Z.uniforms.uVelocity &&
                        E.uniform1i(Z.uniforms.uVelocity, r.read.attach(0)),
                      Z.uniforms.uSource &&
                        E.uniform1i(Z.uniforms.uSource, e.read.attach(1)),
                      Z.uniforms.dissipation &&
                        E.uniform1f(
                          Z.uniforms.dissipation,
                          T.DENSITY_DISSIPATION,
                        ),
                      $(e.write),
                      e.swap());
                  })(m),
                  E.blendFunc(E.ONE, E.ONE_MINUS_SRC_ALPHA),
                  E.enable(E.BLEND),
                  (c = ((i = null), E.drawingBufferWidth)),
                  (d = i ? i.height : E.drawingBufferHeight),
                  ei.bind(),
                  T.SHADING &&
                    ei.uniforms.texelSize &&
                    E.uniform2f(ei.uniforms.texelSize, 1 / c, 1 / d),
                  ei.uniforms.uTexture &&
                    E.uniform1i(ei.uniforms.uTexture, e.read.attach(0)),
                  $(i, !1),
                  (ed = requestAnimationFrame(t)));
              })());
          }
          function ef(t, i, n, s, o) {
            var a;
            let l;
            (q.bind(),
              q.uniforms.uTarget &&
                E.uniform1i(q.uniforms.uTarget, r.read.attach(0)),
              q.uniforms.aspectRatio &&
                E.uniform1f(q.uniforms.aspectRatio, S.width / S.height),
              q.uniforms.point && E.uniform2f(q.uniforms.point, t, i),
              q.uniforms.color && E.uniform3f(q.uniforms.color, n, s, 0),
              q.uniforms.radius &&
                E.uniform1f(
                  q.uniforms.radius,
                  ((a = T.SPLAT_RADIUS / 100),
                  (l = S.width / S.height) > 1 && (a *= l),
                  a),
                ),
              $(r.write),
              r.swap(),
              q.uniforms.uTarget &&
                E.uniform1i(q.uniforms.uTarget, e.read.attach(0)),
              q.uniforms.color && E.uniform3f(q.uniforms.color, o.r, o.g, o.b),
              $(e.write),
              e.swap());
          }
          function ep(e, t, i, r) {
            ((e.id = t),
              (e.down = !0),
              (e.moved = !1),
              (e.texcoordX = i / S.width),
              (e.texcoordY = 1 - r / S.height),
              (e.prevTexcoordX = e.texcoordX),
              (e.prevTexcoordY = e.texcoordY),
              (e.deltaX = 0),
              (e.deltaY = 0),
              (e.color = T.COLOR_RESOLVER ? eh : ew()));
          }
          function ev(e, t, i, r) {
            var n, s;
            let o, a;
            ((e.prevTexcoordX = e.texcoordX),
              (e.prevTexcoordY = e.texcoordY),
              (e.texcoordX = t / S.width),
              (e.texcoordY = 1 - i / S.height),
              (n = e.texcoordX - e.prevTexcoordX),
              (o = S.width / S.height) < 1 && (n *= o),
              (e.deltaX = n),
              (s = e.texcoordY - e.prevTexcoordY),
              (a = S.width / S.height) > 1 && (s /= a),
              (e.deltaY = s),
              (e.moved = Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0),
              (e.color = r));
          }
          function eg(e) {
            let t = e.replace("#", "");
            return (
              3 === t.length && (t = t[0] + t[0] + t[1] + t[1] + t[2] + t[2]),
              {
                r: 0.15 * (Number.parseInt(t.slice(0, 2), 16) / 255),
                g: 0.15 * (Number.parseInt(t.slice(2, 4), 16) / 255),
                b: 0.15 * (Number.parseInt(t.slice(4, 6), 16) / 255),
              }
            );
          }
          function ew() {
            if (!T.RAINBOW_MODE) return eg(T.COLOR);
            let e = (function (e) {
              let t = 0,
                i = 0,
                r = 0,
                n = Math.floor(6 * e),
                s = 6 * e - n,
                o = 0,
                a = +(1 - s),
                l = +(1 - (1 - s) * 1);
              switch (n % 6) {
                case 0:
                  ((t = 1), (i = l), (r = o));
                  break;
                case 1:
                  ((t = a), (i = 1), (r = o));
                  break;
                case 2:
                  ((t = o), (i = 1), (r = l));
                  break;
                case 3:
                  ((t = o), (i = a), (r = 1));
                  break;
                case 4:
                  ((t = l), (i = o), (r = 1));
                  break;
                case 5:
                  ((t = 1), (i = o), (r = a));
              }
              return { r: t, g: i, b: r };
            })(Math.random());
            return ((e.r *= 0.15), (e.g *= 0.15), (e.b *= 0.15), e);
          }
          function ey(e, t) {
            return eg(
              T.COLOR_RESOLVER?.(e, t, 0.001 * performance.now()) ?? T.COLOR,
            );
          }
          function ej(e) {
            if (!activeCheck()) return;
            let t,
              i,
              r,
              n = A[0],
              s = el(e.clientX),
              o = el(e.clientY);
            ((n.color = eh = ey(e.clientX, e.clientY)),
              ep(n, -1, s, o),
              (t = T.COLOR_RESOLVER ? { ...n.color } : ew()),
              (t.r *= 10),
              (t.g *= 10),
              (t.b *= 10),
              (i = 10 * (Math.random() - 0.5)),
              (r = 30 * (Math.random() - 0.5)),
              ef(n.texcoordX, n.texcoordY, i, r, t));
          }
          function eb(e) {
            if (!activeCheck()) return;
            let t = A[0],
              i = el(e.clientX),
              r = el(e.clientY),
              n = ey(e.clientX, e.clientY);
            ((eh = n),
              ex(),
              ev(t, i, r, n),
              document.body.removeEventListener("mousemove", eb));
          }
          function eS(e) {
            if (!activeCheck()) return;
            let t = A[0],
              i = el(e.clientX),
              r = el(e.clientY);
            eh = ey(e.clientX, e.clientY);
            let n = t.color;
            ev(t, i, r, n);
          }
          function e_(e) {
            if (!activeCheck()) return;
            let t = e.targetTouches,
              i = A[0];
            for (let e = 0; e < t.length; e++) {
              let r = el(t[e].clientX),
                n = el(t[e].clientY);
              ((i.color = eh = ey(t[e].clientX, t[e].clientY)),
                ex(),
                ep(i, t[e].identifier, r, n));
            }
            document.body.removeEventListener("touchstart", e_);
          }
          function eA(e) {
            if (!activeCheck()) return;
            let t = e.targetTouches,
              i = A[0];
            for (let e = 0; e < t.length; e++) {
              let r = el(t[e].clientX),
                n = el(t[e].clientY);
              ((eh = ey(t[e].clientX, t[e].clientY)),
                ep(i, t[e].identifier, r, n));
            }
          }
          function eT(e) {
            if (!activeCheck()) return;
            let t = e.targetTouches,
              i = A[0];
            for (let e = 0; e < t.length; e++) {
              let r = el(t[e].clientX),
                n = el(t[e].clientY);
              ((eh = ey(t[e].clientX, t[e].clientY)), ev(i, r, n, i.color));
            }
          }
          function eR(e) {
            let t = e.changedTouches,
              i = A[0];
            for (let e = 0; e < t.length; e++) i.down = !1;
          }
          return (
            window.addEventListener("mousedown", ej),
            document.body.addEventListener("mousemove", eb),
            window.addEventListener("mousemove", eS),
            document.body.addEventListener("touchstart", e_),
            window.addEventListener("touchstart", eA, !1),
            window.addEventListener("touchmove", eT, !1),
            window.addEventListener("touchend", eR),
            () => {
              if (null !== ed) cancelAnimationFrame(ed);
              window.removeEventListener("mousedown", ej);
              window.removeEventListener("mousemove", eS);
              window.removeEventListener("touchstart", eA);
              window.removeEventListener("touchmove", eT);
              window.removeEventListener("touchend", eR);
              document.body.removeEventListener("mousemove", eb);
              document.body.removeEventListener("touchstart", e_);
              E.getExtension("WEBGL_lose_context")?.loseContext();
            }
          );

}

export function mountNeonCursor(options = {}) {
  if (!document.body) return () => {};
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced) return () => {};

  const activeCheck = typeof options.isActive === 'function' ? options.isActive : () => true;
  const baseColor = options.color || DEFAULT_SPLASH_OPTIONS.COLOR;
  const wrapper = document.createElement('div');
  wrapper.id = 'home-cursor-neon';
  wrapper.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  wrapper.appendChild(canvas);
  document.body.appendChild(wrapper);

  const dispose = startSplashCursor(canvas, {
    ...DEFAULT_SPLASH_OPTIONS,
    ...options,
    COLOR: baseColor,
    COLOR_RESOLVER: options.colorResolver || ((x, y, time) => resolveSplashColor(x, y, time, baseColor))
  }, activeCheck);

  if (!dispose) {
    wrapper.remove();
    return () => {};
  }

  const syncActive = () => wrapper.classList.toggle('is-active', !!activeCheck());
  window.addEventListener('scroll', syncActive, { passive: true });
  window.addEventListener('resize', syncActive, { passive: true });
  syncActive();

  return () => {
    window.removeEventListener('scroll', syncActive);
    window.removeEventListener('resize', syncActive);
    dispose?.();
    wrapper.remove();
  };
}
