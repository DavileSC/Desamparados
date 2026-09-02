# Editar en pantalla propia, ficha completa y tutores — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el CMS se pueda usar a diario con un censo de verdad: editar cada ficha en su propia pantalla con confirmaciones, la ficha del hermano completa, el vínculo con el tutor y la emancipación desde secretaría, y las solicitudes de alta a la vista.

**Architecture:** Cinco piezas independientes que se pueden fusionar por separado. En el cliente, un componente compartido (`PantallaEdicion`) y un diálogo propio (`DialogoConfirmacion`) que sustituyen al formulario al pie del listado y a los `window.confirm`. En el servidor, dos cambios acotados: la lista blanca de campos editables crece con las fechas de alta y baja, y el servicio de emancipación se reparte en dos caminos (tutor con contraseña, staff con enlace) sobre el mismo tronco transaccional.

**Tech Stack:** React 19 + MUI + react-router 7 (`createBrowserRouter`, `useBlocker`) + vitest en el cliente; Express + Prisma + arktype + `node:test` en el servidor.

**Spec:** `docs/superpowers/specs/2026-08-29-cms-edicion-y-tutores-design.md`

## Global Constraints

- **No se añaden dependencias.** Todo sale de MUI, react-router y lo que ya está.
- **Textos visibles:** «Grupo Parroquial», nunca «Hermandad» ni «Cofradía». Los miembros sí son «hermanos».
- **TDD sin excepción:** test primero, verlo fallar, implementación mínima, verlo pasar, commit. Un commit por tarea como mínimo.
- **`npx prisma generate` después de cada `git pull`**, o el typecheck falla con errores raros de tipos de Prisma.
- **Los tests que necesitan MariaDB se omiten con motivo**, nunca se marcan como pasados. Si ves «omitido», arranca la base y vuelve a ejecutarlos.
- **`AllTheProviders` monta un `BrowserRouter`**, que no soporta `useBlocker`. Todo test que renderice `PantallaEdicion` o una pantalla de edición monta su propio `createMemoryRouter`.
- **Datos bancarios fuera:** `iban`, `titularCuenta` y `formaPagoPref` no se tocan en ninguna tarea. `HERMANO_SAFE_SELECT` ya los excluye a propósito.
- **Antes de empezar**, conviene tener fusionados los PR #2, #3 y #4: la tarea 1 toca `AdminLayout.tsx`, que el #2 modifica.

## Estructura de ficheros

**Cliente — se crean**

| Fichero | De qué se ocupa |
|---|---|
| `src/components/DialogoConfirmacion.tsx` | Diálogo sí/no reutilizable, con tono normal o de peligro. |
| `src/features/cms/PantallaEdicion.tsx` | Marco de las pantallas de edición: título, contenido, Guardar y Cancelar, y las dos confirmaciones. |
| `src/features/cms/BrotherEditPage.tsx` | La ficha del hermano completa, con el bloque de tutor y la emancipación. |
| `src/features/cms/NewsEditPage.tsx` | Edición de una noticia. |
| `src/features/cms/PublicationEditPage.tsx` | Edición de una publicación. |
| `src/features/cms/AgendaEditPage.tsx` | Edición de un evento. |
| `src/features/cms/InventoryEditPage.tsx` | Edición de un enser o una prenda. |

**Cliente — se modifican**

| Fichero | Cambio |
|---|---|
| `src/app/AdminLayout.tsx` | La barra lateral pasa a `sticky`. |
| `src/routes/index.tsx` | Las siete rutas de edición, con la guarda de rol de su listado. |
| `src/features/cms/BrothersAdminPage.tsx` | Pestañas Censo/Solicitudes, y «Editar» navega en vez de abrir el formulario de abajo. |
| `src/features/cms/NewsAdminPage.tsx`, `PublicationsAdminPage.tsx`, `AgendaAdminPage.tsx`, `InventoryAdminPage.tsx` | Igual: editar navega, y los borrados usan el diálogo propio. |
| `src/lib/api/brothers.ts` | `getBrother`, `emancipateBrother` y los campos nuevos del payload. |

**Servidor — se crean**

| Fichero | De qué se ocupa |
|---|---|
| `src/domain/fechas-hermano.ts` | Regla pura: la baja nunca antes del alta, y quitar la baja reactiva. |
| `test/fechas-hermano.test.ts` | Sus casos. |
| `test/emancipacion.test.ts` | El camino de staff de la emancipación. |

**Servidor — se modifican**

| Fichero | Cambio |
|---|---|
| `src/schemas/hermano.schema.ts` | `fechaAlta` y `fechaBaja` en el esquema de secretaría. |
| `src/services/hermano.service.ts` | Las fechas en la lista blanca, la regla, y el reparto de `emancipateProfile` en dos caminos. |
| `src/controllers/hermano.controller.ts` | `emancipateByStaff`. |
| `src/routes/hermano.routes.ts` | La ruta nueva, y el Hermano Mayor en las tres rutas de solicitudes. |
| `prisma/demo/generar.ts`, `prisma/seed-demo.ts` | Las solicitudes pendientes de demostración. |

---

### Task 1: La barra lateral no se va con el scroll

