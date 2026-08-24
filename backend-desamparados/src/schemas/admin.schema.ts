import { type } from 'arktype';

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

// Para actualizar valores de la tabla de Configuración
const allowedConfigKeys = type("'precio_papeleta_sitio' | 'precio_alquiler_tunica' | 'home_news_limit'");

export const updateConfigSchema = type({
    body: {
        key: allowedConfigKeys,
        // El valor siempre llega como string, el servicio lo parseará si es necesario
        value: "string" 
    }
});