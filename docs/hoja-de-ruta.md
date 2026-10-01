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

- El escaneo del QR necesita la papeleta con QR: hechas las dos (A).
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
| ✅ | — | **Remesas SEPA (XML de adeudos)** | Hecha: Tesorería → Remesas junta los pendientes de quienes domicilian (con los que se quedan fuera y por qué), genera el `pain.008.001.02` (validado contra el XSD oficial), lo guarda para volver a descargarlo y da la remesa por cobrada con sus asientos. El mandato lleva la fecha en que el hermano dio la cuenta. Migración `remesas_sepa`. **Para usarlo faltan el identificador de acreedor y la cuenta del Grupo** (ver `despliegue.md`, «Las remesas SEPA») |
| ✅ | — | **Devoluciones con la Norma 43** | Hecha: Tesorería → Remesas → «Extracto del banco». Lee el fichero Norma 43 (comprueba totales y saldos), reconoce las devoluciones por el `REC-…` o el mandato que el banco repite y el abono de cada remesa por su identificador o su total; enseña lo que hará y lo dudoso antes de aplicarlo. Subir dos veces el mismo extracto no hace nada |

## Fase 2 · Procesión

| | PC | Tarea | Notas |
|---|---|---|---|
| ✅ | A | Papeleta de sitio en PDF con código QR | Hecha: A4 que se imprime en la mesa al dar la ropa (y se reimprime desde el listado), adjunta al correo, y tarjeta con el QR en Procesión del área de hermanos |
| ✅ | A | Escaneo del QR en la puerta del templo | Hecho: Censo y procesión → «Puerta del templo», pensada para el móvil. La cámara lee el QR de la papeleta (lector nativo en Android, `jsqr` en iPhone) o un lector de mano por el campo de texto; dice en grande si entra, si ya entró, si es de otra salida, anulada o falsa, y vibra. Cuentas por tramo que se refrescan solas cada 5 s, lista de los que faltan para marcar a mano a quien llega sin papeleta, y «Deshacer» (queda en la auditoría). Dos diputados leyendo la misma no la apuntan dos veces. Migración `puerta_del_templo` |
| ✅ | — | **Cortejo por antigüedad, automático** | Hecha: Procesión → «Cortejo». Los tramos de cada salida (nombre y plazas) y los puestos que se reparten van en la configuración; «Repartir por antigüedad» pone a los más nuevos delante y a los más antiguos junto al trono, en proporción a las plazas, y escribe tramo y lugar en cada papeleta. Enseña antes cuántas cambian y la lista de cada tramo |
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
| ✅ | — | **Boletín y avisos masivos, segmentados** | Hecha: Web → «Boletín y avisos». El boletín va solo a los suscritos y lleva su enlace de baja firmado; el aviso, a los activos del segmento (papeleta de una salida, cuotas pendientes, edad, población). Recuento de direcciones antes de enviar, prueba a uno mismo, un correo por dirección y envío poco a poco en segundo plano, que se reanuda si el servidor se reinicia y deja reintentar los fallidos. Migración `comunicados` |
| ✅ | A | Cartas y circulares en PDF con los datos de cada hermano | Hecho: sección «Cartas» (Secretaría) con campos ({{nombre}}, {{tratamiento}}…), destinatarios de una búsqueda o lista guardada del censo (nunca difuntos), vista previa y PDF de todas, con la dirección en la ventana del sobre. Migración `cartas` |
| ✅ | A | Etiquetas postales | Hecho: Cartas → «Etiquetas postales». De partida, los activos sin correo electrónico (o cualquier lista guardada del censo; nunca difuntos, y sin dirección, la del titular); una por hermano o una por casa («Familia …»); hojas A4 de 24, 21 y 14 (`shared/formatos-de-etiquetas.json`) y se puede empezar en una hoja ya gastada. Las direcciones largas se parten, nunca se recortan. Sin migración |
| 🔨 | A | Emails: plantillas de los correos | Plantillas editables, una por uso (bienvenida, papeleta, pésame…), con varias por uso y una en uso; las tocan Secretaría y el Hermano Mayor |

## Fase 4 · Secretaría

