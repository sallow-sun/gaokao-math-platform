import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const stage = document.querySelector("#probe-stage");
const fallback = document.querySelector("#webgl-fallback");
const lab = document.querySelector("#probe-lab");
const transmissionInput = document.querySelector("#transmission");
const transmissionValue = document.querySelector("#transmission-value");
const flowInput = document.querySelector("#flow-intensity");
const flowValue = document.querySelector("#flow-value");
const boostButton = document.querySelector("#boost-field");
const resetButton = document.querySelector("#reset-view");
const renderState = document.querySelector("#render-state");
const metricTransmission = document.querySelector(".probe-metrics span:first-child b");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const lowPower = coarsePointer || (navigator.hardwareConcurrency || 8) <= 4;

let renderer;
let scene;
let camera;
let controls;
let vessel;
let shellMaterial;
let flowMaterial;
let surfaceParticleMaterial;
let wakeMaterial;
let coreGroup;
let targetEnergy = 0;
let energy = 0;
let lastTime = performance.now();
let lastInteraction = performance.now();
let resettingView = false;

const defaultCameraPosition = new THREE.Vector3(1.45, 1.05, 8.6);
const defaultTarget = new THREE.Vector3(.18, -.05, 0);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function createDropletGeometry(longitudinalSegments = 220, radialSegments = 96) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let longitudinal = 0; longitudinal <= longitudinalSegments; longitudinal += 1) {
    const u = longitudinal / longitudinalSegments;
    const envelope = Math.pow(Math.max(0, Math.sin(Math.PI * u)), .62);
    const taper = 1 - .39 * Math.pow(u, 1.7);
    const radius = .98 * envelope * taper;
    const axis = -2.5 + 5.22 * u + .08 * Math.pow(Math.sin(Math.PI * u), 2);
    const twist = (u - .5) * .1;

    for (let radial = 0; radial <= radialSegments; radial += 1) {
      const v = radial / radialSegments;
      const angle = v * Math.PI * 2;
      const crossSection = 1 + .035 * Math.sin(angle * 3 + u * 2.4);
      const verticalRadius = radius * (.79 + .055 * u) * crossSection;
      const lateralRadius = radius * (.94 - .035 * u) * crossSection;
      let y = Math.cos(angle) * verticalRadius;
      let z = Math.sin(angle) * lateralRadius;
      const rotatedY = y * Math.cos(twist) - z * Math.sin(twist);
      const rotatedZ = y * Math.sin(twist) + z * Math.cos(twist);
      const underside = -.045 * Math.pow(envelope, 2) * Math.pow(Math.max(0, -Math.cos(angle)), 2);
      const tailDeflection = .09 * Math.pow(u, 3);

      positions.push(axis, rotatedY + underside, rotatedZ + tailDeflection);
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

const flowVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position * 1.006, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const flowFragmentShader = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uIntensity;
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
    mat2 rotation = mat2(0.81, -0.59, 0.59, 0.81);
    for (int octave = 0; octave < 4; octave++) {
      value += noise(point) * amplitude;
      point = rotation * point * 2.03 + vec2(1.7, -2.2);
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 scientificPalette(float value) {
    vec3 indigo = vec3(0.11, 0.19, 0.58);
    vec3 blue = vec3(0.18, 0.48, 1.0);
    vec3 cyan = vec3(0.34, 0.91, 1.0);
    vec3 violet = vec3(0.69, 0.30, 1.0);
    vec3 gold = vec3(1.0, 0.63, 0.24);
    vec3 ember = vec3(1.0, 0.24, 0.16);
    if (value < 0.22) return mix(indigo, blue, value / 0.22);
    if (value < 0.45) return mix(blue, cyan, (value - 0.22) / 0.23);
    if (value < 0.68) return mix(cyan, violet, (value - 0.45) / 0.23);
    if (value < 0.9) return mix(violet, gold, (value - 0.68) / 0.22);
    return mix(gold, ember, (value - 0.9) / 0.1);
  }

  void main() {
    float tailTransition = smoothstep(0.16, 0.94, vUv.x);
    float advection = uTime * (0.72 + uEnergy * 2.8);
    float turbulence = fbm(vec2(vUv.x * 8.0 - advection * 0.17, vUv.y * 5.2 + advection * 0.08));
    float secondary = fbm(vec2(vUv.x * 17.0 - advection * 0.34, vUv.y * 11.0 - advection * 0.09));
    float distortion = (turbulence - 0.5) * tailTransition * (2.0 + uEnergy * 4.2);
    float ribbonPhase = vUv.x * 78.0 + vUv.y * 17.0 - advection * 5.0 + distortion;
    float ribbon = pow(max(0.0, 1.0 - abs(sin(ribbonPhase))), 10.0);
    float crossRibbon = pow(max(0.0, 1.0 - abs(sin(vUv.x * 31.0 - vUv.y * 29.0 - advection * 1.8 + secondary * 2.0))), 18.0);
    float vorticity = clamp(turbulence * 0.52 + secondary * 0.3 + tailTransition * 0.22 + ribbon * 0.12, 0.0, 1.0);
    vec3 color = scientificPalette(vorticity);
    float fresnel = pow(1.0 - clamp(abs(dot(normalize(vWorldNormal), normalize(vViewDirection))), 0.0, 1.0), 2.15);
    float orderedField = ribbon * (0.14 + vUv.x * 0.24) + crossRibbon * tailTransition * 0.08;
    float surfaceMist = smoothstep(0.55, 0.9, turbulence) * tailTransition * (0.025 + uEnergy * 0.08);
    float alpha = (0.035 + fresnel * 0.54 + orderedField + surfaceMist) * uIntensity;
    alpha = clamp(alpha, 0.0, 0.78);
    gl_FragColor = vec4(color * (0.46 + fresnel * 0.72 + ribbon * 0.52), alpha);
  }
`;

const surfaceParticleVertexShader = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uPixelRatio;
  uniform float uIntensity;
  attribute vec3 aParameters;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 palette(float value) {
    vec3 blue = vec3(0.20, 0.48, 1.0);
    vec3 cyan = vec3(0.34, 0.94, 1.0);
    vec3 violet = vec3(0.73, 0.30, 1.0);
    vec3 gold = vec3(1.0, 0.64, 0.24);
    if (value < 0.34) return mix(blue, cyan, value / 0.34);
    if (value < 0.7) return mix(cyan, violet, (value - 0.34) / 0.36);
    return mix(violet, gold, (value - 0.7) / 0.3);
  }

  vec3 droplet(float u, float angle) {
    float envelope = pow(max(0.0, sin(3.14159265 * u)), 0.62);
    float taper = 1.0 - 0.39 * pow(u, 1.7);
    float radius = 0.98 * envelope * taper;
    float axis = -2.5 + 5.22 * u + 0.08 * pow(sin(3.14159265 * u), 2.0);
    float twist = (u - 0.5) * 0.1;
    float crossSection = 1.0 + 0.035 * sin(angle * 3.0 + u * 2.4);
    float verticalRadius = radius * (0.79 + 0.055 * u) * crossSection;
    float lateralRadius = radius * (0.94 - 0.035 * u) * crossSection;
    float y = cos(angle) * verticalRadius;
    float z = sin(angle) * lateralRadius;
    float rotatedY = y * cos(twist) - z * sin(twist);
    float rotatedZ = y * sin(twist) + z * cos(twist);
    float underside = -0.045 * pow(envelope, 2.0) * pow(max(0.0, -cos(angle)), 2.0);
    return vec3(axis, rotatedY + underside, rotatedZ + 0.09 * pow(u, 3.0));
  }

  void main() {
    float seed = aParameters.z;
    float speed = (0.0055 + uEnergy * 0.018) * (0.72 + seed * 0.56);
    float u = fract(aParameters.x + uTime * speed);
    float tailTransition = smoothstep(0.24, 0.97, u);
    float angle = aParameters.y + sin(u * 19.0 + uTime * (0.4 + uEnergy * 2.1) + seed * 12.0) * tailTransition * (0.025 + uEnergy * 0.095);
    vec3 transformed = droplet(u, angle);
    float surfaceLift = 1.012 + sin(u * 47.0 - uTime * 2.2 + seed * 16.0) * 0.0025 * tailTransition;
    transformed.yz *= surfaceLift;
    vec4 modelPosition = modelMatrix * vec4(transformed, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = (0.72 + seed * 1.35) * uPixelRatio * (8.6 / max(2.0, -viewPosition.z)) * (0.84 + uEnergy * 0.58);
    float fieldValue = clamp(u * 0.58 + abs(sin(angle * 2.0 + uTime * 0.17)) * 0.22 + seed * 0.2, 0.0, 1.0);
    vColor = palette(fieldValue);
    vAlpha = (0.18 + tailTransition * 0.22 + uEnergy * 0.24) * uIntensity * smoothstep(0.0, 0.055, u) * smoothstep(1.0, 0.93, u);
  }
`;

const particleFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    float body = smoothstep(0.5, 0.08, distanceToCenter);
    float core = smoothstep(0.24, 0.0, distanceToCenter);
    gl_FragColor = vec4(vColor * (0.72 + core * 0.7), vAlpha * body);
  }
`;

const wakeVertexShader = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uPixelRatio;
  attribute vec3 aParameters;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float seed = aParameters.z;
    float progress = fract(aParameters.x + uTime * (0.026 + uEnergy * 0.11) * (0.62 + seed * 0.72));
    float extent = 0.58 + uEnergy * 4.2;
    float x = 2.68 + progress * extent;
    float radius = 0.025 + progress * (0.08 + uEnergy * 0.62);
    float phase = aParameters.y + progress * (9.0 + uEnergy * 20.0) - uTime * (0.8 + uEnergy * 3.6);
    float alternatingVortex = sin(progress * 21.0 - uTime * (0.65 + uEnergy * 2.4) + seed * 8.0);
    float y = cos(phase) * radius * (0.45 + seed * 0.78) + alternatingVortex * progress * uEnergy * 0.13;
    float z = sin(phase) * radius * (0.52 + seed * 0.82) + sin(progress * 13.0 + seed * 17.0) * progress * uEnergy * 0.08;
    vec4 modelPosition = modelMatrix * vec4(x, y, z + 0.09, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = (0.65 + seed * 1.45) * uPixelRatio * (8.0 / max(2.0, -viewPosition.z)) * (0.72 + uEnergy * 0.82);
    vec3 blue = vec3(0.19, 0.5, 1.0);
    vec3 violet = vec3(0.74, 0.28, 1.0);
    vec3 gold = vec3(1.0, 0.62, 0.22);
    vColor = progress < 0.58 ? mix(blue, violet, progress / 0.58) : mix(violet, gold, (progress - 0.58) / 0.42);
    float fade = smoothstep(0.0, 0.08, progress) * smoothstep(1.0, 0.62, progress);
    vAlpha = fade * (0.035 + uEnergy * 0.62) * (0.45 + seed * 0.55);
  }
`;

function createSurfaceParticles(count) {
  const parameters = new Float32Array(count * 3);
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    parameters[index * 3] = Math.random();
    parameters[index * 3 + 1] = Math.random() * Math.PI * 2;
    parameters[index * 3 + 2] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aParameters", new THREE.BufferAttribute(parameters, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
  surfaceParticleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uIntensity: { value: Number(flowInput.value) / 100 }
    },
    vertexShader: surfaceParticleVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, surfaceParticleMaterial);
  points.frustumCulled = false;
  points.renderOrder = 4;
  return points;
}

