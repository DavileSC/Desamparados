# Arreglos cerrados — plan de implementación (fase 1 de 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los cuatro hallazgos que no dependen de ningún otro: el menú del CMS que desaparece en tema claro, la auditoría que se ve en el Inicio, el formulario de alta que valida más flojo que el servidor, y la garantía de que ningún hermano activo se queda sin número.

**Architecture:** Cuatro bloques sin relación entre sí. El único que toca los dos proyectos a la vez es el de validación: las reglas se copian del servidor al frontend y una tabla de casos compartida (`shared/casos-identidad.json`) impide que se separen, porque los dos proyectos la leen en sus tests.

**Tech Stack:** Backend Express 5 + Prisma (MySQL/MariaDB) + ArkType, tests con `node:test` vía `tsx`. Frontend React 19 + MUI + Zod + react-hook-form, tests con Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-14-sesiones-separadas-y-area-del-hermano-design.md` (secciones 5, 10, 11 y 12)

## Global Constraints

- **Idioma:** todo el código, los comentarios, los nombres de test y los textos de interfaz van en **español**, con tildes y eñes correctas. Es la norma del repositorio entero.
- **Comentarios:** explican *por qué*, no *qué*. El repositorio los usa para dejar constancia del fallo que cerró cada decisión; mantén ese estilo.
- **Backend — comando de test:** `npm test` en `backend-desamparados/` (ejecuta `test/**/*.test.ts` con `--test-concurrency=1`).
- **Frontend — comando de test:** `npm test` en `desamparados-web/` (Vitest, una pasada).
- **Tests que necesitan base de datos:** se omiten con motivo si no hay MariaDB levantada, siguiendo el patrón de `test/permisos-hermano-mayor.test.ts` (`sondearDb()` con tiempo límite de 3 s). El CI no levanta base de datos.
- **Usuarios de prueba:** `test/fixtures/usuarios.ts` → `crearUsuarioPrueba(role)` y `borrarUsuarioPrueba(id)`. Nunca crees usuarios a mano.
- **Anti mass-assignment:** el objeto que llega a Prisma se construye **solo** con claves de una lista blanca. Nunca `{ ...body }`.
- **Sin avisos de migración:** el proyecto no está en producción y no hay usuarios. No escribas código de compatibilidad ni avisos para nadie.
- **Commits:** en español, cuerpo explicando el porqué, y terminando con:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
  ```
- **Comandos:** prefija con `rtk` (`rtk git commit`, `rtk npm test`), también dentro de cadenas con `&&`.

## Estructura de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `desamparados-web/src/app/AdminLayout.tsx` | *(modificar)* El fondo de la barra pasa al contenedor | 1 |
| `desamparados-web/src/features/cms/PanelPage.tsx` | *(modificar)* Deja de pintar la actividad del equipo | 2 |
| `desamparados-web/src/features/cms/inicio/ActividadEquipo.tsx` | *(borrar)* | 2 |
| `desamparados-web/src/features/cms/inicio/actividad.ts` | *(borrar)* Solo lo usaba el componente anterior | 2 |
| `desamparados-web/src/features/cms/inicio/Cifras.tsx` | *(modificar)* Recoge la línea de noticias y publicaciones | 2 |
| `desamparados-web/src/lib/api/panel.ts` | *(modificar)* `registro` sale del tipo | 2 |
| `backend-desamparados/src/services/panel.service.ts` | *(modificar)* Deja de consultar `AuditLog` | 3 |
| `shared/casos-identidad.json` | *(crear)* La tabla de casos que leen los dos proyectos | 4 |
| `desamparados-web/src/lib/validacion/identidad.ts` | *(crear)* Reglas de DNI, teléfono, CP y texto | 4 |
| `desamparados-web/src/features/members/public/schema.ts` | *(modificar)* Usa las reglas de verdad | 5 |
| `desamparados-web/src/features/members/public/HazteHermanoPage.tsx` | *(modificar)* Pinta los errores por campo de la API | 5 |
| `desamparados-web/src/lib/api/auth.ts` | *(modificar)* Manda DNI y teléfono normalizados | 5 |
| `backend-desamparados/src/config/common.ts` | *(modificar)* Normaliza el DNI antes de validar | 6 |
| `backend-desamparados/src/services/hermano.service.ts` | *(modificar)* `cerrarHuecosDeNumero` | 7 |
| `backend-desamparados/src/routes/hermano.routes.ts` | *(modificar)* Ruta del cierre de huecos | 7 |
| `desamparados-web/src/features/cms/BrothersAdminPage.tsx` | *(modificar)* Botón del cierre de huecos | 8 |

---

### Task 1: El menú del CMS conserva su fondo en tema claro

