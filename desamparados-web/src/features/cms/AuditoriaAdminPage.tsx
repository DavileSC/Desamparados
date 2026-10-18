import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Collapse, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { registrosDeAuditoria, type AuditEntry } from '../../lib/api/auditoria'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'
import { NOMBRE_CARGO } from '../../app/cmsNavegacion'
import CabeceraSeccion from './CabeceraSeccion'
import { site } from '../../config/site'
import CORREOS from '../../../../shared/usos-de-correo.json'

/**
 * Nombre legible de cada acción (AUDIT_ACTIONS en audit.service.ts). Una acción
 * que no esté aquí se enseña con su código tal cual: mejor eso que ocultarla.
 */
const ACCIONES: Record<string, string> = {
  STAFF_PROMOTE: 'Asignar un cargo',
  STAFF_DEMOTE: 'Retirar un cargo',
  CONFIG_UPDATE: 'Cambiar la configuración',
  MODULO_ENCENDER: 'Módulo encendido',
  MODULO_APAGAR: 'Módulo apagado',
  '2FA_RESET_ADMIN': 'Restablecer el segundo factor de otra persona',
  RECIBO_COBRAR: 'Cobrar un recibo',
  REMESA_GENERAR: 'Generar una remesa de adeudos',
  REMESA_COBRAR: 'Dar una remesa por cobrada',
  NORMA43_APLICAR: 'Aplicar el extracto del banco',
  CENSO_EXPORTAR: 'Exportar el censo',
  CENSO_IMPORTAR: 'Importar el censo',
  PRIMER_ACCESO_INVITAR: 'Invitar al primer acceso',
  PRIMER_ACCESO_CONFIRMAR: 'Confirmar la ficha en el primer acceso',
  PRIMER_ACCESO_FICHA_AJENA: 'Devolver una ficha que no es de la familia',
  CORTEJO_REPARTIR: 'Repartir el cortejo por antigüedad',
  COMUNICADO_ENVIAR: 'Enviar un boletín o aviso',
  BOLETIN_BAJA: 'Darse de baja del boletín',
  CABILDO_CELEBRAR: 'Dar un cabildo por celebrado',
  CABILDO_ACTA_APROBAR: 'Aprobar el acta de un cabildo',
  CATEGORIA_CUENTA: 'Cambiar la cuenta contable de una categoría',
  CONTABILIDAD_EXPORTAR: 'Exportar la contabilidad a Excel',
  TIENDA_PEDIDO_PAGADO: 'Pedido de la tienda pagado',
  TIENDA_PEDIDO_ENTREGADO: 'Entregar un pedido de la tienda',
  TIENDA_PEDIDO_ANULADO: 'Anular un pedido de la tienda',
  APADRINAMIENTO_PAGADO: 'Apadrinamiento pagado',
  CAJA_ABRIR: 'Abrir la caja de la tienda',
  CAJA_VENDER: 'Venta en mano de la tienda',
  CAJA_ANULAR: 'Anular una venta en mano',
  CAJA_CERRAR: 'Cerrar la caja de la tienda',
  TIENDA_INGRESO_BANCO: 'Ingresar en el banco el efectivo de la tienda',
  TIENDA_INGRESO_BORRAR: 'Borrar un ingreso en el banco de la tienda',
  CORTEJO_DIRECTO_EMPEZAR: 'Sacar el cortejo en directo',
  PUERTA_DESHACER: 'Deshacer una entrada al templo',
  MODELO_182_FICHERO: 'Sacar el fichero del Modelo 182',
  MODELO_182_ENVIAR: 'Mandar los certificados de donativos',
  PLANTILLA_CORREO_CREAR: 'Crear una plantilla de correo',
  PLANTILLA_CORREO_ACTUALIZAR: 'Cambiar una plantilla de correo',
  PLANTILLA_CORREO_BORRAR: 'Borrar una plantilla de correo',
  PLANTILLA_CORREO_USAR: 'Poner en uso una plantilla de correo',
  CORTEJO_DIRECTO_TERMINAR: 'Terminar el cortejo en directo',
  CORTEJO_DIRECTO_RECORRIDO: 'Cambiar el recorrido en uso desde la calle',
  RECIBO_ACTUALIZAR: 'Editar un recibo',
  RECIBO_EMITIR: 'Emitir un recibo',
  CUOTAS_GENERAR: 'Generar las cuotas',
  TRANSACCION_CREAR: 'Crear un apunte contable',
  TRANSACCION_ACTUALIZAR: 'Corregir un apunte contable',
  TRANSACCION_ELIMINAR: 'Borrar un apunte contable',
  CATEGORIA_CREAR: 'Crear una categoría contable',
  CATEGORIA_RENOMBRAR: 'Renombrar una categoría contable',
  CATEGORIA_DESACTIVAR: 'Desactivar una categoría contable',
  CATEGORIA_REACTIVAR: 'Reactivar una categoría contable',
  PAPELETA_ANULAR: 'Anular una papeleta de sitio',
  INSCRIPCION_FACTURAR: 'Facturar una inscripción',
  TURNO_CREAR: 'Crear un turno de reparto',
  TURNO_ACTUALIZAR: 'Editar un turno de reparto',
  TURNO_ELIMINAR: 'Borrar un turno de reparto',
  AUSENCIAS_PROCESAR: 'Procesar ausencias',
  PLAZO_PAPELETAS_ABRIR: 'Abrir la solicitud de papeletas',
  PLAZO_PAPELETAS_CERRAR: 'Cerrar la solicitud de papeletas',
  SOLICITUD_APROBAR: 'Aprobar una solicitud de alta',
  SOLICITUD_RECHAZAR: 'Rechazar una solicitud de alta',
  HERMANO_BAJA: 'Dar de baja a un hermano',
  HERMANO_REACTIVAR: 'Reactivar a un hermano',
  HERMANO_ACTUALIZAR: 'Editar la ficha de un hermano',
  HERMANO_BAJA_FAMILIAR: 'Baja de un perfil desde el área de hermanos',
  FAMILIAR_CREAR: 'Añadir un familiar (solicitud de alta)',
  FAMILIAR_ACTUALIZAR: 'Editar un perfil desde el área de hermanos',
  FAMILIAR_SOLICITUD_RETIRAR: 'Retirar una solicitud desde el área de hermanos',
  CENSO_REORDENAR: 'Reordenar el censo',
  EMANCIPACION: 'Emancipar a un hermano',
  CUENTA_DATOS_EXPORT: 'Exportar sus datos (RGPD)',
  CUENTA_AUTODELETE: 'Eliminar su cuenta (RGPD)',
  NOTICIA_CREAR: 'Crear una noticia',
  NOTICIA_ACTUALIZAR: 'Editar una noticia',
  NOTICIA_ELIMINAR: 'Borrar una noticia',
  PAGINA_GUARDAR: 'Crear una página',
  PAGINA_ACTUALIZAR: 'Editar una página',
  PAGINA_ELIMINAR: 'Borrar una página',
  EVENTO_CREAR: 'Crear un evento de la agenda',
  AVISO_CREAR: 'Poner un aviso de la junta',
  AVISO_HECHO: 'Dar por hecho un aviso de la junta',
  INFORME_ANUAL_ACTUALIZAR: 'Escribir en el Informe anual',
  RETABLO_ACTUALIZAR: 'Cambiar la foto del retablo del Inicio',
  CORPORACION_ACTUALIZAR: 'Cambiar los datos de contacto de la corporación',
  MENU_NOMBRES_ACTUALIZAR: 'Cambiar el nombre de una página en el menú',
  WEB_ABRIR: 'Abrir la web al público',
  WEB_CERRAR: 'Cerrar la web («Próximamente»)',
  EVENTO_ACTUALIZAR: 'Editar un evento de la agenda',
  EVENTO_ELIMINAR: 'Borrar un evento de la agenda',
  ENSER_CREAR: 'Crear un enser',
  ENSER_ACTUALIZAR: 'Editar un enser',
  ENSER_ELIMINAR: 'Borrar un enser',
  PRENDA_CREAR: 'Crear una prenda',
  PRENDA_ACTUALIZAR: 'Editar una prenda',
  PRENDA_ELIMINAR: 'Borrar una prenda',
  PRENDA_ASIGNAR: 'Prestar una prenda',
  PRENDA_DEVOLVER: 'Devolver una prenda',
  PRENDAS_LAVADAS: 'Marcar prendas como lavadas',
  CINGULOS_TOTAL: 'Cambiar el total de cíngulos',
  MESA_DEVOLVER: 'Recibir la ropa devuelta en la mesa',
  PUBLICACION_CREAR: 'Crear una publicación',
  PUBLICACION_ACTUALIZAR: 'Editar una publicación',
  PUBLICACION_ELIMINAR: 'Borrar una publicación',
  PORTADA_ACTUALIZAR: 'Cambiar la portada',
  CONTENIDO_ACTUALIZAR: 'Cambiar los textos de una página',
  SECCION_GUARDAR: 'Guardar una sección del constructor',
  SECCION_BORRAR: 'Borrar una sección del constructor',
  MESA_ALTA: 'Dar de alta en la mesa de procesión',
  PAPELETA_EDITAR: 'Corregir una papeleta de sitio',
  MESA_INSCRIBIR: 'Inscribir en la mesa de procesión',
  MESA_COBRAR: 'Cobrar en la mesa de procesión',
  RECIBO_PERDONAR: 'Perdonar un recibo',
  PAPELETA_ENTREGAR: 'Entregar una papeleta de sitio',
  SOLICITUD_SALIDA_CANCELAR: 'Cancelar una solicitud de salida',
  SOLICITUD_SALIDA_PEDIR: 'Pedir la papeleta desde el área de hermanos',
  SOLICITUD_SALIDA_CAMBIAR_DIA: 'Cambiar el día de recoger la papeleta',
  PAGO_EN_LINEA: 'Pagar en línea desde el área de hermanos',
  SALIDA_CREAR: 'Dar de alta una salida',
  SALIDA_EDITAR: 'Cambiar una salida',
  SALIDA_FECHAR: 'Poner fecha a una salida',
  REACTIVACION_DESCARTAR: 'Descartar una reactivación',
  CENSO_CERRAR_HUECOS: 'Cerrar los huecos del censo',
  EMAIL_FALLIDO: 'Correo que no se pudo enviar',
  CORREO_REBOTA: 'Correo que rebota (aviso del servicio de envío)',
  CORREO_REBOTA_QUITAR: 'Quitar la marca de correo que rebota',
  ALTA_NO_TRAMITADA: 'Alta por la web no tramitada (datos ya registrados)',
  FAMILIAR_DNI_OCUPADO: 'DNI de otra ficha escrito desde el área de hermanos',
  CONTRASENA_CAMBIAR: 'Cambiar su contraseña',
  PAGO_EN_LINEA_INCIDENCIA: 'Pago en línea que no cuadra',
  PAGO_EN_LINEA_RESOLVER: 'Dar por resuelto un pago en línea',
  DEFUNCION_FIJAR: 'Fijar la fecha de defunción',
  SUFRAGIO_CREAR: 'Apuntar un sufragio',
  SUFRAGIO_BORRAR: 'Borrar un sufragio',
  PESAME_ENVIAR: 'Enviar el pésame',
  CARTAS_GENERAR: 'Generar cartas',
  ETIQUETAS_GENERAR: 'Generar etiquetas',
  LOTERIA_COMPRA: 'Comprar lotería',
  LOTERIA_COMPRA_DESHACER: 'Deshacer una compra de lotería',
  LOTERIA_ENTREGA: 'Entregar talonarios de lotería',
  LOTERIA_LIQUIDAR: 'Liquidar un talonario de lotería',
  LOTERIA_LIQUIDAR_DESHACER: 'Deshacer la liquidación de un talonario',
  LOTERIA_PREMIOS: 'Apuntar los premios de la lotería',
}

