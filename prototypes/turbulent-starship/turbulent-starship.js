import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const stage = document.querySelector("#starship-stage");
const fallback = document.querySelector("#webgl-fallback");
const lab = document.querySelector("#starship-lab");
const transmissionInput = document.querySelector("#transmission");
const transmissionValue = document.querySelector("#transmission-value");
const flowInput = document.querySelector("#flow-density");
const flowValue = document.querySelector("#flow-value");
const boostButton = document.querySelector("#boost-field");
const resetButton = document.querySelector("#reset-view");
const renderState = document.querySelector("#render-state");
const metricTransmission = document.querySelector("#metric-transmission");
const metricParticles = document.querySelector("#metric-particles");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const lowPower = coarsePointer || (navigator.hardwareConcurrency || 8) <= 4;
const boundaryParticleCount = lowPower ? 42000 : 96000;
const wakeParticleCount = lowPower ? 26000 : 72000;
const filamentSegmentCount = lowPower ? 10000 : 36000;

let renderer;
let scene;
let camera;
let controls;
let starship;
let hullMaterial;
let canopyMaterial;
let flowSkinMaterial;
let boundaryMaterial;
let wakeMaterial;
let filamentMaterial;
let innerFrame;
let enginePlumes = [];
let targetEnergy = 0;
let energy = 0;
let lastTime = performance.now();
let lastInteraction = performance.now();
let resettingView = false;

const defaultCameraPosition = new THREE.Vector3(1.3, 1.15, 9.6);
const defaultTarget = new THREE.Vector3(.36, -.05, 0);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function hullRadius(u) {
  const wave = Math.pow(Math.max(0, Math.sin(Math.PI * u)), .54);
  const noseTaper = 1 - .52 * Math.pow(u, 4.2);
  const tailShoulder = .25 * Math.pow(1 - u, 5.5);
  return (.17 + .72 * wave) * noseTaper + tailShoulder;
}

