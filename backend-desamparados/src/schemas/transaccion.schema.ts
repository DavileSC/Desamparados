import { type } from 'arktype';

const tipoTransaccion = type("'INGRESO' | 'GASTO'");

// Esquema para crear un apunte contable
export const createTransaccionSchema = type({
    body: {
        tipo: tipoTransaccion,
        categoriaId: "number > 0", // <-- Ahora es el ID numérico
        concepto: "string > 3",
        importe: "number > 0",
        "fecha?": "string",
        "metodoPago?": type("'EFECTIVO' | 'TARJETA' | 'BIZUM' | 'TRANSFERENCIA' | 'DOMICILIACION'")
    }
});

// Esquema para que el Tesorero cree una categoría (Ej: "Donativos Extraordinarios")
export const createCategoriaSchema = type({
    body: {
        nombre: "string > 2",
        tipo: tipoTransaccion
    }
});