/** Nombre legible de los campos que aparecen en los detalles; el resto va tal cual. */
const CAMPOS: Record<string, string> = {
  nombre: 'Nombre', apellidos: 'Apellidos', dni: 'DNI', fechaNacimiento: 'Fecha de nacimiento',
  telefono: 'Teléfono', email: 'Correo electrónico', direccion: 'Dirección', poblacion: 'Población',
  codigoPostal: 'Código postal', numeroHermano: 'Número de hermano', fechaAlta: 'Fecha de alta',
  fechaBaja: 'Fecha de baja', activo: 'En el censo', esTitular: 'Titular de su cuenta',
  tieneTunicaPropia: 'Túnica propia', tunica: 'Talla de túnica', alturaHombro: 'Altura de hombro (cm)',
  puesto: 'Puesto', iban: 'IBAN', titularCuenta: 'Titular de la cuenta bancaria',
  cuentaActiva: 'Cuenta con acceso', cuentaAprobada: 'Cuenta ya aprobada', cuentaEliminada: 'Cuenta eliminada',
  cuentaTutorActiva: 'Cuenta del tutor con acceso', cuentaAnonimizada: 'Cuenta suprimida (RGPD)',
  fichasPendientes: 'Fichas pendientes', fichasAprobadas: 'Fichas aprobadas', fichasEliminadas: 'Fichas eliminadas',
  userId: 'Cuenta (id)', id: 'Ficha', role: 'Cargo', value: 'Valor', origen: 'Origen',
  totalProcesados: 'Hermanos procesados', estado: 'Estado',
  primerApellido: 'Primer apellido', segundoApellido: 'Segundo apellido', sexo: 'Sexo', estadoCivil: 'Estado civil',
  profesion: 'Profesión', lugarNacimiento: 'Natural de', telefonoFijo: 'Teléfono fijo', email2: 'Segundo correo',
  provincia: 'Provincia', pais: 'País', fechaBautismo: 'Fecha de bautismo', parroquiaBautismo: 'Parroquia de bautismo',
  fechaJura: 'Fecha de jura', presentadoPor: 'Presentado por', presentadoPor2: 'Presentado también por',
  formaPagoPref: 'Forma de pago', parentesco: 'Parentesco',
  abierto: 'Solicitud abierta', avisados: 'Cuentas avisadas por correo', noticiaId: 'Borrador de noticia',
  motivo: 'Motivo', uso: 'Correo', para: 'Para', fichaConEseDni: 'Ficha que ya tiene ese DNI',
  sesionesCerradas: 'Sesiones cerradas', antes: 'Antes', despues: 'Después',
  reembolso: 'Reembolso apuntado en Contabilidad',
}

