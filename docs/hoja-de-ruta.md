# Hoja de ruta

Qué le falta a la web del Grupo para ser la más completa del sector, en qué
orden se hace y cómo va. Nace el 30-09-2026 de comparar el proyecto con las 26
funciones que anuncia un programa cofrade de la competencia.

**El objetivo:** primero la web del Grupo, completa. Después, venderla a otras
corporaciones con **una instalación por cliente** (su servidor, su base, su
dominio), no como un servicio multi-cliente.

**Cómo se lleva:** cada commit que cierre o adelante una tarea marca aquí su
estado y su commit. Una tarea está **hecha** cuando está subida, probada y con
su migración anotada si la lleva.

| Marca | Significa |
|---|---|
| ✅ | Hecha y subida |
| 🔨 | En marcha |
| 🟡 | A medias: hay una parte en el código (se dice cuál) |
| ⬜ | Sin empezar |
| ⏸ | Aparcada a propósito (se dice por qué) |

---

## Reparto entre los dos PC

Desde el 30-09-2026 se trabaja en dos equipos a la vez, cada uno con su Claude:

- **A**: las tareas más sencillas y acotadas.
- **B**: las complejas, las que necesitan más contexto y más tokens.

Cada uno coge **solo las suyas** (columna «PC»). Las marcadas con «—» están
hechas o aparcadas.

**Dependencias entre los dos:**

- El escaneo del QR (B) necesita la papeleta con QR (A): A la hace primero.
- La lotería y la caja de tienda (A) apuntan en la contabilidad de hoy; la
  partida doble (B) tiene que recoger también lo que ellas apunten.
- Las remesas SEPA van antes que la Norma 43 (las dos, B).

**Para no pisarse:**

- `git pull` antes de empezar cada tarea (y `npx prisma generate` en el
  backend); subir cada tarea en cuanto esté en verde, sin acumular.
- Migraciones: `git pull` justo antes de crear una y subirla enseguida. La
  hora del nombre de la carpeta distingue al PC: `…100000_` en A, `…200000_`
  en B.
- `schema.prisma`, `app.ts`, las acciones de auditoría, el menú del CMS y
  este fichero los tocan los dos: en un conflicto, se juntan los cambios a
  mano, nunca se descarta lo del otro.
- Al empezar una tarea, marcarla 🔨 aquí y subirlo: así el otro sabe que está
  cogida.

## Regla para todo lo que venga

Lo propio del Grupo (nombre, escudo, colores, salidas, puestos, importes, datos
bancarios) va en configuración o en `shared/`, **nunca escrito en el código**.
Así, instalarlo para otra corporación es rellenar su configuración.

---

## Fase 1 · Cobros

| | PC | Tarea | Notas |
|---|---|---|---|
| ✅ | — | **Pasarela de pago (Redsys: tarjeta y Bizum)** | Hecha: pago desde Procesión, aviso firmado del banco, incidencias en Tesorería; probado de punta a punta con el entorno de pruebas de Redsys el 30-09-2026 (pago con tarjeta y aviso del banco por un túnel). Bizum llega a la pantalla de Bizum, pero el terminal público de pruebas no deja autenticarse: se probará con el terminal de pruebas del banco. Migración `pagos_en_linea`. **Para cobrar de verdad faltan las claves del banco** (ver `despliegue.md`, «El pago en línea») |
| ✅ | A | Donativos en línea desde la web pública | Hecho: bloque «Donativo» del constructor (importes y destinos editables), pago con tarjeta o Bizum sin cuenta, apunte en la contabilidad y gracias por correo. Migración `donativos_en_linea`. Falta colocarlo en una página desde el CMS (Caridad, por ejemplo) |
| 🟡 | B | Remesas SEPA (XML de adeudos) | Hay IBAN y titular en la ficha y el estado «remesado» en los recibos. Falta generar el fichero para el banco |
| ⬜ | B | Devoluciones con la Norma 43 | Subir el extracto del banco y casar cobros y devoluciones solos |

## Fase 2 · Procesión

| | PC | Tarea | Notas |
|---|---|---|---|
| ✅ | A | Papeleta de sitio en PDF con código QR | Hecha: A4 que se imprime en la mesa al dar la ropa (y se reimprime desde el listado), adjunta al correo, y tarjeta con el QR en Procesión del área de hermanos |
| ⬜ | B | Escaneo del QR en la puerta del templo | Asistencia en vivo por tramos. **La papeleta con QR ya está**: el código, en `papeleta-qr.ts` (ver abajo) |
| 🟡 | B | Cortejo por antigüedad, automático | Hay solicitud de puesto, tramo y número en la papeleta; falta el reparto automático |
| ✅ | A | Túnica propuesta según la medida | Hecha: sin túnica en casa ni libre la de antes, se propone la libre de talla más cercana a su altura al hombro (+5/−3 cm), en la ficha de la mesa y en la hoja del ropero sin repetir |

