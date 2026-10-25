precision highp float;

in vec2 vUV;     // x: -1..1 across the vein, y: distance along the edge in cells
in vec2 vStyle;  // x: signed flow, y: 0 = ink outline pass, 1 = colored core

out vec4 finalColor;

uniform vec3 uMold;
uniform vec3 uInk;
uniform float uTime;
uniform float uPattern;

// 1 where this mold's ink pattern draws a mark; p runs along and across the vein
float patternMask(int id, vec2 p) {
  if (id == 1) return step(0.58, fract((p.x + p.y) * 1.4));
  if (id == 2) return 1.0 - step(0.2, length(fract(p * 1.6) - 0.5));
  if (id == 3) return 1.0 - step(0.07, abs(length(fract(p * 1.2) - 0.5) - 0.3));
  if (id == 4) return max(step(0.66, fract((p.x + p.y) * 1.4)), step(0.66, fract((p.x - p.y) * 1.4)));
  if (id == 5) return step(0.55, fract(p.y * 1.5 + sin(p.x * 3.0) * 0.35));
  return 0.0;
}

void main(void) {
  if (vStyle.y < 0.5) {
    finalColor = vec4(uInk, 1.0);
    return;
  }

  float u = vUV.x;
  // flat cel bands: an offset highlight stripe and a shadow side, no gradients
  float hi = step(-0.62, u) * (1.0 - step(-0.28, u));
  float sh = step(0.55, u);
  vec3 col = uMold * mix(1.0, 0.72, sh);
  col = mix(col, vec3(1.0), hi * 0.4);

  // chunky dashes march along the vein in the direction nutrients flow
  float flow = vStyle.x;
  if (abs(flow) > 0.05) {
    float phase = vUV.y * 1.3 - sign(flow) * uTime * 1.6;
    float dash = step(0.66, fract(phase));
    col = mix(col, uInk, dash * 0.42 * (1.0 - hi));
  }
  // the mold's ink pattern, so molds differ by more than color (FR-033)
  float pm = patternMask(int(uPattern + 0.5), vec2(vUV.y * 1.7, vUV.x * 1.3)) * (1.0 - hi);
  col = mix(col, uInk, pm * 0.5);
  finalColor = vec4(col, 1.0);
}
