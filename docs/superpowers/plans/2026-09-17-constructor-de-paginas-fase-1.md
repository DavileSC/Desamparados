# Constructor de páginas — Fase 1: motor y página piloto

> **Para quien ejecute esto:** SUB-SKILL OBLIGATORIA: usa
> `superpowers:subagent-driven-development` (recomendado) o
> `superpowers:executing-plans` para ir tarea a tarea. Los pasos llevan casilla
> (`- [ ]`) para ir marcándolos.

**Objetivo:** que la página de Corporación se componga de bloques que se añaden,
se quitan y se reordenan desde el CMS, con el motor que después usarán las otras
diecinueve.

**Arquitectura:** `ContenidoPagina.datos` pasa a ser `{ cabecera, bloques[] }`.
La lista de tipos de bloque vive en `shared/tipos-de-bloque.json`, que leen los
dos lados; el servidor mapea cada tipo a su esquema de arktype y la web lo mapea
a su componente. El documento se valida recorriendo la lista y aplicando el
esquema de cada `tipo`, igual que hoy `esquemaDeSlug` hace con los slugs.

**Tecnologías:** TypeScript, arktype (validación), Prisma + MariaDB, React 19 +
MUI, TipTap (bloque de texto), vitest y `node:test`.

**Spec:** [`docs/superpowers/specs/2026-09-17-constructor-de-paginas-design.md`](../specs/2026-09-17-constructor-de-paginas-design.md)

## Restricciones globales

- **La corporación es un «Grupo Parroquial»**, con concordancia masculina. Nunca
  «Hermandad» ni «Cofradía» en texto visible (`docs/notas-del-proyecto.md` §1).
- **Todo se valida en el servidor.** Ninguna validación vive solo en el
  navegador.
- **Las fotos solo pueden ser rutas propias** (`/storage/public/<32 hex>.<ext>`).
  Nunca una URL externa: filtra la IP de quien visita y el limpiador de huérfanos
  no la conoce.
- **Nada de uniones discriminadas en arktype.** arktype 2.1 revienta al describir
  el error de una unión cuyas ramas llevan `narrow`; eso sería un 500 en vez de
  un 400. Se valida con un mapa `tipo → esquema`.
- **Toda foto lleva descripción obligatoria** si la hay. Sin ella, el contenido
  no existe para quien use un lector de pantalla.
- **Los topes de texto salen de `shared/topes-contenido.json`**, nunca escritos a
  mano: `etiqueta` 60, `titulo` 120, `parrafo` 600, `descripcion` 200.
- **MariaDB tiene que estar arrancado** (`docker start desamparados-mariadb`) o
  los tests de integración se omiten y mienten.
- **`rtk` está bloqueado** por una directiva de Control de aplicaciones de
  Windows: usa `git`, `npm` y `npx` directos.

---

### Tarea 1: El catálogo de tipos de bloque, compartido

Una sola lista de tipos que leen el servidor y la web. Si viviera por duplicado,
añadir un bloque en un lado y olvidarlo en el otro daría un 400 al guardar sin
que nada avisara antes.

**Ficheros:**
- Crear: `shared/tipos-de-bloque.json`
- Crear: `backend-desamparados/src/domain/bloques.ts`
- Test: `backend-desamparados/test/bloques-catalogo.test.ts`

**Interfaces:**
- Produce: `TIPOS_BLOQUE: readonly TipoBloque[]`, `type TipoBloque`,
  `esTipoBloque(valor: unknown): valor is TipoBloque`

- [ ] **Paso 1: Escribir el test que falla**

`backend-desamparados/test/bloques-catalogo.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { TIPOS_BLOQUE, esTipoBloque } from '../src/domain/bloques.js';

describe('catálogo de tipos de bloque', () => {
  test('los tres bloques de la primera fase están declarados', () => {
    for (const tipo of ['texto', 'foto', 'tarjetas']) {
      assert.ok((TIPOS_BLOQUE as readonly string[]).includes(tipo), `falta el tipo ${tipo}`);
    }
  });

  test('reconoce los tipos declarados y rechaza el resto', () => {
    assert.equal(esTipoBloque('texto'), true);
    assert.equal(esTipoBloque('loQueSea'), false);
    assert.equal(esTipoBloque(''), false);
    assert.equal(esTipoBloque(null), false);
    assert.equal(esTipoBloque(42), false);
  });

  test('no hay tipos repetidos', () => {
    assert.equal(new Set(TIPOS_BLOQUE).size, TIPOS_BLOQUE.length);
  });
});
```

- [ ] **Paso 2: Ejecutarlo y verlo fallar**

Ejecuta: `cd backend-desamparados && npx tsx --test test/bloques-catalogo.test.ts`
Esperado: FALLA con «Cannot find module '../src/domain/bloques.js'».

- [ ] **Paso 3: Crear el fichero compartido**

`shared/tipos-de-bloque.json`:

```json
{
  "_comentario": [
    "Los tipos de bloque que puede tener una página de la web pública.",
    "Lo leen los dos lados: el servidor lo usa para mapear tipo -> esquema de",
    "arktype, y la web para mapear tipo -> componente. Vive aquí y no duplicado",
    "en cada lado porque añadir un bloque en uno y olvidarlo en el otro daría un",
    "400 al guardar sin que nada avisara antes."
  ],
  "tipos": ["texto", "foto", "tarjetas"]
}
```

- [ ] **Paso 4: Escribir el dominio**

`backend-desamparados/src/domain/bloques.ts`:

```ts
import catalogo from '../../../shared/tipos-de-bloque.json' with { type: 'json' };

/**
 * Los tipos de bloque que puede tener una página de la web pública.
 *
 * La lista vive en `shared/tipos-de-bloque.json` y la leen también la web y el
 * CMS: con dos listas, añadir un bloque en un lado y olvidarlo en el otro daría
 * un 400 al guardar sin ningún aviso previo.
 */
export const TIPOS_BLOQUE = catalogo.tipos as readonly string[];

export type TipoBloque = (typeof catalogo.tipos)[number];

export const esTipoBloque = (valor: unknown): valor is TipoBloque =>
  typeof valor === 'string' && TIPOS_BLOQUE.includes(valor);
```

- [ ] **Paso 5: Ejecutar el test y verlo pasar**

Ejecuta: `cd backend-desamparados && npx tsx --test test/bloques-catalogo.test.ts`
Esperado: PASA, 3 tests.

- [ ] **Paso 6: Confirmar**

```bash
git add shared/tipos-de-bloque.json backend-desamparados/src/domain/bloques.ts backend-desamparados/test/bloques-catalogo.test.ts
git commit -m "El catálogo de tipos de bloque, en un solo sitio que leen los dos lados"
```

---

### Tarea 2: Los esquemas de los tres primeros bloques

Cada bloque valida lo suyo. Un bloque de tipo desconocido se rechaza con un 400
que lo nombra: un bloque que desaparece en silencio al guardar es peor que un
error.

**Ficheros:**
- Crear: `backend-desamparados/src/schemas/bloques.schema.ts`
- Test: `backend-desamparados/test/bloques-esquemas.test.ts`

**Interfaces:**
- Consume: `TipoBloque` de la Tarea 1.
- Produce: `esquemaDeBloque(tipo: TipoBloque)` y `cabeceraSchema`.

- [ ] **Paso 1: Escribir el test que falla**