**Files:**
- Modify: `desamparados-web/src/app/AdminLayout.tsx`
- Test: `desamparados-web/src/app/__tests__/AdminLayout.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: nada que consuman otras tareas.

**Contexto:** la barra lateral es un `<Box component="aside">` de `height: '100vh'` con `overflowY: 'auto'`, y dentro va `barra`, un `<Box>` con `height: '100%'` y el fondo `SIDEBAR`. Cuando el menú es más alto que la ventana, `barra` mide `100vh` pero su contenido desborda: al bajar se acaba el fondo oscuro y asoma el `background.default` de la página. En tema oscuro no se nota; en claro el menú parece desaparecer.

- [ ] **Step 1: Escribir el test que falla**

En `desamparados-web/src/app/__tests__/AdminLayout.test.tsx`, dentro del `describe('AdminLayout', ...)` que ya existe, junto al test «la barra lateral se queda fija al bajar por la página»:

```tsx
  it('el menú conserva su fondo cuando es más alto que la ventana', () => {
    // Con el menú desbordado, `barra` medía 100vh y su contenido seguía más
    // abajo: el fondo oscuro se acababa y asomaba el de la página. Invisible
    // en tema oscuro, evidente en claro, donde el menú parecía borrarse.
    entrarComo('ADMIN')
    const { container } = renderWithProviders(<AdminLayout />)
    const aside = container.querySelector('aside')!
    const barra = aside.firstElementChild as HTMLElement

    // El fondo vive en el contenedor que hace scroll, no solo en el hijo.
    expect(getComputedStyle(aside).backgroundColor).toBe(getComputedStyle(barra).backgroundColor)
    expect(getComputedStyle(aside).backgroundColor).not.toBe('')
    expect(getComputedStyle(aside).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')

    // Y el hijo crece con su contenido en lugar de quedarse clavado a la ventana.
    expect(getComputedStyle(barra).minHeight).toBe('100%')
    expect(getComputedStyle(barra).height).not.toBe('100%')
  })
```

- [ ] **Step 2: Ejecutar el test para comprobar que falla**

```bash
cd desamparados-web && rtk npx vitest run src/app/__tests__/AdminLayout.test.tsx -t "conserva su fondo"
```

Esperado: FALLA. El `backgroundColor` del `aside` es `rgba(0, 0, 0, 0)` y el `minHeight` de la barra no es `100%`.

- [ ] **Step 3: Mover el fondo al contenedor**

En `AdminLayout.tsx`, en la constante `barra` de la función `Contenido`, cambia la primera línea del `sx`:

```tsx
  const barra = (
    <Box sx={{ minHeight: '100%', backgroundColor: SIDEBAR, p: 2, pt: 3.25, display: 'flex', flexDirection: 'column' }}>
```

Y en el `<Box component="aside">` de la rama de escritorio, añade el fondo al final del `sx`:

```tsx
        <Box
          component="aside"
          sx={{
            width: 264,
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            // En un contenedor flex, sin esto el hijo se estira a toda la
            // altura y `sticky` no llega a pegarse a nada.
            alignSelf: 'flex-start',
            height: '100vh',
            overflowY: 'auto',
            // El fondo va aquí, en el elemento que hace scroll, y no solo en
            // `barra`: con el menú más alto que la ventana, `barra` medía
            // 100vh y al bajar asomaba el fondo de la página por debajo.
            backgroundColor: SIDEBAR,
          }}
        >
```

- [ ] **Step 4: Ejecutar los tests para comprobar que pasan**

```bash
cd desamparados-web && rtk npx vitest run src/app/__tests__/AdminLayout.test.tsx
```

Esperado: PASA, y los tests que ya había del fichero siguen en verde.

- [ ] **Step 5: Comprobarlo a ojo en los dos temas**

Levanta la web (`cd desamparados-web && rtk npm run dev`), entra en `/cms` con una cuenta de ADMIN, **baja la ventana del navegador a menos de 600 px de alto** para que el menú desborde, y comprueba en tema claro y en oscuro que el fondo del menú llega hasta abajo.

- [ ] **Step 6: Commit**

```bash
rtk git add desamparados-web/src/app/AdminLayout.tsx desamparados-web/src/app/__tests__/AdminLayout.test.tsx
rtk git commit -F - <<'EOF'
Que el menú del CMS no se borre en tema claro

La barra lateral es un contenedor de 100vh con scroll y dentro un hijo de
height:100% que lleva el fondo. Con el menú más alto que la ventana, el hijo
medía la ventana y su contenido seguía por debajo: al bajar se acababa el
fondo oscuro y asomaba el de la página. En tema oscuro no se distingue; en
claro el menú parecía desaparecer.

El fondo pasa al contenedor que hace scroll y el hijo crece con su contenido.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 2: La auditoría sale del Inicio del CMS

**Files:**
- Modify: `desamparados-web/src/features/cms/PanelPage.tsx`
- Modify: `desamparados-web/src/features/cms/inicio/Cifras.tsx`
- Modify: `desamparados-web/src/lib/api/panel.ts`
- Delete: `desamparados-web/src/features/cms/inicio/ActividadEquipo.tsx`
- Delete: `desamparados-web/src/features/cms/inicio/actividad.ts`
- Delete: `desamparados-web/src/features/cms/inicio/__tests__/actividad.test.ts`
- Test: `desamparados-web/src/features/cms/inicio/__tests__/Cifras.test.tsx` *(crear)*

**Interfaces:**
- Consumes: `PanelResponse` de `lib/api/panel.ts`.
- Produces: el tipo `PanelResponse` **sin** `actividad.registro`. La tarea 3 lo retira del servidor.

**Contexto:** el Inicio pinta `<ActividadEquipo>`, que enseña las últimas acciones del `AuditLog` por cargo. El usuario quiere la auditoría fuera del panel para todos los cargos. Lo que ese bloque enseñaba y **no** es auditoría —noticias publicadas, total de publicaciones y fecha de la última— se conserva y se mueve al bloque de cifras.

- [ ] **Step 1: Escribir el test que falla**

Crea `desamparados-web/src/features/cms/inicio/__tests__/Cifras.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import Cifras from '../Cifras'
import type { PanelResponse } from '../../../../lib/api/panel'

const PANEL: PanelResponse = {
  generadoEn: '2026-09-14T08:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: { activos: 1284, altas12m: 34, bajas12m: 12, sinNumeroHermano: 3, serieMensual: [], movimientosMensuales: [], porEdad: [] },
  dinero: {
    porEstado: [{ estado: 'DEVUELTO', total: 14, importe: 420 }],
    ejercicio: { anio: 2026, ingresos: 0, gastos: 0, saldo: 0 },
    serieMensual: [],
    porCategoria: [],
  },
  procesion: { anio: 2026, papeletas: 612, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
  actividad: {
    proximosEventos: [],
    noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: '2026-06-01T00:00:00.000Z' },
    reparto: { turnosProximos: 2, citasReservadas: 6, capacidadEstimada: 40 },
  },
}

describe('Cifras', () => {
  it('recoge las noticias y las publicaciones que enseñaba la actividad del equipo', () => {
    // Al sacar la auditoría del Inicio se llevaba por delante estos dos
    // números, que no son auditoría y el panel viejo ya enseñaba.
    renderWithProviders(<Cifras panel={PANEL} />)
    expect(screen.getByText(/4 noticias publicadas/)).toBeInTheDocument()
    expect(screen.getByText(/7 publicaciones/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar el test para comprobar que falla**

```bash
cd desamparados-web && rtk npx vitest run src/features/cms/inicio/__tests__/Cifras.test.tsx
```

Esperado: FALLA. Además el typecheck se queja de que falta `actividad.registro` en el objeto `PANEL`: es lo que buscamos, porque confirma que el tipo todavía lo exige.

- [ ] **Step 3: Quitar el bloque del Inicio y recoger los dos números**

En `lib/api/panel.ts`, borra la propiedad `registro` de la interfaz `actividad` (y el tipo de sus elementos, si está declarado aparte).

En `features/cms/PanelPage.tsx`, borra el `import ActividadEquipo from './inicio/ActividadEquipo'` y la línea `<ActividadEquipo actividad={data.actividad} role={role} />`.

En `features/cms/inicio/Cifras.tsx`, el `return` es hoy un único `<Box>` en rejilla con las cuatro tarjetas. Envuélvelo y cuelga debajo la línea que venía de `ActividadEquipo`. `contar` ya está importado; añade `fechaCorta` al import que ya trae `eurosResumen` y `numero` de `'../contabilidad/formato'`:

```tsx
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.75 }}>
        {/* ...las cuatro <Cifra /> tal y como están, sin tocarlas... */}
      </Box>

      {/* Venía de «Actividad del equipo», que se retiró con la auditoría: son
          dos números y una fecha, no un registro de quién hizo qué. */}
      <Typography variant="caption" color="text.secondary" sx={{ px: 0.25 }}>
        {contar(panel.actividad.noticias.publicadas, 'noticia publicada', 'noticias publicadas')} ·{' '}
        {contar(panel.actividad.publicaciones.total, 'publicación', 'publicaciones')}
        {panel.actividad.publicaciones.ultima && ` · última el ${fechaCorta(panel.actividad.publicaciones.ultima)}`}
      </Typography>
    </Box>
  )
```

Borra los tres ficheros: `inicio/ActividadEquipo.tsx`, `inicio/actividad.ts` y `inicio/__tests__/actividad.test.ts`.

- [ ] **Step 4: Ejecutar los tests y el typecheck**

```bash
cd desamparados-web && rtk npm test && rtk npx tsc -b --noEmit
```

Esperado: PASAN. Si algún test del Inicio seguía esperando «Actividad del equipo», bórralo: ese bloque ya no existe.

- [ ] **Step 5: Commit**

```bash
rtk git add -A desamparados-web/src
rtk git commit -F - <<'EOF'
Sacar la auditoría del Inicio del CMS

El bloque «Actividad del equipo» enseñaba las últimas acciones del registro
de auditoría a los seis cargos. La auditoría es privada: vive en su sección,
que ven ADMIN y el Hermano Mayor.

Las noticias publicadas y las publicaciones, que iban en ese mismo bloque y
no son auditoría, se recogen en las cifras.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 3: El panel deja de servir el registro de auditoría

**Files:**
- Modify: `backend-desamparados/src/services/panel.service.ts`
- Test: `backend-desamparados/test/panel-servicio.test.ts`

**Interfaces:**
- Consumes: el tipo `PanelResponse` de la tarea 2 ya no lleva `registro`.
- Produces: `PanelResponse.actividad` sin `registro`. Nada más lo consume.

**Contexto:** el frontend ya no lo pinta (tarea 2). Servirlo igualmente es mandar datos de auditoría a seis cargos por la red, y hacer una consulta a `AuditLog` en cada carga del Inicio para nada.

- [ ] **Step 1: Escribir el test que falla**

En `backend-desamparados/test/panel-servicio.test.ts`, añade:

