/**
 * Curruscos · WebGL editorial stage
 * Three.js scene: organic metallic core, orbital HUD, floating crystal fragments.
 * Progressive enhancement: the page/feed remains usable if WebGL or the CDN fails.
 */
(function () {
  "use strict";

  function init() {
    const canvas = document.getElementById("webgl-stage-canvas");
    const stage = document.querySelector(".webgl-hero-stage");
    if (!canvas || !stage) return;
    try {
      const visualPrefs = JSON.parse(localStorage.getItem("curruscos_visual_preferences") || "{}");
      if (visualPrefs.webgl === false) {
        canvas.style.display = "none";
        stage.classList.add("webgl-disabled");
        return;
      }
    } catch (_) {}
    if (!window.THREE || !window.WebGLRenderingContext) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isSmall = window.matchMedia("(max-width: 680px)").matches;
    const THREE = window.THREE;
    let renderer;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: !isSmall,
        powerPreference: "low-power"
      });
    } catch (_) {
      stage.classList.add("webgl-unavailable");
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(0, 0, 7.3);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.35 : 1.8));
    renderer.setClearColor(0x000000, 0);
    if ("ACESFilmicToneMapping" in THREE) renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const sculpture = new THREE.Group();
    scene.add(sculpture);

    const geometry = new THREE.TorusKnotGeometry(1.18, 0.34, isSmall ? 88 : 128, 18, 2, 3);
    const position = geometry.attributes.position;
    const original = new Float32Array(position.array);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x262630,
      metalness: 0.88,
      roughness: 0.19,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      emissive: 0x3d1607,
      emissiveIntensity: 0.28
    });
    const core = new THREE.Mesh(geometry, coreMaterial);
    sculpture.add(core);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff642e, transparent: true, opacity: 0.62,
      side: THREE.DoubleSide, depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.006, 6, 150), ringMaterial);
    ring.rotation.set(1.0, 0.3, 0.18);
    sculpture.add(ring);

    const secondRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.3, 0.003, 5, 128),
      new THREE.MeshBasicMaterial({ color: 0x7776ff, transparent: true, opacity: 0.48, depthWrite: false })
    );
    secondRing.rotation.set(0.4, 1.0, 0.7);
    sculpture.add(secondRing);

    const shardGroup = new THREE.Group();
    sculpture.add(shardGroup);
    const shardGeometry = new THREE.OctahedronGeometry(0.13, 0);
    const shardMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdfe4ff, metalness: 0.34, roughness: 0.12,
      clearcoat: 1, transparent: true, opacity: 0.9
    });
    const shards = [];
    const shardCount = isSmall ? 9 : 18;
    for (let i = 0; i < shardCount; i++) {
      const mesh = new THREE.Mesh(shardGeometry, shardMaterial);
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const radius = 2.35 + Math.random() * 1.05;
      mesh.position.set(
        Math.cos(theta) * Math.cos(phi) * radius,
        Math.sin(phi) * radius * 0.72,
        Math.sin(theta) * Math.cos(phi) * radius
      );
      const scale = 0.5 + Math.random() * 1.2;
      mesh.scale.set(scale * 0.8, scale * 1.35, scale * 0.65);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      shardGroup.add(mesh);
      shards.push({
        mesh,
        x: (Math.random() - 0.5) * 0.012,
        y: (Math.random() - 0.5) * 0.014,
        phase: Math.random() * Math.PI * 2,
        baseY: mesh.position.y
      });
    }

    scene.add(new THREE.AmbientLight(0xffffff, 1.25));
    const orangeLight = new THREE.PointLight(0xff5a1f, 27, 18);
    orangeLight.position.set(3, 2, 4);
    scene.add(orangeLight);
    const coolLight = new THREE.PointLight(0x625eff, 19, 18);
    coolLight.position.set(-4, -2, -3);
    scene.add(coolLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(1, 5, 6);
    scene.add(keyLight);

    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    let pointerActive = false;
    let frame = 0;
    let visible = true;
    const clock = new THREE.Clock();
    let audioIntensity = 0;
    let targetAudioIntensity = 0;

    // Public bridge used by the optional microphone / touch-reactive controller.
    window.WebGLStage = {
      setAudioIntensity(value) {
        targetAudioIntensity = Math.max(0, Math.min(1, Number(value) || 0));
      }
    };

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      if (!frame) renderStatic();
    }

    function renderStatic() {
      renderer.render(scene, camera);
    }

    stage.addEventListener("pointermove", function (event) {
      if (event.pointerType === "touch") return;
      const rect = stage.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      targetY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      pointerActive = true;
      const coords = document.getElementById("hud-live-coords");
      if (coords) coords.textContent = "X:" + targetX.toFixed(2) + " / Y:" + targetY.toFixed(2) + " / WEBGL: ON";
    }, { passive: true });
    stage.addEventListener("pointerleave", function () {
      pointerActive = false;
      targetX = 0;
      targetY = 0;
    }, { passive: true });

    function animate() {
      frame = 0;
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      audioIntensity += (targetAudioIntensity - audioIntensity) * 0.16;
      currentX += (targetX - currentX) * 0.045;
      currentY += (targetY - currentY) * 0.045;

      if (!reducedMotion) {
        const p = position.array;
        for (let i = 0; i < p.length; i += 3) {
          const ox = original[i], oy = original[i + 1], oz = original[i + 2];
          const wave = Math.sin(ox * 2.15 + t * (1.1 + audioIntensity * 2.1)) * Math.cos(oy * 2.0 - t * (0.9 + audioIntensity * 1.7)) * (0.045 + audioIntensity * 0.065);
          p[i] = ox + ox * wave;
          p[i + 1] = oy + oy * wave;
          p[i + 2] = oz + oz * wave;
        }
        position.needsUpdate = true;
        geometry.computeVertexNormals();
        core.rotation.y = t * (0.15 + audioIntensity * 0.42) + currentX * 0.3;
        core.rotation.x = t * (0.11 + audioIntensity * 0.3) - currentY * 0.25;
        ring.rotation.z = t * (-0.12 - audioIntensity * 0.55);
        secondRing.rotation.x = 0.4 + Math.sin(t * (0.18 + audioIntensity * 0.7)) * (0.12 + audioIntensity * 0.2);
        shards.forEach(function (shard) {
          shard.mesh.rotation.x += shard.x;
          shard.mesh.rotation.y += shard.y;
          shard.mesh.position.y = shard.baseY + Math.sin(t * 0.6 + shard.phase) * 0.12;
        });
      } else {
        core.rotation.y = currentX * 0.12;
        core.rotation.x = -currentY * 0.12;
      }

      sculpture.rotation.y += ((currentX * 0.12) - sculpture.rotation.y) * 0.035;
      sculpture.rotation.x += ((-currentY * 0.08) - sculpture.rotation.x) * 0.035;
      orangeLight.position.x = 3 + currentX * 1.8;
      orangeLight.position.y = 2 + currentY * 1.4;
      orangeLight.intensity = 27 + audioIntensity * 18;

      const scrollProgress = Math.min(1, window.scrollY / Math.max(1, stage.offsetHeight));
      sculpture.position.y = -scrollProgress * 0.35;
      camera.position.z = 7.3 + scrollProgress * 0.45;
      renderer.render(scene, camera);

      if (!reducedMotion || pointerActive) frame = window.requestAnimationFrame(animate);
    }

    function start() {
      if (!frame && visible && !document.hidden) frame = window.requestAnimationFrame(animate);
    }
    document.addEventListener("visibilitychange", function () {
      visible = !document.hidden;
      if (visible) start();
      else if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    window.addEventListener("scroll", function () {
      if (!reducedMotion) start();
    }, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
    resize();
    if (reducedMotion) renderStatic();
    else start();
    stage.classList.add("webgl-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
