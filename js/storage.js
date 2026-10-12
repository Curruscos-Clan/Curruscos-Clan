/**
 * Curruscos Storage — imágenes públicas optimizadas en el navegador.
 * Requiere el único cliente compartido definido en js/supabase.js y los
 * buckets públicos avatars / event-covers con políticas por carpeta de usuario.
 */
(function () {
  "use strict";

  const BUCKET_COVERS = "event-covers";
  const BUCKET_AVATARS = "avatars";
  const MAX_INPUT_BYTES = 20 * 1024 * 1024;
  const ALLOWED_INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

  function getClient() {
    const client = window.supabaseClient;
    if (!client || !client.storage || !client.auth) {
      throw new Error("El almacenamiento de Curruscos no está disponible. Recarga la página e inténtalo de nuevo.");
    }
    return client;
  }

  function extensionFor(type) {
    return type === "image/webp" ? "webp" : "jpg";
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        URL.revokeObjectURL(url);
        if (!image.naturalWidth || !image.naturalHeight) {
          reject(new Error("La imagen no tiene dimensiones válidas."));
          return;
        }
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se ha podido abrir la imagen. Prueba con JPG, PNG o WebP."));
      };
      image.src = url;
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se ha podido optimizar la imagen.")), type, quality);
      } catch (error) {
        reject(error);
      }
    });
  }

  async function compressImageFile(file, maxWidth = 1280, maxHeight = 720, quality = 0.82, options = {}) {
    if (!(file instanceof File)) throw new Error("Selecciona un archivo de imagen.");
    if (!ALLOWED_INPUT_TYPES.has(String(file.type || "").toLowerCase())) {
      throw new Error("El formato no es compatible. Utiliza JPG, PNG, WebP o AVIF.");
    }
    if (file.size <= 0 || file.size > MAX_INPUT_BYTES) {
      throw new Error("La imagen debe ocupar menos de 20 MB antes de optimizarla.");
    }

    const img = await readImage(file);
    const square = options.square === true;
    const sourceSide = Math.min(img.naturalWidth, img.naturalHeight);
    const sourceX = square ? Math.floor((img.naturalWidth - sourceSide) / 2) : 0;
    const sourceY = square ? Math.floor((img.naturalHeight - sourceSide) / 2) : 0;
    const sourceWidth = square ? sourceSide : img.naturalWidth;
    const sourceHeight = square ? sourceSide : img.naturalHeight;
    const ratio = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
    const width = Math.max(1, Math.round(sourceWidth * ratio));
    const height = Math.max(1, Math.round(sourceHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Este navegador no puede optimizar la imagen.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);

    let blob;
    try {
      blob = await canvasBlob(canvas, "image/webp", quality);
    } catch (_) {
      blob = null;
    }
    if (!blob || blob.type !== "image/webp") {
      blob = await canvasBlob(canvas, "image/jpeg", quality);
    }
    if (!blob || !["image/webp", "image/jpeg"].includes(blob.type)) {
      throw new Error("Tu navegador no ha podido generar una imagen optimizada.");
    }

    const baseName = String(file.name || "imagen").replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) || "imagen";
    return new File([blob], baseName + "." + extensionFor(blob.type), {
      type: blob.type,
      lastModified: Date.now()
    });
  }

  async function requireCurrentUser(expectedUserId) {
    const client = getClient();
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    const user = data?.user;
    if (!user) throw new Error("Inicia sesión para subir imágenes.");
    if (expectedUserId && user.id !== expectedUserId) {
      throw new Error("Solo puedes subir imágenes a tu propia cuenta.");
    }
    return { client, user };
  }

  function safePublicUrl(client, bucket, path) {
    const { data } = client.storage.from(bucket).getPublicUrl(path);
    const url = data?.publicUrl;
    if (!url || !/^https:\/\//i.test(url)) {
      throw new Error("Supabase no ha devuelto una URL pública válida.");
    }
    return url;
  }

  async function uploadImage(bucket, file, maxWidth, maxHeight, quality, options = {}) {
    const { client, user } = await requireCurrentUser(options.userId);
    const compressed = await compressImageFile(file, maxWidth, maxHeight, quality, options);
    const suffix = (window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2, 12));
    const prefix = options.prefix ? String(options.prefix).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) + "-" : "";
    const path = user.id + "/" + prefix + Date.now() + "-" + suffix + "." + extensionFor(compressed.type);

    const { data, error } = await client.storage.from(bucket).upload(path, compressed, {
      cacheControl: "31536000",
      contentType: compressed.type,
      upsert: false
    });
    if (error) {
      console.error("Error subiendo imagen a Supabase Storage:", error);
      throw new Error(error.message || "No se ha podido subir la imagen. Inténtalo de nuevo.");
    }

    return {
      url: safePublicUrl(client, bucket, data.path || path),
      path: data.path || path,
      bucket
    };
  }

  async function removeUploadedImage(bucket, path) {
    const { client, user } = await requireCurrentUser();
    if (!path || typeof path !== "string" || path.split("/")[0] !== user.id) {
      throw new Error("Solo puedes borrar imágenes que hayas subido tú.");
    }
    const { error } = await client.storage.from(bucket).remove([path]);
    if (error) throw new Error(error.message || "No se ha podido limpiar la imagen.");
    return true;
  }

  function pathFromPublicUrl(bucket, urlValue) {
    let url;
    try { url = new URL(String(urlValue || "")); } catch (_) { return null; }
    const client = getClient();
    const projectOrigin = new URL(client.storage.from(bucket).getPublicUrl("check").data.publicUrl).origin;
    const prefix = "/storage/v1/object/public/" + bucket + "/";
    if (url.protocol !== "https:" || url.origin !== projectOrigin || !url.pathname.startsWith(prefix)) return null;
    const encodedPath = url.pathname.slice(prefix.length);
    let path;
    try { path = decodeURIComponent(encodedPath); } catch (_) { return null; }
    return path || null;
  }

  const AppStorage = {
    compressImageFile,
    async uploadEventCover(file) {
      const result = await uploadImage(BUCKET_COVERS, file, 1280, 720, 0.82, { prefix: "cover" });
      return result.url;
    },
    async uploadUserAvatar(file, userId) {
      const result = await uploadImage(BUCKET_AVATARS, file, 300, 300, 0.85, { square: true, prefix: "avatar", userId });
      return result.url;
    },
    async removeEventCover(publicUrl) {
      const path = pathFromPublicUrl(BUCKET_COVERS, publicUrl);
      if (!path) throw new Error("La URL no pertenece al bucket de portadas de Curruscos.");
      return removeUploadedImage(BUCKET_COVERS, path);
    },
    async removeUserAvatar(publicUrl) {
      const path = pathFromPublicUrl(BUCKET_AVATARS, publicUrl);
      if (!path) throw new Error("La URL no pertenece al bucket de avatares de Curruscos.");
      return removeUploadedImage(BUCKET_AVATARS, path);
    }
  };

  window.AppStorage = AppStorage;
})();