```ts
test('el panel no devuelve el registro de auditoría', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const panel = await PanelService.getPanelDeHoy();
  // La auditoría es privada y vive en su sección. Servirla en el Inicio la
  // repartía entre los seis cargos del CMS.
  assert.equal('registro' in panel.actividad, false);
});
```

Si el fichero no tiene ya el sondeo de base de datos (`dbDisponible`, `motivoSinDb`), cópialo tal cual de `test/permisos-hermano-mayor.test.ts`.

- [ ] **Step 2: Ejecutar el test para comprobar que falla**

```bash
cd backend-desamparados && rtk npx tsx --test test/panel-servicio.test.ts
```

Esperado: FALLA con `'registro' in panel.actividad` a `true` (o se omite con motivo si no hay base de datos: en ese caso levántala antes de seguir, este test la necesita).

- [ ] **Step 3: Quitar el registro del servicio**

En `panel.service.ts`:
1. Borra `registro` de la interfaz `PanelResponse.actividad` (línea ~67) y su comentario.
2. Borra `registroContenido` de la desestructuración del `Promise.all` (línea ~184) **y la consulta a `db.auditLog.findMany` que lo alimenta**.
3. Borra el bloque `registro: registroContenido.map(...)` del objeto de respuesta (línea ~392).
4. Actualiza el comentario de cabecera del fichero (líneas ~26-30): el párrafo que explica por qué se acotaba `AuditLog` deja de tener sentido; sustitúyelo por una línea diciendo que el Inicio ya no consulta la auditoría.

Si al quitarlo se queda sin usar algún import (`AUDIT_ACTIONS`, o la lista blanca de acciones de contenido), bórralo también.

- [ ] **Step 4: Ejecutar la batería entera**

```bash
cd backend-desamparados && rtk npm test
```

Esperado: PASA. Presta atención a `test/panel-acceso.test.ts` y `test/registro-privacidad.test.ts`: si alguno comprobaba que el registro salía sin nombres, ese test ya no aplica y se borra (el dato ya no se sirve).

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src/services/panel.service.ts backend-desamparados/test
rtk git commit -F - <<'EOF'
Que el Inicio deje de consultar la auditoría

El panel servía las últimas acciones del AuditLog a los seis cargos del CMS
y hacía una consulta más en cada carga. El Inicio ya no las pinta, así que
tampoco hay que mandarlas: la auditoría se lee en su sección.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 4: Reglas de identidad compartidas entre formulario y servidor

**Files:**
- Create: `shared/casos-identidad.json`
- Create: `desamparados-web/src/lib/validacion/identidad.ts`
- Test: `desamparados-web/src/lib/validacion/__tests__/identidad.test.ts`
- Test: `backend-desamparados/test/identidad-paridad.test.ts`

**Interfaces:**
- Consumes: los validadores `dni`, `telefono` y `textoRequerido` de `backend-desamparados/src/config/common.ts` (no se tocan en esta tarea).
- Produces, desde `desamparados-web/src/lib/validacion/identidad.ts`:
  - `normalizarDni(valor: string): string`
  - `esDniValido(valor: string): boolean`
  - `normalizarTelefono(valor: string): string`
  - `esTelefonoValido(valor: string): boolean`
  - `esCodigoPostalValido(valor: string): boolean`
  - `esTextoValido(valor: string): boolean`

**Contexto:** el formulario usa `/^[XYZ]?\d{7,8}[A-Z]$/i`, que no calcula la letra y admite siete dígitos; el servidor exige ocho y comprueba el módulo 23. El teléfono en el formulario solo pide que no esté vacío; el servidor, nueve dígitos. Por eso el usuario recibía un 400 con un DNI que le parecía correcto.

Los dos proyectos son paquetes distintos y no comparten código. Lo que impide que las reglas se separen es una **tabla de casos en JSON** que leen los tests de los dos lados: si una implementación cambia, su test falla.

- [ ] **Step 1: Escribir la tabla de casos**

Crea `shared/casos-identidad.json`:

```json
{
  "_comentario": "Tabla de casos que leen los tests de los dos proyectos: desamparados-web/src/lib/validacion/__tests__/identidad.test.ts y backend-desamparados/test/identidad-paridad.test.ts. Si el formulario y el servidor se separan, uno de los dos falla. No la edites sin ejecutar los dos.",
  "dni": [
    { "valor": "12345678Z", "valido": true, "normalizado": "12345678Z" },
    { "valor": "12345678z", "valido": true, "normalizado": "12345678Z" },
    { "valor": "12345678 Z", "valido": true, "normalizado": "12345678Z" },
    { "valor": "12345678-Z", "valido": true, "normalizado": "12345678Z" },
    { "valor": "X1234567L", "valido": true, "normalizado": "X1234567L" },
    { "valor": "Y1234567X", "valido": true, "normalizado": "Y1234567X" },
    { "valor": "Z1234567R", "valido": true, "normalizado": "Z1234567R" },
    { "valor": "12345678A", "valido": false, "normalizado": "12345678A" },
    { "valor": "1234567A", "valido": false, "normalizado": "1234567A" },
    { "valor": "0123456S", "valido": false, "normalizado": "0123456S" },
    { "valor": "", "valido": false, "normalizado": "" },
    { "valor": "ABCDEFGHI", "valido": false, "normalizado": "ABCDEFGHI" }
  ],
  "telefono": [
    { "valor": "600123456", "valido": true, "normalizado": "600123456" },
    { "valor": "600 12 34 56", "valido": true, "normalizado": "600123456" },
    { "valor": "600-12-34-56", "valido": true, "normalizado": "600123456" },
    { "valor": "+34600123456", "valido": true, "normalizado": "600123456" },
    { "valor": "0034600123456", "valido": true, "normalizado": "600123456" },
    { "valor": "95212345", "valido": false, "normalizado": "95212345" },
    { "valor": "6001234567", "valido": false, "normalizado": "6001234567" },
    { "valor": "seiscientos", "valido": false, "normalizado": "seiscientos" }
  ],
  "codigoPostal": [
    { "valor": "29013", "valido": true },
    { "valor": "29013 ", "valido": true },
    { "valor": "2901", "valido": false },
    { "valor": "290134", "valido": false },
    { "valor": "2901A", "valido": false }
  ],
  "texto": [
    { "valor": "Calle Real 14", "valido": true },
    { "valor": "  Málaga  ", "valido": true },
    { "valor": "", "valido": false },
    { "valor": "   ", "valido": false },
    { "valor": "<script>", "valido": false },
    { "valor": "Juan > Pedro", "valido": false }
  ]
}
```

- [ ] **Step 2: Escribir el test del frontend, que falla**

Crea `desamparados-web/src/lib/validacion/__tests__/identidad.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  normalizarDni, esDniValido,
  normalizarTelefono, esTelefonoValido,
  esCodigoPostalValido, esTextoValido,
} from '../identidad'

// La misma tabla que lee backend-desamparados/test/identidad-paridad.test.ts.
// Si el formulario y el servidor se separan, uno de los dos falla: es toda la
// protección que tenemos, porque son dos paquetes sin código compartido.
const casos = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../../../shared/casos-identidad.json', import.meta.url)), 'utf8'),
) as {
  dni: { valor: string; valido: boolean; normalizado: string }[]
  telefono: { valor: string; valido: boolean; normalizado: string }[]
  codigoPostal: { valor: string; valido: boolean }[]
  texto: { valor: string; valido: boolean }[]
}

describe('reglas de identidad', () => {
  it.each(casos.dni)('DNI $valor', ({ valor, valido, normalizado }) => {
    expect(normalizarDni(valor)).toBe(normalizado)
    expect(esDniValido(valor)).toBe(valido)
  })

  it.each(casos.telefono)('teléfono $valor', ({ valor, valido, normalizado }) => {
    expect(normalizarTelefono(valor)).toBe(normalizado)
    expect(esTelefonoValido(valor)).toBe(valido)
  })

  it.each(casos.codigoPostal)('código postal $valor', ({ valor, valido }) => {
    expect(esCodigoPostalValido(valor)).toBe(valido)
  })

  it.each(casos.texto)('texto $valor', ({ valor, valido }) => {
    expect(esTextoValido(valor)).toBe(valido)
  })
})
```