`backend-desamparados/test/bloques-esquemas.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import { esquemaDeBloque } from '../src/schemas/bloques.schema.js';

const falla = (tipo: 'texto' | 'foto' | 'tarjetas', valor: unknown) =>
  esquemaDeBloque(tipo)(valor) instanceof ArkErrors;

describe('bloque de texto', () => {
  test('acepta el HTML que produce el editor', () => {
    assert.ok(!falla('texto', { tipo: 'texto', titulo: '', html: '<p>Hola</p><ul><li>Uno</li></ul>' }));
  });

  test('acepta un título de sección opcional', () => {
    assert.ok(!falla('texto', { tipo: 'texto', titulo: 'Explora la sección', html: '<p>Hola</p>' }));
  });

  test('rechaza un cuerpo vacío: un bloque sin nada no pinta nada', () => {
    assert.ok(falla('texto', { tipo: 'texto', titulo: '', html: '' }));
  });
});

describe('bloque de foto', () => {
  const FOTO = { tipo: 'foto', titulo: '', url: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp', alt: 'La Virgen', pie: '' };

  test('acepta una foto nuestra con su descripción', () => {
    assert.ok(!falla('foto', FOTO));
  });

  test('rechaza una foto de fuera: filtraría la IP de quien visita', () => {
    assert.ok(falla('foto', { ...FOTO, url: 'https://ejemplo.test/foto.jpg' }));
  });

  test('rechaza una foto sin descripción', () => {
    assert.ok(falla('foto', { ...FOTO, alt: '' }));
    assert.ok(falla('foto', { ...FOTO, alt: '   ' }));
  });
});

describe('bloque de tarjetas', () => {
  const TARJETA = { titulo: 'Historia', descripcion: 'Orígenes del Grupo Parroquial.', enlace: '/corporacion/historia' };
  const doc = (tarjetas: unknown[]) => ({ tipo: 'tarjetas', titulo: 'Explora la sección', tarjetas });

  test('acepta tarjetas con enlace interno', () => {
    assert.ok(!falla('tarjetas', doc([TARJETA])));
  });

  test('rechaza un enlace que se va fuera del sitio', () => {
    assert.ok(falla('tarjetas', doc([{ ...TARJETA, enlace: 'https://otro.test' }])));
    assert.ok(falla('tarjetas', doc([{ ...TARJETA, enlace: 'javascript:alert(1)' }])));
    assert.ok(falla('tarjetas', doc([{ ...TARJETA, enlace: '//otro.test' }])),
      'relativo al protocolo: parece interno y no lo es');
  });

  test('rechaza una lista vacía y una desmedida', () => {
    assert.ok(falla('tarjetas', doc([])));
    assert.ok(falla('tarjetas', doc(Array.from({ length: 13 }, () => TARJETA))));
  });
});
```

- [ ] **Paso 2: Ejecutarlo y verlo fallar**

Ejecuta: `cd backend-desamparados && npx tsx --test test/bloques-esquemas.test.ts`
Esperado: FALLA con «Cannot find module '../src/schemas/bloques.schema.js'».

- [ ] **Paso 3: Escribir los esquemas**

`backend-desamparados/src/schemas/bloques.schema.ts`:

```ts
import { type } from 'arktype';
import topes from '../../../shared/topes-contenido.json' with { type: 'json' };
import { rutaImagenPublica } from './portada.schema.js';
import type { TipoBloque } from '../domain/bloques.js';

/** Un texto visible, sin `<` ni `>`: se pinta como texto plano. */
const texto = (max: number) => type(`0 <= string <= ${max}`)
  .matching(/^[^<>]*$/)
  .describe(`un texto de hasta ${max} caracteres, sin < ni >`);

const ETIQUETA = texto(topes.etiqueta);
const TITULO = texto(topes.titulo);
const DESCRIPCION = texto(topes.descripcion);
const sinFoto = type('string').matching(/^$/);

/**
 * Enlace de una tarjeta: solo rutas de este sitio.
 *
 * Empieza por una barra y NO por dos: `//otro.test` es relativo al protocolo,
 * parece interno y lleva fuera. Tampoco `javascript:` ni ningún esquema.
 */
const enlaceInterno = type('string <= 200')
  .matching(/^\/(?!\/)[A-Za-z0-9\-._~/]*$/)
  .describe('una ruta de este sitio, como /corporacion/historia');

/**
 * El título de sección es común a todos los bloques y opcional: vacío significa
 * que el bloque no lleva encabezado. Evita tener un bloque «título suelto» que
 * se pueda quedar huérfano al reordenar.
 */
const comunes = { titulo: TITULO };

const textoSchema = type({
  ...comunes,
  tipo: "'texto'",
  // El HTML ya viene saneado por sanear-html.ts; aquí solo se exige que haya algo.
  html: type('1 <= string <= 20000'),
});

const fotoSchema = type({
  ...comunes,
  tipo: "'foto'",
  url: rutaImagenPublica,
  alt: DESCRIPCION,
  pie: ETIQUETA,
}).narrow((datos, ctx) => datos.alt.trim() !== ''
  ? true
  // Sin descripción, la foto no existe para quien use un lector de pantalla.
  : ctx.reject({ path: ['alt'], problem: 'es obligatoria: describe lo que se ve' }));

const tarjetaSchema = type({
  titulo: TITULO,
  descripcion: DESCRIPCION,
  enlace: enlaceInterno,
});

const tarjetasSchema = type({
  ...comunes,
  tipo: "'tarjetas'",
  tarjetas: tarjetaSchema.array().atLeastLength(1).atMostLength(12),
});

const POR_TIPO = { texto: textoSchema, foto: fotoSchema, tarjetas: tarjetasSchema } as const;

export const esquemaDeBloque = (tipo: TipoBloque) => POR_TIPO[tipo as keyof typeof POR_TIPO];

/** La cabecera de la página. Está siempre y no se puede quitar. */
export const cabeceraSchema = type({
  titulo: TITULO,
  subtitulo: DESCRIPCION,
  foto: sinFoto.or(rutaImagenPublica),
  fotoAlt: DESCRIPCION,
});
```

Nota: `sinFoto` se declara aquí y no se importa de `contenido.schema.ts` porque
ese fichero importará de este, y al revés sería un ciclo.

- [ ] **Paso 4: Ejecutar el test y verlo pasar**

Ejecuta: `cd backend-desamparados && npx tsx --test test/bloques-esquemas.test.ts`
Esperado: PASA, 9 tests.

- [ ] **Paso 5: Comprobar que el test caza de verdad**

Cambia a mano `enlaceInterno` por `type('string <= 200')` (sin el `matching`) y
vuelve a ejecutar: tiene que fallar «rechaza un enlace que se va fuera del
sitio». Deshaz el cambio.

Esto no es ceremonia: en la galería de vídeo un test daba por bueno el
comportamiento equivocado y la función quedó inservible.

- [ ] **Paso 6: Confirmar**

```bash
git add backend-desamparados/src/schemas/bloques.schema.ts backend-desamparados/test/bloques-esquemas.test.ts
git commit -m "Esquemas de los bloques de texto, foto y tarjetas"
```

---

### Tarea 3: El documento de página con bloques, y el slug `corporacion`

**Ficheros:**
- Modificar: `backend-desamparados/src/domain/contenido.ts`
- Modificar: `backend-desamparados/src/schemas/contenido.schema.ts`
- Modificar: `shared/contenido-por-defecto.json`
- Test: `backend-desamparados/test/pagina-bloques.test.ts`

**Interfaces:**
- Consume: `esquemaDeBloque`, `cabeceraSchema` (Tarea 2); `esTipoBloque` (Tarea 1).
- Produce: el slug `'corporacion'` dentro de `SLUGS_CONTENIDO`, y
  `esquemaDeSlug('corporacion')` validando `{ cabecera, bloques }`.

- [ ] **Paso 1: Escribir el test que falla**

`backend-desamparados/test/pagina-bloques.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import { esquemaDeSlug } from '../src/schemas/contenido.schema.js';
import { SLUGS_CONTENIDO, porDefecto } from '../src/domain/contenido.js';

