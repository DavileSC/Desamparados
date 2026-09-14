import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import EditIcon from '@mui/icons-material/Edit'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../members/auth/store'
import { CLAVE_PANEL_HOY } from '../../app/usePanelDeHoy'
import { approveRequest, cerrarHuecosDeNumero, getPendingRequests, rejectRequest, searchBrothers, type AdminBrother, type PendingRequest } from '../../lib/api/brothers'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import type { MetaPaginacion } from '../../lib/api/tipos'

export default function BrothersAdminPage() {
  const queryClient = useQueryClient()
  const role = useAuthStore((state) => state.user?.role ?? 'USER')
  // El Hermano Mayor gestiona el censo como secretaría: edita fichas y admite
  // altas. Quien llega aquí sin ser ninguno de los tres es porque la guarda de
  // ruta le deja mirar, no tocar.
  const puedeGestionar = role === 'ADMIN' || role === 'SECRETARIA' || role === 'HERMANO_MAYOR'
  const [params, setParams] = useSearchParams()
  // La vista vive en la URL: así se puede volver a las solicitudes desde una
  // ficha sin perder dónde se estaba.
  const vista = params.get('vista') === 'solicitudes' ? 'solicitudes' : 'censo'
  const [query, setQuery] = useState('')
  const [brothers, setBrothers] = useState<AdminBrother[]>([])
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // La consulta actual viaja con el enlace de editar (página, tamaño y filtros):
  // así la pantalla de edición sabe a qué página del listado devolver.
  const { search: consultaListado } = useLocation()
  const { pagina, porPagina, irAPagina, cambiarTamano, reiniciar } = usePaginacion()
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)
  // Segundo listado de la misma pantalla, con su propia paginación: el prefijo
  // evita que ?pagina= y ?paginaSolicitudes= se pisen en la URL.
  const solicitudes = usePaginacion('Solicitudes')
  const [metaSolicitudes, setMetaSolicitudes] = useState<MetaPaginacion | null>(null)
  // Solicitud que se está aprobando o rechazando: mientras tanto no responde
  // ningún botón de la lista. Un doble clic en «Aprobar» mandaba dos peticiones
  // (un 500 o un número de hermano saltado). La referencia es la guarda
  // síncrona: el diálogo de confirmación tarda en cerrarse y un segundo clic en
  // su botón llegaría antes que el nuevo estado.
  const [procesando, setProcesando] = useState<number | null>(null)
  const enMarcha = useRef(false)
  const [porRechazar, setPorRechazar] = useState<PendingRequest | null>(null)
  const [porAsignarNumeros, setPorAsignarNumeros] = useState(false)

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en el paginador lanzan dos cargas que pueden resolverse en
  // orden inverso y dejar en pantalla los datos de una página con la URL
  // diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  // Las llamadas de después de aprobar o rechazar la omiten: no hay carrera.
  const load = useCallback((vigente: () => boolean = () => true) => Promise.all([
    puedeGestionar
      ? getPendingRequests({ pagina: solicitudes.pagina, porPagina: solicitudes.porPagina })
      : Promise.resolve({ data: [] as PendingRequest[], meta: { total: 0, page: 1, limit: solicitudes.porPagina, totalPages: 0 } }),
    searchBrothers(query, { pagina, porPagina }),
  ]).then(([pendientes, censo]) => {
    if (!vigente()) return
    setBrothers(censo.data)
    setMeta(censo.meta)
    setRequests(pendientes.data)
    setMetaSolicitudes(pendientes.meta)
    // El menú saca sus contadores («hermanos sin número», solicitudes
    // pendientes) de la consulta del panel, que guarda cinco minutos. Asignar
    // números, aprobar y rechazar mueven justo esos números, y esta pantalla es
    // la única forma de bajarlos: sin invalidar el panel, Secretaría leía «Se han
    // asignado 3 números de hermano» y el menú seguía diciendo 3 durante cinco
    // minutos, aun cambiando de pantalla dentro del CMS. Va aquí y no en el
    // botón de asignar porque los tres caminos recargan el censo por aquí.
    void queryClient.invalidateQueries({ queryKey: CLAVE_PANEL_HOY })
  }), [puedeGestionar, query, pagina, porPagina, solicitudes.pagina, solicitudes.porPagina, queryClient])

  useEffect(() => {
    // El temporizador ya cancelaba la carga que aún no había salido; `cancelado`
    // se ocupa de la que salió y todavía no ha vuelto.
    let cancelado = false
    const timer = window.setTimeout(() => load(() => !cancelado)
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se ha podido cargar el censo.') })
      .finally(() => { if (!cancelado) setLoading(false) }), query ? 300 : 0)
    return () => { cancelado = true; window.clearTimeout(timer) }
  }, [load, query])

  const handleRequest = async (request: PendingRequest, approve: boolean) => {
    if (enMarcha.current) return
    enMarcha.current = true
    setProcesando(request.id); setError(null); setNotice(null)
    try { await (approve ? approveRequest(request.id) : rejectRequest(request.id)); await load(); setNotice(approve ? 'Solicitud aprobada correctamente.' : 'Solicitud rechazada correctamente.') }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido procesar la solicitud.') }
    finally { enMarcha.current = false; setProcesando(null) }
  }

  /** Reparte los números que faltan. `enMarcha` es la guarda del doble clic, igual que al aprobar. */
  const asignarNumeros = async () => {
    if (enMarcha.current) return
    enMarcha.current = true
    setError(null); setNotice(null)
    try {
      const { message } = await cerrarHuecosDeNumero()
      await load()
      setNotice(message)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se han podido asignar los números.')
    } finally { enMarcha.current = false }
  }

  /** Qué se borra al rechazar: depende de si la cuenta ya estaba aprobada. */
  const mensajeRechazo = (request: PendingRequest) => {
    const perfiles = request.hermanos.length === 1 ? 'su perfil pendiente' : `sus ${request.hermanos.length} perfiles pendientes`
    return request.active
      ? `Se borrarán ${perfiles} de ${request.nombre} ${request.apellidos}; su cuenta se mantiene. No se puede deshacer.`
      : `Se borrará la solicitud de ${request.nombre} ${request.apellidos} con sus datos personales y la cuenta que abrió. No se puede deshacer.`
  }

  return <>
    <Helmet><title>Hermanos | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <Typography variant="h2" component="h1" sx={{ mb: 4 }}>Gestión de hermanos</Typography>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert>}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
      <Tabs value={vista} onChange={(_, valor) => setParams(valor === 'solicitudes' ? { vista: 'solicitudes' } : {})}>
        <Tab value="censo" label="Censo" />
        <Tab value="solicitudes" label={`Solicitudes (${metaSolicitudes?.total ?? 0})`} />
      </Tabs>
      {puedeGestionar && (
        <Button variant="outlined" onClick={() => setPorAsignarNumeros(true)}>Asignar números</Button>
      )}
    </Box>
    {/* Rechazar borra datos personales (y a veces la cuenta entera): se pregunta antes. */}
    <DialogoConfirmacion
      abierto={porRechazar !== null}
      titulo="¿Rechazar la solicitud?"
      mensaje={porRechazar ? mensajeRechazo(porRechazar) : ''}
      textoConfirmar="Rechazar solicitud"
      peligro
      onConfirmar={() => { const solicitud = porRechazar; setPorRechazar(null); if (solicitud) void handleRequest(solicitud, false) }}
      onCancelar={() => setPorRechazar(null)}
    />
    {/* Asignar números toca el censo entero: se pregunta antes, como al rechazar. */}
    <DialogoConfirmacion
      abierto={porAsignarNumeros}
      titulo="¿Asignar los números que faltan?"
      mensaje="Se dará número de hermano, por antigüedad, a los que están activos y no lo tienen. A quien ya tiene número no se le toca."
      textoConfirmar="Asignar números"
      onConfirmar={() => { setPorAsignarNumeros(false); void asignarNumeros() }}
      onCancelar={() => setPorAsignarNumeros(false)}
    />
    {vista === 'solicitudes' ? <Paper sx={{ p: 3 }}><Stack spacing={2}>
      {requests.map((request) => <Box key={request.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}><Box><Typography>{request.nombre} {request.apellidos}</Typography><Typography variant="body2" color="text.secondary">{request.email} · {request.hermanos.length} perfil(es)</Typography></Box><Stack direction="row" spacing={1}><Button variant="contained" disabled={procesando !== null} onClick={() => void handleRequest(request, true)}>{procesando === request.id ? 'Procesando…' : 'Aprobar'}</Button><Button color="error" disabled={procesando !== null} onClick={() => setPorRechazar(request)}>Rechazar</Button></Stack></Box>)}
      {requests.length === 0 && <Alert severity="info">No hay solicitudes pendientes.</Alert>}
    </Stack>
    {metaSolicitudes && <Paginador meta={metaSolicitudes} onPagina={solicitudes.irAPagina} onTamano={solicitudes.cambiarTamano} etiqueta="solicitudes de alta" />}
    </Paper> : <>
    <TextField label="Buscar por nombre, DNI o email" value={query} onChange={(event) => { setQuery(event.target.value); reiniciar() }} fullWidth sx={{ mb: 3 }} />
    {loading ? <CircularProgress aria-label="Cargando censo" /> : <Stack spacing={2}>{brothers.map((brother) => <Paper key={brother.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}><Box><Typography variant="h6">{brother.nombre} {brother.apellidos}</Typography><Typography variant="body2" color="text.secondary">{brother.numeroHermano ? `N.º ${brother.numeroHermano}` : 'Sin número'} · {brother.email ?? brother.user?.email ?? 'Sin email'} · {brother.activo ? 'Activo' : brother.fechaBaja ? 'De baja' : 'Solicitud pendiente'}</Typography></Box>{puedeGestionar && <Button aria-label={`Editar ${brother.nombre} ${brother.apellidos}`} startIcon={<EditIcon />} component={Link} to={`/cms/hermanos/${brother.id}/editar`} state={{ volver: consultaListado }}>Editar</Button>}</Paper>)}{brothers.length === 0 && <Alert severity="info">No se han encontrado hermanos.</Alert>}</Stack>}
    {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="censo de hermanos" />}
    </>}
  </>
}