- [ ] **Step 3: Ejecutar el test para comprobar que falla**

```bash
cd desamparados-web && rtk npx vitest run src/lib/validacion
```

Esperado: FALLA al resolver `../identidad`, que todavía no existe.

- [ ] **Step 4: Escribir las reglas**

Crea `desamparados-web/src/lib/validacion/identidad.ts`:

```ts
/**
 * Las reglas de identidad del alta, copiadas de las del servidor
 * (`backend-desamparados/src/config/common.ts`).
 *
 * Están duplicadas a la fuerza: son dos paquetes con su propio `package.json` y
 * no hay código compartido entre ellos. Lo que impide que se separen es la
 * tabla de casos de `shared/casos-identidad.json`, que ejecutan los tests de
 * los dos lados.
 *
 * Antes, el formulario admitía `/^[XYZ]?\d{7,8}[A-Z]$/i` —siete dígitos y sin
 * comprobar la letra— y el servidor exigía ocho con el módulo 23. Quien metía
 * un DNI que el navegador daba por bueno recibía un 400 del servidor que solo
 * decía «Error de validación».
 */

/** Fuera espacios y guiones, y a mayúsculas: «12345678-z» es el mismo DNI que «12345678Z». */
export function normalizarDni(valor: string): string {
  return valor.replace(/[\s-]/g, '').toUpperCase()
}

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

/** DNI o NIE con la letra calculada (módulo 23), igual que el servidor. */
export function esDniValido(valor: string): boolean {
  const dni = normalizarDni(valor)
  if (!/^[XYZ0-9][0-9]{7}[A-Z]$/.test(dni)) return false
  const letra = dni.slice(-1)
  // En un NIE la letra inicial vale por un dígito: X=0, Y=1, Z=2.
  const numero = Number(dni.slice(0, -1).replace('X', '0').replace('Y', '1').replace('Z', '2'))
  return letra === LETRAS_DNI[numero % 23]
}

/**
 * Fuera espacios, puntos y guiones, y el prefijo de España. El servidor guarda
 * nueve dígitos pelados, así que el formulario tiene que mandarlos así: quien
 * escribe «+34 600 12 34 56» está dando un teléfono válido.
 */
export function normalizarTelefono(valor: string): string {
  return valor.replace(/[\s.-]/g, '').replace(/^(\+34|0034)/, '')
}

export function esTelefonoValido(valor: string): boolean {
  return /^[0-9]{9}$/.test(normalizarTelefono(valor))
}

export function esCodigoPostalValido(valor: string): boolean {
  return /^[0-9]{5}$/.test(valor.trim())
}

/** El servidor rechaza `<` y `>` en todo texto libre (prevención de XSS). */
export function esTextoValido(valor: string): boolean {
  const texto = valor.trim()
  return texto.length > 0 && !/[<>]/.test(texto)
}
```

- [ ] **Step 5: Ejecutar el test del frontend**

```bash
cd desamparados-web && rtk npx vitest run src/lib/validacion
```

Esperado: PASAN los 31 casos.

- [ ] **Step 6: Escribir el test de paridad del backend**

Crea `backend-desamparados/test/identidad-paridad.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dni, telefono, textoRequerido } from '../src/config/common.js';

// La misma tabla que lee desamparados-web/src/lib/validacion/__tests__/identidad.test.ts.
// Son dos paquetes sin código compartido: esta tabla es lo único que impide
// que el formulario vuelva a admitir lo que el servidor rechaza.
const casos = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../shared/casos-identidad.json', import.meta.url)), 'utf8')
) as {
  dni: { valor: string; valido: boolean; normalizado: string }[];
  telefono: { valor: string; valido: boolean; normalizado: string }[];
  codigoPostal: { valor: string; valido: boolean }[];
  texto: { valor: string; valido: boolean }[];
};

/** ArkType devuelve los datos si valen y un ArkErrors si no. */
const acepta = (validador: { (valor: unknown): unknown }, valor: string) =>
  !(String((validador(valor) as { constructor?: { name?: string } })?.constructor?.name) === 'ArkErrors');

test('el DNI: el servidor acepta lo mismo que el formulario, ya normalizado', () => {
  for (const caso of casos.dni) {
    assert.equal(acepta(dni, caso.normalizado), caso.valido, `DNI ${JSON.stringify(caso.valor)}`);
  }
});

test('el teléfono: el servidor acepta lo mismo que el formulario, ya normalizado', () => {
  for (const caso of casos.telefono) {
    assert.equal(acepta(telefono, caso.normalizado), caso.valido, `teléfono ${JSON.stringify(caso.valor)}`);
  }
});

test('el texto libre: el servidor rechaza lo mismo que el formulario', () => {
  for (const caso of casos.texto) {
    assert.equal(acepta(textoRequerido, caso.valor), caso.valido, `texto ${JSON.stringify(caso.valor)}`);
  }
});
```

> El formulario **normaliza antes de enviar** (tarea 5), así que lo que el servidor recibe es `caso.normalizado`, no `caso.valor`. Por eso el test compara contra el normalizado: es exactamente lo que viajará por la red.

- [ ] **Step 7: Ejecutar el test de paridad**

```bash
cd backend-desamparados && rtk npx tsx --test test/identidad-paridad.test.ts
```

Esperado: PASA. Si falla en algún caso, **la tabla manda**: comprueba cuál de las dos implementaciones se ha desviado y arregla esa, no la tabla.

- [ ] **Step 8: Commit**

```bash
rtk git add shared desamparados-web/src/lib/validacion backend-desamparados/test/identidad-paridad.test.ts
rtk git commit -F - <<'EOF'
Compartir las reglas de identidad entre el formulario y el servidor

El alta admitía DNIs de siete dígitos y sin comprobar la letra, y cualquier
cosa como teléfono; el servidor exigía ocho dígitos con el módulo 23 y nueve
cifras de teléfono. De ahí el 400 con un DNI que parecía correcto.

Las reglas se copian al frontend y una tabla de casos en shared/ las ata: la
leen los tests de los dos proyectos, así que si una se desvía, falla.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 5: El alta usa las reglas reales y pinta los errores por campo

**Files:**
- Modify: `desamparados-web/src/features/members/public/schema.ts`
- Modify: `desamparados-web/src/features/members/public/HazteHermanoPage.tsx`
- Modify: `desamparados-web/src/lib/api/auth.ts`
- Test: `desamparados-web/src/features/members/public/__tests__/HazteHermanoPage.test.tsx` *(crear)*

**Interfaces:**
- Consumes: `esDniValido`, `normalizarDni`, `esTelefonoValido`, `normalizarTelefono`, `esCodigoPostalValido`, `esTextoValido` de la tarea 4. `ApiError.fields` de `lib/api/client.ts`, que ya existe y extrae `{ field, message }` de la respuesta del servidor.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Escribir los tests que fallan**

Crea `desamparados-web/src/features/members/public/__tests__/HazteHermanoPage.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import HazteHermanoPage from '../HazteHermanoPage'

async function rellenar(datos: Partial<Record<string, string>> = {}) {
  const usuario = userEvent.setup()
  const campos: Record<string, string> = {
    Nombre: 'Juan', Apellidos: 'Pérez Ruiz', 'DNI/NIE': '12345678Z',
    Contraseña: 'Prueba-2026-Segura', 'Fecha de nacimiento': '1990-04-12',
    Email: 'juan@ejemplo.es', Teléfono: '600123456',
    Dirección: 'Calle Real 14', Ciudad: 'Málaga', 'Código postal': '29013',
    ...datos,
  }
  for (const [etiqueta, valor] of Object.entries(campos)) {
    const campo = screen.getByLabelText(etiqueta)
    await usuario.clear(campo)
    await usuario.type(campo, valor)
  }
  await usuario.click(screen.getByLabelText('Acepto la política de privacidad'))
  return usuario
}

