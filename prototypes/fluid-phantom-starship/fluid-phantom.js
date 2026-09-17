import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const stage = document.querySelector("#starship-stage");
const fallback = document.querySelector("#webgl-fallback");
const lab = document.querySelector("#fluid-lab");
const opacityInput = document.querySelector("#fluid-opacity");
const opacityValue = document.querySelector("#opacity-value");
const curvatureInput = document.querySelector("#flow-curvature");
const curvatureValue = document.querySelector("#curvature-value");
const wakeButton = document.querySelector("#wake-core");
const resetButton = document.querySelector("#reset-view");
const renderState = document.querySelector("#render-state");
const metricOpacity = document.querySelector("#metric-opacity");
const metricSurface = document.querySelector("#metric-surface");
const metricTracer = document.querySelector("#metric-tracer");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const lowPower = coarsePointer || (navigator.hardwareConcurrency || 8) <= 4;
const tracerCount = lowPower ? 6000 : 12000;

let renderer;
let scene;
let camera;
let controls;
let vessel;
let tracerMaterial;
let innerSkeleton;
let bowShock;
let targetEnergy = 0;
let energy = 0;
let lastTime = performance.now();
let lastInteraction = performance.now();
let resettingView = false;
const fluidMaterials = [];
const wakeMeshes = [];

const defaultCameraPosition = new THREE.Vector3(1.35, 1.72, 9.25);
const defaultTarget = new THREE.Vector3(.36, -.05, 0);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function bodyRadius(u) {
  const main = Math.pow(Math.max(0, Math.sin(Math.PI * u)), .56);
  const nose = 1 - .58 * Math.pow(u, 4.4);
  const shoulder = .27 * Math.pow(1 - u, 5.2);
  return (.15 + .69 * main) * nose + shoulder;
}

