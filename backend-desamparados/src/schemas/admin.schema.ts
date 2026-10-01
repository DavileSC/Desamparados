import { type } from 'arktype';
import { paginacionQuery } from '../config/common';
import { esClaveConfiguracion, normalizarValorConfiguracion, type ClaveConfiguracion } from '../domain/configuracion';

// Excluimos 'USER' porque ese es el rol base.
const staffRoleSchema = type("'ADMIN' | 'TESORERIA' | 'ALBACERIA' | 'HERMANO_MAYOR' | 'REDES' | 'SECRETARIA'");

export const promoteUserSchema = type({
    body: {
        userId: "number",
        role: staffRoleSchema
    }
});

export const demoteUserSchema = type({
    body: {
        userId: "number"
    }
});

// Para actualizar valores de la tabla de Configuración. Las claves salen de la
// misma lista que usa el servicio: antes estaban escritas dos veces y podían
// separarse sin que nada avisara. Con `narrow` y no con `type.enumerated`: con
// la lista vacía (hoy no hay ninguna), arktype solo diría «never».
const allowedConfigKeys = type("string")
    .narrow((clave) => esClaveConfiguracion(clave))
    .describe("un parámetro de configuración que exista");

/**
 * El valor se valida según la clave y sale ya normalizado. La regla vive en
 * src/domain/configuracion.ts.
 *
 * Va con `narrow` + `pipe` sobre el cuerpo entero y no como una unión por clave:
 * arktype 2.1 revienta al describir el error de una unión cuyas ramas llevan
 * `narrow` (TypeError en predicate.js), y eso sería un 500 en vez de un 400.
 */
export const updateConfigSchema = type({
    body: type({ key: allowedConfigKeys, value: "string" })
        .narrow((cuerpo, ctx) => {
            const resultado = normalizarValorConfiguracion(cuerpo.key as ClaveConfiguracion, cuerpo.value);
            return resultado.ok || ctx.reject({ path: ['value'], message: resultado.error });
        })
        .pipe((cuerpo) => {
            const resultado = normalizarValorConfiguracion(cuerpo.key as ClaveConfiguracion, cuerpo.value);
            // El narrow de arriba ya ha descartado los valores inválidos.
            return { key: cuerpo.key, value: resultado.ok ? resultado.valor : cuerpo.value };
        })
});

/**
 * Buscador de usuarios para ascender. Sin esquema, `?q=a&q=b` llegaba al
 * servicio como un array y Prisma respondía con un 500; declarado, es un 400.
 */
export const searchUsersSchema = type({
    query: {
        "q?": "string"
    }
});

/**
 * Consulta del registro de auditoría: paginada y filtrable por acción y por
 * usuario. `validate` sustituye `req.query` por lo validado, así que la
 * paginación hay que declararla o se perdería (ver notas-del-proyecto.md §7).
 */
export const auditLogsQuerySchema = type({
    query: {
        ...paginacionQuery,
        "action?": type("string").matching(/^[A-Za-z0-9_]{1,64}$/).describe("un código de acción"),
        "userId?": type("string").matching(/^\d+$/).describe("un id de usuario numérico")
    }
});
