import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Collapse, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { getAuditLogs, type AuditEntry } from '../../lib/api/audit'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'

/**
 * Nombre legible de cada acción (AUDIT_ACTIONS en audit.service.ts). Una acción
 * que no esté aquí se enseña con su código tal cual: mejor eso que ocultarla.
 */
const ACCIONES: Record<string, string> = {
  STAFF_PROMOTE: 'Asignar un cargo',
  STAFF_DEMOTE: 'Retirar un cargo',
  CONFIG_UPDATE: 'Cambiar la configuración',
  '2FA_RESET_ADMIN': 'Restablecer el segundo factor de otra persona',
  RECIBO_COBRAR: 'Cobrar un recibo',
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
  PUBLICACION_CREAR: 'Crear una publicación',
  PUBLICACION_ACTUALIZAR: 'Editar una publicación',
  PUBLICACION_ELIMINAR: 'Borrar una publicación',
  PORTADA_ACTUALIZAR: 'Cambiar la portada',
  CONTENIDO_ACTUALIZAR: 'Cambiar los textos de una página',
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

  const { antes, despues, ...resto } = detalles
  const mapaAntes = esObjeto(antes) ? antes : {}
  const mapaDespues = esObjeto(despues) ? despues : {}
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

function EntradaAuditoria({ entry }: { entry: AuditEntry }) {
  const [abierto, setAbierto] = useState(false)
  const conDetalles = entry.detalles !== null && entry.detalles !== undefined
  const idDetalles = `detalles-auditoria-${entry.id}`

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6">{ACCIONES[entry.action] ?? entry.action}</Typography>
      {/* El código se queda a la vista: es lo que se busca en los registros. */}
      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{entry.action}</Typography>
      <Typography variant="body2" color="text.secondary">{entry.user ? `${entry.user.nombre} ${entry.user.apellidos} (${entry.user.role})` : 'Usuario no disponible'} · {new Date(entry.createdAt).toLocaleString('es-ES')}</Typography>
      <Typography variant="body2" color="text.secondary">{entry.entityType ?? 'Sin entidad'}{entry.entityId ? ` #${entry.entityId}` : ''}{entry.ip ? ` · IP ${entry.ip}` : ''}</Typography>
      {conDetalles && (
        <>
          <Button size="small" sx={{ mt: 1, px: 0 }} aria-expanded={abierto} aria-controls={idDetalles} onClick={() => setAbierto((actual) => !actual)}>
            {abierto ? 'Ocultar detalles' : 'Ver detalles'}
          </Button>
          <Collapse in={abierto} id={idDetalles} unmountOnExit>
            <DetallesAuditoria detalles={entry.detalles} />
          </Collapse>
        </>
      )}
    </Paper>
  )
}

export default function AuditAdminPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en el paginador lanzan dos cargas que pueden resolverse en
  // orden inverso y dejar en pantalla los datos de una página con la URL
  // diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  const load = useCallback((vigente: () => boolean = () => true) => getAuditLogs({ pagina, porPagina }).then((result) => { if (!vigente()) return; setEntries(result.data); setMeta(result.meta) }), [pagina, porPagina])
  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((e: unknown) => { if (!cancelado) setError(e instanceof Error ? e.message : 'No se ha podido cargar la auditoría.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [load])

  return <><Helmet><title>Auditoría | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet><Typography variant="h2" component="h1" sx={{ mb: 4 }}>Registro de auditoría</Typography>{error && <Alert severity="error">{error}</Alert>}{loading ? <CircularProgress aria-label="Cargando auditoría" /> : <Stack spacing={2}>{entries.map((entry) => <EntradaAuditoria key={entry.id} entry={entry} />)}{!entries.length && <Alert severity="info">No hay registros de auditoría.</Alert>}</Stack>}{meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="registro de auditoría" />}</>
}
