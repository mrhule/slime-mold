#version 300 es
precision highp float;

in vec2 vUV;
out vec4 finalColor;

// One texel per grid cell, sampled with nearest filtering:
//   rgb = owner color (low 3 bits of blue carry the ink pattern id), a = biomass (0 = empty)
uniform sampler2D uData;
uniform vec2 uGrid;
uniform float uTime;
uniform float uOutlinePx;
uniform vec3 uInk;

vec4 cellAt(vec2 c) {
  if (c.x < 0.0 || c.y < 0.0 || c.x >= uGrid.x || c.y >= uGrid.y) return vec4(0.0);
  return texture(uData, (c + 0.5) / uGrid);
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

// 1 where the ink pattern draws a mark
float patternMask(int id, vec2 p) {
  if (id == 1) return step(0.62, fract((p.x + p.y) * 1.6));
  if (id == 2) return 1.0 - step(0.2, length(fract(p * 1.8) - 0.5));
  if (id == 3) return 1.0 - step(0.06, abs(length(fract(p * 1.3) - 0.5) - 0.3));
  if (id == 4) return max(step(0.7, fract((p.x + p.y) * 1.6)), step(0.7, fract((p.x - p.y) * 1.6)));
  if (id == 5) return step(0.6, fract(p.y * 1.5 + sin(p.x * 3.2) * 0.35));
  return 0.0;
}

void main(void) {
  vec2 p = vUV * uGrid;

  // hand-inked boundary: wobble the sample point, re-seeded 8 times a second
  float t = floor(uTime * 8.0);
  vec2 wob = (vec2(vnoise(p * 1.6 + t * 1.7), vnoise(p * 1.6 + 31.0 - t * 1.3)) - 0.5) * 0.6;

  vec2 q = p + wob - 0.5;
  vec2 i = floor(q);
  vec2 f = fract(q);
  vec4 a = cellAt(i);
  vec4 b = cellAt(i + vec2(1.0, 0.0));
  vec4 c = cellAt(i + vec2(0.0, 1.0));
  vec4 d = cellAt(i + vec2(1.0, 1.0));

  float oa = step(0.001, a.a);
  float ob = step(0.001, b.a);
  float oc = step(0.001, c.a);
  float od = step(0.001, d.a);
  float wa = (1.0 - f.x) * (1.0 - f.y);
  float wb = f.x * (1.0 - f.y);
  float wc = (1.0 - f.x) * f.y;
  float wd = f.x * f.y;

  // smooth occupancy field: 0.5 is the shape's edge
  float occ = wa * oa + wb * ob + wc * oc + wd * od;
  float total = max(wa * oa + wb * ob + wc * oc + wd * od, 1e-4);
  float bio = (wa * oa * a.a + wb * ob * b.a + wc * oc * c.a + wd * od * d.a) / total;

  // owner color from the heaviest contributing neighbor
  vec4 src = a;
  float best = wa * oa;
  if (wb * ob > best) { best = wb * ob; src = b; }
  if (wc * oc > best) { best = wc * oc; src = c; }
  if (wd * od > best) { best = wd * od; src = d; }

  float bb = floor(src.b * 255.0 + 0.5);
  float pid = mod(bb, 8.0);
  vec3 base = vec3(src.r, src.g, (bb - pid + 4.0) / 255.0);

  float fw = max(fwidth(occ), 1e-3);
  float inside = smoothstep(0.5 - fw * 0.5, 0.5 + fw * 0.5, occ);
  // heavy ink outline just inside the edge, constant width on screen
  float body = smoothstep(0.5 + uOutlinePx * fw, 0.5 + (uOutlinePx + 1.0) * fw, occ);

  // flat cel bands: thin edges are shadow, the thick middle gets a highlight
  float lvl = occ * (0.55 + 0.45 * bio);
  float hi = step(0.92, lvl);
  float sh = 1.0 - step(0.72, lvl);
  vec3 col = base * mix(mix(1.0, 0.7, sh), 1.12, hi);
  col += hi * 0.07;

  // ink pattern identifies the mold without relying on color (FR-033)
  float pm = patternMask(int(pid + 0.5), p);
  col = mix(col, uInk, pm * mix(0.16, 0.55, sh));

  vec3 outc = mix(uInk, col, body);
  finalColor = vec4(outc * inside, inside);
}
