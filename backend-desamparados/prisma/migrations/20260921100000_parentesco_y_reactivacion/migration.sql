-- Dos huecos del alta de hermanos que hasta ahora no tenían dónde guardarse.
--
-- `parentesco`: quién es el menor para el adulto del que cuelga su ficha. No
-- siempre es su hijo —un tío, un abuelo o un padrino pueden ser su tutor a
-- efectos de la cofradía—, y Secretaría necesita saber por qué esa ficha cuelga
-- de esa cuenta: con un parentesco que no sea HIJO hace falta la autorización
-- firmada de los padres. Nulo en las fichas de los titulares y en las que ya
-- existen, que son todas de adultos o de altas hechas antes de este campo.
--
-- `reactivacionSolicitada`: quien se dio de baja y quiere volver. Su ficha
-- conserva `fechaBaja` (borrarla para colarla en la cola de pendientes perdería
-- cuándo se fue), así que la petición se marca aquí y la cola de Secretaría la
-- recoge por este campo. Se limpia al reactivar o al rechazar.

-- AlterTable
ALTER TABLE `Hermano`
    ADD COLUMN `parentesco` ENUM('HIJO', 'SOBRINO', 'NIETO', 'AHIJADO', 'OTRO') NULL,
    ADD COLUMN `reactivacionSolicitada` DATETIME(3) NULL;

-- Las peticiones de reactivación son pocas y se consultan enteras cada vez que
-- Secretaría abre la cola: con este índice no hay que recorrer el censo.
CREATE INDEX `Hermano_reactivacionSolicitada_idx` ON `Hermano`(`reactivacionSolicitada`);
