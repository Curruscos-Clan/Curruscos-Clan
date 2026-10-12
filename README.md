# Curruscos Clan

Curruscos Clan es una plataforma web social para descubrir actividades, organizar eventos y participar en grupos, torneos y planes. El producto evoluciona hacia una plataforma multi-grupo; el clan original funciona como comunidad de prueba, no como límite del producto.

**Sitio publicado:** https://curruscos-clan.github.io/Curruscos-Clan/

## Arquitectura actual

- **Frontend:** HTML semántico, CSS y JavaScript sin framework ni paso de compilación.
- **Backend:** Supabase Auth, PostgreSQL, Row Level Security (RLS), Realtime y Storage.
- **Hosting activo:** GitHub Pages con despliegue desde GitHub Actions.
- **Cliente compartido:** `js/supabase.js` crea una sola instancia Supabase y la expone como `window.supabaseClient`.
- **Diseño:** `css/design-system.css` se usa en la experiencia de feed y otras páginas; `css/style.css` y estilos específicos siguen presentes en páginas que se han migrado progresivamente.

La aplicación **no usa Vite ni un comando de build** actualmente. Los ficheros `_headers`, `_redirects` y `.env.example` son material de preparación para una posible migración futura a Cloudflare Pages; GitHub Pages no aplica esas reglas.

## Páginas principales

| Ruta | Función |
| --- | --- |
| `index.html` | Feed de inicio y recomendaciones |
| `explorar.html` | Descubrimiento de eventos y perfiles |
| `evento-publico.html?id=<uuid>` | Ficha de evento, inscripciones, resultados y comentarios |
| `crear-evento.html` | Creación de eventos públicos |
| `mis-planes.html` / `mis-eventos.html` | Inscripciones y eventos organizados |
| `eventos.html` / `dashboard.html` | Vista de grupo y espacio de trabajo |
| `perfil.html` / `perfil-publico.html?id=<uuid>` | Perfil propio y perfiles públicos |
| `notificaciones.html` | Centro de actividad, notificaciones e invitaciones |
| `chat.html` | Conversaciones |
| `tests/integration-test.html` | Pruebas manuales de integración |

## Módulos importantes

- `js/supabase.js`: cliente, autenticación y funciones de datos compartidas.
- `js/app.js`: componentes globales, navegación, control de sesión y centro de notificaciones.
- `js/notificaciones.js`: renderizado del historial de actividad, invitaciones y marcado de lectura.
- `js/comments.js`: comentarios, límites de publicación, eliminación autorizada y suscripción a Supabase Realtime.
- `js/storage.js`: optimización y subida de imágenes de perfil y portadas a los buckets públicos `avatars` y `event-covers`.
- `js/tilt-3d.js`: efecto sutil para tarjetas, con respeto a la preferencia de movimiento reducido.
- `js/evento-publico.js`: renderizado e interacción de la ficha pública del evento.

## Desarrollo local

No es necesario instalar Node ni compilar la web para abrir las páginas estáticas. Desde la raíz del repositorio, ejecuta:

```bash
python3 -m http.server 8080
```

Abre http://localhost:8080 en el navegador. También puedes usar la extensión Live Server de VS Code.

La autenticación, las consultas y el almacenamiento siguen conectándose al proyecto Supabase configurado en `js/supabase.js`; levantar un servidor local no crea una base de datos aislada.

## Supabase y migraciones

Las migraciones versionadas están en `supabase/migrations/`. El esquema actual ya contiene tablas, funciones, permisos y triggers previos, por lo que el historial no debe tratarse como un único SQL nuevo para pegar varias veces en el SQL Editor.

- En un entorno existente, revisa el historial de migraciones de Supabase y aplica únicamente las migraciones pendientes, respetando el orden de sus marcas de tiempo.
- **No se deben volver a ejecutar migraciones antiguas sobre la base de datos activa** sin revisar antes su historial. Algunas crean funciones, políticas, triggers o restricciones que ya existen.
- La configuración de Storage para `avatars` y `event-covers` ya está definida por una migración anterior. La migración de comentarios reutiliza esos buckets y el esquema existente de `public.notifications`; no crea tablas paralelas.
- Las tablas expuestas del esquema `public` necesitan RLS y permisos coherentes con el acceso previsto. No elimines políticas existentes para resolver un error de acceso sin analizar qué páginas y tipos de grupo dependen de ellas.
- Para el frontend se utiliza la URL del proyecto y la clave **publishable** (o la antigua clave anon). Son valores de cliente. **Nunca incluyas una clave `service_role` ni una clave secreta en HTML, JavaScript o el repositorio.**

Para un proyecto Supabase totalmente nuevo, este repositorio debe revisarse como un conjunto de migraciones incrementales antes de usarlo como bootstrap: no asumas que aplicar solamente la última migración crea todo el esquema histórico.

## Cambios en la base de datos

- Los comentarios de evento tienen longitud máxima de 500 caracteres, un límite de frecuencia aplicado en PostgreSQL y políticas RLS que diferencian eventos públicos de eventos visibles para miembros del grupo.
- Los nombres y avatares públicos del comentario se guardan como una instantánea controlada por un trigger; el autor no puede falsificar esos campos con la petición de inserción.
- Los avisos usan la tabla existente `public.notifications`, con `is_read` y `reference_id`. No se deben cambiar a `read`, `actor_id` o `event_id` sin migrar y actualizar todo el sistema.
- Los comentarios se añaden a la publicación `supabase_realtime` sin recrear la publicación ni retirar sus tablas existentes.

## Pruebas

Los workflows de GitHub Actions ejecutan comprobaciones estáticas, de sintaxis JavaScript y contratos de regresión por las rutas que toca cada cambio. También existe un panel manual en `tests/integration-test.html`.

Las pruebas estáticas no sustituyen una comprobación de extremo a extremo con una sesión real del navegador. En especial, las subidas a Storage y los flujos que dependen de sesión deben probarse en la web con una cuenta de prueba antes de considerarlos completamente verificados.

## Despliegue

El sitio activo se publica en GitHub Pages: https://curruscos-clan.github.io/Curruscos-Clan/

1. Integra los cambios mediante una rama y un pull request.
2. Espera a que finalicen los checks de GitHub Actions asociados al pull request.
3. Fusiona los cambios aprobados en `main`.
4. Comprueba el workflow de despliegue de GitHub Pages y después abre la URL pública.

Los archivos de configuración de Cloudflare Pages incluidos en el repositorio no cambian este flujo. Para migrar de hosting habrá que configurar el proyecto de Cloudflare y comprobar las cabeceras, rutas y configuración del frontend expresamente.