const CABECERA = { titulo: 'Corporación', subtitulo: 'Grupo Parroquial.', foto: '', fotoAlt: '' };
const TEXTO = { tipo: 'texto', titulo: '', html: '<p>Hola</p>' };
const doc = (bloques: unknown[]) => ({ cabecera: CABECERA, bloques });
const valida = (valor: unknown) => esquemaDeSlug('corporacion')(valor);
const falla = (valor: unknown) => valida(valor) instanceof ArkErrors;

describe('el documento de una página de bloques', () => {
  test('el slug está declarado y trae valores de partida', () => {
    assert.ok((SLUGS_CONTENIDO as readonly string[]).includes('corporacion'));
    const defectos = porDefecto('corporacion') as { cabecera?: unknown; bloques?: unknown[] };
    assert.ok(defectos.cabecera, 'faltan los valores de partida de la cabecera');
    assert.ok(Array.isArray(defectos.bloques));
  });

  test('acepta una página con bloques', () => {
    assert.ok(!falla(doc([TEXTO])));
  });

  test('acepta una página sin bloques: se ve la cabecera y nada más', () => {
    assert.ok(!falla(doc([])));
  });

  test('rechaza un tipo de bloque que no existe, y lo nombra', () => {
    const salida = valida(doc([{ tipo: 'carrusel3d', titulo: '' }]));
    assert.ok(salida instanceof ArkErrors);
    assert.match(String(salida), /carrusel3d/, 'el error debe decir qué tipo no reconoce');
  });

  test('rechaza un bloque cuyo contenido no cuadra con su tipo', () => {
    assert.ok(falla(doc([{ tipo: 'texto', titulo: '', html: '' }])));
    assert.ok(falla(doc([{ ...TEXTO, tipo: 'foto' }])));
  });

  test('rechaza una página sin cabecera o con el título vacío por encima del tope', () => {
    assert.ok(falla({ bloques: [] }));
    assert.ok(falla({ cabecera: { ...CABECERA, titulo: 'x'.repeat(121) }, bloques: [] }));
  });

  test('rechaza una página con más bloques de los que nadie va a poner', () => {
    assert.ok(falla(doc(Array.from({ length: 41 }, () => TEXTO))));
  });
});
```

- [ ] **Paso 2: Ejecutarlo y verlo fallar**

Ejecuta: `cd backend-desamparados && npx tsx --test test/pagina-bloques.test.ts`
Esperado: FALLA en el primer test, «falta el slug corporacion» o similar.

- [ ] **Paso 3: Declarar el slug**

En `backend-desamparados/src/domain/contenido.ts`, cambia la constante:

```ts
export const SLUGS_CONTENIDO = ['portada', 'recorrido', 'historia', 'titular', 'corporacion'] as const;
```

- [ ] **Paso 4: Añadir el esquema de página de bloques**

En `backend-desamparados/src/schemas/contenido.schema.ts`, antes de la constante
`ESQUEMAS`:

```ts
import { cabeceraSchema, esquemaDeBloque } from './bloques.schema.js';
import { esTipoBloque } from '../domain/bloques.js';

/**
 * Una página compuesta de bloques.
 *
 * Los bloques se validan uno a uno con el esquema de su `tipo`, no con una unión
 * discriminada: arktype 2.1 revienta al describir el error de una unión cuyas
 * ramas llevan `narrow`, y eso sería un 500 en vez de un 400.
 *
 * Un tipo desconocido se rechaza nombrándolo. Ignorarlo en silencio haría que un
 * bloque desapareciera al guardar, que es peor que un error.
 */
const paginaDeBloquesSchema = type({
  cabecera: cabeceraSchema,
  bloques: type('unknown[]').atMostLength(40),
}).narrow((datos, ctx) => {
  for (const [indice, bloque] of datos.bloques.entries()) {
    const tipo = (bloque as { tipo?: unknown })?.tipo;
    if (!esTipoBloque(tipo)) {
      return ctx.reject({
        path: ['bloques', indice, 'tipo'],
        problem: `no es un tipo de bloque conocido: «${String(tipo)}»`,
      });
    }
    const salida = esquemaDeBloque(tipo)(bloque);
    if (salida instanceof ArkErrors) {
      return ctx.reject({ path: ['bloques', indice], problem: salida.summary });
    }
  }
  return true;
});
```

Añade `ArkErrors` al import de arktype de ese fichero
(`import { type, ArkErrors } from 'arktype';`) y mete el slug en el mapa:

```ts
const ESQUEMAS = {
  portada: portadaSchema,
  recorrido: recorridoSchema,
  historia: historiaSchema,
  titular: titularSchema,
  corporacion: paginaDeBloquesSchema,
} as const;
```

- [ ] **Paso 5: Volcar el contenido actual de Corporación**

En `shared/contenido-por-defecto.json`, añade la clave `corporacion` con el
contenido que hoy está escrito en `CorporationPage.tsx`. Cópialo literalmente
del fichero, sin reescribirlo: los tres párrafos de `Typography` y las cinco
entradas del array `sections`.

```json
"corporacion": {
  "cabecera": {
    "titulo": "Corporación",
    "subtitulo": "Grupo Parroquial de Nuestra Señora de los Desamparados.",
    "foto": "",
    "fotoAlt": ""
  },
  "bloques": [
    {
      "tipo": "texto",
      "titulo": "",
      "html": "<p>El Grupo Parroquial de Nuestra Señora de los Desamparados, Santo Cristo de la Buena Muerte y San Juan de la Palma es una corporación religiosa fundada en el seno de la Parroquia de los Padres Pasionistas de Málaga. Desde sus orígenes, el Grupo Parroquial ha vivido su fe a través de la devoción a la Santísima Virgen bajo la advocación de los Desamparados, acogiendo a cuantos buscan consuelo y esperanza.</p><p>Como Grupo Parroquial, desarrollamos una intensa labor espiritual, caritativa y formativa al servicio de la Iglesia y de la ciudad. Nuestra comunidad de hermanos y cofrades se reúne en torno a los cultos, la oración, la enseñanza de la fe y la entrega a los más necesitados, manteniendo vivas las tradiciones que nos definen.</p><p>A continuación puedes conocer más sobre nuestra historia, nuestra sede parroquial, los fines que nos mueven, los cultos que celebramos y nuestra estación de penitencia del Sábado de Pasión.</p>"
    },
    {
      "tipo": "tarjetas",
      "titulo": "Explora la sección",
      "tarjetas": [
        { "titulo": "Historia", "descripcion": "Orígenes y evolución de nuestro Grupo Parroquial.", "enlace": "/corporacion/historia" },
        { "titulo": "Parroquia", "descripcion": "Nuestra sede canónica y la comunidad pasionista.", "enlace": "/corporacion/parroquia-pasionistas" },
        { "titulo": "Nuestros fines", "descripcion": "Caridad y formación como ejes de nuestra acción.", "enlace": "/corporacion/nuestros-fines" },
        { "titulo": "Cultos", "descripcion": "Celebraciones y devociones en honor a nuestra Sagrada Titular.", "enlace": "/corporacion/cultos" },
        { "titulo": "Sábado de Pasión", "descripcion": "Nuestra salida procesional por las calles de Málaga.", "enlace": "/corporacion/sabado-de-pasion" }
      ]
    }
  ]
}
```

- [ ] **Paso 6: Ejecutar el test y verlo pasar**

Ejecuta: `cd backend-desamparados && npx tsx --test test/pagina-bloques.test.ts`
Esperado: PASA, 7 tests.

- [ ] **Paso 7: Ajustar el test de la siembra**

`test/contenido-api.test.ts` comprueba que la siembra deja exactamente cuatro
páginas. Ahora son cinco. Actualiza el nombre del test, la lista de slugs
esperada (orden alfabético: `corporacion`, `historia`, `portada`, `recorrido`,
`titular`) y los índices que use después.

- [ ] **Paso 8: Ejecutar la suite entera**

Ejecuta: `cd backend-desamparados && npm test`
Esperado: todo en verde, 0 omitidos. Si sale «skipped», arranca MariaDB:
`docker start desamparados-mariadb`.

- [ ] **Paso 9: Confirmar**

```bash
git add shared/contenido-por-defecto.json backend-desamparados/src backend-desamparados/test
git commit -m "Corporación pasa a ser una página de bloques en el servidor"
```

---

### Tarea 4: Los bloques en la web pública

**Ficheros:**
- Crear: `desamparados-web/src/components/bloques/BloqueTexto.tsx`
- Crear: `desamparados-web/src/components/bloques/BloqueFoto.tsx`
- Crear: `desamparados-web/src/components/bloques/BloqueTarjetas.tsx`
- Crear: `desamparados-web/src/components/bloques/registro.tsx`
- Crear: `desamparados-web/src/components/bloques/BloquesDePagina.tsx`
- Modificar: `desamparados-web/src/lib/api/contenido.ts`
- Test: `desamparados-web/src/components/bloques/__tests__/BloquesDePagina.test.tsx`

**Interfaces:**
- Consume: `shared/tipos-de-bloque.json` (Tarea 1).
- Produce: `type Bloque`, `type PaginaDeBloques`, `<BloquesDePagina bloques={…} />`,
  y `REGISTRO_BLOQUES: Record<TipoBloque, ComponentType<{ bloque: Bloque }>>`.

- [ ] **Paso 1: Escribir el test que falla**

`desamparados-web/src/components/bloques/__tests__/BloquesDePagina.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloquesDePagina from '../BloquesDePagina'
import { REGISTRO_BLOQUES } from '../registro'
import TIPOS from '../../../../../shared/tipos-de-bloque.json'
import type { Bloque } from '../../../lib/api/contenido'