describe('HazteHermanoPage', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('rechaza un DNI con la letra equivocada antes de enviarlo', async () => {
    // El servidor lo rechazaba con un «Error de validación» sin más: el
    // navegador daba por bueno cualquier letra.
    const enviar = vi.fn()
    vi.stubGlobal('fetch', enviar)
    renderWithProviders(<HazteHermanoPage />)
    const usuario = await rellenar({ 'DNI/NIE': '12345678A' })
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByText(/la letra no corresponde/i)).toBeInTheDocument()
    expect(enviar).not.toHaveBeenCalled()
  })

  it('rechaza un teléfono que no son nueve dígitos', async () => {
    const enviar = vi.fn()
    vi.stubGlobal('fetch', enviar)
    renderWithProviders(<HazteHermanoPage />)
    const usuario = await rellenar({ Teléfono: '95212345' })
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByText(/nueve d[ií]gitos/i)).toBeInTheDocument()
    expect(enviar).not.toHaveBeenCalled()
  })

  it('manda el DNI y el teléfono normalizados', async () => {
    const enviar = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 1, email: 'juan@ejemplo.es' }, message: 'ok' }), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', enviar)
    renderWithProviders(<HazteHermanoPage />)
    const usuario = await rellenar({ 'DNI/NIE': '12345678-z', Teléfono: '+34 600 12 34 56' })
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(enviar).toHaveBeenCalled()
    const cuerpo = JSON.parse(enviar.mock.calls[0][1].body)
    expect(cuerpo.usuario.dni).toBe('12345678Z')
    expect(cuerpo.usuario.telefono).toBe('600123456')
  })

  it('pinta bajo su casilla el error de campo que devuelve el servidor', async () => {
    // El servidor manda { message: 'Error de validación', errors: [{field, message}] }
    // y la página solo enseñaba el message: un aviso que no dice qué corregir.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        status: 'error',
        message: 'Error de validación',
        errors: [{ field: 'usuario.dni', message: 'ese DNI ya está registrado' }],
      }), { status: 400, headers: { 'Content-Type': 'application/json' } }),
    ))
    renderWithProviders(<HazteHermanoPage />)
    const usuario = await rellenar()
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByText('ese DNI ya está registrado')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar los tests para comprobar que fallan**

```bash
cd desamparados-web && rtk npx vitest run src/features/members/public
```

Esperado: FALLAN los cuatro.

- [ ] **Step 3: Poner las reglas de verdad en el esquema del formulario**

Reescribe `desamparados-web/src/features/members/public/schema.ts`:

```ts
import { z } from 'zod'
import { contrasenaNueva } from '../../../lib/passwordPolicy'
import {
  esDniValido, esTelefonoValido, esCodigoPostalValido, esTextoValido,
} from '../../../lib/validacion/identidad'

/**
 * Las mismas reglas que aplica el servidor (`lib/validacion/identidad.ts`).
 * Antes eran más flojas y el alta se caía con un 400 que no decía qué campo
 * fallaba: el navegador daba por bueno lo que el servidor rechazaba.
 */
const textoLibre = (etiqueta: string) =>
  z.string().refine(esTextoValido, `${etiqueta} es obligatorio y no puede llevar < ni >`)

export const membershipSchema = z.object({
  nombre: textoLibre('El nombre'),
  apellidos: textoLibre('Los apellidos'),
  email: z.string().trim().email('Introduce un email válido').max(254, 'El email es demasiado largo'),
  password: contrasenaNueva,
  dni: z.string().refine(esDniValido, 'Revisa el DNI o NIE: la letra no corresponde con el número'),
  telefono: z.string().refine(esTelefonoValido, 'El teléfono son nueve dígitos'),
  direccion: textoLibre('La dirección'),
  ciudad: textoLibre('La ciudad'),
  codigoPostal: z.string().refine(esCodigoPostalValido, 'El código postal son cinco dígitos'),
  fechaNacimiento: z.string().min(1, 'La fecha de nacimiento es obligatoria'),
  aceptarPolitica: z.boolean().refine((value) => value === true, {
    message: 'Debes aceptar la política de privacidad',
  }),
})

export type MembershipFormData = z.infer<typeof membershipSchema>
```

- [ ] **Step 4: Normalizar en el envío**

En `desamparados-web/src/lib/api/auth.ts`, dentro de `register`, normaliza antes de armar el cuerpo:

```ts
import { normalizarDni, normalizarTelefono } from '../validacion/identidad'
```

y en el objeto `usuario`:

```ts
        dni: normalizarDni(data.dni),
        telefono: normalizarTelefono(data.telefono),
```

con un comentario encima:

```ts
      // Normalizados aquí y no en el formulario: el servidor guarda nueve
      // dígitos pelados y el DNI en mayúsculas sin separadores, y quien
      // escribe «+34 600 12 34 56» está dando un teléfono correcto.
```

- [ ] **Step 5: Pintar los errores de campo del servidor**

En `HazteHermanoPage.tsx`, cambia el `onSubmit` para volcar los errores de campo de la API en el formulario. Necesitas `setError` de `useForm`:

```tsx
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<MembershipFormData>({ /* ...igual que antes... */ })

  /** Del `usuario.dni` que manda el servidor al `dni` que conoce el formulario. */
  const CAMPOS_API: Record<string, keyof MembershipFormData> = {
    'usuario.dni': 'dni',
    'usuario.email': 'email',
    'usuario.telefono': 'telefono',
    'usuario.nombre': 'nombre',
    'usuario.apellidos': 'apellidos',
    'usuario.direccion': 'direccion',
    'usuario.poblacion': 'ciudad',
    'usuario.codigoPostal': 'codigoPostal',
    'usuario.password': 'password',
    'hermano.fechaNacimiento': 'fechaNacimiento',
  }

  const onSubmit = async (data: MembershipFormData) => {
    setSubmitError(null)
    try {
      await apiRegister({ ...data, poblacion: data.ciudad })
      setSuccess(true)
      reset()
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        // El servidor dice qué campo falla; enseñarlo bajo su casilla en vez
        // de un «Error de validación» suelto que no dice qué corregir.
        let colocado = false
        for (const [campoApi, mensaje] of Object.entries(error.fields)) {
          const campo = CAMPOS_API[campoApi]
          if (campo) { setError(campo, { type: 'server', message: mensaje }); colocado = true }
        }
        if (colocado) return
      }
      setSubmitError(error instanceof ApiError ? error.message : 'No se ha podido enviar la solicitud.')
    }
  }
```

- [ ] **Step 6: Ejecutar los tests**

```bash
cd desamparados-web && rtk npm test && rtk npx tsc -b --noEmit
```

Esperado: PASAN los cuatro nuevos y el resto sigue en verde.

- [ ] **Step 7: Probarlo contra el servidor de verdad**

Levanta el backend y la web y da de alta a alguien con `12345678-z` y `+34 600 12 34 56`. Debe entrar sin 400. Repite con `12345678A` y comprueba que el aviso sale bajo la casilla del DNI **sin llegar a enviarse**.

- [ ] **Step 8: Commit**

