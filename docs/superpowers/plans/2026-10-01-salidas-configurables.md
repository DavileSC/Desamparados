# Salidas configurables: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usar superpowers:subagent-driven-development (recomendada) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos llevan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que las salidas procesionales dejen de ser el enum `Salida { PASION, ROSARIO }` y pasen a ser filas de una tabla editable desde el CMS, N por corporación.

**Arquitectura:** tabla `Salida` en MariaDB, a la que apuntan `Turno`, `PapeletaSitio` y `Solicitud` por `salidaId`. Las reglas de fecha y temporada son funciones puras en `domain/fecha-salida.ts`. El código pregunta por propiedades (`conRopa`, `cobro`) y nunca por el nombre. La API recibe la salida por slug (`?salida=sabado-de-pasion`), que es obligatorio. La web lee la lista con un `useSalidas()` común.

**Stack:** Express 5 + TypeScript + Prisma 7 + MariaDB + arktype; React 19 + MUI 9 + React Query; pruebas con `node:test` (backend) y Vitest (web).

**Spec:** `docs/superpowers/specs/2026-10-01-salidas-configurables-design.md` (leerlo antes de empezar).

## Restricciones globales

- Todo en español: código nuevo, comentarios (explican **por qué**), commits y textos.
- En texto visible, «el Grupo Parroquial»; nunca «Hermandad» ni «Cofradía».
- Migraciones de este PC: prefijo `…200000_`. La de este plan: `20261029200000_salidas_configurables`.
- Slugs de las dos salidas actuales: `sabado-de-pasion` y `rosario-vespertino`.
- Sábado de Pasión = Pascua **−8** días.
- `?salida=<slug>` es obligatorio donde hoy es opcional: si falta o no existe, **400**.
- Abrir el plazo de una salida `MANUAL` sin fecha: **409** con «Pon antes la fecha de la salida en la Agenda.»
- Comprobar tipos: backend `npm run comprobar-tipos`; web `npx tsc -b` (nunca `tsc --noEmit`).
- Pruebas: backend `npm test` (con el contenedor `desamparados-mariadb` arrancado: sin él las pruebas con BD se omiten y parecen verdes); web `npx vitest run --testTimeout=20000`.
- Después de tocar `schema.prisma`: `npx prisma generate`.
- `rtk` no se ejecuta en este PC (AppLocker): `git` y `npm` directos.
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. El push lo lanza el usuario.
- Fuera de alcance: el género de «el Grupo Parroquial» y la cuenta atrás de la portada (`desamparados-web/src/domain/sabadoDePasion.ts`, que sigue con su cálculo).

## Mapa de ficheros

| Fichero | Qué hace |
|---|---|
| `backend-desamparados/src/domain/fecha-salida.ts` (nuevo) | Pascua, fecha de una salida en un año, año en curso, temporada de reparto. Puro. Sustituye a `sabado-de-pasion.ts` |
| `backend-desamparados/src/domain/salidas.ts` | Pierde `SALIDAS`, `DATOS_SALIDA` y `PUESTOS_POR_SALIDA`; `pendienteDeLaSalida` y `requisitosParaRecoger` reciben el cobro de la fila |
| `backend-desamparados/prisma/schema.prisma` y la migración | Modelo `Salida`, enums `CobroSalida` y `FechaSalida`, `salidaId` en los tres modelos |
| `backend-desamparados/src/services/procesion/salidas.service.ts` | De «el Rosario» a todas las salidas: listar, por slug, crear, editar, fijar la fecha a mano, DTO para la web |
| `backend-desamparados/src/schemas/salidas.schema.ts` (nuevo) | Contrato arktype del alta y la edición |
| `backend-desamparados/src/routes/salidas.routes.ts` (nuevo) | `GET /salidas`, `GET/POST/PUT /cms/salidas`, `PUT /cms/salidas/:id/fecha` |
| `desamparados-web/src/lib/api/salidas.ts` (nuevo) | Tipo `Salida` de la web y sus llamadas |
| `desamparados-web/src/features/procesion/useSalidas.ts` (nuevo) | Hook común |
| `desamparados-web/src/features/procesion/SelectorSalida.tsx` (nuevo) | Selector que se oculta con una sola salida y recuerda el slug |
| `desamparados-web/src/features/cms/salidas/` (nuevo) | Listado, ventana de alta y pantalla de edición |
| `shared/puestos-procesion.json` | Se borra (sus datos van a la migración y a la siembra) |

---

### Tarea 1: Reglas de fecha (dominio puro)

**Ficheros:**
- Crear: `backend-desamparados/src/domain/fecha-salida.ts`
- Crear: `backend-desamparados/test/fecha-salida.test.ts`
- No borrar todavía `src/domain/sabado-de-pasion.ts`: lo hace la tarea 2.

**Interfaces:**
- Produce:
  - `type ReglaFecha = { fecha: 'PASCUA'; diasDesdePascua: number } | { fecha: 'MANUAL'; acto: string | null }` (`acto`: el día del acto en `AAAA-MM-DD`, hora de Madrid).
  - `pascua(anio: number): string`
  - `sumarDias(dia: string, n: number): string`
  - `fechaDeSalida(regla: ReglaFecha, anio: number): string | null`
  - `proximaFecha(regla: ReglaFecha, hoy: string): string | null`
  - `anioDeLaSalida(regla: ReglaFecha, hoy: string): number`
  - `motivoRepartoFueraDeTemporada(dia: string, regla: ReglaFecha, hoy: string, nombre: string): string | null`
  - `diaMadrid(fecha: Date): string`

- [ ] **Paso 1: escribir la prueba que falla**

```ts
// test/fecha-salida.test.ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  anioDeLaSalida, fechaDeSalida, motivoRepartoFueraDeTemporada, pascua, proximaFecha,
} from '../src/domain/fecha-salida.js';

const PASION = { fecha: 'PASCUA', diasDesdePascua: -8 } as const;

describe('la Pascua y las salidas que dependen de ella', () => {
  test('Domingo de Resurrección', () => {
    assert.equal(pascua(2025), '2025-04-20');
    assert.equal(pascua(2026), '2026-04-05');
    assert.equal(pascua(2027), '2027-03-28');
    assert.equal(pascua(2030), '2030-04-21');
  });

  test('Pascua −8 es el Sábado de Pasión', () => {
    assert.equal(fechaDeSalida(PASION, 2025), '2025-04-12');
    assert.equal(fechaDeSalida(PASION, 2026), '2026-03-28');
    assert.equal(fechaDeSalida(PASION, 2027), '2027-03-20');
    assert.equal(fechaDeSalida(PASION, 2030), '2030-04-13');
  });
});

describe('la salida a mano', () => {
  const rosario = { fecha: 'MANUAL', acto: '2026-10-17' } as const;
  test('su fecha es la del acto, solo en su año', () => {
    assert.equal(fechaDeSalida(rosario, 2026), '2026-10-17');
    assert.equal(fechaDeSalida(rosario, 2027), null);
  });
  test('sin acto no tiene fecha', () => {
    assert.equal(fechaDeSalida({ fecha: 'MANUAL', acto: null }, 2026), null);
  });
});

describe('el año de la salida en curso', () => {
  test('hasta el mismo día de la salida, la de ese año', () => {
    assert.equal(anioDeLaSalida(PASION, '2026-01-10'), 2026);
    assert.equal(anioDeLaSalida(PASION, '2026-03-28'), 2026);
  });
  test('al día siguiente, la del año que viene', () => {
    assert.equal(anioDeLaSalida(PASION, '2026-03-29'), 2027);
    assert.equal(proximaFecha(PASION, '2026-10-01'), '2027-03-20');
  });
  test('a mano: la del acto si no ha pasado; si pasó, el año siguiente', () => {
    assert.equal(anioDeLaSalida({ fecha: 'MANUAL', acto: '2026-10-17' }, '2026-10-01'), 2026);
    assert.equal(anioDeLaSalida({ fecha: 'MANUAL', acto: '2026-10-17' }, '2026-10-18'), 2027);
    assert.equal(anioDeLaSalida({ fecha: 'MANUAL', acto: null }, '2026-05-01'), 2026);
  });
});

describe('los días de reparto, antes de su salida', () => {
  test('la víspera vale; el mismo día ya no', () => {
    assert.equal(motivoRepartoFueraDeTemporada('2027-03-19', PASION, '2026-10-01', 'Sábado de Pasión'), null);
    assert.match(
      motivoRepartoFueraDeTemporada('2027-03-20', PASION, '2026-10-01', 'Sábado de Pasión') ?? '',
      /Sábado de Pasión.*20 de marzo de 2027/,
    );
  });
  test('un reparto en otoño vale para la Pasión del año siguiente', () => {
    assert.equal(motivoRepartoFueraDeTemporada('2026-10-05', PASION, '2026-10-01', 'Sábado de Pasión'), null);
  });
  test('a mano sin fecha: hay que ponerla antes', () => {
    assert.match(
      motivoRepartoFueraDeTemporada('2026-10-05', { fecha: 'MANUAL', acto: null }, '2026-10-01', 'Rosario vespertino') ?? '',
      /Pon antes la fecha de la salida en la Agenda/,
    );
  });
  test('a mano: antes del acto vale; después, no', () => {
    const r = { fecha: 'MANUAL', acto: '2026-10-17' } as const;
    assert.equal(motivoRepartoFueraDeTemporada('2026-10-16', r, '2026-10-01', 'Rosario vespertino'), null);
    assert.match(motivoRepartoFueraDeTemporada('2026-10-18', r, '2026-10-01', 'Rosario vespertino') ?? '', /17 de octubre de 2026/);
  });
});
```