**El código del QR de la papeleta** (contrato entre A y B), en
`backend-desamparados/src/domain/papeleta-qr.ts`:

- El QR lleva solo el texto `DSP1.<id de la papeleta>.<firma>`: sin datos
  personales ni URL.
- `codigoDePapeleta(id)` lo genera (la papeleta, A) y
  `leerCodigoDePapeleta(texto)` devuelve el id o null si es falso (el
  escaneo, B).
- Si la papeleta sigue valiendo (no anulada, de esta salida y año) lo decide
  el escaneo mirando la base, no el código.

## Fase 3 · Comunicación

| | PC | Tarea | Notas |
|---|---|---|---|
| 🟡 | B | Boletín y avisos masivos, segmentados | Hay la casilla de suscripción y la plantilla de correo; falta el editor y el envío |
| ⬜ | A | Cartas y circulares en PDF con los datos de cada hermano | Reutiliza el motor de los informes |
| ⬜ | A | Etiquetas postales | Para los hermanos sin correo |

## Fase 4 · Secretaría

| | PC | Tarea | Notas |
|---|---|---|---|
| ⬜ | B | Importar y exportar el censo (Excel / CSV) | Imprescindible para instalarlo a otra corporación |
| ⬜ | B | Cabildos y actas | Convocatoria, quórum, votaciones y libro de actas |
| 🟡 | A | Difuntos y sufragios | Hay baja por fallecimiento; faltan fecha del óbito, aniversarios y misas |
| 🔨 | A | Ficha: medalla, tratamiento y listas guardadas | La ficha está casi completa |

## Fase 5 · Tesorería avanzada

| | PC | Tarea | Notas |
|---|---|---|---|
| 🟡 | B | Contabilidad por partida doble (plan de entidades sin fines lucrativos) | Hoy es partida simple por categorías, enlazada a los recibos |
| ⬜ | B | Modelo 182 y certificados de donación | **Antes, confirmar** que el Grupo tiene NIF propio y no depende del del Obispado |
| ⬜ | A | Lotería y talonarios | |
| 🟡 | A | Caja de tienda (TPV) | La mesa de procesión ya cobra por zonas |

## Fase 6 · Patrimonio y recaudación

| | PC | Tarea | Notas |
|---|---|---|---|
| 🟡 | A | Ficha completa de patrimonio | Hay enseres con estado, foto y ubicación; faltan varias fotos, descripción y tasación |
| ⬜ | B | Tienda en línea | La pasarela ya está |
| ⬜ | B | Apadrinamiento sobre una foto (velas, piezas) | La pasarela ya está |

## Fase 7 · Extras

| | PC | Tarea | Notas |
|---|---|---|---|
| 🟡 | B | Posición del cortejo en directo | Hay recorrido en el mapa, simulado |
| ⏸ | — | Notificaciones push | Exige hacer la web instalable; el correo cubre lo mismo |
| ⏸ | — | Firma en pantalla | Poco valor legal; basta un consentimiento registrado con fecha |
| ⏸ | — | Asistente con IA | Vistoso, pero lo último que decide una compra |

## Fase 8 · Preparar la venta

| | PC | Tarea | Notas |
|---|---|---|---|
| ⬜ | B | Lo propio del Grupo, a configuración | Hoy el nombre está en el código y las salidas son un enum (`PASION`, `ROSARIO`) |
| ⬜ | B | Guion de instalación y de actualización de varias copias | |
| ⬜ | A | Contrato de encargado del tratamiento | Cada cliente es responsable de los datos de sus hermanos |
| ⬜ | A | Licencias y fotos de ejemplo | Fuentes, mapas de OpenStreetMap y fotos de Commons |

---

## Ya hecho (lo que se anuncia en el sector y ya tenemos)

- Ficha del hermano y censo, con altas, bajas y motivo, e impagos.
- Alta en línea con foto, certificado de bautismo e IBAN, aprobada por la junta.
- Préstamo de túnicas: prendas numeradas, lavado, taller, cíngulos y devolución.
- Correos con la imagen del Grupo.

Y lo que no anuncia nadie: web pública editable por bloques con historial,
mesa de procesión en tiempo real por zonas, agenda con suscripción de
calendario, informe anual en PDF, doble factor y registro de auditoría.