/**
 * Los correos por su nombre: EMAIL_FALLIDO guarda la clave del uso y no el
 * asunto (que podía llevar el nombre del destinatario). Los del catálogo de
 * Emails salen de shared/; estos otros no tienen plantilla.
 */
const CORREOS_SIN_PLANTILLA: Record<string, string> = {
  comunicado: 'Boletín o aviso', comunicado_prueba: 'Prueba de un boletín o aviso',
  aviso_solicitud: 'Aviso a Secretaría de una solicitud nueva', contacto: 'Mensaje del formulario de contacto',
  sin_clasificar: 'Sin clasificar',
}
const NOMBRE_DE_CORREO: Record<string, string> = {
  ...CORREOS_SIN_PLANTILLA,
  ...Object.fromEntries(CORREOS.usos.map((uso) => [uso.clave, uso.nombre])),
}

/** Con qué chocó un alta no tramitada (registro.service: `Choque`). */
const MOTIVOS_ALTA: Record<string, string> = {
  correo_de_cuenta: 'El correo ya es de una cuenta',
  dni_de_cuenta: 'El DNI ya es de una cuenta',
  dni_en_el_censo: 'El DNI ya está en el censo',
  dni_de_menor_en_el_censo: 'El DNI de un menor ya está en el censo',
  carrera: 'Otra alta con los mismos datos entró a la vez',
}

