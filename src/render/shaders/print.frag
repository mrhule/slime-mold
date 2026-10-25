precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform float uPitch;
uniform float uFringe;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// off-register print: red and blue sampled a pixel apart in opposite directions, then a halftone dot
// screen that darkens shadows and a fine grain over everything (A9)
void main(void) {
  vec2 px = vTextureCoord * uInputSize.xy;
  vec2 off = vec2(uFringe) * uInputSize.zw;
  vec4 mid = texture(uTexture, vTextureCoord);
  float r = texture(uTexture, vTextureCoord + off).r;
  float b = texture(uTexture, vTextureCoord - off).b;
  vec3 col = vec3(r, mid.g, b);

  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  // rotated dot grid; the dot grows where the picture is dark
  vec2 g = mat2(0.866, -0.5, 0.5, 0.866) * px / uPitch;
  float d = length(fract(g) - 0.5);
  float radius = 0.5 * (1.0 - smoothstep(0.15, 0.7, luma));
  float spot = 1.0 - smoothstep(radius - 0.08, radius + 0.08, d);
  col *= 1.0 - 0.28 * spot * (1.0 - smoothstep(0.15, 0.7, luma));

  col += (hash(floor(px)) - 0.5) * 0.035;
  finalColor = vec4(col * mid.a, mid.a);
}