- [ ] **Paso 2: ejecutarla y ver que falla**

Ejecutar: `cd backend-desamparados && npx tsx --test test/fecha-salida.test.ts`
Esperado: FALLA porque no encuentra el módulo `fecha-salida.js`.

- [ ] **Paso 3: implementar**

```ts
// src/domain/fecha-salida.ts
/**
 * Cuándo es cada salida y qué días de reparto le corresponden. Puro: lo usa
 * el plazo, la mesa y los turnos con la fila de `Salida` ya leída.
 *
 * Dos clases de fecha, porque así las tienen las corporaciones: las de
 * Semana Santa se mueven con la Pascua (el Sábado de Pasión es −8) y las de
 * Gloria o el Rosario las fija la Junta cada año con un acto de la Agenda.
 */

export type ReglaFecha =
  | { fecha: 'PASCUA'; diasDesdePascua: number }
  | { fecha: 'MANUAL'; acto: string | null };

/** Domingo de Resurrección, `AAAA-MM-DD` (Meeus/Butcher, calendario gregoriano). */
export function pascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia)).toISOString().slice(0, 10);
}

export function sumarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** El día de una fecha en Madrid: un acto a las 00:30 del día 17 es del 17, no del 16 en UTC. */
export function diaMadrid(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(fecha);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const diaLargo = (dia: string) => `${Number(dia.slice(8, 10))} de ${MESES[Number(dia.slice(5, 7)) - 1]} de ${dia.slice(0, 4)}`;

export function fechaDeSalida(regla: ReglaFecha, anio: number): string | null {
  if (regla.fecha === 'PASCUA') return sumarDias(pascua(anio), regla.diasDesdePascua);
  return regla.acto && Number(regla.acto.slice(0, 4)) === anio ? regla.acto : null;
}

/** La primera fecha de la salida que no ha pasado: el mismo día todavía cuenta. */
export function proximaFecha(regla: ReglaFecha, hoy: string): string | null {
  if (regla.fecha === 'MANUAL') return regla.acto && regla.acto >= hoy ? regla.acto : null;
  const anio = Number(hoy.slice(0, 4));
  const deEste = fechaDeSalida(regla, anio)!;
  return deEste >= hoy ? deEste : fechaDeSalida(regla, anio + 1);
}

/**
 * El año de la salida que se está preparando: el de su próxima fecha. A mano
 * y ya pasada, la del año siguiente, aunque todavía no tenga fecha.
 */
export function anioDeLaSalida(regla: ReglaFecha, hoy: string): number {
  const proxima = proximaFecha(regla, hoy);
  if (proxima) return Number(proxima.slice(0, 4));
  if (regla.fecha === 'MANUAL' && regla.acto) return Number(regla.acto.slice(0, 4)) + 1;
  return Number(hoy.slice(0, 4));
}

/**
 * Por qué un día de reparto no vale, o `null`. Un reparto es para la próxima
 * salida y tiene que caer antes de ella: así la papeleta se cuenta en el año
 * de esa salida, aunque el reparto sea en otoño del año anterior.
 */
export function motivoRepartoFueraDeTemporada(dia: string, regla: ReglaFecha, hoy: string, nombre: string): string | null {
  const proxima = proximaFecha(regla, hoy);
  if (!proxima) return `${nombre} todavía no tiene fecha. Pon antes la fecha de la salida en la Agenda.`;
  if (dia < proxima) return null;
  return `El reparto del ${nombre} tiene que ser antes de la salida, que es el ${diaLargo(proxima)}.`;
}
```

- [ ] **Paso 4: ejecutarla y ver que pasa**

Ejecutar: `npx tsx --test test/fecha-salida.test.ts`
Esperado: PASA (los 4 bloques).

- [ ] **Paso 5: commit**

```bash
git add backend-desamparados/src/domain/fecha-salida.ts backend-desamparados/test/fecha-salida.test.ts
git commit -m "Salidas: reglas de fecha por la Pascua o a mano, en dominio puro"
```

---

### Tarea 2: El backend pasa del enum a la tabla `Salida`

Es la tarea grande: el esquema y su migración rompen todos los usos del enum de una vez, y no hay estado intermedio que compile. Hay un commit por paso para revisarla por partes, pero la tarea termina solo con los tipos y **todas** las pruebas en verde.

**Ficheros:**
- Modificar: `backend-desamparados/prisma/schema.prisma`
- Crear: `backend-desamparados/prisma/migrations/20261029200000_salidas_configurables/migration.sql`
- Modificar: `backend-desamparados/prisma/seed.ts` (y `seed-demo.ts` si crea papeletas, turnos o solicitudes)
- Modificar: `src/domain/salidas.ts`, `src/domain/mesa-procesion.ts`, `src/domain/cortejo.ts`, `src/domain/comunicados.ts`
- Borrar: `src/domain/sabado-de-pasion.ts`, `test/sabado-de-pasion.test.ts`, `shared/puestos-procesion.json` (la web lo importa: en esta tarea se cambian solo sus imports a una copia temporal, ver el paso 9)
- Modificar: `src/services/procesion/{salidas,plazo,turnos,mesa,zonas,puerta,cortejo,papeletas,mi-procesion,ropa,papeleta-pdf}.ts`, `src/services/recibos/comunes.ts`, `src/services/{email,comunicados,datos,auditoria}.service.ts`
- Modificar: `src/controllers/{procesion,mesa,cortejo,puerta}.controller.ts`, `src/schemas/{procesion,comunicados}.schema.ts`, `src/dtos/{procesion,email}.dto.ts`, `src/routes/procesion.routes.ts`
- Pruebas: las 13 de `test/` que usan `PASION`/`ROSARIO` (`grep -rlE "PASION|ROSARIO" test`) y la nueva `test/salidas-migracion-db.test.ts`

**Interfaces:**
- Consume (tarea 1): `ReglaFecha`, `fechaDeSalida`, `anioDeLaSalida`, `motivoRepartoFueraDeTemporada`, `diaMadrid`.
- Produce:
  - Modelo Prisma `Salida` (campos del spec) y enums `CobroSalida`, `FechaSalida`.
  - `SalidasService.porSlug(slug: string | undefined, cliente?): Promise<SalidaConActo>`: lanza `HttpError(400)` «Falta la salida.» o «No existe la salida «x».».
  - `SalidasService.porId(id: number, cliente?): Promise<SalidaConActo>`.
  - `SalidasService.listar(opciones?: { todas?: boolean }): Promise<SalidaConActo[]>`: por `orden` e `id`; solo las activas salvo `todas`.
  - `type SalidaConActo = Salida & { acto: Evento | null }` (el `include: { acto: true }` de la relación `eventoId`).
  - `reglaDe(s: SalidaConActo): ReglaFecha` (en `salidas.service.ts`).
  - `PlazoPapeletasService.anioDeLaProcesion(salida: SalidaConActo): number`: síncrona, con `anioDeLaSalida(reglaDe(s), diaMadrid(new Date()))`.
  - `anioDeLaMesa(salida: SalidaConActo): number` (en `zonas.service.ts`).
  - `pendienteDeLaSalida(solicitud: { donativo: number | null; recibo: { estado } | null }, salida: { cobro: CobroSalida; importeCuota: number }): number`.
  - `requisitosParaRecoger({ activo, solicitud: { cobro: CobroSalida; salidaPendiente: number } | null, cuotas })`.
  - `leerDatosEvento(salida: SalidaConActo): DatosEvento`: síncrona. Con `PASCUA`, día largo de `fechaDeSalida` del año en curso, `horaSalida` y `lugar` de la fila; con `MANUAL`, del acto; sin datos, «Por anunciar» / «Consultar en secretaría».
  - `ACCIONES_AUDITORIA.SALIDA_FECHAR`, `SALIDA_CREAR` y `SALIDA_EDITAR`, en lugar de `ROSARIO_FECHAR`.

- [ ] **Paso 1: esquema**

En `schema.prisma`, borrar `enum Salida` y añadir:

```prisma
/// Cómo se paga la salida: una cuota fija (la papeleta de sitio) o la
/// voluntad que dice el hermano (el Rosario vespertino).
enum CobroSalida {
  CUOTA
  DONATIVO
}

/// De dónde sale la fecha cada año: de la Pascua (las de Semana Santa) o de
/// un acto de la Agenda que fija la Junta (Gloria, Rosario…).
enum FechaSalida {
  PASCUA
  MANUAL
}

/// Cada salida procesional de la corporación: las define el CMS, no el
/// código. Con papeletas no se borra: se desactiva.
model Salida {
  id              Int         @id @default(autoincrement())
  slug            String      @unique
  nombre          String
  orden           Int         @default(0)
  activa          Boolean     @default(true)
  conRopa         Boolean     @default(false)
  cobro           CobroSalida @default(CUOTA)
  importeCuota    Decimal     @default(0) @db.Decimal(8, 2)
  fecha           FechaSalida
  /// Con PASCUA: días desde el Domingo de Resurrección (Sábado de Pasión = −8).
  diasDesdePascua Int?
  /// Con PASCUA; con MANUAL salen del acto.
  horaSalida      String?
  lugar           String?
  /// Con MANUAL: el acto de la Agenda de este año.
  eventoId        Int?
  acto            Evento?     @relation("ActoDeLaSalida", fields: [eventoId], references: [id], onDelete: SetNull)
  plazoAbierto    Boolean     @default(false)
  plazoCambiadoEl DateTime?
  /// PuestoDelCatalogo[]: lo que sugieren la mesa y la solicitud.
  puestos         Json
  /// ConfiguracionCortejo; null = cuatro tramos de 30 con «Nazareno».
  cortejo         Json?
  /// Vestimenta y comportamiento: van en la papeleta y en los correos.
  indicaciones    String?     @db.Text

  turnos      Turno[]
  papeletas   PapeletaSitio[]
  solicitudes Solicitud[]
}
```