/**
 * Los detalles con sus códigos traducidos donde la acción los trae: la clave
 * del correo y el motivo del alta. El código se queda entre paréntesis, que es
 * lo que se busca en los registros del servidor.
 */
function legibles(accion: string, detalles: unknown): unknown {
  if (!esObjeto(detalles)) return detalles
  const salida = { ...detalles }
  const conCodigo = (nombre: string | undefined, codigo: string) => (nombre ? `${nombre} (${codigo})` : codigo)
  if (accion === 'EMAIL_FALLIDO' && typeof salida.uso === 'string') salida.uso = conCodigo(NOMBRE_DE_CORREO[salida.uso], salida.uso)
  if (accion === 'ALTA_NO_TRAMITADA' && typeof salida.motivo === 'string') salida.motivo = conCodigo(MOTIVOS_ALTA[salida.motivo], salida.motivo)
  return salida
}

const etiqueta = (campo: string) => CAMPOS[campo] ?? campo

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor)

/**
 * Un valor de los detalles, en texto para personas: sin comillas ni llaves,
 * fechas en dd/mm/aaaa y «Sí»/«No» en vez de true/false.
 */
function formatear(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor.split('-').reverse().join('/')
  if (Array.isArray(valor)) return valor.length ? valor.map(formatear).join('; ') : '—'
  if (esObjeto(valor)) return Object.entries(valor).map(([clave, v]) => `${etiqueta(clave)}: ${formatear(v)}`).join(' · ')
  return String(valor)
}

