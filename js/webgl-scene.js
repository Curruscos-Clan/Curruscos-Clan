/**
 * Curruscos · Obsidian / liquid titanium kinetic sculpture
 * Procedural 3D sculpture rendered with Three.js.
 * Progressive enhancement: the page and real event feed work without WebGL.
 */
(function () {
  "use strict";

  const CAT_PRESETS = {
    todas:       { speed: 0.18, accent: 0xd6b58a },
    deporte:     { speed: 0.25, accent: 0xb9c5b5 },
    ocio:        { speed: 0.17, accent: 0xd0c1ad },
    viajes:      { speed: 0.12, accent: 0xa8b4c3 },
    videojuegos: { speed: 0.3, accent: 0xc6b6a1 }
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
      camera.position.set(0, 0.1, 5.2);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.2 : 1.5));
      renderer.setClearColor(0x000000, 0);
      if ("ACESFilmicToneMapping" in THREE) renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;

      const artifact = new THREE.Group();
      scene.add(artifact);

      // Procedural studio environment: luminous panels provide reflections on the metal.
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x08080a);
      const panelGeo = new THREE.PlaneGeometry(5.5, 2.2);
      const panelMaterials = [
        new THREE.MeshBasicMaterial({ color: 0xf4f0e8, side: THREE.DoubleSide }),
        new THREE.MeshBasicMaterial({ color: 0xb4c0d0, side: THREE.DoubleSide }),
        new THREE.MeshBasicMaterial({ color: 0xd6b58a, side: THREE.DoubleSide })
      ];
      const panelA = new THREE.Mesh(panelGeo, panelMaterials[0]);
      panelA.position.set(0, 4, 1);
      envScene.add(panelA);
      const panelB = new THREE.Mesh(panelGeo, panelMaterials[1]);
      panelB.position.set(-4, 0, -2);
      panelB.rotation.y = Math.PI / 2;
      envScene.add(panelB);
      const panelC = new THREE.Mesh(panelGeo, panelMaterials[2]);
      panelC.position.set(4, -1, 1);
      panelC.rotation.y = -Math.PI / 2;
      envScene.add(panelC);
      const pmrem = new THREE.PMREMGenerator(renderer);
      let envMap = null;
      try { envMap = pmrem.fromScene(envScene, 0.04).texture; } catch (_) {}
      pmrem.dispose();
      panelGeo.dispose();
      panelMaterials.forEach((material) => material.dispose());
      if (envMap) scene.environment = envMap;

      const titaniumDark = new THREE.MeshStandardMaterial({
        color: 0x202126, metalness: 0.96, roughness: 0.2, envMapIntensity: 1.8
      });
      const brushedSilver = new THREE.MeshStandardMaterial({
        color: 0xd4d2cd, metalness: 1, roughness: 0.14, envMapIntensity: 2.1
      });
      const accentMaterial = new THREE.MeshStandardMaterial({
        color: 0xd6b58a, metalness: 0.9, roughness: 0.19, envMapIntensity: 1.7
      });
      const goldTrimMaterial = new THREE.MeshStandardMaterial({
        color: 0x8f7a60, metalness: 0.92, roughness: 0.24, envMapIntensity: 1.5
      });
      const disposableGeometries = [];
      const disposableMaterials = new Set([titaniumDark, brushedSilver, accentMaterial, goldTrimMaterial]);
      const addMesh = (geometry, material, parent = artifact) => {
        disposableGeometries.push(geometry);
        disposableMaterials.add(material);
        const mesh = new THREE.Mesh(geometry, material);
        parent.add(mesh);
        return mesh;
      };

      // Smooth liquid-metal knot and three precision gimbal rings.
      const coreGeo = new THREE.TorusKnotGeometry(0.57, 0.19, 180, 32, 2, 3);
      const coreMesh = addMesh(coreGeo, titaniumDark);
      coreMesh.rotation.x = 0.25;
      const innerRing = addMesh(new THREE.TorusGeometry(0.98, 0.038, 24, 128), brushedSilver);
      innerRing.rotation.x = Math.PI / 2.8;
      const middleRing = addMesh(new THREE.TorusGeometry(1.22, 0.022, 20, 144), titaniumDark);
      middleRing.rotation.y = Math.PI / 3;
      const outerRing = addMesh(new THREE.TorusGeometry(1.46, 0.012, 16, 160), goldTrimMaterial);
      outerRing.rotation.x = Math.PI / 2.4;
      outerRing.rotation.y = Math.PI / 5;

      const satellites = new THREE.Group();
      const satelliteGeo = new THREE.SphereGeometry(0.045, 20, 16);
      disposableGeometries.push(satelliteGeo);
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const satellite = new THREE.Mesh(satelliteGeo, brushedSilver);
        satellite.position.set(Math.cos(angle) * 1.22, Math.sin(angle) * 1.22, 0);
        satellites.add(satellite);
      }
      middleRing.add(satellites);

      // 3. Floating Dust / Light Particles
      const dustCount = small ? 20 : 40;
      const dustPositions = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        dustPositions[i * 3] = (Math.random() - 0.5) * 3.6;
        dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 2.8;
        dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.8;
      }
      const dustGeometry = new THREE.BufferGeometry();
      dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
      disposableGeometries.push(dustGeometry);

      const dustMaterial = new THREE.PointsMaterial({
        color: 0x0071e3,
        size: small ? 0.014 : 0.02,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      });
      disposableMaterials.add(dustMaterial);

      const dust = new THREE.Points(dustGeometry, dustMaterial);
      scene.add(dust);

      // Lighting Setup
      scene.add(new THREE.AmbientLight(0xffffff, 1.1));

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(-3, 4, 5);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xc2c6d0, 1.1);
      fillLight.position.set(3, -2, -2);
      scene.add(fillLight);

      const rimLight = new THREE.PointLight(0xd6b58a, 3.2, 10);
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
          artifact.position.y = Math.sin(t * 1.5) * 0.06 - 0.1;

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
        renderer.dispose();\n        if (envMap) envMap.dispose();
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
