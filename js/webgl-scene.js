/**
 * Curruscos · Generative WebGL stage
 * Procedural plasma shader + GPU-animated orbital star field.
 * Progressive enhancement: the page and real event feed work without WebGL.
 */
(function () {
  "use strict";

  const PRESETS = {
    todas:       { scale: 1.45, distortion: 0.105, speed: 0.34, core: [0.72, 0.36, 0.16], glow: [0.10, 0.26, 0.48] },
    deporte:     { scale: 2.15, distortion: 0.075, speed: 0.62, core: [0.12, 0.72, 0.56], glow: [0.82, 0.30, 0.10] },
    ocio:        { scale: 1.15, distortion: 0.12, speed: 0.30, core: [0.86, 0.28, 0.30], glow: [0.92, 0.58, 0.22] },
    viajes:      { scale: 2.75, distortion: 0.08, speed: 0.24, core: [0.16, 0.48, 0.78], glow: [0.12, 0.68, 0.62] },
    videojuegos: { scale: 3.4, distortion: 0.14, speed: 0.68, core: [0.52, 0.30, 0.78], glow: [0.08, 0.66, 0.82] }
  };

  const plasmaVertexShader = `
    uniform float uTime;
    uniform float uNoiseScale;
    uniform float uDistortion;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vNoise;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m *= m;
      return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      float n1 = snoise(position * uNoiseScale + vec3(0.0, uTime * 0.19, uTime * 0.11));
      float n2 = snoise(position * (uNoiseScale * 1.9) - vec3(uTime * 0.13, 0.0, uTime * 0.17)) * 0.30;
      float n3 = snoise(position * (uNoiseScale * 3.2) + vec3(uTime * 0.08, -uTime * 0.15, uTime * 0.12)) * 0.10;
      float n = n1 + n2 + n3;
      float ridge = 1.0 - abs(sin(n * 3.2 + n2 * 2.0));
      vec3 displaced = position + normal * (n * uDistortion + ridge * 0.045);
      vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
      // A subtle noise-weighted normal gives the deformed surface more sculptural light.
      vNormal = normalize(normalMatrix * normalize(normal + vec3(n2, n3, n1) * 0.18));
      vViewPosition = -viewPosition.xyz;
      vNoise = n + ridge * 0.12;
      gl_Position = projectionMatrix * viewPosition;
    }
  `;

  const plasmaFragmentShader = `
    uniform vec3 uColorCore;
    uniform vec3 uColorGlow;
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vNoise;

    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(vViewPosition);
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.35);
      float flow = vNoise * 8.5 + uTime * 1.65 + sin(vNoise * 3.0 - uTime * 0.7) * 0.8;
      float bands = 0.5 + 0.5 * sin(flow);
      float filaments = pow(max(0.0, 1.0 - abs(sin(vNoise * 13.0 + uTime * 1.1))), 7.0);
      float hotCore = smoothstep(0.62, 0.98, bands + fresnel * 0.22);
      vec3 plasma = mix(uColorGlow * 0.42, uColorCore, smoothstep(-0.58, 0.62, vNoise + bands * 0.22));
      plasma = mix(plasma, vec3(1.0, 0.78, 0.54), hotCore * 0.34);
      plasma += uColorCore * fresnel * 1.5;
      plasma += mix(uColorCore, vec3(1.0, 0.48, 0.22), 0.35) * filaments * (0.38 + fresnel * 0.7);
      float alpha = clamp(0.64 + fresnel * 0.34 + filaments * 0.10, 0.0, 0.99);
      gl_FragColor = vec4(plasma, alpha);
    }
  `;

  const particleVertexShader = `
    uniform float uTime;
    uniform float uPixelRatio;
    attribute float aSeed;
    attribute float aRadius;
    attribute float aSpeed;
    varying float vAlpha;
    varying float vHue;
    void main() {
      float angle = aSeed * 6.2831853 + uTime * aSpeed;
      vec3 p = position;
      p.x += cos(angle) * aRadius;
      p.z += sin(angle) * aRadius;
      p.y += sin(angle * 1.7 + aSeed * 9.0) * 0.24;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp((2.0 + 3.2 * (0.5 + 0.5 * sin(angle * 2.0))) * uPixelRatio * (5.0 / max(1.0, -mv.z)), 1.0, 7.0);
      vAlpha = 0.3 + 0.7 * (0.5 + 0.5 * sin(angle * 1.3));
      vHue = aSeed;
    }
  `;

  const particleFragmentShader = `
    varying float vAlpha;
    varying float vHue;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      if (d > 0.5) discard;
      float glow = exp(-d * 12.0);
      vec3 warm = vec3(1.0, 0.32, 0.08);
      vec3 cool = vec3(0.25, 0.35, 1.0);
      vec3 color = mix(warm, cool, smoothstep(0.58, 0.95, vHue));
      gl_FragColor = vec4(color, glow * vAlpha);
    }
  `;

  const WebGLStage = {
    current: { ...PRESETS.todas, core: [...PRESETS.todas.core], glow: [...PRESETS.todas.glow] },
    target: { ...PRESETS.todas, core: [...PRESETS.todas.core], glow: [...PRESETS.todas.glow] },

    init() {
      const canvas = document.getElementById("webgl-stage-canvas");
      const stage = document.querySelector(".webgl-hero-stage");
      const THREE = window.THREE;
      if (!canvas || !stage || !THREE || !window.WebGLRenderingContext) return;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const small = window.matchMedia("(max-width: 680px)").matches;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: !small,
          powerPreference: "low-power",
          stencil: false,
          depth: true
        });
      } catch (_) {
        stage.classList.add("webgl-unavailable");
        return;
      }

      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
      camera.position.set(0, 0, 5.9);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.65));
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x000000, 0);
      if ("ACESFilmicToneMapping" in THREE) renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const sceneGroup = new THREE.Group();
      scene.add(sceneGroup);

      const coreGeometry = new THREE.SphereGeometry(1.08, small ? 32 : 48, small ? 24 : 36);
      const uniforms = {
        uTime: { value: 0 },
        uNoiseScale: { value: WebGLStage.current.scale },
        uDistortion: { value: WebGLStage.current.distortion },
        uColorCore: { value: new THREE.Color(...WebGLStage.current.core) },
        uColorGlow: { value: new THREE.Color(...WebGLStage.current.glow) }
      };
      const coreMaterial = new THREE.ShaderMaterial({
        vertexShader: plasmaVertexShader,
        fragmentShader: plasmaFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false
      });
      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      sceneGroup.add(core);

      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(1.12, small ? 18 : 28, small ? 12 : 18),
        new THREE.MeshBasicMaterial({
          color: 0x7f9ba8,
          wireframe: true,
          transparent: true,
          opacity: 0.22,
          depthWrite: false
        })
      );
      sceneGroup.add(shell);

      // A few orbital arcs frame the plasma; keep the silhouette readable.
      const arcMaterials = [
        new THREE.MeshStandardMaterial({ color: 0xdca66b, metalness: 0.82, roughness: 0.28, emissive: 0x5b260d, emissiveIntensity: 0.35 }),
        new THREE.MeshStandardMaterial({ color: 0x8ba9c5, metalness: 0.78, roughness: 0.32, emissive: 0x142c4b, emissiveIntensity: 0.25 })
      ];
      const arcA = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.018, 8, 144), arcMaterials[0]);
      arcA.rotation.set(0.95, 0.25, 0.2);
      sceneGroup.add(arcA);
      const arcB = new THREE.Mesh(new THREE.TorusGeometry(1.34, 0.014, 8, 128), arcMaterials[1]);
      arcB.rotation.set(0.25, 1.0, 0.75);
      sceneGroup.add(arcB);

      // Fine meridians make the central object read as a physical armillary globe.
      const meridianMaterial = new THREE.MeshStandardMaterial({
        color: 0x9eb7c4, metalness: 0.86, roughness: 0.24,
        transparent: true, opacity: 0.48, depthWrite: false
      });
      const meridians = [];
      [
        [0, 0, 0],
        [Math.PI / 2, 0, 0],
        [0, 0, Math.PI / 2]
      ].forEach((rotation) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.009, 6, 96), meridianMaterial);
        ring.rotation.set(rotation[0], rotation[1], rotation[2]);
        sceneGroup.add(ring);
        meridians.push(ring);
      });
      const equator = new THREE.Mesh(
        new THREE.TorusGeometry(1.105, 0.014, 6, 96),
        new THREE.MeshStandardMaterial({ color: 0xe7b878, metalness: 0.9, roughness: 0.22 })
      );
      equator.rotation.x = Math.PI / 2;
      sceneGroup.add(equator);

      // Particle positions stay fixed in the buffer; their orbital motion is calculated in the vertex shader.
      const particleCount = small ? 220 : 420;
      const positions = new Float32Array(particleCount * 3);
      const seeds = new Float32Array(particleCount);
      const radii = new Float32Array(particleCount);
      const speeds = new Float32Array(particleCount);
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 1.45 + Math.random() * 2.35;
        positions[i * 3] = Math.cos(angle) * radius * 0.55;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 4.8;
        positions[i * 3 + 2] = Math.sin(angle) * radius * 0.55;
        seeds[i] = Math.random();
        radii[i] = 0.12 + Math.random() * 0.75;
        speeds[i] = (Math.random() * 0.22 + 0.035) * (Math.random() < 0.5 ? -1 : 1);
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      particleGeometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
      particleGeometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
      const particleUniforms = {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() }
      };
      const particleMaterial = new THREE.ShaderMaterial({
        uniforms: particleUniforms,
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const warmLight = new THREE.PointLight(0xff5526, 16, 14);
      warmLight.position.set(3, 2, 3);
      scene.add(warmLight);
      const coolLight = new THREE.PointLight(0x654cff, 12, 14);
      coolLight.position.set(-3, -2, -2);
      scene.add(coolLight);

      let pointerX = 0, pointerY = 0, smoothX = 0, smoothY = 0;
      let frame = 0;
      let visible = true;
      let disposed = false;
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
        const t = clock.getElapsedTime();
        smoothX += (pointerX - smoothX) * 0.055;
        smoothY += (pointerY - smoothY) * 0.055;

        if (!reducedMotion) {
          WebGLStage.current.scale += (WebGLStage.target.scale - WebGLStage.current.scale) * 0.035;
          WebGLStage.current.distortion += (WebGLStage.target.distortion - WebGLStage.current.distortion) * 0.035;
          WebGLStage.current.speed += (WebGLStage.target.speed - WebGLStage.current.speed) * 0.035;
          for (let i = 0; i < 3; i++) {
            WebGLStage.current.core[i] += (WebGLStage.target.core[i] - WebGLStage.current.core[i]) * 0.035;
            WebGLStage.current.glow[i] += (WebGLStage.target.glow[i] - WebGLStage.current.glow[i]) * 0.035;
          }
          uniforms.uTime.value = t * WebGLStage.current.speed;
          uniforms.uNoiseScale.value = WebGLStage.current.scale;
          uniforms.uDistortion.value = WebGLStage.current.distortion;
          uniforms.uColorCore.value.setRGB(...WebGLStage.current.core);
          uniforms.uColorGlow.value.setRGB(...WebGLStage.current.glow);
          particleUniforms.uTime.value = t;
          core.rotation.y = t * 0.12 + smoothX * 0.28;
          core.rotation.x = t * 0.08 - smoothY * 0.2;
          shell.rotation.y = -t * 0.08;
          shell.rotation.z = t * 0.045;
          arcA.rotation.z = 0.2 + t * 0.06;
          arcB.rotation.x = 0.25 + Math.sin(t * 0.18) * 0.08;
          meridians[0].rotation.y = t * 0.045;
          meridians[1].rotation.z = t * 0.035;
          meridians[2].rotation.x = t * 0.04;
          equator.rotation.z = t * 0.06;
          sceneGroup.rotation.y += (smoothX * 0.12 - sceneGroup.rotation.y) * 0.025;
          sceneGroup.rotation.x += (-smoothY * 0.08 - sceneGroup.rotation.x) * 0.025;
          particles.rotation.y = t * 0.018 + smoothX * 0.08;
          warmLight.position.x = 3 + smoothX * 1.2;
          warmLight.position.y = 2 + smoothY;
        } else {
          uniforms.uTime.value = 0;
          particleUniforms.uTime.value = 0;
        }

        renderer.render(scene, camera);
        if (!reducedMotion) frame = window.requestAnimationFrame(tick);
      }

      function start() {
        if (!frame && visible && !document.hidden && !disposed && !reducedMotion) {
          frame = window.requestAnimationFrame(tick);
        }
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
        if (visible) { renderer.render(scene, camera); start(); }
        else stop();
      };

      stage.addEventListener("pointermove", onPointerMove, { passive: true });
      stage.addEventListener("pointerleave", onPointerLeave, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("resize", resize, { passive: true });

      let resizeObserver;
      if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(stage);
      }
      let intersectionObserver;
      if ("IntersectionObserver" in window) {
        intersectionObserver = new IntersectionObserver((entries) => {
          visible = entries[0].isIntersecting;
          if (visible) { renderer.render(scene, camera); start(); }
          else stop();
        }, { threshold: 0.01 });
        intersectionObserver.observe(stage);
      }

      // Public hook used by the category filters when a matching preset exists.
      this.morphToCategory = (cat) => {
        const preset = PRESETS[cat] || PRESETS.todas;
        this.target = {
          scale: preset.scale,
          distortion: preset.distortion,
          speed: preset.speed,
          core: [...preset.core],
          glow: [...preset.glow]
        };
      };

      this.destroy = () => {
        disposed = true;
        stop();
        stage.removeEventListener("pointermove", onPointerMove);
        stage.removeEventListener("pointerleave", onPointerLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", resize);
        if (resizeObserver) resizeObserver.disconnect();
        if (intersectionObserver) intersectionObserver.disconnect();
        coreGeometry.dispose();
        coreMaterial.dispose();
        shell.geometry.dispose();
        shell.material.dispose();
        arcA.geometry.dispose();
        arcB.geometry.dispose();
        arcMaterials.forEach((material) => material.dispose());
        meridians.forEach((ring) => { ring.geometry.dispose(); });
        meridianMaterial.dispose();
        equator.geometry.dispose();
        equator.material.dispose();
        particleGeometry.dispose();
        particleMaterial.dispose();
        renderer.dispose();
        stage.classList.remove("webgl-ready");
      };

      resize();
      renderer.render(scene, camera);
      if (!reducedMotion) start();
      stage.classList.add("webgl-ready");
    },

    morphToCategory(cat) {
      const preset = PRESETS[cat] || PRESETS.todas;
      this.target = {
        scale: preset.scale,
        distortion: preset.distortion,
        speed: preset.speed,
        core: [...preset.core],
        glow: [...preset.glow]
      };
    }
  };

  window.WebGLStage = WebGLStage;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => WebGLStage.init(), { once: true });
  } else {
    WebGLStage.init();
  }
})();
