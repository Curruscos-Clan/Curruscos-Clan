/**
 * Muro y comentarios de comunidades.
 * Renderizado seguro con textContent; RLS en Supabase es la autoridad de permisos.
 */
(function () {
  "use strict";
  const channels = new Map();
  const fallbackAvatar = "assets/icon.svg";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function safeAvatar(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" ? url.href : fallbackAvatar;
    } catch (_) { return fallbackAvatar; }
  }
  function timeAgo(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "Ahora mismo";
    if (seconds < 3600) return "Hace " + Math.floor(seconds / 60) + " min";
    if (seconds < 86400) return "Hace " + Math.floor(seconds / 3600) + " h";
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }
  function makeAvatar(profile, label) {
    const image = el("img", "community-post-avatar");
    image.src = safeAvatar(profile && profile.avatar_url);
    image.alt = label || "Avatar";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.onerror = () => { image.onerror = null; image.src = fallbackAvatar; };
    return image;
  }

  const CommunityChat = {
    async mount(group, container) {
      if (!group || !group.id || !container) return;
      await this.cleanup(group.id);
      container.replaceChildren();
      const userResult = window.supabaseClient
        ? await window.supabaseClient.auth.getUser()
        : { data: { user: null } };
      const user = userResult.data && userResult.data.user;
      const canPost = Boolean(user && group.is_member);
      const heading = el("div", "community-wall-heading");
      heading.append(el("h3", "", "Muro de la comunidad"), el("p", "", "Publicaciones y conversación del grupo."));
      container.append(heading);

      if (canPost) {
        const form = el("form", "community-post-form");
        const title = el("input", "");
        title.type = "text";
        title.name = "title";
        title.maxLength = 120;
        title.placeholder = "Título (opcional)";
        title.setAttribute("aria-label", "Título de la publicación");
        const content = el("textarea", "");
        content.name = "content";
        content.rows = 3;
        content.maxLength = 2000;
        content.required = true;
        content.placeholder = "Comparte algo con la comunidad…";
        content.setAttribute("aria-label", "Contenido de la publicación");
        const submit = el("button", "join-button", "Publicar");
        submit.type = "submit";
        form.append(title, content, submit);
        form.addEventListener("submit", async event => {
          event.preventDefault();
          const text = content.value.trim();
          if (!text) return;
          submit.disabled = true;
          try {
            const { error } = await window.supabaseClient.from("community_posts").insert({
              group_id: group.id, author_id: user.id,
              title: title.value.trim() || null, content: text
            });
            if (error) throw error;
            title.value = "";
            content.value = "";
            await this.load(group, list, status);
          } catch (error) {
            status.textContent = error.message || "No se ha podido publicar. Comprueba que sigues siendo miembro.";
          } finally { submit.disabled = false; }
        });
        container.append(form);
      } else {
        container.append(el("p", "community-wall-hint", user
          ? "Únete a este grupo para publicar y responder."
          : "Inicia sesión y únete a este grupo para participar."));
      }
      const status = el("p", "community-wall-status", "Cargando publicaciones…");
      status.setAttribute("role", "status");
      const list = el("div", "community-post-list");
      container.append(status, list);
      await this.load(group, list, status);
      this.subscribe(group, list, status);
    },

    async load(group, list, status) {
      if (!window.supabaseClient) {
        status.textContent = "La conexión no está disponible.";
        return;
      }
      const { data, error } = await window.supabaseClient
        .from("community_posts")
        .select("id, group_id, author_id, title, content, pinned, created_at, profiles(display_name, username, avatar_url)")
        .eq("group_id", group.id)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        status.textContent = "No se ha podido cargar el muro. Comprueba que la migración esté aplicada y tus permisos.";
        console.warn("CommunityChat load:", error);
        return;
      }
      list.replaceChildren();
      status.textContent = data.length ? data.length + (data.length === 1 ? " publicación" : " publicaciones") : "Todavía no hay publicaciones.";
      for (const post of data) {
        const card = el("article", "community-post");
        const header = el("div", "community-post-author");
        const profile = post.profiles || {};
        const name = profile.display_name || profile.username || "Miembro";
        header.append(makeAvatar(profile, name));
        const identity = el("div", "community-post-identity");
        identity.append(el("strong", "", name), el("small", "", timeAgo(post.created_at)));
        header.append(identity);
        if (post.pinned) header.append(el("span", "community-post-pinned", "Fijado"));
        card.append(header);
        if (post.title) card.append(el("h4", "community-post-title", post.title));
        card.append(el("p", "community-post-content", post.content));
        const comments = el("div", "community-post-comments");
        const commentList = el("div", "community-post-comment-list");
        const commentForm = el("form", "community-post-comment-form");
        const input = el("input", "");
        input.type = "text";
        input.name = "content";
        input.maxLength = 800;
        input.required = true;
        input.placeholder = "Escribe una respuesta…";
        input.setAttribute("aria-label", "Respuesta a " + (post.title || "la publicación"));
        const send = el("button", "", "Responder");
        send.type = "submit";
        if (!group.is_member) { input.disabled = true; send.disabled = true; }
        commentForm.append(input, send);
        commentForm.addEventListener("submit", async event => {
          event.preventDefault();
          const content = input.value.trim();
          if (!content) return;
          send.disabled = true;
          try {
            const { data: authData } = await window.supabaseClient.auth.getUser();
            if (!authData?.user || !group.is_member) throw new Error("Debes iniciar sesión y ser miembro para responder.");
            const { error } = await window.supabaseClient.from("community_post_comments").insert({
              post_id: post.id, author_id: authData.user.id, content
            });
            if (error) throw error;
            input.value = "";
            await this.loadComments(post.id, commentList);
          } catch (error) {
            commentList.append(el("p", "community-wall-error", error.message || "No se ha podido responder."));
          } finally { send.disabled = false; }
        });
        comments.append(commentList, commentForm);
        card.append(comments);
        list.append(card);
        await this.loadComments(post.id, commentList);
      }
    },

    async loadComments(postId, container) {
      const { data, error } = await window.supabaseClient
        .from("community_post_comments")
        .select("id, author_id, content, created_at, profiles(display_name, username, avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) {
        container.replaceChildren(el("p", "community-wall-error", "No se han podido cargar las respuestas."));
        return;
      }
      container.replaceChildren();
      for (const comment of data || []) {
        const profile = comment.profiles || {};
        const name = profile.display_name || profile.username || "Miembro";
        const row = el("div", "community-post-comment");
        row.append(makeAvatar(profile, name));
        const copy = el("div", "community-post-comment-copy");
        copy.append(el("strong", "", name), el("p", "", comment.content), el("small", "", timeAgo(comment.created_at)));
        row.append(copy);
        container.append(row);
      }
    },

    subscribe(group, list, status) {
      if (!window.supabaseClient) return;
      const groupChannel = window.supabaseClient
        .channel("community-posts-" + group.id)
        .on("postgres_changes", { event: "*", schema: "public", table: "community_posts", filter: "group_id=eq." + group.id },
          () => this.load(group, list, status))
        .subscribe();
      channels.set(group.id, [groupChannel]);
    },

    async cleanup(groupId) {
      const old = channels.get(groupId) || [];
      if (window.supabaseClient) {
        for (const channel of old) await window.supabaseClient.removeChannel(channel);
      }
      channels.delete(groupId);
    }
  };

  window.CommunityChat = CommunityChat;
})();