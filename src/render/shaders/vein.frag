precision highp float;

in vec2 vUV;     // x: -1..1 across the vein, y: distance along the edge in cells
in vec2 vStyle;  // x: signed flow, y: 0 = ink outline pass, 1 = colored core

out vec4 finalColor;

uniform vec3 uMold;
uniform vec3 uInk;
uniform float uTime;

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
  finalColor = vec4(col, 1.0);
}
