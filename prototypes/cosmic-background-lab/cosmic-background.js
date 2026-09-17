import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const stage = document.querySelector("#cosmic-stage");
const lab = document.querySelector("#cosmic-lab");
const fallback = document.querySelector("#webgl-fallback");
const renderState = document.querySelector("#render-state");
const nebulaInput = document.querySelector("#nebula-activity");
const nebulaValue = document.querySelector("#nebula-value");
const depthInput = document.querySelector("#local-depth");
const depthValue = document.querySelector("#depth-value");
const resetButton = document.querySelector("#reset-view");
const tourButton = document.querySelector("#auto-tour");
const bearingValue = document.querySelector("#bearing-value");
const objectCount = document.querySelector("#object-count");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const lowPower = coarsePointer || (navigator.hardwareConcurrency || 8) <= 4;
const starCount = lowPower ? 8500 : 18000;
const dustCount = lowPower ? 900 : 2200;
const nearAsteroidCount = lowPower ? 10 : 22;
const farAsteroidCount = lowPower ? 58 : 136;

let renderer;
let scene;
let camera;
let controls;
let skySphere;
let skyMaterial;
let starMaterial;
let dustMaterial;
let planetGroup;
let planetCloudMaterial;
let cloudLayer;
let moon;
let galaxyGroup;
let nearFieldGroup;
let farFieldGroup;
let tourActive = false;
let resettingView = false;
let lastTime = performance.now();
let lastInteraction = performance.now();
let visualMode = "cinematic";
const nebulaMaterials = [];
const galaxyMaterials = [];
const asteroidSystems = [];
const asteroidMaterials = [];
const asteroidTextureCache = new Map();
const defaultCameraPosition = new THREE.Vector3(0, 1.35, 8.8);
const defaultTarget = new THREE.Vector3(0, 0, 0);
const tempMatrix = new THREE.Matrix4();
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();

let randomState = 0x9e3779b9;
function random() {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return (randomState >>> 0) / 4294967296;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function randomDirection() {
  const z = random() * 2 - 1;
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(Math.cos(angle) * radius, z, Math.sin(angle) * radius);
}

const skyVertexShader = `
  varying vec2 vUv;
  varying vec3 vDirection;
  void main() {
    vUv = uv;
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

const skyFragmentShader = `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vDirection;

  float hash(vec3 point) {
    point = fract(point * 0.3183099 + vec3(0.12,0.23,0.34));
    point *= 17.0;
    return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
  }
  float noise(vec3 point) {
    vec3 cell = floor(point);
    vec3 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(mix(hash(cell),hash(cell+vec3(1,0,0)),local.x),mix(hash(cell+vec3(0,1,0)),hash(cell+vec3(1,1,0)),local.x),local.y),
      mix(mix(hash(cell+vec3(0,0,1)),hash(cell+vec3(1,0,1)),local.x),mix(hash(cell+vec3(0,1,1)),hash(cell+vec3(1,1,1)),local.x),local.y),local.z
    );
  }
  float fbm(vec3 point) {
    float value=0.0;
    float amplitude=0.5;
    for(int octave=0;octave<4;octave++){
      value+=noise(point)*amplitude;
      point=point*2.03+vec3(1.8,-2.2,2.7);
      amplitude*=0.5;
    }
    return value;
  }
  void main() {
    vec3 direction=normalize(vDirection);
    vec3 photograph=texture2D(uMap,vUv).rgb*0.74;
    float cloud=fbm(direction*3.6+vec3(1.7,-2.4,3.1));
    float detail=fbm(direction*8.2+cloud*2.7);
    float ridge=1.0-abs(detail*2.0-1.0);
    ridge*=ridge;
    vec3 northColor=mix(vec3(0.008,0.018,0.052),vec3(0.08,0.24,0.48),cloud);
    vec3 southColor=mix(vec3(0.018,0.008,0.034),vec3(0.38,0.09,0.08),cloud);
    vec3 poleColor=mix(southColor,northColor,smoothstep(-0.2,0.2,direction.y));
    poleColor+=ridge*vec3(0.09,0.14,0.22)*smoothstep(0.42,0.78,cloud);
    float poleBlend=smoothstep(0.76,0.96,abs(direction.y));
    gl_FragColor=vec4(mix(photograph,poleColor,poleBlend),1.0);
  }
`;

const starVertexShader = `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uOpacity;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vBrightness;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float shimmer = 0.96 + sin(uTime * (0.32 + aPhase * 0.28) + aPhase * 17.0) * 0.04;
    gl_PointSize = aSize * shimmer * uPixelRatio;
    vColor = aColor;
    vBrightness = shimmer * uOpacity;
  }
`;

const starFragmentShader = `
  varying vec3 vColor;
  varying float vBrightness;
  void main() {
    vec2 point = gl_PointCoord - vec2(0.5);
    float radius = length(point);
    float core = smoothstep(0.2, 0.0, radius);
    float halo = smoothstep(0.5, 0.06, radius) * 0.2;
    float rayX = exp(-abs(point.x) * 46.0) * smoothstep(0.5, 0.02, abs(point.y));
    float rayY = exp(-abs(point.y) * 46.0) * smoothstep(0.5, 0.02, abs(point.x));
    float diagonalA = exp(-abs(point.x + point.y) * 66.0) * smoothstep(0.68, 0.04, abs(point.x - point.y));
    float diagonalB = exp(-abs(point.x - point.y) * 66.0) * smoothstep(0.68, 0.04, abs(point.x + point.y));
    float rays = (rayX + rayY) * 0.22 + (diagonalA + diagonalB) * 0.07;
    float alpha = clamp(core + halo + rays, 0.0, 1.0) * vBrightness;
    gl_FragColor = vec4(vColor * (0.75 + core * 0.75), alpha);
  }
