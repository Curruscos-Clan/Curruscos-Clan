// Archivo: js/recommendations.js
/**
 * Motor Heurístico de Recomendaciones para Curruscos Clan
 * Basado en matriz de afinidad, urgencia temporal y proximidad geográfica.
 */

export function calculateEventScore(event, userContext) {
  let score = 0;
  const reasons = [];
  const now = new Date();
  const eventDate = new Date(event.start_time || event.date);

  // 1. Filtro estricto: Descartar eventos ya acontecidos o cancelados
  if (eventDate < now || event.status === 'cancelled') {
    return { score: -999, reasons: [] };
  }

  // 2. Filtro estricto: Descartar si el usuario ya está inscrito (salvo pestaña específica)
  if (userContext.joinedEventIds && userContext.joinedEventIds.has(event.id)) {
    return { score: -500, reasons: ['Ya estás inscrito'] };
  }

  // 3. Proximidad Temporal (Urgencia 48h - 72h)
  const hoursUntilEvent = (eventDate - now) / (1000 * 60 * 60);
  if (hoursUntilEvent > 0 && hoursUntilEvent <= 48) {
    score += 15;
    reasons.push('Próximo (en las próximas 48 horas)');
  } else if (hoursUntilEvent > 48 && hoursUntilEvent <= 120) {
    score += 8;
    reasons.push('Para este fin de semana');
  }

  // 4. Afinidad con intereses explícitos del usuario
  if (userContext.interests && event.category) {
    if (userContext.interests.includes(event.category.toLowerCase())) {
      score += 10;
      reasons.push(`Coincide con tu interés en ${event.category}`);
    }
  }

  // 5. Relación con grupos que sigue o a los que pertenece
  if (userContext.groupIds && userContext.groupIds.has(event.group_id)) {
    score += 12;
    reasons.push('De un grupo al que perteneces');
  }

  // 6. Afinidad con eventos guardados anteriormente
  if (userContext.savedEventIds && userContext.savedEventIds.has(event.id)) {
    score += 5;
    reasons.push('En tu lista de guardados');
  }

  // 7. Penalización por descarte reciente (Feedback negativo)
  if (userContext.dismissedEventIds && userContext.dismissedEventIds.has(event.id)) {
    score -= 50;
  }

  return {
    score,
    primaryReason: reasons[0] || 'Actividad destacada de la comunidad'
  };
}

export function rankEvents(events, userContext) {
  return events
    .map(event => {
      const evaluation = calculateEventScore(event, userContext);
      return {
        ...event,
        _score: evaluation.score,
        _recommendationReason: evaluation.primaryReason
      };
    })
    .filter(event => event._score > -100)
    .sort((a, b) => b._score - a._score);
}
