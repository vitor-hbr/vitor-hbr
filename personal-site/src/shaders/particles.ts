export const particlesVertexShader = `
uniform vec2 uMouse;
uniform float uParallax;
uniform float uTime;
attribute float aPhase;
attribute float aSpeed;
varying float vOpacity;

void main() {
  // GPU-based lifetime calculation using sine wave for smooth looping
  float lifetime = sin(uTime * aSpeed + aPhase) * 0.5 + 0.5;
  vOpacity = lifetime;
  
  vec3 pos = position;
  pos.xy += (uMouse - 0.5) * uParallax;
  
  // Add subtle movement based on time
  pos.x += sin(uTime * aSpeed * 0.5 + aPhase) * 0.1;
  pos.y += cos(uTime * aSpeed * 0.3 + aPhase * 1.5) * 0.1;
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = 4.0;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const particlesFragmentShader = `
varying float vOpacity;

void main() {
  // Soft circular edges without discard
  float dist = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.0, dist);
  gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * vOpacity * 0.8);
}
`;
