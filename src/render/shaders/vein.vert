in vec2 aPosition;
in vec2 aUV;
in vec3 aStyle;
in float aFeed;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

out vec2 vUV;
out vec3 vStyle;
out float vFeed;

void main(void) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vStyle = aStyle;
  vFeed = aFeed;
}