`;

const nebulaVertexShader = `
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    float edge = sin(uv.x * 15.0 + uTime * 0.018) * cos(uv.y * 11.0 - uTime * 0.014);
    transformed.z += edge * 0.028 * uMotion;
    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const nebulaFragmentShader = `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uPhase;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(mix(hash(cell), hash(cell + vec2(1,0)), local.x), mix(hash(cell + vec2(0,1)), hash(cell + vec2(1,1)), local.x), local.y);
  }
  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(0.82,-0.57,0.57,0.82);
    for (int octave = 0; octave < 5; octave++) {
      value += noise(point) * amplitude;
      point = rotation * point * 2.05 + vec2(1.7,-2.4);
      amplitude *= 0.5;
    }
    return value;
  }
  void main() {
    vec2 centered = vUv - 0.5;
    float mask = smoothstep(0.58, 0.08, length(centered * vec2(1.0, 1.42)));
    float drift = uTime * 0.006;
    vec2 domain = vUv * vec2(4.2, 6.4) + vec2(-drift, drift * 0.42) + uPhase;
    float large = fbm(domain);
    float warp = fbm(domain * 1.62 + vec2(large * 3.2, -large * 2.6));
    float ridge = 1.0 - abs(warp * 2.0 - 1.0);
    ridge *= ridge;
    float dustLane = smoothstep(0.36, 0.62, fbm(domain * 0.72 + 8.0));
    float density = smoothstep(0.3, 0.78, large * 0.48 + warp * 0.38 + ridge * 0.2);
    density *= (0.42 + dustLane * 0.58) * mask;
    vec3 color = mix(uColorA, uColorB, clamp(warp * 1.08, 0.0, 1.0));
    color += ridge * 0.16;
    float alpha = density * uIntensity * (0.34 + ridge * 0.52);
    gl_FragColor = vec4(color, alpha);
  }
`;

const planetVertexShader = `
  uniform float uTime;
  varying vec3 vWorldNormal;
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  varying float vElevation;

  float hash(vec3 point) {
    point = fract(point * 0.3183099 + vec3(0.12,0.22,0.32));
    point *= 17.0;
    return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
  }
  float noise(vec3 point) {
    vec3 cell = floor(point);
    vec3 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(mix(hash(cell),hash(cell+vec3(1,0,0)),local.x),mix(hash(cell+vec3(0,1,0)),hash(cell+vec3(1,1,0)),local.x),local.y),
      mix(mix(hash(cell+vec3(0,0,1)),hash(cell+vec3(1,0,1)),local.x),mix(hash(cell+vec3(0,1,1)),hash(cell+vec3(1,1,1)),local.x),local.y),local.z
    );
  }
  float fbm(vec3 point) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave=0; octave<4; octave++) {
      value += noise(point) * amplitude;
      point = point * 2.04 + vec3(1.9,-2.2,2.7);
      amplitude *= 0.5;
    }
    return value;
  }
  void main() {
    vec3 localDirection = normalize(position);
    float continental = fbm(localDirection * 2.72 + vec3(1.8,-2.1,0.7));
    float ridge = fbm(localDirection * 7.8 + continental * 2.4);
    float land = smoothstep(0.49,0.61,continental + ridge * 0.075);
    float elevation = land * ((continental - 0.49) * 0.024 + (ridge - 0.5) * 0.0055);
    vec3 transformed = position * (1.0 + elevation);
    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vLocalPosition = localDirection;
    vElevation = elevation;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const planetFragmentShader = `
  uniform float uTime;
  varying vec3 vWorldNormal;
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  varying float vElevation;

  float hash(vec3 point) {
    point = fract(point * 0.3183099 + vec3(0.12,0.22,0.32));
    point *= 17.0;
    return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
  }
  float noise(vec3 point) {
    vec3 cell = floor(point);
    vec3 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(mix(hash(cell),hash(cell+vec3(1,0,0)),local.x),mix(hash(cell+vec3(0,1,0)),hash(cell+vec3(1,1,0)),local.x),local.y),
      mix(mix(hash(cell+vec3(0,0,1)),hash(cell+vec3(1,0,1)),local.x),mix(hash(cell+vec3(0,1,1)),hash(cell+vec3(1,1,1)),local.x),local.y),local.z
    );
  }
  float fbm(vec3 point) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave=0; octave<4; octave++) {
      value += noise(point) * amplitude;
      point = point * 2.04 + vec3(1.9,-2.2,2.7);
      amplitude *= 0.5;
    }
    return value;
  }
  void main() {
    vec3 baseNormal = normalize(vWorldNormal);
    vec3 lightDirection = normalize(vec3(-0.72,0.46,0.35));
    float continental = fbm(vLocalPosition * 2.72 + vec3(1.8,-2.1,0.7));
    float ridge = fbm(vLocalPosition * 7.8 + continental * 2.4);
    float detail = fbm(vLocalPosition * 18.0 + ridge * 2.8);
    float micro = noise(vLocalPosition * 48.0 + detail * 3.0);
    float landMask = smoothstep(0.49,0.61,continental + ridge * 0.075);
    float coast = smoothstep(0.0,0.08,abs(continental + ridge * 0.075 - 0.55));

    vec3 axis = abs(baseNormal.y) < 0.86 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0);
    vec3 tangent = normalize(cross(axis,baseNormal));
    vec3 bitangent = normalize(cross(baseNormal,tangent));
    float reliefX = fbm(vLocalPosition * 15.0 + tangent * 0.035) - fbm(vLocalPosition * 15.0 - tangent * 0.035);
    float reliefY = fbm(vLocalPosition * 15.0 + bitangent * 0.035) - fbm(vLocalPosition * 15.0 - bitangent * 0.035);
    vec3 normal = normalize(baseNormal + (tangent * reliefX + bitangent * reliefY) * landMask * 1.45);
    float light = max(0.0,dot(normal,lightDirection));

    vec3 deepOcean = vec3(0.006,0.028,0.075);
    vec3 shelfOcean = vec3(0.025,0.18,0.23);
    float oceanDepth = smoothstep(0.35,0.57,continental + ridge * 0.04);
    vec3 ocean = mix(deepOcean,shelfOcean,oceanDepth);
    vec3 lowland = mix(vec3(0.085,0.17,0.12),vec3(0.34,0.27,0.13),ridge);
    vec3 highland = mix(vec3(0.31,0.22,0.13),vec3(0.48,0.43,0.37),micro);
    float mountain = smoothstep(0.57,0.83,ridge + max(vElevation,0.0) * 7.0);
    vec3 mineral = mix(lowland,highland,mountain);
    mineral *= 0.84 + detail * 0.28;
    vec3 albedo = mix(ocean,mineral,landMask);
    albedo += (1.0-coast) * landMask * vec3(0.045,0.036,0.018);

    float polar = smoothstep(0.69,0.94,abs(vLocalPosition.y) + continental * 0.11 - detail * 0.04);
    float snowLine = smoothstep(0.68,0.87,ridge + abs(vLocalPosition.y) * 0.25) * landMask;
    albedo = mix(albedo,vec3(0.67,0.77,0.79),max(polar,snowLine * 0.42));

    vec3 viewDirection = normalize(cameraPosition-vWorldPosition);
    vec3 halfVector = normalize(lightDirection+viewDirection);
    float oceanSpecular = pow(max(0.0,dot(baseNormal,halfVector)),72.0) * (1.0-landMask);
    float cloudField = fbm(vLocalPosition * 5.4 + vec3(uTime * 0.009,-uTime * 0.003,uTime * 0.005));
    float cloudShadow = smoothstep(0.59,0.72,cloudField) * light * 0.17;
    float nightGlow = pow(max(0.0,detail - 0.79),5.0) * landMask * (1.0-light) * 2.1;
    vec3 color = albedo * (0.028 + light * 1.12) * (1.0-cloudShadow);
    color += oceanSpecular * vec3(0.46,0.72,0.88) * 0.75;
    color += nightGlow * vec3(0.62,0.31,0.08);
    gl_FragColor = vec4(color,1.0);
  }
