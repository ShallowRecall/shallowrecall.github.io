/*
 * Exact Strands shader used by moxuna.com (extracted from its shipped bundle).
 * The original component renders a full-screen procedural lighting field.
 */

export const STRANDS_VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const STRANDS_FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColors[8];
uniform int uColorCount;
uniform int uStrandCount;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaviness;
uniform float uThickness;
uniform float uGlow;
uniform float uTaper;
uniform float uSpread;
uniform float uHueShift;
uniform float uIntensity;
uniform float uOpacity;
uniform float uScale;
uniform float uSaturation;

out vec4 fragColor;

const float PI = 3.14159265;

vec3 spectrum(float t) {
  return 0.5 + 0.5 * cos(2.0 * PI * (t + vec3(0.00, 0.33, 0.67)));
}

vec3 samplePalette(float t) {
  t = fract(t);
  float scaled = t * float(uColorCount);
  int idx = int(floor(scaled));
  float blend = fract(scaled);
  int nextIdx = idx + 1;
  if (nextIdx >= uColorCount) nextIdx = 0;
  return mix(uColors[idx], uColors[nextIdx], blend);
}

vec3 strandColor(float t) {
  if (uColorCount > 0) return samplePalette(t);
  return spectrum(t);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  uv /= max(uScale, 0.0001);

  float energy = 0.06 + uIntensity * 0.94;
  float envelope = pow(max(cos(uv.x * PI * 1.3), 0.0), uTaper);
  vec3 color = vec3(0.0);

  for (int i = 0; i < 12; i++) {
    if (i >= uStrandCount) break;

    float strand = float(i);
    float phase = strand * 1.7 * uSpread;
    float frequency = (2.0 + strand * 0.35) * uWaviness;
    float strandSpeed = 1.4 + strand * 1.2;
    float time = uTime * uSpeed;
    float wave = sin(uv.x * frequency + time * strandSpeed + phase) * 0.60
      + sin(uv.x * frequency * 1.1 - time * strandSpeed * 0.7 + phase * 1.7) * 0.40;
    float amplitude = (0.1 + 0.02 * energy) * envelope * uAmplitude;
    float y = wave * amplitude;
    float distanceToStrand = abs(uv.y - y);
    float width = (0.001 + 0.05 * energy) * (0.35 + envelope) * uThickness;
    float light = width / (distanceToStrand + width * 0.45);
    light *= light;
    float hue = strand / float(uStrandCount) + uv.x * 0.30 + uTime * 0.04 + uHueShift;
    vec3 currentColor = strandColor(hue);
    float ambient = exp(-distanceToStrand * 2.8) * 0.055;
    color += currentColor * (light + ambient) * envelope;
  }

  color *= 0.45 + 0.7 * energy;
  color = 1.0 - exp(-color * uGlow);
  float gray = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = max(mix(vec3(gray), color, uSaturation), 0.0);
  float luminance = max(max(color.r, color.g), color.b);
  float alpha = clamp(luminance, 0.0, 1.0) * uOpacity;
  fragColor = vec4(color * uOpacity, alpha);
}
`;
