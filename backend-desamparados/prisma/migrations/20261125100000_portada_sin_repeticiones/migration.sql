-- Auditoría antislop de la portada (16-10-2026). El botón del hero decía
-- «Conoce el Grupo Parroquial» y lleva a /historia: ahora dice adónde va. Y la
-- ceja del hero ya no repite «Málaga», que dice el título. Se toca solo si
-- sigue el texto de antes: si alguien lo cambió en el CMS, se queda el suyo.
-- También en el historial. Las cejas retiradas de Noticias, Agenda y la placa
-- no hace falta borrarlas: mezclarConDefectos las tira al leer.

UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  '"botonPrincipal":"Conoce el Grupo Parroquial"',
  '"botonPrincipal":"Nuestra historia"'),
  '"ceja":"Grupo Parroquial · Málaga"',
  '"ceja":"Grupo Parroquial"')
WHERE `slug` = 'portada';

UPDATE `VersionContenido` SET `datos` = REPLACE(REPLACE(`datos`,
  '"botonPrincipal":"Conoce el Grupo Parroquial"',
  '"botonPrincipal":"Nuestra historia"'),
  '"ceja":"Grupo Parroquial · Málaga"',
  '"ceja":"Grupo Parroquial"')
WHERE `slug` = 'portada';