(`plazoCambiadoEl` sustituye al `updatedAt` de la clave de configuración, que hoy ve Secretaría junto al interruptor.)

En `Evento`, añadir `salidas Salida[] @relation("ActoDeLaSalida")`. En `Turno`, `PapeletaSitio` y `Solicitud`, cambiar `salida Salida…` por:

```prisma
  salidaId Int
  salida   Salida @relation(fields: [salidaId], references: [id])
```

Los índices: `@@unique([hermanoId, year, salidaId])` y `@@index([year, salidaId])` en `PapeletaSitio`; `@@index([year, salidaId, estado])` y `@@index([hermanoId, year, salidaId])` en `Solicitud`; `@@index([salidaId])` en `Turno`.

Ejecutar `npx prisma format`.

- [ ] **Paso 2: migración**

Generarla sin aplicar: `npx prisma migrate dev --create-only --name salidas_configurables`. Renombrar la carpeta a `20261029200000_salidas_configurables`. Prisma escribe un `ADD COLUMN salidaId NOT NULL` que fallaría con filas. Reescribir el fichero entero con este orden (los nombres de índice y de clave ajena, tal como los generó Prisma):

```sql
-- Las salidas pasan de un enum en el código a filas que define el CMS. Las
-- dos de siempre se crean con lo que hoy está en el código y en la
-- configuración, y las papeletas, solicitudes y repartos se enlazan a ellas.

CREATE TABLE `Salida` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `conRopa` BOOLEAN NOT NULL DEFAULT false,
    `cobro` ENUM('CUOTA', 'DONATIVO') NOT NULL DEFAULT 'CUOTA',
    `importeCuota` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `fecha` ENUM('PASCUA', 'MANUAL') NOT NULL,
    `diasDesdePascua` INTEGER NULL,
    `horaSalida` VARCHAR(191) NULL,
    `lugar` VARCHAR(191) NULL,
    `eventoId` INTEGER NULL,
    `plazoAbierto` BOOLEAN NOT NULL DEFAULT false,
    `plazoCambiadoEl` DATETIME(3) NULL,
    `puestos` JSON NOT NULL,
    `cortejo` JSON NULL,
    `indicaciones` TEXT NULL,
    UNIQUE INDEX `Salida_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Salida` ADD CONSTRAINT `Salida_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- La Pasión: cuota de salida, hora y acceso, plazo y cortejo de la configuración.
INSERT INTO `Salida` (`slug`, `nombre`, `orden`, `conRopa`, `cobro`, `importeCuota`, `fecha`, `diasDesdePascua`,
  `horaSalida`, `lugar`, `plazoAbierto`, `plazoCambiadoEl`, `puestos`, `cortejo`, `indicaciones`)
SELECT 'sabado-de-pasion', 'Sábado de Pasión', 1, true, 'CUOTA',
  COALESCE((SELECT CAST(REPLACE(`value`, ',', '.') AS DECIMAL(8, 2)) FROM `Configuracion` WHERE `key` = 'precio_papeleta_sitio'), 0),
  'PASCUA', -8,
  (SELECT `value` FROM `Configuracion` WHERE `key` = 'procesion_hora'),
  (SELECT `value` FROM `Configuracion` WHERE `key` = 'procesion_acceso'),
  COALESCE((SELECT `value` = 'true' FROM `Configuracion` WHERE `key` = 'papeletas_abiertas'), false),
  (SELECT `updatedAt` FROM `Configuracion` WHERE `key` = 'papeletas_abiertas'),
  '<<JSON del array «puestos» de shared/puestos-procesion.json, en una línea>>',
  (SELECT `value` FROM `Configuracion` WHERE `key` = 'cortejo_PASION'),
  'Se ruega puntualidad y decoro en la vestimenta. Es obligatorio portar la medalla del Grupo Parroquial y calzado oscuro. Guarde silencio durante la formación.';

-- El Rosario: donativo, fecha a mano con el acto que ya tenga en la Agenda.
INSERT INTO `Salida` (`slug`, `nombre`, `orden`, `conRopa`, `cobro`, `fecha`, `eventoId`,
  `plazoAbierto`, `plazoCambiadoEl`, `puestos`, `cortejo`, `indicaciones`)
SELECT 'rosario-vespertino', 'Rosario vespertino', 2, false, 'DONATIVO', 'MANUAL',
  (SELECT e.`id` FROM `Evento` e JOIN `Configuracion` c ON c.`key` = 'rosario_evento_id' AND e.`id` = CAST(c.`value` AS INTEGER)),
  COALESCE((SELECT `value` = 'true' FROM `Configuracion` WHERE `key` = 'papeletas_abiertas_rosario'), false),
  (SELECT `updatedAt` FROM `Configuracion` WHERE `key` = 'papeletas_abiertas_rosario'),
  '<<JSON del array «rosario» de shared/puestos-procesion.json, en una línea>>',
  (SELECT `value` FROM `Configuracion` WHERE `key` = 'cortejo_ROSARIO'),
  'Se va en traje oscuro, con la medalla del Grupo Parroquial. Se ruega puntualidad y recogimiento durante el rezo.';

-- Enlazar lo que ya existe. Nullable primero, se rellena y luego se exige.
ALTER TABLE `Turno` ADD COLUMN `salidaId` INTEGER NULL;
ALTER TABLE `PapeletaSitio` ADD COLUMN `salidaId` INTEGER NULL;
ALTER TABLE `Solicitud` ADD COLUMN `salidaId` INTEGER NULL;

UPDATE `Turno` t JOIN `Salida` s ON s.`slug` = IF(t.`salida` = 'PASION', 'sabado-de-pasion', 'rosario-vespertino') SET t.`salidaId` = s.`id`;
UPDATE `PapeletaSitio` p JOIN `Salida` s ON s.`slug` = IF(p.`salida` = 'PASION', 'sabado-de-pasion', 'rosario-vespertino') SET p.`salidaId` = s.`id`;
UPDATE `Solicitud` o JOIN `Salida` s ON s.`slug` = IF(o.`salida` = 'PASION', 'sabado-de-pasion', 'rosario-vespertino') SET o.`salidaId` = s.`id`;

ALTER TABLE `Turno` MODIFY `salidaId` INTEGER NOT NULL;
ALTER TABLE `PapeletaSitio` MODIFY `salidaId` INTEGER NOT NULL;
ALTER TABLE `Solicitud` MODIFY `salidaId` INTEGER NOT NULL;

-- La clave nueva antes de soltar la vieja: empieza por hermanoId y sostiene
-- la clave ajena del hermano (mismo truco que en mesa_por_zonas).
CREATE UNIQUE INDEX `PapeletaSitio_hermanoId_year_salidaId_key` ON `PapeletaSitio`(`hermanoId`, `year`, `salidaId`);
DROP INDEX `PapeletaSitio_hermanoId_year_salida_key` ON `PapeletaSitio`;
CREATE INDEX `PapeletaSitio_year_salidaId_idx` ON `PapeletaSitio`(`year`, `salidaId`);
DROP INDEX `PapeletaSitio_year_salida_idx` ON `PapeletaSitio`;
CREATE INDEX `Solicitud_hermanoId_year_salidaId_idx` ON `Solicitud`(`hermanoId`, `year`, `salidaId`);
DROP INDEX `Solicitud_hermanoId_year_salida_idx` ON `Solicitud`;
CREATE INDEX `Solicitud_year_salidaId_estado_idx` ON `Solicitud`(`year`, `salidaId`, `estado`);
DROP INDEX `Solicitud_year_salida_estado_idx` ON `Solicitud`;
CREATE INDEX `Turno_salidaId_idx` ON `Turno`(`salidaId`);

ALTER TABLE `Turno` DROP COLUMN `salida`;
ALTER TABLE `PapeletaSitio` DROP COLUMN `salida`;
ALTER TABLE `Solicitud` DROP COLUMN `salida`;

ALTER TABLE `Turno` ADD CONSTRAINT `Turno_salidaId_fkey` FOREIGN KEY (`salidaId`) REFERENCES `Salida`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PapeletaSitio` ADD CONSTRAINT `PapeletaSitio_salidaId_fkey` FOREIGN KEY (`salidaId`) REFERENCES `Salida`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Solicitud` ADD CONSTRAINT `Solicitud_salidaId_fkey` FOREIGN KEY (`salidaId`) REFERENCES `Salida`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lo que vivía en la configuración y ahora vive en la salida.
DELETE FROM `Configuracion` WHERE `key` IN ('papeletas_abiertas', 'papeletas_abiertas_rosario', 'precio_papeleta_sitio',
  'rosario_evento_id', 'procesion_hora', 'procesion_acceso', 'procesion_fecha', 'cortejo_PASION', 'cortejo_ROSARIO');