function createWakeParticles(count) {
  const parameters = new Float32Array(count * 3);
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    parameters[index * 3] = Math.random();
    parameters[index * 3 + 1] = Math.random() * Math.PI * 2;
    parameters[index * 3 + 2] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aParameters", new THREE.BufferAttribute(parameters, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(3.8, 0, 0), 6);
  wakeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: wakeVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const wake = new THREE.Points(geometry, wakeMaterial);
  wake.frustumCulled = false;
  wake.renderOrder = 3;
  return wake;
}

function createCoreCurve(phase, color) {
  const points = [];
  const samples = 180;
  for (let index = 0; index < samples; index += 1) {
    const angle = index / samples * Math.PI * 2;
    const radial = .31 + Math.cos(angle * 3 + phase) * .08;
    points.push(new THREE.Vector3(
      Math.sin(angle) * 1.18,
      Math.cos(angle * 2 + phase) * radial,
      Math.sin(angle * 3 + phase) * radial
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points, true, "centripetal", .45);
  const geometry = new THREE.TubeGeometry(curve, 320, .014, 7, true);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: .62,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  return new THREE.Mesh(geometry, material);
}

function createInternalCore() {
  const group = new THREE.Group();
  group.add(createCoreCurve(0, 0x78b7ff));
  group.add(createCoreCurve(Math.PI * .67, 0xc477ff));
  group.add(createCoreCurve(Math.PI * 1.34, 0xf0b56d));

  const singularityMaterial = new THREE.MeshBasicMaterial({
    color: 0xeef6ff,
    transparent: true,
    opacity: .78,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const singularity = new THREE.Mesh(new THREE.IcosahedronGeometry(.115, 4), singularityMaterial);
  singularity.scale.set(1.35, .86, 1);
  group.add(singularity);

  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x91b9ff,
    wireframe: true,
    transparent: true,
    opacity: .13,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(.52, 3), haloMaterial);
  halo.scale.set(1.75, .72, 1);
  group.add(halo);
  group.renderOrder = 1;
  return group;
}

function createVessel() {
  const group = new THREE.Group();
  const dropletGeometry = createDropletGeometry(lowPower ? 150 : 220, lowPower ? 64 : 96);

  shellMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x4e6383),
    metalness: .04,
    roughness: .12,
    transmission: Number(transmissionInput.value) / 100,
    thickness: .72,
    ior: 1.28,
    attenuationColor: new THREE.Color(0x34538a),
    attenuationDistance: 3.8,
    clearcoat: 1,
    clearcoatRoughness: .08,
    envMapIntensity: 1.65,
    side: THREE.DoubleSide
  });
  const shell = new THREE.Mesh(dropletGeometry, shellMaterial);
  shell.renderOrder = 2;
  group.add(shell);

  flowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uIntensity: { value: Number(flowInput.value) / 100 }
    },
    vertexShader: flowVertexShader,
    fragmentShader: flowFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const flowSkin = new THREE.Mesh(dropletGeometry, flowMaterial);
  flowSkin.renderOrder = 3;
  group.add(flowSkin);

  coreGroup = createInternalCore();
  group.add(coreGroup);
  group.add(createSurfaceParticles(lowPower ? 10000 : 28000));
  group.add(createWakeParticles(lowPower ? 5000 : 14000));

  group.rotation.set(-.06, -.16, -.055);
  group.position.set(.3, -.02, 0);
  return group;
}

