precision highp float;

out vec4 finalColor;

uniform vec3 uInk;

// opaque on purpose: the shadow group is blended once at the shadow alpha, so overlapping edges and
// joints do not darken twice (A12)
void main(void) {
  finalColor = vec4(uInk, 1.0);
}
