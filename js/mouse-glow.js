/**
 * Mouse-follow specular glow for dynamically rendered Curruscos event cards.
 * Coordinates are local to each card; touch interactions remain untouched.
 */
(() => {
  'use strict';

  const onPointerMove = (event) => {
    if (event.pointerType === 'touch') return;
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest('.event-card');
    if (!card) return;

    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', (event.clientX - rect.left) + 'px');
    card.style.setProperty('--mouse-y', (event.clientY - rect.top) + 'px');
  };

  document.addEventListener('pointermove', onPointerMove, { passive: true });
})();
