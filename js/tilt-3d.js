/**
 * Curruscos Tilt — inclinación 3D discreta para tarjetas.
 * Solo usa ratón/lápiz; no añade movimiento en pantallas táctiles ni con
 * prefers-reduced-motion. Funciona con tarjetas que aparecen dinámicamente.
 */
(function () {
  "use strict";

  const reducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };
  if (reducedMotion.matches || typeof window.requestAnimationFrame !== "function") return;

  const MAX_ROTATION = 5.5;
  const PERSPECTIVE = 1000;
  const LERP = 0.16;
  const THRESHOLD = 0.035;
  const SELECTOR = ".event-card, .public-event-card, .recommendation-card-wrap, [data-tilt]";
  const initialized = new WeakSet();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function initCardTilt(card) {
    if (!(card instanceof HTMLElement) || initialized.has(card)) return;
    initialized.add(card);
    card.dataset.tiltInitialized = "true";

    let bounds = null;
    let frameId = null;
    let inside = false;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let originalTransform = "";
    let originalTransition = "";
    let originalWillChange = "";
    let originalTransformPriority = "";
    let stylesCaptured = false;

    function captureStyles() {
      if (stylesCaptured) return;
      originalTransform = card.style.getPropertyValue("transform");
      originalTransformPriority = card.style.getPropertyPriority("transform");
      originalTransition = card.style.getPropertyValue("transition");
      originalWillChange = card.style.getPropertyValue("will-change");
      stylesCaptured = true;
    }

    function restoreStyles() {
      if (!stylesCaptured) return;
      if (originalTransform) {
        card.style.setProperty("transform", originalTransform, originalTransformPriority);
      } else {
        card.style.removeProperty("transform");
      }
      if (originalTransition) card.style.setProperty("transition", originalTransition);
      else card.style.removeProperty("transition");
      if (originalWillChange) card.style.setProperty("will-change", originalWillChange);
      else card.style.removeProperty("will-change");
      stylesCaptured = false;
    }

    function resetIfSettled() {
      if (inside) return;
      restoreStyles();
      bounds = null;
      currentX = 0;
      currentY = 0;
    }

    function animateStep() {
      currentX += (targetX - currentX) * LERP;
      currentY += (targetY - currentY) * LERP;

      const deltaX = Math.abs(targetX - currentX);
      const deltaY = Math.abs(targetY - currentY);

      if (deltaX <= THRESHOLD && deltaY <= THRESHOLD) {
        currentX = targetX;
        currentY = targetY;
        if (inside || currentX !== 0 || currentY !== 0) {
          card.style.setProperty(
            "transform",
            "perspective(" + PERSPECTIVE + "px) rotateX(" + currentX.toFixed(2) +
              "deg) rotateY(" + currentY.toFixed(2) + "deg) translateY(-2px)",
            "important"
          );
        } else {
          resetIfSettled();
        }
        frameId = null;
        return;
      }

      card.style.setProperty(
        "transform",
        "perspective(" + PERSPECTIVE + "px) rotateX(" + currentX.toFixed(2) +
          "deg) rotateY(" + currentY.toFixed(2) + "deg) translateY(-2px)",
        "important"
      );
      frameId = window.requestAnimationFrame(animateStep);
    }

    function scheduleAnimation() {
      if (frameId === null) frameId = window.requestAnimationFrame(animateStep);
    }

    function pointerMove(event) {
      if (!inside || (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
      if (!bounds) bounds = card.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
      const y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
      targetY = (x * 2 - 1) * MAX_ROTATION;
      targetX = -(y * 2 - 1) * MAX_ROTATION;
      scheduleAnimation();
    }

    card.addEventListener("pointerenter", event => {
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      inside = true;
      captureStyles();
      bounds = card.getBoundingClientRect();
      card.style.setProperty("will-change", "transform");
    }, { passive: true });

    card.addEventListener("pointermove", pointerMove, { passive: true });

    card.addEventListener("pointerleave", () => {
      if (!inside) return;
      inside = false;
      targetX = 0;
      targetY = 0;
      if (Math.abs(currentX) <= THRESHOLD && Math.abs(currentY) <= THRESHOLD && frameId === null) {
        resetIfSettled();
      } else {
        scheduleAnimation();
      }
    }, { passive: true });

    card.addEventListener("pointercancel", () => {
      inside = false;
      targetX = 0;
      targetY = 0;
      scheduleAnimation();
    }, { passive: true });
  }

  function attachTo(node) {
    if (!(node instanceof Element)) return;
    if (node.matches(SELECTOR)) initCardTilt(node);
    node.querySelectorAll(SELECTOR).forEach(initCardTilt);
  }

  function start() {
    attachTo(document.body);
    if (!("MutationObserver" in window) || !document.body) return;
    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) attachTo(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();