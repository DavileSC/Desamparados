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

## Regla para todo lo que venga

Lo propio del Grupo (nombre, escudo, colores, salidas, puestos, importes, datos
bancarios) va en configuración o en `shared/`, **nunca escrito en el código**.
Así, instalarlo para otra corporación es rellenar su configuración.

---

## Fase 1 · Cobros

| | Tarea | Notas |
|---|---|---|
| ✅ | **Pasarela de pago (Redsys: tarjeta y Bizum)** | Hecha: pago desde Procesión, aviso firmado del banco, incidencias en Tesorería; firma comprobada contra el entorno de pruebas de Redsys. Migración `pagos_en_linea`. **Para cobrar de verdad faltan las claves del banco** (ver `despliegue.md`, «El pago en línea») |
| ⬜ | Donativos en línea desde la web pública | La pasarela ya está |
| 🟡 | Remesas SEPA (XML de adeudos) | Hay IBAN y titular en la ficha y el estado «remesado» en los recibos. Falta generar el fichero para el banco |
| ⬜ | Devoluciones con la Norma 43 | Subir el extracto del banco y casar cobros y devoluciones solos |

## Fase 2 · Procesión

| | Tarea | Notas |
|---|---|---|
| ⬜ | Papeleta de sitio en PDF con código QR | La librería de QR ya está en el backend |
| ⬜ | Escaneo del QR en la puerta del templo | Asistencia en vivo por tramos |
| 🟡 | Cortejo por antigüedad, automático | Hay solicitud de puesto, tramo y número en la papeleta; falta el reparto automático |
| 🟡 | Túnica propuesta según la medida | Hay altura al hombro y tallas; falta proponerla sola |

## Fase 3 · Comunicación

| | Tarea | Notas |
|---|---|---|
| 🟡 | Boletín y avisos masivos, segmentados | Hay la casilla de suscripción y la plantilla de correo; falta el editor y el envío |
| ⬜ | Cartas y circulares en PDF con los datos de cada hermano | Reutiliza el motor de los informes |
| ⬜ | Etiquetas postales | Para los hermanos sin correo |

## Fase 4 · Secretaría

| | Tarea | Notas |
|---|---|---|
| ⬜ | Importar y exportar el censo (Excel / CSV) | Imprescindible para instalarlo a otra corporación |
| ⬜ | Cabildos y actas | Convocatoria, quórum, votaciones y libro de actas |
| 🟡 | Difuntos y sufragios | Hay baja por fallecimiento; faltan fecha del óbito, aniversarios y misas |
| 🟡 | Ficha: medalla, tratamiento y listas guardadas | La ficha está casi completa |

## Fase 5 · Tesorería avanzada

| | Tarea | Notas |
|---|---|---|
| 🟡 | Contabilidad por partida doble (plan de entidades sin fines lucrativos) | Hoy es partida simple por categorías, enlazada a los recibos |
| ⬜ | Modelo 182 y certificados de donación | **Antes, confirmar** que el Grupo tiene NIF propio y no depende del del Obispado |
| ⬜ | Lotería y talonarios | |
| 🟡 | Caja de tienda (TPV) | La mesa de procesión ya cobra por zonas |

## Fase 6 · Patrimonio y recaudación

| | Tarea | Notas |
|---|---|---|
| 🟡 | Ficha completa de patrimonio | Hay enseres con estado, foto y ubicación; faltan varias fotos, descripción y tasación |
| ⬜ | Tienda en línea | La pasarela ya está |
| ⬜ | Apadrinamiento sobre una foto (velas, piezas) | La pasarela ya está |

## Fase 7 · Extras

| | Tarea | Notas |
|---|---|---|
| 🟡 | Posición del cortejo en directo | Hay recorrido en el mapa, simulado |
| ⏸ | Notificaciones push | Exige hacer la web instalable; el correo cubre lo mismo |
| ⏸ | Firma en pantalla | Poco valor legal; basta un consentimiento registrado con fecha |
| ⏸ | Asistente con IA | Vistoso, pero lo último que decide una compra |

## Fase 8 · Preparar la venta

| | Tarea | Notas |
|---|---|---|
| ⬜ | Lo propio del Grupo, a configuración | Hoy el nombre está en el código y las salidas son un enum (`PASION`, `ROSARIO`) |
| ⬜ | Guion de instalación y de actualización de varias copias | |
| ⬜ | Contrato de encargado del tratamiento | Cada cliente es responsable de los datos de sus hermanos |
| ⬜ | Licencias y fotos de ejemplo | Fuentes, mapas de OpenStreetMap y fotos de Commons |

---

## Ya hecho (lo que se anuncia en el sector y ya tenemos)

- Ficha del hermano y censo, con altas, bajas y motivo, e impagos.
- Alta en línea con foto, certificado de bautismo e IBAN, aprobada por la junta.
- Préstamo de túnicas: prendas numeradas, lavado, taller, cíngulos y devolución.
- Correos con la imagen del Grupo.

Y lo que no anuncia nadie: web pública editable por bloques con historial,
mesa de procesión en tiempo real por zonas, agenda con suscripción de
calendario, informe anual en PDF, doble factor y registro de auditoría.
