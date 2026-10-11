// Archivo: js/feed.js
import { rankEvents } from './recommendations.js';
// Nota: supabaseClient se exporta desde el módulo centralizado js/supabase.js
import { supabaseClient } from './supabase.js';

const feedList = document.getElementById('feed-list');
const toastContainer = document.getElementById('toast-container');
let currentUserId = null;
let userContext = {
  joinedEventIds: new Set(),
  savedEventIds: new Set(),
  dismissedEventIds: new Set(),
  groupIds: new Set(),
  interests: []
};

// Notificaciones flotantes
export function showToast(message, duration = 3500) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, duration);
}

// Inicialización de sesión y carga de contexto
async function initSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session && session.user) {
    currentUserId = session.user.id;
    updateHeaderAuth(session.user);
    await loadUserContext(session.user.id);
  }
  await fetchAndRenderFeed();
}

function updateHeaderAuth(user) {
  const container = document.getElementById('auth-header-action');
  if (!container) return;
  container.innerHTML = `
    <a href="perfil.html" style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 0.85rem; font-weight: 600;">${user.user_metadata?.full_name || 'Mi Perfil'}</span>
    </a>
  `;
}

async function loadUserContext(userId) {
  try {
    const [attendeesRes, profileRes] = await Promise.all([
      supabaseClient.from('event_attendees').select('event_id').eq('user_id', userId),
      supabaseClient.from('profiles').select('interests').eq('id', userId).maybeSingle()
    ]);

    if (attendeesRes.data) {
      userContext.joinedEventIds = new Set(attendeesRes.data.map(a => a.event_id));
    }
    if (profileRes.data && profileRes.data.interests) {
      userContext.interests = profileRes.data.interests.map(i => i.toLowerCase());
    }
  } catch (err) {
    console.error('Error al cargar contexto de usuario:', err);
  }
}

// Carga del catálogo de eventos
async function fetchAndRenderFeed() {
  try {
    const { data: events, error } = await supabaseClient
      .from('events')
      .select('id, title, description, date, start_time, location, capacity, category, image_url, group_id, status, registration_deadline')
      .neq('status', 'cancelled')
      .order('date', { ascending: true })
      .limit(30);

    if (error) throw error;

    if (!events || events.length === 0) {
      feedList.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; background: white; border-radius: 16px;">
          <h3>No hay eventos disponibles</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 8px;">Vuelve pronto o crea una actividad en tu grupo.</p>
        </div>
      `;
      return;
    }

    const ranked = rankEvents(events, userContext);
    renderEventCards(ranked);
  } catch (err) {
    feedList.innerHTML = `
      <div style="padding: 24px; background: #fee2e2; border-radius: 12px; color: #b91c1c;">
        <p><strong>Error al cargar el feed:</strong> No se pudo conectar con el catálogo de eventos.</p>
      </div>
    `;
    console.error(err);
  }
}

function renderEventCards(events) {
  feedList.innerHTML = '';
  events.forEach(event => {
    const isJoined = userContext.joinedEventIds.has(event.id);
    const card = document.createElement('article');
    card.className = 'event-card';

    const formattedDate = new Date(event.start_time || event.date).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    card.innerHTML = `
      <div class="event-card-media">
        <img src="${event.image_url || 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=640&q=80'}" alt="${event.title}" loading="lazy">
      </div>
      <div class="event-card-body">
        <div class="event-card-header">
          <span class="badge badge-subtle">${event._recommendationReason}</span>
          ${isJoined ? '<span class="badge badge-joined">Inscrito</span>' : ''}
        </div>
        <div class="event-date-row">
          <span>📅 ${formattedDate}</span>
        </div>
        <h2 class="event-card-title">${event.title}</h2>
        <div class="event-card-meta">
          <span>📍 ${event.location || 'Ubicación por confirmar'}</span>
        </div>
        <div class="event-card-footer">
          <span style="font-size: 0.85rem; color: var(--text-muted);">
            ${event.capacity ? `Cupo: ${event.capacity} personas` : 'Acceso libre'}
          </span>
          <button class="btn ${isJoined ? 'btn-secondary' : 'btn-primary'} rsvp-btn" data-event-id="${event.id}">
            ${isJoined ? 'Ya estás inscrito' : 'Apuntarme'}
          </button>
        </div>
      </div>
    `;

    // Vincular acción de inscripción
    const rsvpBtn = card.querySelector('.rsvp-btn');
    rsvpBtn.addEventListener('click', () => handleRSVP(event.id, rsvpBtn));

    feedList.appendChild(card);
  });
}

// Gestión atómica de RSVP
async function handleRSVP(eventId, buttonElement) {
  if (!currentUserId) {
    showToast('Inicia sesión para apuntarte a este plan');
    setTimeout(() => {
      window.location.href = 'perfil.html?action=login';
    }, 1200);
    return;
  }

  buttonElement.disabled = true;
  buttonElement.textContent = 'Procesando...';

  try {
    const { data, error } = await supabaseClient.rpc('join_event_atomic', {
      p_event_id: eventId,
      p_user_id: currentUserId
    });

    if (error) throw error;

    if (data.success) {
      showToast('¡Te has apuntado con éxito!');
      userContext.joinedEventIds.add(eventId);
      buttonElement.textContent = 'Inscrito';
      buttonElement.className = 'btn btn-secondary rsvp-btn';
    } else {
      showToast(data.message || 'No se pudo completar la inscripción');
      buttonElement.disabled = false;
      buttonElement.textContent = 'Apuntarme';
    }
  } catch (err) {
    console.error('Error en RSVP:', err);
    showToast('Error de red al procesar la reserva');
    buttonElement.disabled = false;
    buttonElement.textContent = 'Apuntarme';
  }
}

// Iniciar al cargar el DOM
document.addEventListener('DOMContentLoaded', initSession);
