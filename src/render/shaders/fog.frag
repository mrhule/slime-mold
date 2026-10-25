#version 300 es
precision highp float;

in vec2 vUV;
out vec4 finalColor;

// One texel per grid cell, nearest filtering: r = 0 never seen, ~0.5 remembered, 1 visible now
uniform sampler2D uVision;
uniform vec2 uGrid;
uniform float uTime;
uniform vec3 uInk;

float seenAt(vec2 c) {
  vec2 cc = clamp(c, vec2(0.0), uGrid - 1.0);
  return texture(uVision, (cc + 0.5) / uGrid).r;
}

float h21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main(void) {
  vec2 p = vUV * uGrid;

  // hand-drawn boundary: wobble the sample point, re-seeded 8 times a second
  float t = floor(uTime * 8.0);
  vec2 wob = (vec2(vnoise(p * 1.4 + t * 1.3), vnoise(p * 1.4 + 17.0 - t * 1.1)) - 0.5) * 0.9;
  vec2 q = p + wob - 0.5;
  vec2 i = floor(q);
  vec2 f = fract(q);
  float a = seenAt(i);
  float b = seenAt(i + vec2(1.0, 0.0));
  float c = seenAt(i + vec2(0.0, 1.0));
  float d = seenAt(i + vec2(1.0, 1.0));

  // smooth "visible now" and "ever seen" fields; 0.5 is each region's edge
  float vis = mix(mix(step(0.9, a), step(0.9, b), f.x), mix(step(0.9, c), step(0.9, d), f.x), f.y);
  float seen = mix(mix(step(0.4, a), step(0.4, b), f.x), mix(step(0.4, c), step(0.4, d), f.x), f.y);
  float fw = max(fwidth(seen), max(fwidth(vis), 1e-3));

  float unseen = 1.0 - smoothstep(0.5 - fw * 0.5, 0.5 + fw * 0.5, seen);
  float memory = (1.0 - smoothstep(0.5 - fw * 0.5, 0.5 + fw * 0.5, vis)) * (1.0 - unseen);

  // never seen: dense ink scribble. The terrain still shows through the gaps (FR-028).
  vec2 s = p * 1.7;
  float h1 = step(0.52, fract((s.x + s.y) * 1.1 + vnoise(p * 0.7) * 0.9));
  float h2 = step(0.58, fract((s.x - s.y) * 1.1 + vnoise(p * 0.5 + 9.0) * 0.9));
  float hatch = max(h1, h2);
  vec3 scribbleColor = mix(vec3(0.07, 0.065, 0.06), uInk, hatch);
  float scribbleAlpha = 0.34 + 0.6 * hatch;

  // remembered: flat gray halftone dots, so stale information reads as old
  float dots = 1.0 - step(0.27, length(fract(p * 1.15) - 0.5));
  vec3 memoryColor = mix(vec3(0.55, 0.55, 0.5), uInk, 0.75);
  float memoryAlpha = 0.1 + 0.5 * dots;

  vec3 col = mix(memoryColor, scribbleColor, unseen);
  float alpha = unseen * scribbleAlpha + memory * memoryAlpha;

  // hand-inked line along both boundaries
  float edge = max(1.0 - smoothstep(0.0, fw * 2.6, abs(vis - 0.5)), 1.0 - smoothstep(0.0, fw * 2.6, abs(seen - 0.5)));
  edge *= step(0.001, seen + vis + 0.001) * 0.9;
  col = mix(col, uInk, edge);
  alpha = max(alpha, edge);

  finalColor = vec4(col * alpha, alpha);
}
