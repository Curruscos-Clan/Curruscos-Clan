/**
 * Curruscos · Interactive 3D Chess Knight (Caballo de Ajedrez)
 * Procedural 3D sculpture rendered with Three.js.
 * Progressive enhancement: the page and real event feed work without WebGL.
 */
(function () {
  "use strict";

  const CAT_PRESETS = {
    todas:       { speed: 0.18, accent: 0x0071e3 },
    deporte:     { speed: 0.34, accent: 0x34c759 },
    ocio:        { speed: 0.16, accent: 0xaf52de },
    viajes:      { speed: 0.12, accent: 0x5856d6 },
    videojuegos: { speed: 0.42, accent: 0xff9500 }
  };

  const WebGLStage = {
    current: { ...CAT_PRESETS.todas },
    target: { ...CAT_PRESETS.todas },
    init() {
      const canvas = document.getElementById("webgl-stage-canvas");
      const stage = document.querySelector(".webgl-hero-stage");
      const THREE = window.THREE;
      if (!canvas || !stage || !THREE || !window.WebGLRenderingContext || this.initialized) return;
      this.initialized = true;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const small = window.matchMedia("(max-width: 680px)").matches;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas, alpha: true, antialias: !small,
          powerPreference: "low-power", stencil: false, depth: true
        });
      } catch (_) {
        stage.classList.add("webgl-unavailable");
        this.initialized = false;
        return;
      }

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
      camera.position.set(0, 0.1, 5.8);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.2 : 1.5));
      renderer.setClearColor(0x000000, 0);
      if ("ACESFilmicToneMapping" in THREE) renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;

      const artifact = new THREE.Group();
      // Refined proportional scale (~35% reduction so it breathes elegantly in the hero viewport)
      artifact.scale.set(0.66, 0.66, 0.66);
      scene.add(artifact);

      // Materials: Premium Apple dark titanium with high specular reflectivity
      const knightMaterial = new THREE.MeshStandardMaterial({
        color: 0x22242a,
        metalness: 0.85,
        roughness: 0.20
      });

      const accentMaterial = new THREE.MeshStandardMaterial({
        color: 0x0071e3,
        metalness: 0.90,
        roughness: 0.15
      });

      const goldTrimMaterial = new THREE.MeshStandardMaterial({
        color: 0xe5a93c,
        metalness: 0.88,
        roughness: 0.25
      });

      const disposableGeometries = [];
      const disposableMaterials = new Set([knightMaterial, accentMaterial, goldTrimMaterial]);

      const addMesh = (geometry, material, parent = artifact) => {
        disposableGeometries.push(geometry);
        disposableMaterials.add(material);
        const mesh = new THREE.Mesh(geometry, material);
        parent.add(mesh);
        return mesh;
      };

      // 1. Turned Staunton Pedestal Base
      const basePoints = [
        new THREE.Vector2(0, -1.20),
        new THREE.Vector2(0.82, -1.20),
        new THREE.Vector2(0.82, -1.08),
        new THREE.Vector2(0.72, -0.96),
        new THREE.Vector2(0.75, -0.85),
        new THREE.Vector2(0.60, -0.68),
        new THREE.Vector2(0.46, -0.22),
        new THREE.Vector2(0.55, -0.04),
        new THREE.Vector2(0.50, 0.08),
        new THREE.Vector2(0.00, 0.08)
      ];
      const baseGeo = new THREE.LatheGeometry(basePoints, 64);
      addMesh(baseGeo, knightMaterial);

      // Pedestal accent ring
      const ringGeo = new THREE.TorusGeometry(0.54, 0.02, 16, 64);
      const ringMesh = addMesh(ringGeo, goldTrimMaterial);
      ringMesh.position.y = -0.04;
      ringMesh.rotation.x = Math.PI / 2;

      // Base bottom ring
      const bottomRingGeo = new THREE.TorusGeometry(0.76, 0.022, 16, 64);
      const bottomRingMesh = addMesh(bottomRingGeo, accentMaterial);
      bottomRingMesh.position.y = -0.90;
      bottomRingMesh.rotation.x = Math.PI / 2;

      // 2. Sculpted Staunton Knight Head & Neck
      const knightShape = new THREE.Shape();
      knightShape.moveTo(-0.38, 0.08);
      knightShape.bezierCurveTo(-0.46, 0.38, -0.52, 0.76, -0.38, 1.10); // Mane crest
      knightShape.lineTo(-0.36, 1.36); // Back ear base
      knightShape.lineTo(-0.26, 1.68); // Ear tip 1
      knightShape.lineTo(-0.16, 1.42); // Ear notch
      knightShape.lineTo(-0.06, 1.64); // Ear tip 2
      knightShape.lineTo(0.04, 1.36);  // Forehead
      knightShape.bezierCurveTo(0.16, 1.14, 0.34, 0.88, 0.50, 0.64); // Nose bridge
      knightShape.bezierCurveTo(0.54, 0.50, 0.44, 0.38, 0.32, 0.40); // Muzzle
      knightShape.bezierCurveTo(0.14, 0.32, 0.02, 0.22, -0.14, 0.08); // Throat
      knightShape.closePath();

      const extrudeSettings = {
        depth: 0.40,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 2,
        bevelSize: 0.045,
        bevelThickness: 0.045,
        curveSegments: 24
      };

      const headGeo = new THREE.ExtrudeGeometry(knightShape, extrudeSettings);
      headGeo.center();

      const headMesh = addMesh(headGeo, knightMaterial);
      headMesh.position.set(-0.02, 0.84, 0);

      // Eyes (Left & Right)
      const eyeGeo = new THREE.SphereGeometry(0.055, 16, 12);
      eyeGeo.scale(1.4, 0.8, 1);

      const leftEye = addMesh(eyeGeo, accentMaterial, headMesh);
      leftEye.position.set(0.14, 0.28, 0.21);
      leftEye.rotation.y = 0.3;

      const rightEye = addMesh(eyeGeo, accentMaterial, headMesh);
      rightEye.position.set(0.14, 0.28, -0.21);
      rightEye.rotation.y = -0.3;

      // Nostril Details
      const nostrilGeo = new THREE.SphereGeometry(0.038, 12, 10);
      const leftNostril = addMesh(nostrilGeo, goldTrimMaterial, headMesh);
      leftNostril.position.set(0.34, 0.02, 0.10);

      const rightNostril = addMesh(nostrilGeo, goldTrimMaterial, headMesh);
      rightNostril.position.set(0.34, 0.02, -0.10);

      // Mane Ridge Locks
      const maneLockGeo = new THREE.ConeGeometry(0.07, 0.20, 12);
      for (let i = 0; i < 5; i++) {
        const lock = addMesh(maneLockGeo, goldTrimMaterial, headMesh);
        const progress = i / 4;
        lock.position.set(-0.38 - progress * 0.03, 0.20 + progress * 0.42, 0);
        lock.rotation.z = Math.PI / 2.5 + progress * 0.2;
      }

      // 3. Floating Dust / Light Particles
      const dustCount = small ? 18 : 36;
      const dustPositions = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        dustPositions[i * 3] = (Math.random() - 0.5) * 3.4;
        dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 2.6;
        dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
      }
      const dustGeometry = new THREE.BufferGeometry();
      dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
      disposableGeometries.push(dustGeometry);

      const dustMaterial = new THREE.PointsMaterial({
        color: 0x0071e3,
        size: small ? 0.012 : 0.018,
        transparent: true,
        opacity: 0.32,
        depthWrite: false
      });
      disposableMaterials.add(dustMaterial);

      const dust = new THREE.Points(dustGeometry, dustMaterial);
      scene.add(dust);

      // Lighting Setup
      scene.add(new THREE.AmbientLight(0xffffff, 1.15));

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
      keyLight.position.set(-3, 4, 5);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xa0c8ff, 1.2);
      fillLight.position.set(3, -2, -2);
      scene.add(fillLight);

      const rimLight = new THREE.PointLight(0x0071e3, 5.0, 10);
      rimLight.position.set(1.8, 1.5, 2.5);
      scene.add(rimLight);

      let pointerX = 0, pointerY = 0, smoothX = 0, smoothY = 0;
      let frame = 0, visible = true, disposed = false;
      const clock = new THREE.Clock();

      function resize() {
        if (disposed) return;
        const w = Math.max(1, stage.clientWidth);
        const h = Math.max(1, stage.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        if (!frame) renderer.render(scene, camera);
      }

      function tick() {
        frame = 0;
        if (disposed || !visible || document.hidden) return;
        const delta = Math.min(clock.getDelta(), 0.04);
        const t = clock.elapsedTime;

        smoothX += (pointerX - smoothX) * 0.06;
        smoothY += (pointerY - smoothY) * 0.06;

        if (!reducedMotion) {
          // Interactive rotation & gentle floating bobbing
          artifact.rotation.y += (smoothX * 0.6 + t * 0.2 - artifact.rotation.y) * 0.04;
          artifact.rotation.x += ((-smoothY * 0.2 + 0.08) - artifact.rotation.x) * 0.04;
          artifact.position.y = Math.sin(t * 1.5) * 0.05 - 0.05;

          dust.rotation.y = t * 0.015;
          const positions = dust.geometry.attributes.position.array;
          for (let i = 1; i < positions.length; i += 3) {
            positions[i] -= delta * 0.02;
            if (positions[i] < -1.6) positions[i] = 1.6;
          }
          dust.geometry.attributes.position.needsUpdate = true;
        }

        renderer.render(scene, camera);
        if (!reducedMotion) frame = window.requestAnimationFrame(tick);
      }

      function start() {
        if (!frame && visible && !document.hidden && !disposed && !reducedMotion) frame = window.requestAnimationFrame(tick);
      }

      function stop() {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
      }

      const onPointerMove = (event) => {
        if (event.pointerType === "touch") return;
        const rect = stage.getBoundingClientRect();
        pointerX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
        pointerY = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
      };

      const onPointerLeave = () => { pointerX = 0; pointerY = 0; };

      const onVisibility = () => {
        visible = !document.hidden;
        if (visible) { renderer.render(scene, camera); start(); } else stop();
      };

      stage.addEventListener("pointermove", onPointerMove, { passive: true });
      stage.addEventListener("pointerleave", onPointerLeave, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);

      let resizeObserver;
      if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(stage);
      } else {
        window.addEventListener("resize", resize, { passive: true });
      }

      let intersectionObserver;
      if ("IntersectionObserver" in window) {
        intersectionObserver = new IntersectionObserver((entries) => {
          visible = entries[0].isIntersecting;
          if (visible) { renderer.render(scene, camera); start(); } else stop();
        }, { threshold: 0.01 });
        intersectionObserver.observe(stage);
      }

      const onPageHide = () => this.destroy();
      window.addEventListener("pagehide", onPageHide, { once: true });

      this.morphToCategory = (cat) => {
        const preset = CAT_PRESETS[cat] || CAT_PRESETS.todas;
        this.target = { ...preset };
        accentMaterial.color.setHex(preset.accent);
        dustMaterial.color.setHex(preset.accent);
        rimLight.color.setHex(preset.accent);
      };

      this.destroy = () => {
        if (disposed) return;
        disposed = true;
        stop();
        stage.removeEventListener("pointermove", onPointerMove);
        stage.removeEventListener("pointerleave", onPointerLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pagehide", onPageHide);
        if (resizeObserver) resizeObserver.disconnect();
        else window.removeEventListener("resize", resize);
        if (intersectionObserver) intersectionObserver.disconnect();
        disposableGeometries.forEach((geometry) => geometry.dispose());
        disposableMaterials.forEach((material) => material.dispose());
        renderer.dispose();
        stage.classList.remove("webgl-ready");
        this.initialized = false;
      };

      resize();
      renderer.render(scene, camera);
      if (!reducedMotion) start();
      stage.classList.add("webgl-ready");
    },
    morphToCategory(cat) {
      const preset = CAT_PRESETS[cat] || CAT_PRESETS.todas;
      this.target = { ...preset };
    }
  };

  window.WebGLStage = WebGLStage;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => WebGLStage.init(), { once: true });
  } else {
    WebGLStage.init();
  }
})();