const TEXTO: Bloque = { tipo: 'texto', titulo: '', html: '<p>Un párrafo</p>' }
const FOTO: Bloque = { tipo: 'foto', titulo: '', url: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp', alt: 'La Virgen', pie: 'Camarín' }
const TARJETAS: Bloque = {
  tipo: 'tarjetas', titulo: 'Explora la sección',
  tarjetas: [{ titulo: 'Historia', descripcion: 'Orígenes.', enlace: '/corporacion/historia' }],
}

describe('BloquesDePagina', () => {
  it('el registro cubre todos los tipos del catálogo compartido', () => {
    // Si alguien añade un tipo en shared/ y olvida su componente, la página
    // dejaría un hueco en blanco sin que nada fallara.
    for (const tipo of TIPOS.tipos) {
      expect(REGISTRO_BLOQUES[tipo as keyof typeof REGISTRO_BLOQUES], `falta el componente de «${tipo}»`).toBeDefined()
    }
  })

  it('pinta los bloques en el orden en que vienen', () => {
    renderWithProviders(<BloquesDePagina bloques={[TARJETAS, TEXTO]} />)
    const textos = screen.getAllByText(/Explora la sección|Un párrafo/)
    expect(textos[0].textContent).toContain('Explora la sección')
  })

  it('el bloque de texto pinta el HTML maquetado, no como etiquetas', () => {
    const { container } = renderWithProviders(<BloquesDePagina bloques={[TEXTO]} />)
    expect(container.querySelector('p')?.textContent).toBe('Un párrafo')
    expect(container.textContent).not.toContain('<p>')
  })

  it('la foto lleva su descripción y su pie', () => {
    renderWithProviders(<BloquesDePagina bloques={[FOTO]} />)
    expect(screen.getByAltText('La Virgen')).toBeInTheDocument()
    expect(screen.getByText('Camarín')).toBeInTheDocument()
  })

  it('las tarjetas enlazan donde dicen', () => {
    renderWithProviders(<BloquesDePagina bloques={[TARJETAS]} />)
    expect(screen.getByRole('link', { name: /Historia/ })).toHaveAttribute('href', '/corporacion/historia')
  })

  it('una página sin bloques no revienta', () => {
    const { container } = renderWithProviders(<BloquesDePagina bloques={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('un tipo desconocido se salta sin tirar la página', () => {
    // El servidor ya lo rechaza al guardar; esto es la segunda red, para un
    // documento viejo en la base tras quitar un tipo del catálogo.
    const raro = { tipo: 'loQueSea', titulo: '' } as unknown as Bloque
    renderWithProviders(<BloquesDePagina bloques={[raro, TEXTO]} />)
    expect(screen.getByText('Un párrafo')).toBeInTheDocument()
  })
})
```

- [ ] **Paso 2: Ejecutarlo y verlo fallar**

Ejecuta: `cd desamparados-web && npx vitest run src/components/bloques/__tests__/BloquesDePagina.test.tsx`
Esperado: FALLA al no resolver `../BloquesDePagina`.

- [ ] **Paso 3: Añadir los tipos al cliente de la API**

En `desamparados-web/src/lib/api/contenido.ts`:

```ts
export type SlugContenido = 'portada' | 'recorrido' | 'historia' | 'titular' | 'corporacion'

export interface BloqueBase { tipo: string; titulo: string }
export interface BloqueTexto extends BloqueBase { tipo: 'texto'; html: string }
export interface BloqueFoto extends BloqueBase { tipo: 'foto'; url: string; alt: string; pie: string }
export interface TarjetaEnlace { titulo: string; descripcion: string; enlace: string }
export interface BloqueTarjetas extends BloqueBase { tipo: 'tarjetas'; tarjetas: TarjetaEnlace[] }

export type Bloque = BloqueTexto | BloqueFoto | BloqueTarjetas

export interface CabeceraPagina { titulo: string; subtitulo: string; foto: string; fotoAlt: string }
export interface PaginaDeBloques { cabecera: CabeceraPagina; bloques: Bloque[] }

export const CLAVE_CORPORACION = ['contenido', 'corporacion'] as const
```

- [ ] **Paso 4: Escribir los tres componentes**

`BloqueTexto.tsx` — usa el saneado que ya existe, que es la segunda barrera
después de la del servidor:

```tsx
import { Box } from '@mui/material'
import { sanitizeHtml } from '../../lib/sanitizeHtml'
import type { BloqueTexto as Datos } from '../../lib/api/contenido'

/** Cuerpo de texto con formato. El HTML llega saneado del servidor y se vuelve
 *  a sanear aquí: son dos barreras a propósito, como en las noticias. */
export default function BloqueTexto({ bloque }: { bloque: Datos }) {
  return (
    <Box
      sx={{
        maxWidth: '850px', mx: 'auto', color: 'text.secondary', lineHeight: 1.8,
        '& p': { mb: 3 }, '& h2, & h3': { color: 'text.primary', mt: 4, mb: 2 },
        '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1 },
      }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(bloque.html) }}
    />
  )
}
```

`BloqueFoto.tsx`:

```tsx
import { Box, Typography } from '@mui/material'
import type { BloqueFoto as Datos } from '../../lib/api/contenido'

export default function BloqueFoto({ bloque }: { bloque: Datos }) {
  return (
    <Box sx={{ maxWidth: '1000px', mx: 'auto' }}>
      <Box component="img" src={bloque.url} alt={bloque.alt} loading="lazy" decoding="async"
        sx={{ width: '100%', height: 'auto', borderRadius: 2, display: 'block' }} />
      {bloque.pie && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5, textAlign: 'center' }}>
          {bloque.pie}
        </Typography>
      )}
    </Box>
  )
}
```

`BloqueTarjetas.tsx` — el mismo marcado que hoy tiene `CorporationPage`, para
que la página no cambie de aspecto al convertirla:

```tsx
import { Box, Grid, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import GlassCard from '../GlassCard'
import type { BloqueTarjetas as Datos } from '../../lib/api/contenido'

export default function BloqueTarjetas({ bloque }: { bloque: Datos }) {
  return (
    <Grid container spacing={3}>
      {bloque.tarjetas.map((tarjeta) => (
        <Grid key={tarjeta.enlace} size={{ xs: 12, md: 6, lg: 4 }}>
          <Box component={Link} to={tarjeta.enlace} sx={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <GlassCard sx={{ p: 4, '&:hover': { borderColor: 'rgba(193, 172, 0, 0.3)', transform: 'translateY(-4px)' } }}>
              <Typography variant="h6" component="h3" sx={{ mb: 1, color: 'text.primary' }}>{tarjeta.titulo}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{tarjeta.descripcion}</Typography>
            </GlassCard>
          </Box>
        </Grid>
      ))}
    </Grid>
  )
}
```

- [ ] **Paso 5: Escribir el registro y el compositor**

`registro.tsx`:

```tsx
import type { ComponentType } from 'react'
import BloqueTexto from './BloqueTexto'
import BloqueFoto from './BloqueFoto'
import BloqueTarjetas from './BloqueTarjetas'
import type { Bloque } from '../../lib/api/contenido'

/**
 * Qué componente pinta cada tipo de bloque.
 *
 * Los tipos salen de `shared/tipos-de-bloque.json`, que comparten el servidor y
 * la web. El test de este directorio comprueba que aquí está declarado cada uno
 * de los tipos de esa lista: sin él, añadir un bloque en el servidor y olvidar
 * su componente dejaría un hueco en blanco en la página sin que nada fallara.
 */
export const REGISTRO_BLOQUES: Record<string, ComponentType<{ bloque: never }>> = {
  texto: BloqueTexto as ComponentType<{ bloque: never }>,
  foto: BloqueFoto as ComponentType<{ bloque: never }>,
  tarjetas: BloqueTarjetas as ComponentType<{ bloque: never }>,
}

export const componenteDeBloque = (bloque: Bloque) => REGISTRO_BLOQUES[bloque.tipo]
```

`BloquesDePagina.tsx`:

```tsx
import { Box, Stack } from '@mui/material'
import SectionTitle from '../SectionTitle'
import { componenteDeBloque } from './registro'
import type { Bloque } from '../../lib/api/contenido'

/**
 * Pinta los bloques de una página en su orden.
 *
 * Un tipo que no esté en el registro se salta en vez de tirar la página entera:
 * el servidor ya lo rechaza al guardar, pero un documento guardado antes de
 * retirar un tipo del catálogo seguiría en la base.
 */
export default function BloquesDePagina({ bloques }: { bloques: Bloque[] }) {
  if (bloques.length === 0) return null

  return (
    <Stack spacing={{ xs: 5, md: 8 }}>
      {bloques.map((bloque, indice) => {
        const Componente = componenteDeBloque(bloque)
        if (!Componente) return null
        return (
          <Box key={`${bloque.tipo}-${indice}`}>
            {bloque.titulo && <SectionTitle title={bloque.titulo} centered />}
            <Componente bloque={bloque as never} />
          </Box>
        )
      })}
    </Stack>
  )
}
```

- [ ] **Paso 6: Ejecutar el test y verlo pasar**

Ejecuta: `cd desamparados-web && npx vitest run src/components/bloques/__tests__/BloquesDePagina.test.tsx`
Esperado: PASA, 7 tests.

- [ ] **Paso 7: Confirmar**

```bash
git add desamparados-web/src/components/bloques desamparados-web/src/lib/api/contenido.ts
git commit -m "Los bloques de texto, foto y tarjetas en la web pública"
```

---

### Tarea 5: Corporación se pinta desde el CMS

La tarea con más riesgo de todas: aquí es donde se puede perder contenido.

**Ficheros:**
- Modificar: `desamparados-web/src/features/corporation/CorporationPage.tsx`
- Test: `desamparados-web/src/features/corporation/__tests__/CorporationPage.test.tsx`

**Interfaces:**
- Consume: `BloquesDePagina` (Tarea 4), `PaginaDeBloques`, `CLAVE_CORPORACION`.

- [ ] **Paso 1: Escribir el test de migración, que es el que importa**

`desamparados-web/src/features/corporation/__tests__/CorporationPage.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import CorporationPage from '../CorporationPage'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'

/**
 * Lo que esta página decía ANTES de convertirla, copiado a mano del .tsx
 * original. Si la migración se come un párrafo, este test lo caza.
 */
const ANTES = [
  'El Grupo Parroquial de Nuestra Señora de los Desamparados',
  'Como Grupo Parroquial, desarrollamos una intensa labor espiritual',
  'A continuación puedes conocer más sobre nuestra historia',
  'Explora la sección',
  'Historia', 'Parroquia', 'Nuestros fines', 'Cultos', 'Sábado de Pasión',
]

afterEach(() => { vi.unstubAllGlobals() })

function responder(datos: unknown = POR_DEFECTO.corporacion) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } },
  ))))
}

