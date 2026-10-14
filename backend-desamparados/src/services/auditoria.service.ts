import db from '../config/db';
import { Request } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Metadatos de quién realiza la acción (extraídos del request autenticado).
 */
export interface MetaDeAuditoria {
  userId?: number;
  ip?: string;
  userAgent?: string;
}

/**
 * Catálogo centralizado de acciones auditables.
 * Mantener en mayúsculas y verbo_sustantivo para filtrado consistente.
 */
export const ACCIONES_AUDITORIA = {
  // Staff / roles
  STAFF_PROMOTE: 'STAFF_PROMOTE',
  STAFF_DEMOTE: 'STAFF_DEMOTE',
  CONFIG_UPDATE: 'CONFIG_UPDATE',
  TFa_RESET_ADMIN: '2FA_RESET_ADMIN',
  // Economía
  RECIBO_COBRAR: 'RECIBO_COBRAR',
  RECIBO_ACTUALIZAR: 'RECIBO_ACTUALIZAR',
  CUOTAS_GENERAR: 'CUOTAS_GENERAR',
  TRANSACCION_CREAR: 'TRANSACCION_CREAR',
  CATEGORIA_CREAR: 'CATEGORIA_CREAR',
  // Contabilidad: corregir y borrar apuntes manuales, gestionar categorías
  TRANSACCION_ACTUALIZAR: 'TRANSACCION_ACTUALIZAR',
  TRANSACCION_ELIMINAR: 'TRANSACCION_ELIMINAR',
  CATEGORIA_RENOMBRAR: 'CATEGORIA_RENOMBRAR',
  CATEGORIA_DESACTIVAR: 'CATEGORIA_DESACTIVAR',
  CATEGORIA_REACTIVAR: 'CATEGORIA_REACTIVAR',
  PAPELETA_ANULAR: 'PAPELETA_ANULAR',
  INSCRIPCION_FACTURAR: 'INSCRIPCION_FACTURAR',
  // La mesa de la procesión: alta en el momento y corrección de una papeleta
  MESA_ALTA: 'MESA_ALTA',
  PAPELETA_EDITAR: 'PAPELETA_EDITAR',
  // La mesa por zonas: inscribir, cobrar (o perdonar) y dar la ropa
  MESA_INSCRIBIR: 'MESA_INSCRIBIR',
  MESA_COBRAR: 'MESA_COBRAR',
  RECIBO_PERDONAR: 'RECIBO_PERDONAR',
  PAPELETA_ENTREGAR: 'PAPELETA_ENTREGAR',
  // Después de la salida: la ropa vuelve al ropero
  MESA_DEVOLVER: 'MESA_DEVOLVER',
  SOLICITUD_SALIDA_CANCELAR: 'SOLICITUD_SALIDA_CANCELAR',
  // El hermano desde su área: pedir la papeleta y pagar en línea
  SOLICITUD_SALIDA_PEDIR: 'SOLICITUD_SALIDA_PEDIR',
  SOLICITUD_SALIDA_CAMBIAR_DIA: 'SOLICITUD_SALIDA_CAMBIAR_DIA',
  PAGO_EN_LINEA: 'PAGO_EN_LINEA',
  // Lo que el banco cobró y no cuadró, y quién de Tesorería lo dio por resuelto
  PAGO_EN_LINEA_INCIDENCIA: 'PAGO_EN_LINEA_INCIDENCIA',
  PAGO_EN_LINEA_RESOLVER: 'PAGO_EN_LINEA_RESOLVER',
  // Los difuntos: el día del óbito, los sufragios y el pésame a la familia
  DEFUNCION_FIJAR: 'DEFUNCION_FIJAR',
  SUFRAGIO_CREAR: 'SUFRAGIO_CREAR',
  SUFRAGIO_BORRAR: 'SUFRAGIO_BORRAR',
  PESAME_ENVIAR: 'PESAME_ENVIAR',
  // Las cartas: se generan con datos de muchos hermanos a la vez
  CARTAS_GENERAR: 'CARTAS_GENERAR',
  ETIQUETAS_GENERAR: 'ETIQUETAS_GENERAR',
  // La lotería: lo que mueve dinero o reparte talonarios
  LOTERIA_COMPRA: 'LOTERIA_COMPRA',
  LOTERIA_COMPRA_DESHACER: 'LOTERIA_COMPRA_DESHACER',
  LOTERIA_ENTREGA: 'LOTERIA_ENTREGA',
  LOTERIA_LIQUIDAR: 'LOTERIA_LIQUIDAR',
  LOTERIA_LIQUIDAR_DESHACER: 'LOTERIA_LIQUIDAR_DESHACER',
  LOTERIA_PREMIOS: 'LOTERIA_PREMIOS',
  // Las salidas procesionales: darlas de alta, cambiarlas y ponerles fecha a mano
  SALIDA_CREAR: 'SALIDA_CREAR',
  SALIDA_EDITAR: 'SALIDA_EDITAR',
  SALIDA_FECHAR: 'SALIDA_FECHAR',
  RECIBO_EMITIR: 'RECIBO_EMITIR',
  // Remesas SEPA: generar el fichero para el banco y darla por cobrada
  REMESA_GENERAR: 'REMESA_GENERAR',
  REMESA_COBRAR: 'REMESA_COBRAR',
  NORMA43_APLICAR: 'NORMA43_APLICAR',
  // El censo en Excel o CSV: sacarlo entero es una salida de datos personales
  CENSO_EXPORTAR: 'CENSO_EXPORTAR',
  CENSO_IMPORTAR: 'CENSO_IMPORTAR',
  // Primer acceso del censo importado: invitar, confirmar la ficha y devolver
  // a Secretaría una ficha que no es de la familia
  PRIMER_ACCESO_INVITAR: 'PRIMER_ACCESO_INVITAR',
  PRIMER_ACCESO_CONFIRMAR: 'PRIMER_ACCESO_CONFIRMAR',
  PRIMER_ACCESO_FICHA_AJENA: 'PRIMER_ACCESO_FICHA_AJENA',
  // El cortejo: repartir las papeletas en los tramos por antigüedad
  CORTEJO_REPARTIR: 'CORTEJO_REPARTIR',
  // Boletín y avisos: mandar uno y darse de baja desde el enlace del correo
  COMUNICADO_ENVIAR: 'COMUNICADO_ENVIAR',
  BOLETIN_BAJA: 'BOLETIN_BAJA',
  // Cabildos: darlo por celebrado (fija el quórum) y aprobar su acta
  CABILDO_CELEBRAR: 'CABILDO_CELEBRAR',
  CABILDO_ACTA_APROBAR: 'CABILDO_ACTA_APROBAR',
  // Partida doble: la cuenta de cada categoría y sacar el ejercicio a Excel
  CATEGORIA_CUENTA: 'CATEGORIA_CUENTA',
  CONTABILIDAD_EXPORTAR: 'CONTABILIDAD_EXPORTAR',
  // La tienda: el pedido pagado (por el banco), entregado en Secretaría o anulado
  TIENDA_PEDIDO_PAGADO: 'TIENDA_PEDIDO_PAGADO',
  TIENDA_PEDIDO_ENTREGADO: 'TIENDA_PEDIDO_ENTREGADO',
  TIENDA_PEDIDO_ANULADO: 'TIENDA_PEDIDO_ANULADO',
  // Un apadrinamiento pagado (por el banco)
  APADRINAMIENTO_PAGADO: 'APADRINAMIENTO_PAGADO',
  // La caja de la tienda: abrirla, cada venta, anular una y cerrarla con el arqueo
  CAJA_ABRIR: 'CAJA_ABRIR',
  CAJA_VENDER: 'CAJA_VENDER',
  CAJA_ANULAR: 'CAJA_ANULAR',
  CAJA_CERRAR: 'CAJA_CERRAR',
  TIENDA_INGRESO_BANCO: 'TIENDA_INGRESO_BANCO',
  TIENDA_INGRESO_BORRAR: 'TIENDA_INGRESO_BORRAR',
  CORTEJO_DIRECTO_EMPEZAR: 'CORTEJO_DIRECTO_EMPEZAR',
  CORTEJO_DIRECTO_TERMINAR: 'CORTEJO_DIRECTO_TERMINAR',
  // Una entrada al templo apuntada por error, que vuelve a faltar
  PUERTA_DESHACER: 'PUERTA_DESHACER',
  // El fichero del Modelo 182 sacado para presentarlo en Hacienda
  MODELO_182_FICHERO: 'MODELO_182_FICHERO',
  // Los certificados de donativos mandados por correo
  MODELO_182_ENVIAR: 'MODELO_182_ENVIAR',
  // Las plantillas de los correos (Emails)
  PLANTILLA_CORREO_CREAR: 'PLANTILLA_CORREO_CREAR',
  PLANTILLA_CORREO_ACTUALIZAR: 'PLANTILLA_CORREO_ACTUALIZAR',
  PLANTILLA_CORREO_BORRAR: 'PLANTILLA_CORREO_BORRAR',
  PLANTILLA_CORREO_USAR: 'PLANTILLA_CORREO_USAR',
  // Procesión (turnos de reparto y citas)
  TURNO_CREAR: 'TURNO_CREAR',
  TURNO_ACTUALIZAR: 'TURNO_ACTUALIZAR',
  TURNO_ELIMINAR: 'TURNO_ELIMINAR',
  AUSENCIAS_PROCESAR: 'AUSENCIAS_PROCESAR',
  PLAZO_PAPELETAS_ABRIR: 'PLAZO_PAPELETAS_ABRIR',
  PLAZO_PAPELETAS_CERRAR: 'PLAZO_PAPELETAS_CERRAR',
  // Secretaría
  // Un alta por la web con un correo o un DNI ya registrados: la web responde
  // como si se hubiera creado (no puede decir quién está en el censo), y esto
  // es lo que le queda a Secretaría para saberlo.
  ALTA_NO_TRAMITADA: 'ALTA_NO_TRAMITADA',
  SOLICITUD_APROBAR: 'SOLICITUD_APROBAR',
  SOLICITUD_RECHAZAR: 'SOLICITUD_RECHAZAR',
  HERMANO_BAJA: 'HERMANO_BAJA',
  HERMANO_REACTIVAR: 'HERMANO_REACTIVAR',
  REACTIVACION_DESCARTAR: 'REACTIVACION_DESCARTAR',
  CENSO_REORDENAR: 'CENSO_REORDENAR',
  CENSO_CERRAR_HUECOS: 'CENSO_CERRAR_HUECOS',
  EMANCIPACION: 'EMANCIPACION',
  // Censo: edición de la ficha por el staff y operaciones del área familiar
  HERMANO_ACTUALIZAR: 'HERMANO_ACTUALIZAR',
  HERMANO_BAJA_FAMILIAR: 'HERMANO_BAJA_FAMILIAR',
  FAMILIAR_CREAR: 'FAMILIAR_CREAR',
  FAMILIAR_ACTUALIZAR: 'FAMILIAR_ACTUALIZAR',
  FAMILIAR_SOLICITUD_RETIRAR: 'FAMILIAR_SOLICITUD_RETIRAR',
  // Un DNI escrito en «Mi familia» o «Mi perfil» que ya es de otra ficha: al
  // hermano no se le dice (revelaría quién está en el censo); Secretaría lo ve aquí.
  FAMILIAR_DNI_OCUPADO: 'FAMILIAR_DNI_OCUPADO',
  // La propia cuenta: cambiar la contraseña con la sesión abierta
  CONTRASENA_CAMBIAR: 'CONTRASENA_CAMBIAR',
  // Aprobar la entrada al CMS desde el móvil: apuntarlo y quitarlo, y qué fue
  // de cada aprobación. La caducada se apunta una vez, al verla el ordenador.
  MOVIL_APUNTAR: 'MOVIL_APUNTAR',
  MOVIL_QUITAR: 'MOVIL_QUITAR',
  ENTRADA_APROBADA: 'ENTRADA_APROBADA',
  ENTRADA_RECHAZADA: 'ENTRADA_RECHAZADA',
  ENTRADA_NUMERO_FALLADO: 'ENTRADA_NUMERO_FALLADO',
  ENTRADA_CADUCADA: 'ENTRADA_CADUCADA',
  ENTRADA_DESDE_ESTE_MOVIL: 'ENTRADA_DESDE_ESTE_MOVIL',
  // RGPD
  CUENTA_DATOS_EXPORT: 'CUENTA_DATOS_EXPORT',
  CUENTA_AUTODELETE: 'CUENTA_AUTODELETE',
  NOTICIA_CREAR: 'NOTICIA_CREAR',
  NOTICIA_ACTUALIZAR: 'NOTICIA_ACTUALIZAR',
  NOTICIA_ELIMINAR: 'NOTICIA_ELIMINAR',
  PAGINA_GUARDAR: 'PAGINA_GUARDAR',
  PAGINA_ACTUALIZAR: 'PAGINA_ACTUALIZAR',
  PAGINA_ELIMINAR: 'PAGINA_ELIMINAR',
  EVENTO_CREAR: 'EVENTO_CREAR',
  EVENTO_ACTUALIZAR: 'EVENTO_ACTUALIZAR',
  EVENTO_ELIMINAR: 'EVENTO_ELIMINAR',
  ENSER_CREAR: 'ENSER_CREAR',
  ENSER_ACTUALIZAR: 'ENSER_ACTUALIZAR',
  ENSER_ELIMINAR: 'ENSER_ELIMINAR',
  PRENDA_CREAR: 'PRENDA_CREAR',
  PRENDA_ACTUALIZAR: 'PRENDA_ACTUALIZAR',
  PRENDA_ELIMINAR: 'PRENDA_ELIMINAR',
  PRENDA_ASIGNAR: 'PRENDA_ASIGNAR',
  PRENDA_DEVOLVER: 'PRENDA_DEVOLVER',
  PRENDAS_LAVADAS: 'PRENDAS_LAVADAS',
  CINGULOS_TOTAL: 'CINGULOS_TOTAL',
  PUBLICACION_CREAR: 'PUBLICACION_CREAR',
  PUBLICACION_ACTUALIZAR: 'PUBLICACION_ACTUALIZAR',
  PUBLICACION_ELIMINAR: 'PUBLICACION_ELIMINAR',
  PORTADA_ACTUALIZAR: 'PORTADA_ACTUALIZAR',
  CONTENIDO_ACTUALIZAR: 'CONTENIDO_ACTUALIZAR',
  SECCION_GUARDAR: 'SECCION_GUARDAR',
  SECCION_BORRAR: 'SECCION_BORRAR',
  // El Inicio del CMS: avisos de la junta y la foto del retablo
  AVISO_CREAR: 'AVISO_CREAR',
  AVISO_HECHO: 'AVISO_HECHO',
  RETABLO_ACTUALIZAR: 'RETABLO_ACTUALIZAR',
  // Los textos a mano de la Memoria del curso
  INFORME_ANUAL_ACTUALIZAR: 'INFORME_ANUAL_ACTUALIZAR',
  // Sistema → Módulos: encender o apagar un módulo de la instalación
  MODULO_ENCENDER: 'MODULO_ENCENDER',
  MODULO_APAGAR: 'MODULO_APAGAR',
  // Sistema → Datos de la corporación: Secretaría, sede, redes y privacidad
  CORPORACION_ACTUALIZAR: 'CORPORACION_ACTUALIZAR',
  // CMS → Páginas: el nombre de una página en el menú público
  MENU_NOMBRES_ACTUALIZAR: 'MENU_NOMBRES_ACTUALIZAR',
  // Correo que no salió. No es una acción de nadie, pero se guarda aquí porque
  // es el único sitio del CMS donde el staff puede enterarse: antes el fallo
  // moría en un console.error y el alta se daba por buena sin avisar a nadie.
  EMAIL_FALLIDO: 'EMAIL_FALLIDO'
} as const;