| | PC | Tarea | Notas |
|---|---|---|---|
| ✅ | — | **Importar y exportar el censo (Excel / CSV)** | Hecha: Hermanos → «Exportar» (Excel o CSV, activos o con bajas, sin datos bancarios, con rastro en la auditoría) e «Importar» (reconoce los títulos habituales, enseña antes qué filas entran y por qué no las otras, no duplica a quien ya está, da cuenta propia a quien trae DNI y correo y número por antigüedad a los activos que no lo traen). Dependencia nueva: `exceljs` |
| ✅ | — | **Cabildos y actas** | Hecha: Junta → «Cabildos». Convocar (con la convocatoria como borrador de aviso a los mayores de edad), apuntar la asistencia con el quórum a la vista (voto: activos, mayores de edad y con un año de antigüedad; reglas en `Configuracion`), votaciones por mayoría simple o de dos tercios, celebrarlo en primera o segunda convocatoria (fija el censo con voto), redactar y aprobar el acta, que queda cerrada. Acta y libro de actas del año en PDF. Migración `cabildos` |
| ✅ | A | Difuntos y sufragios | Hecho: pestaña «Difuntos» del censo con próximos aniversarios y registro; fecha del óbito al dar la baja; sufragios (misas, oraciones) que pueden ir a la Agenda y avisar a la familia; pésame por correo, nunca a la cuenta del difunto. Migración `difuntos_y_sufragios` |
| ✅ | A | Ficha: medalla, tratamiento y listas guardadas | Hecha: fecha de la medalla y tratamiento (que usa la papeleta); en el censo, «Más filtros» (correo, cuenta, edad, medalla, boletín) y listas guardadas con nombre, compartidas por la junta. Migración `ficha_medalla_y_listas` |

## Fase 5 · Tesorería avanzada

| | PC | Tarea | Notas |
|---|---|---|---|
| ✅ | — | **Contabilidad por partida doble (plan de entidades sin fines lucrativos)** | Hecha: Contabilidad → «Partida doble». Cada categoría tiene su cuenta del plan (propuesta por el nombre, se cambia en «Plan de cuentas»); los asientos salen de los apuntes del libro de caja (570 Caja si es en efectivo, 572 Bancos si no), así que lo que apunten la lotería o la caja de la tienda entra solo. Cuenta de resultados, sumas y saldos, libro diario y Excel del ejercicio. Migración `cuenta_de_categoria` |
| ✅ | A | Modelo 182 y certificados de donación | Hecho: Tesorería → «Modelo 182». Junta por NIF los recibos pagados de donativo y de cuota (las cuotas se pueden apagar), y los donativos y apadrinamientos en línea de quien pidió certificado (casilla nueva en los dos formularios: nombre, apellidos, NIF y código postal). Nunca lo pagado por una salida. Los recibos de un niño sin DNI van al titular de su cuenta; un menor de 14 con DNI lleva al titular como representante. Porcentaje (80/40/45, 40/50) y recurrencia calculados; fichero de 250 posiciones para la Sede de Hacienda; certificados en PDF (uno o todos), por correo a quien dejó el suyo y descargables en Recibos del área de hermanos. El NIF del Grupo y quién firma se ponen en «Datos del Grupo» (en la base, nunca en el repositorio). Migración `modelo_182` |
| ✅ | A | Lotería y talonarios | Hecha: Cuentas → «Lotería». El sorteo (uno o varios números, décimos y su precio, lo que cuesta y lo que juega la participación; el resto, donativo) no deja emitir más participaciones de las que juegan los décimos. Talonarios numerados, a quién se dieron (de uno en uno o por tramos), liquidación con lo vendido y cómo se pagó, y deshacerla. La compra de los décimos (gasto, «Compra de lotería» → 600) y cada liquidación (ingreso, «Lotería y rifas» → 722) se apuntan solas y no se tocan a mano en Contabilidad. Premios tras el sorteo (lo que cobra cada participación) y PDF de las participaciones con su matriz, cinco por hoja. Migración `loteria` |
| ✅ | A | Caja de tienda (TPV) | Hecha: Cuentas → Tienda → «Caja». Se abre con el fondo, se pulsan los productos (también los retirados de la web) o «Otra cosa» con su precio, calcula el cambio y se cobra en efectivo, tarjeta o Bizum (estos dos, en el datáfono o el móvil del Grupo: aquí se apunta cómo se pagó). Cada venta descuenta existencias y apunta su ingreso («Ventas de la tienda» → 700; Caja o Bancos por el método), que no se toca desde Contabilidad. Anular, solo con la caja abierta. Al cerrar se cuenta el efectivo y queda el descuadre; historial de cajas cerradas. Migración `caja_de_tienda` |

## Fase 6 · Patrimonio y recaudación

