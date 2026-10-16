# Flujo de trabajo con funciones de IA separadas

Este documento define un proceso para que Curruscos use tres funciones separadas sin confundirlas con agentes autónomos que todavía no estén conectados.

## 1. Desarrollador
- Trabaja en una rama propia; no modifica `main` directamente.
- Explica el objetivo, los archivos cambiados y las limitaciones.
- Añade o actualiza pruebas relevantes y abre un Pull Request.

## 2. Revisor independiente
- Revisa el diff, no solo el resumen del desarrollador.
- Busca errores de lógica, regresiones, riesgos de seguridad, permisos incorrectos y migraciones peligrosas.
- Ejecuta o inspecciona las pruebas y deja observaciones concretas en el PR.
- No modifica ni aprueba automáticamente el trabajo por el mero hecho de que pase CI.

## 3. Integrador
- Comprueba que las observaciones están resueltas, que las comprobaciones automáticas pasan y que la rama se puede integrar sin conflictos.
- No fusiona cambios con fallos conocidos ni afirma que una prueba manual se ha ejecutado si no se ha ejecutado.
- Para cambios de Supabase, exige revisión explícita de la migración y de las implicaciones de seguridad antes de desplegarla.

## Comunicación
El Pull Request es el registro compartido: descripción del desarrollador, revisión independiente, respuestas a observaciones y decisión final. Las decisiones importantes deben quedar por escrito en el PR, no solo en conversaciones privadas.

## Límite actual
Este protocolo y la plantilla de PR organizan el trabajo, pero **no crean por sí solos agentes de IA ni una revisión automática con un modelo**. Para eso hace falta conectar un agente/revisor compatible (por ejemplo, una integración de GitHub/Codex o un servicio de API) y configurar sus permisos. Hasta que exista esa integración, una revisión automática de CI solo comprueba lo que sus scripts tienen programado.