```

Sustituir los dos `<<JSON…>>` por el contenido literal del fichero, sin el `_comentario`. Si el `cortejo_*` guardado no es JSON válido, MariaDB rechaza el INSERT: en ese caso, usar `JSON_VALID(value)` en un `IF`.

Comprobar que no se pierde nada: `grep -rn "procesion_fecha\|CLAVES_EVENTO" src` y quitar `CLAVES_EVENTO` de `domain/datos-procesion.ts` junto con `datosEvento` y sus variables de entorno, si ya nadie los usa. Si `procesion_fecha` lo escribe alguna pantalla, la fecha de la Pasión pasa a calcularse y esa pantalla lo pierde en la tarea 7.

Aplicar: `npx prisma migrate dev` y después `npx prisma generate`.

- [ ] **Paso 3: prueba de la migración (falla primero)**

Crear `test/salidas-migracion-db.test.ts` con el mismo arranque que `test/cortejo-db.test.ts` (`dbDisponible` y `SIN_DB`). Comprueba el estado que dejó la migración:

```ts
test('las dos salidas de siempre existen con su configuración', { skip: !dbDisponible && SIN_DB }, async () => {
  const [pasion, rosario] = await Promise.all([
    db.salida.findUniqueOrThrow({ where: { slug: 'sabado-de-pasion' } }),
    db.salida.findUniqueOrThrow({ where: { slug: 'rosario-vespertino' } }),
  ]);
  assert.equal(pasion.fecha, 'PASCUA');
  assert.equal(pasion.diasDesdePascua, -8);
  assert.equal(pasion.conRopa, true);
  assert.equal(pasion.cobro, 'CUOTA');
  assert.ok(Array.isArray(pasion.puestos) && pasion.puestos.length > 0);
  assert.equal(rosario.fecha, 'MANUAL');
  assert.equal(rosario.cobro, 'DONATIVO');
  assert.equal(rosario.conRopa, false);
});

test('ninguna papeleta, solicitud ni turno queda sin salida', { skip: !dbDisponible && SIN_DB }, async () => {
  const huerfanas = await db.$queryRaw<{ n: bigint }[]>`
    SELECT (SELECT COUNT(*) FROM PapeletaSitio p LEFT JOIN Salida s ON s.id = p.salidaId WHERE s.id IS NULL)
         + (SELECT COUNT(*) FROM Solicitud o LEFT JOIN Salida s ON s.id = o.salidaId WHERE s.id IS NULL)
         + (SELECT COUNT(*) FROM Turno t LEFT JOIN Salida s ON s.id = t.salidaId WHERE s.id IS NULL) AS n`;
  assert.equal(Number(huerfanas[0].n), 0);
});

test('la configuración vieja de las salidas ya no está', { skip: !dbDisponible && SIN_DB }, async () => {
  const viejas = await db.configuracion.count({ where: { key: { in: ['papeletas_abiertas', 'papeletas_abiertas_rosario', 'rosario_evento_id', 'precio_papeleta_sitio'] } } });
  assert.equal(viejas, 0);
});
```

Ejecutar: `npx tsx --test test/salidas-migracion-db.test.ts`. Esperado: PASA si la migración se aplicó (antes del paso 2 fallaba con `db.salida` undefined). Si sale «skipped», arrancar el contenedor: `docker start desamparados-mariadb`.

- [ ] **Paso 4: siembra**

En `prisma/seed.ts`, crear las dos salidas con `upsert` por `slug` y los mismos valores que la migración. Los puestos se importan una vez desde un literal en `prisma/seed-salidas.ts` (nuevo), que es su nuevo hogar. Lo que en la siembra cree turnos, papeletas o solicitudes pasa de `salida: 'PASION'` a `salidaId` de la fila. Comprobar con `npx prisma db seed` contra una base vacía, o con la orden que use el proyecto (`package.json` → `prisma.seed`).

- [ ] **Paso 5: dominio**

- `domain/salidas.ts`: borrar `SALIDAS`, `DatosDeSalida`, `DATOS_SALIDA`, `CLAVE_CUOTA_SALIDA`, `CUOTA_SALIDA_POR_DEFECTO` y `PUESTOS_POR_SALIDA`. Conservar `PuestoDelCatalogo`. `conceptoDeSalida(salida: { nombre: string; cobro: CobroSalida }, year, conceptosExistentes)` usa como base `Papeleta de sitio` con `CUOTA` y `Donativo ${nombre}` con `DONATIVO` (así siguen saliendo los conceptos de hoy). Añadir `tipoReciboDe(cobro)`: `CUOTA` da `PAPELETA_SITIO` y `DONATIVO` da `DONATIVO`. `pendienteDeLaSalida` y `requisitosParaRecoger` con las firmas de **Interfaces**; el motivo es «Falta el donativo.» si `cobro === 'DONATIVO'` y «Falta pagar la papeleta.» si no.
- `domain/mesa-procesion.ts`: deja de importar el JSON; las funciones que leían el catálogo reciben `puestos: readonly PuestoDelCatalogo[]`.
- `domain/cortejo.ts`: `CORTEJO_POR_DEFECTO` es un solo valor (cuatro tramos de 30 y `['Nazareno']`), el que se usa si `salida.cortejo` es null.
- `domain/comunicados.ts`: `conPapeleta?: number | null` (el `salidaId`). `describirSegmento` recibe un mapa `id → nombre` para decir «con papeleta del Sábado de Pasión».
- Borrar `domain/sabado-de-pasion.ts` y su prueba. La regla y los casos viven ya en `fecha-salida`.

Actualizar las pruebas de dominio que llamaban a estas funciones (`grep -rln "DATOS_SALIDA\|requisitosParaRecoger\|pendienteDeLaSalida\|CORTEJO_POR_DEFECTO\|describirSegmento" test`), pasando objetos `{ cobro: 'CUOTA', importeCuota: 0 }` o `{ cobro: 'DONATIVO', … }` donde antes iba `'PASION'` o `'ROSARIO'`. Ejecutar esas pruebas: PASAN.

Commit: `Salidas: tabla Salida, migración con las dos de siempre y dominio sin el enum`.

- [ ] **Paso 6: servicios de procesión**

Regla general: toda firma `salida: Salida = 'PASION'` pasa a `salida: SalidaConActo` (sin valor por defecto), y todo `where: { salida }` pasa a `where: { salidaId: salida.id }`. Las ramas se sustituyen así:

| Hoy | Pasa a |
|---|---|
| `salida === 'PASION'` cuando habla de la ropa (mesa, ropa, zonas, puerta) | `salida.conRopa` |
| `salida === 'ROSARIO'` cuando habla del cobro o del donativo | `salida.cobro === 'DONATIVO'` |
| `DATOS_SALIDA[s].nombre` | `s.nombre` |
| `DATOS_SALIDA[s].clavePlazo` y `configuracion` del plazo | `s.plazoAbierto`, y `db.salida.update({ data: { plazoAbierto, plazoCambiadoEl: new Date() } })` |
| `cuotaDeSalida()` y `precio_papeleta_sitio` | `Number(s.importeCuota)`, y `null` si `cobro === 'DONATIVO'` |
| `PUESTOS_POR_SALIDA[s]` | `s.puestos as PuestoDelCatalogo[]` |
| `anioDeLaMesa('PASION')` en ropa, zonas y preparación | `anioDeLaMesa(salida)` de la salida que llega; si la función no la recibía, añadirla como parámetro desde el controlador |
| `salida: 'PASION'` fijo en `ropa.ts` (túnicas asignadas) | `salidaId` de la salida con ropa que se está repartiendo: el ropero va por salida y año |
| `cortejo_${salida}` en configuración (`cortejo.service.ts`) | `s.cortejo ?? CORTEJO_POR_DEFECTO`; guardar con `db.salida.update({ data: { cortejo } })` |

Fichero a fichero:
- `salidas.service.ts`: reescribirlo con `porSlug`, `porId`, `listar` y `reglaDe` (ver **Interfaces**). `fijarRosario` pasa a ser `fijarFecha(salida: SalidaConActo, datos: { inicio: string; lugar?: string | null }, meta)`: solo para `fecha === 'MANUAL'` (409 «Esta salida se calcula por la Pascua: su fecha no se pone a mano.» si no), **sin** la condición de octubre. Crea o mueve el acto (`title: salida.nombre`, `description: salida.indicaciones`, `type: PROCESION`), guarda `eventoId` en la fila y audita con `SALIDA_FECHAR`.
- `plazo.service.ts`: `anioDeLaProcesion(salida)` síncrona (ver **Interfaces**). Borrar `CLAVE_PLAZO` y `cuotaDeSalida`. En `cambiar(abrir, opciones: { avisar?, borradorNoticia? }, salida, meta)`, antes de los días de reparto: `if (abrir && !proximaFecha(reglaDe(salida), diaMadrid(new Date()))) throw new HttpError('Pon antes la fecha de la salida en la Agenda.', 409)`. Auditoría con `'salida', salida.id`. `contenidoNoticia`: título «Abierta la inscripción del ${nombre} ${year}», y un solo cuerpo que usa `nombre`, la frase de cobro («Para participar se pide la voluntad» con `DONATIVO`) e `indicaciones` si las hay.
- `turnos.service.ts`: `motivoRepartoFueraDeTemporada(diaMadrid(new Date(data.fecha)), reglaDe(salida), diaMadrid(new Date()), salida.nombre)`; crear con `salidaId`. Donde ahora se use `t.salida === 'ROSARIO'` para el texto del acto de la Agenda, usar `t.salida.nombre` (incluir `salida` en la consulta).
- `mi-procesion.service.ts`: el estado del hermano recorre `SalidasService.listar()` en vez de las dos fijas. El 409 dice «La inscripción del ${salida.nombre} no está abierta.».
- `mesa.service.ts`, `zonas.service.ts`, `puerta.service.ts`, `cortejo.service.ts`, `papeletas.service.ts`, `ropa.ts`: según la tabla. `mesa.service.ts:432` (cambiar el donativo) solo con `cobro === 'DONATIVO'`; `:459`, `conRopa = salida.conRopa`.
- `papeleta-pdf.ts` y `email.service.ts`: `rosario` desaparece. El título es `${salida.nombre} ${year}`; la celda de importe se llama «Donativo» con `DONATIVO` y «Limosna abonada» con `CUOTA`; el párrafo es «La Secretaría le confirma su puesto en el ${nombre} del <strong>fecha</strong>»; el recuadro «Antes de salir» lleva `salida.indicaciones` (se omite si es null); `normativa` solo con `conRopa`. `DatosPapeleta.salida` pasa a ser `{ nombre: string; cobro: CobroSalida; conRopa: boolean; indicaciones: string | null }`. `enviarAperturaPapeletas` recibe la salida.
- `recibos/comunes.ts`: `leerDatosEvento(salida)` según **Interfaces**; borrar `CLAVE_EVENTO_ROSARIO`.
- `comunicados.service.ts`: `papeletas: { some: { salidaId: s.conPapeleta, year: anioDeLaMesa(await SalidasService.porId(s.conPapeleta)) } }`.
- `datos.service.ts`: las seis consultas por `Salida.PASION` y `Salida.ROSARIO` pasan a recorrer `SalidasService.listar()`, y devuelven `porSalida: { slug, nombre, conRopa, papeletas, papeletasAnioAnterior, porPuesto, serie? }[]`. La serie de cinco años solo para las salidas `conRopa`, que es lo que hoy enseña la de la Pasión. Anotar el cambio de forma, porque la tarea 7 adapta la pantalla de Datos.
- `auditoria.service.ts`: `ROSARIO_FECHAR` pasa a `SALIDA_FECHAR`; añadir `SALIDA_CREAR` y `SALIDA_EDITAR`.

Ejecutar `npm run comprobar-tipos` hasta que no queden errores en `src/services`.

Commit: `Salidas: los servicios de procesión leen la fila de la salida`.

- [ ] **Paso 7: contrato HTTP de procesión**

- `schemas/procesion.schema.ts`: `const salida = type('string > 0')` (el slug). En `salidaQuerySchema`, `cortejoQuerySchema` y los esquemas de la mesa y la puerta, `salida` es **obligatoria** (sin `?`). `plazoPapeletasSchema` lleva `salida` obligatoria. `fechaRosarioSchema` pasa a ser `fechaSalidaSchema`: `{ salida: string, inicio: string, "lugar?": "string | null" }`.
- `schemas/comunicados.schema.ts`: `"conPapeleta?": "number.integer > 0 | null"`.
- Controladores: `salidaDe(req)` pasa a ser `await SalidasService.porSlug(req.query.salida ?? req.body.salida)`, y el 400 sale de ahí. `procesion.controller.ts:30` quita la rama del Rosario: el plazo devuelve `{ ...plazo, fecha: { eventoId, inicio, lugar } | null }` para las salidas `MANUAL`.
- `routes/procesion.routes.ts`: `PUT /admin/rosario` pasa a ser `PUT /admin/salida/fecha` con `fechaSalidaSchema`.
- `dtos/procesion.dto.ts` y `email.dto.ts`: `salida` como el tipo de fila o el slug, según lo que lleven.

- [ ] **Paso 8: pruebas existentes**

Para cada fichero de `grep -rlE "PASION|ROSARIO|cortejo_PASION|papeletas_abiertas" test`:
- Las filas de prueba se crean con `salidaId` de `await db.salida.findUniqueOrThrow({ where: { slug: 'sabado-de-pasion' } })` (o `rosario-vespertino`).
- Las llamadas HTTP llevan `?salida=sabado-de-pasion` (o `rosario-vespertino`). Antes iban sin parámetro o con `PASION`.
- Lo que leía o restauraba claves de configuración (`cortejo_PASION`, `papeletas_abiertas`…) lee o restaura la fila: guardar `plazoAbierto` y `cortejo` en `escenario()` y devolverlos en el `finally`.
- Añadir en `test/mesa-db.test.ts` (o el que ya pruebe la mesa por HTTP) un caso: `GET /procesion/admin/mesa/colas` sin `salida` da **400**, y con `salida=no-existe` también.
- Añadir en la prueba del plazo: abrir una salida `MANUAL` con `eventoId` null da **409** con «Pon antes la fecha».

Ejecutar `npm run comprobar-tipos` y `npm test` con MariaDB arrancada. Esperado: 0 fallos, y ninguna prueba con BD omitida (si alguna sale «skipped», la base no estaba levantada).

- [ ] **Paso 9: la web sigue compilando**

La web importa `shared/puestos-procesion.json` en `features/areaHermano/procesion/ProcesionPage.tsx` y `features/cms/mesa/formato.ts`. Para que esta tarea no deje la web rota, **no borrar todavía** el JSON: se borra en la tarea 7. Comprobar con `cd ../desamparados-web && npx tsc -b`: si falla solo por tipos de la API que cambian en la tarea 7, apuntarlo en el commit; la tarea 7 lo cierra.

Commit: `Salidas: la API de procesión recibe la salida por slug, obligatoria`.

---

### Tarea 3: API de las salidas para el CMS y la web

**Ficheros:**
- Crear: `backend-desamparados/src/schemas/salidas.schema.ts`
- Crear: `backend-desamparados/src/controllers/salidas.controller.ts`
- Crear: `backend-desamparados/src/routes/salidas.routes.ts`, y montarla donde se montan las demás (buscar `procesionRouter` en `src/app.ts`)
- Modificar: `backend-desamparados/src/services/procesion/salidas.service.ts` (`crear`, `editar`, `paraLaWeb`)
- Crear: `backend-desamparados/test/salidas-api-db.test.ts`

**Interfaces:**
- Consume: `SalidasService.listar/porId/porSlug/fijarFecha`, `reglaDe`, `fechaDeSalida`, `anioDeLaSalida`, `diaMadrid`.
- Produce (JSON para la web, tipo `SalidaWeb`):

```ts
{
  id: number; slug: string; nombre: string; orden: number; activa: boolean;
  conRopa: boolean; cobro: 'CUOTA' | 'DONATIVO'; importeCuota: number;
  fecha: 'PASCUA' | 'MANUAL'; diasDesdePascua: number | null;
  horaSalida: string | null; lugar: string | null; eventoId: number | null;
  plazoAbierto: boolean; puestos: PuestoDelCatalogo[]; cortejo: ConfiguracionCortejo | null;
  indicaciones: string | null;
  anio: number;                // anioDeLaSalida
  fechaDelAnio: string | null; // fechaDeSalida(regla, anio), AAAA-MM-DD
}
```

- Rutas:
  - `GET /api/salidas` (con sesión de hermano o del CMS, como `/procesion/dias`): las activas, `SalidaWeb[]`.
  - `GET /api/cms/salidas` (roles `ADMIN`, `SECRETARIA`, `HERMANO_MAYOR`): todas, también las inactivas.
  - `POST /api/cms/salidas` y `PUT /api/cms/salidas/:id` (roles `ADMIN`, `SECRETARIA`).
  - `PUT /api/cms/salidas/:id/fecha` (roles `ADMIN`, `SECRETARIA`): hace lo mismo que `PUT /procesion/admin/salida/fecha` de la tarea 2, que **se borra** aquí para no tener dos caminos.

- [ ] **Paso 1: esquema**

```ts
// src/schemas/salidas.schema.ts
import { type } from 'arktype';

