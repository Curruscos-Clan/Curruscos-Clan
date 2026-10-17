/**
 * Curruscos · Antikythera mechanism
 * Procedural 3D interpretation of the ancient astronomical calculator.
 * Progressive enhancement: the page and real event feed work without WebGL.
 */
(function () {
  "use strict";

  const CAT_PRESETS = {
    todas:       { speed: 0.18, accent: 0xb9874e },
    deporte:     { speed: 0.34, accent: 0x7d9a64 },
    ocio:        { speed: 0.16, accent: 0xb87865 },
    viajes:      { speed: 0.12, accent: 0x7198a8 },
    videojuegos: { speed: 0.42, accent: 0x9280b7 }
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
      camera.position.set(0, 0.05, 5.25);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.2 : 1.5));
      renderer.setClearColor(0x000000, 0);
      if ("ACESFilmicToneMapping" in THREE) renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;

      const artifact = new THREE.Group();
      scene.add(artifact);

      const bronze = new THREE.MeshStandardMaterial({
        color: 0x9a713e, metalness: 0.82, roughness: 0.43
      });
      const brightBronze = new THREE.MeshStandardMaterial({
        color: 0xc49a5c, metalness: 0.9, roughness: 0.29
      });
      const darkBronze = new THREE.MeshStandardMaterial({
        color: 0x4a3927, metalness: 0.72, roughness: 0.62
      });
      const patina = new THREE.MeshStandardMaterial({
        color: 0x496b59, metalness: 0.32, roughness: 0.8
      });
      const wood = new THREE.MeshStandardMaterial({
        color: 0x30231a, metalness: 0.06, roughness: 0.94
      });
      const iron = new THREE.MeshStandardMaterial({
        color: 0x292a28, metalness: 0.86, roughness: 0.55
      });
      const materials = [bronze, brightBronze, darkBronze, patina, wood, iron];
      const animatedGears = [];
      const disposableGeometries = [];
      const disposableMaterials = new Set(materials);
      const addMesh = (geometry, material, parent = artifact) => {
        disposableGeometries.push(geometry);
        disposableMaterials.add(material);
        const mesh = new THREE.Mesh(geometry, material);
        parent.add(mesh);
        return mesh;
      };

      // A gear blank with a real cut-out and individual trapezoidal teeth.
      function gearGeometry(radius, teeth, thickness, holeRadius) {
        const shape = new THREE.Shape();
        const root = radius * 0.91;
        const tip = radius;
        const points = [];
        for (let i = 0; i < teeth; i++) {
          const a = (i / teeth) * Math.PI * 2;
          const p = Math.PI * 2 / teeth;
          points.push(
            [a - p * 0.47, root],
            [a - p * 0.30, root],
            [a - p * 0.20, tip],
            [a + p * 0.20, tip],
            [a + p * 0.30, root],
            [a + p * 0.47, root]
          );
        }
        points.forEach(([angle, r], i) => {
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        });
        shape.closePath();
        const hole = new THREE.Path();
        hole.absarc(0, 0, holeRadius, 0, Math.PI * 2, true);
        shape.holes.push(hole);
        return new THREE.ExtrudeGeometry(shape, {
          depth: thickness, bevelEnabled: true, bevelSegments: 1,
          steps: 1, bevelSize: Math.min(0.012, thickness * 0.12),
          bevelThickness: Math.min(0.012, thickness * 0.12), curveSegments: 8
        });
      }

      function addGear({ x, y, z, radius, teeth, thickness = 0.075, hole = 0.085,
                         spokes = 5, dial = false, speed = 0.3, direction = 1 }) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        artifact.add(group);
        const gear = addMesh(gearGeometry(radius, teeth, thickness, hole), bronze, group);
        gear.position.z = -thickness / 2;
        const innerRadius = radius * 0.57;
        const rim = addMesh(new THREE.TorusGeometry(innerRadius, 0.018, 6, 48), brightBronze, group);
        rim.position.z = thickness * 0.52;
        const hub = addMesh(new THREE.CylinderGeometry(hole * 1.5, hole * 1.5, thickness + 0.045, 16), brightBronze, group);
        hub.rotation.x = Math.PI / 2;
        hub.rotation.z = Math.PI / 2;
        hub.position.z = thickness * 0.52;
        for (let i = 0; i < spokes; i++) {
          const spoke = addMesh(new THREE.BoxGeometry(radius * 0.82, Math.max(0.018, radius * 0.055), 0.025), darkBronze, group);
          spoke.position.z = thickness * 0.54;
          spoke.rotation.z = (i / spokes) * Math.PI;
        }
        if (dial) {
          const dialRing = addMesh(new THREE.TorusGeometry(radius * 0.73, 0.012, 5, 96), patina, group);
          dialRing.position.z = thickness * 0.58;
          const innerRing = addMesh(new THREE.TorusGeometry(radius * 0.48, 0.008, 5, 80), brightBronze, group);
          innerRing.position.z = thickness * 0.59;
          const tickCount = 60;
          for (let i = 0; i < tickCount; i++) {
            const angle = i / tickCount * Math.PI * 2;
            const major = i % 5 === 0;
            const tick = addMesh(
              new THREE.BoxGeometry(major ? 0.014 : 0.007, major ? 0.065 : 0.032, 0.008),
              major ? brightBronze : darkBronze, group
            );
            tick.position.set(Math.cos(angle) * radius * 0.73, Math.sin(angle) * radius * 0.73, thickness * 0.6);
            tick.rotation.z = angle - Math.PI / 2;
          }
          const pointer = addMesh(new THREE.BoxGeometry(0.018, radius * 0.58, 0.012), brightBronze, group);
          pointer.position.set(0, radius * 0.26, thickness * 0.64);
          pointer.rotation.z = -0.32;
          const cap = addMesh(new THREE.SphereGeometry(0.045, 12, 10), patina, group);
          cap.position.z = thickness * 0.66;
        }
        animatedGears.push({ group, speed, direction });
        return group;
      }

      // Weathered wooden frame, set behind the mechanism rather than dominating it.
      const base = addMesh(new THREE.BoxGeometry(2.18, 0.11, 0.34), wood);
      base.position.set(0, -0.96, -0.2);
      const leftRail = addMesh(new THREE.BoxGeometry(0.085, 1.62, 0.22), wood);
      leftRail.position.set(-1.02, -0.13, -0.19);
      const rightRail = addMesh(new THREE.BoxGeometry(0.085, 1.62, 0.22), wood);
      rightRail.position.set(1.02, -0.13, -0.19);
      const topRail = addMesh(new THREE.BoxGeometry(2.12, 0.075, 0.22), wood);
      topRail.position.set(0, 0.68, -0.19);
      // Patinated side plates and the visible mechanical spine.
      const backPlate = addMesh(new THREE.BoxGeometry(1.72, 1.32, 0.055), darkBronze);
      backPlate.position.set(0, -0.06, -0.28);
      const spine = addMesh(new THREE.BoxGeometry(0.045, 1.22, 0.045), patina);
      spine.position.set(-0.03, -0.04, -0.19);

      // Distinct, offset gear train; front dial and smaller linked wheels remain readable.
      addGear({ x: 0.32, y: 0.02, z: 0.08, radius: 0.59, teeth: 64, hole: 0.10, spokes: 5, dial: true, speed: 0.16, direction: 1 });
      addGear({ x: -0.55, y: 0.10, z: 0.12, radius: 0.32, teeth: 32, hole: 0.065, spokes: 4, speed: 0.33, direction: -1 });
      addGear({ x: -0.76, y: 0.49, z: 0.10, radius: 0.19, teeth: 20, hole: 0.05, spokes: 4, speed: 0.52, direction: 1 });
      addGear({ x: -0.19, y: 0.56, z: 0.12, radius: 0.15, teeth: 16, hole: 0.045, spokes: 3, speed: 0.65, direction: -1 });
      addGear({ x: 0.72, y: -0.48, z: 0.11, radius: 0.29, teeth: 30, hole: 0.065, spokes: 5, speed: 0.29, direction: -1 });
      addGear({ x: 0.77, y: 0.38, z: 0.10, radius: 0.20, teeth: 22, hole: 0.05, spokes: 4, speed: 0.46, direction: 1 });

      // Rivets and visible axle heads.
      const rivetGeo = new THREE.SphereGeometry(0.035, 10, 8);
      [[-0.92,0.57], [0.92,0.57], [-0.92,-0.78], [0.92,-0.78], [0,-0.91]].forEach(([x,y]) => {
        const rivet = addMesh(rivetGeo, brightBronze);
        rivet.position.set(x, y, -0.055);
      });

      // Fine engraved arcs and a restrained dust field, not a glowing particle cloud.
      const outerArc = addMesh(new THREE.TorusGeometry(1.04, 0.009, 5, 128), brightBronze);
      outerArc.scale.set(1, 0.82, 1);
      outerArc.position.set(0, -0.04, -0.12);
      outerArc.rotation.x = 0.12;
      const dustCount = small ? 18 : 32;
      const dustPositions = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        dustPositions[i * 3] = (Math.random() - 0.5) * 3.4;
        dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 2.7;
        dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      }
      const dustGeometry = new THREE.BufferGeometry();
      dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
      disposableGeometries.push(dustGeometry);
      const dustMaterial = new THREE.PointsMaterial({
        color: 0xc5a16d, size: small ? 0.012 : 0.017,
        transparent: true, opacity: 0.28, depthWrite: false
      });
      disposableMaterials.add(dustMaterial);
      const dust = new THREE.Points(dustGeometry, dustMaterial);
      scene.add(dust);

      scene.add(new THREE.AmbientLight(0xf3e6d2, 1.05));
      const keyLight = new THREE.DirectionalLight(0xffdfad, 3.0);
      keyLight.position.set(-3.5, 3.5, 4);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0x5b8075, 1.0);
      fillLight.position.set(3, -2, -2);
      scene.add(fillLight);
      const rimLight = new THREE.PointLight(0xc28c50, 4, 8);
      rimLight.position.set(1.5, 1.2, 2.8);
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
        smoothX += (pointerX - smoothX) * 0.055;
        smoothY += (pointerY - smoothY) * 0.055;
        if (!reducedMotion) {
          WebGLStage.current.speed += (WebGLStage.target.speed - WebGLStage.current.speed) * 0.025;
          artifact.rotation.y += (smoothX * 0.12 - artifact.rotation.y) * 0.035;
          artifact.rotation.x += ((-smoothY * 0.07 + 0.04) - artifact.rotation.x) * 0.035;
          artifact.rotation.z = Math.sin(t * 0.14) * 0.018;
          animatedGears.forEach((g) => { g.group.rotation.z += delta * WebGLStage.current.speed * g.speed * g.direction * 1.5; });
          dust.rotation.y = t * 0.012;
          const positions = dust.geometry.attributes.position.array;
          for (let i = 1; i < positions.length; i += 3) {
            positions[i] -= delta * 0.018;
            if (positions[i] < -1.5) positions[i] = 1.5;
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
        // Category accents tint only the front dial's metal; the historical object stays recognizable.
        brightBronze.color.setHex(preset.accent);
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