function createBodySurface(longitudinalSegments, radialSegments) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let longitudinal = 0; longitudinal <= longitudinalSegments; longitudinal += 1) {
    const u = longitudinal / longitudinalSegments;
    const radius = bodyRadius(u);
    const x = -2.22 + 4.86 * u;
    const upperLift = Math.pow(Math.sin(Math.PI * clamp((u - .28) / .68, 0, 1)), 2) * .07;

    for (let radial = 0; radial <= radialSegments; radial += 1) {
      const v = radial / radialSegments;
      const angle = v * Math.PI * 2;
      const lateralPulse = 1 + .035 * Math.sin(angle * 3 + u * 8);
      const y = Math.cos(angle) * radius * .61 * lateralPulse + upperLift;
      const z = Math.sin(angle) * radius * .93 * lateralPulse;
      positions.push(x, y, z);
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

function createWingSurface(side, longitudinalSegments, spanSegments, verticalOffset = 0) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let longitudinal = 0; longitudinal <= longitudinalSegments; longitudinal += 1) {
    const u = longitudinal / longitudinalSegments;
    const x = 1.22 - u * 3.18;
    const span = .15 + Math.pow(u, .82) * 2.12;
    for (let across = 0; across <= spanSegments; across += 1) {
      const v = across / spanSegments;
      const edgeCurl = Math.sin(v * Math.PI) * Math.sin(u * Math.PI) * .045;
      const z = side * (.14 + span * v);
      const y = -.105 + verticalOffset + edgeCurl;
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const row = spanSegments + 1;
  for (let longitudinal = 0; longitudinal < longitudinalSegments; longitudinal += 1) {
    for (let across = 0; across < spanSegments; across += 1) {
      const a = longitudinal * row + across;
      const b = (longitudinal + 1) * row + across;
      const c = (longitudinal + 1) * row + across + 1;
      const d = longitudinal * row + across + 1;
      if (side > 0) indices.push(a, b, d, b, c, d);
      else indices.push(a, d, b, b, d, c);
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

function createWakeSurface(lane, longitudinalSegments, radialSegments) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const laneOffset = lane - 1;

  for (let longitudinal = 0; longitudinal <= longitudinalSegments; longitudinal += 1) {
    const u = longitudinal / longitudinalSegments;
    const x = -2.08 - u * 5.25;
    const coilRadius = Math.pow(u, 1.55) * .42;
    const coilPhase = u * Math.PI * 6.5 + lane * Math.PI * .66;
    const baseY = lane === 1 ? -.1 : -.25;
    const baseZ = laneOffset * .61;
    const centerY = baseY + Math.cos(coilPhase) * coilRadius * .58;
    const centerZ = baseZ + Math.sin(coilPhase) * coilRadius;
    const tubeRadius = .045 + u * (.14 + lane * .018);

    for (let radial = 0; radial <= radialSegments; radial += 1) {
      const v = radial / radialSegments;
      const angle = v * Math.PI * 2;
      positions.push(x, centerY + Math.cos(angle) * tubeRadius, centerZ + Math.sin(angle) * tubeRadius);
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

function createWingtipVortexSurface(side) {
  const points = [];
  const samples = lowPower ? 10 : 16;
  for (let index = 0; index < samples; index += 1) {
    const u = index / (samples - 1);
    const coil = u * Math.PI * 3.8;
    points.push(new THREE.Vector3(
      -1.72 - u * 4.1,
      -.11 + Math.sin(coil) * u * .11,
      side * (2.08 + Math.cos(coil) * u * .28)
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", .45);
  return new THREE.TubeGeometry(curve, lowPower ? 84 : 148, lowPower ? .035 : .045, lowPower ? 7 : 10, false);
}

const fluidVertexShader = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uCurvature;
  uniform float uLayer;
  uniform float uSurfaceType;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying vec3 vViewDirection;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    float advection = uTime * (0.38 + uEnergy * 1.28);
    float angularDomain = uv.y * 6.2831853;
    float largeEddy = sin(position.x * 2.15 - advection * 1.25 + sin(angularDomain * 2.0 + uLayer) * 1.8);
    float mediumEddy = cos(position.x * 5.8 - advection * 2.7 - angularDomain * 3.0 + largeEddy * 1.65 + uLayer * 2.1);
    float fineEddy = sin(position.x * 12.4 - advection * 5.4 + angularDomain * 6.0 + mediumEddy * 1.9);
    float envelope = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.9, uv.x);
    float cascade = largeEddy * 0.52 + mediumEddy * 0.31 + fineEddy * 0.17;
    float amplitude = 0.01 + uCurvature * 0.024 + uEnergy * 0.048;

    if (uSurfaceType < 0.5) {
      transformed += normal * cascade * amplitude * envelope;
      float orbitalDrift = sin(position.x * 2.7 - advection + angularDomain * 2.0 + uLayer);
      transformed.y += cos(angularDomain) * orbitalDrift * (0.004 + uEnergy * 0.012) * envelope;
      transformed.z += sin(angularDomain) * orbitalDrift * (0.004 + uEnergy * 0.015) * envelope;
    } else if (uSurfaceType < 1.5) {
      float edgeShear = smoothstep(0.48, 1.0, uv.y);
      float shedding = sin(uv.x * 20.0 - advection * 4.2 + uv.y * 8.0 + mediumEddy * 2.2);
      transformed += normal * (cascade * amplitude * 0.55 + shedding * edgeShear * (0.012 + uEnergy * 0.055));
      transformed.y += edgeShear * mediumEddy * (0.008 + uEnergy * 0.035) * smoothstep(0.05, 0.45, uv.x);
    } else if (uSurfaceType < 2.5) {
      float wakeGrowth = smoothstep(0.02, 0.92, uv.x);
      float wakePhase = uv.x * (18.0 + uEnergy * 13.0) - advection * (4.2 + uEnergy * 2.4) + uLayer * 2.3;
      float packet = sin(wakePhase + largeEddy * 2.6) * 0.62 + cos(wakePhase * 0.47 - mediumEddy * 2.1) * 0.38;
      transformed += normal * (cascade * amplitude * 0.72 + packet * wakeGrowth * (0.012 + uEnergy * 0.052));
      transformed.y += sin(wakePhase) * wakeGrowth * (0.006 + uEnergy * 0.036);
      transformed.z += cos(wakePhase * 0.82) * wakeGrowth * (0.007 + uEnergy * 0.042);
    } else {
      float shockPulse = sin(angularDomain * 4.0 - advection * 2.0 + mediumEddy * 2.4);
      transformed += normal * shockPulse * (0.006 + uCurvature * 0.014 + uEnergy * 0.022);
      transformed.x += largeEddy * (0.003 + uEnergy * 0.009);
    }

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vLocalPosition = transformed;
    vWorldPosition = worldPosition.xyz;
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fluidFragmentShader = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uOpacity;
  uniform float uCurvature;
  uniform float uLayer;
  uniform float uHueShift;
  uniform float uSurfaceType;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying vec3 vViewDirection;

  float hash(vec3 point) {
    point = fract(point * 0.3183099 + vec3(0.1, 0.2, 0.3));
    point *= 17.0;
    return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
  }

  float noise(vec3 point) {
    vec3 cell = floor(point);
    vec3 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(mix(hash(cell), hash(cell + vec3(1,0,0)), local.x), mix(hash(cell + vec3(0,1,0)), hash(cell + vec3(1,1,0)), local.x), local.y),
      mix(mix(hash(cell + vec3(0,0,1)), hash(cell + vec3(1,0,1)), local.x), mix(hash(cell + vec3(0,1,1)), hash(cell + vec3(1,1,1)), local.x), local.y),
      local.z
    );
  }

  float fbm(vec3 point) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave++) {
      value += noise(point) * amplitude;
      point = point * 2.04 + vec3(1.7, -2.2, 2.8);
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 palette(float value) {
    value = fract(value + uHueShift);
    vec3 deep = vec3(0.06, 0.16, 0.48);
    vec3 blue = vec3(0.10, 0.48, 1.0);
    vec3 cyan = vec3(0.24, 0.94, 0.94);
    vec3 violet = vec3(0.64, 0.25, 1.0);
    vec3 coral = vec3(1.0, 0.42, 0.28);
    if (value < 0.22) return mix(deep, blue, value / 0.22);
    if (value < 0.46) return mix(blue, cyan, (value - 0.22) / 0.24);
    if (value < 0.73) return mix(cyan, violet, (value - 0.46) / 0.27);
    return mix(violet, coral, (value - 0.73) / 0.27);
  }

  void main() {
    float advection = uTime * (0.28 + uEnergy * 1.15);
    vec3 samplePosition = vLocalPosition * vec3(1.65, 3.5, 3.5) + vec3(-advection * 2.3, advection * 0.35, -advection * 0.22);
    float warpA = fbm(samplePosition + vec3(uLayer * 2.1));
    float warpB = fbm(samplePosition * 1.42 + vec3(warpA * 3.2, -warpA * 2.4, warpA * 1.8));
    float microEddy = noise(samplePosition * 4.6 + vec3(-advection * 3.2, advection, warpB * 5.0));
    float ridge = 1.0 - abs(warpB * 2.0 - 1.0);
    ridge *= ridge;
    float contour = pow(max(0.0, 1.0 - abs(sin(vUv.x * 61.0 - advection * 7.4 + vUv.y * 11.0 + warpA * (5.5 + uEnergy * 7.5)))), 8.0);
    float capillary = pow(max(0.0, 1.0 - abs(sin(vUv.x * 137.0 - advection * 15.0 - vUv.y * 23.0 + microEddy * 4.0))), 18.0);
    float density = clamp(warpA * 0.42 + warpB * 0.28 + ridge * 0.2 + contour * 0.17 + microEddy * 0.08, 0.0, 1.0);
    vec3 normal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
    normal = faceforward(normal, -vViewDirection, normal);
    float fresnel = pow(1.0 - clamp(abs(dot(normal, normalize(vViewDirection))), 0.0, 1.0), 2.25);
    vec3 lightDirection = normalize(vec3(-0.32, 0.72, 0.62));
    vec3 halfVector = normalize(lightDirection + normalize(vViewDirection));
    float broadSpecular = pow(max(0.0, dot(normal, halfVector)), 28.0) * (0.32 + density * 0.6);
    float needleSpecular = pow(max(0.0, dot(normal, halfVector)), 110.0) * (0.45 + ridge * 1.1);
    float fieldValue = clamp(density * 0.64 + fresnel * 0.16 + ridge * 0.13 + uEnergy * 0.06, 0.0, 1.0);
    vec3 color = palette(fieldValue);
    vec3 spectralRim = mix(vec3(0.12, 0.62, 1.0), vec3(0.92, 0.25, 1.0), clamp(warpB + uEnergy * 0.22, 0.0, 1.0));
    float layerFactor = mix(0.74, 0.42, clamp(uLayer / 3.0, 0.0, 1.0));
    float alpha = uOpacity * layerFactor * (0.13 + density * 0.47 + fresnel * 0.4 + contour * 0.18 + capillary * 0.09);
    alpha *= 0.72 + uCurvature * 0.34;
    if (uSurfaceType > 1.5 && uSurfaceType < 2.5) {
      alpha *= smoothstep(0.0, 0.045, vUv.x) * smoothstep(1.0, 0.58, vUv.x);
    }
    if (uSurfaceType > 2.5) {
      alpha *= (0.38 + fresnel * 0.82) * (0.55 + uEnergy * 0.45);
      color = mix(vec3(0.18, 0.76, 1.0), vec3(0.58, 0.36, 1.0), warpB);
    }
    vec3 opticalColor = color * (0.34 + density * 0.66 + fresnel * 0.54) + spectralRim * fresnel * (0.18 + uEnergy * 0.16);
    opticalColor += (broadSpecular + needleSpecular + capillary * 0.08) * vec3(0.82, 0.97, 1.0);
    gl_FragColor = vec4(opticalColor, clamp(alpha, 0.0, 0.72));
  }
`;

const tracerVertexShader = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uCurvature;
  uniform float uPixelRatio;
  attribute vec4 aFlow;
  varying vec3 vColor;
  varying float vAlpha;

  float radiusAt(float u) {
    float main = pow(max(0.0, sin(3.14159265 * u)), 0.56);
    float nose = 1.0 - 0.58 * pow(u, 4.4);
    return (0.15 + 0.69 * main) * nose + 0.27 * pow(1.0 - u, 5.2);
  }

  void main() {
    float seed = aFlow.z;
    float zone = aFlow.w;
    float progress = fract(aFlow.x + uTime * (0.018 + uEnergy * 0.07) * (0.7 + seed * 0.6));
    float angle = aFlow.y + sin(progress * 18.0 - uTime * (0.45 + uEnergy * 2.2) + seed * 17.0) * (0.04 + uCurvature * 0.15);
    vec3 transformed;

    if (zone < 0.66) {
      float x = mix(2.72, -2.4, progress);
      float profile = clamp((x + 2.22) / 4.86, 0.0, 1.0);
      float radius = radiusAt(profile) + 0.025 + seed * 0.08;
      transformed = vec3(x, cos(angle) * radius * 0.64, sin(angle) * radius * 0.96);
    } else {
      float lane = floor(seed * 3.0);
      float extent = 3.0 + uEnergy * 4.2;
      float coil = progress * (18.0 + uEnergy * 24.0) - uTime * (0.7 + uEnergy * 3.0) + lane * 2.1;
      float radius = progress * progress * (0.08 + uCurvature * 0.58);
      transformed = vec3(
        -2.08 - progress * extent,
        (lane == 1.0 ? -0.1 : -0.25) + cos(coil) * radius,
        (lane - 1.0) * 0.61 + sin(coil) * radius
      );
    }

    vec4 modelPosition = modelMatrix * vec4(transformed, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = (0.62 + seed * 1.18) * uPixelRatio * (8.5 / max(2.0, -viewPosition.z));
    vColor = mix(vec3(0.22, 0.8, 1.0), vec3(0.82, 0.28, 1.0), clamp(progress * 0.55 + uEnergy * 0.35, 0.0, 1.0));
    vAlpha = smoothstep(0.0, 0.06, progress) * smoothstep(1.0, 0.66, progress) * (0.14 + uEnergy * 0.28) * (0.45 + seed * 0.55);
  }
`;

const tracerFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    float shape = smoothstep(0.5, 0.08, distanceToCenter);
    gl_FragColor = vec4(vColor, vAlpha * shape);
  }
`;

function createFluidMaterial(layer, hueShift, opacityScale = 1, side = THREE.DoubleSide, surfaceType = 0) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uOpacity: { value: Number(opacityInput.value) / 100 * opacityScale },
      uCurvature: { value: Number(curvatureInput.value) / 100 },
      uLayer: { value: layer },
      uHueShift: { value: hueShift },
      uSurfaceType: { value: surfaceType }
    },
    vertexShader: fluidVertexShader,
    fragmentShader: fluidFragmentShader,
    transparent: true,
    depthWrite: false,
    side,
    blending: THREE.NormalBlending
  });
  material.forceSinglePass = true;
  material.userData.opacityScale = opacityScale;
  material.userData.surfaceType = surfaceType;
  fluidMaterials.push(material);
  return material;
}

function createTracers() {
  const positions = new Float32Array(tracerCount * 3);
  const flow = new Float32Array(tracerCount * 4);
  for (let index = 0; index < tracerCount; index += 1) {
    flow[index * 4] = Math.random();
    flow[index * 4 + 1] = Math.random() * Math.PI * 2;
    flow[index * 4 + 2] = Math.random();
    flow[index * 4 + 3] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aFlow", new THREE.BufferAttribute(flow, 4));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(-1.2, 0, 0), 10);
  tracerMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uCurvature: { value: Number(curvatureInput.value) / 100 },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: tracerVertexShader,
    fragmentShader: tracerFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, tracerMaterial);
  points.frustumCulled = false;
  points.renderOrder = 7;
  return points;
}

function createSkeletonLine(points, color = 0x78ddff, opacity = .34) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })
  );
}

function createInnerSkeleton() {
  const group = new THREE.Group();
  const axisCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.05, -.08, 0),
    new THREE.Vector3(-1.1, -.02, 0),
    new THREE.Vector3(-.15, .02, 0),
    new THREE.Vector3(.82, .12, 0),
    new THREE.Vector3(2.28, .02, 0)
  ]);
  const axisMaterial = new THREE.MeshBasicMaterial({ color: 0x9cefff, transparent: true, opacity: .34, blending: THREE.AdditiveBlending, depthWrite: false });
  group.add(new THREE.Mesh(new THREE.TubeGeometry(axisCurve, 180, .012, 7, false), axisMaterial));

  [1, -1].forEach((side) => {
    group.add(createSkeletonLine([
      new THREE.Vector3(.95, -.09, side * .12),
      new THREE.Vector3(-.45, -.11, side * .78),
      new THREE.Vector3(-1.83, -.12, side * 2.08)
    ], side > 0 ? 0x79c7ff : 0xb184ff, .28));
  });

  const reactorMaterial = new THREE.MeshBasicMaterial({ color: 0xe8fdff, transparent: true, opacity: .78, blending: THREE.AdditiveBlending, depthWrite: false });
  const reactor = new THREE.Mesh(new THREE.IcosahedronGeometry(.13, 3), reactorMaterial);
  reactor.position.set(-.34, 0, 0);
  reactor.userData.reactor = true;
  group.add(reactor);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(.38, .012, 7, 72), new THREE.MeshBasicMaterial({ color: 0x9a65ff, transparent: true, opacity: .42, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.rotation.y = Math.PI / 2;
  halo.position.copy(reactor.position);
  halo.scale.y = .65;
  halo.userData.halo = true;
  group.add(halo);

  [-.61, 0, .61].forEach((z, index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(index === 1 ? .22 : .18, .018, 7, 56), new THREE.MeshBasicMaterial({ color: index === 1 ? 0x80efff : 0xa275ff, transparent: true, opacity: .62, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-2.02, index === 1 ? -.1 : -.25, z);
    group.add(ring);
  });

  const canopyGeometry = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * .52);
  const canopyWire = new THREE.LineSegments(new THREE.EdgesGeometry(canopyGeometry, 18), new THREE.LineBasicMaterial({ color: 0x82dfff, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false }));
  canopyWire.scale.set(.92, .27, .46);
  canopyWire.position.set(.76, .28, 0);
  group.add(canopyWire);
  return group;
}

function createFluidVessel() {
  const group = new THREE.Group();
  const bodyGeometry = createBodySurface(lowPower ? 92 : 132, lowPower ? 44 : 66);
  const bodyLayers = lowPower ? 2 : 3;

  for (let layer = 0; layer < bodyLayers; layer += 1) {
    const material = createFluidMaterial(layer, layer * .075, 1 - layer * .14, THREE.DoubleSide, 0);
    const surface = new THREE.Mesh(bodyGeometry, material);
    const expansion = 1 + layer * .045;
    surface.scale.set(1 + layer * .012, expansion, expansion);
    surface.renderOrder = 2 + layer;
    group.add(surface);
  }

  [1, -1].forEach((side, sideIndex) => {
    const wingGeometry = createWingSurface(side, lowPower ? 62 : 92, lowPower ? 18 : 28);
    [0, 1].forEach((layer) => {
      const wing = new THREE.Mesh(wingGeometry, createFluidMaterial(1.4 + layer + sideIndex * .12, side > 0 ? .06 : .16, .8 - layer * .18, THREE.DoubleSide, 1));
      wing.position.y = layer * (side > 0 ? .035 : -.035);
      wing.renderOrder = 4 + layer;
      group.add(wing);
    });

    const wingtipVortex = new THREE.Mesh(
      createWingtipVortexSurface(side),
      createFluidMaterial(2.15 + sideIndex * .2, side > 0 ? .08 : .18, .48, THREE.DoubleSide, 2)
    );
    wingtipVortex.renderOrder = 2;
    wingtipVortex.userData.phase = sideIndex * Math.PI;
    wakeMeshes.push(wingtipVortex);
    group.add(wingtipVortex);
  });

  for (let lane = 0; lane < 3; lane += 1) {
    const wake = new THREE.Mesh(
      createWakeSurface(lane, lowPower ? 92 : 142, lowPower ? 9 : 14),
      createFluidMaterial(2.3 + lane * .22, .12 + lane * .06, .72, THREE.DoubleSide, 2)
    );
    wake.renderOrder = 1;
    wake.userData.phase = lane * 2.1;
    wakeMeshes.push(wake);
    group.add(wake);
  }

  bowShock = new THREE.Mesh(
    new THREE.SphereGeometry(1, lowPower ? 38 : 68, lowPower ? 20 : 36),
    createFluidMaterial(3.45, .055, .34, THREE.DoubleSide, 3)
  );
  bowShock.scale.set(.16, .8, 1.02);
  bowShock.position.set(2.63, .015, 0);
  bowShock.renderOrder = 6;
  group.add(bowShock);

  innerSkeleton = createInnerSkeleton();
  group.add(innerSkeleton);
  group.add(createTracers());
  group.position.set(.54, -.02, 0);
  group.rotation.set(-.04, -.2, -.025);
  return group;
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas: stage, antialias: !lowPower, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.3));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
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
  controls.minDistance = 5.6;
  controls.maxDistance = 13.2;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.3));
  renderer.setSize(width, height, false);
  tracerMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
}

function animate(now) {
  const deltaSeconds = clamp((now - lastTime) / 1000, 0, .05);
  lastTime = now;
  energy += (targetEnergy - energy) * (1 - Math.pow(.0018, deltaSeconds));
  const animatedTime = reducedMotion ? 0 : now / 1000;

  fluidMaterials.forEach((material) => {
    material.uniforms.uTime.value = animatedTime;
    material.uniforms.uEnergy.value = energy;
  });
  tracerMaterial.uniforms.uTime.value = animatedTime;
  tracerMaterial.uniforms.uEnergy.value = energy;

  if (!reducedMotion) {
    const reactor = innerSkeleton.children.find((child) => child.userData.reactor);
    const halo = innerSkeleton.children.find((child) => child.userData.halo);
    if (reactor) {
      reactor.rotation.x = animatedTime * (.42 + energy * .72);
      reactor.rotation.y = animatedTime * (.28 + energy * .58);
      reactor.scale.setScalar(1 + Math.sin(animatedTime * (2.1 + energy * 2.8)) * (.05 + energy * .08));
    }
    if (halo) halo.rotation.x = animatedTime * (.16 + energy * .34);
    wakeMeshes.forEach((wake, index) => {
      wake.rotation.x = Math.sin(animatedTime * (.18 + energy * .34) + wake.userData.phase) * (.025 + energy * .065);
      wake.position.y = Math.sin(animatedTime * .42 + index * 1.8) * .012;
    });
    if (bowShock) {
      const shockPulse = 1 + Math.sin(animatedTime * (1.4 + energy * 1.8)) * (.025 + energy * .045);
      bowShock.scale.set(.16 * shockPulse, .8 * shockPulse, 1.02 * shockPulse);
      bowShock.position.x = 2.63 + Math.sin(animatedTime * .72) * (.006 + energy * .012);
    }
    vessel.position.y = -.02 + Math.sin(animatedTime * .4) * .014;
  }

  if (!reducedMotion && !resettingView && performance.now() - lastInteraction > 6500) controls.autoRotate = true;
  updateViewReset(deltaSeconds);
  controls.update(deltaSeconds);
  renderer.render(scene, camera);
}

function bindInterface() {
  opacityInput.addEventListener("input", () => {
    const value = Number(opacityInput.value);
    const normalized = value / 100;
    fluidMaterials.forEach((material) => { material.uniforms.uOpacity.value = normalized * material.userData.opacityScale; });
    opacityValue.textContent = `${value}%`;
    metricOpacity.textContent = `${value}%`;
  });

  curvatureInput.addEventListener("input", () => {
    const value = Number(curvatureInput.value);
    const normalized = value / 100;
    fluidMaterials.forEach((material) => { material.uniforms.uCurvature.value = normalized; });
    tracerMaterial.uniforms.uCurvature.value = normalized;
    curvatureValue.textContent = `${value}%`;
  });

  wakeButton.addEventListener("click", () => {
    const active = !wakeButton.classList.contains("is-active");
    wakeButton.classList.toggle("is-active", active);
    wakeButton.querySelector("b").textContent = active ? "沉静涡核" : "唤醒涡核";
    renderState.textContent = active ? "高曲率流形" : "低涡量巡航";
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
    metricSurface.textContent = lowPower ? "25K" : "46K";
    metricTracer.textContent = lowPower ? "6K" : "12K";
    setupRenderer();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, .08, 90);
    camera.position.copy(defaultCameraPosition);
    vessel = createFluidVessel();
    scene.add(vessel);
    setupControls();
    bindInterface();
    renderer.setAnimationLoop(animate);
    lab.classList.add("is-ready");
  } catch (error) {
    console.error("Fluid phantom lab failed to initialize", error);
    fallback.hidden = false;
    stage.hidden = true;
  }
}

initialize();