/** Los detalles de un apunte: los datos sueltos arriba y el antes/después en tabla. */
function DetallesAuditoria({ detalles }: { detalles: unknown }) {
  if (!esObjeto(detalles)) return <Typography variant="body2">{formatear(detalles)}</Typography>

  // El antes y el después van en tabla cuando son objetos; un valor suelto
  // (la fecha de una defunción) se queda con los demás datos, o se perdería.
  const tabla = esObjeto(detalles.antes) || esObjeto(detalles.despues)
  const { antes, despues, ...sueltos } = detalles
  const resto = tabla ? sueltos : detalles
  const mapaAntes = tabla && esObjeto(antes) ? antes : {}
  const mapaDespues = tabla && esObjeto(despues) ? despues : {}
  const campos = [...new Set([...Object.keys(mapaAntes), ...Object.keys(mapaDespues)])]

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      {Object.entries(resto).map(([clave, valor]) => (
        <Typography key={clave} variant="body2"><strong>{etiqueta(clave)}:</strong> {formatear(valor)}</Typography>
      ))}
      {campos.length > 0 && (
        // Una reordenación del censo trae cientos de filas: la tabla hace scroll
        // dentro de su caja y no ensancha la página.
        <Box sx={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
          <Table size="small" aria-label="Cambios">
            <TableHead>
              <TableRow><TableCell>Campo</TableCell><TableCell>Antes</TableCell><TableCell>Después</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {campos.map((campo) => (
                <TableRow key={campo}>
                  <TableCell component="th" scope="row">{etiqueta(campo)}</TableCell>
                  <TableCell>{campo in mapaAntes ? formatear(mapaAntes[campo]) : '—'}</TableCell>
                  <TableCell>{campo in mapaDespues ? formatear(mapaDespues[campo]) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Stack>
  )
}

/** Sobre qué recae cada acción, en palabras; un tipo que no esté aquí va tal cual. */
const ENTIDADES: Record<string, string> = {
  hermano: 'Hermano', user: 'Cuenta', recibo: 'Recibo', papeleta: 'Papeleta', solicitud: 'Solicitud',
  transaccion: 'Apunte', categoria: 'Categoría', turno: 'Turno', cita: 'Cita', evento: 'Evento',
  noticia: 'Noticia', pagina: 'Página', publicacion: 'Publicación', seccion: 'Sección', portada: 'Portada',
  contenido: 'Contenido', enser: 'Enser', prenda: 'Prenda', email: 'Correo', config: 'Configuración',
  configuracion: 'Configuración', modulo: 'Módulo',
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * Una fila de la tabla y, debajo, sus detalles plegados. El código de la acción
 * se queda a la vista, en pequeño, cuando tiene nombre: es lo que se busca en
 * los registros.
 */
function FilaAuditoria({ entry }: { entry: AuditEntry }) {
  const [abierto, setAbierto] = useState(false)
  const conDetalles = entry.detalles !== null && entry.detalles !== undefined
  const idDetalles = `detalles-auditoria-${entry.id}`
  const nombre = ACCIONES[entry.action]
  const sobre = entry.entityType ? `${ENTIDADES[entry.entityType] ?? entry.entityType}${entry.entityId ? ` #${entry.entityId}` : ''}` : '—'

  return (
    <>
      <TableRow sx={conDetalles && abierto ? { '& > td': { borderBottom: 0 } } : undefined}>
        <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{fechaCorta(entry.createdAt)}</TableCell>
        <TableCell>
          <Typography variant="body2">{nombre ?? entry.action}</Typography>
          {nombre && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontFamily: 'monospace' }}>{entry.action}</Typography>}
        </TableCell>
        <TableCell>
          {entry.user ? (
            <>
              <Typography variant="body2">{entry.user.nombre} {entry.user.apellidos}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{NOMBRE_CARGO[entry.user.role] ?? entry.user.role}</Typography>
            </>
          ) : <Typography variant="body2" color="text.secondary">Sin usuario</Typography>}
        </TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          <Typography variant="body2">{sobre}</Typography>
          {entry.ip && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>IP {entry.ip}</Typography>}
        </TableCell>
        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
          {conDetalles && (
            <Button size="small" aria-expanded={abierto} aria-controls={idDetalles} onClick={() => setAbierto((actual) => !actual)}>
              {abierto ? 'Ocultar detalles' : 'Ver detalles'}
            </Button>
          )}
        </TableCell>
      </TableRow>
      {conDetalles && (
        <TableRow>
          <TableCell colSpan={5} sx={{ py: 0, ...(abierto ? {} : { borderBottom: 0 }) }}>
            <Collapse in={abierto} id={idDetalles} unmountOnExit>
              <Box sx={{ pb: 2 }}><DetallesAuditoria detalles={legibles(entry.action, entry.detalles)} /></Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export default function AuditoriaAdminPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en el paginador lanzan dos cargas que pueden resolverse en
  // orden inverso y dejar en pantalla los datos de una página con la URL
  // diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  const cargar = useCallback((vigente: () => boolean = () => true) => registrosDeAuditoria({ pagina, porPagina }).then((result) => { if (!vigente()) return; setEntries(result.data); setMeta(result.meta) }), [pagina, porPagina])
  useEffect(() => {
    let cancelado = false
    cargar(() => !cancelado)
      .catch((e: unknown) => { if (!cancelado) setError(e instanceof Error ? e.message : 'No se ha podido cargar la auditoría.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [cargar])

  return (
    <>
      <Helmet><title>{`Auditoría | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Auditoría" subtitulo={meta ? `${meta.total.toLocaleString('es-ES', { useGrouping: 'always' })} registros, del más reciente al más antiguo` : undefined} />
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? <CircularProgress aria-label="Cargando auditoría" /> : !entries.length ? <Alert severity="info">No hay registros de auditoría.</Alert> : (
        <TableContainer component={Paper}>
          <Table size="small" aria-label="Registros de auditoría" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow><TableCell>Fecha</TableCell><TableCell>Acción</TableCell><TableCell>Quién</TableCell><TableCell>Sobre qué</TableCell><TableCell /></TableRow>
            </TableHead>
            <TableBody>{entries.map((entry) => <FilaAuditoria key={entry.id} entry={entry} />)}</TableBody>
          </Table>
        </TableContainer>
      )}
      {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="registro de auditoría" />}
    </>
  )
}
