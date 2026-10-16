/**
 * Curruscos · Generative WebGL stage
 * Procedural plasma shader and orbiting particles animated in the GPU vertex shader.
 * The public events feed stays usable if WebGL is unavailable.
 */
(function () {
  "use strict";
  const PRESETS = {
    todas: { scale: 1.45, distortion: 0.22, speed: 0.65, core: [1, 0.30, 0.08], glow: [0.24, 0.12, 0.75] },
    deporte: { scale: 1.9, distortion: 0.18, speed: 0.95, core: [0.05, 0.88, 0.48], glow: [1, 0.28, 0.04] },
    ocio: { scale: 1.2, distortion: 0.25, speed: 0.52, core: [1, 0.12, 0.31], glow: [0.95, 0.54, 0.08] },
    viajes: { scale: 2.3, distortion: 0.2, speed: 0.45, core: [0.06, 0.58, 1], glow: [0, 0.82, 0.62] },
    videojuegos: { scale: 2.8, distortion: 0.28, speed: 1.1, core: [0.65, 0.12, 1], glow: [0, 0.88, 1] }
  };

  const vertexShader = [
    "uniform float uTime; uniform float uNoiseScale; uniform float uDistortion;",
    "varying vec3 vNormal; varying vec3 vViewPosition; varying float vField; varying vec3 vPos;",
    "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}",
    "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}",
    "float snoise(vec3 v){",
    "const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);",
    "vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);",
    "vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);",
    "vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);",
    "vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));",
    "float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.0*floor(p*ns.z*ns.z);",
    "vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_); vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy;",
    "vec4 h=1.0-abs(x)-abs(y); vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);",
    "vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));",
    "vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;",
    "vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);",
    "vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));",
    "p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;",
    "vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m*=m;",
    "return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}",
    "void main(){vec3 p=position;float t=uTime*0.22;",
    "float n1=snoise(p*uNoiseScale+vec3(0.0,t,-t*0.7));",
    "float n2=snoise(p*(uNoiseScale*2.0)-vec3(t*1.2,0.0,t));float f=n1*0.72+n2*0.28;",
    "p+=normal*f*uDistortion;vField=f;vPos=p;vNormal=normalize(normalMatrix*normal);",
    "vec4 mv=modelViewMatrix*vec4(p,1.0);vViewPosition=-mv.xyz;gl_Position=projectionMatrix*mv;}"
  ].join("\n");

  const fragmentShader = [
    "uniform vec3 uColorCore; uniform vec3 uColorGlow; uniform float uTime;",
    "varying vec3 vNormal; varying vec3 vViewPosition; varying float vField; varying vec3 vPos;",
    "void main(){vec3 n=normalize(vNormal);vec3 v=normalize(vViewPosition);",
    "float rim=pow(1.0-max(dot(n,v),0.0),2.1);float bands=0.5+0.5*sin(vField*17.0+uTime+vPos.y*3.0);",
    "vec3 c=mix(uColorGlow,uColorCore,smoothstep(-0.7,0.72,vField+bands*0.17));",
    "float hot=pow(max(0.0,1.0-abs(vField-0.12)*2.8),3.0);c+=uColorCore*hot*0.45;",
    "c+=vec3(0.55,0.16,0.72)*rim*(0.4+0.15*sin(uTime*0.7));c+=uColorGlow*rim*0.7;",
    "gl_FragColor=vec4(c,clamp(0.62+rim*0.32+hot*0.06,0.0,0.98));}"
  ].join("\n");

  const particleVertexShader = [
    "uniform float uTime;uniform float uPixelRatio;attribute float aSize;attribute float aPhase;varying float vGlow;",
    "void main(){float t=uTime*0.12+aPhase;float a=t*(0.22+fract(aPhase*0.13)*0.18);",
    "float c=cos(a),s=sin(a);vec3 p=position;p.xz=mat2(c,-s,s,c)*p.xz;",
    "p.y+=sin(t*1.7+aPhase)*0.16;p.x+=sin(t*0.8+aPhase*2.0)*0.12;",
    "vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;",
    "gl_PointSize=aSize*uPixelRatio*(32.0/max(1.0,-mv.z));vGlow=0.5+0.5*sin(uTime*1.8+aPhase*5.0);}"
  ].join("\n");

  const particleFragmentShader = [
    "uniform vec3 uStarColor;varying float vGlow;",
    "void main(){float d=length(gl_PointCoord-vec2(0.5));if(d>0.5)discard;",
    "float halo=exp(-d*15.0);float core=1.0-smoothstep(0.0,0.19,d);",
    "gl_FragColor=vec4(uStarColor,(halo*0.45+core*0.8)*vGlow);}"
  ].join("\n");

  const WebGLStage = {
    current: Object.assign({}, PRESETS.todas),
    target: Object.assign({}, PRESETS.todas),
    initialized: false,
    init: function () {
      if (this.initialized) return;
      const canvas = document.getElementById("webgl-stage-canvas");
      const stage = document.querySelector(".webgl-hero-stage");
      if (!canvas || !stage || !window.THREE || !window.WebGLRenderingContext) return;
      this.initialized = true;
      const THREE = window.THREE;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const small = window.matchMedia("(max-width: 680px)").matches;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: !small, powerPreference: "low-power", stencil: false });
      } catch (_) {
        stage.classList.add("webgl-unavailable");
        return;
      }
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.15 : 1.5));
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 70);
      camera.position.set(0, 0, 6.8);
      const sculpture = new THREE.Group();
      scene.add(sculpture);

      const uniforms = {
        uTime: { value: 0 },
        uNoiseScale: { value: this.current.scale },
        uDistortion: { value: this.current.distortion },
        uColorCore: { value: new THREE.Color(...this.current.core) },
        uColorGlow: { value: new THREE.Color(...this.current.glow) }
      };
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.15, small ? 3 : 4),
        new THREE.ShaderMaterial({ vertexShader: vertexShader, fragmentShader: fragmentShader, uniforms: uniforms, transparent: true, depthWrite: false })
      );
      sculpture.add(core);

      const shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.32, 2),
        new THREE.MeshBasicMaterial({ color: 0xff8755, wireframe: true, transparent: true, opacity: 0.15, depthWrite: false })
      );
      sculpture.add(shell);
      const rings = new THREE.Group();
      sculpture.add(rings);
      [
        [1.62, 0xd7a95c, 0.9, 0.25, 0.1],
        [1.83, 0x7d70ff, 0.25, 1.0, 0.62],
        [1.43, 0xff642e, 1.25, 0.1, 0.9]
      ].forEach(function (r) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r[0], 0.008, 5, small ? 56 : 88),
          new THREE.MeshBasicMaterial({ color: r[1], transparent: true, opacity: 0.7, depthWrite: false }));
        ring.rotation.set(r[2], r[3], r[4]);
        rings.add(ring);
      });

      // Star positions are transformed per vertex on the GPU every frame.
      const count = small ? 200 : 440;
      const positions = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const phases = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const r = 1.9 + Math.random() * 3.0;
        const a = Math.random() * Math.PI * 2;
        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 5.4;
        positions[i * 3 + 2] = Math.sin(a) * r * 0.72;
        sizes[i] = 0.9 + Math.random() * (small ? 1.4 : 2.0);
        phases[i] = Math.random() * Math.PI * 2;
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
      particleGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
      const particleUniforms = {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uStarColor: { value: new THREE.Color(0xffa477) }
      };
      const stars = new THREE.Points(particleGeometry, new THREE.ShaderMaterial({
        uniforms: particleUniforms, vertexShader: particleVertexShader, fragmentShader: particleFragmentShader,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      scene.add(stars);

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const warmLight = new THREE.PointLight(0xff5a1f, 15, 15);
      warmLight.position.set(3, 2, 4);
      scene.add(warmLight);
      const coolLight = new THREE.PointLight(0x625eff, 12, 15);
      coolLight.position.set(-3, -2, -2);
      scene.add(coolLight);

      let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
      let frame = 0, inView = true;
      const clock = new THREE.Clock();
      function resize() {
        const rect = stage.getBoundingClientRect();
        camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
        camera.updateProjectionMatrix();
        renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
        particleUniforms.uPixelRatio.value = renderer.getPixelRatio();
        if (!frame) renderer.render(scene, camera);
      }
      function renderFrame() {
        frame = 0;
        if (!inView || document.hidden) return;
        const t = clock.getElapsedTime();
        currentX += (targetX - currentX) * 0.055;
        currentY += (targetY - currentY) * 0.055;
        WebGLStage.current.speed += (WebGLStage.target.speed - WebGLStage.current.speed) * 0.045;
        uniforms.uTime.value = t * WebGLStage.current.speed;
        uniforms.uNoiseScale.value += (WebGLStage.target.scale - uniforms.uNoiseScale.value) * 0.045;
        uniforms.uDistortion.value += (WebGLStage.target.distortion - uniforms.uDistortion.value) * 0.045;
        uniforms.uColorCore.value.lerp(new THREE.Color(...WebGLStage.target.core), 0.045);
        uniforms.uColorGlow.value.lerp(new THREE.Color(...WebGLStage.target.glow), 0.045);
        particleUniforms.uTime.value = t;
        particleUniforms.uStarColor.value.copy(uniforms.uColorCore.value);
        core.rotation.y = t * 0.12 + currentX * 0.22;
        core.rotation.x = t * 0.08 - currentY * 0.18;
        shell.rotation.y = -t * 0.075;
        rings.rotation.y = t * 0.045 + currentX * 0.08;
        rings.rotation.x = currentY * 0.08;
        sculpture.rotation.y += (currentX * 0.08 - sculpture.rotation.y) * 0.025;
        sculpture.rotation.x += (-currentY * 0.055 - sculpture.rotation.x) * 0.025;
        stars.rotation.y = t * 0.018;
        warmLight.position.x = 3 + currentX;
        warmLight.position.y = 2 + currentY;
        renderer.render(scene, camera);
        if (!reducedMotion) frame = window.requestAnimationFrame(renderFrame);
      }
      function start() {
        if (!reducedMotion && !frame && inView && !document.hidden) frame = window.requestAnimationFrame(renderFrame);
      }
      stage.addEventListener("pointermove", function (event) {
        if (event.pointerType === "touch") return;
        const rect = stage.getBoundingClientRect();
        targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        targetY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        if (reducedMotion) {
          sculpture.rotation.y = targetX * 0.08;
          sculpture.rotation.x = -targetY * 0.055;
          renderer.render(scene, camera);
        }
      }, { passive: true });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden && frame) { window.cancelAnimationFrame(frame); frame = 0; }
        else start();
      });
      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(function (entries) {
          inView = entries.some(function (entry) { return entry.isIntersecting; });
          if (inView) start();
          else if (frame) { window.cancelAnimationFrame(frame); frame = 0; }
        }, { threshold: 0.02 });
        observer.observe(stage);
      }
      window.addEventListener("resize", resize, { passive: true });
      if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
      resize();
      stage.classList.add("webgl-ready");
      if (reducedMotion) renderer.render(scene, camera);
      else start();
    },
    morphToCategory: function (category) {
      const preset = PRESETS[category] || PRESETS.todas;
      this.target = {
        scale: preset.scale, distortion: preset.distortion, speed: preset.speed,
        core: preset.core.slice(), glow: preset.glow.slice()
      };
    }
  };

  window.WebGLStage = WebGLStage;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { WebGLStage.init(); }, { once: true });
  } else WebGLStage.init();
})();