const puesto = type({
  nombre: 'string > 0',
  tunica: 'boolean',
  tocado: "'CAPIROTE' | 'FARAONA' | null",
  alturaHombro: 'boolean',
});

/** Lo que se edita de una salida. La fecha a mano va por su ruta: crea el acto de la Agenda. */
const datosSalida = type({
  nombre: '0 < string <= 120',
  slug: /^[a-z0-9]+(-[a-z0-9]+)*$/,
  orden: 'number.integer >= 0',
  activa: 'boolean',
  conRopa: 'boolean',
  cobro: "'CUOTA' | 'DONATIVO'",
  importeCuota: '0 <= number <= 9999',
  fecha: "'PASCUA' | 'MANUAL'",
  diasDesdePascua: '-60 <= number.integer <= 60 | null',
  horaSalida: 'string <= 40 | null',
  lugar: 'string <= 191 | null',
  puestos: puesto.array().atLeastLength(1),
  indicaciones: 'string <= 2000 | null',
});

export const crearSalidaSchema = type({ body: datosSalida });
export const editarSalidaSchema = type({ params: { id: 'string.integer.parse' }, body: datosSalida.partial() });
export const fechaDeSalidaSchema = type({
  params: { id: 'string.integer.parse' },
  body: { inicio: 'string > 0', 'lugar?': 'string | null' },
});
```

(Ajustar `params` al patrón de `idParam` de `config/common.ts`, si el proyecto lo usa en otros esquemas.)

Reglas que el esquema no expresa y comprueba el servicio (400): con `PASCUA`, `diasDesdePascua` es obligatorio; con `MANUAL`, se guarda `diasDesdePascua = null`.

- [ ] **Paso 2: prueba que falla**

`test/salidas-api-db.test.ts`, con el arranque de `cortejo-db.test.ts`. Al terminar, borra lo que crea (slug `prueba-salida-<Date.now()>`).

```ts
test('Secretaría da de alta una salida y sale en /api/salidas con su fecha del año', { skip: !dbDisponible && SIN_DB }, async () => {
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  const slug = `prueba-salida-${Date.now()}`;
  try {
    const alta = await fetch(`${baseUrl}/api/cms/salidas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${COOKIE_CMS}=${generateToken(staff.id)}` },
      body: JSON.stringify({
        nombre: 'Traslado', slug, orden: 9, activa: true, conRopa: false, cobro: 'CUOTA', importeCuota: 0,
        fecha: 'PASCUA', diasDesdePascua: -10, horaSalida: null, lugar: null,
        puestos: [{ nombre: 'Acompañante', tunica: false, tocado: null, alturaHombro: false }], indicaciones: null,
      }),
    });
    assert.equal(alta.status, 201);
    const lista = await (await fetch(`${baseUrl}/api/salidas`, { headers: { Cookie: `${COOKIE_CMS}=${generateToken(staff.id)}` } })).json();
    const nueva = lista.find((s: { slug: string }) => s.slug === slug);
    assert.ok(nueva);
    assert.match(nueva.fechaDelAnio, /^\d{4}-\d{2}-\d{2}$/);
  } finally {
    await db.salida.deleteMany({ where: { slug } });
    await borrarUsuarioPrueba(staff.id);
  }
});

