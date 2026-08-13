import * as THREE from 'three';

/**
 * Skybox — процедурний градієнтний скайбокс на шейдері:
 * - зеніт → горизонт;
 * - сонце з ореолом;
 * - серпанок біля горизонту.
 */

export const SKY_PRESETS = {
  cs_mansion: {
    zenith: 0x35648f,
    horizon: 0xb8c9d3,
    ground: 0x4c5147,
    sunColor: 0xfff0cc,
    sunDirection: [0.5, 0.62, 0.28]
  },
  cs_assault: {
    zenith: 0x47515a,
    horizon: 0x8d979d,
    ground: 0x393c39,
    sunColor: 0xd9d5c7,
    sunDirection: [0.18, 0.34, -0.55]
  }
};

const SKY_VERTEX = `
varying vec3 vDir;

void main() {
  vDir = normalize(position);

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const SKY_FRAGMENT = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform vec3 uSunDir;

varying vec3 vDir;

void main() {
  vec3 dir = normalize(vDir);

  float h = dir.y;

  vec3 sky = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.62));

  vec3 color = h < 0.0
    ? mix(uGround, sky, smoothstep(-0.08, 0.02, h))
    : sky;

  float sun = max(dot(dir, normalize(uSunDir)), 0.0);

  color += uSunColor * (pow(sun, 900.0) * 1.2 + pow(sun, 24.0) * 0.35);

  color += uHorizon * 0.18 * exp(-abs(h) * 9.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createSkybox(preset) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: {
        value: new THREE.Color(preset.zenith)
      },
      uHorizon: {
        value: new THREE.Color(preset.horizon)
      },
      uGround: {
        value: new THREE.Color(preset.ground)
      },
      uSunColor: {
        value: new THREE.Color(preset.sunColor)
      },
      uSunDir: {
        value: new THREE.Vector3(...preset.sunDirection).normalize()
      }
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(430, 32, 18),
    material
  );

  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  return mesh;
}
