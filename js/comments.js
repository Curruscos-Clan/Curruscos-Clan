/**
 * Preguntas y comentarios para la ficha pública de un evento.
 * El contenido y los nombres se insertan con textContent, nunca como HTML.
 */
(function () {
  'use strict';

  const MAX_LENGTH = 500;
  const CLIENT_COOLDOWN_MS = 7000;
  let lastSubmittedAt = 0;
  let realtimeChannel = null;
  let activeEventId = null;

  const escapeText = value => String(value ?? '');
  const safeAvatarUrl = value => {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:' || url.username || url.password) return '';
      return url.href;
    } catch (_) {
      return '';
    }
  };

  function relativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'Hace un momento';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return 'Hace ' + minutes + ' min';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return 'Hace ' + hours + ' h';
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  const CommentsModule = {
    event: null,
    user: null,
    container: null,
    form: null,
    textarea: null,
    submitButton: null,
    counter: null,
    notice: null,

    async init(event, user) {
      if (!event?.id) return;
      const container = document.getElementById('eventCommentsList');
      const form = document.getElementById('eventCommentsForm');
      if (!container || !form) return;

      if (realtimeChannel && window.supabaseClient) {
        await window.supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }

      this.event = event;
      this.user = user || null;
      this.container = container;
      this.form = form;
      this.textarea = form.querySelector('textarea[name="content"]');
      this.submitButton = form.querySelector('button[type="submit"]');
      this.counter = document.getElementById('eventCommentsCounter');
      this.notice = document.getElementById('eventCommentsNotice');
      activeEventId = event.id;

      this.textarea.maxLength = MAX_LENGTH;
      this.textarea.disabled = !this.user || event.status === 'cancelled';
      this.submitButton.disabled = !this.user || event.status === 'cancelled';
      if (!this.user) {
        this.setNotice('Inicia sesión para publicar una pregunta o comentario.', 'hint');
      } else if (event.status === 'cancelled') {
        this.setNotice('Este evento está cancelado y no admite comentarios nuevos.', 'hint');
      } else {
        this.setNotice('', '');
      }

      this.textarea.addEventListener('input', () => this.updateCounter());
      this.updateCounter();
      this.form.addEventListener('submit', eventObject => this.handleSubmit(eventObject));

      await this.loadComments();
      this.subscribeRealtime();
    },

    updateCounter() {
      if (this.counter && this.textarea) {
        this.counter.textContent = this.textarea.value.length + '/' + MAX_LENGTH;
      }
    },

    setNotice(message, kind) {
      if (!this.notice) return;
      this.notice.textContent = message;
      this.notice.className = 'event-comments-notice' + (kind ? ' ' + kind : '');
      this.notice.hidden = !message;
    },

    async loadComments() {
      if (!window.supabaseClient || !activeEventId) {
        this.showLoadError('No se ha podido conectar con los comentarios. Recarga la página para intentarlo de nuevo.');
        return;
      }
      this.container.setAttribute('aria-busy', 'true');
      try {
        const { data, error } = await window.supabaseClient
          .from('event_comments')
          .select('id, event_id, user_id, content, author_display_name, author_avatar_url, created_at')
          .eq('event_id', activeEventId)
          .order('created_at', { ascending: true })
          .limit(200);
        if (error) throw error;
        this.renderList(data || []);
      } catch (error) {
        console.error('Error cargando comentarios:', error);
        this.showLoadError('No se han podido cargar los comentarios. Comprueba la conexión e inténtalo de nuevo.');
      } finally {
        this.container.setAttribute('aria-busy', 'false');
      }
    },

    showLoadError(message) {
      this.container.replaceChildren();
      const state = createElement('div', 'event-comments-empty', message);
      const retry = createElement('button', 'event-comments-retry', 'Reintentar');
      retry.type = 'button';
      retry.addEventListener('click', () => this.loadComments());
      state.appendChild(retry);
      this.container.appendChild(state);
    },

    renderList(comments) {
      this.container.replaceChildren();
      if (!comments.length) {
        this.container.appendChild(createElement(
          'div',
          'event-comments-empty',
          'Aún no hay preguntas ni comentarios. ¡Sé el primero en participar!'
        ));
        return;
      }

      comments.forEach(comment => {
        const item = createElement('article', 'event-comment');
        item.dataset.commentId = comment.id;

        const avatarUrl = safeAvatarUrl(comment.author_avatar_url);
        if (avatarUrl) {
          const image = createElement('img', 'event-comment-avatar');
          image.src = avatarUrl;
          image.alt = '';
          image.loading = 'lazy';
          image.referrerPolicy = 'no-referrer';
          image.addEventListener('error', () => {
            const fallback = createElement(
              'span',
              'event-comment-avatar event-comment-avatar-fallback',
              (comment.author_display_name || 'M').trim().charAt(0).toUpperCase()
            );
            image.replaceWith(fallback);
          }, { once: true });
          item.appendChild(image);
        } else {
          item.appendChild(createElement(
            'span',
            'event-comment-avatar event-comment-avatar-fallback',
            (comment.author_display_name || 'M').trim().charAt(0).toUpperCase()
          ));
        }

        const body = createElement('div', 'event-comment-body');
        const heading = createElement('div', 'event-comment-meta');
        heading.appendChild(createElement(
          'strong',
          'event-comment-author',
          comment.author_display_name || 'Miembro de Curruscos'
        ));
        heading.appendChild(createElement('time', 'event-comment-time', relativeTime(comment.created_at)));
        body.appendChild(heading);
        body.appendChild(createElement('p', 'event-comment-content', escapeText(comment.content)));

        const canDelete = !!this.user && (
          this.user.id === comment.user_id ||
          this.user.id === this.event?.created_by
        );
        if (canDelete) {
          const actions = createElement('div', 'event-comment-actions');
          const remove = createElement('button', 'event-comment-delete', 'Eliminar');
          remove.type = 'button';
          remove.addEventListener('click', () => this.deleteComment(comment, remove));
          actions.appendChild(remove);
          body.appendChild(actions);
        }

        item.appendChild(body);
        this.container.appendChild(item);
      });
    },

    async handleSubmit(eventObject) {
      eventObject.preventDefault();
      if (!this.user || !this.event || !window.supabaseClient) {
        this.setNotice('Inicia sesión para publicar comentarios.', 'error');
        return;
      }
      const text = String(this.textarea.value || '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim();
      if (!text || text.length > MAX_LENGTH) {
        this.setNotice('Escribe un comentario de entre 1 y 500 caracteres.', 'error');
        return;
      }
      const wait = CLIENT_COOLDOWN_MS - (Date.now() - lastSubmittedAt);
      if (wait > 0) {
        this.setNotice('Espera ' + Math.ceil(wait / 1000) + ' segundos antes de publicar otro comentario.', 'hint');
        return;
      }

      lastSubmittedAt = Date.now();
      this.submitButton.disabled = true;
      this.submitButton.textContent = 'Publicando…';
      this.setNotice('', '');
      try {
        const { data: authData, error: authError } = await window.supabaseClient.auth.getUser();
        if (authError) throw authError;
        if (!authData?.user || authData.user.id !== this.user.id) {
          this.user = null;
          this.textarea.disabled = true;
          this.setNotice('Tu sesión ha caducado. Inicia sesión de nuevo para comentar.', 'error');
          return;
        }

        const { error } = await window.supabaseClient
          .from('event_comments')
          .insert({
            event_id: this.event.id,
            user_id: authData.user.id,
            content: text
          });
        if (error) throw error;

        this.textarea.value = '';
        this.updateCounter();
        this.setNotice('Comentario publicado.', 'success');
        await this.loadComments();
      } catch (error) {
        console.error('Error publicando comentario:', error);
        const message = String(error?.message || '');
        this.setNotice(
          message.includes('demasiados comentarios')
            ? 'Has publicado demasiados comentarios. Espera un minuto e inténtalo de nuevo.'
            : 'No se ha podido publicar el comentario. Comprueba tu sesión e inténtalo de nuevo.',
          'error'
        );
      } finally {
        this.submitButton.disabled = !this.user || this.event?.status === 'cancelled';
        this.submitButton.textContent = 'Publicar comentario';
      }
    },

    async deleteComment(comment, button) {
      if (!window.supabaseClient || !this.event) return;
      if (!window.confirm('¿Quieres eliminar este comentario?')) return;
      button.disabled = true;
      button.textContent = 'Eliminando…';
      try {
        const { data, error } = await window.supabaseClient
          .from('event_comments')
          .delete()
          .eq('id', comment.id)
          .eq('event_id', this.event.id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('No tienes permiso para eliminar este comentario.');
        await this.loadComments();
        this.setNotice('Comentario eliminado.', 'success');
      } catch (error) {
        console.error('Error eliminando comentario:', error);
        this.setNotice(error?.message || 'No se ha podido eliminar el comentario.', 'error');
        button.disabled = false;
        button.textContent = 'Eliminar';
      }
    },

    subscribeRealtime() {
      if (!window.supabaseClient || !activeEventId) return;
      realtimeChannel = window.supabaseClient
        .channel('event-comments-' + activeEventId)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'event_comments',
          filter: 'event_id=eq.' + activeEventId
        }, payload => {
          if (payload?.new?.event_id === activeEventId) this.loadComments();
        })
        .subscribe(status => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('Realtime de comentarios no disponible; se mantiene la carga manual.');
          }
        });
    }
  };

  window.CommentsModule = CommentsModule;
})();
