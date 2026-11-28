-- Boletín y avisos programados: un comunicado puede quedar PROGRAMADO para un
-- día y una hora, y la API lo pone en la cola cuando llega. A quién va se
-- calcula al empezar, como si se pulsara «Enviar» en ese momento.

-- AlterTable
ALTER TABLE `Comunicado` MODIFY `estado` ENUM('BORRADOR', 'PROGRAMADO', 'ENVIANDO', 'ENVIADO') NOT NULL DEFAULT 'BORRADOR',
    ADD COLUMN `programadoPara` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Comunicado_estado_programadoPara_idx` ON `Comunicado`(`estado`, `programadoPara`);