test('un hermano no puede dar de alta salidas', { skip: !dbDisponible && SIN_DB }, async () => {
  // POST /api/cms/salidas con Role.USER → 403
});

test('el slug repetido da 409', { skip: !dbDisponible && SIN_DB }, async () => {
  // POST con slug 'sabado-de-pasion' → 409 «Ya hay una salida con ese nombre corto.»
});

test('con PASCUA y sin días desde la Pascua, 400', { skip: !dbDisponible && SIN_DB }, async () => {
  // POST con fecha 'PASCUA' y diasDesdePascua null → 400
});

test('desactivar una salida la quita de /api/salidas, pero no de /api/cms/salidas', { skip: !dbDisponible && SIN_DB }, async () => {
  // alta, PUT { activa: false }, comprobar las dos listas, borrar en finally
});

test('fijar la fecha de una salida a mano crea su acto en la Agenda', { skip: !dbDisponible && SIN_DB }, async () => {
  // alta MANUAL, PUT /api/cms/salidas/:id/fecha { inicio: '2099-10-17T18:00:00.000Z', lugar: 'Templo' }
  // → db.salida.eventoId apunta a un Evento con title = nombre; borrar evento y salida en finally
});
```

Escribir el cuerpo de las cinco últimas con el mismo patrón que la primera (para la cookie de hermano, ver cómo lo hace `test/fixtures/usuarios.js` o alguna prueba que use `Role.USER`).

Ejecutar: `npx tsx --test test/salidas-api-db.test.ts`. Esperado: FALLA con 404 en `/api/cms/salidas`.

- [ ] **Paso 3: servicio**

En `salidas.service.ts`:

```ts
static async crear(datos: DatosSalida, meta?: MetaDeAuditoria) {
  comprobarFecha(datos);
  try {
    const s = await db.salida.create({ data: { ...normalizar(datos) }, include: { acto: true } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.SALIDA_CREAR, meta ?? {}, 'salida', s.id, { despues: { slug: s.slug, nombre: s.nombre } });
    return s;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new HttpError('Ya hay una salida con ese nombre corto.', 409);
    throw e;
  }
}

static async editar(id: number, cambios: Partial<DatosSalida>, meta?: MetaDeAuditoria) {
  const antes = await SalidasService.porId(id);
  const datos = { ...antes, ...cambios } as DatosSalida;
  comprobarFecha(datos);
  // ...update con normalizar(cambios), mismo P2002 → 409, auditoría SALIDA_EDITAR con antes y después de los campos cambiados
}

/** Lo que la web necesita: la fila y su fecha de este año, ya calculada. */
static paraLaWeb(s: SalidaConActo, hoy = diaMadrid(new Date())): SalidaWeb {
  const regla = reglaDe(s);
  const anio = anioDeLaSalida(regla, hoy);
  return {
    id: s.id, slug: s.slug, nombre: s.nombre, orden: s.orden, activa: s.activa, conRopa: s.conRopa,
    cobro: s.cobro, importeCuota: Number(s.importeCuota), fecha: s.fecha, diasDesdePascua: s.diasDesdePascua,
    horaSalida: s.horaSalida, lugar: s.lugar, eventoId: s.eventoId, plazoAbierto: s.plazoAbierto,
    puestos: s.puestos as PuestoDelCatalogo[], cortejo: s.cortejo as ConfiguracionCortejo | null,
    indicaciones: s.indicaciones, anio, fechaDelAnio: fechaDeSalida(regla, anio),
  };
}
```

`comprobarFecha`: con `PASCUA` y `diasDesdePascua == null`, `HttpError('Di cuántos días antes o después de la Pascua es la salida.', 400)`. `normalizar`: con `MANUAL`, `diasDesdePascua: null`; `importeCuota` en `Prisma.Decimal`; `puestos` como `Prisma.InputJsonValue`.

- [ ] **Paso 4: controlador y rutas**

El controlador usa `manejar(...)`, como `hermano.controller.ts`. El `POST` responde `201` con `paraLaWeb`; el `PUT`, `200` con `paraLaWeb`. Las rutas, con `authenticateToken`, `checkRole` y `validate`, siguen el patrón de `procesion.routes.ts`. Borrar `PUT /procesion/admin/salida/fecha` y su controlador.

- [ ] **Paso 5: ejecutar**

`npx tsx --test test/salidas-api-db.test.ts`, luego `npm run comprobar-tipos` y `npm test`. Esperado: todo PASA, sin omitidas.

- [ ] **Paso 6: commit**

```bash
git add backend-desamparados/src backend-desamparados/test/salidas-api-db.test.ts
git commit -m "Salidas: API para darlas de alta, editarlas y fijar su fecha desde el CMS"
```

---

### Tarea 4: La web lee las salidas (API, hook y selector)

**Ficheros:**
- Crear: `desamparados-web/src/lib/api/salidas.ts`
- Crear: `desamparados-web/src/features/procesion/useSalidas.ts`
- Crear: `desamparados-web/src/features/procesion/SelectorSalida.tsx`
- Crear: `desamparados-web/src/features/procesion/__tests__/SelectorSalida.test.tsx`

**Interfaces:**
- Consume: `GET /api/salidas`, `GET/POST/PUT /api/cms/salidas`, `PUT /api/cms/salidas/:id/fecha`.
- Produce:
  - `interface Salida` (= `SalidaWeb` de la tarea 3) y `interface PuestoDelCatalogo`.
  - `salidas(): Promise<Salida[]>`, `salidasDelCms(): Promise<Salida[]>`, `crearSalida(d: DatosSalida)`, `editarSalida(id, d: Partial<DatosSalida>)`, `fijarFechaDeSalida(id, { inicio, lugar })`.
  - `CLAVE_SALIDAS = ['salidas'] as const`.
  - `useSalidas(opciones?: { delCms?: boolean }): UseQueryResult<Salida[]>`.
  - `useSalidaElegida(recordar: string): { salidas: Salida[]; salida: Salida | null; elegir(slug: string): void; cargando: boolean }`. Recuerda el slug en `localStorage` con la clave `recordar`, envuelto en try/catch, como `recordado()` en `MesaProcesionPage.tsx`. Si el slug recordado ya no existe, usa la primera.
  - `<SelectorSalida salidas={…} valor={slug} onChange={(slug) => …} />`: `ToggleButtonGroup`; con 0 o 1 salidas devuelve `null`.

- [ ] **Paso 1: prueba que falla**

```tsx
// src/features/procesion/__tests__/SelectorSalida.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SelectorSalida from '../SelectorSalida'
import type { Salida } from '../../../lib/api/salidas'

const salida = (slug: string, nombre: string) => ({ slug, nombre, id: slug.length } as Salida)

describe('SelectorSalida', () => {
  it('con una sola salida no pinta nada', () => {
    const { container } = render(<SelectorSalida salidas={[salida('sabado-de-pasion', 'Sábado de Pasión')]} valor="sabado-de-pasion" onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('con varias, una opción por salida y avisa del slug elegido', async () => {
    const onChange = vi.fn()
    render(<SelectorSalida salidas={[salida('sabado-de-pasion', 'Sábado de Pasión'), salida('rosario-vespertino', 'Rosario vespertino')]} valor="sabado-de-pasion" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Rosario vespertino' }))
    expect(onChange).toHaveBeenCalledWith('rosario-vespertino')
  })
})
```

Ejecutar: `cd desamparados-web && npx vitest run src/features/procesion --testTimeout=20000`. Esperado: FALLA porque no encuentra `../SelectorSalida`.

- [ ] **Paso 2: implementar**

```ts
// src/lib/api/salidas.ts
import { llamarApi } from './cliente'

/** Un puesto que sugiere la mesa, con la ropa que suele llevar. */
export interface PuestoDelCatalogo {
  nombre: string
  tunica: boolean
  tocado: 'CAPIROTE' | 'FARAONA' | null
  alturaHombro: boolean
}

/** Una salida procesional, tal como la define el CMS. Ver docs/superpowers/specs/2026-10-01-salidas-configurables-design.md. */
export interface Salida {
  id: number
  slug: string
  nombre: string
  orden: number
  activa: boolean
  conRopa: boolean
  cobro: 'CUOTA' | 'DONATIVO'
  importeCuota: number
  fecha: 'PASCUA' | 'MANUAL'
  diasDesdePascua: number | null
  horaSalida: string | null
  lugar: string | null
  eventoId: number | null
  plazoAbierto: boolean
  puestos: PuestoDelCatalogo[]
  cortejo: { tramos: { nombre: string; plazas: number }[]; puestos: string[] } | null
  indicaciones: string | null
  anio: number
  fechaDelAnio: string | null
}

export type DatosSalida = Omit<Salida, 'id' | 'eventoId' | 'plazoAbierto' | 'cortejo' | 'anio' | 'fechaDelAnio'>

export const CLAVE_SALIDAS = ['salidas'] as const

export const salidas = () => llamarApi<Salida[]>('/salidas')
export const salidasDelCms = () => llamarApi<Salida[]>('/cms/salidas')
export const crearSalida = (datos: DatosSalida) => llamarApi<Salida>('/cms/salidas', { method: 'POST', json: datos })
export const editarSalida = (id: number, datos: Partial<DatosSalida>) => llamarApi<Salida>(`/cms/salidas/${id}`, { method: 'PUT', json: datos })
export const fijarFechaDeSalida = (id: number, datos: { inicio: string; lugar?: string | null }) =>
  llamarApi<Salida>(`/cms/salidas/${id}/fecha`, { method: 'PUT', json: datos })
```

```ts
// src/features/procesion/useSalidas.ts
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CLAVE_SALIDAS, salidas, salidasDelCms } from '../../lib/api/salidas'

export function useSalidas({ delCms = false }: { delCms?: boolean } = {}) {
  return useQuery({ queryKey: [...CLAVE_SALIDAS, delCms ? 'cms' : 'web'], queryFn: delCms ? salidasDelCms : salidas })
}

const leer = (clave: string) => { try { return localStorage.getItem(clave) } catch { return null } }
const guardar = (clave: string, valor: string) => { try { localStorage.setItem(clave, valor) } catch { /* sin almacenamiento: no se recuerda */ } }

/** La salida con la que trabaja una pantalla, recordada por slug: con un id, una salida borrada y creada de nuevo se confundiría. */
export function useSalidaElegida(recordar: string) {
  const { data = [], isLoading } = useSalidas()
  const [slug, setSlug] = useState(() => leer(recordar))
  const salida = data.find((s) => s.slug === slug) ?? data[0] ?? null
  const elegir = (nuevo: string) => { setSlug(nuevo); guardar(recordar, nuevo) }
  return { salidas: data, salida, elegir, cargando: isLoading }
}
```

```tsx
// src/features/procesion/SelectorSalida.tsx
import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import type { Salida } from '../../lib/api/salidas'

/** Con una sola salida no hay nada que elegir: no se pinta. */
export default function SelectorSalida({ salidas, valor, onChange }: { salidas: Salida[]; valor: string; onChange: (slug: string) => void }) {
  if (salidas.length < 2) return null
  return (
    <ToggleButtonGroup exclusive size="small" value={valor} onChange={(_, v: string | null) => v && onChange(v)} aria-label="Salida">
      {salidas.map((s) => <ToggleButton key={s.slug} value={s.slug}>{s.nombre}</ToggleButton>)}
    </ToggleButtonGroup>
  )
}
```

Comprobar cómo importan los demás `useQuery` (`@tanstack/react-query`) y si `llamarApi` antepone `/api`; ajustar si no.

- [ ] **Paso 3: ejecutar**

`npx vitest run src/features/procesion --testTimeout=20000`: PASA. `npx tsc -b`: sin errores en estos ficheros.

- [ ] **Paso 4: commit**

```bash
git add desamparados-web/src/lib/api/salidas.ts desamparados-web/src/features/procesion
git commit -m "Salidas: la web las lee, con un selector que se oculta si solo hay una"
```

---

### Tarea 5: Pantalla «Salidas» en el CMS

**Ficheros:**
- Crear: `desamparados-web/src/features/cms/salidas/SalidasAdminPage.tsx` (listado y botón «Nueva salida»)
- Crear: `desamparados-web/src/features/cms/salidas/VentanaNuevaSalida.tsx` (alta en ventana: nombre, slug sugerido desde el nombre, fecha por Pascua o a mano y cobro; lo demás se rellena después)
- Crear: `desamparados-web/src/features/cms/salidas/SalidaEditPage.tsx` (pantalla propia por grupos)
- Crear: `desamparados-web/src/features/cms/salidas/slug.ts` y su prueba
- Crear: `desamparados-web/src/features/cms/__tests__/SalidasAdminPage.test.tsx`
- Modificar: `desamparados-web/src/routes/index.tsx`, `desamparados-web/src/app/cmsNavegacion.ts`

**Interfaces:**
- Consume (tarea 4): `useSalidas({ delCms: true })`, `crearSalida`, `editarSalida`, `fijarFechaDeSalida`, `CLAVE_SALIDAS`, `Salida`, `DatosSalida`.
- Produce: rutas `/cms/procesion/salidas` y `/cms/procesion/salidas/:id/editar`, con `rolesPorRutaCms['procesion/salidas'] = ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR']`. El `HERMANO_MAYOR` ve los datos sin poder guardarlos: los botones de guardar se ocultan si el rol no es `ADMIN` ni `SECRETARIA`. Mirar cómo lo resuelve `ProcesionAdminPage.tsx` con el plazo.

Antes de maquetar, leer la skill `frontend` y una pantalla de alta en ventana que ya exista (buscar `Dialog` con «Nuevo» en `features/cms`) y copiar su estructura.

- [ ] **Paso 1: prueba del slug (falla)**

```ts
// src/features/cms/salidas/__tests__/slug.test.ts
import { describe, expect, it } from 'vitest'
import { slugDe } from '../slug'

describe('slugDe', () => {
  it('quita tildes, eñes y signos', () => {
    expect(slugDe('Sábado de Pasión')).toBe('sabado-de-pasion')
    expect(slugDe('  Rosario  vespertino! ')).toBe('rosario-vespertino')
    expect(slugDe('Año Jubilar')).toBe('ano-jubilar')
  })
})
```

Implementar:

```ts
// src/features/cms/salidas/slug.ts
/** El nombre corto de la dirección, a partir del nombre: lo que valida la API (`^[a-z0-9]+(-[a-z0-9]+)*$`). */
export const slugDe = (nombre: string) =>
  nombre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
```

`\p{M}` (marcas diacríticas, con la bandera `u`) quita las tildes que `normalize('NFD')` separa, sin escribir escapes `\u` que las herramientas de escritura convierten en caracteres literales.

- [ ] **Paso 2: prueba de la pantalla (falla)**

En `SalidasAdminPage.test.tsx`, con el mismo montaje (QueryClient y router) que `features/cms/__tests__/CortejoDirectoPage.test.tsx`, y simulando `salidasDelCms` con `vi.mock('../../../lib/api/salidas')`:
- Lista las dos salidas por orden, con «Por la Pascua: 28 de marzo de 2026» o «A mano: sin fecha» y una marca «Desactivada» si `activa` es false.
- «Nueva salida» abre la ventana. Al escribir el nombre «Traslado», el campo del slug propone `traslado`. Al guardar, llama a `crearSalida` con `fecha: 'PASCUA'` y `diasDesdePascua` numérico, y después navega a `/cms/procesion/salidas/:id/editar`.

- [ ] **Paso 3: implementar las tres piezas**

- **Listado:** una tarjeta o fila por salida con el nombre, la fecha del año en palabras, el cobro (si es cuota, «Cuota de X €»; si es donativo, «Donativo»), «Con túnica» si `conRopa`, y el estado del plazo. Pulsar la fila lleva a editar.
- **Edición:** secciones, cada una con su «Guardar» (patrón de las fichas del CMS):
  1. **Datos:** nombre, slug, orden y el interruptor «Activa». Al desactivar se avisa: «Deja de salir en la mesa y en el área de hermanos. Sus papeletas se conservan».
  2. **Fecha:** un radio entre «Por la Pascua» y «A mano». Con la Pascua, «días desde el Domingo de Resurrección» y la ayuda «−8 es el Sábado de Pasión»; debajo, «Este año: sábado 28 de marzo de 2026» calculado con `fechaDelAnio` (tras guardar) y los campos «Hora» y «Lugar». A mano, fecha y hora y lugar, que llaman a `fijarFechaDeSalida` y explican que se crea o se mueve el acto en la Agenda.
  3. **Cobro:** un radio entre cuota y donativo. Con cuota, su importe; si es 0, la ayuda «Con 0 €, el hermano no ve nada que pagar».
  4. **Ropa:** el interruptor «Se da ropa del ropero (túnica, capirote…)».
  5. **Puestos:** lista editable (nombre, túnica, tocado, altura al hombro), con añadir, quitar y subir/bajar. Como mínimo uno.
  6. **Indicaciones:** texto libre, con la ayuda «Van en la papeleta y en los correos: vestimenta, medalla, puntualidad…».
- Tras guardar: `queryClient.invalidateQueries({ queryKey: CLAVE_SALIDAS })`.
- Los errores de la API (409 del slug, 400) se enseñan junto al campo o en el aviso de la sección, como en el resto del CMS.

- [ ] **Paso 4: rutas y navegación**

En `routes/index.tsx`, junto a `procesion/puerta`:

```tsx
{ path: 'procesion/salidas', element: <ExigeRol roles={rolesPorRutaCms['procesion/salidas']}>{withSuspense(SalidasAdminPage)}</ExigeRol> },
{ path: 'procesion/salidas/:id/editar', element: <ExigeRol roles={rolesPorRutaCms['procesion/salidas']}>{withSuspense(SalidaEditPage)}</ExigeRol> },
```

En `cmsNavegacion.ts`, después de «Procesión», añadir `{ label: 'Salidas', href: '/cms/procesion/salidas', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: EventRepeatOutlinedIcon }`, y añadir la clave a `rolesPorRutaCms`, con el comentario de qué ruta de la API la guarda. Si `MarcoCms.tsx` resuelve la entrada activa por prefijo, comprobar que en `/cms/procesion/salidas` se marca «Salidas» y no «Procesión».

- [ ] **Paso 5: ejecutar**

`npx vitest run src/features/cms --testTimeout=20000` y `npx tsc -b`. Esperado: PASA.

- [ ] **Paso 6: commit**

```bash
git add desamparados-web/src
git commit -m "Salidas: pantalla del CMS para darlas de alta y editarlas"
```

---

### Tarea 6: Las pantallas de procesión, sin salidas fijas

**Ficheros (todos en `desamparados-web/src`):**
- `lib/api/procesion.ts`, `lib/api/mesa.ts`, `lib/api/comunicados.ts`: borrar `type Salida = 'PASION' | 'ROSARIO'` e importar `Salida` de `lib/api/salidas.ts`. Las funciones que reciben la salida reciben **el slug** (`salida: string`) y lo mandan **siempre** (`?salida=${encodeURIComponent(slug)}`). Desaparecen `deLaSalida`, `fijarRosario` y `cambiarCuotaSalida`: la cuota se edita en la pantalla Salidas. `plazoDePapeletas(slug)` devuelve `fecha` en lugar de `rosario`. `conPapeleta` pasa a `number | null`.
- `features/cms/mesa/formato.ts`: borrar `PUESTOS_POR_SALIDA` y `NOMBRE_SALIDA`. `puestoDelCatalogo(nombre, puestos: PuestoDelCatalogo[])`.
- `features/cms/mesa/MesaProcesionPage.tsx`: `useSalidaElegida('mesa.salida')` y `<SelectorSalida>` en lugar de los dos `ToggleButton`. Las zonas `soloPasion` pasan a ser `soloConRopa` y se filtran con `salida.conRopa`. Los textos: «Listos para la ropa» si `conRopa` y «Listos para confirmar» si no. El subtítulo usa `salida.nombre`. Mientras `cargando`, el esqueleto de siempre; sin salidas activas, el aviso «No hay salidas activas. Créalas en Procesión → Salidas.» con un enlace.
- `features/cms/mesa/{ZonaInscripcion,ZonaTesoreria,ZonaTunicas,FormularioCorreccion,TablaApuntados,PreparacionRopa,BuscadorPersonas}.tsx`: `ficha.salida === 'ROSARIO'` pasa a `salida.cobro === 'DONATIVO'` (donativo) o `!salida.conRopa` (ropa), según de qué hable cada línea. Las que no tienen la salida a mano la reciben por prop desde `MesaProcesionPage`. `PreparacionRopa` deja de pedir los turnos con `'PASION'` y usa la salida elegida.
- `features/cms/puerta/PuertaTemploPage.tsx`: `useSalidaElegida('puerta.salida')` y `<SelectorSalida>`.
- `features/cms/ProcesionAdminPage.tsx`: las pestañas salen de `useSalidas()` (una por salida, `value={s.slug}`) en lugar de las dos `Tab` fijas y del `NOMBRE`. El bloque del Rosario (fijar la fecha) pasa a mostrarse para cualquier salida con `fecha === 'MANUAL'`: enseña la fecha del acto y un enlace «Cambiar la fecha en Salidas». Los textos del diálogo «¿Abrir…?» usan `salida.nombre`. Si el plazo responde 409 «Pon antes la fecha…», se enseña tal cual.
- El editor del cortejo (buscar `cortejo` en `features/cms`): recibe el slug de la salida elegida.
- `features/cms/ComunicadoEditPage.tsx`: los `MenuItem` de «Con papeleta del…» salen de `useSalidas()`, con `value={s.id}`.
- `features/cms/AuditoriaAdminPage.tsx`: `ROSARIO_FECHAR` pasa a `SALIDA_FECHAR: 'Poner fecha a una salida'`, y se añaden `SALIDA_CREAR: 'Dar de alta una salida'` y `SALIDA_EDITAR: 'Cambiar una salida'`.
- `features/areaHermano/procesion/ProcesionPage.tsx`: quitar el import del JSON y el `Record` de las líneas 49-50. Los puestos salen de `salida.puestos`; la lista de salidas, de `estado.salidas` (que la API ya devuelve recorriendo las activas) en lugar de `['PASION', 'ROSARIO']`. `salida === 'ROSARIO'` pasa a `cobro === 'DONATIVO'` para el donativo y a `!conRopa` para la talla y la túnica.
- `features/areaHermano/procesion/HistoricoPage.tsx`: `{ticket.year} · {ticket.salida.nombre}` (la API de mis papeletas incluye `salida: { nombre }`; si no lo hace, añadirlo en `papeletas.service.ts`).
- La pantalla de Datos e informes (buscar quién consume `datos.service` en `features/cms`): pinta `porSalida` en lugar de los campos fijos de la Pasión y el Rosario.
- Borrar `shared/puestos-procesion.json`.

**Interfaces:**
- Consume (tareas 2 a 4): las rutas con `?salida=<slug>` obligatorio, `useSalidas`, `useSalidaElegida` y `SelectorSalida`.

- [ ] **Paso 1: localizar todos los usos**

`grep -rnE "PASION|ROSARIO|puestos-procesion|NOMBRE_SALIDA|PUESTOS_POR_SALIDA|fijarRosario|cambiarCuotaSalida" desamparados-web/src shared` sirve de lista de comprobación. Al terminar la tarea, solo puede quedar texto de contenido (portada, historia), nunca código.

- [ ] **Paso 2: pruebas que fallan**

Actualizar las pruebas de la web que montan estas pantallas (`grep -rlE "PASION|ROSARIO" desamparados-web/src --include=*.test.tsx`) para que simulen `salidas` con las dos filas, y añadir:
- En la prueba de `MesaProcesionPage` (crearla si no existe, con el montaje de `CortejoDirectoPage.test.tsx`): con una sola salida sin ropa no hay selector, y no aparecen las zonas Preparación, Devolución ni Túnicas.
- En la de `ProcesionPage` del área: con tres salidas activas y dos con plazo abierto, se ofrecen esas dos.

Ejecutar `npx vitest run --testTimeout=20000`. Esperado: FALLAN las nuevas.

- [ ] **Paso 3: cambiar los ficheros de la lista de arriba**

- [ ] **Paso 4: ejecutar**

`npx tsc -b` y `npx vitest run --testTimeout=20000`. Esperado: 0 errores y 0 fallos. Repetir el `grep` del paso 1: sin código.

- [ ] **Paso 5: commit**

```bash
git add desamparados-web/src shared
git commit -m "Salidas: mesa, puerta, plazo, avisos y área de hermanos sin salidas fijas"
```

---

### Tarea 7: De punta a punta, documentación y hoja de ruta

**Ficheros:**
- Modificar: `docs/hoja-de-ruta.md` (fila «Lo propio del Grupo, a configuración»)
- Modificar: `docs/notas-del-proyecto.md` (si hay notas sobre `PASION`/`ROSARIO`, `papeletas_abiertas` o `rosario_evento_id`)
- Modificar: `.claude/skills/cms/SKILL.md` o `.claude/skills/backend/SKILL.md`, si nombran el enum de salidas

- [ ] **Paso 1: suites completas**

Backend: `npm run comprobar-tipos` y `npm test` con MariaDB arrancada. Web: `npx tsc -b` y `npx vitest run --testTimeout=20000`. Las cuatro en verde y ninguna prueba con BD omitida.

- [ ] **Paso 2: la app arrancada, de punta a punta**

Las suites en verde no bastan: ya pasó que arrancar la app destapó fallos que ellas no veían. Arrancar el backend (`npm run dev`) y la web (`npm run dev`, en el puerto que use el usuario), y después:
1. En el CMS, Procesión → Salidas: las dos salidas de siempre, con «Este año: 28 de marzo de 2026» en la Pasión.
2. «Nueva salida»: «Traslado», por la Pascua, −10, cuota de 0 €, sin ropa, un puesto «Acompañante». Se guarda y aparece en la lista.
3. Procesión: aparece su pestaña. Crear un día de reparto antes de la fecha y abrir el plazo.
4. En el área de hermanos, con una cuenta de prueba: aparece «Traslado» y el hermano se apunta.
5. En la mesa, elegir «Traslado»: no hay zonas de ropa. Inscribir, cobrar (0 €) y confirmar la papeleta.
6. En la puerta, «Traslado»: escanear o teclear el código de la papeleta, que entra.
7. Crear otra salida a mano sin fecha e intentar abrir su plazo: sale «Pon antes la fecha de la salida en la Agenda.»
8. Desactivar «Traslado»: desaparece de la mesa y del área, pero sigue en Salidas como «Desactivada».

Capturar la pantalla de Salidas y la de la mesa con la salida nueva. Si la extensión o el MCP fallan, usar el script de Playwright local con el Chrome del sistema. Al terminar, borrar las salidas de prueba desde la base (`DELETE` de sus papeletas, solicitudes y turnos, y luego de la salida) o dejarlas desactivadas, y decirle al usuario qué se dejó.

- [ ] **Paso 3: documentación**

En la hoja de ruta, la fila pasa a decir lo que hay. Las salidas quedan hechas; lo que falta ahora es el género, así que el estado sigue siendo 🟡 (o 🔨 si se va a seguir). Por ejemplo:

```markdown
| 🟡 | B | Lo propio del Grupo, a configuración | Hecha la identidad (…lo que ya decía…). **Hechas las salidas**: Procesión → «Salidas» define las que tenga cada corporación (fecha por la Pascua o a mano con su acto de la Agenda, cuota o donativo, con ropa o sin ella, puestos, cortejo e indicaciones); la mesa, la puerta, el plazo, los avisos y el área de hermanos las leen de ahí. Migración `salidas_configurables`. **Falta decidir**: «el Grupo Parroquial» sigue en decenas de frases con su género (para una Hermandad serían «la»/«de la»). |
```

Copiar la parte de la identidad tal como está ahora en la fila; no resumirla.

- [ ] **Paso 4: commit**

```bash
git add docs .claude
git commit -m "Hoja de ruta: salidas configurables, hechas"
```

Decirle al usuario que lo suba con `! git push`.
