import { Role } from '@prisma/client';

/**
 * Quién entra en los routers que parten un mismo módulo en varios ficheros:
 * las remesas y el Modelo 182 se montan dentro de los recibos, y el ropero
 * (de Procesión) lo lleva la misma gente que el inventario. Cada fichero
 * tenía su copia de la lista y un cambio en uno no llegaba a los otros.
 */

/** Tesorería: los recibos, las remesas SEPA y el Modelo 182. */
export const ROLES_TESORERIA: Role[] = [Role.ADMIN, Role.TESORERIA, Role.HERMANO_MAYOR];

/**
 * Quien gestiona el censo: leer y editar fichas, admitir altas, dar de baja.
 * También son los únicos que abren los documentos del alta (foto y
 * certificado de bautismo, en storage/private): son de la ficha y no le hacen
 * falta a nadie más.
 */
export const ROLES_CENSO: Role[] = [Role.ADMIN, Role.SECRETARIA, Role.HERMANO_MAYOR];

/** Albacería: los enseres del inventario y el ropero (prendas y cíngulos). */
export const ROLES_PATRIMONIO: Role[] = [Role.ADMIN, Role.ALBACERIA, Role.HERMANO_MAYOR];
