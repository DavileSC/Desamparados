# Plan de implementación — paginación completa

> **Para quien lo ejecute con agentes:** SUB-SKILL OBLIGATORIA: usa
> `superpowers:subagent-driven-development` (recomendada) o
> `superpowers:executing-plans` para implementar tarea a tarea. Los pasos usan
> casillas (`- [ ]`) para ir marcando.

**Objetivo:** que los dieciocho listados de la aplicación se puedan paginar, con
tamaño a elegir, y que ninguno vuelva a ocultar datos sin avisar.

**Enfoque:** un módulo de dominio en el servidor decide qué página se sirve y una
sola forma de respuesta (`{ data, meta }`) la viaja; en el cliente, un hook y un
componente compartidos gobiernan las dieciocho pantallas. Las tareas van por
vertical —extremo, capa de API y pantalla juntos—, de manera que **la aplicación
funciona después de cada tarea**: ningún extremo cambia de forma sin que sus
consumidores cambien en el mismo commit.

**Tecnologías:** Express 5, Prisma, arktype y `node:test` en el servidor; React,
MUI, React Router, Vitest y Testing Library en el cliente.

**Diseño:** `docs/superpowers/specs/2026-08-30-paginacion-completa-design.md`

## Estado al 1 de septiembre de 2026

**Las quince tareas están hechas** (casillas marcadas), cada una con su revisión y,
donde hizo falta, su ronda de arreglos. Después vino la revisión de toda la rama,
que encontró un fallo que ninguna revisión de tarea podía ver —ocho listados
paginaban sobre un orden que MariaDB no garantiza, entre ellos los tres más
grandes— y una ola de arreglos que lo cerró junto con otros seis puntos.

**208 tests de backend con cero omitidos y 171 de frontend**, todos en verde,
`tsc` limpio en los dos proyectos y sin avisos de lint nuevos. Se partía de 191 y
135.

Queda por hacer, y es de una persona, la **comprobación final en el navegador**
que describe el último apartado de este documento. Los seis puntos que enumera
están cubiertos por tests salvo el aspecto visual.

El detalle de lo decidido por el camino está en
[`docs/traspaso-2026-08-30.md`](../../traspaso-2026-08-30.md).

## Restricciones globales

- **Tamaños de página: 10, 20, 30, 40 y 50.** Por defecto **20**.
- **Tope duro del servidor: 100.** Protege de un `?limit=999999` a mano; el
  selector solo ofrece hasta 50.
- **`meta` siempre trae las cuatro claves:** `total`, `page`, `limit`,
  `totalPages`. Sin resultados, `totalPages` es 0.
- **Nunca «Hermandad» ni «Cofradía»** en texto visible: es **Grupo Parroquial**.
  Los miembros sí son «hermanos».
- **No se añaden dependencias** salvo la que aprueba la tarea 1
  (`@testing-library/user-event`, solo de desarrollo).
- Mensajes de commit **en español, en infinitivo, sin prefijos** tipo `feat:`,
  siguiendo el historial del repositorio.
- `npx prisma generate` en el backend después de cada `git pull`.
- Los tests que necesitan MariaDB **se omiten con motivo** con `t.skip(SIN_DB)`
  si no está levantada. Omitido no es pasado.

---

## Estructura de ficheros

**Se crean:**

| Fichero | Responsabilidad |
|---|---|
| `backend-desamparados/src/domain/paginacion.ts` | Sanear `page`/`limit` y construir `{ data, meta }`. Funciones puras, sin base de datos. |
| `backend-desamparados/test/paginacion.test.ts` | Pruebas del módulo anterior. |
| `desamparados-web/src/lib/api/tipos.ts` | `RespuestaPaginada<T>`, `MetaPaginacion` y el constructor de parámetros. |
| `desamparados-web/src/hooks/usePaginacion.ts` | Página y tamaño en la URL, memoria de sesión, reinicio al filtrar. |
| `desamparados-web/src/components/Paginador.tsx` | Recuento, selector de tamaño y números de página. |
| `desamparados-web/src/hooks/__tests__/usePaginacion.test.tsx` | Pruebas del hook. |
| `desamparados-web/src/components/__tests__/Paginador.test.tsx` | Pruebas del componente. |

**Se modifican:** los servicios, controladores, rutas y esquemas de los diez
extremos del CMS, los cinco públicos y los tres del área del hermano; la capa
`src/lib/api/` completa; y las dieciséis pantallas que los pintan.

---

## Tarea 1: user-event instalado y los cinco ficheros migrados

Va primero para que todos los tests que escriban las tareas siguientes nazcan ya
con la herramienta buena. El diseño lo listaba al final; hacerlo antes ahorra
reescribir después lo que se escriba en medio.

**Ficheros:**
- Modificar: `desamparados-web/package.json`
- Modificar: `desamparados-web/src/components/__tests__/DialogoConfirmacion.test.tsx`
- Modificar: `desamparados-web/src/features/cms/__tests__/PantallaEdicion.test.tsx`
- Modificar: `desamparados-web/src/features/cms/__tests__/BrotherEditPage.test.tsx`
- Modificar: `desamparados-web/src/features/cms/__tests__/BrothersAdminPage.test.tsx`
- Modificar: `desamparados-web/src/features/cms/__tests__/NewsAdminPage.test.tsx`

**Interfaces:**
- Produce: el patrón `const user = userEvent.setup()` que usan todas las tareas
  siguientes.

- [x] **Paso 1: Instalar la dependencia**

```bash
cd desamparados-web
npm install --save-dev @testing-library/user-event
```

- [x] **Paso 2: Comprobar que los tests siguen pasando antes de tocarlos**

Ejecuta: `npx vitest run`
Esperado: 114 tests en verde. Si alguno falla ya, párate: el fallo no es tuyo.

- [x] **Paso 3: Migrar los cinco ficheros**

En cada uno, sustituye el import y las llamadas. El patrón es siempre el mismo:

```tsx
// antes
import { fireEvent, screen, waitFor } from '@testing-library/react'
fireEvent.click(await screen.findByRole('button', { name: /eliminar/i }))
fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Nuevo' } })

// después
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()
await user.click(await screen.findByRole('button', { name: /eliminar/i }))
await user.clear(screen.getByLabelText(/título/i))
await user.type(screen.getByLabelText(/título/i), 'Nuevo')
```

Tres cosas que cambian de verdad y no son mecánicas:

1. **`user.type` escribe carácter a carácter y no borra lo que hay.** Donde el
   campo ya tenía valor, primero `user.clear`.
2. **Todas las llamadas se esperan con `await`.** Un `user.click` sin `await`
   deja el test en verde por casualidad.
3. `userEvent.setup()` se llama **dentro de cada `it`**, no en el cuerpo del
   `describe`: compartirlo entre tests arrastra estado.

- [x] **Paso 4: Ejecutar y comprobar que siguen pasando**

Ejecuta: `npx vitest run`
Esperado: los mismos 114 tests en verde. Si alguno falla ahora, **léelo antes de
tocarlo**: `user-event` rechaza lo que una persona no podría hacer, así que un
fallo nuevo puede ser un fallo real de la interfaz, no del test.

- [x] **Paso 5: Commit**

```bash
git add desamparados-web/package.json desamparados-web/package-lock.json desamparados-web/src
git commit -m "Probar la interfaz como lo haria una persona"
```

---

## Tarea 2: el módulo de dominio de la paginación

**Ficheros:**
- Crear: `backend-desamparados/src/domain/paginacion.ts`
- Crear: `backend-desamparados/test/paginacion.test.ts`

**Interfaces:**
- Produce: `sanearPaginacion(query)`, `respuestaPaginada(data, total, paginacion)`,
  `LIMITE_POR_DEFECTO = 20`, `LIMITE_MAXIMO = 100`, y los tipos `Paginacion`,
  `MetaPaginacion` y `RespuestaPaginada<T>`. **Todas las tareas del servidor
  consumen esto.**

- [x] **Paso 1: Escribir el test que falla**

Crea `backend-desamparados/test/paginacion.test.ts`:

```ts
// Todo lo que decide qué página se sirve vive aquí, suelto y sin base de datos:
// antes estaba repetido en cuatro servicios con tres topes distintos.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sanearPaginacion, respuestaPaginada, LIMITE_POR_DEFECTO, LIMITE_MAXIMO } from '../src/domain/paginacion.js';

describe('sanear la paginación que llega por la consulta', () => {
  test('sin parámetros, primera página y el tamaño por defecto', () => {
    assert.deepEqual(sanearPaginacion({}), { page: 1, limit: 20, skip: 0, take: 20 });
    assert.equal(LIMITE_POR_DEFECTO, 20);
  });

  test('los parámetros llegan como texto, que es como los manda el navegador', () => {
    assert.deepEqual(sanearPaginacion({ page: '3', limit: '50' }), { page: 3, limit: 50, skip: 100, take: 50 });
  });

  test('una página que no es un número cae en la primera', () => {
    for (const page of ['0', '-4', 'dos', '', null, undefined, {}]) {
      assert.equal(sanearPaginacion({ page }).page, 1, `falla con ${JSON.stringify(page)}`);
    }
  });

  test('un tamaño por encima del tope se recorta al tope', () => {
    assert.equal(sanearPaginacion({ limit: '999999' }).limit, LIMITE_MAXIMO);
    assert.equal(LIMITE_MAXIMO, 100);
  });

  test('un tamaño por debajo de uno sube a uno', () => {
    assert.equal(sanearPaginacion({ limit: '0' }).limit, 1);
    assert.equal(sanearPaginacion({ limit: '-7' }).limit, 1);
  });

  test('un tamaño que no es número cae en el de por defecto', () => {
    assert.equal(sanearPaginacion({ limit: 'todos' }).limit, LIMITE_POR_DEFECTO);
  });
});

describe('construir la respuesta paginada', () => {
  test('meta trae siempre las cuatro claves', () => {
    const respuesta = respuestaPaginada(['a', 'b'], 308, { page: 2, limit: 20, skip: 20, take: 20 });
    assert.deepEqual(respuesta.meta, { total: 308, page: 2, limit: 20, totalPages: 16 });
    assert.deepEqual(respuesta.data, ['a', 'b']);
  });

  test('sin resultados, cero páginas y no una', () => {
    // Una lista vacía con totalPages: 1 haría que la interfaz pintara un
    // paginador de una página para nada.
    assert.equal(respuestaPaginada([], 0, { page: 1, limit: 20, skip: 0, take: 20 }).meta.totalPages, 0);
  });

  test('el último resto cuenta como página entera', () => {
    assert.equal(respuestaPaginada([], 41, { page: 1, limit: 20, skip: 0, take: 20 }).meta.totalPages, 3);
  });
});
```

- [x] **Paso 2: Ejecutar para verlo fallar**

Ejecuta: `cd backend-desamparados && npx tsx --test test/paginacion.test.ts`
Esperado: FALLA porque `src/domain/paginacion.ts` no existe.

- [x] **Paso 3: Escribir la implementación mínima**

Crea `backend-desamparados/src/domain/paginacion.ts`:

```ts
/**
 * Qué página se sirve y cuántos elementos caben. Vive suelto, sin base de
 * datos, porque antes estaba repetido en cuatro servicios con tres topes
 * distintos (50, 200 y 500) y nadie podía decir cuál regía dónde.
 */

export interface Paginacion {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface MetaPaginacion {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RespuestaPaginada<T> {
  data: T[];
  meta: MetaPaginacion;
}

export const LIMITE_POR_DEFECTO = 20;

/**
 * Tope duro. El selector de la interfaz solo ofrece hasta 50; esto está para
 * que un `?limit=999999` escrito a mano no se lleve la tabla entera por
 * delante.
 */
export const LIMITE_MAXIMO = 100;

function aEntero(valor: unknown): number | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.floor(numero) : null;
}

export function sanearPaginacion(query: { page?: unknown; limit?: unknown }): Paginacion {
  const pagePedida = aEntero(query.page);
  const page = pagePedida !== null && pagePedida >= 1 ? pagePedida : 1;

  const limitPedido = aEntero(query.limit);
  const limit = limitPedido === null
    ? LIMITE_POR_DEFECTO
    : Math.min(Math.max(limitPedido, 1), LIMITE_MAXIMO);

  const skip = (page - 1) * limit;
  return { page, limit, skip, take: limit };
}

export function respuestaPaginada<T>(data: T[], total: number, { page, limit }: Paginacion): RespuestaPaginada<T> {
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}
```

- [x] **Paso 4: Ejecutar para verlo pasar**

Ejecuta: `npx tsx --test test/paginacion.test.ts`
Esperado: los 9 tests en verde.

- [x] **Paso 5: Commit**

```bash
git add backend-desamparados/src/domain/paginacion.ts backend-desamparados/test/paginacion.test.ts
git commit -m "Decidir en un solo sitio que pagina se sirve"
```

---

## Tarea 3: que los parámetros de página lleguen a los controladores

`validate` aplica `onDeepUndeclaredKey('delete')`: **cualquier clave que no esté
declarada en el esquema se borra en silencio**. Sin esta tarea, `?page=2` no da
error en los extremos validados; simplemente se ignora y siempre se sirve la
primera página. Es un fallo mudo, así que lleva su propio test de regresión.

**Ficheros:**
- Modificar: `backend-desamparados/src/config/common.ts`
- Crear: `backend-desamparados/test/paginacion-query.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: `paginacionQuery`, un objeto para esparcir dentro del `query` de
  cualquier esquema de arktype. Lo usan las tareas 12, 13 y 14.

- [x] **Paso 1: Escribir el test que falla**

Crea `backend-desamparados/test/paginacion-query.test.ts`:

```ts
// Regresión: arktype borra las claves no declaradas. Un esquema de consulta sin
// `page` no rechaza `?page=2`, se lo come, y el extremo sirve siempre la
// primera página sin que nadie vea un error.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { type } from 'arktype';
import { paginacionQuery } from '../src/config/common.js';

const esquema = type({ query: { ...paginacionQuery, 'search?': 'string' } }).onDeepUndeclaredKey('delete');

describe('parámetros de paginación en los esquemas de consulta', () => {
  test('page y limit sobreviven a la validación', () => {
    const resultado = esquema({ query: { page: '2', limit: '50' } }) as { query: Record<string, string> };
    assert.equal(resultado.query.page, '2');
    assert.equal(resultado.query.limit, '50');
  });

  test('sin ellos, la consulta sigue siendo válida', () => {
    const resultado = esquema({ query: { search: 'rocío' } }) as { query: Record<string, string> };
    assert.equal(resultado.query.search, 'rocío');
  });

  test('un esquema que no los declara los pierde: por eso hace falta esto', () => {
    const sinPaginacion = type({ query: { 'search?': 'string' } }).onDeepUndeclaredKey('delete');
    const resultado = sinPaginacion({ query: { search: 'x', page: '2' } }) as { query: Record<string, string> };
    assert.equal(resultado.query.page, undefined);
  });
});
```

- [x] **Paso 2: Ejecutar para verlo fallar**

Ejecuta: `npx tsx --test test/paginacion-query.test.ts`
Esperado: FALLA, `paginacionQuery` no está exportado.

- [x] **Paso 3: Añadir el fragmento a `common.ts`**

Al final de `backend-desamparados/src/config/common.ts`:

```ts
/**
 * Para esparcir dentro del `query` de cualquier esquema de listado:
 *
 *   type({ query: { ...paginacionQuery, "tipo?": tipoEventoSchema } })
 *
 * Sin declararlos, `validate` los borra en silencio y el extremo sirve siempre
 * la primera página.
 */
export const paginacionQuery = {
    "page?": type("string").matching(/^\d+$/).describe("un número de página"),
    "limit?": type("string").matching(/^\d+$/).describe("un tamaño de página"),
};
```

- [x] **Paso 4: Ejecutar para verlo pasar**

Ejecuta: `npx tsx --test test/paginacion-query.test.ts`
Esperado: los 3 tests en verde.

- [x] **Paso 5: Commit**

```bash
git add backend-desamparados/src/config/common.ts backend-desamparados/test/paginacion-query.test.ts
git commit -m "Dejar pasar los parametros de pagina por la validacion"
```

---

## Tarea 4: las piezas compartidas del cliente

**Ficheros:**
- Crear: `desamparados-web/src/lib/api/tipos.ts`
- Crear: `desamparados-web/src/hooks/usePaginacion.ts`
- Crear: `desamparados-web/src/components/Paginador.tsx`
- Crear: `desamparados-web/src/hooks/__tests__/usePaginacion.test.tsx`
- Crear: `desamparados-web/src/components/__tests__/Paginador.test.tsx`
- Modificar: `desamparados-web/src/test/AllTheProviders.tsx`
- Modificar: `desamparados-web/src/test/test-utils.tsx`

**Interfaces:**
- Consume: nada del servidor todavía.
- Produce, y lo usan **todas** las tareas de pantalla:
  - `RespuestaPaginada<T>` con `{ data: T[]; meta: MetaPaginacion }`.
  - `MetaPaginacion` con `{ total, page, limit, totalPages }`.
  - `paramsPagina({ pagina, porPagina }, extra?)` → `string` de consulta.
  - `usePaginacion(prefijo?)` → `{ pagina, porPagina, irAPagina, cambiarTamano, reiniciar }`.
  - `<Paginador meta={...} onPagina={...} onTamano={...} etiqueta="censo de hermanos" />`.
  - `TAMANOS = [10, 20, 30, 40, 50]`, `TAMANO_POR_DEFECTO = 20`.
  - `renderWithProviders(ui, { ruta })`, que **hoy no existe** y necesitan casi
    todas las tareas siguientes.

- [x] **Paso 0: Poder fijar la URL en los tests**

Sin esto no se puede escribir ni uno de los tests que comprueban que la página
sale de la URL: `AllTheProviders` monta un `BrowserRouter`, que siempre arranca
en `/`.

En `desamparados-web/src/test/AllTheProviders.tsx`, cambia `BrowserRouter` por
`MemoryRouter` con la ruta que le pasen:

```tsx
import { MemoryRouter } from 'react-router-dom'