`;

const cloudVertexShader = `
  varying vec3 vWorldNormal;
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition=modelMatrix*vec4(position,1.0);
    vWorldPosition=worldPosition.xyz;
    vWorldNormal=normalize(mat3(modelMatrix)*normal);
    vLocalPosition=normalize(position);
    gl_Position=projectionMatrix*viewMatrix*worldPosition;
  }
`;

const cloudFragmentShader = `
  uniform float uTime;
  varying vec3 vWorldNormal;
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  float hash(vec3 point) {
    point=fract(point*0.3183099+vec3(0.17,0.31,0.47));
    point*=17.0;
    return fract(point.x*point.y*point.z*(point.x+point.y+point.z));
  }
  float noise(vec3 point) {
    vec3 cell=floor(point);
    vec3 local=fract(point);
    local=local*local*(3.0-2.0*local);
    return mix(
      mix(mix(hash(cell),hash(cell+vec3(1,0,0)),local.x),mix(hash(cell+vec3(0,1,0)),hash(cell+vec3(1,1,0)),local.x),local.y),
      mix(mix(hash(cell+vec3(0,0,1)),hash(cell+vec3(1,0,1)),local.x),mix(hash(cell+vec3(0,1,1)),hash(cell+vec3(1,1,1)),local.x),local.y),local.z
    );
  }
  float fbm(vec3 point) {
    float value=0.0;
    float amplitude=0.5;
    for(int octave=0;octave<5;octave++){
      value+=noise(point)*amplitude;
      point=point*2.03+vec3(1.7,-2.3,2.9);
      amplitude*=0.5;
    }
    return value;
  }
  void main(){
    vec3 drift=vec3(uTime*0.008,-uTime*0.0025,uTime*0.004);
    float large=fbm(vLocalPosition*4.8+drift);
    float curl=fbm(vLocalPosition*11.5+large*2.6-drift*0.7);
    float stormBands=sin((vLocalPosition.y+large*0.07)*36.0)*0.5+0.5;
    float density=smoothstep(0.61,0.755,large*0.68+curl*0.31+stormBands*0.035);
    density*=1.0-smoothstep(0.82,0.99,abs(vLocalPosition.y));
    vec3 normal=normalize(vWorldNormal);
    vec3 lightDirection=normalize(vec3(-0.72,0.46,0.35));
    vec3 viewDirection=normalize(cameraPosition-vWorldPosition);
    float light=max(0.0,dot(normal,lightDirection));
    float rim=pow(1.0-max(0.0,dot(normal,viewDirection)),2.4);
    vec3 color=mix(vec3(0.24,0.30,0.35),vec3(0.89,0.95,1.0),0.18+light*0.82);
    gl_FragColor=vec4(color,density*(0.3+light*0.55+rim*0.18)*0.72);
  }
