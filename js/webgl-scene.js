/**
 * Curruscos · WebGL editorial stage
 * Three.js scene: compact Antikythera-inspired armillary mechanism.
 * Progressive enhancement: the page/feed remains usable if WebGL or the CDN fails.
 */
(function () {
  "use strict";

  function init() {
    const canvas = document.getElementById("webgl-stage-canvas");
    const stage = document.querySelector(".webgl-hero-stage");
    if (!canvas || !stage || !window.THREE || !window.WebGLRenderingContext) return;

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

    const geometry = new THREE.SphereGeometry(0.52, isSmall ? 24 : 36, isSmall ? 18 : 28);
    const position = geometry.attributes.position;
    const original = new Float32Array(position.array);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb7863b,
      metalness: 0.94,
      roughness: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
      emissive: 0x3d2107,
      emissiveIntensity: 0.18
    });
    const core = new THREE.Mesh(geometry, coreMaterial);
    sculpture.add(core);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xd7a95c, metalness: 0.92, roughness: 0.28,
      side: THREE.DoubleSide, depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.024, 8, 128), ringMaterial);
    ring.rotation.set(1.0, 0.3, 0.18);
    sculpture.add(ring);

    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.22, 0.018, 8, 112),
      new THREE.MeshPhysicalMaterial({ color: 0xc7c9d1, metalness: 0.92, roughness: 0.3, clearcoat: 0.7 })
    );
    innerRing.rotation.set(0.28, 0.85, 0.42);
    sculpture.add(innerRing);

    const tickGroup = new THREE.Group();
    ring.add(tickGroup);
    const tickGeometry = new THREE.BoxGeometry(0.018, 0.12, 0.025);
    const tickMaterial = new THREE.MeshBasicMaterial({ color: 0xf0cf8b });
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const tick = new THREE.Mesh(tickGeometry, tickMaterial);
      tick.position.set(Math.cos(angle) * 1.69, Math.sin(angle) * 1.69, 0);
      tick.rotation.z = angle;
      tickGroup.add(tick);
    }

    const handGroup = new THREE.Group();
    sculpture.add(handGroup);
    const handMaterial = new THREE.MeshBasicMaterial({ color: 0xff642e });
    const longHand = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.018, 0.025), handMaterial);
    longHand.position.x = 0.48;
    handGroup.add(longHand);
    const shortHand = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.026, 0.03), new THREE.MeshBasicMaterial({ color: 0xe3d3b3 }));
    shortHand.position.x = 0.31;
    shortHand.rotation.z = 1.05;
    handGroup.add(shortHand);

    const secondRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.95, 0.012, 7, 128),
      new THREE.MeshPhysicalMaterial({ color: 0x77716a, metalness: 0.9, roughness: 0.34, transparent: true, opacity: 0.9, depthWrite: false })
    );
    secondRing.rotation.set(0.4, 1.0, 0.7);
    sculpture.add(secondRing);

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
      currentX += (targetX - currentX) * 0.045;
      currentY += (targetY - currentY) * 0.045;

      if (!reducedMotion) {
        const p = position.array;
        for (let i = 0; i < p.length; i += 3) {
          const ox = original[i], oy = original[i + 1], oz = original[i + 2];
          const wave = Math.sin(ox * 2.15 + t * 1.1) * Math.cos(oy * 2.0 - t * 0.9) * 0.045;
          p[i] = ox + ox * wave;
          p[i + 1] = oy + oy * wave;
          p[i + 2] = oz + oz * wave;
        }
        position.needsUpdate = true;
        geometry.computeVertexNormals();
        core.rotation.y = t * 0.15 + currentX * 0.3;
        core.rotation.x = t * 0.11 - currentY * 0.25;
        ring.rotation.z = t * -0.12;
        secondRing.rotation.x = 0.4 + Math.sin(t * 0.18) * 0.12;
        innerRing.rotation.z = 0.42 + Math.sin(t * 0.16) * 0.08;
        handGroup.rotation.z = t * 0.12;
      } else {
        core.rotation.y = currentX * 0.12;
        core.rotation.x = -currentY * 0.12;
        handGroup.rotation.z = 0.2;
      }

      sculpture.rotation.y += ((currentX * 0.12) - sculpture.rotation.y) * 0.035;
      sculpture.rotation.x += ((-currentY * 0.08) - sculpture.rotation.x) * 0.035;
      orangeLight.position.x = 3 + currentX * 1.8;
      orangeLight.position.y = 2 + currentY * 1.4;

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