function addLighting() {
  scene.add(new THREE.HemisphereLight(0x9abaff, 0x08050f, 1.15));
  const key = new THREE.DirectionalLight(0xdce9ff, 4.2);
  key.position.set(-3.5, 4.5, 6.5);
  scene.add(key);
  const violetRim = new THREE.PointLight(0x914dff, 26, 16, 2);
  violetRim.position.set(2.8, 1.4, -3.2);
  scene.add(violetRim);
  const warmRim = new THREE.PointLight(0xffa255, 16, 12, 2);
  warmRim.position.set(2.2, -2.2, 2.8);
  scene.add(warmRim);
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas: stage,
    antialias: !lowPower,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.15 : 1.65));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
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
  controls.zoomSpeed = .65;
  controls.rotateSpeed = .62;
  controls.minDistance = 5.3;
  controls.maxDistance = 12.5;
  controls.minPolarAngle = .06;
  controls.maxPolarAngle = Math.PI - .06;
  controls.autoRotate = false;
  controls.autoRotateSpeed = .34;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.15 : 1.65));
  renderer.setSize(width, height, false);
  surfaceParticleMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  wakeMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
}

function animate(now) {
  const deltaSeconds = clamp((now - lastTime) / 1000, 0, .05);
  lastTime = now;
  energy += (targetEnergy - energy) * (1 - Math.pow(.0018, deltaSeconds));

  const animatedTime = reducedMotion ? 0 : now / 1000;
  flowMaterial.uniforms.uTime.value = animatedTime;
  flowMaterial.uniforms.uEnergy.value = energy;
  surfaceParticleMaterial.uniforms.uTime.value = animatedTime;
  surfaceParticleMaterial.uniforms.uEnergy.value = energy;
  wakeMaterial.uniforms.uTime.value = animatedTime;
  wakeMaterial.uniforms.uEnergy.value = energy;

  if (!reducedMotion) {
    coreGroup.rotation.x = Math.sin(animatedTime * .23) * .08;
    coreGroup.rotation.y = animatedTime * (.085 + energy * .075);
    coreGroup.rotation.z = Math.sin(animatedTime * .17) * .055;
    vessel.position.y = -.02 + Math.sin(animatedTime * .48) * .018;
  }

  if (!reducedMotion && !resettingView && performance.now() - lastInteraction > 6500) controls.autoRotate = true;
  updateViewReset(deltaSeconds);
  controls.update(deltaSeconds);
  renderer.render(scene, camera);
}

