## Objetivo del cambio
<!-- Qué problema resuelve y qué comportamiento cambia. -->

## Revisión independiente
- [ ] Revisado por alguien distinto de quien implementó el cambio.
- [ ] Se han buscado errores lógicos, regresiones y problemas de seguridad.
- [ ] Se han comprobado permisos y validaciones en servidor cuando corresponda.
- [ ] Las migraciones de Supabase se han revisado; no se han aplicado manualmente sin aprobación.

## Verificación
- [ ] Pruebas automáticas relevantes superadas.
- [ ] Se ha comprobado la página o flujo afectado.
- [ ] Se han revisado móvil y escritorio si afecta a la interfaz.
- [ ] Se indican las pruebas que no se han podido ejecutar.

## Riesgos y despliegue
- Riesgos conocidos:
- Cambios de base de datos/configuración:
- Evidencia de pruebas (enlaces o resultados):

## Decisión del integrador
- [ ] Aprobado: revisión independiente y comprobaciones completadas.
- [ ] Bloqueado: faltan pruebas, hay conflictos o quedan observaciones sin resolver.

**Regla:** quien implementa no debe dar por verificado su propio cambio. No se debe fusionar ni desplegar solo porque el código esté escrito.
