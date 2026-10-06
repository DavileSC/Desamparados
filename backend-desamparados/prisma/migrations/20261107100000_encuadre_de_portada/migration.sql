-- Qué parte de cada foto de la cabecera se queda a la vista en el móvil, de
-- 0 (izquierda) a 100 (derecha). Las de antes, sin él: se ven como hasta ahora.
ALTER TABLE `ImagenPortada` ADD COLUMN `encuadre` INTEGER NULL;
