/**
 * Subtle desktop-only particle trail. Bounded particle count and reduced-motion aware.
 */
(() => {
  "use strict";

  function init() {
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      const visualPrefs = JSON.parse(localStorage.getItem("curruscos_visual_preferences") || "{}");
      if (visualPrefs.cursorSparkles === false) return;
    } catch (_) {}
    const canvas = document.createElement("canvas");
    canvas.className = "sparkles-overlay-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:30;mix-blend-mode:screen";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) { canvas.remove(); return; }
    let width = 0, height = 0, dpr = 1, raf = 0;
    const particles = [];
    const maxParticles = 84;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function frame() {
      raf = 0;
      ctx.clearRect(0, 0, width, height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.alpha -= p.decay;
        p.vx *= 0.985; p.vy *= 0.985;
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 105, 48, " + (p.alpha * 0.72) + ")";
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      if (particles.length) raf = requestAnimationFrame(frame);
    }
    function onPointerMove(event) {
      if (document.hidden) return;
      for (let i = 0; i < 2; i++) {
        if (particles.length >= maxParticles) particles.shift();
        particles.push({
          x: event.clientX + (Math.random() - 0.5) * 8,
          y: event.clientY + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 1.1,
          vy: (Math.random() - 0.5) * 1.1 - 0.25,
          size: Math.random() * 1.6 + 0.5,
          alpha: 0.8,
          decay: Math.random() * 0.035 + 0.025
        });
      }
      if (!raf) raf = requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { particles.length = 0; if (raf) cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, width, height); }
    });
    window.addEventListener("pagehide", () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      canvas.remove();
    }, { once: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