function createHullGeometry(longitudinalSegments = 150, radialSegments = 64) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let longitudinal = 0; longitudinal <= longitudinalSegments; longitudinal += 1) {
    const u = longitudinal / longitudinalSegments;
    const radius = hullRadius(u);
    const x = -2.28 + 4.86 * u;
    const cabinLift = Math.sin(Math.PI * smoothstep(.38, .82, u)) * .055;
    const tailCompression = 1 - .12 * Math.pow(1 - u, 3);

    for (let radial = 0; radial <= radialSegments; radial += 1) {
      const v = radial / radialSegments;
      const angle = v * Math.PI * 2;
      const panelTension = 1 + .018 * Math.cos(angle * 4 - u * 7);
      const y = Math.cos(angle) * radius * .62 * panelTension + cabinLift;
      const z = Math.sin(angle) * radius * .91 * panelTension * tailCompression;
      const chine = -.045 * Math.pow(Math.max(0, -Math.cos(angle)), 5) * Math.sin(Math.PI * u);
      positions.push(x, y + chine, z);
      uvs.push(u, v);
    }
  }

  const row = radialSegments + 1;
  for (let longitudinal = 0; longitudinal < longitudinalSegments; longitudinal += 1) {
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const a = longitudinal * row + radial;
      const b = (longitudinal + 1) * row + radial;
      const c = (longitudinal + 1) * row + radial + 1;
      const d = longitudinal * row + radial + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createHorizontalPrism(side = 1) {
  const outline = [
    [-1.68, .22 * side],
    [1.18, .18 * side],
    [-.15, 1.05 * side],
    [-1.48, 2.18 * side]
  ];
  const thickness = .045;
  const positions = [];
  const uvs = [];
  const indices = [];

  outline.forEach(([x, z]) => {
    positions.push(x, -thickness, z, x, thickness, z);
    uvs.push((x + 1.7) / 2.9, Math.abs(z) / 2.2, (x + 1.7) / 2.9, Math.abs(z) / 2.2);
  });

  indices.push(0, 2, 4, 0, 4, 6, 1, 5, 3, 1, 7, 5);
  for (let index = 0; index < outline.length; index += 1) {
    const next = (index + 1) % outline.length;
    const a = index * 2;
    const b = next * 2;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createVerticalFinGeometry(side = 1) {
  const z = .028;
  const outline = [
    [-1.7, -.08],
    [-.25, .05],
    [-1.3, 1.05 * side],
    [-1.78, .78 * side]
  ];
  const positions = [];
  const indices = [];
  outline.forEach(([x, y]) => positions.push(x, y, -z, x, y, z));
  indices.push(0, 2, 4, 0, 4, 6, 1, 5, 3, 1, 7, 5);
  for (let index = 0; index < outline.length; index += 1) {
    const next = (index + 1) % outline.length;
    const a = index * 2;
    const b = next * 2;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const flowSkinVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position * 1.009, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const flowSkinFragmentShader = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uDensity;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    vec2 curve = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), curve.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), curve.x),
      curve.y
    );
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);
    for (int octave = 0; octave < 5; octave++) {
      value += noise(point) * amplitude;
      point = rotation * point * 2.06 + vec2(1.8, -2.4);
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 palette(float value) {
    vec3 deepBlue = vec3(0.08, 0.18, 0.58);
    vec3 electricBlue = vec3(0.16, 0.52, 1.0);
    vec3 cyan = vec3(0.32, 0.96, 1.0);
    vec3 violet = vec3(0.74, 0.28, 1.0);
    vec3 gold = vec3(1.0, 0.63, 0.20);
    if (value < 0.24) return mix(deepBlue, electricBlue, value / 0.24);
    if (value < 0.48) return mix(electricBlue, cyan, (value - 0.24) / 0.24);
    if (value < 0.75) return mix(cyan, violet, (value - 0.48) / 0.27);
    return mix(violet, gold, (value - 0.75) / 0.25);
  }

  void main() {
    float advection = uTime * (0.34 + uEnergy * 1.25);
    vec2 warped = vec2(vUv.x * 9.0 - advection, vUv.y * 5.0);
    float largeEddy = fbm(warped + vec2(fbm(warped * 0.72), fbm(warped * 0.72 + 4.8)) * (1.0 + uEnergy * 1.4));
    float fineEddy = fbm(vec2(vUv.x * 27.0 - advection * 2.4, vUv.y * 14.0 + largeEddy * 2.2));
    float streamPhase = vUv.x * 118.0 - advection * 9.0 + vUv.y * 19.0 + largeEddy * (5.0 + uEnergy * 7.0);
    float stream = pow(max(0.0, 1.0 - abs(sin(streamPhase))), 17.0);
    float secondary = pow(max(0.0, 1.0 - abs(sin(vUv.x * 53.0 + vUv.y * 37.0 - advection * 3.0 + fineEddy * 3.2))), 22.0);
    float vorticity = clamp(largeEddy * 0.48 + fineEddy * 0.32 + stream * 0.24, 0.0, 1.0);
    float fresnel = pow(1.0 - clamp(abs(dot(normalize(vWorldNormal), normalize(vViewDirection))), 0.0, 1.0), 2.0);
    vec3 color = palette(vorticity);
    float alpha = (0.014 + fresnel * 0.34 + stream * 0.24 + secondary * 0.11 + smoothstep(0.69, 0.95, fineEddy) * 0.09) * uDensity;
    alpha = clamp(alpha, 0.0, 0.68);
    gl_FragColor = vec4(color * (0.42 + fresnel * 0.78 + stream * 0.72), alpha);
  }
`;

const boundaryVertexShader = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uPixelRatio;
  uniform float uDensity;
  attribute vec4 aFlow;
  varying vec3 vColor;
  varying float vAlpha;

  float shipRadius(float u) {
    float wave = pow(max(0.0, sin(3.14159265 * u)), 0.54);
    float noseTaper = 1.0 - 0.52 * pow(u, 4.2);
    float tailShoulder = 0.25 * pow(1.0 - u, 5.5);
    return (0.17 + 0.72 * wave) * noseTaper + tailShoulder;
  }

  vec3 palette(float value) {
    vec3 blue = vec3(0.12, 0.40, 1.0);
    vec3 cyan = vec3(0.30, 0.95, 1.0);
    vec3 violet = vec3(0.72, 0.26, 1.0);
    vec3 gold = vec3(1.0, 0.62, 0.18);
    if (value < 0.34) return mix(blue, cyan, value / 0.34);
    if (value < 0.72) return mix(cyan, violet, (value - 0.34) / 0.38);
    return mix(violet, gold, (value - 0.72) / 0.28);
  }

  void main() {
    float seed = aFlow.z;
    float kind = aFlow.w;
    float speed = (0.022 + uEnergy * 0.075) * (0.72 + seed * 0.48);
    float progress = fract(aFlow.x + uTime * speed);
    float x = mix(2.74, -2.52, progress);
    float profileU = clamp((x + 2.28) / 4.86, 0.0, 1.0);
    float angle = aFlow.y + sin(progress * 17.0 - uTime * (0.5 + uEnergy * 2.4) + seed * 13.0) * (0.045 + uEnergy * 0.16);
    float curlA = sin(x * 6.7 + angle * 2.0 - uTime * (0.7 + uEnergy * 2.8) + seed * 19.0);
    float curlB = cos(x * 11.2 - angle * 3.0 + uTime * 0.36 + seed * 29.0);
    float radius = shipRadius(profileU) + 0.025 + aFlow.z * (0.07 + uEnergy * 0.09);
    vec3 transformed;
    float visibility = 1.0;

    if (kind < 0.72) {
      transformed = vec3(
        x,
        cos(angle) * radius * 0.64 + curlA * 0.018 * (1.0 + uEnergy),
        sin(angle) * radius * 0.94 + curlB * 0.024 * (1.0 + uEnergy)
      );
    } else {
      float wingDomain = smoothstep(1.22, 0.72, x) * smoothstep(-1.82, -1.32, x);
      float wingProgress = clamp((1.18 - x) / 2.86, 0.0, 1.0);
      float span = mix(0.18, 2.22, pow(wingProgress, 0.86));
      float side = sin(aFlow.y) < 0.0 ? -1.0 : 1.0;
      transformed = vec3(
        x,
        -0.03 + curlA * (0.028 + uEnergy * 0.055),
        side * span * (0.22 + seed * 0.78) + curlB * (0.025 + uEnergy * 0.06)
      );
      visibility = wingDomain;
    }

    vec4 modelPosition = modelMatrix * vec4(transformed, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    float focus = 9.2 / max(2.0, -viewPosition.z);
    gl_PointSize = (0.62 + seed * 1.38) * uPixelRatio * focus * (0.86 + uEnergy * 0.46);
    float fieldValue = clamp(progress * 0.26 + abs(curlA) * 0.34 + abs(curlB) * 0.22 + uEnergy * 0.26, 0.0, 1.0);
    vColor = palette(fieldValue);
    float edgeFade = smoothstep(0.0, 0.045, progress) * smoothstep(1.0, 0.93, progress);
    vAlpha = edgeFade * visibility * (0.20 + uEnergy * 0.30) * (0.38 + seed * 0.62) * uDensity;
  }
`;

const wakeVertexShader = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uPixelRatio;
  uniform float uDensity;
  attribute vec4 aFlow;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 palette(float value) {
    vec3 blue = vec3(0.10, 0.34, 1.0);
    vec3 cyan = vec3(0.26, 0.92, 1.0);
    vec3 violet = vec3(0.72, 0.25, 1.0);
    vec3 orange = vec3(1.0, 0.50, 0.16);
    if (value < 0.32) return mix(blue, cyan, value / 0.32);
    if (value < 0.7) return mix(cyan, violet, (value - 0.32) / 0.38);
    return mix(violet, orange, (value - 0.7) / 0.3);
  }

  void main() {
    float seed = aFlow.z;
    float lane = floor(aFlow.w * 3.0);
    float speed = (0.038 + uEnergy * 0.15) * (0.72 + seed * 0.58);
    float progress = fract(aFlow.x + uTime * speed);
    float extent = 2.7 + uEnergy * 5.8;
    float x = -2.08 - progress * extent;
    float laneZ = (lane - 1.0) * 0.64;
    float laneY = lane == 1.0 ? -0.12 : -0.27;
    float phase = aFlow.y + progress * (18.0 + uEnergy * 35.0) - uTime * (1.1 + uEnergy * 4.8) + lane * 1.7;
    float radius = 0.018 + progress * progress * (0.11 + uEnergy * 0.82) * (0.5 + seed * 0.75);
    float karman = sin(progress * 32.0 - uTime * (0.8 + uEnergy * 3.6) + seed * 12.0 + lane * 2.1);
    float braid = cos(progress * 21.0 + uTime * 0.5 + seed * 24.0);
    float y = laneY + cos(phase) * radius + karman * progress * (0.025 + uEnergy * 0.13);
    float z = laneZ + sin(phase) * radius + braid * progress * (0.018 + uEnergy * 0.095);
    vec4 modelPosition = modelMatrix * vec4(x, y, z, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    float focus = 8.8 / max(2.0, -viewPosition.z);
    gl_PointSize = (0.65 + seed * 1.55) * uPixelRatio * focus * (0.78 + uEnergy * 0.62);
    float vorticity = clamp(progress * 0.38 + abs(karman) * 0.31 + abs(braid) * 0.15 + uEnergy * 0.26, 0.0, 1.0);
    vColor = palette(vorticity);
    float fade = smoothstep(0.0, 0.05, progress) * smoothstep(1.0, 0.56, progress);
    vAlpha = fade * (0.12 + uEnergy * 0.58) * (0.4 + seed * 0.6) * uDensity;
  }
`;

const particleFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    float body = smoothstep(0.5, 0.07, distanceToCenter);
    float core = smoothstep(0.22, 0.0, distanceToCenter);
    gl_FragColor = vec4(vColor * (0.68 + core * 0.86), vAlpha * body);
  }
`;

const filamentVertexShader = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uDensity;
  attribute vec4 aFlow;
  attribute float aEndpoint;
  varying vec3 vColor;
  varying float vAlpha;

  float shipRadius(float u) {
    float wave = pow(max(0.0, sin(3.14159265 * u)), 0.54);
    float noseTaper = 1.0 - 0.52 * pow(u, 4.2);
    float tailShoulder = 0.25 * pow(1.0 - u, 5.5);
    return (0.17 + 0.72 * wave) * noseTaper + tailShoulder;
  }

  vec3 palette(float value) {
    vec3 blue = vec3(0.11, 0.37, 1.0);
    vec3 cyan = vec3(0.28, 0.94, 1.0);
    vec3 violet = vec3(0.75, 0.27, 1.0);
    vec3 orange = vec3(1.0, 0.52, 0.16);
    if (value < 0.33) return mix(blue, cyan, value / 0.33);
    if (value < 0.72) return mix(cyan, violet, (value - 0.33) / 0.39);
    return mix(violet, orange, (value - 0.72) / 0.28);
  }

  void main() {
    float seed = aFlow.z;
    float zone = aFlow.w;
    float speed = (0.018 + uEnergy * 0.082) * (0.72 + seed * 0.56);
    float baseProgress = fract(aFlow.x + uTime * speed);
    float trailLength = (0.0035 + uEnergy * 0.012) * (0.62 + seed * 0.58);
    float progress = max(0.0, baseProgress - aEndpoint * trailLength);
    float angle = aFlow.y;
    float x;
    float y;
    float z;
    float vorticity;

    if (zone < 0.66) {
      x = mix(2.72, -2.48, progress);
      float profileU = clamp((x + 2.28) / 4.86, 0.0, 1.0);
      float radius = shipRadius(profileU) + 0.035 + seed * (0.06 + uEnergy * 0.08);
      float curlA = sin(x * 7.8 + angle * 2.0 - uTime * (0.64 + uEnergy * 2.8) + seed * 21.0);
      float curlB = cos(x * 13.1 - angle * 3.0 + uTime * 0.42 + seed * 34.0);
      if (zone < 0.48) {
        y = cos(angle) * radius * 0.65 + curlA * (0.016 + uEnergy * 0.036);
        z = sin(angle) * radius * 0.95 + curlB * (0.021 + uEnergy * 0.046);
      } else {
        float wingDomain = clamp((1.16 - x) / 2.82, 0.0, 1.0);
        float side = sin(angle) < 0.0 ? -1.0 : 1.0;
        y = -0.03 + curlA * (0.025 + uEnergy * 0.058);
        z = side * mix(0.18, 2.2, pow(wingDomain, 0.86)) * (0.26 + seed * 0.74) + curlB * 0.035;
      }
      vorticity = clamp(abs(curlA) * 0.46 + abs(curlB) * 0.28 + uEnergy * 0.26, 0.0, 1.0);
    } else {
      float extent = 2.8 + uEnergy * 5.9;
      x = -2.08 - progress * extent;
      float lane = floor(seed * 3.0);
      float laneZ = (lane - 1.0) * 0.64;
      float laneY = lane == 1.0 ? -0.12 : -0.27;
      float phase = angle + progress * (19.0 + uEnergy * 38.0) - uTime * (1.0 + uEnergy * 4.6) + lane * 1.6;
      float radius = 0.025 + progress * progress * (0.12 + uEnergy * 0.88) * (0.5 + fract(seed * 19.0) * 0.72);
      float karman = sin(progress * 33.0 - uTime * (0.75 + uEnergy * 3.8) + seed * 17.0);
      y = laneY + cos(phase) * radius + karman * progress * uEnergy * 0.14;
      z = laneZ + sin(phase) * radius + cos(progress * 23.0 + seed * 31.0) * progress * uEnergy * 0.1;
      vorticity = clamp(progress * 0.32 + abs(karman) * 0.38 + uEnergy * 0.3, 0.0, 1.0);
    }

    vec4 modelPosition = modelMatrix * vec4(x, y, z, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;
    vColor = palette(vorticity);
    float birthFade = smoothstep(0.0, 0.045, baseProgress);
    float deathFade = smoothstep(1.0, 0.64, baseProgress);
    vAlpha = birthFade * deathFade * (0.10 + uEnergy * 0.4) * (0.45 + seed * 0.55) * uDensity;
  }
`;

const filamentFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vColor * 1.24, vAlpha);
  }
`;

function createFlowGeometry(count) {
  const positions = new Float32Array(count * 3);
  const flow = new Float32Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    flow[index * 4] = Math.random();
    flow[index * 4 + 1] = Math.random() * Math.PI * 2;
    flow[index * 4 + 2] = Math.random();
    flow[index * 4 + 3] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aFlow", new THREE.BufferAttribute(flow, 4));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(-1.5, 0, 0), 11);
  return geometry;
}

function createBoundaryField() {
  boundaryMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uDensity: { value: Number(flowInput.value) / 100 }
    },
    vertexShader: boundaryVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(createFlowGeometry(boundaryParticleCount), boundaryMaterial);
  points.frustumCulled = false;
  points.renderOrder = 6;
  return points;
}

function createWakeField() {
  wakeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uDensity: { value: Number(flowInput.value) / 100 }
    },
    vertexShader: wakeVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(createFlowGeometry(wakeParticleCount), wakeMaterial);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return points;
}

function createFlowFilaments() {
  const vertexCount = filamentSegmentCount * 2;
  const positions = new Float32Array(vertexCount * 3);
  const flow = new Float32Array(vertexCount * 4);
  const endpoints = new Float32Array(vertexCount);

  for (let segment = 0; segment < filamentSegmentCount; segment += 1) {
    const phase = Math.random();
    const angle = Math.random() * Math.PI * 2;
    const seed = Math.random();
    const zone = Math.random();
    for (let endpoint = 0; endpoint < 2; endpoint += 1) {
      const index = segment * 2 + endpoint;
      flow[index * 4] = phase;
      flow[index * 4 + 1] = angle;
      flow[index * 4 + 2] = seed;
      flow[index * 4 + 3] = zone;
      endpoints[index] = endpoint;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aFlow", new THREE.BufferAttribute(flow, 4));
  geometry.setAttribute("aEndpoint", new THREE.BufferAttribute(endpoints, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(-1.6, 0, 0), 11.5);

  filamentMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uDensity: { value: Number(flowInput.value) / 100 }
    },
    vertexShader: filamentVertexShader,
    fragmentShader: filamentFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const filaments = new THREE.LineSegments(geometry, filamentMaterial);
  filaments.frustumCulled = false;
  filaments.renderOrder = 7;
  return filaments;
}

function addEdgeOverlay(mesh, opacity = .16, color = 0x9fc8ff) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 27),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  edges.renderOrder = 5;
  mesh.parent.add(edges);
  edges.position.copy(mesh.position);
  edges.rotation.copy(mesh.rotation);
  edges.scale.copy(mesh.scale);
  return edges;
}

function createHullFrame() {
  const group = new THREE.Group();
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x8cb9ff,
    transparent: true,
    opacity: .26,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  [0.16, .31, .48, .65, .8].forEach((u) => {
    const points = [];
    const radius = hullRadius(u) * .82;
    const x = -2.28 + 4.86 * u;
    for (let index = 0; index <= 72; index += 1) {
      const angle = index / 72 * Math.PI * 2;
      points.push(new THREE.Vector3(x, Math.cos(angle) * radius * .59, Math.sin(angle) * radius * .87));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial));
  });

  [0, Math.PI * .5, Math.PI, Math.PI * 1.5].forEach((angle) => {
    const points = [];
    for (let index = 0; index <= 110; index += 1) {
      const u = .055 + index / 110 * .9;
      const radius = hullRadius(u) * .82;
      points.push(new THREE.Vector3(
        -2.28 + 4.86 * u,
        Math.cos(angle) * radius * .59,
        Math.sin(angle) * radius * .87
      ));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial));
  });

  const reactorMaterial = new THREE.MeshBasicMaterial({
    color: 0xc0e9ff,
    transparent: true,
    opacity: .82,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const reactor = new THREE.Mesh(new THREE.IcosahedronGeometry(.15, 3), reactorMaterial);
  reactor.scale.set(1.5, .9, 1);
  reactor.position.set(-.38, -.02, 0);
  reactor.userData.reactor = true;
  group.add(reactor);

  const conduitMaterial = new THREE.MeshBasicMaterial({
    color: 0x9c67ff,
    transparent: true,
    opacity: .52,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  [-.23, .23].forEach((z, index) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.82, -.16, z * 1.8),
      new THREE.Vector3(-1.0, -.08 + index * .05, z),
      new THREE.Vector3(-.38, -.02, 0),
      new THREE.Vector3(.62, .14, z * .42),
      new THREE.Vector3(1.45, .12, z * .16)
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 150, .012, 6, false), conduitMaterial));
  });

  return group;
}

