/**
 * Audio-reactive WebGL controller. Microphone capture is opt-in and never
 * sends audio to a server; only analyser values affect the local 3D scene.
 */
(() => {
  "use strict";

  function init() {
    const button = document.getElementById("btn-audio-reactive");
    const stage = document.querySelector(".webgl-hero-stage");
    const status = document.getElementById("audio-reactive-status");
    if (!button || !stage) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    let audioContext = null;
    let stream = null;
    let analyser = null;
    let source = null;
    let samples = null;
    let listening = false;
    let rafId = 0;
    let touchTimer = 0;
    let touchIntensity = 0;

    const setIntensity = (value) => {
      if (window.WebGLStage && typeof window.WebGLStage.setAudioIntensity === "function") {
        window.WebGLStage.setAudioIntensity(value);
      }
    };
    const announce = (message) => { if (status) status.textContent = message; };
    const updateButton = () => {
      button.classList.toggle("active", listening);
      button.setAttribute("aria-pressed", String(listening));
      button.textContent = listening ? "Desactivar audio 3D" : "Activar audio 3D";
    };

    async function start() {
      if (touchTimer) { clearInterval(touchTimer); touchTimer = 0; }
      touchIntensity = 0;
      if (!navigator.mediaDevices?.getUserMedia || !AudioContextClass) {
        announce("Este navegador no permite activar el audio reactivo.");
        return;
      }
      button.disabled = true;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        audioContext = new AudioContextClass();
        await audioContext.resume();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.78;
        samples = new Uint8Array(analyser.frequencyBinCount);
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        listening = true;
        updateButton();
        announce("Audio reactivo activo. El sonido se analiza localmente en este dispositivo.");
        tick();
      } catch (error) {
        console.warn("No se pudo activar el audio reactivo:", error);
        if (stream) stream.getTracks().forEach((track) => track.stop());
        stream = null;
        if (audioContext) await audioContext.close().catch(() => {});
        audioContext = null;
        announce(error?.name === "NotAllowedError" ? "Permiso de micrófono denegado. Puedes seguir usando el efecto táctil." : "No se ha podido iniciar el audio. Comprueba el permiso del micrófono.");
      } finally {
        button.disabled = false;
      }
    }

    async function stop() {
      listening = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      if (source) { try { source.disconnect(); } catch (_) {} }
      source = null;
      if (stream) stream.getTracks().forEach((track) => track.stop());
      stream = null;
      if (audioContext) await audioContext.close().catch(() => {});
      audioContext = null;
      analyser = null;
      samples = null;
      setIntensity(0);
      updateButton();
      announce("Audio reactivo desactivado. El micrófono está desconectado.");
    }

    function tick() {
      if (!listening || !analyser || !samples) return;
      analyser.getByteFrequencyData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i];
      const intensity = Math.min(1, (sum / samples.length) / 190);
      setIntensity(intensity);
      rafId = requestAnimationFrame(tick);
    }

    button.addEventListener("click", () => { if (listening) void stop(); else void start(); });

    // On touch devices, tapping the 3D stage triggers a short local pulse without microphone access.
    stage.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch" || listening) return;
      touchIntensity = 1;
      setIntensity(touchIntensity);
      announce("Pulso táctil 3D activado. No se usa el micrófono.");
      if (touchTimer) clearInterval(touchTimer);
      touchTimer = window.setInterval(() => {
        touchIntensity *= 0.78;
        if (touchIntensity < 0.04) {
          clearInterval(touchTimer);
          touchTimer = 0;
          touchIntensity = 0;
          setIntensity(0);
          return;
        }
        setIntensity(touchIntensity);
      }, 40);
    }, { passive: true });

    window.addEventListener("pagehide", () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (touchTimer) clearInterval(touchTimer);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (audioContext) void audioContext.close().catch(() => {});
    });
    updateButton();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