describe('CorporationPage', () => {
  it('sigue diciendo lo mismo que antes de convertirla a bloques', async () => {
    responder()
    renderWithProviders(<CorporationPage />)

    await screen.findByText(/El Grupo Parroquial de Nuestra Señora/)
    const visible = document.body.textContent ?? ''
    for (const fragmento of ANTES) {
      expect(visible, `se ha perdido: «${fragmento}»`).toContain(fragmento)
    }
  })

  it('los enlaces de las tarjetas llevan a donde llevaban', async () => {
    responder()
    renderWithProviders(<CorporationPage />)

    expect(await screen.findByRole('link', { name: /Historia/ })).toHaveAttribute('href', '/corporacion/historia')
    expect(screen.getByRole('link', { name: /Sábado de Pasión/ })).toHaveAttribute('href', '/corporacion/sabado-de-pasion')
  })

  it('si el servidor no responde, la página no se queda en blanco', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')))
    renderWithProviders(<CorporationPage />)

    // La cabecera es lo mínimo que tiene que quedar en pie.
    expect(await screen.findByRole('heading', { name: 'Corporación' })).toBeInTheDocument()
  })
})
```

- [ ] **Paso 2: Ejecutarlo y verlo fallar**

Ejecuta: `cd desamparados-web && npx vitest run src/features/corporation/__tests__/CorporationPage.test.tsx`
Esperado: FALLA — la página de hoy no llama al servidor, así que
`POR_DEFECTO.corporacion` no existe todavía en el JSON o el test no encuentra
los textos por no estar montado el `fetch`.

- [ ] **Paso 3: Reescribir la página**

```tsx
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import AnimatedSection from '../../components/AnimatedSection'
import BloquesDePagina from '../../components/bloques/BloquesDePagina'
import POR_DEFECTO from '../../../../shared/contenido-por-defecto.json'
import { CLAVE_CORPORACION, getContenido, type PaginaDeBloques } from '../../lib/api/contenido'

const DE_PARTIDA = POR_DEFECTO.corporacion as unknown as PaginaDeBloques