function createEngineAssembly(z, central = false) {
  const group = new THREE.Group();
  group.position.set(-1.78, central ? -.1 : -.27, z);

  const casingMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x17233a,
    metalness: .78,
    roughness: .22,
    clearcoat: .7,
    clearcoatRoughness: .16,
    envMapIntensity: 1.5
  });
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(central ? .24 : .2, central ? .3 : .25, .85, 40, 2, false), casingMaterial);
  casing.rotation.z = Math.PI / 2;
  group.add(casing);

  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x87dfff, transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(central ? .22 : .18, .026, 8, 48), ringMaterial);
  ring.rotation.y = Math.PI / 2;
  ring.position.x = -.43;
  group.add(ring);

  const throat = new THREE.Mesh(new THREE.CircleGeometry(central ? .18 : .145, 40), new THREE.MeshBasicMaterial({ color: 0xd9fbff, transparent: true, opacity: .88, blending: THREE.AdditiveBlending, depthWrite: false }));
  throat.rotation.y = -Math.PI / 2;
  throat.position.x = -.435;
  group.add(throat);

  const plumeMaterial = new THREE.MeshBasicMaterial({
    color: central ? 0x79e9ff : 0x9b72ff,
    transparent: true,
    opacity: .23,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const plume = new THREE.Mesh(new THREE.CylinderGeometry(.018, central ? .19 : .15, 1.35, 32, 1, true), plumeMaterial);
  plume.rotation.z = Math.PI / 2;
  plume.position.x = -1.05;
  plume.userData.baseScale = .88 + Math.random() * .18;
  group.add(plume);
  enginePlumes.push(plume);

  return group;
}

function createStarship() {
  const group = new THREE.Group();
  const hullGeometry = createHullGeometry(lowPower ? 105 : 150, lowPower ? 46 : 64);

  hullMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x526b91),
    metalness: .22,
    roughness: .14,
    transmission: Number(transmissionInput.value) / 100,
    thickness: .48,
    ior: 1.36,
    attenuationColor: new THREE.Color(0x315b91),
    attenuationDistance: 3.4,
    clearcoat: 1,
    clearcoatRoughness: .08,
    envMapIntensity: 1.9,
    side: THREE.DoubleSide
  });
  const hull = new THREE.Mesh(hullGeometry, hullMaterial);
  hull.renderOrder = 2;
  group.add(hull);

  flowSkinMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uDensity: { value: Number(flowInput.value) / 100 }
    },
    vertexShader: flowSkinVertexShader,
    fragmentShader: flowSkinFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const flowSkin = new THREE.Mesh(hullGeometry, flowSkinMaterial);
  flowSkin.renderOrder = 4;
  group.add(flowSkin);

  const wingMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x294264,
    metalness: .42,
    roughness: .18,
    transmission: .42,
    thickness: .18,
    ior: 1.29,
    clearcoat: .9,
    clearcoatRoughness: .1,
    envMapIntensity: 1.7,
    transparent: true,
    opacity: .92,
    side: THREE.DoubleSide
  });
  [1, -1].forEach((side) => {
    const wing = new THREE.Mesh(createHorizontalPrism(side), wingMaterial);
    wing.position.y = -.13;
    wing.renderOrder = 2;
    group.add(wing);
    addEdgeOverlay(wing, .22, side > 0 ? 0x82b8ff : 0xb282ff);
  });

  const finMaterial = wingMaterial.clone();
  finMaterial.color.set(0x213653);
  [1, -1].forEach((side) => {
    const fin = new THREE.Mesh(createVerticalFinGeometry(side), finMaterial);
    fin.position.z = side * .17;
    fin.renderOrder = 2;
    group.add(fin);
    addEdgeOverlay(fin, .17, 0x8ebeff);
  });

  canopyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x446da0,
    metalness: .08,
    roughness: .08,
    transmission: .72,
    thickness: .34,
    ior: 1.42,
    attenuationColor: new THREE.Color(0x24569d),
    attenuationDistance: 1.8,
    clearcoat: 1,
    clearcoatRoughness: .03,
    envMapIntensity: 2.2,
    side: THREE.DoubleSide
  });
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 28, 0, Math.PI * 2, 0, Math.PI * .52), canopyMaterial);
  canopy.scale.set(1.05, .34, .52);
  canopy.position.set(.72, .31, 0);
  canopy.rotation.z = -.04;
  canopy.renderOrder = 3;
  group.add(canopy);
  addEdgeOverlay(canopy, .22, 0x93d9ff);

  innerFrame = createHullFrame();
  group.add(innerFrame);
  group.add(createEngineAssembly(-.63));
  group.add(createEngineAssembly(0, true));
  group.add(createEngineAssembly(.63));
  group.add(createBoundaryField());
  group.add(createWakeField());
  group.add(createFlowFilaments());

  group.rotation.set(-.045, -.2, -.025);
  group.position.set(.55, -.03, 0);
  return group;
}

