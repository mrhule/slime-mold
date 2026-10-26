precision highp float;

in vec2 vUV;     // x: -1..1 across the vein (lit side is u < 0), y: distance along the edge in cells
in float vFeed;   // 1 where the vein is well fed, 0 at the far end of supply
in vec3 vStyle;  // x: signed pulse count (0, +-1, +-2; the sign is the flow direction), y: 0 = ink outline pass, 1 = colored core, z: pulse phase

out vec4 finalColor;

uniform vec3 uMold;
uniform vec3 uInk;
uniform float uTime;
uniform float uPattern;
uniform float uPulses;      // 0 turns pulses off (Low quality)
uniform float uPulseSpeed;  // cells per second

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
  // flat cel bands: a highlight stripe on the lit side (u < 0) and a shadow side, no gradients
  float hi = step(-0.62, u) * (1.0 - step(-0.28, u));
  float sh = step(0.55, u);
  vec3 col = uMold * mix(1.0, 0.72, sh);
  col = mix(col, vec3(1.0), hi * 0.4);

  // far from supply the vein looks starved: washed out toward a dull gray
  float lum = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(vec3(lum) * 0.62, col, 0.3 + 0.7 * vFeed);

  // the mold's ink pattern, so molds differ by more than color (FR-033)
  float pm = patternMask(int(uPattern + 0.5), vec2(vUV.y * 1.7, vUV.x * 1.3)) * (1.0 - hi);
  col = mix(col, uInk, pm * 0.5);

  // nutrient packets: round cream beads with an ink ring travel along fed veins in the direction nutrients
  // flow, one per cell for light flow and two for heavy flow, none for an idle vein; the phase differs per
  // edge (A11). A bead fills the width of its vein, so a thick artery carries fat beads and a tendril small ones
  float count = abs(vStyle.x);
  if (uPulses > 0.5 && count > 0.5) {
    float t = (vUV.y + vStyle.z - sign(vStyle.x) * uTime * uPulseSpeed) * count;
    float d = length(vec2((fract(t) - 0.5) * 2.6 / count, u));
    float ring = step(d, 1.0) * (1.0 - step(d, 0.72));
    float bead = 1.0 - step(0.72, d);
    float fed = 0.5 + 0.5 * vFeed;
    col = mix(col, uInk, ring * 0.7 * fed);
    col = mix(col, vec3(1.0, 0.97, 0.62), bead * fed);
  }
  finalColor = vec4(col, 1.0);
}