export default function AllTheProviders({ children, ruta = '/' }: { children: React.ReactNode; ruta?: string }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  return (
    <MemoryRouter initialEntries={[ruta]}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}
```

Y en `test-utils.tsx`:

```tsx
export function renderWithProviders(
  ui: ReactElement,
  { ruta = '/', ...options }: Omit<RenderOptions, 'wrapper'> & { ruta?: string } = {},
) {
  return render(ui, {
    wrapper: ({ children }) => <AllTheProviders ruta={ruta}>{children}</AllTheProviders>,
    ...options,
  })
}
```

Ejecuta después `npx vitest run`: los 114 tests existentes deben seguir en verde.
`MemoryRouter` no toca `window.history`, así que es equivalente para ellos, pero
**si alguno falla, míralo antes de seguir**: significa que dependía del historial
real del navegador.

- [x] **Paso 1: Escribir los tests que fallan**

Crea `desamparados-web/src/hooks/__tests__/usePaginacion.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/test-utils'
import { usePaginacion, TAMANO_POR_DEFECTO } from '../usePaginacion'

function Sonda({ prefijo }: { prefijo?: string }) {
  const { pagina, porPagina, irAPagina, cambiarTamano, reiniciar } = usePaginacion(prefijo)
  return <>
    <span data-testid="estado">{pagina}/{porPagina}</span>
    <button onClick={() => irAPagina(3)}>ir a la tres</button>
    <button onClick={() => cambiarTamano(50)}>cincuenta</button>
    <button onClick={() => reiniciar()}>reiniciar</button>
  </>
}

function montar(ruta = '/', prefijo?: string) {
  return renderWithProviders(<Sonda prefijo={prefijo} />, { ruta })
}

// El tamaño se recuerda en sessionStorage: sin limpiarlo, un test arrastra
// al siguiente el 50 que eligió.
beforeEach(() => { window.sessionStorage.clear() })

describe('usePaginacion', () => {
  it('sin nada en la URL arranca en la primera página con el tamaño por defecto', () => {
    montar()
    expect(screen.getByTestId('estado')).toHaveTextContent(`1/${TAMANO_POR_DEFECTO}`)
  })

  it('lee la página y el tamaño de la URL', () => {
    montar('/?pagina=4&porPagina=30')
    expect(screen.getByTestId('estado')).toHaveTextContent('4/30')
  })

  it('un tamaño que no está entre los cinco admitidos se descarta', () => {
    montar('/?porPagina=7')
    expect(screen.getByTestId('estado')).toHaveTextContent(`1/${TAMANO_POR_DEFECTO}`)
  })

  it('cambiar de tamaño vuelve a la primera página', async () => {
    const user = userEvent.setup()
    montar('/?pagina=4')
    await user.click(screen.getByRole('button', { name: /cincuenta/i }))
    expect(screen.getByTestId('estado')).toHaveTextContent('1/50')
  })

  it('reiniciar vuelve a la primera página y conserva el tamaño', async () => {
    const user = userEvent.setup()
    montar('/?pagina=4&porPagina=30')
    await user.click(screen.getByRole('button', { name: /reiniciar/i }))
    expect(screen.getByTestId('estado')).toHaveTextContent('1/30')
  })

  it('con prefijo usa parámetros propios, para dos listados en una pantalla', () => {
    montar('/?paginaEnseres=2&pagina=9', 'Enseres')
    expect(screen.getByTestId('estado')).toHaveTextContent('2/')
  })
})
```

Crea `desamparados-web/src/components/__tests__/Paginador.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Paginador from '../Paginador'

const meta = { total: 308, page: 2, limit: 20, totalPages: 16 }

describe('Paginador', () => {
  it('dice qué tramo se está viendo y cuántos hay', () => {
    render(<Paginador meta={meta} onPagina={vi.fn()} onTamano={vi.fn()} etiqueta="censo" />)
    expect(screen.getByText(/mostrando 21-40 de 308/i)).toBeInTheDocument()
  })

  it('con una sola página esconde los números pero deja el selector', () => {
    // Es la única forma de cambiar el tamaño: si se esconde, no hay vuelta atrás.
    render(<Paginador meta={{ total: 8, page: 1, limit: 20, totalPages: 1 }} onPagina={vi.fn()} onTamano={vi.fn()} etiqueta="noticias" />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/resultados por página/i)).toBeInTheDocument()
    expect(screen.getByText(/8 resultados/i)).toBeInTheDocument()
  })

  it('sin resultados no se pinta nada', () => {
    const { container } = render(<Paginador meta={{ total: 0, page: 1, limit: 20, totalPages: 0 }} onPagina={vi.fn()} onTamano={vi.fn()} etiqueta="censo" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('avisa al pulsar otra página', async () => {
    const user = userEvent.setup()
    const onPagina = vi.fn()
    render(<Paginador meta={meta} onPagina={onPagina} onTamano={vi.fn()} etiqueta="censo" />)
    await user.click(screen.getByRole('button', { name: /ir a la página 3/i }))
    expect(onPagina).toHaveBeenCalledWith(3)
  })

  it('si la página pedida ya no existe, lleva a la última', () => {
    // Un enlace viejo con ?pagina=99 no debe dejar al usuario mirando un vacío.
    const onPagina = vi.fn()
    render(<Paginador meta={{ total: 40, page: 99, limit: 20, totalPages: 2 }} onPagina={onPagina} onTamano={vi.fn()} etiqueta="censo" />)
    expect(onPagina).toHaveBeenCalledWith(2)
  })
})
```

- [x] **Paso 2: Ejecutar para verlos fallar**

Ejecuta: `cd desamparados-web && npx vitest run src/hooks src/components/__tests__/Paginador.test.tsx`
Esperado: FALLAN, los tres módulos no existen.

- [x] **Paso 3: Escribir las tres piezas**

Crea `desamparados-web/src/lib/api/tipos.ts`:

```ts
export interface MetaPaginacion {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface RespuestaPaginada<T> {
  data: T[]
  meta: MetaPaginacion
}

/** Construye la cadena de consulta de un listado: `page=2&limit=20&year=2026`. */
export function paramsPagina(
  { pagina, porPagina }: { pagina: number; porPagina: number },
  extra: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams({ page: String(pagina), limit: String(porPagina) })
  for (const [clave, valor] of Object.entries(extra)) {
    if (valor) params.set(clave, valor)
  }
  return params.toString()
}
```

Crea `desamparados-web/src/hooks/usePaginacion.ts`:

```ts
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export const TAMANOS = [10, 20, 30, 40, 50] as const
export const TAMANO_POR_DEFECTO = 20

const CLAVE_MEMORIA = 'desamparados:porPagina'

function tamanoGuardado(): number {
  try {
    const guardado = Number(window.sessionStorage.getItem(CLAVE_MEMORIA))
    return TAMANOS.includes(guardado as (typeof TAMANOS)[number]) ? guardado : TAMANO_POR_DEFECTO
  } catch {
    // sessionStorage puede estar bloqueado; no es motivo para romper la página.
    return TAMANO_POR_DEFECTO
  }
}

/**
 * Página y tamaño en la URL, como ya hace `?vista=` en la pantalla de hermanos:
 * así se vuelve del formulario de edición al mismo sitio, y un enlace lleva a
 * donde dice.
 *
 * El prefijo sirve para las pantallas con dos listados (inventario, hermanos):
 * `usePaginacion('Enseres')` usa `?paginaEnseres=`, que no pisa al otro.
 */
export function usePaginacion(prefijo = '') {
  const [params, setParams] = useSearchParams()
  const clavePagina = `pagina${prefijo}`
  const claveTamano = `porPagina${prefijo}`

  const pedida = Number(params.get(clavePagina))
  const pagina = Number.isInteger(pedida) && pedida >= 1 ? pedida : 1

  const tamanoUrl = Number(params.get(claveTamano))
  const porPagina = TAMANOS.includes(tamanoUrl as (typeof TAMANOS)[number]) ? tamanoUrl : tamanoGuardado()

  const escribir = useCallback((cambios: Record<string, string | null>) => {
    setParams((anteriores) => {
      const siguientes = new URLSearchParams(anteriores)
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null) siguientes.delete(clave)
        else siguientes.set(clave, valor)
      }
      return siguientes
    }, { replace: true })
  }, [setParams])

  const irAPagina = useCallback((numero: number) => {
    escribir({ [clavePagina]: numero <= 1 ? null : String(numero) })
  }, [escribir, clavePagina])

  const cambiarTamano = useCallback((numero: number) => {
    try { window.sessionStorage.setItem(CLAVE_MEMORIA, String(numero)) } catch { /* bloqueado: se queda solo en la URL */ }
    escribir({ [claveTamano]: String(numero), [clavePagina]: null })
  }, [escribir, claveTamano, clavePagina])

  /** Al buscar o filtrar: quedarse en la página 7 de otra consulta no tiene sentido. */
  const reiniciar = useCallback(() => { escribir({ [clavePagina]: null }) }, [escribir, clavePagina])

  return { pagina, porPagina, irAPagina, cambiarTamano, reiniciar }
}
```

Crea `desamparados-web/src/components/Paginador.tsx`:

```tsx
import { useEffect } from 'react'
import { Box, FormControl, InputLabel, MenuItem, Pagination, Select, Typography } from '@mui/material'
import { TAMANOS } from '../hooks/usePaginacion'
import type { MetaPaginacion } from '../lib/api/tipos'

interface Props {
  meta: MetaPaginacion
  onPagina: (numero: number) => void
  onTamano: (numero: number) => void
  /** Para los lectores de pantalla: «paginación del censo de hermanos». */
  etiqueta: string
}

export default function Paginador({ meta, onPagina, onTamano, etiqueta }: Props) {
  const { total, page, limit, totalPages } = meta

  // Un enlace viejo con ?pagina=99 traería una lista vacía y un desconcierto.
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) onPagina(totalPages)
  }, [page, totalPages, onPagina])

  if (total === 0) return null

  const desde = (page - 1) * limit + 1
  const hasta = Math.min(page * limit, total)

  return (
    <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {totalPages > 1 ? `Mostrando ${desde}-${hasta} de ${total}` : `${total} resultados`}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <FormControl size="small">
          <InputLabel id={`tamano-${etiqueta}`}>Resultados por página</InputLabel>
          <Select
            labelId={`tamano-${etiqueta}`}
            label="Resultados por página"
            value={limit}
            onChange={(evento) => onTamano(Number(evento.target.value))}
          >
            {TAMANOS.map((tamano) => <MenuItem key={tamano} value={tamano}>{tamano}</MenuItem>)}
          </Select>
        </FormControl>
        {totalPages > 1 && (
          <Pagination
            count={totalPages}
            page={Math.min(page, totalPages)}
            onChange={(_, numero) => onPagina(numero)}
            color="primary"
            getItemAriaLabel={(tipo, numero) =>
              tipo === 'page' ? `Ir a la página ${numero}`
              : tipo === 'previous' ? 'Página anterior'
              : tipo === 'next' ? 'Página siguiente'
              : tipo === 'first' ? 'Primera página' : 'Última página'}
            aria-label={`Paginación de ${etiqueta}`}
          />
        )}
      </Box>
    </Box>
  )
}
```

- [x] **Paso 4: Ejecutar para verlos pasar**

Ejecuta: `npx vitest run src/hooks src/components/__tests__/Paginador.test.tsx`
Esperado: los 11 tests en verde.

- [x] **Paso 5: Commit**

```bash
git add desamparados-web/src/lib/api/tipos.ts desamparados-web/src/hooks desamparados-web/src/components/Paginador.tsx desamparados-web/src/components/__tests__/Paginador.test.tsx
git commit -m "Anadir el paginador y la memoria de pagina del cliente"
```

---

## Tarea 5: el censo de hermanos

**Ficheros:**
- Modificar: `backend-desamparados/src/services/hermano.service.ts:278-310` (`searchHermanos`)
- Modificar: `backend-desamparados/src/services/hermano.service.ts:314-336` (`getAllHermanos`)
- Modificar: `desamparados-web/src/lib/api/brothers.ts:41`
- Modificar: `desamparados-web/src/features/cms/BrothersAdminPage.tsx`
- Modificar: `desamparados-web/src/features/cms/__tests__/BrothersAdminPage.test.tsx`
- Modificar: `backend-desamparados/test/integration.test.ts`

**Interfaces:**
- Consume: `sanearPaginacion`, `respuestaPaginada` (tarea 2); `usePaginacion`,
  `Paginador`, `paramsPagina`, `RespuestaPaginada` (tarea 4).
- Produce: `searchBrothers(query, { pagina, porPagina })` → `Promise<RespuestaPaginada<AdminBrother>>`.

- [x] **Paso 1: Escribir los tests que fallan**

En `backend-desamparados/test/integration.test.ts`, añade:

```ts
test('el censo respeta la página y el tamaño pedidos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const token = generateToken({ id: adminId, role: Role.ADMIN });
  const cabeceras = { cookie: `${COOKIE_SESION}=${token}` };

  const primera = await fetch(`${baseUrl}/api/hermanos/admin/search?page=1&limit=10`, { headers: cabeceras });
  const segunda = await fetch(`${baseUrl}/api/hermanos/admin/search?page=2&limit=10`, { headers: cabeceras });
  assert.equal(primera.status, 200);

  const uno = await primera.json() as { data: { id: number }[]; meta: Record<string, number> };
  const dos = await segunda.json() as { data: { id: number }[] };

  assert.ok(uno.data.length <= 10);
  assert.deepEqual(Object.keys(uno.meta).sort(), ['limit', 'page', 'total', 'totalPages']);
  assert.equal(uno.meta.limit, 10);
  // La segunda página trae hermanos distintos: si el skip no se aplica, esto falla.
  const idsPrimera = new Set(uno.data.map((h) => h.id));
  assert.ok(dos.data.every((h) => !idsPrimera.has(h.id)));
});