function bindInterface() {
  transmissionInput.addEventListener("input", () => {
    const value = Number(transmissionInput.value);
    shellMaterial.transmission = value / 100;
    transmissionValue.textContent = `${value}%`;
    metricTransmission.textContent = `${value}%`;
  });

  flowInput.addEventListener("input", () => {
    const value = Number(flowInput.value);
    const normalized = value / 100;
    flowMaterial.uniforms.uIntensity.value = normalized;
    surfaceParticleMaterial.uniforms.uIntensity.value = normalized;
    flowValue.textContent = `${value}%`;
  });

  boostButton.addEventListener("click", () => {
    const active = !boostButton.classList.contains("is-active");
    boostButton.classList.toggle("is-active", active);
    boostButton.querySelector("b").textContent = active ? "降低至层流" : "激活湍流";
    renderState.textContent = active ? "高涡量状态" : "稳定层流";
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
    setupRenderer();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, .08, 80);
    camera.position.copy(defaultCameraPosition);
    setupEnvironment();
    addLighting();
    vessel = createVessel();
    scene.add(vessel);
    setupControls();
    bindInterface();
    renderer.setAnimationLoop(animate);
    lab.classList.add("is-ready");
  } catch (error) {
    fallback.hidden = false;
    stage.hidden = true;
  }
}

initialize();