```bash
rtk git add desamparados-web/src
rtk git commit -F - <<'EOF'
Que el alta valide lo mismo que el servidor y diga qué campo falla

El formulario admitía DNIs de siete dígitos, sin comprobar la letra, y
cualquier cosa como teléfono; el servidor los rechazaba con un 400 cuyo
mensaje era «Error de validación» a secas. De ahí que un DNI correcto
pareciera rechazado.

Ahora aplica las reglas reales antes de enviar, manda el DNI y el teléfono
normalizados, y los errores de campo que devuelve el servidor se pintan bajo
su casilla.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 6: El servidor normaliza el DNI antes de guardarlo

**Files:**
- Modify: `backend-desamparados/src/config/common.ts`
- Test: `backend-desamparados/test/identidad-paridad.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: el validador `dni` de `config/common.ts` pasa de `.narrow(...)` a `.pipe(...)`, de modo que **devuelve el DNI normalizado**. Todo lo que valide con él (registro, alta familiar, edición de ficha, emancipación) recibe ya el valor limpio.

**Contexto:** hoy `dni` es un `.narrow()` que normaliza para comprobar pero devuelve el valor tal cual llegó. Un cliente que mande `12345678z` guarda la minúscula, y el `@unique` de Prisma la trata como distinta de `12345678Z` si la intercalación de la columna distinguiera mayúsculas. El formulario ya normaliza (tarea 5), pero el servidor no puede fiarse del cliente.

- [ ] **Step 1: Escribir el test que falla**

Añade a `backend-desamparados/test/identidad-paridad.test.ts`:

```ts
test('el servidor devuelve el DNI normalizado, no el que le mandaron', () => {
  // El formulario ya normaliza, pero el servidor no puede fiarse del cliente:
  // con la minúscula guardada, el @unique de Prisma deja de proteger.
  for (const crudo of ['12345678z', '12345678-Z', '12345678 z', 'x1234567l']) {
    const resultado = dni(crudo);
    assert.equal(typeof resultado, 'string', `${crudo} debería valer`);
    assert.equal(resultado, String(resultado).replace(/[\s-]/g, '').toUpperCase());
    assert.match(String(resultado), /^[XYZ0-9][0-9]{7}[A-Z]$/);
  }
});
```

- [ ] **Step 2: Ejecutar el test para comprobar que falla**

```bash
cd backend-desamparados && rtk npx tsx --test test/identidad-paridad.test.ts
```

Esperado: FALLA. `dni('12345678z')` devuelve `'12345678z'`, y además `dni('12345678-Z')` ni siquiera valida.

- [ ] **Step 3: Normalizar dentro del validador**

En `backend-desamparados/src/config/common.ts`, sustituye el bloque del DNI:

```ts
// 3. DNI/NIE con Validación Matemática Oficial
//
// Normaliza ANTES de comprobar y devuelve el valor limpio, no el que llegó:
// guardar «12345678z» dejaba en la base un DNI que el índice único no
// reconoce como el mismo que «12345678Z». El formulario también normaliza
// (desamparados-web/src/lib/validacion/identidad.ts), pero el servidor no
// puede fiarse del cliente.
const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";

export const normalizarDni = (valor: string): string => valor.replace(/[\s-]/g, '').toUpperCase();

export const dni = type("string")
    .pipe((valor: string) => normalizarDni(valor))
    .narrow((str: string) => {
        if (!/^[XYZ0-9][0-9]{7}[A-Z]$/.test(str)) return false;
        const letra = str.slice(-1);
        // En un NIE la letra inicial vale por un dígito: X=0, Y=1, Z=2.
        const numero = parseInt(str.slice(0, -1).replace('X', '0').replace('Y', '1').replace('Z', '2'), 10);
        return letra === LETRAS_DNI[numero % 23];
    })
    .describe("un DNI/NIE válido con letra correcta");
```

> Si tu versión de ArkType no encadena `.pipe().narrow()` en ese orden, usa `.pipe()` con una función que normalice y llame a `ctx.reject({ problem: 'un DNI/NIE válido con letra correcta' })` cuando no valide. Lo que **no** puede cambiar es el contrato: el validador devuelve el DNI normalizado.

- [ ] **Step 4: Ejecutar la batería entera**

```bash
cd backend-desamparados && rtk npm test
```

Esperado: PASA. Mira en especial `test/emancipacion.test.ts` y `test/censo-altas-bajas.test.ts`: usan el validador del DNI.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src/config/common.ts backend-desamparados/test/identidad-paridad.test.ts
rtk git commit -F - <<'EOF'
Normalizar el DNI en el servidor antes de guardarlo

El validador comprobaba sobre el valor en mayúsculas pero devolvía el que le
habían mandado, así que «12345678z» se guardaba con la minúscula y el índice
único dejaba de reconocerlo como el mismo DNI. El formulario ya normaliza,
pero el servidor no puede fiarse del cliente.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 7: Cierre de huecos del número de hermano

**Files:**
- Modify: `backend-desamparados/src/services/hermano.service.ts`
- Modify: `backend-desamparados/src/services/audit.service.ts`
- Modify: `backend-desamparados/src/controllers/hermano.controller.ts`
- Modify: `backend-desamparados/src/routes/hermano.routes.ts`
- Test: `backend-desamparados/test/numero-hermano.test.ts` *(crear)*

**Interfaces:**
- Consumes: `HermanoService.getNextNumeroHermano(tx)`, que ya existe y devuelve «el mayor + 1».
- Produces:
  - `HermanoService.cerrarHuecosDeNumero(meta?: AuditMeta): Promise<{ asignados: { id: number; numeroHermano: number }[] }>`
  - `AUDIT_ACTIONS.CENSO_CERRAR_HUECOS = 'CENSO_CERRAR_HUECOS'`
  - `POST /api/hermanos/admin/cerrar-huecos-numero` → `{ message: string; asignados: { id: number; numeroHermano: number }[] }`

**Contexto:** aprobar una solicitud y reactivar a un hermano ya asignan número. Lo que falta es la garantía para el censo real que se va a importar, que puede traer fichas activas sin número. **No se renumera a nadie**: quien ya tiene número lo conserva, porque lleva décadas con él.

- [ ] **Step 1: Escribir el test que falla**

Crea `backend-desamparados/test/numero-hermano.test.ts`. Copia el bloque de sondeo de base de datos de `test/permisos-hermano-mayor.test.ts` (`sondearDb`, `dbDisponible`, `motivoSinDb`, `SIN_DB`) y añade:

```ts
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import db from '../src/config/db.js';
import { HermanoService } from '../src/services/hermano.service.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

// ...aquí el bloque de sondeo copiado de permisos-hermano-mayor.test.ts...

const usuariosCreados: number[] = [];

async function fichaActivaSinNumero() {
  const user = await crearUsuarioPrueba();
  usuariosCreados.push(user.id);
  return db.hermano.create({
    data: {
      userId: user.id,
      nombre: 'Sin',
      apellidos: 'Numero',
      fechaNacimiento: new Date('1980-01-01'),
      fechaAlta: new Date('1995-03-10'),
      activo: true,
      numeroHermano: null,
    },
  });
}

after(async () => {
  await db.hermano.deleteMany({ where: { userId: { in: usuariosCreados } } });
  for (const id of usuariosCreados) await borrarUsuarioPrueba(id);
});

test('el cierre de huecos da número a las activas que no lo tienen', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  const antigua = await fichaActivaSinNumero();
  const reciente = await db.hermano.update({
    where: { id: (await fichaActivaSinNumero()).id },
    data: { fechaAlta: new Date('2020-06-01') },
  });

  const { asignados } = await HermanoService.cerrarHuecosDeNumero();

  const idsAsignados = asignados.map((a) => a.id);
  assert.ok(idsAsignados.includes(antigua.id), 'la ficha antigua debe recibir número');
  assert.ok(idsAsignados.includes(reciente.id), 'la ficha reciente debe recibir número');

  // Por antigüedad: quien lleva desde 1995 va antes que quien entró en 2020.
  const numAntigua = asignados.find((a) => a.id === antigua.id)!.numeroHermano;
  const numReciente = asignados.find((a) => a.id === reciente.id)!.numeroHermano;
  assert.ok(numAntigua < numReciente, `${numAntigua} debería ir antes que ${numReciente}`);
});

test('el cierre de huecos no renumera a quien ya tiene número', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  const conNumero = await db.hermano.findFirst({
    where: { activo: true, numeroHermano: { not: null } },
    select: { id: true, numeroHermano: true },
  });
  if (!conNumero) return t.skip('no hay ninguna ficha con número en la base');

  await fichaActivaSinNumero();
  await HermanoService.cerrarHuecosDeNumero();

  const despues = await db.hermano.findUnique({ where: { id: conNumero.id }, select: { numeroHermano: true } });
  assert.equal(despues?.numeroHermano, conNumero.numeroHermano, 'no se renumera a nadie');
});

test('sin huecos, el cierre no hace nada', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  await HermanoService.cerrarHuecosDeNumero();
  const segunda = await HermanoService.cerrarHuecosDeNumero();
  assert.deepEqual(segunda.asignados, [], 'la segunda pasada no debe tocar nada');
});
```