export default function CorporationPage() {
  // Con `initialData`, si el servidor tarda o falla la página no se queda en
  // blanco: enseña el contenido de partida y lo sustituye cuando llega el suyo.
  const { data } = useQuery({
    queryKey: CLAVE_CORPORACION,
    queryFn: () => getContenido<PaginaDeBloques>('corporacion'),
    initialData: DE_PARTIDA,
  })

  return (
    <>
      <Helmet><title>Corporación | Desamparados</title></Helmet>
      <PageHeader title={data.cabecera.titulo} subtitle={data.cabecera.subtitulo} image={data.cabecera.foto || undefined} />
      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <BloquesDePagina bloques={data.bloques} />
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
```

- [ ] **Paso 4: Ejecutar el test y verlo pasar**

Ejecuta: `cd desamparados-web && npx vitest run src/features/corporation/__tests__/CorporationPage.test.tsx`
Esperado: PASA, 3 tests. Si falla el primero, el fragmento que falta te dice qué
se perdió al volcar el contenido.

- [ ] **Paso 5: Ejecutar la suite entera y el typecheck**

Ejecuta: `cd desamparados-web && npx tsc -b && npm test`
Esperado: todo en verde.

- [ ] **Paso 6: Confirmar**

```bash
git add desamparados-web/src/features/corporation
git commit -m "Corporación se pinta con los bloques que sirve el CMS"
```

---

### Tarea 6: La pantalla de edición de bloques en el CMS

**Ficheros:**
- Crear: `desamparados-web/src/features/cms/bloques/EditorDeBloques.tsx`
- Crear: `desamparados-web/src/features/cms/bloques/formularios.tsx`
- Crear: `desamparados-web/src/features/cms/PaginaAdminPage.tsx`
- Modificar: `desamparados-web/src/routes/index.tsx`
- Modificar: `desamparados-web/src/app/cmsNavegacion.ts`
- Test: `desamparados-web/src/features/cms/__tests__/PaginaAdminPage.test.tsx`

**Interfaces:**
- Consume: `Bloque`, `PaginaDeBloques`, `guardarContenido` (Tarea 4).
- Produce: la ruta `/cms/paginas/corporacion` y el grupo de menú «Web pública».

- [ ] **Paso 1: Escribir el test que falla**

`desamparados-web/src/features/cms/__tests__/PaginaAdminPage.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import PaginaAdminPage from '../PaginaAdminPage'

const contenido = {
  cabecera: { titulo: 'Corporación', subtitulo: 'Grupo Parroquial.', foto: '', fotoAlt: '' },
  bloques: [
    { tipo: 'texto', titulo: '', html: '<p>Un párrafo</p>' },
    { tipo: 'tarjetas', titulo: 'Explora la sección', tarjetas: [{ titulo: 'Historia', descripcion: 'Orígenes.', enlace: '/corporacion/historia' }] },
  ],
}

afterEach(() => { vi.unstubAllGlobals() })

/** PantallaEdicion usa useBlocker, que exige un data router. */
function montar() {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    llamadas.push({ url, metodo: init?.method ?? 'GET', cuerpo: init?.body ? JSON.parse(String(init.body)) : null })
    return Promise.resolve(new Response(
      JSON.stringify(init?.method === 'PUT' ? { message: 'Guardado', data: contenido } : contenido),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
  }))
  const router = createMemoryRouter(
    [{ path: '/cms', element: <h1>Panel</h1> }, { path: '/cms/paginas/:slug', element: <PaginaAdminPage /> }],
    { initialEntries: ['/cms/paginas/corporacion'] },
  )
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )
  return llamadas
}

const guardar = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Guardar' }))
  await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
}

describe('PaginaAdminPage', () => {
  it('carga la cabecera y los bloques que ya hay', async () => {
    montar()
    expect(await screen.findByDisplayValue('Corporación')).toBeInTheDocument()
    expect(screen.getByText(/Texto/)).toBeInTheDocument()
    expect(screen.getByText(/Tarjetas/)).toBeInTheDocument()
  })

  it('la cabecera no se puede quitar', async () => {
    montar()
    await screen.findByDisplayValue('Corporación')
    const cabecera = screen.getByDisplayValue('Corporación').closest('.MuiPaper-root') as HTMLElement
    expect(within(cabecera).queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument()
  })

  it('se añade un bloque eligiendo su tipo', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByDisplayValue('Corporación')

    await user.click(screen.getByRole('button', { name: /añadir bloque/i }))
    await user.click(await screen.findByRole('menuitem', { name: /foto/i }))

    expect(await screen.findByText(/Posición 3 de 3/)).toBeInTheDocument()
  })

  it('se quita un bloque', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByDisplayValue('Corporación')

    await user.click(screen.getByRole('button', { name: /quitar el bloque 1/i }))

    expect(screen.queryByText(/Posición 2 de 2/)).not.toBeInTheDocument()
  })

  it('se reordena y se guarda en el orden nuevo', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await screen.findByDisplayValue('Corporación')

    await user.click(screen.getByRole('button', { name: /bajar el bloque 1/i }))
    await guardar(user)

    await waitFor(() => {
      const envio = llamadas.find((l) => l.metodo === 'PUT')
      expect(envio!.url).toContain('/contenido/corporacion')
      const bloques = (envio!.cuerpo as { datos: { bloques: { tipo: string }[] } }).datos.bloques
      expect(bloques.map((b) => b.tipo)).toEqual(['tarjetas', 'texto'])
    })
  })

  it('avisa si la cabecera se queda sin título, y no manda nada', async () => {
    const user = userEvent.setup()
    const llamadas = montar()
    await user.clear(await screen.findByDisplayValue('Corporación'))
    await guardar(user)

    expect(await screen.findByText(/sin título/i)).toBeInTheDocument()
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false)
  })
})
```

- [ ] **Paso 2: Ejecutarlo y verlo fallar**

Ejecuta: `cd desamparados-web && npx vitest run src/features/cms/__tests__/PaginaAdminPage.test.tsx`
Esperado: FALLA al no resolver `../PaginaAdminPage`.

- [ ] **Paso 3: Escribir los formularios de cada bloque**

`desamparados-web/src/features/cms/bloques/formularios.tsx` — el espejo en el
CMS del registro de la web. Cada tipo declara su nombre visible y su formulario:

```tsx
import type { ComponentType } from 'react'
import { Stack, TextField } from '@mui/material'
import topes from '../../../../../shared/topes-contenido.json'
import EditorTexto from '../EditorTexto'
import CampoImagen from '../CampoImagen'
import CampoTexto from '../contenido/CampoTexto'
import type { BloqueTexto, BloqueFoto, BloqueTarjetas } from '../../../lib/api/contenido'

type Props<T> = { bloque: T; onCambio: (cambios: Partial<T>) => void }

function FormularioTexto({ bloque, onCambio }: Props<BloqueTexto>) {
  return (
    <EditorTexto
      valor={bloque.html}
      onCambio={(html) => onCambio({ html })}
      etiqueta="Contenido del bloque"
    />
  )
}

function FormularioFoto({ bloque, onCambio }: Props<BloqueFoto>) {
  return (
    <Stack spacing={2}>
      <CampoImagen
        valor={bloque.url}
        onCambio={(url) => onCambio({ url })}
        etiqueta="Foto"
        ayuda="JPG, PNG o WebP apaisado, de hasta 5 MB."
        apaisada
      />
      <CampoTexto
        etiqueta="Descripción"
        valor={bloque.alt}
        onCambio={(alt) => onCambio({ alt })}
        ayuda="Lo que se ve, en una frase. Es lo que oye quien usa un lector de pantalla."
        maxLength={topes.descripcion}
      />
      <CampoTexto
        etiqueta="Pie (opcional)"
        valor={bloque.pie}
        onCambio={(pie) => onCambio({ pie })}
        ayuda="Frase corta bajo la foto. Se puede dejar vacía."
        maxLength={topes.etiqueta}
      />
    </Stack>
  )
}