| | PC | Tarea | Notas |
|---|---|---|---|
| ✅ | A | Ficha completa de patrimonio | Hecha: en la ficha de cada enser, foto principal y hasta doce más con su pie, descripción, autor o taller, época, materiales y técnica, medidas, conservación e intervenciones y tasación (valor, fecha y quién). «Ficha en PDF» para el seguro, el Obispado o un taller. El resumen del inventario suma lo tasado. Arreglado de paso: la limpieza de ficheros huérfanos no contaba las fotos de la tienda ni de los apadrinamientos. Migración `ficha_de_patrimonio` |
| ✅ | — | **Tienda en línea** | Hecha: /tienda en la web pública (cesta, compra sin cuenta, pago con la pasarela de Redsys, recogida en Secretaría) y Cuentas → «Tienda» en el CMS (productos con foto, precio y existencias; pedidos por entregar). El aviso del banco descuenta existencias, apunta el ingreso («Ventas de la tienda» → 700) y manda el correo; si ya no queda, incidencia para devolver. La pasarela admite ya pagos sin cuenta (`PagoEnLinea.origen`). Migración `tienda` |
| ✅ | — | **Apadrinamiento sobre una foto (velas, piezas)** | Hecho: /apadrina en la web (bajo «Sagrada titular»), con cada campaña en su foto y las piezas encima; se elige una libre, se dan los datos (dedicatoria y si sale el nombre) y se paga sin cuenta. En el CMS, Censo y procesión → «Apadrinamientos»: se pulsa en la foto para poner una pieza y se ve quién apadrinó cada una. El aviso del banco la marca apadrinada, apunta el ingreso («Apadrinamientos» → 740) y manda el correo; si otro se adelantó, incidencia para devolver. Migración `apadrinamientos` |

## Fase 7 · Extras

| | PC | Tarea | Notas |
|---|---|---|---|
| ✅ | — | **Posición del cortejo en directo** | Hecha: Censo y procesión → «Cortejo en directo», pensada para el móvil de quien va en la calle. «Empezar» manda la posición del GPS (cada 15 s como poco, y la repite cada minuto si se está parado) y mantiene la pantalla encendida; si el GPS falla, se marca a mano la parada. El mapa del recorrido pregunta cada 20 s: con posición de menos de 10 minutos y a menos de 150 m de la línea, pone el trono allí con «En directo» y retira el play; si no, sigue la reproducción. La web no dice quién la manda. Migración `cortejo_en_directo` |
| ⏸ | — | Notificaciones push | Exige hacer la web instalable; el correo cubre lo mismo |
| ⏸ | — | Firma en pantalla | Poco valor legal; basta un consentimiento registrado con fecha |
| ⏸ | — | Asistente con IA | Vistoso, pero lo último que decide una compra |

## Fase 8 · Preparar la venta

| | PC | Tarea | Notas |
|---|---|---|---|
| 🟡 | B | Lo propio del Grupo, a configuración | Hecha la identidad: nombre, nombre corto, advocación, localidad, dominio y descripción viven en `shared/datos-entidad.json` (bloque `identidad`), y de ahí los leen la API (correos, PDF, actas, iCal), la web (`site.ts`, títulos, rótulos, dirección canónica) y, al generarse, `index.html`, el manifest, `robots.txt`, el sitemap y nginx. **Falta decidir**: las salidas siguen siendo un enum (`PASION`, `ROSARIO`) con sus nombres en unas 15 pantallas y correos, y «el Grupo Parroquial» sigue en decenas de frases con su género (para una Hermandad serían «la»/«de la»). |
| 🟡 | B | Guion de instalación y de actualización de varias copias | Escritos: `docker/instalar.sh` (servidor limpio: usuario, `.env` con secretos, certificado, arranque, siembra), `docker/actualizar.sh` (copia antes, avance rápido, migraciones, comprobación) y `docker/actualizar-copias.sh` (todas por ssh, parando en la primera que falle). Guía en docs/despliegue.md, «Una instalación por corporación». **Falta probarlos en un servidor Linux de verdad** |
| ✅ | A | Contrato de encargado del tratamiento | Hecho: plantilla en `docs/venta/contrato-encargado-tratamiento.md` (art. 28 RGPD), con dos opciones según quién contrate el servidor y tres anexos sacados del código: datos e interesados, subencargados y medidas de seguridad. Se firma antes de cargar el censo; que la revise un abogado antes de la primera firma. Sin migración |
| ✅ | A | Licencias y fotos de ejemplo | Hecho: inventario en `docs/venta/licencias.md` (fuentes OFL, datos de OpenStreetMap con su atribución, fotos, iconos y las librerías que hay que mirar) y lista de librerías de producción generada con `npm run licencias`. Las siete fotos de Commons de Enseres, sin autor apuntado, cambiadas por fotos del Grupo (migración `enseres_sin_fotos_ajenas`). El código, `UNLICENSED`. La ilustración del templo está generada con IA (confirmado). La foto de Unsplash y las seis de Commons de la portada del seed, cambiadas por fotos del Grupo (migración `nazarenos_del_grupo`) |

---

## Ya hecho (lo que se anuncia en el sector y ya tenemos)

- Ficha del hermano y censo, con altas, bajas y motivo, e impagos.
- Alta en línea con foto, certificado de bautismo e IBAN, aprobada por la junta.
- Préstamo de túnicas: prendas numeradas, lavado, taller, cíngulos y devolución.
- Correos con la imagen del Grupo.

Y lo que no anuncia nadie: web pública editable por bloques con historial,
mesa de procesión en tiempo real por zonas, agenda con suscripción de
calendario, informe anual en PDF, doble factor y registro de auditoría.