- [ ] **Step 2: Ejecutar el test para comprobar que falla**

```bash
cd backend-desamparados && rtk npx tsx --test test/numero-hermano.test.ts
```

Esperado: FALLA porque `HermanoService.cerrarHuecosDeNumero` no existe.

- [ ] **Step 3: Añadir la acción de auditoría**

En `backend-desamparados/src/services/audit.service.ts`, junto a `CENSO_REORDENAR`:

```ts
  CENSO_CERRAR_HUECOS: 'CENSO_CERRAR_HUECOS',
```

- [ ] **Step 4: Escribir el servicio**

En `backend-desamparados/src/services/hermano.service.ts`, junto a `reordenarCenso`:

```ts
  /**
   * Da número de hermano a las fichas activas que no lo tienen, por antigüedad.
   *
   * No renumera a nadie: quien ya tiene número lo conserva, porque lleva
   * décadas con él y el censo real llega con su numeración hecha. Esto cierra
   * huecos, no reordena; para reordenar está `reordenarCenso`.
   *
   * Se lanza a mano desde Secretaría y no en el arranque del servidor: asignar
   * números es una decisión suya y tiene que quedar en la auditoría con quién
   * la tomó.
   */
  static async cerrarHuecosDeNumero(meta?: AuditMeta) {
    const asignados = await transaccionReintentable(async (tx) => {
      const sinNumero = await tx.hermano.findMany({
        where: { activo: true, numeroHermano: null },
        // Por antigüedad real. `id` desempata: dos altas del mismo día dejarían
        // el orden a merced de MariaDB y el resultado no sería repetible.
        orderBy: [{ fechaAlta: 'asc' }, { id: 'asc' }],
        select: { id: true }
      });
      if (sinNumero.length === 0) return [];

      let siguiente = await this.getNextNumeroHermano(tx);
      const hechas: { id: number; numeroHermano: number }[] = [];
      for (const { id } of sinNumero) {
        await tx.hermano.update({ where: { id }, data: { numeroHermano: siguiente } });
        hechas.push({ id, numeroHermano: siguiente });
        siguiente += 1;
      }
      return hechas;
    });

    if (asignados.length > 0) {
      await AuditService.log(AUDIT_ACTIONS.CENSO_CERRAR_HUECOS, meta ?? {}, 'hermano', undefined, { asignados });
    }
    return { asignados };
  }
```

- [ ] **Step 5: Escribir el controlador y la ruta**

En `backend-desamparados/src/controllers/hermano.controller.ts`, junto a los demás:

```ts
  static async cerrarHuecosNumero(req: Request, res: Response) {
    try {
      const { asignados } = await HermanoService.cerrarHuecosDeNumero(AuditService.metaFromReq(req));
      res.status(200).json({
        message: asignados.length === 0
          ? 'No había ningún hermano activo sin número.'
          : `Se han asignado ${asignados.length} números de hermano.`,
        asignados
      });
    } catch (e) {
      handleHttp(res, e, 'Error asignando los números de hermano');
    }
  }
```

En `backend-desamparados/src/routes/hermano.routes.ts`, junto a `/admin/reordenar-censo`:

```ts
hermanoRouter.post('/admin/cerrar-huecos-numero', checkRole(rolesGestionCenso), HermanoController.cerrarHuecosNumero);
```

- [ ] **Step 6: Ejecutar los tests**

```bash
cd backend-desamparados && rtk npm test
```

Esperado: PASAN los tres nuevos y la batería sigue en verde.

- [ ] **Step 7: Commit**

```bash
rtk git add backend-desamparados/src backend-desamparados/test/numero-hermano.test.ts
rtk git commit -F - <<'EOF'
Cerrar los huecos del número de hermano

Aprobar una solicitud y reactivar ya asignaban número, pero el censo real
que se va a importar puede traer fichas activas sin él, y el propio menú del
CMS lleva un contador de «hermanos sin número» que hasta ahora no tenía
ninguna forma de bajar.

Reparte números por antigüedad entre las activas que no lo tienen, sin tocar
a quien ya lo tiene: el suyo lo lleva desde hace décadas.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 8: El botón del cierre de huecos en el CMS

**Files:**
- Modify: `desamparados-web/src/lib/api/brothers.ts`
- Modify: `desamparados-web/src/features/cms/BrothersAdminPage.tsx`
- Test: `desamparados-web/src/features/cms/__tests__/BrothersAdminPage.test.tsx` *(crear si no existe; si existe, añadir)*

**Interfaces:**
- Consumes: `POST /api/hermanos/admin/cerrar-huecos-numero` de la tarea 7, que responde `{ message: string; asignados: { id: number; numeroHermano: number }[] }`.
- Produces: `cerrarHuecosDeNumero()` en `lib/api/brothers.ts`.

**Contexto de la pantalla:** `BrothersAdminPage` carga con `useEffect` + `load()`, enseña los avisos con `setError` / `setNotice`, protege el doble clic con la referencia `enMarcha` y ya usa `DialogoConfirmacion` para rechazar solicitudes. **Sigue ese patrón**; no metas otro.

- [ ] **Step 1: Escribir el test que falla**

En `desamparados-web/src/features/cms/__tests__/BrothersAdminPage.test.tsx`:

```tsx
  it('ofrece asignar números a los hermanos que no lo tienen', async () => {
    // El menú lleva un contador de «hermanos sin número» que hasta ahora no
    // tenía ninguna forma de bajar desde la interfaz.
    const usuario = userEvent.setup()
    renderWithProviders(<BrothersAdminPage />)

    const boton = await screen.findByRole('button', { name: /asignar n[úu]meros/i })
    await usuario.click(boton)
    await usuario.click(await screen.findByRole('button', { name: /confirmar|asignar/i }))

    expect(await screen.findByText(/se han asignado 2 n[úu]meros/i)).toBeInTheDocument()
  })
```

Simula la respuesta del servidor con el mismo mecanismo que usen los demás tests del CMS (`vi.stubGlobal('fetch', ...)`, como en `AdminLayout.test.tsx`), devolviendo:

```json
{ "message": "Se han asignado 2 números de hermano.", "asignados": [{ "id": 7, "numeroHermano": 1285 }, { "id": 9, "numeroHermano": 1286 }] }
```

- [ ] **Step 2: Ejecutar el test para comprobar que falla**

```bash
cd desamparados-web && rtk npx vitest run src/features/cms/__tests__/BrothersAdminPage.test.tsx
```

Esperado: FALLA, no hay botón.

- [ ] **Step 3: Añadir la llamada a la API**

En `desamparados-web/src/lib/api/brothers.ts`:

```ts
export interface CierreDeHuecos {
  message: string
  asignados: { id: number; numeroHermano: number }[]
}