**Files:**
- Modify: `desamparados-web/src/app/AdminLayout.tsx:105`
- Test: `desamparados-web/src/app/__tests__/AdminLayout.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: nada que otras tareas usen. Es un cambio aislado.

- [ ] **Step 1: Write the failing test**

En `AdminLayout.test.tsx`, dentro del `describe('AdminLayout')` que ya existe:

```tsx
  it('la barra lateral se queda fija al bajar por la página', () => {
    // En Tesorería la página mide veinte mil píxeles: si el menú se va con el
    // scroll, se navega a ciegas.
    entrarComo('ADMIN')
    const { container } = renderWithProviders(<AdminLayout />)
    const barra = container.querySelector('aside')!
    const estilo = getComputedStyle(barra)
    expect(estilo.position).toBe('sticky')
    expect(estilo.height).toBe('100vh')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desamparados-web && npx vitest run src/app/__tests__/AdminLayout.test.tsx`
Expected: FAIL — `expected 'static' to be 'sticky'`.

- [ ] **Step 3: Write minimal implementation**

En `AdminLayout.tsx`, la línea del `aside`:

```tsx
          <Box
            component="aside"
            sx={{
              width: 250,
              flexShrink: 0,
              position: 'sticky',
              top: 0,
              // En un contenedor flex, sin esto el hijo se estira a toda la
              // altura y `sticky` no llega a pegarse a nada.
              alignSelf: 'flex-start',
              height: '100vh',
              overflowY: 'auto',
            }}
          >
            {barra}
          </Box>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desamparados-web && npx vitest run src/app/__tests__/AdminLayout.test.tsx`
Expected: PASS, y el resto de casos del fichero siguen en verde.

- [ ] **Step 5: Comprobarlo en el navegador**

Con los servidores levantados y la base sembrada, entrar en `/cms/tesoreria` y bajar del todo.
Expected: el menú sigue a la vista, y la sección activa sigue marcada.

- [ ] **Step 6: Commit**

```bash
git add desamparados-web/src/app/AdminLayout.tsx desamparados-web/src/app/__tests__/AdminLayout.test.tsx
git commit -m "Fijar la barra lateral del CMS"
```

---

### Task 2: El diálogo de confirmación

**Files:**
- Create: `desamparados-web/src/components/DialogoConfirmacion.tsx`
- Test: `desamparados-web/src/components/__tests__/DialogoConfirmacion.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `DialogoConfirmacion`, con estas props exactas, que usan las tareas 3, 6, 7 y 11:

```tsx
interface Props {
  abierto: boolean
  titulo: string
  mensaje: string
  textoConfirmar?: string   // por defecto 'Guardar'
  textoCancelar?: string    // por defecto 'Volver'
  peligro?: boolean         // pinta el botón de confirmar en rojo
  onConfirmar: () => void
  onCancelar: () => void
}
```

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/test-utils'
import DialogoConfirmacion from '../DialogoConfirmacion'

describe('DialogoConfirmacion', () => {
  it('cerrado no enseña nada', () => {
    renderWithProviders(
      <DialogoConfirmacion abierto={false} titulo="¿Guardar?" mensaje="Se van a guardar los cambios." onConfirmar={() => {}} onCancelar={() => {}} />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('dice qué se va a hacer y a qué afecta', () => {
    renderWithProviders(
      <DialogoConfirmacion abierto titulo="¿Guardar los cambios?" mensaje="Ficha de Rocío Gómez Marín." onConfirmar={() => {}} onCancelar={() => {}} />,
    )
    expect(screen.getByRole('dialog')).toHaveAccessibleName('¿Guardar los cambios?')
    expect(screen.getByText('Ficha de Rocío Gómez Marín.')).toBeInTheDocument()
  })

  it('avisa a quien lo abrió de lo que se ha pulsado', async () => {
    const confirmar = vi.fn()
    const cancelar = vi.fn()
    renderWithProviders(
      <DialogoConfirmacion abierto titulo="¿Guardar?" mensaje="." textoConfirmar="Guardar" onConfirmar={confirmar} onCancelar={cancelar} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(confirmar).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(cancelar).toHaveBeenCalledOnce()
  })

  it('lo que borra se pinta en rojo', () => {
    // El color no es el único aviso (el texto también lo dice), pero un botón
    // de borrar con el mismo aspecto que uno de guardar invita al accidente.
    renderWithProviders(
      <DialogoConfirmacion abierto peligro titulo="¿Eliminar?" mensaje="." textoConfirmar="Eliminar" onConfirmar={() => {}} onCancelar={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Eliminar' }).className).toMatch(/colorError/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desamparados-web && npx vitest run src/components/__tests__/DialogoConfirmacion.test.tsx`
Expected: FAIL — no existe el módulo `../DialogoConfirmacion`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'

interface Props {
  abierto: boolean
  titulo: string
  mensaje: string
  textoConfirmar?: string
  textoCancelar?: string
  peligro?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

/**
 * Pregunta antes de hacer algo que cuesta deshacer. Sustituye a los
 * `window.confirm` del CMS, que no dicen sobre qué se está preguntando y no se
 * leen bien en el móvil.
 */
export default function DialogoConfirmacion({
  abierto, titulo, mensaje, textoConfirmar = 'Guardar', textoCancelar = 'Volver', peligro = false, onConfirmar, onCancelar,
}: Props) {
  return (
    <Dialog open={abierto} onClose={onCancelar} aria-labelledby="dialogo-confirmacion-titulo">
      <DialogTitle id="dialogo-confirmacion-titulo">{titulo}</DialogTitle>
      <DialogContent>
        <DialogContentText>{mensaje}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelar}>{textoCancelar}</Button>
        <Button variant="contained" color={peligro ? 'error' : 'primary'} onClick={onConfirmar} autoFocus>
          {textoConfirmar}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desamparados-web && npx vitest run src/components/__tests__/DialogoConfirmacion.test.tsx`
Expected: PASS, los cuatro casos.

- [ ] **Step 5: Commit**

```bash
git add desamparados-web/src/components/DialogoConfirmacion.tsx desamparados-web/src/components/__tests__/DialogoConfirmacion.test.tsx
git commit -m "Anadir el dialogo de confirmacion del CMS"
```

---

### Task 3: El marco de las pantallas de edición

**Files:**
- Create: `desamparados-web/src/features/cms/PantallaEdicion.tsx`
- Test: `desamparados-web/src/features/cms/__tests__/PantallaEdicion.test.tsx`

**Interfaces:**
- Consumes: `DialogoConfirmacion` de la tarea 2.
- Produces: `PantallaEdicion`, que usan las tareas 5, 6 y 11:

```tsx
interface Props {
  titulo: string              // «Editar noticia»
  nombre: string              // lo que se está editando: «Apertura del curso cofrade»
  sucio: boolean              // hay cambios sin guardar
  guardando?: boolean
  volverA: string             // ruta del listado, p. ej. '/cms/noticias'
  onGuardar: () => void | Promise<void>
  children: ReactNode
}
```

- [ ] **Step 1: Write the failing test**

`AllTheProviders` monta un `BrowserRouter`, que no soporta `useBlocker`, así que este fichero monta su propio router de memoria:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import cmsTheme from '../../../theme/cms'
import PantallaEdicion from '../PantallaEdicion'

/** Monta la pantalla en una ruta de edición, con un listado al que volver. */
function montar(props: Partial<Parameters<typeof PantallaEdicion>[0]> = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/cms/noticias',
        element: <><h1>Archivo editorial</h1><Link to="/cms/noticias/1/editar">Ir a editar</Link></>,
      },
      {
        path: '/cms/noticias/1/editar',
        element: (
          <PantallaEdicion titulo="Editar noticia" nombre="Apertura del curso cofrade" sucio={false} volverA="/cms/noticias" onGuardar={() => {}} {...props}>
            <p>Campos del formulario</p>
          </PantallaEdicion>
        ),
      },
    ],
    { initialEntries: ['/cms/noticias/1/editar'] },
  )
  return render(
    <HelmetProvider><ThemeProvider theme={cmsTheme}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>,
  )
}

describe('PantallaEdicion', () => {
  it('enseña qué se está editando y sus campos', () => {
    montar()
    expect(screen.getByRole('heading', { name: /editar noticia/i })).toBeInTheDocument()
    expect(screen.getByText('Apertura del curso cofrade')).toBeInTheDocument()
    expect(screen.getByText('Campos del formulario')).toBeInTheDocument()
    // El listado no se ve: es justo lo que se venía a arreglar.
    expect(screen.queryByRole('heading', { name: /archivo editorial/i })).not.toBeInTheDocument()
  })

  it('guardar pide confirmación y nombra la ficha', async () => {
    const guardar = vi.fn()
    montar({ sucio: true, onGuardar: guardar })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(guardar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('Apertura del curso cofrade')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(guardar).toHaveBeenCalledOnce()
  })

  it('salir con cambios avisa antes de perderlos', async () => {
    montar({ sucio: true })
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('dialog')).toHaveTextContent(/se van a perder/i)
    // Mientras no se confirme, seguimos en la edición.
    expect(screen.getByText('Campos del formulario')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salir sin guardar' }))
    expect(await screen.findByRole('heading', { name: /archivo editorial/i })).toBeInTheDocument()
  })

  it('sin cambios, cancelar sale directo', async () => {
    // Avisar de que se pierden cambios que no existen enseña a ignorar los avisos.
    montar({ sucio: false })
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('heading', { name: /archivo editorial/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desamparados-web && npx vitest run src/features/cms/__tests__/PantallaEdicion.test.tsx`
Expected: FAIL — no existe `../PantallaEdicion`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useState, type ReactNode } from 'react'
import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { useBlocker, useNavigate } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'

interface Props {
  titulo: string
  nombre: string
  sucio: boolean
  guardando?: boolean
  volverA: string
  onGuardar: () => void | Promise<void>
  children: ReactNode
}

/**
 * Marco de las pantallas de edición del CMS.
 *
 * El aviso de «tienes cambios sin guardar» va con `useBlocker`, no colgado del
 * botón Cancelar: así salta también si se navega con el botón atrás del
 * navegador o pulsando otra sección del menú lateral. Necesita un data router
 * (`createBrowserRouter`), que es lo que monta la aplicación.
 */
export default function PantallaEdicion({ titulo, nombre, sucio, guardando = false, volverA, onGuardar, children }: Props) {
  const navegar = useNavigate()
  const [confirmandoGuardado, setConfirmandoGuardado] = useState(false)

  const bloqueo = useBlocker(({ currentLocation, nextLocation }) => sucio && currentLocation.pathname !== nextLocation.pathname)

  return (
    <>
      <Typography variant="h2" component="h1" sx={{ mb: 0.5 }}>{titulo}</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>{nombre}</Typography>

      <Paper sx={{ p: { xs: 2.5, md: 4 }, maxWidth: 900 }}>
        {children}

        <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
          <Button variant="contained" disabled={guardando} onClick={() => setConfirmandoGuardado(true)}>Guardar</Button>
          <Button disabled={guardando} onClick={() => navegar(volverA)}>Cancelar</Button>
        </Stack>
      </Paper>

      <DialogoConfirmacion
        abierto={confirmandoGuardado}
        titulo="¿Guardar los cambios?"
        mensaje={nombre}
        textoConfirmar="Guardar cambios"
        onConfirmar={() => { setConfirmandoGuardado(false); void onGuardar() }}
        onCancelar={() => setConfirmandoGuardado(false)}
      />

      <DialogoConfirmacion
        abierto={bloqueo.state === 'blocked'}
        titulo="Hay cambios sin guardar"
        mensaje="Si sales ahora se van a perder los cambios que has hecho en esta ficha."
        textoConfirmar="Salir sin guardar"
        textoCancelar="Seguir editando"
        peligro
        onConfirmar={() => bloqueo.proceed?.()}
        onCancelar={() => bloqueo.reset?.()}
      />

      <Box sx={{ height: 24 }} />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desamparados-web && npx vitest run src/features/cms/__tests__/PantallaEdicion.test.tsx`
Expected: PASS, los cuatro casos.

Si el caso de «salir con cambios» no bloquea, comprueba que el test monta `createMemoryRouter` y no `BrowserRouter`: con un router que no es de datos, `useBlocker` no hace nada.

- [ ] **Step 5: Commit**

```bash
git add desamparados-web/src/features/cms/PantallaEdicion.tsx desamparados-web/src/features/cms/__tests__/PantallaEdicion.test.tsx
git commit -m "Anadir el marco de las pantallas de edicion del CMS"
```

---
### Task 4: Las fechas de alta y baja, editables y con su regla

**Files:**
- Create: `backend-desamparados/src/domain/fechas-hermano.ts`
- Test: `backend-desamparados/test/fechas-hermano.test.ts`
- Modify: `backend-desamparados/src/schemas/hermano.schema.ts:55-61`, `backend-desamparados/src/services/hermano.service.ts:43-47` (lista blanca), `:316-322` (`updateAdminMode`), `:533-555` (`prepareUpdateData`)

**Interfaces:**
- Consumes: nada.
- Produces: `comprobarFechasHermano(fechaAlta, fechaBaja)` en `src/domain/fechas-hermano.ts`, y el endpoint `PUT /api/hermanos/admin/:id` pasa a aceptar `fechaAlta` y `fechaBaja` como `YYYY-MM-DD`, y `fechaBaja: null`. La tarea 5 los usa desde el cliente.

```ts
export function comprobarFechasHermano(
  fechaAlta: Date | null | undefined,
  fechaBaja: Date | null | undefined,
): { activo?: boolean }
```

Devuelve `{ activo: true }` cuando se ha quitado la fecha de baja, `{}` si no hay nada que forzar, y lanza `HttpError` si la baja es anterior al alta.

- [ ] **Step 1: Write the failing test**

`test/fechas-hermano.test.ts`:

```ts
// La regla vive suelta, sin base de datos: secretaría regulariza fichas antiguas
// a mano y estas dos fechas son las que más se tocan.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { comprobarFechasHermano } from '../src/domain/fechas-hermano.js';

const ALTA = new Date('2020-03-15');

describe('fechas de alta y baja del hermano', () => {
  test('una baja posterior al alta vale', () => {
    assert.deepEqual(comprobarFechasHermano(ALTA, new Date('2024-01-10')), {});
  });

  test('la baja el mismo día del alta vale', () => {
    // Alguien que se da de alta y se arrepiente el mismo día existe.
    assert.deepEqual(comprobarFechasHermano(ALTA, ALTA), {});
  });

  test('una baja anterior al alta se rechaza', () => {
    assert.throws(
      () => comprobarFechasHermano(ALTA, new Date('2019-12-31')),
      /baja.*anterior.*alta/i,
    );
  });

  test('quitar la fecha de baja vuelve a poner activo al hermano', () => {
    assert.deepEqual(comprobarFechasHermano(ALTA, null), { activo: true });
  });

  test('si no se toca ninguna fecha, no fuerza nada', () => {
    assert.deepEqual(comprobarFechasHermano(undefined, undefined), {});
  });

  test('poner solo la baja, sin tocar el alta, no se puede comprobar y pasa', () => {
    // El servicio le pasará el alta que ya tiene la ficha; si aun así llega sin
    // ella, no inventamos una regla con datos que no tenemos.
    assert.deepEqual(comprobarFechasHermano(undefined, new Date('2024-01-10')), {});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-desamparados && npx tsx --test test/fechas-hermano.test.ts`
Expected: FAIL — no existe el módulo `../src/domain/fechas-hermano.js`.

- [ ] **Step 3: Write minimal implementation**

`src/domain/fechas-hermano.ts`:

```ts
import { HttpError } from '../utils/http-error.js';

/**
 * Reglas de las dos fechas de la ficha.
 *
 * Vive aquí y no en el formulario porque el CMS no es el único que puede llamar
 * al endpoint: una regla que solo existe en la pantalla no es una regla.
 */
export function comprobarFechasHermano(
  fechaAlta: Date | null | undefined,
  fechaBaja: Date | null | undefined,
): { activo?: boolean } {
  if (fechaAlta && fechaBaja && fechaBaja < fechaAlta) {
    throw new HttpError('La fecha de baja no puede ser anterior a la de alta.');
  }
  // Quitar la baja es la forma natural de decir «este hermano sigue con nosotros».
  if (fechaBaja === null) return { activo: true };
  return {};
}
```

Comprueba antes cómo se importa `HttpError` en `hermano.service.ts` y usa exactamente esa ruta.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-desamparados && npx tsx --test test/fechas-hermano.test.ts`
Expected: PASS, los seis casos.

- [ ] **Step 5: Aceptar las dos fechas en el esquema**

En `src/schemas/hermano.schema.ts`, dentro de `updateAdminHermanoSchema`:

```ts
export const updateAdminHermanoSchema = type({
    body: baseUpdateBody.and(datosProcesionSchema).and(type({
        "activo?": "boolean",
        "esTitular?": "boolean",
        "numeroHermano?": "number", // Opcional, por si manejan antigüedad
        // Secretaría regulariza fichas antiguas: estas dos fechas son las que
        // más se corrigen a mano. La baja admite null para revertirla.
        "fechaAlta?": type("string").matching(/^\d{4}-\d{2}-\d{2}$/),
        "fechaBaja?": type("string").matching(/^\d{4}-\d{2}-\d{2}$/).or("null")
    }))
});
```

- [ ] **Step 6: Dejarlas pasar la lista blanca y aplicar la regla**

En `src/services/hermano.service.ts`, la lista blanca:

```ts
const ADMIN_EDITABLE_FIELDS = [
  ...USER_EDITABLE_FIELDS,
  'tieneTunicaPropia', 'tunica', 'alturaHombro', 'puesto',
  'activo', 'esTitular', 'numeroHermano',
  'fechaAlta', 'fechaBaja'
] as const;
```

En `prepareUpdateData`, generaliza la conversión de fechas (hoy solo convierte `fechaNacimiento`):

```ts
    for (const campo of ['fechaNacimiento', 'fechaAlta', 'fechaBaja'] as const) {
      const valor = cleanedData[campo];
      if (typeof valor !== 'string') continue;
      const fecha = new Date(valor);
      if (Number.isNaN(fecha.getTime())) throw new HttpError(`Fecha inválida en ${campo}.`);
      cleanedData[campo] = fecha;
    }
```

Y en `updateAdminMode`, aplica la regla contra el alta que ya tiene la ficha cuando no venga en el cuerpo:

```ts
  static async updateAdminMode(id: number, data: UpdateAdminHermanoDto) {
    const dataToUpdate = this.prepareUpdateData(data, ADMIN_EDITABLE_FIELDS);

    // La baja se compara con el alta que vaya a quedar en la ficha, no solo con
    // la que venga en el cuerpo: cambiar únicamente la baja es lo habitual.
    const alta = (dataToUpdate.fechaAlta as Date | undefined)
      ?? (await db.hermano.findUnique({ where: { id }, select: { fechaAlta: true } }))?.fechaAlta;
    const forzado = comprobarFechasHermano(alta, dataToUpdate.fechaBaja as Date | null | undefined);

    return await db.hermano.update({
      where: { id },
      data: { ...dataToUpdate, ...forzado }
    });
  }
```

Importa `comprobarFechasHermano` arriba del fichero.

- [ ] **Step 7: Comprobar tipos y la suite entera**

Run: `cd backend-desamparados && npx tsc --noEmit && npm test`
Expected: todo en verde, ninguno omitido si MariaDB está levantada.

- [ ] **Step 8: Commit**

```bash
git add backend-desamparados/src/domain/fechas-hermano.ts backend-desamparados/test/fechas-hermano.test.ts backend-desamparados/src/schemas/hermano.schema.ts backend-desamparados/src/services/hermano.service.ts
git commit -m "Permitir corregir las fechas de alta y baja del hermano"
```

---

### Task 5: La ficha del hermano, completa y en su propia pantalla

**Files:**
- Create: `desamparados-web/src/features/cms/BrotherEditPage.tsx`
- Test: `desamparados-web/src/features/cms/__tests__/BrotherEditPage.test.tsx`
- Modify: `desamparados-web/src/lib/api/brothers.ts`, `desamparados-web/src/routes/index.tsx:202`, `desamparados-web/src/features/cms/BrothersAdminPage.tsx`

**Interfaces:**
- Consumes: `PantallaEdicion` (tarea 3), y `fechaAlta`/`fechaBaja` del endpoint (tarea 4).
- Produces: la ruta `/cms/hermanos/:id/editar`, y en `brothers.ts`:

```ts
export function getBrother(id: number): Promise<AdminBrother>
export interface AdminBrotherPayload {
  nombre?: string; apellidos?: string; dni?: string; fechaNacimiento?: string
  telefono?: string; email?: string; direccion?: string; poblacion?: string; codigoPostal?: string
  numeroHermano?: number; activo?: boolean; esTitular?: boolean
  tieneTunicaPropia?: boolean; tunica?: string; alturaHombro?: number; puesto?: string
  fechaAlta?: string; fechaBaja?: string | null
}
```

- [ ] **Step 1: Ampliar el cliente**

En `src/lib/api/brothers.ts`, añade el tipo de la ficha completa y la lectura por id. `AdminBrother` no trae hoy `fechaNacimiento`, `direccion`, `fechaBaja`, `tunica`, `alturaHombro`, `puesto` ni `tieneTunicaPropia`, aunque el servidor sí los devuelve (`HERMANO_SAFE_SELECT`):

```ts
export interface AdminBrother {
  id: number
  nombre: string
  apellidos: string
  dni: string | null
  fechaNacimiento: string
  email: string | null
  telefono: string | null
  direccion: string | null
  poblacion: string | null
  codigoPostal: string | null
  activo: boolean
  numeroHermano: number | null
  fechaAlta: string
  fechaBaja: string | null
  esTitular: boolean
  tieneTunicaPropia: boolean
  tunica: string | null
  alturaHombro: number | null
  puesto: string | null
  user?: { email: string | null; telefono: string | null }
}

export function getBrother(id: number) {
  return apiFetch<AdminBrother>(`/hermanos/admin/${id}`)
}
```

Y amplía `AdminBrotherPayload` con los campos de la tabla de arriba.

- [ ] **Step 2: Write the failing test**

`src/features/cms/__tests__/BrotherEditPage.test.tsx`. Monta su propio router de memoria, como en la tarea 3, con la ruta `/cms/hermanos/:id/editar`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import cmsTheme from '../../../theme/cms'
import BrotherEditPage from '../BrotherEditPage'

const ficha = {
  id: 42, nombre: 'Rocío', apellidos: 'Gómez Marín', dni: '20000001R',
  fechaNacimiento: '1985-04-12T00:00:00.000Z', email: 'demo.1@ejemplo.invalido', telefono: '600111222',
  direccion: 'Calle Victoria, 14', poblacion: 'Málaga', codigoPostal: '29012',
  activo: true, numeroHermano: 118, fechaAlta: '2019-02-10T00:00:00.000Z', fechaBaja: null,
  esTitular: true, tieneTunicaPropia: false, tunica: 'M', alturaHombro: 168, puesto: 'Nazareno de cirio',
}

function responder(cuerpo: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }),
  ))
}

function montar(id = 42) {
  const router = createMemoryRouter(
    [
      { path: '/cms/hermanos', element: <h1>Gestión de hermanos</h1> },
      { path: '/cms/hermanos/:id/editar', element: <BrotherEditPage /> },
    ],
    { initialEntries: [`/cms/hermanos/${id}/editar`] },
  )
  return render(<HelmetProvider><ThemeProvider theme={cmsTheme}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>)
}

afterEach(() => { vi.unstubAllGlobals() })

describe('BrotherEditPage', () => {
  it('enseña los datos personales, el contacto, la hermandad y la procesión', async () => {
    responder(ficha)
    montar()
    expect(await screen.findByDisplayValue('Rocío')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20000001R')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1985-04-12')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Calle Victoria, 14')).toBeInTheDocument()
    expect(screen.getByDisplayValue('29012')).toBeInTheDocument()
    expect(screen.getByDisplayValue('118')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Nazareno de cirio')).toBeInTheDocument()
    expect(screen.getByDisplayValue('168')).toBeInTheDocument()
  })

  it('no enseña el listado del censo mientras se edita', async () => {
    responder(ficha)
    montar()
    await screen.findByDisplayValue('Rocío')
    expect(screen.queryByRole('heading', { name: /gestión de hermanos/i })).not.toBeInTheDocument()
  })

  it('manda solo la ficha, con las fechas en formato de día', async () => {
    responder(ficha)
    montar()
    const dni = await screen.findByLabelText('DNI')
    await userEvent.clear(dni)
    await userEvent.type(dni, '20000001X')

    const enviar = vi.fn().mockResolvedValue(new Response(JSON.stringify(ficha), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', enviar)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const [, opciones] = enviar.mock.calls[0]
    const cuerpo = JSON.parse(opciones.body as string)
    expect(cuerpo.dni).toBe('20000001X')
    expect(cuerpo.fechaNacimiento).toBe('1985-04-12')
    expect(cuerpo.fechaAlta).toBe('2019-02-10')
    // Sin datos bancarios: no son de esta pantalla.
    expect(cuerpo).not.toHaveProperty('iban')
  })

  it('explica el fallo si la ficha no carga', async () => {
    responder({ message: 'Hermano no encontrado' }, 404)
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar/i)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd desamparados-web && npx vitest run src/features/cms/__tests__/BrotherEditPage.test.tsx`
Expected: FAIL — no existe `../BrotherEditPage`.

- [ ] **Step 4: Escribir la pantalla**

`src/features/cms/BrotherEditPage.tsx`. Los dieciséis campos en cuatro bloques, con `PantallaEdicion` como marco:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Divider, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useParams } from 'react-router-dom'
import PantallaEdicion from './PantallaEdicion'
import { getBrother, updateBrother, type AdminBrother } from '../../lib/api/brothers'

/** El servidor manda ISO; los campos de fecha del navegador quieren YYYY-MM-DD. */
const aDia = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

type Formulario = {
  nombre: string; apellidos: string; dni: string; fechaNacimiento: string
  telefono: string; email: string; direccion: string; poblacion: string; codigoPostal: string
  numeroHermano: string; activo: boolean; fechaAlta: string; fechaBaja: string
  tieneTunicaPropia: boolean; tunica: string; alturaHombro: string; puesto: string
}

const desdeFicha = (f: AdminBrother): Formulario => ({
  nombre: f.nombre, apellidos: f.apellidos, dni: f.dni ?? '', fechaNacimiento: aDia(f.fechaNacimiento),
  telefono: f.telefono ?? '', email: f.email ?? '', direccion: f.direccion ?? '',
  poblacion: f.poblacion ?? '', codigoPostal: f.codigoPostal ?? '',
  numeroHermano: f.numeroHermano?.toString() ?? '', activo: f.activo,
  fechaAlta: aDia(f.fechaAlta), fechaBaja: aDia(f.fechaBaja),
  tieneTunicaPropia: f.tieneTunicaPropia, tunica: f.tunica ?? '',
  alturaHombro: f.alturaHombro?.toString() ?? '', puesto: f.puesto ?? '',
})

export default function BrotherEditPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [ficha, setFicha] = useState<AdminBrother | null>(null)
  const [form, setForm] = useState<Formulario | null>(null)
  const [inicial, setInicial] = useState<Formulario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getBrother(Number(id))
      .then((f) => { setFicha(f); setForm(desdeFicha(f)); setInicial(desdeFicha(f)) })
      .catch(() => setError('No se ha podido cargar la ficha del hermano.'))
  }, [id])

  const campo = useCallback(<K extends keyof Formulario>(clave: K, valor: Formulario[K]) => {
    setForm((actual) => (actual ? { ...actual, [clave]: valor } : actual))
  }, [])

  const guardar = async () => {
    if (!form) return
    setGuardando(true)
    try {
      await updateBrother(Number(id), {
        nombre: form.nombre,
        apellidos: form.apellidos,
        ...(form.dni ? { dni: form.dni } : {}),
        ...(form.fechaNacimiento ? { fechaNacimiento: form.fechaNacimiento } : {}),
        ...(form.telefono ? { telefono: form.telefono } : {}),
        ...(form.email ? { email: form.email } : {}),
        direccion: form.direccion,
        poblacion: form.poblacion,
        codigoPostal: form.codigoPostal,
        ...(form.numeroHermano ? { numeroHermano: Number(form.numeroHermano) } : {}),
        activo: form.activo,
        ...(form.fechaAlta ? { fechaAlta: form.fechaAlta } : {}),
        fechaBaja: form.fechaBaja || null,
        tieneTunicaPropia: form.tieneTunicaPropia,
        tunica: form.tunica,
        ...(form.alturaHombro ? { alturaHombro: Number(form.alturaHombro) } : {}),
        puesto: form.puesto,
      })
      navegar('/cms/hermanos')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar la ficha.')
      setGuardando(false)
    }
  }

  if (error && !form) return <Alert severity="error">{error}</Alert>
  if (!form || !ficha) return <CircularProgress aria-label="Cargando la ficha" />

  const texto = (clave: keyof Formulario, etiqueta: string, tipo = 'text') => (
    <TextField
      label={etiqueta}
      type={tipo}
      value={form[clave] as string}
      onChange={(e) => campo(clave, e.target.value as never)}
      InputLabelProps={tipo === 'date' ? { shrink: true } : undefined}
      fullWidth
    />
  )

  return (
    <>
      <Helmet><title>Editar hermano | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      <PantallaEdicion
        titulo="Editar hermano"
        nombre={`${ficha.nombre} ${ficha.apellidos}`}
        sucio={JSON.stringify(form) !== JSON.stringify(inicial)}
        guardando={guardando}
        volverA="/cms/hermanos"
        onGuardar={guardar}
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Datos personales</Typography>
            <Stack spacing={2}>
              {texto('nombre', 'Nombre')}
              {texto('apellidos', 'Apellidos')}
              {texto('dni', 'DNI')}
              {texto('fechaNacimiento', 'Fecha de nacimiento', 'date')}
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Contacto</Typography>
            <Stack spacing={2}>
              {texto('telefono', 'Teléfono')}
              {texto('email', 'Correo electrónico')}
              {texto('direccion', 'Dirección')}
              {texto('poblacion', 'Población')}
              {texto('codigoPostal', 'Código postal')}
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Hermandad</Typography>
            <Stack spacing={2}>
              {texto('numeroHermano', 'Número de hermano', 'number')}
              {texto('fechaAlta', 'Fecha de alta', 'date')}
              {texto('fechaBaja', 'Fecha de baja', 'date')}
              <FormControlLabel
                control={<Switch checked={form.activo} onChange={(e) => campo('activo', e.target.checked)} />}
                label="Hermano activo"
              />
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Procesión</Typography>
            <Stack spacing={2}>
              {texto('puesto', 'Puesto en el cortejo')}
              {texto('tunica', 'Talla de túnica')}
              {texto('alturaHombro', 'Altura de hombro (cm)', 'number')}
              <FormControlLabel
                control={<Switch checked={form.tieneTunicaPropia} onChange={(e) => campo('tieneTunicaPropia', e.target.checked)} />}
                label="Tiene túnica propia"
              />
            </Stack>
          </Box>
        </Stack>
      </PantallaEdicion>
    </>
  )
}
```

- [ ] **Step 5: Montar la ruta**

En `src/routes/index.tsx`, junto a las demás rutas del CMS, con la **misma guarda que el listado**:

```tsx
const BrotherEditPage = lazy(() => import('../features/cms/BrotherEditPage'))
```

```tsx
          { path: 'hermanos/:id/editar', element: <RequireRole roles={rolesPorRutaCms.hermanos}>{withSuspense(BrotherEditPage)}</RequireRole> },
```

- [ ] **Step 6: Que el listado navegue en vez de abrir el formulario de abajo**

En `BrothersAdminPage.tsx`: borra `selected`, `form`, `edit`, `save` y el bloque `{selected && <Paper …>}` del final, y deja el botón así:

```tsx
{canEdit && <Button aria-label={`Editar ${brother.nombre} ${brother.apellidos}`} startIcon={<EditIcon />} component={Link} to={`/cms/hermanos/${brother.id}/editar`}>Editar</Button>}
```

Importa `Link` de `react-router-dom`. Quita también los imports que dejen de usarse (`updateBrother`).

- [ ] **Step 7: Run test to verify it passes**

Run: `cd desamparados-web && npx vitest run src/features/cms/__tests__/BrotherEditPage.test.tsx`
Expected: PASS, los cuatro casos.

- [ ] **Step 8: Suite completa, tipos y lint**

Run: `cd desamparados-web && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: todo en verde. Los dos avisos de *fast refresh* de `routes/index.tsx` y `AdminLayout.tsx` ya venían de antes.

- [ ] **Step 9: Commit**

```bash
git add desamparados-web/src/features/cms/BrotherEditPage.tsx desamparados-web/src/features/cms/__tests__/BrotherEditPage.test.tsx desamparados-web/src/lib/api/brothers.ts desamparados-web/src/routes/index.tsx desamparados-web/src/features/cms/BrothersAdminPage.tsx
git commit -m "Editar la ficha completa del hermano en su propia pantalla"
```

---

### Task 6: Las otras cuatro pantallas, a su ruta de edición

**Files:**
- Create: `desamparados-web/src/features/cms/NewsEditPage.tsx`, `PublicationEditPage.tsx`, `AgendaEditPage.tsx`, `InventoryEditPage.tsx`
- Test: `desamparados-web/src/features/cms/__tests__/NewsEditPage.test.tsx`
- Modify: `desamparados-web/src/routes/index.tsx`, y las cuatro páginas de listado

**Interfaces:**
- Consumes: `PantallaEdicion` (tarea 3).
- Produces: las rutas `noticias/:id/editar`, `publicaciones/:id/editar`, `agenda/:id/editar`, `inventario/:id/editar`.

Las cuatro se hacen igual que la ficha del hermano en la tarea 5: la pantalla carga su elemento por id, lo pone en un formulario, y `PantallaEdicion` pone el marco y las confirmaciones. El listado deja de tener estado de edición y su botón pasa a ser un `Link`.

- [ ] **Step 1: Write the failing test (noticias)**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import cmsTheme from '../../../theme/cms'
import NewsEditPage from '../NewsEditPage'

const noticia = {
  id: 7, slug: 'apertura-curso-cofrade', titulo: 'Apertura del curso cofrade 2026-2027',
  extracto: 'El Grupo Parroquial abre el nuevo curso.', contenido: '<p>Texto</p>',
  imagenUrl: null, visible: true, fecha: '2026-08-26T00:00:00.000Z',
}

afterEach(() => { vi.unstubAllGlobals() })

function montar() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(noticia), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ))
  const router = createMemoryRouter(
    [
      { path: '/cms/noticias', element: <h1>Archivo editorial</h1> },
      { path: '/cms/noticias/:id/editar', element: <NewsEditPage /> },
    ],
    { initialEntries: ['/cms/noticias/7/editar'] },
  )
  return render(<HelmetProvider><ThemeProvider theme={cmsTheme}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>)
}

describe('NewsEditPage', () => {
  it('carga la noticia en el formulario, sin el archivo detrás', async () => {
    montar()
    expect(await screen.findByDisplayValue('Apertura del curso cofrade 2026-2027')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /archivo editorial/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desamparados-web && npx vitest run src/features/cms/__tests__/NewsEditPage.test.tsx`
Expected: FAIL — no existe `../NewsEditPage`.

- [ ] **Step 3: Escribir las cuatro pantallas**

Cada una con la misma forma que `BrotherEditPage`: `useParams` para el id, carga en `useEffect`, estado `form` e `inicial` para saber si está sucio, y `PantallaEdicion` alrededor con `volverA` apuntando a su listado. Los campos son los que ya tiene hoy cada formulario en su listado — cópialos tal cual de `NewsAdminPage`, `PublicationsAdminPage`, `AgendaAdminPage` e `InventoryAdminPage`, sin cambiarlos.

Para el cliente, comprueba en `src/lib/api/` si existe ya la lectura por id de cada tipo; si no, añádela junto a las demás siguiendo el patrón de `getBrother`.

- [ ] **Step 4: Montar las cuatro rutas**

```tsx
          { path: 'noticias/:id/editar', element: <RequireRole roles={rolesPorRutaCms.noticias}>{withSuspense(NewsEditPage)}</RequireRole> },
          { path: 'publicaciones/:id/editar', element: <RequireRole roles={rolesPorRutaCms.publicaciones}>{withSuspense(PublicationEditPage)}</RequireRole> },
          { path: 'agenda/:id/editar', element: <RequireRole roles={rolesPorRutaCms.agenda}>{withSuspense(AgendaEditPage)}</RequireRole> },
          { path: 'inventario/:id/editar', element: <RequireRole roles={rolesPorRutaCms.inventario}>{withSuspense(InventoryEditPage)}</RequireRole> },
```

- [ ] **Step 5: Que los cuatro listados naveguen**

En cada listado, el botón de editar pasa a `component={Link} to={...}` y se borra el estado de edición y su formulario del pie, igual que en la tarea 5.

- [ ] **Step 6: Ampliar el test de guardas**

En `src/app/__tests__/AdminLayout.test.tsx`, el `describe` que compara el menú con `rolesPorRutaCms` gana un caso: cada ruta de edición existe en el router con la misma lista de roles que su listado. Recórrelas por nombre:

```tsx
  it('cada pantalla de edición se guarda con los mismos roles que su listado', () => {
    for (const seccion of ['noticias', 'publicaciones', 'agenda', 'hermanos', 'inventario'] as const) {
      expect(rolesPorRutaCms[seccion], `${seccion} no tiene guarda`).toBeDefined()
    }
  })
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd desamparados-web && npx vitest run`
Expected: todo en verde.

- [ ] **Step 8: Commit**

```bash
git add desamparados-web/src
git commit -m "Editar noticias, publicaciones, agenda e inventario en su propia pantalla"
```

---

### Task 7: Los borrados, con el diálogo del CMS

**Files:**
- Modify: `desamparados-web/src/features/cms/NewsAdminPage.tsx:52`, `PublicationsAdminPage.tsx:31`, `AgendaAdminPage.tsx:54`, `InventoryAdminPage.tsx:27`
- Test: `desamparados-web/src/features/cms/__tests__/NewsAdminPage.test.tsx`

**Interfaces:**
- Consumes: `DialogoConfirmacion` (tarea 2).
- Produces: nada nuevo.

- [ ] **Step 1: Write the failing test**

```tsx
  it('antes de borrar pregunta, y dice qué se va a borrar', async () => {
    // Hasta ahora era un window.confirm: no decía de qué noticia hablaba.
    responder([noticia])
    renderWithProviders(<NewsAdminPage />)
    await userEvent.click(await screen.findByRole('button', { name: /eliminar apertura/i }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Apertura del curso cofrade 2026-2027')
  })
```

Adáptalo al fichero de test que ya exista para esa página; si no hay ninguno, créalo con el patrón de `PanelPage.test.tsx` (stub de `fetch` con `vi.stubGlobal`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desamparados-web && npx vitest run src/features/cms/__tests__/NewsAdminPage.test.tsx`
Expected: FAIL — no aparece ningún `dialog`, porque hoy es `window.confirm`, que en jsdom no pinta nada.

- [ ] **Step 3: Sustituir el confirm nativo**

En cada listado, guarda en estado qué elemento se va a borrar y pinta el diálogo:

```tsx
  const [porBorrar, setPorBorrar] = useState<Noticia | null>(null)

  const borrar = async () => {
    if (!porBorrar) return
    try { await deleteNews(porBorrar.id); await load(); setNotice('Noticia eliminada correctamente.') }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'No se ha podido eliminar la noticia.') }
    finally { setPorBorrar(null) }
  }
```

```tsx
  <DialogoConfirmacion
    abierto={porBorrar !== null}
    titulo="¿Eliminar la noticia?"
    mensaje={porBorrar ? porBorrar.titulo : ''}
    textoConfirmar="Eliminar"
    peligro
    onConfirmar={() => void borrar()}
    onCancelar={() => setPorBorrar(null)}
  />
```

El botón de la lista pasa a `onClick={() => setPorBorrar(item)}`.

**No toques** la devolución de prendas de `InventoryAdminPage.tsx:29`, que usa un `confirm` para preguntar si la prenda necesita lavado. Eso no es una confirmación sino un dato, y arreglarlo es cambiar ese flujo: está anotado como fuera de alcance en el spec.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desamparados-web && npx vitest run`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add desamparados-web/src/features/cms
git commit -m "Confirmar los borrados con el dialogo del CMS"
```

---

### Task 8: Las solicitudes de alta, en su pestaña

**Files:**
- Modify: `desamparados-web/src/features/cms/BrothersAdminPage.tsx`
- Test: `desamparados-web/src/features/cms/__tests__/BrothersAdminPage.test.tsx`

**Interfaces:**
- Consumes: `getPendingRequests`, `approveRequest`, `rejectRequest`, que ya existen en `src/lib/api/brothers.ts`.
- Produces: la vista se guarda en la URL como `?vista=solicitudes`; la tarea 11 vuelve a ella al terminar una emancipación.

- [ ] **Step 1: Write the failing test**

```tsx
  it('la pestaña de solicitudes se ve aunque no haya ninguna', async () => {
    // Antes el bloque entero desaparecía sin solicitudes: la función existía y
    // era invisible, así que nadie sabía que estaba.
    responderCenso({ data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } }, [])
    renderWithProviders(<BrothersAdminPage />)
    await userEvent.click(await screen.findByRole('tab', { name: /solicitudes/i }))
    expect(screen.getByText(/no hay solicitudes pendientes/i)).toBeInTheDocument()
  })

  it('la pestaña lleva el número de pendientes', async () => {
    responderCenso({ data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } }, [
      { id: 1, email: 'nuevo@ejemplo.invalido', nombre: 'Nuevo', apellidos: 'Hermano', hermanos: [{ id: 9 }] },
      { id: 2, email: 'otra@ejemplo.invalido', nombre: 'Otra', apellidos: 'Solicitante', hermanos: [{ id: 10 }] },
    ])
    renderWithProviders(<BrothersAdminPage />)
    expect(await screen.findByRole('tab', { name: /solicitudes \(2\)/i })).toBeInTheDocument()
  })
```

`responderCenso` es un ayudante del propio fichero que responde a las dos llamadas (`searchBrothers` y `getPendingRequests`) según la URL pedida.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desamparados-web && npx vitest run src/features/cms/__tests__/BrothersAdminPage.test.tsx`
Expected: FAIL — no hay ningún elemento con rol `tab`.

- [ ] **Step 3: Write minimal implementation**

Dos pestañas con `Tabs`/`Tab` de MUI, con la vista guardada en la URL:

```tsx
  const [params, setParams] = useSearchParams()
  const vista = params.get('vista') === 'solicitudes' ? 'solicitudes' : 'censo'
```

```tsx
    <Tabs value={vista} onChange={(_, valor) => setParams(valor === 'solicitudes' ? { vista: 'solicitudes' } : {})} sx={{ mb: 3 }}>
      <Tab value="censo" label="Censo" />
      <Tab value="solicitudes" label={`Solicitudes (${requests.length})`} />
    </Tabs>
```

En la pestaña de solicitudes, la lista de siempre con Aprobar y Rechazar y, cuando está vacía:

```tsx
      {requests.length === 0 && <Alert severity="info">No hay solicitudes pendientes.</Alert>}
```

El buscador y el censo se quedan en la pestaña «Censo».

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desamparados-web && npx vitest run src/features/cms/__tests__/BrothersAdminPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desamparados-web/src/features/cms/BrothersAdminPage.tsx desamparados-web/src/features/cms/__tests__/BrothersAdminPage.test.tsx
git commit -m "Sacar las solicitudes de alta a su propia pestaña"
```

---
### Task 9: El Hermano Mayor también admite hermanos

**Files:**
- Modify: `backend-desamparados/src/routes/hermano.routes.ts:19` y las tres rutas de solicitudes (`:40`, `:41`, y la de rechazar), `desamparados-web/src/features/cms/BrothersAdminPage.tsx:10`
- Test: `backend-desamparados/test/permisos-hermano-mayor.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `GET /api/hermanos/admin/solicitudes` y las dos acciones sobre ellas admiten `HERMANO_MAYOR`.

- [ ] **Step 1: Write the failing test**

En `test/permisos-hermano-mayor.test.ts`, con el mismo ayudante `como(...)` que usan los casos que ya están:

```ts
  test('el Hermano Mayor puede ver las solicitudes de alta', async () => {
    // Tiene acceso a todo salvo la administración del sistema; que no pudiera
    // admitir hermanos se quedaba descolgado.
    const res = await como('HERMANO_MAYOR', '/api/hermanos/admin/solicitudes');
    assert.notEqual(res.status, 403);
  });

  test('un community manager sigue sin poder ver las solicitudes', async () => {
    const res = await como('REDES', '/api/hermanos/admin/solicitudes');
    assert.equal(res.status, 403);
  });

  test('un hermano raso sigue sin poder ver las solicitudes', async () => {
    const res = await como('USER', '/api/hermanos/admin/solicitudes');
    assert.equal(res.status, 403);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-desamparados && npx tsx --test test/permisos-hermano-mayor.test.ts`
Expected: FAIL en el primero — devuelve 403. Los otros dos ya pasan: son la red para no abrir de más.

- [ ] **Step 3: Abrirlo en el servidor**

En `src/routes/hermano.routes.ts`, las tres rutas de solicitudes pasan a una lista propia, para no mezclarlas con el resto de lo que hace secretaría:

```ts
const rolesSecretaria = [Role.ADMIN, Role.SECRETARIA];
const rolesLecturaCenso = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR];
/** Quién admite hermanos nuevos: el Hermano Mayor también. */
const rolesAltasHermanos = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR];
```

y se usa `rolesAltasHermanos` en `/admin/solicitudes`, `/admin/solicitudes/:id/aprobar` y `/admin/solicitudes/:id/rechazar`.

- [ ] **Step 4: Abrirlo en el cliente**

En `BrothersAdminPage.tsx`:

```tsx
  const canEdit = role === 'ADMIN' || role === 'SECRETARIA' || role === 'HERMANO_MAYOR'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend-desamparados && npm test`
Expected: todo en verde, incluidos los dos casos que comprueban que Redes y un hermano raso siguen fuera.

- [ ] **Step 6: Commit**

```bash
git add backend-desamparados/src/routes/hermano.routes.ts backend-desamparados/test/permisos-hermano-mayor.test.ts desamparados-web/src/features/cms/BrothersAdminPage.tsx
git commit -m "Dejar al Hermano Mayor aprobar y rechazar altas"
```

---

### Task 10: Emancipar desde secretaría, con enlace al hermano

**Files:**
- Modify: `backend-desamparados/src/services/auth.service.ts` (método nuevo), `src/services/hermano.service.ts:160-220` (repartir en dos caminos), `src/controllers/hermano.controller.ts`, `src/routes/hermano.routes.ts`, `src/schemas/hermano.schema.ts`
- Test: `backend-desamparados/test/emancipacion.test.ts`

**Interfaces:**
- Consumes: `AUDIT_ACTIONS.EMANCIPACION`, que ya existe y usa el camino del tutor.
- Produces:

```ts
// auth.service.ts
static async crearEnlaceDeContrasena(userId: number, validezHoras: number): Promise<string>

// hermano.service.ts
static async emancipateByStaff(
  hermanoId: number,
  dto: { newEmail: string; newDni?: string },
  meta?: AuditMeta,
): Promise<{ id: number; email: string; nombre: string }>
```

y la ruta `POST /api/hermanos/admin/:id/emancipar`.

- [ ] **Step 1: Write the failing test**

`test/emancipacion.test.ts`. Necesita MariaDB: se omite con motivo si no la hay, igual que `panel-servicio.test.ts`, nunca se da por pasado.

```ts
// El camino de staff de la emancipación: secretaría crea la cuenta del hermano
// y el sistema le manda un enlace para que ponga su contraseña. Secretaría no
// la elige ni la conoce.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import db from '../src/config/db.js';
import { HermanoService } from '../src/services/hermano.service.js';

let dbDisponible = false;
const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';

// Ids creados en las pruebas, para dejar la base como estaba.
const creados: { usuarios: number[]; hermanos: number[] } = { usuarios: [], hermanos: [] };

before(async () => {
  try { await db.$queryRaw`SELECT 1`; dbDisponible = true; } catch { dbDisponible = false; }
});

after(async () => {
  if (!dbDisponible) return;
  await db.hermano.deleteMany({ where: { id: { in: creados.hermanos } } });
  await db.user.deleteMany({ where: { id: { in: creados.usuarios } } });
  await db.$disconnect();
});

/** Un tutor con un menor a su cargo, listo para emanciparlo. */
async function tutorConDependiente(sufijo: string) {
  const tutor = await db.user.create({
    data: {
      email: `tutor.${sufijo}@ejemplo.invalido`, password: 'no-importa', dni: `9000000${sufijo}Z`,
      nombre: 'Tutor', apellidos: 'De Prueba', telefono: '600000001',
    },
  });
  const dependiente = await db.hermano.create({
    data: {
      userId: tutor.id, nombre: 'Menor', apellidos: 'De Prueba', dni: `9100000${sufijo}Z`,
      fechaNacimiento: new Date('2006-05-15'), activo: true, esTitular: false,
    },
  });
  creados.usuarios.push(tutor.id);
  creados.hermanos.push(dependiente.id);
  return { tutor, dependiente };
}

describe('emancipación desde secretaría', () => {
  test('la cuenta nueva nace sin contraseña con la que se pueda entrar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { dependiente } = await tutorConDependiente('1');

    const resultado = await HermanoService.emancipateByStaff(dependiente.id, { newEmail: 'emancipado.1@ejemplo.invalido' });
    creados.usuarios.push(resultado.id);

    const cuenta = await db.user.findUnique({ where: { id: resultado.id } });
    assert.ok(cuenta);
    // Nadie eligió esa contraseña, así que nadie la sabe: lo que vale es el enlace.
    assert.ok(cuenta!.resetPasswordToken, 'la cuenta debería tener un enlace pendiente');
  });

  test('el enlace vale tres días, no una hora', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { dependiente } = await tutorConDependiente('2');

    const resultado = await HermanoService.emancipateByStaff(dependiente.id, { newEmail: 'emancipado.2@ejemplo.invalido' });
    creados.usuarios.push(resultado.id);

    const cuenta = await db.user.findUnique({ where: { id: resultado.id } });
    const horas = (cuenta!.resetPasswordExpires!.getTime() - Date.now()) / 3600000;
    // Quien se emancipa no está delante de la pantalla cuando secretaría pulsa.
    assert.ok(horas > 71 && horas <= 72, `el enlace caduca en ${horas} horas`);
  });

  test('la ficha pasa a la cuenta nueva y queda como titular', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { dependiente } = await tutorConDependiente('3');

    const resultado = await HermanoService.emancipateByStaff(dependiente.id, { newEmail: 'emancipado.3@ejemplo.invalido' });
    creados.usuarios.push(resultado.id);

    const ficha = await db.hermano.findUnique({ where: { id: dependiente.id } });
    assert.equal(ficha!.userId, resultado.id);
    assert.equal(ficha!.esTitular, true);
  });

  test('un correo que ya usa otra cuenta se rechaza y no deja nada a medias', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { dependiente, tutor } = await tutorConDependiente('4');

    await assert.rejects(
      () => HermanoService.emancipateByStaff(dependiente.id, { newEmail: tutor.email }),
      /correo|email/i,
    );

    const ficha = await db.hermano.findUnique({ where: { id: dependiente.id } });
    assert.equal(ficha!.userId, tutor.id, 'la ficha no debería haberse movido');
  });

  test('al quedarse sin nadie a cargo, la cuenta del tutor se desactiva', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const { dependiente, tutor } = await tutorConDependiente('5');

    const resultado = await HermanoService.emancipateByStaff(dependiente.id, { newEmail: 'emancipado.5@ejemplo.invalido' });
    creados.usuarios.push(resultado.id);

    const cuentaTutor = await db.user.findUnique({ where: { id: tutor.id } });
    assert.equal(cuentaTutor!.active, false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-desamparados && npx tsx --test test/emancipacion.test.ts`
Expected: FAIL — `HermanoService.emancipateByStaff` no existe. Si sale «omitido», arranca MariaDB: sin base, este test no comprueba nada.

- [ ] **Step 3: Sacar el enlace de contraseña a un método propio**

En `auth.service.ts`, junto a `requestPasswordReset`, que pasa a usarlo también:

```ts
  /**
   * Emite un enlace para poner contraseña y devuelve el token en crudo.
   *
   * Lo usan dos flujos con plazos distintos: el «he olvidado mi contraseña»
   * (una hora, la persona está delante) y la emancipación desde secretaría
   * (tres días, la persona se entera cuando abra el correo).
   */
  static async crearEnlaceDeContrasena(userId: number, validezHoras: number): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await db.user.update({
      where: { id: userId },
      data: {
        resetPasswordToken: this.hashResetToken(token),
        resetPasswordExpires: new Date(Date.now() + validezHoras * 3600000),
      },
    });
    return token;
  }
```

Y `requestPasswordReset` pasa a llamarlo con `1`, en lugar de repetir la generación del token. Su comportamiento no cambia.

- [ ] **Step 4: Repartir la emancipación en dos caminos**

En `hermano.service.ts`, saca a un método privado el tronco que ya existe —comprobaciones, transacción, gestor fantasma y auditoría— y deja que cada camino aporte solo cómo nace la contraseña:

```ts
  /** El tutor emancipa a su dependiente y elige la contraseña. No cambia. */
  static async emancipateProfile(hermanoId: number, managerUserId: number, dto: EmancipateHermanoDto, meta?: AuditMeta) {
    const hermano = await this.hermanoDelTutor(hermanoId, managerUserId);
    return this.emanciparFicha(hermano, dto.newEmail, dto.newDni, await encrypt(dto.newPassword), false, meta);
  }

  /** Secretaría emancipa: la contraseña no la elige nadie, va un enlace. */
  static async emancipateByStaff(hermanoId: number, dto: { newEmail: string; newDni?: string }, meta?: AuditMeta) {
    const hermano = await db.hermano.findUnique({ where: { id: hermanoId }, include: { user: { select: { role: true } } } });
    if (!hermano) throw new NotFoundError('Hermano no encontrado.');
    // Una contraseña aleatoria que nadie conoce: la cuenta se abre con el enlace.
    const inutilizable = await encrypt(crypto.randomBytes(32).toString('hex'));
    return this.emanciparFicha(hermano, dto.newEmail, dto.newDni, inutilizable, true, meta);
  }
```

`emanciparFicha(hermano, nuevoEmail, nuevoDni, passwordHasheada, mandarEnlace, meta)` es el cuerpo actual de `emancipateProfile` desde la comprobación de `activo` hasta el `AuditService.log`, sin tocar ni una regla. Al final, si `mandarEnlace`:

```ts
      const token = await AuthService.crearEnlaceDeContrasena(newUser.id, 72);
      EmailService.enviarRecuperacionContrasena(newUser.email, newUser.nombre, token)
        .catch(err => console.error('Error enviando el enlace de emancipación:', err));
```

El envío va fuera de la transacción y con `catch`, como en `requestPasswordReset`: que falle el correo no puede deshacer una emancipación ya escrita.

- [ ] **Step 5: Endpoint y esquema**

En `hermano.schema.ts`:

```ts
// 6. Emancipación desde secretaría: sin contraseña, va un enlace al hermano
export const emancipateByStaffSchema = type({
    body: {
        newEmail: email,
        "newDni?": dni
    }
});
```

En `hermano.controller.ts`, `emancipateByStaff` con el patrón de los demás métodos (`Number(req.params.id)`, `AuditService.metaFromReq(req)`, `handleHttp` en el catch).

En `hermano.routes.ts`, junto a las otras rutas de admin:

```ts
hermanoRouter.post('/admin/:id/emancipar', checkRole(rolesSecretaria), validateId, validate(emancipateByStaffSchema), HermanoController.emancipateByStaff);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend-desamparados && npx tsx --test test/emancipacion.test.ts`
Expected: PASS los cinco casos, ninguno omitido.

- [ ] **Step 7: La suite entera, que el camino del tutor no se ha tocado**

Run: `cd backend-desamparados && npx tsc --noEmit && npm test`
Expected: todo en verde. Los tests que ya cubrían la emancipación del tutor tienen que pasar **sin haberlos modificado**: son la red de ese refactor.

- [ ] **Step 8: Commit**

```bash
git add backend-desamparados/src backend-desamparados/test/emancipacion.test.ts
git commit -m "Emancipar desde secretaria enviando un enlace al hermano"
```

---

### Task 11: El tutor y la emancipación, en la ficha

**Files:**
- Modify: `desamparados-web/src/features/cms/BrotherEditPage.tsx`, `desamparados-web/src/lib/api/brothers.ts`
- Test: `desamparados-web/src/features/cms/__tests__/BrotherEditPage.test.tsx`

**Interfaces:**
- Consumes: `POST /api/hermanos/admin/:id/emancipar` (tarea 10), `DialogoConfirmacion` (tarea 2).
- Produces: en `brothers.ts`:

```ts
export function emancipateBrother(id: number, payload: { newEmail: string; newDni?: string }) {
  return apiFetch<{ id: number; email: string; nombre: string }>(`/hermanos/admin/${id}/emancipar`, { method: 'POST', json: payload })
}
```

- [ ] **Step 1: Write the failing test**

Añade a `BrotherEditPage.test.tsx`, con una ficha que **no** es titular de su cuenta:

```tsx
const dependiente = { ...ficha, id: 43, nombre: 'Pablo', apellidos: 'Ruiz Serrano', esTitular: false, fechaNacimiento: '2006-05-15T00:00:00.000Z' }

  it('en un dependiente enseña de quién depende y ofrece emanciparlo', async () => {
    responder(dependiente)
    montar(43)
    expect(await screen.findByText(/depende de la cuenta/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /emancipar/i })).toBeInTheDocument()
  })

  it('avisa de que ya tiene edad para tener cuenta propia', async () => {
    responder(dependiente)
    montar(43)
    expect(await screen.findByText(/ya ha cumplido 18/i)).toBeInTheDocument()
  })

  it('en un titular no ofrece emancipar: ya tiene su cuenta', async () => {
    responder(ficha)
    montar(42)
    await screen.findByDisplayValue('Rocío')
    expect(screen.queryByRole('button', { name: /emancipar/i })).not.toBeInTheDocument()
  })

  it('emancipar pide el correo y confirma antes de crear la cuenta', async () => {
    responder(dependiente)
    montar(43)
    await userEvent.click(await screen.findByRole('button', { name: /emancipar/i }))
    await userEvent.type(screen.getByLabelText(/correo del hermano/i), 'pablo@ejemplo.invalido')

    const enviar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 99, email: 'pablo@ejemplo.invalido', nombre: 'Pablo' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', enviar)
    await userEvent.click(screen.getByRole('button', { name: 'Emancipar hermano' }))

    const [url, opciones] = enviar.mock.calls[0]
    expect(url).toContain('/hermanos/admin/43/emancipar')
    expect(JSON.parse(opciones.body as string)).toEqual({ newEmail: 'pablo@ejemplo.invalido' })
    // Nadie ha escrito una contraseña en ningún sitio: eso es lo que se buscaba.
    expect(opciones.body as string).not.toMatch(/password/i)
  })
```

`montar(id)` es el ayudante de la tarea 5, con el id como parámetro.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desamparados-web && npx vitest run src/features/cms/__tests__/BrotherEditPage.test.tsx`
Expected: FAIL — no hay ningún texto de dependencia ni botón de emancipar.

- [ ] **Step 3: Write minimal implementation**

En `BrotherEditPage.tsx`, un bloque más dentro de `PantallaEdicion`, solo cuando `!ficha.esTitular`:

```tsx
const anios = (nacimiento: string) => Math.floor((Date.now() - new Date(nacimiento).getTime()) / 31557600000)
```

```tsx
          {!ficha.esTitular && (
            <>
              <Divider />
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>Cuenta y tutor</Typography>
                <Typography variant="body2" color="text.secondary">
                  Depende de la cuenta de {ficha.user?.email ?? 'otro hermano'}.
                </Typography>
                {anios(ficha.fechaNacimiento) >= 18 && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Ya ha cumplido 18 años: puede tener cuenta propia.
                  </Alert>
                )}
                <Button sx={{ mt: 2 }} onClick={() => setEmancipando(true)}>Emancipar</Button>
              </Box>
            </>
          )}
```

Y el formulario de emancipación, en un diálogo: un campo de correo («Correo del hermano»), otro de DNI **solo si la ficha no lo tiene**, y el botón «Emancipar hermano», que llama a `emancipateBrother` y, al volver, avisa de que se le ha enviado el enlace.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desamparados-web && npx vitest run`
Expected: todo en verde.

- [ ] **Step 5: Comprobarlo contra el servidor**

Con los servidores levantados y el censo sembrado, entrar en una ficha de dependiente y emanciparla. Comprobar en la base:

```bash
cd backend-desamparados && npx prisma studio
```

Expected: la ficha cuelga de la cuenta nueva, la cuenta nueva tiene `resetPasswordToken` y una caducidad a tres días, y el tutor sigue activo si le quedan otros hermanos a cargo.

- [ ] **Step 6: Commit**

```bash
git add desamparados-web/src
git commit -m "Enseñar el tutor en la ficha y emancipar desde el CMS"
```

---

### Task 12: Solicitudes de alta en el censo de demostración

**Files:**
- Modify: `backend-desamparados/prisma/demo/generar.ts`, `backend-desamparados/prisma/seed-demo.ts`
- Test: `backend-desamparados/test/seed-demo.test.ts`

**Interfaces:**
- Consumes: `generarHermanos` y el resto de `demo/generar.ts`.
- Produces:

```ts
export interface SolicitudDemo {
  email: string
  dni: string
  nombre: string
  apellidos: string
  telefono: string
  /** Las fichas que entran con la solicitud: la del titular y, a veces, un menor. */
  fichas: { nombre: string; apellidos: string; dni: string | null; fechaNacimiento: Date; esTitular: boolean }[]
}

export function generarSolicitudes(anio: number, momento?: Date): SolicitudDemo[]
```

- [ ] **Step 1: Write the failing test**

En `test/seed-demo.test.ts`:

```ts
describe('solicitudes de alta de demostración', () => {
  const solicitudes = generarSolicitudes(ANIO);

  test('hay unas cuantas esperando', () => {
    assert.ok(solicitudes.length >= 4 && solicitudes.length <= 6, `son ${solicitudes.length}`);
  });

  test('es determinista', () => {
    assert.deepEqual(generarSolicitudes(ANIO), generarSolicitudes(ANIO));
  });

  test('alguna trae un menor a cargo, que es el caso que interesa probar', () => {
    // Es el caso que luego se emancipa desde el CMS.
    const conMenor = solicitudes.filter((s) => s.fichas.length > 1);
    assert.ok(conMenor.length > 0);
    for (const solicitud of conMenor) {
      const menores = solicitud.fichas.filter((f) => !f.esTitular);
      assert.ok(menores.length > 0);
      for (const menor of menores) {
        assert.ok(ANIO - menor.fechaNacimiento.getUTCFullYear() < 18, 'el dependiente debería ser menor');
      }
    }
  });

  test('cada solicitud tiene exactamente un titular', () => {
    for (const solicitud of solicitudes) {
      assert.equal(solicitud.fichas.filter((f) => f.esTitular).length, 1);
    }
  });

  test('no chocan con los DNI ni los correos del censo', () => {
    // Los dos campos son únicos en el esquema: un choque aborta la siembra.
    const censo = generarHermanos(300, ANIO);
    const dnis = new Set(censo.map((h) => h.dni));
    const correos = new Set(censo.map((h) => h.email));
    for (const solicitud of solicitudes) {
      assert.ok(!dnis.has(solicitud.dni), `${solicitud.dni} ya está en el censo`);
      assert.ok(!correos.has(solicitud.email), `${solicitud.email} ya está en el censo`);
      for (const ficha of solicitud.fichas) {
        if (ficha.dni) assert.ok(!dnis.has(ficha.dni));
      }
    }
  });
});
```

Añade `generarSolicitudes` al import del principio del fichero.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-desamparados && npx tsx --test test/seed-demo.test.ts`
Expected: FAIL — `generar.js` no exporta `generarSolicitudes`.

- [ ] **Step 3: Write minimal implementation**

En `prisma/demo/generar.ts`, con el mismo generador con semilla del resto del fichero y numeración de DNI a partir de 20000900, fuera del rango del censo (que llega a 20000299):

```ts
/**
 * Altas esperando aprobación. Son usuarios con la ficha inactiva y sin fecha de
 * baja, que es exactamente lo que crea el alta pública de la web y lo que
 * cuenta como solicitud pendiente. No son hermanos activos, así que no mueven
 * ninguna cifra del panel.
 */
export function generarSolicitudes(anio: number, momento: Date = new Date()): SolicitudDemo[] {
  const azar = generadorAleatorio(SEMILLAS.hermanos + 7);
  const solicitudes: SolicitudDemo[] = [];

  for (let i = 0; i < 5; i++) {
    const numero = 20000900 + i;
    const nombre = NOMBRES_HOMBRE[entero(azar(), 0, NOMBRES_HOMBRE.length - 1)];
    const apellidos = `${APELLIDOS[entero(azar(), 0, APELLIDOS.length - 1)]} ${APELLIDOS[entero(azar(), 0, APELLIDOS.length - 1)]}`;
    // Las dos últimas vienen con un menor a cargo: es el caso del tutor.
    const conMenor = i >= 3;

    const fichas = [{
      nombre, apellidos, dni: `${numero}${letraDni(numero)}`,
      fechaNacimiento: new Date(Date.UTC(anio - entero(azar(), 28, 55), entero(azar(), 0, 11), entero(azar(), 1, 28))),
      esTitular: true,
    }];

    if (conMenor) {
      fichas.push({
        nombre: NOMBRES_MUJER[entero(azar(), 0, NOMBRES_MUJER.length - 1)],
        apellidos,
        dni: null,
        fechaNacimiento: new Date(Date.UTC(anio - entero(azar(), 6, 15), entero(azar(), 0, 11), entero(azar(), 1, 28))),
        esTitular: false,
      });
    }

    solicitudes.push({
      email: `solicitud.${i + 1}@ejemplo.invalido`,
      dni: `${numero}${letraDni(numero)}`,
      nombre, apellidos,
      telefono: `6${String(20000000 + entero(azar(), 0, 9999999)).slice(0, 8)}`,
      fichas,
    });
  }

  return solicitudes;
}
```

`momento` no se usa aquí, así que quítalo de la firma si el lint se queja: las solicitudes no dependen de la fecha de hoy.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-desamparados && npx tsx --test test/seed-demo.test.ts`
Expected: PASS, todo el fichero.

- [ ] **Step 5: Sembrarlas**

En `prisma/seed-demo.ts`, al final de `sembrarDemostracion()`:

```ts
  // --- SOLICITUDES DE ALTA ---
  const solicitudes = generarSolicitudes(anio);
  for (const solicitud of solicitudes) {
    await db.user.create({
      data: {
        email: solicitud.email,
        password,
        dni: solicitud.dni,
        nombre: solicitud.nombre,
        apellidos: solicitud.apellidos,
        telefono: solicitud.telefono,
        role: Role.USER,
        // La cuenta también nace inactiva, como en el alta pública.
        active: false,
        hermanos: {
          create: solicitud.fichas.map((f) => ({
            nombre: f.nombre, apellidos: f.apellidos, dni: f.dni,
            fechaNacimiento: f.fechaNacimiento, esTitular: f.esTitular,
            activo: false, fechaBaja: null,
          })),
        },
      },
    });
  }
  console.log(`   ${solicitudes.length} solicitudes de alta esperando aprobación`);
```

Comprueba antes en `auth.service.ts` si el alta pública deja la **cuenta** activa o inactiva, y haz lo mismo aquí: la siembra tiene que producir exactamente lo que produce la web.

- [ ] **Step 6: Sembrar de verdad y comprobarlo**

```bash
cd backend-desamparados && npm run seed
```

Si el censo ya estaba sembrado, la siembra se salta entera: para probar esto hace falta una base limpia (`npx prisma migrate reset` en local) o borrar a mano los usuarios `solicitud.*@ejemplo.invalido`.

Luego, con sesión de admin:

```bash
curl -s -b cookies.txt http://localhost:3001/api/hermanos/admin/solicitudes
```

Expected: cinco solicitudes, dos de ellas con dos fichas.

- [ ] **Step 7: La suite entera**

Run: `cd backend-desamparados && npx tsc --noEmit && npm test`
Expected: todo en verde, ninguno omitido. **Comprueba las cifras del panel**: los activos no deberían haber cambiado, porque estas fichas están inactivas.

- [ ] **Step 8: Commit**

```bash
git add backend-desamparados/prisma backend-desamparados/test/seed-demo.test.ts
git commit -m "Sembrar solicitudes de alta pendientes en el censo de demostracion"
```

---

## Notas para quien ejecute

- **El orden importa poco salvo en dos sitios:** las tareas 2 y 3 son la base de las 5, 6, 7 y 11; y la 10 (servidor) va antes que la 11 (cliente). Lo demás se puede repartir.
- **No añadas dependencias.** Diálogos, pestañas y campos de fecha salen de MUI.
- **`useBlocker` solo funciona con un data router.** Si un test de edición no bloquea, mira primero si has montado `BrowserRouter` en vez de `createMemoryRouter`.
- **El camino del tutor de la emancipación no se toca.** Sus tests actuales son la red del refactor de la tarea 10: si hay que modificarlos para que pasen, algo se ha roto.
- **Los tests con MariaDB se omiten con motivo, nunca se dan por pasados.** Si ves «omitido» en las tareas 10 o 12, arranca la base y vuelve a ejecutarlos.
- **Textos visibles:** «Grupo Parroquial», nunca «Hermandad».
- **Al terminar**, comprueba el CMS entero en el navegador con el censo sembrado: editar una ficha, salir sin guardar, borrar algo, la pestaña de solicitudes y una emancipación.
