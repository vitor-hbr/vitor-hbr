export const particlesVertexShader = `
uniform vec2 uMouse;
uniform float uParallax;
attribute float aLifetime;
attribute float aMaxLifetime;
varying float vOpacity;

void main() {
  vOpacity = aLifetime / aMaxLifetime;
  vec3 pos = position;
  pos.xy += (uMouse - 0.5) * uParallax;
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = 2.0;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const particlesFragmentShader = `
varying float vOpacity;

void main() {
  float dist = length(gl_PointCoord - 0.5);
  if (dist > 0.5) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, vOpacity * 0.6);
}
`;