/** Da número a los hermanos activos que no lo tienen, por antigüedad. No renumera a nadie. */
export function cerrarHuecosDeNumero() {
  return apiFetch<CierreDeHuecos>('/hermanos/admin/cerrar-huecos-numero', { method: 'POST' })
}
```

- [ ] **Step 4: Añadir el botón**

En `BrothersAdminPage.tsx`, junto al resto del estado:

```tsx
  const [porAsignarNumeros, setPorAsignarNumeros] = useState(false)
```

Junto a `handleRequest`, el manejador, con la misma guarda de doble clic que ya usa la pantalla:

```tsx
  /** Reparte los números que faltan. `enMarcha` es la guarda del doble clic, igual que al aprobar. */
  const asignarNumeros = async () => {
    if (enMarcha.current) return
    enMarcha.current = true
    setError(null); setNotice(null)
    try {
      const { message } = await cerrarHuecosDeNumero()
      await load()
      setNotice(message)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se han podido asignar los números.')
    } finally { enMarcha.current = false }
  }
```

En el `return`, sustituye el bloque de `<Tabs>` por uno que lo acompañe del botón (fíjate en que el `sx={{ mb: 3 }}` se muda de las pestañas al contenedor):

```tsx
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
      <Tabs value={vista} onChange={(_, valor) => setParams(valor === 'solicitudes' ? { vista: 'solicitudes' } : {})}>
        <Tab value="censo" label="Censo" />
        <Tab value="solicitudes" label={`Solicitudes (${metaSolicitudes?.total ?? 0})`} />
      </Tabs>
      {puedeGestionar && (
        <Button variant="outlined" onClick={() => setPorAsignarNumeros(true)}>Asignar números</Button>
      )}
    </Box>
```

Y junto al `DialogoConfirmacion` que ya hay, el segundo:

```tsx
    {/* Asignar números toca el censo entero: se pregunta antes, como al rechazar. */}
    <DialogoConfirmacion
      abierto={porAsignarNumeros}
      titulo="¿Asignar los números que faltan?"
      mensaje="Se dará número de hermano, por antigüedad, a los que están activos y no lo tienen. A quien ya tiene número no se le toca."
      textoConfirmar="Asignar números"
      onConfirmar={() => { setPorAsignarNumeros(false); void asignarNumeros() }}
      onCancelar={() => setPorAsignarNumeros(false)}
    />
```

Añade `cerrarHuecosDeNumero` al import que ya trae `approveRequest`, `getPendingRequests` y compañía de `'../../lib/api/brothers'`.

- [ ] **Step 5: Ejecutar los tests y el typecheck**

```bash
cd desamparados-web && rtk npm test && rtk npx tsc -b --noEmit
```

Esperado: PASAN.

- [ ] **Step 6: Commit**

```bash
rtk git add desamparados-web/src
rtk git commit -F - <<'EOF'
Dar a Secretaría el botón de asignar los números que faltan

El menú del CMS lleva un contador de «hermanos sin número» desde el Inicio
nuevo, pero no había forma de bajarlo desde la interfaz: el cierre de huecos
solo existía en el servicio.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 9: Ninguna vía de alta deja un hermano activo sin número

**Files:**
- Test: `backend-desamparados/test/numero-hermano.test.ts` *(ampliar)*

**Interfaces:**
- Consumes: `HermanoService.aprobarSolicitud(userId, meta)`, `HermanoService.reactivarHermano(hermanoId, meta)`, `HermanoService.createDependentProfile(managerUserId, data, meta)`, `HermanoService.darDeBajaHermano(hermanoId, meta)`.
- Produces: nada. Es la red que dice que la regla se cumple.

**Contexto:** la regla es **toda ficha activa tiene número**. Una pendiente de aprobación no lo tiene, y una de baja lo libera. Este test recorre las vías de alta y lo comprueba; si alguien añade una vía nueva que se lo salte, falla.

- [ ] **Step 1: Escribir el test que falla (o pasa: sirve igual como red)**

Añade a `backend-desamparados/test/numero-hermano.test.ts`:

```ts
test('una ficha recién creada por su tutor nace sin número, y lo recibe al aprobarla', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  const tutor = await crearUsuarioPrueba();
  usuariosCreados.push(tutor.id);

  const ficha = await HermanoService.createDependentProfile(tutor.id, {
    nombre: 'Hija', apellidos: 'De Prueba', fechaNacimiento: '2015-05-20'
  } as never);

  // Pendiente de aprobación: activo false y sin número. Lo contrario sería
  // colar a alguien en el censo sin que Secretaría lo admita.
  assert.equal(ficha.activo, false);
  assert.equal(ficha.numeroHermano, null);

  await HermanoService.aprobarSolicitud(tutor.id);

  const aprobada = await db.hermano.findUnique({ where: { id: ficha.id } });
  assert.equal(aprobada?.activo, true);
  assert.ok(aprobada?.numeroHermano, 'al aprobar debe llevarse número');
});

test('dar de baja libera el número y reactivar da uno nuevo', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  const tutor = await crearUsuarioPrueba();
  usuariosCreados.push(tutor.id);
  const ficha = await HermanoService.createDependentProfile(tutor.id, {
    nombre: 'Alta', apellidos: 'Y Baja', fechaNacimiento: '1990-01-01'
  } as never);
  await HermanoService.aprobarSolicitud(tutor.id);

  await HermanoService.darDeBajaHermano(ficha.id);
  const deBaja = await db.hermano.findUnique({ where: { id: ficha.id } });
  assert.equal(deBaja?.activo, false);
  assert.equal(deBaja?.numeroHermano, null, 'la baja libera el número');

  await HermanoService.reactivarHermano(ficha.id);
  const reactivada = await db.hermano.findUnique({ where: { id: ficha.id } });
  assert.equal(reactivada?.activo, true);
  assert.ok(reactivada?.numeroHermano, 'al reactivar debe llevarse número nuevo');
});

test('no queda ningún hermano activo sin número tras cerrar huecos', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  await HermanoService.cerrarHuecosDeNumero();
  const huerfanos = await db.hermano.count({ where: { activo: true, numeroHermano: null } });
  assert.equal(huerfanos, 0, 'la regla es que toda ficha activa tiene número');
});
```

- [ ] **Step 2: Ejecutarlos**

```bash
cd backend-desamparados && rtk npx tsx --test test/numero-hermano.test.ts
```

Esperado: PASAN. Si alguno falla, **es un hallazgo**: hay una vía de alta que deja fichas activas sin número. Arréglala en el servicio antes de seguir y déjalo escrito en el commit.

- [ ] **Step 3: Ejecutar la batería entera de los dos proyectos**

```bash
cd backend-desamparados && rtk npm test
cd ../desamparados-web && rtk npm test && rtk npx tsc -b --noEmit
```

Esperado: todo en verde.

- [ ] **Step 4: Commit**

```bash
rtk git add backend-desamparados/test/numero-hermano.test.ts
rtk git commit -F - <<'EOF'
Fijar por test que ninguna vía de alta deja a un hermano sin número

La regla es que toda ficha activa tiene número: una pendiente de aprobación
no lo tiene y una de baja lo libera. El test recorre las cuatro vías (alta
familiar, aprobación, baja y reactivación) y falla si alguna se la salta.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

## Al terminar la fase

1. Los dos proyectos en verde: `rtk npm test` en cada uno, más `rtk npx tsc -b --noEmit` en el frontend.
2. Comprobación a ojo, que es donde se vieron tres de los cuatro fallos:
   - `/cms` con la ventana baja, en claro y en oscuro: el menú conserva el fondo.
   - `/cms` con cualquier cargo: no hay bloque de actividad del equipo.
   - `/hermanos/hazte-hermano`: un DNI con letra equivocada se para en el navegador; uno con guiones y un teléfono con prefijo entran bien.
   - `/cms/hermanos`: el botón de asignar números baja el contador del menú.
3. La fase 2 (sesiones separadas) tiene su propio plan: `docs/superpowers/plans/2026-09-14-sesiones-separadas.md`.