export class AuditoriaService {

  /**
   * Extrae los metadatos del request (requiere que authenticateToken ya haya corrido).
   */
  static metaFromReq(req: Request): MetaDeAuditoria {
    return {
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.slice(0, 250)
    };
  }

  /**
   * Borra los registros más antiguos que el plazo de retención. La auditoría
   * guarda IP y navegador, que son datos personales: no pueden guardarse sin
   * límite. El plazo por defecto (730 días) cubre dos ejercicios contables
   * completos; se ajusta con AUDIT_RETENTION_DAYS.
   */
  static async purgarAntiguos(dias = Number(process.env.AUDIT_RETENTION_DAYS ?? 730)): Promise<number> {
    if (!Number.isInteger(dias) || dias < 30) {
      throw new Error(`AUDIT_RETENTION_DAYS debe ser un entero de 30 o más (recibido: ${dias}).`);
    }
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const { count } = await db.auditLog.deleteMany({ where: { createdAt: { lt: limite } } });
    return count;
  }

  /**
   * Registra una acción sensible. Fire-and-forget tolerante a fallos:
   * un problema escribiendo auditoría NUNCA debe romper la operación de negocio
   * (queda logueado en consola para alertar al administrador).
   *
   * Se llama DESPUÉS de que la operación haya confirmado, no antes: si la
   * transacción falla, el registro no debe dar fe de algo que no ocurrió.
   * `detalles` lleva el estado anterior y el nuevo (`{ antes, despues }`) o
   * lo que haga falta para entender el cambio sin reconstruirlo.
   */
  static async log(
    action: string,
    meta: MetaDeAuditoria,
    entityType?: string,
    entityId?: string | number,
    detalles?: Prisma.InputJsonValue
  ): Promise<void> {
    try {
      await db.auditLog.create({
        data: {
          action,
          userId: meta.userId ?? null,
          ip: meta.ip,
          userAgent: meta.userAgent,
          entityType: entityType ?? null,
          entityId: entityId !== undefined ? String(entityId) : null,
          ...(detalles !== undefined ? { detalles } : {})
        }
      });
    } catch (e) {
      console.error(`[Audit] No se pudo registrar la acción '${action}':`, e);
    }
  }
}