function FormularioTarjetas({ bloque, onCambio }: Props<BloqueTarjetas>) {
  const cambiar = (indice: number, campo: 'titulo' | 'descripcion' | 'enlace', valor: string) =>
    onCambio({ tarjetas: bloque.tarjetas.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)) })

  return (
    <Stack spacing={2}>
      {bloque.tarjetas.map((tarjeta, indice) => (
        <Stack key={indice} spacing={1.5} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <TextField label={`Título de la tarjeta ${indice + 1}`} value={tarjeta.titulo}
            onChange={(e) => cambiar(indice, 'titulo', e.target.value)} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.titulo } }} />
          <TextField label="Descripción" value={tarjeta.descripcion}
            onChange={(e) => cambiar(indice, 'descripcion', e.target.value)} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.descripcion } }} />
          <TextField label="Enlace" value={tarjeta.enlace}
            onChange={(e) => cambiar(indice, 'enlace', e.target.value)} size="small" fullWidth
            helperText="Una ruta de este sitio, como /corporacion/historia" />
        </Stack>
      ))}
    </Stack>
  )
}

/** Nombre visible de cada tipo. Es lo que lee quien edita. */
export const NOMBRE_BLOQUE: Record<string, string> = {
  texto: 'Texto',
  foto: 'Foto',
  tarjetas: 'Tarjetas',
}

export const FORMULARIOS: Record<string, ComponentType<Props<never>>> = {
  texto: FormularioTexto as ComponentType<Props<never>>,
  foto: FormularioFoto as ComponentType<Props<never>>,
  tarjetas: FormularioTarjetas as ComponentType<Props<never>>,
}