`;

const atmosphereVertexShader = `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position,1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 normal=normalize(vWorldNormal);
    float fresnel = pow(1.0 - max(0.0,dot(normal,viewDirection)),2.65);
    vec3 lightDirection = normalize(vec3(-0.72,0.46,0.35));
    float sunAngle=dot(normal,lightDirection);
    float daylight = smoothstep(-0.22,0.42,sunAngle);
    float terminator=exp(-abs(sunAngle+0.04)*13.0);
    vec3 rayleigh=mix(vec3(0.08,0.31,0.82),vec3(0.24,0.78,1.0),daylight);
    vec3 color=mix(rayleigh,vec3(1.0,0.28,0.055),terminator*0.48);
    float alpha=fresnel*(0.13+daylight*0.5+terminator*0.22);
    gl_FragColor = vec4(color,alpha);
  }
`;

const galaxyVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

const galaxyFragmentShader = `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;
  float hash(vec2 point) { return fract(sin(dot(point,vec2(127.1,311.7))) * 43758.5453); }
  void main() {
    vec2 p = (vUv - 0.5) * vec2(1.0,1.9);
    float radius = length(p);
    float angle = atan(p.y,p.x);
    float spiral = sin(angle * 3.0 - radius * 24.0 + uTime * 0.003) * 0.5 + 0.5;
    float arms = pow(spiral,5.0) * smoothstep(0.48,0.04,radius);
    float disk = exp(-radius * 7.0) * 0.7;
    float core = exp(-radius * 24.0) * 1.8;
    float granular = hash(floor(vUv * 220.0));
    float alpha = (arms * (0.35 + granular * 0.65) + disk + core) * smoothstep(0.53,0.18,radius);
    vec3 color = mix(uColorA,uColorB,clamp(radius * 2.2,0.0,1.0));
    color += core * vec3(1.0,0.74,0.42);
    gl_FragColor = vec4(color,alpha * 0.74);
  }
`;

const dustVertexShader = `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uOpacity;
  attribute float aSize;
  attribute float aPhase;
  varying float vAlpha;
  void main() {
    vec3 transformed = position;
    transformed.y += sin(uTime * 0.12 + aPhase * 11.0) * 0.035;
    vec4 viewPosition = modelViewMatrix * vec4(transformed,1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * uPixelRatio * (16.0 / max(2.0,-viewPosition.z));
    vAlpha = uOpacity * (0.35 + aPhase * 0.65);
  }
`;

const dustFragmentShader = `
  varying float vAlpha;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    float alpha = smoothstep(0.5,0.05,radius) * vAlpha;
    gl_FragColor = vec4(0.66,0.8,1.0,alpha);
  }
