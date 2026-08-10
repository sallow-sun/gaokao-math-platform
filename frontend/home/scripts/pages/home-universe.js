(async () => {
const sceneRoot = document.querySelector("#home-universe-scene");
const heroVisual = document.querySelector("#formula-universe");
const statusLabel = document.querySelector(".universe-status");

if (sceneRoot && heroVisual) {
  try {
    const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const processorCount = navigator.hardwareConcurrency || 8;
    const memory = navigator.deviceMemory || 8;
    const lowPower = coarsePointer || processorCount <= 4 || memory <= 4;
    const particleCount = lowPower ? 780 : 1900;
    const starCount = lowPower ? 90 : 180;
    const targetFrameDuration = 1000 / (lowPower ? 24 : 30);
    const pixelRatioLimit = lowPower ? 1 : 1.45;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070919, 0.018);

    const camera = new THREE.PerspectiveCamera(38, 1, .1, 250);
    camera.position.set(0, 12.5, 39);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !lowPower,
      powerPreference: lowPower ? "default" : "high-performance"
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioLimit));
    sceneRoot.append(renderer.domElement);

    const universe = new THREE.Group();
    universe.rotation.z = -.05;
    scene.add(universe);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, lowPower ? 32 : 54, lowPower ? 24 : 40),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    universe.add(core);

    const auraMaterial = new THREE.ShaderMaterial({
      uniforms: {
        intensity: { value: 1.08 },
        pulse: { value: 0 }
      },
      vertexShader: `
        varying vec3 normalView;
        varying vec3 viewDirection;
        void main() {
          normalView = normalize(normalMatrix * normal);
          viewDirection = normalize(-(modelViewMatrix * vec4(position, 1.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float intensity;
        uniform float pulse;
        varying vec3 normalView;
        varying vec3 viewDirection;
        void main() {
          float rim = pow(1.0 - max(dot(normalView, viewDirection), 0.0), 3.6);
          vec3 amber = vec3(1.0, 0.49, 0.13);
          vec3 whiteHot = vec3(1.0, 0.92, 0.76);
          vec3 color = mix(amber, whiteHot, rim * 0.55 + pulse * 0.25);
          gl_FragColor = vec4(color * rim * intensity * (4.5 + pulse * 2.0), rim);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    universe.add(new THREE.Mesh(new THREE.SphereGeometry(3.62, lowPower ? 32 : 54, lowPower ? 24 : 40), auraMaterial));

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const warm = new THREE.Color(0xff9f42);
    const hot = new THREE.Color(0xfff3db);
    const cool = new THREE.Color(0x436be0);

    for (let index = 0; index < particleCount; index += 1) {
      const radius = 4.2 + Math.pow(Math.random(), 1.55) * 25;
      const angle = Math.random() * Math.PI * 2;
      const thickness = (Math.random() - .5) * (.16 + radius * .011);
      const offset = index * 3;
      positions[offset] = Math.cos(angle) * radius;
      positions[offset + 1] = thickness;
      positions[offset + 2] = Math.sin(angle) * radius;

      const distanceMix = Math.min(1, (radius - 4.2) / 21);
      const color = hot.clone()
        .lerp(warm, Math.min(1, distanceMix * 1.5))
        .lerp(cool, Math.max(0, distanceMix - .6) * 1.3);
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
      sizes[index] = .52 + Math.random() * 1.2;
    }

    const diskGeometry = new THREE.BufferGeometry();
    diskGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    diskGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    diskGeometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));

    const diskMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pulse: { value: 0 },
        pixelScale: { value: renderer.getPixelRatio() * 2.15 }
      },
      vertexShader: `
        uniform float time;
        uniform float pulse;
        uniform float pixelScale;
        attribute float pointSize;
        varying vec3 particleColor;
        varying float particleAlpha;
        void main() {
          vec3 p = position;
          float radius = length(p.xz);
          float startAngle = atan(p.z, p.x);
          float orbitSpeed = 0.2 + 1.35 / sqrt(radius);
          float angle = startAngle + time * orbitSpeed;
          float compression = 1.0 - pulse * 0.16;
          p.x = cos(angle) * radius * compression;
          p.z = sin(angle) * radius * compression;
          p.y += sin(angle * 3.0 + radius * .7 + time * .4) * (.035 + radius * .0025);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = max(1.0, pixelScale * pointSize * (31.0 / -mvPosition.z));
          particleColor = color * (1.0 + pulse * .65);
          particleAlpha = smoothstep(3.8, 5.0, radius) * (1.0 - smoothstep(25.0, 30.0, radius));
        }
      `,
      fragmentShader: `
        varying vec3 particleColor;
        varying float particleAlpha;
        void main() {
          float distanceToCenter = distance(gl_PointCoord, vec2(.5));
          if (distanceToCenter > .5) discard;
          float glow = smoothstep(.5, .03, distanceToCenter);
          gl_FragColor = vec4(particleColor, glow * particleAlpha * .88);
        }
      `,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const disk = new THREE.Points(diskGeometry, diskMaterial);
    universe.add(disk);

    function createSymbolTexture(symbol) {
      const symbolCanvas = document.createElement("canvas");
      symbolCanvas.width = 96;
      symbolCanvas.height = 96;
      const symbolContext = symbolCanvas.getContext("2d");
      symbolContext.clearRect(0, 0, 96, 96);
      symbolContext.fillStyle = "#fff1d7";
      symbolContext.textAlign = "center";
      symbolContext.textBaseline = "middle";
      symbolContext.font = "italic 44px Georgia, serif";
      symbolContext.fillText(symbol, 48, 51);
      const texture = new THREE.CanvasTexture(symbolCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const symbolGroup = new THREE.Group();
    const symbolValues = lowPower ? ["∫", "∑", "π", "∞", "√"] : ["∫", "∑", "π", "∞", "√", "Δ", "θ", "e"];
    symbolValues.forEach((symbol, index) => {
      const material = new THREE.SpriteMaterial({
        map: createSymbolTexture(symbol),
        color: index % 3 === 0 ? 0xffd392 : 0xbec9ff,
        transparent: true,
        opacity: .42,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      const radius = 8 + index * 1.8;
      const angle = index / symbolValues.length * Math.PI * 2;
      sprite.position.set(Math.cos(angle) * radius, (index % 3 - 1) * 1.4, Math.sin(angle) * radius);
      const scale = 1 + index % 3 * .18;
      sprite.scale.set(scale, scale, 1);
      sprite.userData = { radius, angle, speed: .09 + index % 4 * .018 };
      symbolGroup.add(sprite);
    });
    universe.add(symbolGroup);

    const starPositions = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      const radius = 38 + Math.random() * 55;
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - .5) * 42;
      starPositions[index * 3] = Math.cos(angle) * radius;
      starPositions[index * 3 + 1] = height;
      starPositions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starField = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xaebce8, size: .09, transparent: true, opacity: .35 }));
    scene.add(starField);

    let width = 1;
    let height = 1;
    let visible = true;
    let documentVisible = !document.hidden;
    let pointerX = 0;
    let pointerY = 0;
    let targetPointerX = 0;
    let targetPointerY = 0;
    let simulationTime = 0;
    let lastFrame = performance.now();
    let lastRender = 0;
    let searchPulseStarted = 0;

    function resize() {
      const rect = sceneRoot.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioLimit));
      diskMaterial.uniforms.pixelScale.value = renderer.getPixelRatio() * 2.15;
      renderer.render(scene, camera);
    }

    function renderFrame(now) {
      window.requestAnimationFrame(renderFrame);
      if (!visible || !documentVisible) {
        lastFrame = now;
        return;
      }
      if (!reduceMotion && now - lastRender < targetFrameDuration) return;

      const delta = Math.min((now - lastFrame) / 1000, .08);
      lastFrame = now;
      lastRender = now;
      const searchFocused = heroVisual.closest(".hero")?.classList.contains("search-active");
      simulationTime += reduceMotion ? 0 : delta * (searchFocused ? .38 : 1);

      let pulse = 0;
      if (searchPulseStarted) {
        const progress = Math.min(1, (now - searchPulseStarted) / 900);
        pulse = Math.sin(progress * Math.PI);
        if (progress >= 1) searchPulseStarted = 0;
      }
      diskMaterial.uniforms.time.value = simulationTime;
      diskMaterial.uniforms.pulse.value = pulse;
      auraMaterial.uniforms.pulse.value = pulse;
      auraMaterial.uniforms.intensity.value = 1.04 + Math.sin(simulationTime * 1.2) * .08 + pulse * .55;

      pointerX += (targetPointerX - pointerX) * .055;
      pointerY += (targetPointerY - pointerY) * .055;
      camera.position.x = pointerX * 2.2;
      camera.position.y = 12.5 - pointerY * 1.2;
      camera.lookAt(0, 0, 0);
      universe.rotation.y += reduceMotion ? 0 : delta * .035;
      universe.scale.setScalar(1 - pulse * .1);

      symbolGroup.children.forEach((sprite) => {
        const data = sprite.userData;
        const angle = data.angle + simulationTime * data.speed;
        sprite.position.x = Math.cos(angle) * data.radius;
        sprite.position.z = Math.sin(angle) * data.radius;
        sprite.material.opacity = .28 + (Math.sin(simulationTime * 1.6 + data.angle) + 1) * .1 + pulse * .2;
      });

      renderer.render(scene, camera);
    }

    heroVisual.addEventListener("pointermove", (event) => {
      const rect = heroVisual.getBoundingClientRect();
      targetPointerX = (event.clientX - rect.left) / rect.width - .5;
      targetPointerY = (event.clientY - rect.top) / rect.height - .5;
    });
    heroVisual.addEventListener("pointerleave", () => { targetPointerX = 0; targetPointerY = 0; });
    window.addEventListener("mathverse:search", () => { searchPulseStarted = performance.now(); });
    document.addEventListener("visibilitychange", () => { documentVisible = !document.hidden; });

    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    }, { threshold: .02 });
    observer.observe(heroVisual);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(sceneRoot);
    resize();
    renderer.render(scene, camera);
    heroVisual.classList.add("webgl-ready");
    statusLabel?.classList.add("online");
    window.requestAnimationFrame(renderFrame);
  } catch (error) {
    heroVisual.classList.add("webgl-fallback");
    if (statusLabel) statusLabel.lastChild.textContent = " STATIC UNIVERSE";
  }
}
})();