/** Un bloque recién añadido, con sus campos vacíos. */
export const BLOQUE_NUEVO: Record<string, object> = {
  texto: { tipo: 'texto', titulo: '', html: '' },
  foto: { tipo: 'foto', titulo: '', url: '', alt: '', pie: '' },
  tarjetas: { tipo: 'tarjetas', titulo: '', tarjetas: [{ titulo: '', descripcion: '', enlace: '/' }] },
}
```

- [ ] **Paso 4: Escribir el editor de la lista**

`desamparados-web/src/features/cms/bloques/EditorDeBloques.tsx`:

```tsx
import { useState } from 'react'
import {
  Accordion, AccordionDetails, AccordionSummary, Button, Chip, IconButton,
  Menu, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import topes from '../../../../../shared/topes-contenido.json'
import TIPOS from '../../../../../shared/tipos-de-bloque.json'
import { BLOQUE_NUEVO, FORMULARIOS, NOMBRE_BLOQUE } from './formularios'
import type { Bloque } from '../../../lib/api/contenido'

/** La clave la pone el CMS para que React siga la fila al reordenarla. */
export interface Fila { bloque: Bloque; clave: number }

let ultimaClave = 0
export const conClave = (bloque: Bloque): Fila => ({ bloque, clave: ++ultimaClave })
export const sinClave = (filas: Fila[]): Bloque[] => filas.map((f) => f.bloque)

export default function EditorDeBloques({ filas, onCambio }: {
  filas: Fila[]
  onCambio: (filas: Fila[]) => void
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null)

  const cambiar = (clave: number, cambios: object) =>
    onCambio(filas.map((f) => (f.clave === clave ? { ...f, bloque: { ...f.bloque, ...cambios } as Bloque } : f)))

  const quitar = (clave: number) => onCambio(filas.filter((f) => f.clave !== clave))

  const mover = (indice: number, salto: -1 | 1) => {
    const destino = indice + salto
    if (destino < 0 || destino >= filas.length) return
    const copia = [...filas]
    copia[indice] = filas[destino]
    copia[destino] = filas[indice]
    onCambio(copia)
  }

  const anadir = (tipo: string) => {
    setMenu(null)
    onCambio([...filas, conClave(BLOQUE_NUEVO[tipo] as Bloque)])
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center' }}>
        <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
          Bloques ({filas.length})
        </Typography>
        <Button startIcon={<AddIcon />} onClick={(e) => setMenu(e.currentTarget)}>Añadir bloque</Button>
        <Menu open={menu !== null} anchorEl={menu} onClose={() => setMenu(null)}>
          {TIPOS.tipos.map((tipo) => (
            <MenuItem key={tipo} onClick={() => anadir(tipo)}>{NOMBRE_BLOQUE[tipo] ?? tipo}</MenuItem>
          ))}
        </Menu>
      </Stack>

      {filas.map(({ bloque, clave }, indice) => {
        const Formulario = FORMULARIOS[bloque.tipo]
        return (
          <Accordion key={clave} defaultExpanded={false} disableGutters variant="outlined">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexGrow: 1, pr: 1 }}>
                <Chip size="small" label={NOMBRE_BLOQUE[bloque.tipo] ?? bloque.tipo} />
                <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                  {bloque.titulo || `Posición ${indice + 1} de ${filas.length}`}
                </Typography>
              </Stack>
              {/* Dentro del resumen, pero fuera del botón que pliega: los
                  controles no deben abrir y cerrar el bloque al pulsarlos. */}
              <Stack direction="row" onClick={(e) => e.stopPropagation()}>
                <Tooltip title="Subir"><span>
                  <IconButton size="small" aria-label={`Subir el bloque ${indice + 1}`}
                    disabled={indice === 0} onClick={() => mover(indice, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
                </span></Tooltip>
                <Tooltip title="Bajar"><span>
                  <IconButton size="small" aria-label={`Bajar el bloque ${indice + 1}`}
                    disabled={indice === filas.length - 1} onClick={() => mover(indice, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
                </span></Tooltip>
                <Tooltip title="Quitar">
                  <IconButton size="small" color="error" aria-label={`Quitar el bloque ${indice + 1}`}
                    onClick={() => quitar(clave)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <TextField
                  label="Título de sección (opcional)"
                  value={bloque.titulo}
                  onChange={(e) => cambiar(clave, { titulo: e.target.value })}
                  size="small" fullWidth
                  helperText="Encabezado encima del bloque. Vacío, el bloque va sin título."
                  slotProps={{ htmlInput: { maxLength: topes.titulo } }}
                />
                {Formulario
                  ? <Formulario bloque={bloque as never} onCambio={(cambios: object) => cambiar(clave, cambios)} />
                  : <Typography color="error">Este bloque es de un tipo que ya no existe: quítalo.</Typography>}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )
      })}
    </Stack>
  )
}
```

- [ ] **Paso 5: Escribir la pantalla**

`desamparados-web/src/features/cms/PaginaAdminPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Alert, Button, CircularProgress, Paper, Stack } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Helmet } from 'react-helmet-async'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import topes from '../../../../shared/topes-contenido.json'
import PantallaEdicion from './PantallaEdicion'
import CampoImagen from './CampoImagen'
import CampoTexto from './contenido/CampoTexto'
import SeccionPlegable from './contenido/SeccionPlegable'
import EditorDeBloques, { conClave, sinClave, type Fila } from './bloques/EditorDeBloques'
import { RUTA_PUBLICA } from '../../app/cmsNavegacion'
import {
  getContenido, guardarContenido,
  type CabeceraPagina, type PaginaDeBloques, type SlugContenido,
} from '../../lib/api/contenido'

export const AVISO_SIN_TITULO = 'La página se ha quedado sin título. Ponle uno antes de guardar.'

export default function PaginaAdminPage() {
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const [cabecera, setCabecera] = useState<CabeceraPagina | null>(null)
  const [filas, setFilas] = useState<Fila[]>([])
  const [inicial, setInicial] = useState<PaginaDeBloques | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getContenido<PaginaDeBloques>(slug as SlugContenido)
      .then(({ cabecera: c, bloques }) => {
        setCabecera(c)
        setFilas(bloques.map(conClave))
        setInicial({ cabecera: c, bloques })
      })
      .catch(() => setError('No se ha podido cargar la página.'))
  }, [slug])

  const guardar = async () => {
    if (!cabecera) return
    // El servidor también lo rechaza; mejor no mandarlo y decirlo aquí arriba.
    if (cabecera.titulo.trim() === '') { setError(AVISO_SIN_TITULO); return }

    const datos: PaginaDeBloques = { cabecera, bloques: sinClave(filas) }
    if (JSON.stringify(datos) === JSON.stringify(inicial)) return
    setGuardando(true); setError(null)
    try {
      await guardarContenido(slug as SlugContenido, datos)
      setInicial(datos)
      void queryClient.invalidateQueries({ queryKey: ['contenido', slug] })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar la página.')
    } finally { setGuardando(false) }
  }

  if (error && !cabecera) return <Alert severity="error">{error}</Alert>
  if (!cabecera) return <CircularProgress aria-label="Cargando la página" />

  const documento: PaginaDeBloques = { cabecera, bloques: sinClave(filas) }

  return (
    <>
      <Helmet><title>{cabecera.titulo} | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      <PantallaEdicion
        titulo={cabecera.titulo || 'Página'}
        nombre="Página de la web pública"
        sucio={JSON.stringify(documento) !== JSON.stringify(inicial)}
        guardando={guardando}
        volverA="/cms"
        onGuardar={guardar}
      >
        <Stack spacing={3}>
          <Button component="a" href={RUTA_PUBLICA[slug] ?? '/'} target="_blank" rel="noopener noreferrer"
            startIcon={<OpenInNewIcon />} sx={{ alignSelf: 'flex-start' }}>
            Vista previa
          </Button>

          {/* La cabecera va aparte y sin botón de quitar: está siempre. */}
          <Paper sx={{ p: 2.5 }}>
            <SeccionPlegable titulo="Cabecera de la página" abiertaPorDefecto>
              <CampoTexto etiqueta="Título" valor={cabecera.titulo}
                onCambio={(titulo) => setCabecera({ ...cabecera, titulo })}
                ayuda="Encabezado grande de la página, arriba del todo." maxLength={topes.titulo} />
              <CampoTexto etiqueta="Subtítulo" valor={cabecera.subtitulo}
                onCambio={(subtitulo) => setCabecera({ ...cabecera, subtitulo })}
                ayuda="Frase bajo el título." maxLength={topes.descripcion} />
              <CampoImagen valor={cabecera.foto} onCambio={(foto) => setCabecera({ ...cabecera, foto })}
                etiqueta="Foto de la cabecera"
                ayuda="Opcional. Sin foto, la cabecera queda lisa." apaisada />
              <CampoTexto etiqueta="Descripción de la foto" valor={cabecera.fotoAlt}
                onCambio={(fotoAlt) => setCabecera({ ...cabecera, fotoAlt })}
                ayuda="Lo que se ve en la foto. Déjala vacía si no hay foto." maxLength={topes.descripcion} />
            </SeccionPlegable>
          </Paper>

          <EditorDeBloques filas={filas} onCambio={setFilas} />
        </Stack>
      </PantallaEdicion>
    </>
  )
}
```

- [ ] **Paso 6: Escribir también el test de la vista previa**

Añádelo al fichero de test de esta tarea:

```tsx
it('la vista previa abre la página pública en otra pestaña', async () => {
  montar()
  await screen.findByDisplayValue('Corporación')

  const previa = screen.getByRole('link', { name: /vista previa/i })
  expect(previa).toHaveAttribute('href', '/corporacion')
  expect(previa).toHaveAttribute('target', '_blank')
  expect(previa).toHaveAttribute('rel', expect.stringContaining('noopener'))
})
```

Se abre la página publicada, no una simulación: enseña lo último guardado, que
es exactamente lo que verá el visitante.

- [ ] **Paso 7: Registrar la ruta, el menú y la ruta pública**

En `cmsNavegacion.ts`, añade el grupo nuevo y la entrada. Esto es lo que el
usuario pidió como «apartado propio y sus subapartados»:

```ts
export const GRUPOS = ['Hoy', 'Web pública', 'Contenido', 'Censo y enseres', 'Cuentas', 'Sistema'] as const
```

```ts
{ label: 'Corporación', href: '/cms/paginas/corporacion', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Web pública', icono: WebOutlinedIcon },
```

y en `rolesPorRutaCms`:

```ts
'paginas/corporacion': ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
```

Y el mapa que usa la vista previa para saber dónde vive cada página en la web:

```ts
/** Dónde vive en la web pública cada página editable. */
export const RUTA_PUBLICA: Record<string, string> = {
  corporacion: '/corporacion',
}
```

Comprueba cómo deriva `AdminLayout.test.tsx` la clave desde el `href`: si no
admite barras, ajusta ese cálculo en el test y en la guarda de ruta a la vez.

En `routes/index.tsx`:

```tsx
const PaginaAdminPage = lazy(() => import('../features/cms/PaginaAdminPage'))
```

```tsx
{ path: 'paginas/:slug', element: <RequireRole roles={rolesPorRutaCms['paginas/corporacion']}>{withSuspense(PaginaAdminPage)}</RequireRole> },
```

- [ ] **Paso 8: Ejecutar los tests y verlos pasar**

Ejecuta: `cd desamparados-web && npx vitest run src/features/cms/__tests__/PaginaAdminPage.test.tsx src/app/__tests__/AdminLayout.test.tsx`
Esperado: PASA todo, incluido el test que compara el menú con las guardas.

- [ ] **Paso 9: Confirmar**

```bash
git add desamparados-web/src/features/cms desamparados-web/src/routes desamparados-web/src/app
git commit -m "Editar la página de Corporación por bloques desde el CMS"
```

---

### Tarea 7: Comprobarlo con la aplicación en marcha

No es opcional. Con las suites enteras en verde, la galería de vídeo estaba rota
porque el servidor rechazaba justo lo que el CMS pedía pegar. Los tests no lo
vieron; arrancar la aplicación, sí.

- [ ] **Paso 1: Levantar todo**

```bash
docker start desamparados-mariadb
cd backend-desamparados && npm run seed && npm run dev
cd desamparados-web && npm run dev -- --port 5173 --strictPort
```

- [ ] **Paso 2: Recorrer el flujo como lo hará el cliente**

1. Entra al CMS y abre **Web pública → Corporación**.
2. Cambia un párrafo del bloque de texto y guarda.
3. Abre la vista previa y comprueba que el cambio está.
4. Añade un bloque de foto, súbele una imagen, ponle descripción y guarda.
5. Reordénalo y guarda.
6. Quita el bloque y guarda.
7. Vacía el título de la cabecera e intenta guardar: tiene que avisar y no
   mandar nada.

- [ ] **Paso 3: Mirar la consola del navegador**

No puede haber ni un error. Un `<div>` dentro de un `<p>` solo se ve aquí.

- [ ] **Paso 4: Comprobar que la página pública quedó igual**

Abre `/corporacion` y compárala con una captura anterior a la conversión. Los
tres párrafos, el título «Explora la sección» y las cinco tarjetas tienen que
estar, con el mismo aspecto.

- [ ] **Paso 5: Dejar la base como estaba**

Si has dejado bloques de prueba, quítalos desde el CMS.

- [ ] **Paso 6: Suites completas de los dos lados**

```bash
cd backend-desamparados && npm test      # 0 fallos, 0 omitidos
cd desamparados-web && npx tsc -b && npm run lint && npm test
```

- [ ] **Paso 7: Confirmar y abrir el pull request**

```bash
git add -A
git commit -m "Comprobación de punta a punta del constructor de páginas"
```

