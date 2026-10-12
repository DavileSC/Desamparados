-- Una base nueva no hereda las salidas de Desamparados.
--
-- `20261029200000_salidas_configurables` crea «Sábado de Pasión» y «Rosario
-- vespertino» en cualquier base, también en la de otra corporación. No se
-- cambia esa migración (ya está aplicada en todas partes): aquí se les ponen
-- los nombres neutros de prisma/seed-salidas.ts, pero SOLO en una base recién
-- creada. La señal es que aún no hay ninguna página de contenido ni papeletas:
-- la API siembra `ContenidoPagina` al arrancar, después de las migraciones,
-- así que una instalación en marcha (Desamparados, la web de pruebas) siempre
-- tiene filas y aquí no se toca nada. Los slugs no cambian: la siembra y las
-- pruebas buscan las salidas por ellos.
UPDATE `Salida`
SET `nombre` = 'Estación de penitencia',
    `articulo` = 'la',
    `indicaciones` = 'Se ruega puntualidad y decoro en la vestimenta. Es obligatorio portar la medalla de la corporación y calzado oscuro. Guarde silencio durante la formación.'
WHERE `slug` = 'sabado-de-pasion' AND `nombre` = 'Sábado de Pasión'
  AND NOT EXISTS (SELECT 1 FROM `ContenidoPagina`)
  AND NOT EXISTS (SELECT 1 FROM `PapeletaSitio`);

UPDATE `Salida`
SET `nombre` = 'Rosario de la Aurora',
    `indicaciones` = 'Se va en traje oscuro, con la medalla de la corporación. Se ruega puntualidad y recogimiento durante el rezo.'
WHERE `slug` = 'rosario-vespertino' AND `nombre` = 'Rosario vespertino'
  AND NOT EXISTS (SELECT 1 FROM `ContenidoPagina`)
  AND NOT EXISTS (SELECT 1 FROM `PapeletaSitio`);