function addLighting() {
  scene.add(new THREE.HemisphereLight(0xa8c6ff, 0x07040f, 1.25));
  const key = new THREE.DirectionalLight(0xe2efff, 4.8);
  key.position.set(-2.6, 4.8, 6.7);
  scene.add(key);
  const noseLight = new THREE.PointLight(0x72cfff, 28, 17, 2);
  noseLight.position.set(4, 1.4, 2.8);
  scene.add(noseLight);
  const violetRim = new THREE.PointLight(0x884dff, 32, 17, 2);
  violetRim.position.set(-2.7, 1.8, -3.4);
  scene.add(violetRim);
  const warmRim = new THREE.PointLight(0xff9a4a, 15, 11, 2);
  warmRim.position.set(-2.6, -2.4, 2.6);
  scene.add(warmRim);
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas: stage,
    antialias: !lowPower,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.1 : 1.55));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
}

function setupEnvironment() {
  const environment = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const environmentTexture = generator.fromScene(environment, .035).texture;
  scene.environment = environmentTexture;
  environment.dispose();
  generator.dispose();
}

function setupControls() {
  controls = new OrbitControls(camera, stage);
  controls.target.copy(defaultTarget);
  controls.enableDamping = true;
  controls.dampingFactor = .055;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.zoomSpeed = .62;
  controls.rotateSpeed = .58;
  controls.minDistance = 5.8;
  controls.maxDistance = 13.5;
  controls.minPolarAngle = .05;
  controls.maxPolarAngle = Math.PI - .05;
  controls.autoRotate = false;
  controls.autoRotateSpeed = .3;
  controls.addEventListener("start", () => {
    lastInteraction = performance.now();
    controls.autoRotate = false;
    resettingView = false;
  });
  controls.addEventListener("end", () => { lastInteraction = performance.now(); });
  controls.update();
}