test('el censo recorta un tamaño desmedido al tope', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const token = generateToken({ id: adminId, role: Role.ADMIN });
  const respuesta = await fetch(`${baseUrl}/api/hermanos/admin/search?limit=999999`, { headers: { cookie: `${COOKIE_SESION}=${token}` } });
  const cuerpo = await respuesta.json() as { meta: { limit: number } };
  assert.equal(cuerpo.meta.limit, 100);
});
```

En `desamparados-web/src/features/cms/__tests__/BrothersAdminPage.test.tsx`, añade:

```tsx
it('pide la página que dice la URL', async () => {
  const fetchSimulado = vi.fn().mockResolvedValue(respuestaCenso([]))
  vi.stubGlobal('fetch', fetchSimulado)
  renderWithProviders(<BrothersAdminPage />, { ruta: '/cms/hermanos?pagina=3&porPagina=30' })

  await waitFor(() => {
    const llamadas = fetchSimulado.mock.calls.map(([url]) => String(url))
    expect(llamadas.some((url) => url.includes('page=3') && url.includes('limit=30'))).toBe(true)
  })
})

it('buscar vuelve a la primera página', async () => {
  const user = userEvent.setup()
  const fetchSimulado = vi.fn().mockResolvedValue(respuestaCenso([]))
  vi.stubGlobal('fetch', fetchSimulado)
  renderWithProviders(<BrothersAdminPage />, { ruta: '/cms/hermanos?pagina=5' })

  await user.type(screen.getByLabelText(/buscar/i), 'Rocío')

  await waitFor(() => {
    const ultima = String(fetchSimulado.mock.calls.at(-1)?.[0])
    expect(ultima).toContain('page=1')
    expect(ultima).toContain('q=Roc')
  })
})
```

Con esta ayuda arriba del fichero, que sustituye a la respuesta fija actual:

```tsx
function respuestaCenso(data: unknown[], total = data.length) {
  return new Response(JSON.stringify({ data, meta: { total, page: 1, limit: 20, totalPages: Math.ceil(total / 20) } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } })
}
```

- [x] **Paso 2: Ejecutar para verlos fallar**

Ejecuta: `cd desamparados-web && npx vitest run src/features/cms/__tests__/BrothersAdminPage.test.tsx`
Esperado: FALLAN; la pantalla no lee la URL ni reinicia al buscar.

- [x] **Paso 3: Implementar**

En `hermano.service.ts`, sustituye el saneamiento propio de `searchHermanos` por
el compartido, y lo mismo en `getAllHermanos`:

```ts
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';

// dentro de searchHermanos, en lugar de los Math.min/Math.max propios:
const paginacion = sanearPaginacion(query);

const [data, total] = await db.$transaction([
  db.hermano.findMany({ where, skip: paginacion.skip, take: paginacion.take, /* ...select y orderBy como estaban... */ }),
  db.hermano.count({ where }),
]);

return respuestaPaginada(data, total, paginacion);
```

En `desamparados-web/src/lib/api/brothers.ts`:

```ts
import { paramsPagina, type RespuestaPaginada } from './tipos'

export function searchBrothers(query: string, pagina: { pagina: number; porPagina: number }) {
  return apiFetch<RespuestaPaginada<AdminBrother>>(
    `/hermanos/admin/search?${paramsPagina(pagina, { q: query || undefined })}`,
  )
}
```

En `BrothersAdminPage.tsx`:

```tsx
const { pagina, porPagina, irAPagina, cambiarTamano, reiniciar } = usePaginacion()
const [meta, setMeta] = useState<MetaPaginacion | null>(null)

