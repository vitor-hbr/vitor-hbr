export const profileVertexShader = `
uniform vec2 uMouse;
uniform float uHover;
uniform float uStrength;
attribute vec2 aUv;
varying vec2 vUv;

void main() {
  vUv = aUv;
  vec2 dir = aUv - uMouse;
  float dist = length(dir);
  float falloff = 1.0 - smoothstep(0.0, 0.3, dist);

  vec3 displaced = position;
  displaced.xy += normalize(dir) * falloff * uHover * uStrength;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  gl_PointSize = 3.0;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const profileFragmentShader = `
uniform sampler2D uTexture;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(uTexture, vUv);
  if (color.a < 0.1) discard;
  gl_FragColor = color;
}
`;