function resetView() {
  resettingView = true;
  lastInteraction = performance.now();
}

function updateViewReset(delta) {
  if (!resettingView) return;
  const response = 1 - Math.pow(.0015, delta);
  camera.position.lerp(defaultCameraPosition, response);
  controls.target.lerp(defaultTarget, response);
  if (camera.position.distanceTo(defaultCameraPosition) < .015 && controls.target.distanceTo(defaultTarget) < .006) {
    camera.position.copy(defaultCameraPosition);
    controls.target.copy(defaultTarget);
    resettingView = false;
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.1 : 1.55));
  renderer.setSize(width, height, false);
  boundaryMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  wakeMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
}

function animate(now) {
  const deltaSeconds = clamp((now - lastTime) / 1000, 0, .05);
  lastTime = now;
  energy += (targetEnergy - energy) * (1 - Math.pow(.0018, deltaSeconds));

  const animatedTime = reducedMotion ? 0 : now / 1000;
  flowSkinMaterial.uniforms.uTime.value = animatedTime;
  flowSkinMaterial.uniforms.uEnergy.value = energy;
  boundaryMaterial.uniforms.uTime.value = animatedTime;
  boundaryMaterial.uniforms.uEnergy.value = energy;
  wakeMaterial.uniforms.uTime.value = animatedTime;
  wakeMaterial.uniforms.uEnergy.value = energy;
  filamentMaterial.uniforms.uTime.value = animatedTime;
  filamentMaterial.uniforms.uEnergy.value = energy;

  if (!reducedMotion) {
    innerFrame.rotation.x = Math.sin(animatedTime * .24) * .025;
    const reactor = innerFrame.children.find((child) => child.userData.reactor);
    if (reactor) {
      reactor.rotation.x = animatedTime * (.36 + energy * .7);
      reactor.rotation.y = animatedTime * (.22 + energy * .5);
      reactor.scale.setScalar(1 + Math.sin(animatedTime * (2.1 + energy * 2.4)) * (.04 + energy * .08));
    }
    enginePlumes.forEach((plume, index) => {
      const pulse = 1 + Math.sin(animatedTime * (4.2 + energy * 7.5) + index * 1.8) * (.07 + energy * .12);
      plume.scale.set(pulse * (1 + energy * .48), plume.userData.baseScale, plume.userData.baseScale);
      plume.material.opacity = .18 + energy * .24 + Math.sin(animatedTime * 5.1 + index) * .025;
    });
    starship.position.y = -.03 + Math.sin(animatedTime * .42) * .015;
  }

  if (!reducedMotion && !resettingView && performance.now() - lastInteraction > 6500) controls.autoRotate = true;
  updateViewReset(deltaSeconds);
  controls.update(deltaSeconds);
  renderer.render(scene, camera);
}