`;

function createSkySphere() {
  const geometry = new THREE.SphereGeometry(480, lowPower ? 64 : 96, lowPower ? 36 : 56);
  const fallbackPixel = new Uint8Array([2,4,11,255]);
  const fallbackTexture = new THREE.DataTexture(fallbackPixel,1,1,THREE.RGBAFormat);
  fallbackTexture.needsUpdate = true;
  skyMaterial = new THREE.ShaderMaterial({
    uniforms:{uMap:{value:fallbackTexture}},
    vertexShader:skyVertexShader,
    fragmentShader:skyFragmentShader,
    side:THREE.BackSide,
    depthWrite:false
  });
  const sphere = new THREE.Mesh(geometry, skyMaterial);
  sphere.rotation.y = 1.25;
  sphere.renderOrder = -20;
  scene.add(sphere);
  renderState.textContent = "解析深空摄影";
  new THREE.TextureLoader().load(
    "./assets/nebula-panorama-v1.png",
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      skyMaterial.uniforms.uMap.value = texture;
      renderState.textContent = "深空巡航";
    },
    undefined,
    () => { renderState.textContent = "程序星海备份"; }
  );
  return sphere;
}

function createStars() {
  const positions = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);
  const phases = new Float32Array(starCount);
  const colors = new Float32Array(starCount * 3);
  const warm = new THREE.Color(0xffd6a1);
  const neutral = new THREE.Color(0xeaf2ff);
  const cool = new THREE.Color(0x9fc6ff);
  const color = new THREE.Color();

  for (let index = 0; index < starCount; index += 1) {
    const direction = randomDirection();
    const radius = 350 + random() * 78;
    positions[index * 3] = direction.x * radius;
    positions[index * 3 + 1] = direction.y * radius;
    positions[index * 3 + 2] = direction.z * radius;
    const bright = random();
    sizes[index] = bright > .992 ? 10 + random() * 9 : bright > .94 ? 3 + random() * 3.8 : .7 + random() * 1.55;
    phases[index] = random();
    const temperature = random();
    if (temperature < .18) color.copy(warm).lerp(neutral, temperature / .18);
    else color.copy(neutral).lerp(cool, (temperature - .18) / .82);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  starMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime:{value:0},uPixelRatio:{value:renderer.getPixelRatio()},uOpacity:{value:.76} },
    vertexShader:starVertexShader,
    fragmentShader:starFragmentShader,
    transparent:true,
    depthWrite:false,
    blending:THREE.AdditiveBlending
  });
  const stars = new THREE.Points(geometry,starMaterial);
  stars.renderOrder = -10;
  scene.add(stars);
}

function createNebulaCard(position, scale, colorA, colorB, phase) {
  const material = new THREE.ShaderMaterial({
    uniforms:{
      uTime:{value:0},
      uMotion:{value:Number(nebulaInput.value)/100},
      uIntensity:{value:.18 + Number(nebulaInput.value)/100 * .34},
      uPhase:{value:phase},
      uColorA:{value:new THREE.Color(colorA)},
      uColorB:{value:new THREE.Color(colorB)}
    },
    vertexShader:nebulaVertexShader,
    fragmentShader:nebulaFragmentShader,
    transparent:true,
    depthWrite:false,
    side:THREE.DoubleSide,
    blending:THREE.AdditiveBlending
  });
  material.forceSinglePass = true;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(scale.x,scale.y,lowPower?36:64,lowPower?22:38),material);
  card.position.copy(position);
  card.lookAt(0,0,0);
  card.renderOrder = -4;
  nebulaMaterials.push(material);
  scene.add(card);
  return card;
}

function createNebulae() {
  createNebulaCard(new THREE.Vector3(-82,34,-142),new THREE.Vector2(76,46),0x184fa0,0x4dd3dd,.7);
  createNebulaCard(new THREE.Vector3(112,-26,-172),new THREE.Vector2(94,52),0x8c2a18,0xf0a14a,2.1);
  if (!lowPower) createNebulaCard(new THREE.Vector3(-145,-48,58),new THREE.Vector2(108,60),0x40146f,0x2f7db8,4.4);
}

function createGalaxy(position,scale,colorA,colorB,rotation) {
  const material = new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uColorA:{value:new THREE.Color(colorA)},uColorB:{value:new THREE.Color(colorB)}},
    vertexShader:galaxyVertexShader,
    fragmentShader:galaxyFragmentShader,
    transparent:true,
    depthWrite:false,
    side:THREE.DoubleSide,
    blending:THREE.AdditiveBlending
  });
  const galaxy = new THREE.Mesh(new THREE.PlaneGeometry(scale.x,scale.y),material);
  galaxy.position.copy(position);
  galaxy.lookAt(0,0,0);
  galaxy.rotateZ(rotation);
  galaxy.renderOrder = -7;
  galaxyMaterials.push(material);
  galaxyGroup.add(galaxy);
}

function createGalaxies() {
  galaxyGroup = new THREE.Group();
  scene.add(galaxyGroup);
  createGalaxy(new THREE.Vector3(-128,66,-236),new THREE.Vector2(64,38),0x75b9ff,0x9768d8,-.28);
  createGalaxy(new THREE.Vector3(196,-54,118),new THREE.Vector2(48,28),0xffba78,0x6b86d8,.42);
}

function createPlanet() {
  planetGroup = new THREE.Group();
  planetGroup.position.set(25,-12,-31);
  const geometry = new THREE.SphereGeometry(7.8,lowPower?56:96,lowPower?36:64);
  const material = new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:planetVertexShader,fragmentShader:planetFragmentShader});
  const surface = new THREE.Mesh(geometry,material);
  surface.userData.surfaceMaterial = material;
  planetGroup.add(surface);
  planetCloudMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0}},
    vertexShader:cloudVertexShader,
    fragmentShader:cloudFragmentShader,
    transparent:true,
    depthWrite:false,
    blending:THREE.NormalBlending
  });
  cloudLayer=new THREE.Mesh(geometry,planetCloudMaterial);
  cloudLayer.scale.setScalar(1.018);
  cloudLayer.renderOrder=2;
  planetGroup.add(cloudLayer);
  const atmosphere = new THREE.Mesh(geometry,new THREE.ShaderMaterial({
    vertexShader:atmosphereVertexShader,
    fragmentShader:atmosphereFragmentShader,
    transparent:true,
    depthWrite:false,
    side:THREE.BackSide,
    blending:THREE.AdditiveBlending
  }));
  atmosphere.scale.setScalar(1.065);
  planetGroup.add(atmosphere);
  scene.add(planetGroup);

  const moonTextures=createAsteroidTextureSet(8.4);
  moon = new THREE.Mesh(createIrregularAsteroidGeometry(5.8),new THREE.MeshStandardMaterial({
    color:0xa8b0b7,
    map:moonTextures.color,
    bumpMap:moonTextures.bump,
    bumpScale:.11,
    roughness:.93,
    metalness:0,
    flatShading:false
  }));
  moon.scale.set(3.25,3.4,3.1);
  moon.position.set(-62,24,-92);
  scene.add(moon);
}

function seededValue(seed) {
  let state=(Math.floor(seed*100003)+0x6d2b79f5)>>>0;
  return ()=>{
    state+=0x6d2b79f5;
    let value=state;
    value=Math.imul(value^(value>>>15),value|1);
    value^=value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
}

function createIrregularAsteroidGeometry(seed) {
  const geometry = new THREE.SphereGeometry(1,lowPower?20:36,lowPower?14:26);
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const seededRandom=seededValue(seed);
  const craterCount=lowPower?5:8;
  const craters=[];
  for(let craterIndex=0;craterIndex<craterCount;craterIndex+=1){
    const z=seededRandom()*2-1;
    const angle=seededRandom()*Math.PI*2;
    const radial=Math.sqrt(Math.max(0,1-z*z));
    craters.push({
      direction:new THREE.Vector3(Math.cos(angle)*radial,z,Math.sin(angle)*radial),
      radius:.18+seededRandom()*.23,
      depth:.07+seededRandom()*.085
    });
  }
  const axisScale=new THREE.Vector3(.76+seededRandom()*.28,.82+seededRandom()*.36,.72+seededRandom()*.32);
  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position,index);
    direction.copy(vertex).normalize();
    const broad=Math.sin(direction.x*(2.7+seed*.13)+direction.y*3.9+seed)*.09+
      Math.cos(direction.z*4.6-direction.x*2.2+seed*1.7)*.065;
    const fine=Math.sin((direction.x-direction.z)*11.0+seed*2.3)*.025+
      Math.cos((direction.y+direction.z)*17.0-seed)*.014;
    let radius=1+broad+fine;
    craters.forEach((crater)=>{
      const angular=Math.acos(clamp(direction.dot(crater.direction),-1,1));
      if(angular<crater.radius*1.34){
        const normalized=angular/crater.radius;
        const bowl=Math.max(0,1-normalized);
        const rim=Math.exp(-Math.pow((normalized-1.02)/.13,2));
        radius-=crater.depth*bowl*bowl;
        radius+=crater.depth*.31*rim;
      }
    });
    vertex.copy(direction).multiplyScalar(radius);
    vertex.multiply(axisScale);
    position.setXYZ(index,vertex.x,vertex.y,vertex.z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createAsteroidTextureSet(seed) {
  const cacheKey=seed.toFixed(2);
  if(asteroidTextureCache.has(cacheKey))return asteroidTextureCache.get(cacheKey);
  const size=lowPower?192:256;
  const seededRandom=seededValue(seed+12.7);
  const colorCanvas=document.createElement("canvas");
  const bumpCanvas=document.createElement("canvas");
  colorCanvas.width=colorCanvas.height=size;
  bumpCanvas.width=bumpCanvas.height=size;
  const colorContext=colorCanvas.getContext("2d");
  const bumpContext=bumpCanvas.getContext("2d");
  const colorImage=colorContext.createImageData(size,size);
  const bumpImage=bumpContext.createImageData(size,size);
  for(let y=0;y<size;y+=1){
    for(let x=0;x<size;x+=1){
      const nx=x/size;
      const ny=y/size;
      const grain=Math.sin(nx*31.0+Math.sin(ny*13.0+seed)*2.4)*.5+
        Math.sin((nx+ny)*67.0+seed*3.1)*.25+
        Math.cos(ny*109.0-nx*17.0+seed)*.125;
      const broad=Math.sin(nx*8.0+seed+Math.cos(ny*7.0))*12+Math.cos(ny*11.0-seed)*8;
      const luminosity=clamp(116+broad*1.25+grain*34,62,186);
      const offset=(y*size+x)*4;
      colorImage.data[offset]=luminosity*.82;
      colorImage.data[offset+1]=luminosity*.76;
      colorImage.data[offset+2]=luminosity*.7;
      colorImage.data[offset+3]=255;
      const bumpValue=clamp(126+broad*.7+grain*47,28,224);
      bumpImage.data[offset]=bumpValue;
      bumpImage.data[offset+1]=bumpValue;
      bumpImage.data[offset+2]=bumpValue;
      bumpImage.data[offset+3]=255;
    }
  }
  colorContext.putImageData(colorImage,0,0);
  bumpContext.putImageData(bumpImage,0,0);
  const textureCraterCount=11;
  for(let index=0;index<textureCraterCount;index+=1){
    const x=seededRandom()*size;
    const y=seededRandom()*size;
    const radius=size*(.025+seededRandom()*.075);
    const colorGradient=colorContext.createRadialGradient(x,y,0,x,y,radius);
    colorGradient.addColorStop(0,"rgba(12,10,9,.62)");
    colorGradient.addColorStop(.64,"rgba(30,27,25,.48)");
    colorGradient.addColorStop(.78,"rgba(138,126,111,.34)");
    colorGradient.addColorStop(.9,"rgba(20,18,17,.2)");
    colorGradient.addColorStop(1,"rgba(0,0,0,0)");
    colorContext.fillStyle=colorGradient;
    colorContext.beginPath();
    colorContext.arc(x,y,radius,0,Math.PI*2);
    colorContext.fill();
    const bumpGradient=bumpContext.createRadialGradient(x,y,0,x,y,radius);
    bumpGradient.addColorStop(0,"rgba(24,24,24,.92)");
    bumpGradient.addColorStop(.6,"rgba(55,55,55,.74)");
    bumpGradient.addColorStop(.76,"rgba(238,238,238,.9)");
    bumpGradient.addColorStop(.91,"rgba(104,104,104,.35)");
    bumpGradient.addColorStop(1,"rgba(128,128,128,0)");
    bumpContext.fillStyle=bumpGradient;
    bumpContext.beginPath();
    bumpContext.arc(x,y,radius,0,Math.PI*2);
    bumpContext.fill();
  }
  const colorTexture=new THREE.CanvasTexture(colorCanvas);
  const bumpTexture=new THREE.CanvasTexture(bumpCanvas);
  colorTexture.colorSpace=THREE.SRGBColorSpace;
  [colorTexture,bumpTexture].forEach((texture)=>{
    texture.wrapS=THREE.RepeatWrapping;
    texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  });
  const textures={color:colorTexture,bump:bumpTexture};
  asteroidTextureCache.set(cacheKey,textures);
  return textures;
}

function createAsteroidSystem(count,minRadius,maxRadius,minScale,maxScale,group,near,shapeSeed) {
  const textures=createAsteroidTextureSet(shapeSeed);
  const material = new THREE.MeshStandardMaterial({
    color:near?0xffffff:0xcbd3dd,
    map:textures.color,
    bumpMap:textures.bump,
    bumpScale:near?.13:.075,
    roughness:.96,
    metalness:.015,
    flatShading:false,
    transparent:true,
    opacity:near?.92:.68
  });
  asteroidMaterials.push(material);
  const mesh = new THREE.InstancedMesh(createIrregularAsteroidGeometry(shapeSeed),material,count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const instanceColor=new THREE.Color();
  const data=[];
  for (let index=0;index<count;index+=1) {
    let direction=randomDirection();
    if (near && Math.abs(direction.z)>.88) direction.z*=.55;
    const radius=minRadius+(maxRadius-minRadius)*Math.pow(random(),.72);
    const position=direction.multiplyScalar(radius);
    const scale=minScale+(maxScale-minScale)*Math.pow(random(),1.8);
    const warmth=random();
    instanceColor.setHSL(.055+warmth*.075,.055+warmth*.055,near?.66+random()*.13:.5+random()*.12);
    mesh.setColorAt(index,instanceColor);
    data.push({
      position,
      rotation:new THREE.Euler(random()*Math.PI,random()*Math.PI,random()*Math.PI),
      speed:new THREE.Vector3((random()-.5)*.16,(random()-.5)*.16,(random()-.5)*.16),
      scale:new THREE.Vector3(scale*(.7+random()*.65),scale*(.65+random()*.8),scale*(.7+random()*.62))
    });
  }
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  asteroidSystems.push({mesh,data});
  group.add(mesh);
}

function createAsteroids() {
  nearFieldGroup=new THREE.Group();
  farFieldGroup=new THREE.Group();
  scene.add(nearFieldGroup,farFieldGroup);
  const nearSlices=4;
  const farSlices=4;
  for(let slice=0;slice<nearSlices;slice+=1) {
    const count=Math.floor(nearAsteroidCount/nearSlices)+(slice<nearAsteroidCount%nearSlices?1:0);
    createAsteroidSystem(count,12,33,.45,2.15,nearFieldGroup,true,.4+slice*.9);
  }
  for(let slice=0;slice<farSlices;slice+=1) {
    const count=Math.floor(farAsteroidCount/farSlices)+(slice<farAsteroidCount%farSlices?1:0);
    createAsteroidSystem(count,42,142,.12,.72,farFieldGroup,false,1.2+slice*.8);
  }
}

function createDust() {
  const positions=new Float32Array(dustCount*3);
  const sizes=new Float32Array(dustCount);
  const phases=new Float32Array(dustCount);
  for(let index=0;index<dustCount;index+=1) {
    const radius=6+Math.pow(random(),.58)*48;
    const direction=randomDirection();
    positions[index*3]=direction.x*radius;
    positions[index*3+1]=direction.y*radius;
    positions[index*3+2]=direction.z*radius;
    sizes[index]=.35+random()*1.4;
    phases[index]=random();
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geometry.setAttribute("aSize",new THREE.BufferAttribute(sizes,1));
  geometry.setAttribute("aPhase",new THREE.BufferAttribute(phases,1));
  dustMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uPixelRatio:{value:renderer.getPixelRatio()},uOpacity:{value:Number(depthInput.value)/100*.55}},
    vertexShader:dustVertexShader,
    fragmentShader:dustFragmentShader,
    transparent:true,
    depthWrite:false,
    blending:THREE.AdditiveBlending
  });
  const dust=new THREE.Points(geometry,dustMaterial);
  dust.name="localDust";
  nearFieldGroup.add(dust);
}

function addLighting() {
  scene.add(new THREE.HemisphereLight(0x8ba7d6,0x06070b,.48));
  const sun=new THREE.DirectionalLight(0xffe3c0,3.7);
  sun.position.set(-18,22,16);
  scene.add(sun);
  const blueFill=new THREE.DirectionalLight(0x5d8fff,.75);
  blueFill.position.set(15,-7,-20);
  scene.add(blueFill);
}

function setupRenderer() {
  renderer=new THREE.WebGLRenderer({canvas:stage,antialias:!lowPower,alpha:false,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowPower?1:1.3));
  renderer.setSize(window.innerWidth,window.innerHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.04;
}

function setupControls() {
  controls=new OrbitControls(camera,stage);
  controls.target.copy(defaultTarget);
  controls.enableDamping=true;
  controls.dampingFactor=.055;
  controls.enablePan=false;
  controls.enableZoom=true;
  controls.zoomSpeed=.58;
  controls.rotateSpeed=.54;
  controls.minDistance=4.2;
  controls.maxDistance=13.5;
  controls.minPolarAngle=.045;
  controls.maxPolarAngle=Math.PI-.045;
  controls.autoRotate=false;
  controls.autoRotateSpeed=.12;
  controls.addEventListener("start",()=>{
    lastInteraction=performance.now();
    resettingView=false;
    if(!tourActive) controls.autoRotate=false;
  });
  controls.addEventListener("end",()=>{lastInteraction=performance.now();});
  controls.update();
}

function resetView() {
  resettingView=true;
  lastInteraction=performance.now();
}

function updateViewReset(delta) {
  if(!resettingView)return;
  const response=1-Math.pow(.0015,delta);
  camera.position.lerp(defaultCameraPosition,response);
  controls.target.lerp(defaultTarget,response);
  if(camera.position.distanceTo(defaultCameraPosition)<.015&&controls.target.distanceTo(defaultTarget)<.006){
    camera.position.copy(defaultCameraPosition);
    controls.target.copy(defaultTarget);
    resettingView=false;
  }
}

function updateAsteroids(delta) {
  asteroidSystems.forEach((system)=>{
    system.data.forEach((item,index)=>{
      item.rotation.x+=item.speed.x*delta;
      item.rotation.y+=item.speed.y*delta;
      item.rotation.z+=item.speed.z*delta;
      tempQuaternion.setFromEuler(item.rotation);
      tempScale.copy(item.scale);
      tempMatrix.compose(item.position,tempQuaternion,tempScale);
      system.mesh.setMatrixAt(index,tempMatrix);
    });
    system.mesh.instanceMatrix.needsUpdate=true;
  });
}

function updateBearing() {
  const direction=new THREE.Vector3().subVectors(controls.target,camera.position).normalize();
  let azimuth=THREE.MathUtils.radToDeg(Math.atan2(direction.x,-direction.z));
  if(azimuth<0)azimuth+=360;
  const elevation=THREE.MathUtils.radToDeg(Math.asin(direction.y));
  const azimuthText=Math.round(azimuth).toString().padStart(3,"0");
  const elevationText=`${elevation>=0?"+":"−"}${Math.abs(Math.round(elevation)).toString().padStart(2,"0")}`;
  bearingValue.textContent=`AZ ${azimuthText}° · EL ${elevationText}°`;
}

function applyVisualMode(mode) {
  visualMode=mode;
  document.body.dataset.visualMode=mode;
  document.querySelectorAll("[data-mode]").forEach((button)=>button.classList.toggle("is-active",button.dataset.mode===mode));
  const nebulaBase=Number(nebulaInput.value)/100;
  const depthBase=Number(depthInput.value)/100;
  if(mode==="cinematic"){
    renderer.toneMappingExposure=1.04;
    starMaterial.uniforms.uOpacity.value=.76;
    dustMaterial.uniforms.uOpacity.value=depthBase*.55;
    nebulaMaterials.forEach((material)=>{material.uniforms.uIntensity.value=.18+nebulaBase*.34;});
    asteroidMaterials.forEach((material,index)=>{material.opacity=index<4?.92:.68;});
  }else if(mode==="depth"){
    renderer.toneMappingExposure=.9;
    starMaterial.uniforms.uOpacity.value=.58;
    dustMaterial.uniforms.uOpacity.value=depthBase*.82;
    nebulaMaterials.forEach((material)=>{material.uniforms.uIntensity.value=.12+nebulaBase*.24;});
    asteroidMaterials.forEach((material,index)=>{material.opacity=index<4?1:.82;});
  }else{
    renderer.toneMappingExposure=.72;
    starMaterial.uniforms.uOpacity.value=.52;
    dustMaterial.uniforms.uOpacity.value=depthBase*.22;
    nebulaMaterials.forEach((material)=>{material.uniforms.uIntensity.value=.07+nebulaBase*.15;});
    asteroidMaterials.forEach((material,index)=>{material.opacity=index<4?.58:.34;});
  }
}

function bindInterface() {
  nebulaInput.addEventListener("input",()=>{
    const value=Number(nebulaInput.value);
    nebulaValue.textContent=`${value}%`;
    const normalized=value/100;
    nebulaMaterials.forEach((material)=>{
      material.uniforms.uMotion.value=normalized;
    });
    applyVisualMode(visualMode);
  });
  depthInput.addEventListener("input",()=>{
    const value=Number(depthInput.value);
    depthValue.textContent=`${value}%`;
    applyVisualMode(visualMode);
  });
  document.querySelectorAll("[data-mode]").forEach((button)=>button.addEventListener("click",()=>applyVisualMode(button.dataset.mode)));
  resetButton.addEventListener("click",resetView);
  tourButton.addEventListener("click",()=>{
    tourActive=!tourActive;
    tourButton.classList.toggle("is-active",tourActive);
    tourButton.querySelector("b").textContent=tourActive?"停止巡视":"开始巡视";
    controls.autoRotate=tourActive;
    renderState.textContent=tourActive?"自动深空巡视":"深空巡航";
    lastInteraction=performance.now();
  });
  stage.addEventListener("dblclick",resetView);
  window.addEventListener("resize",resize);
}

function resize() {
  const width=window.innerWidth;
  const height=window.innerHeight;
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowPower?1:1.3));
  renderer.setSize(width,height,false);
  starMaterial.uniforms.uPixelRatio.value=renderer.getPixelRatio();
  dustMaterial.uniforms.uPixelRatio.value=renderer.getPixelRatio();
}

function animate(now) {
  const delta=clamp((now-lastTime)/1000,0,.05);
  lastTime=now;
  const time=reducedMotion?0:now/1000;
  starMaterial.uniforms.uTime.value=time;
  dustMaterial.uniforms.uTime.value=time;
  nebulaMaterials.forEach((material)=>{material.uniforms.uTime.value=time;});
  galaxyMaterials.forEach((material)=>{material.uniforms.uTime.value=time;});
  if(!reducedMotion){
    planetGroup.rotation.y=time*.012;
    planetGroup.children[0].userData.surfaceMaterial.uniforms.uTime.value=time;
    planetCloudMaterial.uniforms.uTime.value=time;
    cloudLayer.rotation.y=time*.0065;
    cloudLayer.rotation.z=Math.sin(time*.004)*.018;
    moon.rotation.y=time*.018;
    moon.rotation.x=Math.sin(time*.007)*.12;
    nearFieldGroup.rotation.y=Math.sin(time*.009)*.018;
    farFieldGroup.rotation.y=-time*.00042;
    galaxyGroup.rotation.y=time*.00018;
    updateAsteroids(delta);
  }
  if(!tourActive&&!resettingView&&!reducedMotion&&performance.now()-lastInteraction>9500)controls.autoRotate=true;
  if(!tourActive&&performance.now()-lastInteraction<9500)controls.autoRotate=false;
  updateViewReset(delta);
  controls.update(delta);
  updateBearing();
  renderer.render(scene,camera);
}

function initialize() {
  try{
    objectCount.textContent=lowPower?"9.6K":"20.4K";
    setupRenderer();
    scene=new THREE.Scene();
    scene.background=new THREE.Color(0x010207);
    camera=new THREE.PerspectiveCamera(52,window.innerWidth/window.innerHeight,.08,900);
    camera.position.copy(defaultCameraPosition);
    addLighting();
    skySphere=createSkySphere();
    createStars();
    createNebulae();
    createGalaxies();
    createPlanet();
    createAsteroids();
    createDust();
    setupControls();
    bindInterface();
    applyVisualMode("cinematic");
    renderer.setAnimationLoop(animate);
    lab.classList.add("is-ready");
  }catch(error){
    console.error("Cosmic background lab failed to initialize",error);
    fallback.hidden=false;
    stage.hidden=true;
  }
}

initialize();