const load = useCallback(() => Promise.all([
  searchBrothers(query, { pagina, porPagina }),
  // Las solicitudes siguen llegando como array hasta la tarea 6.
  puedeGestionar ? getPendingRequests() : Promise.resolve([] as PendingRequest[]),
]).then(([censo, pendientes]) => {
  setBrothers(censo.data)
  setMeta(censo.meta)
  setRequests(pendientes)
}), [puedeGestionar, query, pagina, porPagina])
```

Y el buscador reinicia la página:

```tsx
<TextField
  label="Buscar por nombre, DNI o email"
  value={query}
  onChange={(event) => { setQuery(event.target.value); reiniciar() }}
  fullWidth sx={{ mb: 3 }}
/>
```

Debajo de la lista:

```tsx
{meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="censo de hermanos" />}
```

- [x] **Paso 4: Ejecutar los dos lados**

Ejecuta: `cd desamparados-web && npx vitest run` y `cd ../backend-desamparados && npm test`
Esperado: todo en verde, ningún test omitido si MariaDB está levantada.

- [x] **Paso 5: Commit**

```bash
git add backend-desamparados/src backend-desamparados/test desamparados-web/src
git commit -m "Paginar el censo de hermanos"
```

---

## Tarea 6: las solicitudes de alta

Segundo listado de la misma pantalla, con su propia paginación. **El contador de
la pestaña tiene que seguir diciendo el total**, no lo que cabe en la página.

**Ficheros:**
- Modificar: `backend-desamparados/src/services/hermano.service.ts:460-478` (`getSolicitudesPendientes`)
- Modificar: `backend-desamparados/src/controllers/hermano.controller.ts` (`getSolicitudes`)
- Modificar: `desamparados-web/src/lib/api/brothers.ts:46`
- Modificar: `desamparados-web/src/features/cms/BrothersAdminPage.tsx`
- Modificar: `desamparados-web/src/features/cms/__tests__/BrothersAdminPage.test.tsx`

**Interfaces:**
- Consume: lo de las tareas 2 y 4.
- Produce: `getPendingRequests({ pagina, porPagina })` → `Promise<RespuestaPaginada<PendingRequest>>`.

- [x] **Paso 1: Escribir el test que falla**

```tsx
it('la pestaña cuenta todas las solicitudes, no las de la página', async () => {
  // Con doce pendientes y diez por página, «Solicitudes (10)» sería mentira
  // justo en el aviso que empuja a entrar a mirarlas.
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) =>
    Promise.resolve(String(url).includes('solicitudes')
      ? new Response(JSON.stringify({ data: [solicitud], meta: { total: 12, page: 1, limit: 10, totalPages: 2 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : respuestaCenso([]))))

  renderWithProviders(<BrothersAdminPage />)
  expect(await screen.findByRole('tab', { name: /solicitudes \(12\)/i })).toBeInTheDocument()
})
```

Define `solicitud` arriba del fichero:

```tsx
const solicitud = {
  id: 3, email: 'nueva@ejemplo.invalido', nombre: 'Lucía', apellidos: 'Ramos Gil',
  createdAt: '2026-08-20T10:00:00.000Z', hermanos: [],
}
```

- [x] **Paso 2: Ejecutar para verlo fallar**

Ejecuta: `npx vitest run src/features/cms/__tests__/BrothersAdminPage.test.tsx`
Esperado: FALLA; hoy la pestaña cuenta `requests.length`.

- [x] **Paso 3: Implementar**

En el servicio, acepta paginación y devuelve el par lista/total:

```ts
static async getSolicitudesPendientes(query: { page?: unknown; limit?: unknown } = {}) {
  const paginacion = sanearPaginacion(query);
  const where = { role: Role.USER, hermanos: { some: { activo: false, fechaBaja: null } } };

  const [data, total] = await db.$transaction([
    db.user.findMany({
      where,
      select: { /* ...el select que ya estaba... */ },
      orderBy: { createdAt: 'asc' },
      skip: paginacion.skip,
      take: paginacion.take,
    }),
    db.user.count({ where }),
  ]);

  return respuestaPaginada(data, total, paginacion);
}
```

En el controlador, pásale `req.query`. En el cliente:

```ts
export function getPendingRequests(pagina: { pagina: number; porPagina: number }) {
  return apiFetch<RespuestaPaginada<PendingRequest>>(`/hermanos/admin/solicitudes?${paramsPagina(pagina)}`)
}
```

En la pantalla, segunda paginación con prefijo, y el contador desde `meta`:

```tsx
const solicitudes = usePaginacion('Solicitudes')
const [metaSolicitudes, setMetaSolicitudes] = useState<MetaPaginacion | null>(null)

<Tab value="solicitudes" label={`Solicitudes (${metaSolicitudes?.total ?? 0})`} />

{metaSolicitudes && <Paginador
  meta={metaSolicitudes}
  onPagina={solicitudes.irAPagina}
  onTamano={solicitudes.cambiarTamano}
  etiqueta="solicitudes de alta"
/>}
```

- [x] **Paso 4: Ejecutar**

Ejecuta: `npx vitest run` y `cd ../backend-desamparados && npm test`
Esperado: todo en verde.

- [x] **Paso 5: Commit**

```bash
git add backend-desamparados/src desamparados-web/src
git commit -m "Paginar las solicitudes de alta sin falsear el contador"
```

---

## Tarea 7: tesorería

**Ficheros:**
- Modificar: `backend-desamparados/src/services/recibo.service.ts:14-30` (`getAdminRecibos`)
- Modificar: `backend-desamparados/src/controllers/recibo.controller.ts:27-40`
- Modificar: `desamparados-web/src/lib/api/treasury.ts:23`
- Modificar: `desamparados-web/src/features/cms/TreasuryAdminPage.tsx`
- Crear: `desamparados-web/src/features/cms/__tests__/TreasuryAdminPage.test.tsx`

**Interfaces:**
- Produce: `getAdminReceipts(year, { pagina, porPagina })` → `Promise<RespuestaPaginada<AdminReceipt>>`.

- [x] **Paso 1: Escribir el test que falla**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import TreasuryAdminPage from '../TreasuryAdminPage'

function responder(total: number) {
  return vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ data: [], meta: { total, page: 1, limit: 20, totalPages: Math.ceil(total / 20) } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('TreasuryAdminPage', () => {
  it('dice cuántos recibos hay en total, no cuántos se ven', async () => {
    // 1.167 recibos y una pantalla que enseñaba 200 sin decirlo.
    vi.stubGlobal('fetch', responder(1167))
    renderWithProviders(<TreasuryAdminPage />)
    expect(await screen.findByText(/de 1167/i)).toBeInTheDocument()
  })

  it('cambiar de año vuelve a la primera página', async () => {
    const user = userEvent.setup()
    const fetchSimulado = responder(1167)
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<TreasuryAdminPage />, { ruta: '/cms/tesoreria?pagina=4' })

    await user.clear(screen.getByLabelText(/año/i))
    await user.type(screen.getByLabelText(/año/i), '2025')

    await waitFor(() => {
      const ultima = String(fetchSimulado.mock.calls.at(-1)?.[0])
      expect(ultima).toContain('page=1')
      expect(ultima).toContain('year=2025')
    })
  })
})
```

- [x] **Paso 2: Ejecutar para verlo fallar**

Ejecuta: `npx vitest run src/features/cms/__tests__/TreasuryAdminPage.test.tsx`
Esperado: FALLA; no hay recuento ni paginación.

- [x] **Paso 3: Implementar**

En `recibo.service.ts`, cambia el saneamiento propio —`Math.min(Math.max(1, ...), 200)`— por
`sanearPaginacion`, y devuelve `respuestaPaginada(data, total, paginacion)`. En el
controlador, pasa `req.query` entero en vez de leer `page` y `limit` a mano.

En `treasury.ts`:

```ts
export function getAdminReceipts(year: string | undefined, pagina: { pagina: number; porPagina: number }) {
  return apiFetch<RespuestaPaginada<AdminReceipt>>(`/recibos/admin?${paramsPagina(pagina, { year })}`)
}
```

En la pantalla, `usePaginacion()`, guardar `meta`, pintar el `Paginador` con
`etiqueta="recibos"` y llamar a `reiniciar()` en el `onChange` del año.

- [x] **Paso 4: Ejecutar**

Ejecuta: `npx vitest run` y `cd ../backend-desamparados && npm test`
Esperado: verde.

- [x] **Paso 5: Commit**

```bash
git add backend-desamparados/src desamparados-web/src
git commit -m "Paginar los recibos de tesoreria"
```

---

## Tarea 8: contabilidad

Este extremo devuelve `meta` **sin `limit`** (`{ total, page, lastPage }`), así que
además de paginar hay que enderezar su forma.

**Ficheros:**
- Modificar: `backend-desamparados/src/services/transaccion.service.ts:60-76` (`getAll`)
- Modificar: `backend-desamparados/src/controllers/transaccion.controller.ts` (`getLibroMayor`)
- Modificar: `desamparados-web/src/lib/api/accounting.ts:9`
- Modificar: `desamparados-web/src/features/cms/AccountingAdminPage.tsx`
- Crear: `desamparados-web/src/features/cms/__tests__/AccountingAdminPage.test.tsx`

**Interfaces:**
- Produce: `getLedger({ pagina, porPagina })` → `Promise<RespuestaPaginada<Transaction>>`.
  **`meta.lastPage` desaparece: pasa a llamarse `totalPages`**, como en el resto.

- [x] **Paso 1: Escribir el test que falla**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import AccountingAdminPage from '../AccountingAdminPage'

afterEach(() => { vi.unstubAllGlobals() })

describe('AccountingAdminPage', () => {
  it('dice cuántos movimientos hay en total', async () => {
    // 1.278 movimientos, de los que se veían 200.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [], meta: { total: 1278, page: 1, limit: 20, totalPages: 64 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    renderWithProviders(<AccountingAdminPage />)
    expect(await screen.findByText(/de 1278/i)).toBeInTheDocument()
  })
})
```

- [x] **Paso 2: Ejecutar para verlo fallar**

Ejecuta: `npx vitest run src/features/cms/__tests__/AccountingAdminPage.test.tsx`
Esperado: FALLA.

- [x] **Paso 3: Implementar**

```ts
static async getAll(query: { page?: unknown; limit?: unknown } = {}) {
  const paginacion = sanearPaginacion(query);
  const [data, total] = await db.$transaction([
    db.transaccion.findMany({
      orderBy: { fecha: 'desc' },
      skip: paginacion.skip,
      take: paginacion.take,
      include: {
        categoria: { select: { nombre: true } },
        hermano: { select: { nombre: true, apellidos: true } },
      },
    }),
    db.transaccion.count(),
  ]);
  return respuestaPaginada(data, total, paginacion);
}
```

En `accounting.ts`, `getLedger` pasa a recibir la página y el tipo
`LedgerResponse` se sustituye por `RespuestaPaginada<Transaction>`. **Comprueba
si algún sitio leía `meta.lastPage`** con `grep -rn "lastPage" desamparados-web/src`
antes de dar la tarea por hecha.

- [x] **Paso 4: Ejecutar**

Ejecuta: `npx vitest run` y `npx tsc --noEmit -p tsconfig.app.json`
Esperado: verde y sin errores de tipos.

- [x] **Paso 5: Commit**

```bash
git add backend-desamparados/src desamparados-web/src
git commit -m "Paginar el libro mayor y enderezar su meta"
```

---

## Tarea 9: auditoría

El servicio ya está bien montado; solo hay que cambiar su saneamiento por el
compartido y darle paginación a la pantalla.

**Ficheros:**
- Modificar: `backend-desamparados/src/services/admin.service.ts:136-158` (`getAuditLogs`)
- Modificar: `desamparados-web/src/lib/api/audit.ts:5`
- Modificar: `desamparados-web/src/features/cms/AuditAdminPage.tsx`
- Crear: `desamparados-web/src/features/cms/__tests__/AuditAdminPage.test.tsx`

**Interfaces:**
- Produce: `getAuditLogs({ pagina, porPagina })` → `Promise<RespuestaPaginada<AuditEntry>>`.

- [x] **Paso 1: Escribir el test que falla**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import AuditAdminPage from '../AuditAdminPage'

afterEach(() => { vi.unstubAllGlobals() })

describe('AuditAdminPage', () => {
  it('pide la página que dice la URL', async () => {
    const fetchSimulado = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [], meta: { total: 400, page: 2, limit: 20, totalPages: 20 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<AuditAdminPage />, { ruta: '/cms/auditoria?pagina=2' })

    await waitFor(() => expect(String(fetchSimulado.mock.calls.at(-1)?.[0])).toContain('page=2'))
  })
})
```

- [x] **Paso 2: Ejecutar para verlo fallar**

Ejecuta: `npx vitest run src/features/cms/__tests__/AuditAdminPage.test.tsx`
Esperado: FALLA; hoy pide siempre `page=1&limit=200`.

- [x] **Paso 3: Implementar**

En `admin.service.ts`, desaparecen el `Math.max` y el tope propio de 200:

```ts
static async getAuditLogs(query: { page?: unknown; limit?: unknown; action?: string; userId?: number } = {}) {
  const paginacion = sanearPaginacion(query);

  const where = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.userId ? { userId: query.userId } : {})
  };

  const [data, total] = await db.$transaction([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: paginacion.skip,
      take: paginacion.take,
      include: {
        user: { select: { id: true, email: true, nombre: true, apellidos: true, role: true } }
      }
    }),
    db.auditLog.count({ where })
  ]);

  return respuestaPaginada(data, total, paginacion);
}
```

El controlador le pasa `req.query` entero en lugar de desmenuzarlo. En el
cliente:

```ts
export const getAuditLogs = (pagina: { pagina: number; porPagina: number }) =>
  apiFetch<RespuestaPaginada<AuditEntry>>(`/admin/audit-logs?${paramsPagina(pagina)}`)
```

Y la pantalla usa `usePaginacion()` con `etiqueta="registro de auditoría"`.

- [x] **Paso 4: Ejecutar**

Ejecuta: `npx vitest run` y `cd ../backend-desamparados && npm test`
Esperado: verde.

- [x] **Paso 5: Commit**

```bash
git add backend-desamparados/src desamparados-web/src
git commit -m "Paginar el registro de auditoria"
```

---

## Tarea 10: noticias del CMS y su lectura por id

Aquí se cierra el fallo latente: `getAdminNewsById` busca la noticia dentro de un
listado recortado a diez.

**Ficheros:**
- Modificar: `backend-desamparados/src/services/news.service.ts:46-80` (`getArchive`)
- Modificar: `backend-desamparados/src/controllers/news.controller.ts:22-31`
- Modificar: `backend-desamparados/src/routes/news.routes.ts`
- Modificar: `desamparados-web/src/lib/api/news.ts:48,78`
- Modificar: `desamparados-web/src/features/cms/NewsAdminPage.tsx`
- Modificar: `backend-desamparados/test/integration.test.ts`

**Interfaces:**
- Produce: `GET /api/news/admin/:id`; `getAdminNews({ pagina, porPagina })` →
  `Promise<RespuestaPaginada<ApiNews>>`; `getAdminNewsById(id)` →
  `Promise<ApiNews>` (ya sin `.find()`).

- [x] **Paso 1: Escribir los tests que fallan**

```ts
test('la noticia del CMS se lee por id, no buscándola en el listado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const token = generateToken({ id: adminId, role: Role.ADMIN });
  const listado = await fetch(`${baseUrl}/api/news/admin/archive?limit=1`, { headers: { cookie: `${COOKIE_SESION}=${token}` } });
  const { data } = await listado.json() as { data: { id: number }[] };
  if (data.length === 0) return t.skip('no hay noticias sembradas');

  const respuesta = await fetch(`${baseUrl}/api/news/admin/${data[0].id}`, { headers: { cookie: `${COOKIE_SESION}=${token}` } });
  assert.equal(respuesta.status, 200);
  assert.equal((await respuesta.json() as { id: number }).id, data[0].id);
});

test('la noticia del CMS por id no se sirve sin sesión', async () => {
  // La ruta va antes de /:slug para que "admin" no se lea como slug, y ese
  // orden ya dejó los borradores al aire una vez.
  const respuesta = await fetch(`${baseUrl}/api/news/admin/1`);
  assert.equal(respuesta.status, 401);
});
```

- [x] **Paso 2: Ejecutar para verlos fallar**

Ejecuta: `cd backend-desamparados && npx tsx --test test/integration.test.ts`
Esperado: FALLAN con 404, la ruta no existe.

- [x] **Paso 3: Implementar**

En `news.routes.ts`, **justo debajo de `/admin/archive` y siempre antes de
`/:slug`**:

```ts
newsRoutes.get(
  '/admin/:id',
  authenticateToken,
  checkRole(rolesCMS),
  validateId,
  NewsController.getAdminOne
);
```

En el controlador, `getAdminOne` busca por id incluyendo borradores y responde
404 si no existe. En el servicio, `getArchive` usa `sanearPaginacion` y
`respuestaPaginada`; **desaparece el tope propio de 50**.

En `news.ts` del cliente:

```ts
export function getAdminNews(pagina: { pagina: number; porPagina: number }) {
  return apiFetch<RespuestaPaginada<ApiNews>>(`/news/admin/archive?${paramsPagina(pagina)}`)
}

export function getAdminNewsById(id: number) {
  return apiFetch<ApiNews>(`/news/admin/${id}`)
}
```

- [x] **Paso 4: Ejecutar**

Ejecuta: `npm test` y `cd ../desamparados-web && npx vitest run`
Esperado: verde.

- [x] **Paso 5: Commit**

```bash
git add backend-desamparados/src backend-desamparados/test desamparados-web/src
git commit -m "Leer la noticia del CMS por id y paginar su listado"
```

---

## Tarea 11: el archivo público de noticias

**Ficheros:**
- Modificar: `desamparados-web/src/lib/api/news.ts:38`
- Modificar: `desamparados-web/src/features/news/noticias/NoticiasPage.tsx`
- Crear: `desamparados-web/src/features/news/noticias/__tests__/NoticiasPage.test.tsx`

**Interfaces:**
- Produce: `getNewsArchive({ pagina, porPagina })` →
  `Promise<{ noticias: NewsItem[]; meta: MetaPaginacion }>`. Devuelve las dos
  cosas porque la página necesita el `meta` y las tarjetas necesitan el
  `NewsItem` ya convertido.

- [x] **Paso 1: Escribir el test que falla**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import NoticiasPage from '../NoticiasPage'

afterEach(() => { vi.unstubAllGlobals() })

describe('NoticiasPage', () => {
  it('ofrece pasar de página cuando hay más noticias de las que caben', async () => {
    // El archivo público servía diez y no lo decía.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [], meta: { total: 45, page: 1, limit: 20, totalPages: 3 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    renderWithProviders(<NoticiasPage />)
    expect(await screen.findByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
  })
})
```

- [x] **Paso 2: Ejecutar para verlo fallar**

Ejecuta: `npx vitest run src/features/news/noticias`
Esperado: FALLA.

- [x] **Paso 3: Implementar**

```ts
export async function getNewsArchive(pagina: { pagina: number; porPagina: number }) {
  const respuesta = await apiFetch<RespuestaPaginada<ApiNews>>(`/news/archive?${paramsPagina(pagina)}`)
  return { noticias: respuesta.data.map(toNewsItem), meta: respuesta.meta }
}
```

En `NoticiasPage`, `usePaginacion()`, guardar `meta` y pintar el `Paginador`
debajo de la rejilla, **centrado y con subida al principio** al cambiar:

```tsx
const alCambiarPagina = (numero: number) => {
  irAPagina(numero)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
```

- [x] **Paso 4: Ejecutar**

Ejecuta: `npx vitest run`
Esperado: verde.

- [x] **Paso 5: Commit**

```bash
git add desamparados-web/src
git commit -m "Paginar el archivo publico de noticias"
```

---

## Tarea 12: publicaciones, dentro y fuera del CMS

Cuatro consumidores del mismo extremo cambian a la vez. **Si se olvida uno, esa
página se queda vacía sin dar error.**

**Ficheros:**
- Modificar: `backend-desamparados/src/services/publication.service.ts:11-20`
- Modificar: `backend-desamparados/src/controllers/publication.controller.ts`
- Modificar: `backend-desamparados/src/routes/publication.routes.ts`
- Modificar: `backend-desamparados/src/schemas/publication.schema.ts`
- Modificar: `desamparados-web/src/lib/api/publications.ts:32,38,65`
- Modificar: `desamparados-web/src/features/cms/PublicationsAdminPage.tsx`
- Modificar: `desamparados-web/src/features/publications/PublicationsPage.tsx`
- Modificar: `desamparados-web/src/features/publications/BoletinesPage.tsx`
- Modificar: `desamparados-web/src/features/publications/DossierPrensaPage.tsx`
- Modificar: `backend-desamparados/test/integration.test.ts:85-88`

**Interfaces:**
- Produce: `GET /api/publications/:id`; `getPublications(category, pagina)` y
  `getAdminPublications(pagina)` → `Promise<RespuestaPaginada<...>>`;
  `getAdminPublicationById(id)` → `Promise<ApiPublication>` sin `.find()`.

- [x] **Paso 1: Escribir los tests que fallan**

Actualiza el test existente de `integration.test.ts:85`, que hoy afirma que la
respuesta es un array:

```ts
test('las publicaciones públicas no requieren autenticación y vienen paginadas', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const response = await fetch(`${baseUrl}/api/publications`);
  assert.equal(response.status, 200);
  const cuerpo = await response.json() as { data: unknown[]; meta: Record<string, number> };
  assert.ok(Array.isArray(cuerpo.data));
  assert.deepEqual(Object.keys(cuerpo.meta).sort(), ['limit', 'page', 'total', 'totalPages']);
});

test('la publicación se lee por id', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const token = generateToken({ id: adminId, role: Role.ADMIN });
  const listado = await fetch(`${baseUrl}/api/publications/admin?limit=1`, { headers: { cookie: `${COOKIE_SESION}=${token}` } });
  const { data } = await listado.json() as { data: { id: number }[] };
  if (data.length === 0) return t.skip('no hay publicaciones sembradas');

  const respuesta = await fetch(`${baseUrl}/api/publications/${data[0].id}`, { headers: { cookie: `${COOKIE_SESION}=${token}` } });
  assert.equal(respuesta.status, 200);
});
```

- [x] **Paso 2: Ejecutar para verlos fallar**

Ejecuta: `npx tsx --test test/integration.test.ts`
Esperado: FALLAN.

- [x] **Paso 3: Implementar**

`getPublic` y `getAdmin` aceptan la consulta, usan `sanearPaginacion` y
devuelven `respuestaPaginada`, con `db.$transaction([findMany, count])`. La ruta
nueva va **después** de `/latest`, `/admin` y `/category/:category`, para que
ninguna de esas se lea como un id:

```ts
publicationRoutes.get('/:id', authenticateToken, checkRole(roles), validate(publicationIdParamSchema), PublicationController.getOne);
```

Añade `...paginacionQuery` al `query` de `categoryParamSchema` y del esquema de
listado. En el cliente, las cuatro pantallas pasan a leer `data` y a pintar el
`Paginador`.

- [x] **Paso 4: Ejecutar**

Ejecuta: `npm test`, `cd ../desamparados-web && npx vitest run` y
`npx tsc --noEmit -p tsconfig.app.json`
Esperado: verde. **Comprueba a mano las cuatro páginas** en el navegador: son las
que se quedan vacías si se escapa una.

- [x] **Paso 5: Commit**

```bash
git add backend-desamparados/src backend-desamparados/test desamparados-web/src
git commit -m "Paginar las publicaciones y leerlas por id"
```

---

## Tarea 13: la agenda, con cuidado de la portada

El extremo `/api/events` lo comparten el CMS, la agenda pública **y los «próximos
eventos» de la portada y de actualidad**. Estos dos últimos no se paginan, pero
sí cambian de forma.

**Ficheros:**
- Modificar: `backend-desamparados/src/services/agenda.service.ts:12-56`
- Modificar: `backend-desamparados/src/controllers/agenda.controller.ts:8-17`
- Modificar: `backend-desamparados/src/schemas/agenda.schema.ts:31-37`
- Modificar: `desamparados-web/src/lib/api/events.ts:41,46`
- Modificar: `desamparados-web/src/features/cms/AgendaAdminPage.tsx`
- Modificar: `desamparados-web/src/features/news/agenda/AgendaPage.tsx`
- Modificar: `desamparados-web/src/features/home/EventsAndLive.tsx`
- Modificar: `desamparados-web/src/features/news/NewsPage.tsx`

**Interfaces:**
- Produce: `getAdminEvents(pagina)` y `getPublicEvents(pagina)` →
  `Promise<{ eventos: EventItem[]; meta: MetaPaginacion }>`;
  `getProximosEventos(cuantos)` → `Promise<EventItem[]>` para portada y
  actualidad, que piden `?limit=<cuantos>` y se quedan con `data`.

- [x] **Paso 1: Escribir el test que falla**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import EventsAndLive from '../EventsAndLive'

afterEach(() => { vi.unstubAllGlobals() })

describe('EventsAndLive', () => {
  it('sigue pintando los próximos eventos con la respuesta paginada', async () => {
    // Regresión: al pasar /api/events a {data, meta}, esta sección de la
    // portada se queda en blanco si sigue leyendo la respuesta como un array.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        data: [{ id: 1, title: 'Besapiés', description: null, location: 'Parroquia', startDate: '2026-09-12T18:00:00.000Z', endDate: null, visibility: 'public', type: 'CULTO' }],
        meta: { total: 1, page: 1, limit: 3, totalPages: 1 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    renderWithProviders(<EventsAndLive />)
    expect(await screen.findByText(/besapiés/i)).toBeInTheDocument()
  })
})
```

- [x] **Paso 2: Ejecutar para verlo fallar**

Ejecuta: `npx vitest run src/features/home`
Esperado: FALLA; hoy espera un array.

- [x] **Paso 3: Implementar**

En `agenda.service.ts`, `getEvents` acepta la paginación, hace
`db.$transaction([findMany, count])` con el `where` que ya construye y devuelve
`respuestaPaginada`. Añade `...paginacionQuery` a `queryAgendaSchema`. En el
cliente, las cuatro pantallas leen `data`; solo el CMS y la agenda pública
pintan `Paginador`.

- [x] **Paso 4: Ejecutar**

Ejecuta: `npx vitest run` y `cd ../backend-desamparados && npm test`
Esperado: verde. Abre la portada en el navegador y comprueba que la sección de
eventos sigue ahí.

- [x] **Paso 5: Commit**

```bash
git add backend-desamparados/src desamparados-web/src
git commit -m "Paginar la agenda sin dejar en blanco la portada"
```

---

## Tarea 14: inventario, dos listados en una pantalla

**Ficheros:**
- Modificar: `backend-desamparados/src/services/inventario.service.ts:14-27` (`getAllEnseres`)
- Modificar: `backend-desamparados/src/services/inventario.service.ts:87-104` (`getAllPrendas`)
- Modificar: `backend-desamparados/src/controllers/inventario.controller.ts`
- Modificar: `backend-desamparados/src/routes/inventario.routes.ts`
- Modificar: `backend-desamparados/src/schemas/inventario.schema.ts:52-59,85-92`
- Modificar: `desamparados-web/src/lib/api/inventory.ts`
- Modificar: `desamparados-web/src/features/cms/InventoryAdminPage.tsx`
- Crear: `desamparados-web/src/features/cms/__tests__/InventoryAdminPage.test.tsx`

**Interfaces:**
- Produce: `GET /api/inventario/prendas/:id`; `getEnseres(pagina)` y
  `getPrendas(pagina)` → `Promise<RespuestaPaginada<...>>`; `getPrenda(id)` →
  `Promise<Prenda>` sin `.find()`.

- [x] **Paso 1: Escribir el test que falla**

```tsx
it('cada listado pasa página por su cuenta', async () => {
  // Con un solo parámetro compartido, pasar página en enseres movería el ropero.
  const user = userEvent.setup()
  const fetchSimulado = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(
    JSON.stringify({ data: [], meta: { total: 120, page: 1, limit: 20, totalPages: 6 } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
  vi.stubGlobal('fetch', fetchSimulado)
  renderWithProviders(<InventoryAdminPage />, { ruta: '/cms/inventario' })

  await user.click((await screen.findAllByRole('button', { name: /ir a la página 2/i }))[0])

  await waitFor(() => {
    const enseres = fetchSimulado.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/enseres'))
    const prendas = fetchSimulado.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/prendas'))
    expect(enseres.at(-1)).toContain('page=2')
    expect(prendas.every((url) => !url.includes('page=2'))).toBe(true)
  })
})
```

- [x] **Paso 2: Ejecutar para verlo fallar**

Ejecuta: `npx vitest run src/features/cms/__tests__/InventoryAdminPage.test.tsx`
Esperado: FALLA.

- [x] **Paso 3: Implementar**

Los dos servicios pasan a `db.$transaction([findMany, count])` con el `where`
que ya arman, y devuelven `respuestaPaginada`. Añade `...paginacionQuery` a
`queryEnserSchema` y `queryPrendaSchema`. La ruta nueva, junto a la de enseres:

```ts
inventarioRoutes.get('/prendas/:id', validateId, InventarioController.getOnePrenda);
```

Ojo al orden: va **después** de `/prendas` y antes de las de acción
(`/prendas/:id/asignar`), que ya existen y no se tocan.

En la pantalla, dos hooks con prefijo:

```tsx
const enseres = usePaginacion('Enseres')
const prendas = usePaginacion('Prendas')
```

Y en `inventory.ts` desaparece el `.find()`:

```ts
export const getPrenda = (id: number) => apiFetch<Prenda>(`/inventario/prendas/${id}`)
```

- [x] **Paso 4: Ejecutar**

Ejecuta: `npx vitest run` y `cd ../backend-desamparados && npm test`
Esperado: verde.

- [x] **Paso 5: Commit**

```bash
git add backend-desamparados/src desamparados-web/src
git commit -m "Paginar enseres y ropero por separado"
```

---

## Tarea 15: el área del hermano

Tres listados propios: recibos, perfiles e histórico de papeletas.

**Ficheros:**
- Modificar: `backend-desamparados/src/services/recibo.service.ts` (`getRecibosByUsuarioFamilia`)
- Modificar: `backend-desamparados/src/controllers/recibo.controller.ts:13-21`
- Modificar: `backend-desamparados/src/services/procesion.service.ts:119-133` (`getMisPapeletas`)
- Modificar: `backend-desamparados/src/controllers/procesion.controller.ts:42-49`
- Modificar: `backend-desamparados/src/controllers/hermano.controller.ts` (`getMyProfiles`)
- Modificar: `desamparados-web/src/lib/api/receipts.ts:23`
- Modificar: `desamparados-web/src/lib/api/profile.ts:17`
- Modificar: `desamparados-web/src/lib/api/procession.ts:21`
- Modificar: las tres pantallas del área del hermano que los pintan
- Crear: `desamparados-web/src/features/members/__tests__/ReceiptsPage.test.tsx`

**Interfaces:**
- Produce: `getMyReceipts(pagina)`, `getMyProfiles(pagina)` y
  `getMyProcessionTickets(pagina)` → `Promise<RespuestaPaginada<...>>`.

- [x] **Paso 1: Escribir el test que falla**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import ReceiptsPage from '../ReceiptsPage'

afterEach(() => { vi.unstubAllGlobals() })

describe('ReceiptsPage', () => {
  it('dice cuántos recibos propios hay', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [], meta: { total: 30, page: 1, limit: 20, totalPages: 2 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    renderWithProviders(<ReceiptsPage />)
    expect(await screen.findByText(/de 30/i)).toBeInTheDocument()
  })
})
```

- [x] **Paso 2: Ejecutar para verlo fallar**

Ejecuta: `npx vitest run src/features/members`
Esperado: FALLA.

- [x] **Paso 3: Implementar**

Los tres servicios siguen el mismo molde. El de papeletas, entero, para que se
vea el patrón exacto:

```ts
static async getMisPapeletas(userId: number, query: { page?: unknown; limit?: unknown } = {}) {
  const paginacion = sanearPaginacion(query);
  const where = { hermano: { userId } };

  const [data, total] = await db.$transaction([
    db.papeletaSitio.findMany({
      where,
      include: {
        hermano: { select: { nombre: true, apellidos: true } },
        recibo: { select: { estado: true, importe: true } }
      },
      orderBy: [{ year: 'desc' }, { hermano: { nombre: 'asc' } }],
      skip: paginacion.skip,
      take: paginacion.take,
    }),
    db.papeletaSitio.count({ where })
  ]);

  return respuestaPaginada(data, total, paginacion);
}
```

`getRecibosByUsuarioFamilia` y `getMyProfiles` se transforman igual, cada uno con
el `where` que ya tiene —los recibos de la familia del usuario y las fichas de su
cuenta—, sin tocar sus `include` ni sus `orderBy`.

Los tres controladores pasan `req.query` como segundo argumento. En el cliente:

```ts
export const getMyReceipts = (pagina: { pagina: number; porPagina: number }) =>
  apiFetch<RespuestaPaginada<Receipt>>(`/recibos/mis-recibos?${paramsPagina(pagina)}`)

export const getMyProfiles = (pagina: { pagina: number; porPagina: number }) =>
  apiFetch<RespuestaPaginada<ApiProfile>>(`/hermanos/mis-perfiles?${paramsPagina(pagina)}`)

export const getMyProcessionTickets = (pagina: { pagina: number; porPagina: number }) =>
  apiFetch<RespuestaPaginada<ProcessionTicket>>(`/procesion/mis-papeletas?${paramsPagina(pagina)}`)
```

Las tres pantallas usan `usePaginacion()` y pintan el `Paginador` con las
etiquetas «mis recibos», «mis perfiles» y «mi histórico de papeletas».

**Cuidado con los perfiles:** la pantalla de perfil usa la lista para elegir
sobre qué ficha se opera. Comprueba que sigue funcionando con más de una página,
o el hermano con tres fichas dejaría de ver una de ellas.

- [x] **Paso 4: Ejecutar la verificación completa**

```bash
cd backend-desamparados && npm test
cd ../desamparados-web && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run lint
```

Esperado: todo en verde, **ningún test omitido** con MariaDB levantada.

- [x] **Paso 5: Commit**

```bash
git add backend-desamparados/src desamparados-web/src
git commit -m "Paginar los listados del area del hermano"
```

---

## Comprobación final antes del PR

Con los dos servidores levantados y sesión de administrador, recorre las
dieciséis pantallas y comprueba en cada una:

1. El recuento coincide con lo que dice la base de datos.
2. El selector ofrece 10, 20, 30, 40 y 50, y cambiarlo vuelve a la primera página.
3. Pasar de página cambia la URL, y recargar con esa URL cae en el mismo sitio.
4. Editar una ficha y volver deja el listado donde estaba.
5. Buscar o filtrar vuelve a la primera página.
6. `?pagina=99` lleva a la última página existente, no a un vacío.

Los tres sitios que más fácil se rompen y que hay que mirar sí o sí: **la portada**
(sección de próximos eventos), **la página de actualidad** y **las tres de
publicaciones**.