function bindInterface() {
  transmissionInput.addEventListener("input", () => {
    const value = Number(transmissionInput.value);
    hullMaterial.transmission = value / 100;
    canopyMaterial.transmission = clamp(value / 100 - .04, .55, .86);
    transmissionValue.textContent = `${value}%`;
    metricTransmission.textContent = `${value}%`;
  });

  flowInput.addEventListener("input", () => {
    const value = Number(flowInput.value);
    const normalized = value / 100;
    flowSkinMaterial.uniforms.uDensity.value = normalized;
    boundaryMaterial.uniforms.uDensity.value = normalized;
    wakeMaterial.uniforms.uDensity.value = normalized;
    filamentMaterial.uniforms.uDensity.value = normalized;
    flowValue.textContent = `${value}%`;
  });

  boostButton.addEventListener("click", () => {
    const active = !boostButton.classList.contains("is-active");
    boostButton.classList.toggle("is-active", active);
    boostButton.querySelector("b").textContent = active ? "返回稳定巡航" : "进入高涡量";
    renderState.textContent = active ? "高涡量推进" : "稳定巡航";
    targetEnergy = active ? 1 : 0;
  });

  resetButton.addEventListener("click", resetView);

  document.querySelectorAll("[data-backdrop]").forEach((button) => {
    button.addEventListener("click", () => {
      document.body.dataset.backdrop = button.dataset.backdrop;
      document.querySelectorAll("[data-backdrop]").forEach((item) => item.classList.toggle("is-active", item === button));
    });
  });

  stage.addEventListener("dblclick", resetView);
  window.addEventListener("resize", resize);
}

function initialize() {
  try {
    metricParticles.textContent = lowPower ? "88K" : "240K";
    setupRenderer();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, .08, 90);
    camera.position.copy(defaultCameraPosition);
    setupEnvironment();
    addLighting();
    starship = createStarship();
    scene.add(starship);
    setupControls();
    bindInterface();
    renderer.setAnimationLoop(animate);
    lab.classList.add("is-ready");
  } catch (error) {
    console.error("Starship lab failed to initialize", error);
    fallback.hidden = false;
    stage.hidden = true;
  }
}

initialize();
