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
| ⬜ | A | Donativos en línea desde la web pública | La pasarela ya está |
| ✅ | — | **Remesas SEPA (XML de adeudos)** | Hecha: Tesorería → Remesas junta los pendientes de quienes domicilian (con los que se quedan fuera y por qué), genera el `pain.008.001.02` (validado contra el XSD oficial), lo guarda para volver a descargarlo y da la remesa por cobrada con sus asientos. El mandato lleva la fecha en que el hermano dio la cuenta. Migración `remesas_sepa`. **Para usarlo faltan el identificador de acreedor y la cuenta del Grupo** (ver `despliegue.md`, «Las remesas SEPA») |
| ✅ | — | **Devoluciones con la Norma 43** | Hecha: Tesorería → Remesas → «Extracto del banco». Lee el fichero Norma 43 (comprueba totales y saldos), reconoce las devoluciones por el `REC-…` o el mandato que el banco repite y el abono de cada remesa por su identificador o su total; enseña lo que hará y lo dudoso antes de aplicarlo. Subir dos veces el mismo extracto no hace nada |

## Fase 2 · Procesión

| | PC | Tarea | Notas |
|---|---|---|---|
| ⬜ | A | Papeleta de sitio en PDF con código QR | La librería de QR ya está en el backend |
| ⬜ | B | Escaneo del QR en la puerta del templo | Asistencia en vivo por tramos |
| ✅ | — | **Cortejo por antigüedad, automático** | Hecha: Procesión → «Cortejo». Los tramos de cada salida (nombre y plazas) y los puestos que se reparten van en la configuración; «Repartir por antigüedad» pone a los más nuevos delante y a los más antiguos junto al trono, en proporción a las plazas, y escribe tramo y lugar en cada papeleta. Enseña antes cuántas cambian y la lista de cada tramo |
| 🟡 | A | Túnica propuesta según la medida | Hay altura al hombro y tallas; falta proponerla sola |

## Fase 3 · Comunicación

| | PC | Tarea | Notas |
|---|---|---|---|
| ✅ | — | **Boletín y avisos masivos, segmentados** | Hecha: Web → «Boletín y avisos». El boletín va solo a los suscritos y lleva su enlace de baja firmado; el aviso, a los activos del segmento (papeleta de una salida, cuotas pendientes, edad, población). Recuento de direcciones antes de enviar, prueba a uno mismo, un correo por dirección y envío poco a poco en segundo plano, que se reanuda si el servidor se reinicia y deja reintentar los fallidos. Migración `comunicados` |
| ⬜ | A | Cartas y circulares en PDF con los datos de cada hermano | Reutiliza el motor de los informes |
| ⬜ | A | Etiquetas postales | Para los hermanos sin correo |

## Fase 4 · Secretaría

| | PC | Tarea | Notas |
|---|---|---|---|
| ✅ | — | **Importar y exportar el censo (Excel / CSV)** | Hecha: Hermanos → «Exportar» (Excel o CSV, activos o con bajas, sin datos bancarios, con rastro en la auditoría) e «Importar» (reconoce los títulos habituales, enseña antes qué filas entran y por qué no las otras, no duplica a quien ya está, da cuenta propia a quien trae DNI y correo y número por antigüedad a los activos que no lo traen). Dependencia nueva: `exceljs` |
| ✅ | — | **Cabildos y actas** | Hecha: Junta → «Cabildos». Convocar (con la convocatoria como borrador de aviso a los mayores de edad), apuntar la asistencia con el quórum a la vista (voto: activos, mayores de edad y con un año de antigüedad; reglas en `Configuracion`), votaciones por mayoría simple o de dos tercios, celebrarlo en primera o segunda convocatoria (fija el censo con voto), redactar y aprobar el acta, que queda cerrada. Acta y libro de actas del año en PDF. Migración `cabildos` |
| 🟡 | A | Difuntos y sufragios | Hay baja por fallecimiento; faltan fecha del óbito, aniversarios y misas |
| 🟡 | A | Ficha: medalla, tratamiento y listas guardadas | La ficha está casi completa |

## Fase 5 · Tesorería avanzada

| | PC | Tarea | Notas |
|---|---|---|---|
| ✅ | — | **Contabilidad por partida doble (plan de entidades sin fines lucrativos)** | Hecha: Contabilidad → «Partida doble». Cada categoría tiene su cuenta del plan (propuesta por el nombre, se cambia en «Plan de cuentas»); los asientos salen de los apuntes del libro de caja (570 Caja si es en efectivo, 572 Bancos si no), así que lo que apunten la lotería o la caja de la tienda entra solo. Cuenta de resultados, sumas y saldos, libro diario y Excel del ejercicio. Migración `cuenta_de_categoria` |
| ⬜ | B | Modelo 182 y certificados de donación | **Antes, confirmar** que el Grupo tiene NIF propio y no depende del del Obispado |
| ⬜ | A | Lotería y talonarios | |
| 🟡 | A | Caja de tienda (TPV) | La mesa de procesión ya cobra por zonas |

## Fase 6 · Patrimonio y recaudación

| | PC | Tarea | Notas |
|---|---|---|---|
| 🟡 | A | Ficha completa de patrimonio | Hay enseres con estado, foto y ubicación; faltan varias fotos, descripción y tasación |
| ✅ | — | **Tienda en línea** | Hecha: /tienda en la web pública (cesta, compra sin cuenta, pago con la pasarela de Redsys, recogida en Secretaría) y Cuentas → «Tienda» en el CMS (productos con foto, precio y existencias; pedidos por entregar). El aviso del banco descuenta existencias, apunta el ingreso («Ventas de la tienda» → 700) y manda el correo; si ya no queda, incidencia para devolver. La pasarela admite ya pagos sin cuenta (`PagoEnLinea.origen`). Migración `tienda` |
| ✅ | — | **Apadrinamiento sobre una foto (velas, piezas)** | Hecho: /apadrina en la web (bajo «Sagrada titular»), con cada campaña en su foto y las piezas encima; se elige una libre, se dan los datos (dedicatoria y si sale el nombre) y se paga sin cuenta. En el CMS, Censo y procesión → «Apadrinamientos»: se pulsa en la foto para poner una pieza y se ve quién apadrinó cada una. El aviso del banco la marca apadrinada, apunta el ingreso («Apadrinamientos» → 740) y manda el correo; si otro se adelantó, incidencia para devolver. Migración `apadrinamientos` |

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
