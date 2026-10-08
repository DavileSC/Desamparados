---
name: revision
description: Revisión de cambios propia del proyecto Desamparados, con las trampas conocidas de este código. Usar cuando se pida revisar un diff, una rama o un trabajo antes de commitear o desplegar. Complementa a /code-review (fallos generales) y a security-audit (seguridad a fondo); no los sustituye.
---

# Revisión de cambios

Primero `git diff` / `git status` enteros: saber qué ha cambiado de verdad,
incluidos ficheros que no deberían estar (`vite.config.ts` del túnel, `.env`,
volcados, `storage/`).

## Orden

1. **Fallos**: comportamiento incorrecto, casos límite, regresiones.
2. **Seguridad**: permisos y datos personales (abajo). Para algo delicado,
   pasar además `security-audit`.
3. **Tipos**: `npm run comprobar-tipos` y `npx tsc -b`, no `--noEmit`.
4. **Arquitectura**: cada cosa en su capa (skills `backend` y `frontend`),
   catálogos de `shared/` tocados en los dos lados.
5. **Duplicación y mantenimiento**: ¿ya existe una pieza que lo hace?
6. **Rendimiento**: consultas en bucle, fotos sin tope, el VPS es modesto.

Problemas reales antes que gustos de estilo.

## Lista propia de este proyecto

- ¿Ruta nueva declarada **antes** de un `.use(authenticateToken)`? ¿Lleva sus
  middlewares en línea? ¿`checkRole` en toda ruta de staff?
- ¿`orderBy` paginado sin desempate `{ id: 'asc' }`? ¿Esquema con `query` que
  olvida `...paginacionQuery`?
- ¿Cambia la forma de un JSON guardado sin migración de contenido?
- ¿Migración nueva con nombre y fecha correlativos? ¿Anotada para el despliegue?
- ¿Datos personales en logs, auditoría, asuntos de correo o respuestas que no
  los necesitan? ¿HTML del CMS saneado?
- ¿Texto visible con «Hermandad», «Cofradía» o «Sagrados Titulares»? ¿«Tus
  hijos» donde el tutor puede no ser el padre?
- ¿Datos del Grupo escritos a mano en vez de `instalacion/datos-entidad.json` o
  `config/site.ts`? ¿Algo inventado sin marcar como ejemplo?
- ¿Prueba que pasa sin mirar (skip como función, `queryByRole` con un diálogo
  abierto, `as unknown as`)?
- ¿Color nuevo sin contraste AA comprobado?

## Informe

Cada hallazgo con fichero y línea, qué falla, cómo se reproduce y la
propuesta. Si no hay nada, decirlo claro.
