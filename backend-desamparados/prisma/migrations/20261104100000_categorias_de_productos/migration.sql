-- Categorías de la tienda (Ropa, Medallas…), para filtrar en la web, y la
-- pieza destacada que la tienda enseña en grande al entrar. Un producto tiene
-- una categoría o ninguna (entonces sale solo en «Todo»); al borrar una
-- categoría, sus productos se quedan sin ella. Los productos de antes, sin
-- categoría y sin destacar.
-- Los nombres de tabla, con su mayúscula: en el servidor Linux la distinguen.

-- AlterTable
ALTER TABLE `Producto` ADD COLUMN `categoriaId` INTEGER NULL,
    ADD COLUMN `destacado` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `CategoriaProducto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(40) NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `CategoriaProducto_nombre_key`(`nombre`),
    INDEX `CategoriaProducto_orden_idx`(`orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Producto_categoriaId_idx` ON `Producto`(`categoriaId`);

-- AddForeignKey
ALTER TABLE `Producto` ADD CONSTRAINT `Producto_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `CategoriaProducto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

