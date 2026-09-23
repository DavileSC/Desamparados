import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, Tab, Tabs, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../altas/auth/store'
import { CLAVE_PANEL_HOY } from '../../app/usePanelDeHoy'
import { aprobarSolicitud, cerrarHuecosDeNumero, descartarPeticionVuelta, solicitudesPendientes, reactivarHermano, rechazarSolicitud, buscarHermanos, type AdminBrother, type FiltrosCenso, type PendingRequest, type PeticionVuelta } from '../../lib/api/hermanos'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import type { MetaPaginacion } from '../../lib/api/tipos'
import BarraListado, { type Opcion } from './listados/BarraListado'
import { useFiltrosUrl } from './listados/useFiltrosUrl'
import ListaCenso from './censo/ListaCenso'
import FichaCenso from './censo/FichaCenso'
import ListaImpagos from './impagos/ListaImpagos'

const SITUACIONES: Opcion[] = [
  { valor: 'activo', etiqueta: 'Activos' },
  { valor: 'baja', etiqueta: 'De baja' },
  { valor: 'pendiente', etiqueta: 'Solicitud pendiente' },
]
const CON_SIN_NUMERO: Opcion[] = [
  { valor: 'con', etiqueta: 'Con número' },
  { valor: 'sin', etiqueta: 'Sin número' },
]
const ORDENES_CENSO: Opcion[] = [
  { valor: 'apellidos', etiqueta: 'Apellidos (A-Z)' },
  { valor: 'numero', etiqueta: 'Número de hermano' },
  { valor: 'antiguedad', etiqueta: 'Antigüedad' },
  { valor: 'recientes', etiqueta: 'Altas más recientes' },
]
const valoresDe = (opciones: Opcion[]) => opciones.map((o) => o.valor)
const FILTROS_CENSO = {
  q: {},
  estado: { validos: valoresDe(SITUACIONES) },
  numero: { validos: valoresDe(CON_SIN_NUMERO) },
  orden: { porDefecto: 'apellidos', validos: valoresDe(ORDENES_CENSO) },
}

export default function HermanosAdminPage() {
  const queryClient = useQueryClient()
  const role = useAuthStore((state) => state.cms?.role ?? 'USER')
  // El Hermano Mayor gestiona el censo como secretaría: edita fichas y admite
  // altas. Quien llega aquí sin ser ninguno de los tres es porque la guarda de
  // ruta le deja mirar, no tocar.
  const puedeGestionar = role === 'ADMIN' || role === 'SECRETARIA' || role === 'HERMANO_MAYOR'
  const [params, setParams] = useSearchParams()
  // La vista vive en la URL: así se puede volver a las solicitudes desde una
  // ficha sin perder dónde se estaba.
  const pedida = params.get('vista')
  const vista = pedida === 'solicitudes' || pedida === 'impagos' ? pedida : 'censo'
  // La ficha abierta a la derecha, también en la URL: «Editar ficha» y el botón
  // de atrás del navegador vuelven a ella, con la lista como estaba.
  const fichaAbierta = Number(params.get('ficha')) || null
  const enlaceFicha = useCallback((id: number) => {
    const siguientes = new URLSearchParams(params)
    siguientes.set('ficha', String(id))
    return `?${siguientes.toString()}`
  }, [params])
  const cerrarFicha = () => setParams((anteriores) => {
    const siguientes = new URLSearchParams(anteriores)
    siguientes.delete('ficha')
    return siguientes
  })
  // Búsqueda, filtros y orden, en la URL como la página.
  const [filtros, cambiarFiltros] = useFiltrosUrl(FILTROS_CENSO)
  const [brothers, setBrothers] = useState<AdminBrother[]>([])
  const [requests, setRequests] = useState<PendingRequest[]>([])
  // Las peticiones de volver llegan con las solicitudes, en la misma respuesta.
  const [vueltas, setVueltas] = useState<PeticionVuelta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // La consulta actual viaja con el enlace de editar (página, tamaño y filtros):
  // así la pantalla de edición sabe a qué página del listado devolver.
  const { search: consultaListado } = useLocation()
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()
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
  const cargar = useCallback((vigente: () => boolean = () => true) => Promise.all([
    puedeGestionar
      ? solicitudesPendientes({ pagina: solicitudes.pagina, porPagina: solicitudes.porPagina })
      : Promise.resolve({ data: [] as PendingRequest[], meta: { total: 0, page: 1, limit: solicitudes.porPagina, totalPages: 0 }, reactivaciones: [] as PeticionVuelta[] }),
    buscarHermanos(filtros as FiltrosCenso, { pagina, porPagina }),
  ]).then(([pendientes, censo]) => {
    if (!vigente()) return
    setBrothers(censo.data)
    setMeta(censo.meta)
    setRequests(pendientes.data)
    setVueltas(pendientes.reactivaciones ?? [])
    setMetaSolicitudes(pendientes.meta)
  }), [puedeGestionar, filtros, pagina, porPagina, solicitudes.pagina, solicitudes.porPagina])

  useEffect(() => {
    // La espera del tecleo la pone el buscador (CampoBusqueda); `cancelado` se
    // ocupa de la carga que salió y todavía no ha vuelto.
    let cancelado = false
    cargar(() => !cancelado)
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se ha podido cargar el censo.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [cargar])

  /**
   * Recarga el censo y refresca de paso los contadores del menú («hermanos sin
   * número», solicitudes pendientes): salen de la consulta del panel, que se
   * guarda cinco minutos, y sin esto Secretaría leía «Se han asignado 3 números
   * de hermano» y el menú seguía diciendo 3 durante cinco minutos, aun
   * cambiando de pantalla dentro del CMS.
   *
   * Cuelga de las tres acciones que de verdad mueven esos números —asignar,
   * aprobar y rechazar— y no de `cargar()`: `cargar()` corre también al abrir la
   * pantalla, en cada búsqueda o filtro y al cambiar de página. El panel es un agregado caro (censo, dinero, procesión y
   * actividad) y el menú lo tiene observado mientras se está dentro del CMS, así
   * que invalidarlo no deja una marca de caducidad: dispara una petición de
   * verdad, en ese momento. Y buscar a un hermano por su nombre no cambia
   * ningún contador.
   */
  const recargarYRefrescarMenu = async () => {
    await cargar()
    void queryClient.invalidateQueries({ queryKey: CLAVE_PANEL_HOY })
  }

  /**
   * Atender a quien pide volver: reactivar su ficha (vuelve al censo con número
   * nuevo) o descartar la petición (se queda de baja, como estaba). Nunca
   * «aprobar»: eso es para quien nunca estuvo.
   */
  const atenderVuelta = async (vuelta: PeticionVuelta, reactivar: boolean) => {
    if (enMarcha.current) return
    enMarcha.current = true
    setProcesando(vuelta.id); setError(null); setNotice(null)
    try {
      await (reactivar ? reactivarHermano(vuelta.id) : descartarPeticionVuelta(vuelta.id))
      await recargarYRefrescarMenu()
      setNotice(reactivar
        ? `${vuelta.nombre} vuelve al censo con número nuevo.`
        : 'Petición descartada. La ficha sigue de baja.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se ha podido atender la petición.')
    } finally {
      setProcesando(null)
      enMarcha.current = false
    }
  }

  const handleRequest = async (request: PendingRequest, approve: boolean) => {
    if (enMarcha.current) return
    enMarcha.current = true
    setProcesando(request.id); setError(null); setNotice(null)
    try { await (approve ? aprobarSolicitud(request.id) : rechazarSolicitud(request.id)); await recargarYRefrescarMenu(); setNotice(approve ? 'Solicitud aprobada correctamente.' : 'Solicitud rechazada correctamente.') }
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
      await recargarYRefrescarMenu()
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
      {/* Solo cambia `vista`: los filtros y la página del censo siguen ahí al volver. */}
      <Tabs value={vista} onChange={(_, valor) => setParams((anteriores) => {
        const siguientes = new URLSearchParams(anteriores)
        if (valor === 'censo') siguientes.delete('vista')
        else siguientes.set('vista', valor)
        return siguientes
      })}>
        <Tab value="censo" label="Censo" />
        <Tab value="solicitudes" label={`Solicitudes (${metaSolicitudes?.total ?? 0})`} />
        <Tab value="impagos" label="Impagos" />
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
    {vista === 'impagos' ? <ListaImpagos puedeDarDeBaja={puedeGestionar} /> : vista === 'solicitudes' ? <Paper sx={{ p: 3 }}><Stack spacing={2}>
      {requests.map((request) => (
        <Box key={request.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography>{request.nombre} {request.apellidos}</Typography>
            <Typography variant="body2" color="text.secondary">{request.email}</Typography>
            {/* Quiénes son, no cuántos: un alta puede traer al adulto y a los
                menores a su cargo, y quien aprueba tiene que saber a quién. */}
            <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.5 }}>
              {request.hermanos.map((ficha) => (
                <Typography key={ficha.id} component="li" variant="body2" color="text.secondary">
                  {ficha.nombre} {ficha.apellidos}
                  {ficha.fechaNacimiento && ` · ${new Date(ficha.fechaNacimiento).toLocaleDateString('es-ES')}`}
                  {ficha.dni ? ` · ${ficha.dni}` : ' · sin DNI'}
                </Typography>
              ))}
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={procesando !== null} onClick={() => void handleRequest(request, true)}>{procesando === request.id ? 'Procesando…' : 'Aprobar'}</Button>
            <Button color="error" disabled={procesando !== null} onClick={() => setPorRechazar(request)}>Rechazar</Button>
          </Stack>
        </Box>
      ))}
      {requests.length === 0 && <Alert severity="info">No hay solicitudes pendientes.</Alert>}
    </Stack>
    {metaSolicitudes && <Paginador meta={metaSolicitudes} onPagina={solicitudes.irAPagina} onTamano={solicitudes.cambiarTamano} etiqueta="solicitudes de alta" />}

    {/* Quien se fue y quiere volver. No se aprueba: se reactiva, porque su
        ficha ya estuvo en el censo y vuelve con número nuevo. */}
    {vueltas.length > 0 && (
      <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 600, mb: 0.5 }}>Piden volver</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Estuvieron en el censo y se dieron de baja. Al reactivarlos entran otra vez, con número nuevo.
        </Typography>
        <Stack spacing={2}>
          {vueltas.map((vuelta) => (
            <Box key={vuelta.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography>{vuelta.nombre} {vuelta.apellidos}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {vuelta.dni ?? 'sin DNI'}
                  {vuelta.fechaBaja && ` · se dio de baja el ${new Date(vuelta.fechaBaja).toLocaleDateString('es-ES')}`}
                  {` · lo pidió el ${new Date(vuelta.reactivacionSolicitada).toLocaleDateString('es-ES')}`}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" disabled={procesando !== null} onClick={() => void atenderVuelta(vuelta, true)}>
                  {procesando === vuelta.id ? 'Procesando…' : 'Reactivar'}
                </Button>
                <Button color="error" disabled={procesando !== null} onClick={() => void atenderVuelta(vuelta, false)}>Descartar</Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    )}
    </Paper> : <>
    <BarraListado
      valores={filtros}
      onCambiar={cambiarFiltros}
      busqueda={{ clave: 'q', etiqueta: 'Buscar por nombre, DNI, email o número' }}
      filtros={[
        { clave: 'estado', etiqueta: 'Situación', todos: 'Todas', opciones: SITUACIONES },
        { clave: 'numero', etiqueta: 'Número', todos: 'Con y sin número', opciones: CON_SIN_NUMERO, ancho: 190 },
      ]}
      orden={{ clave: 'orden', opciones: ORDENES_CENSO }}
    />
    {loading ? <CircularProgress aria-label="Cargando censo" /> : (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(300px, 380px) minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
        {/* En el móvil no caben las dos: con una ficha abierta se ve la ficha, y «Volver a la lista» la cierra. */}
        <Box sx={{ display: { xs: fichaAbierta ? 'none' : 'block', md: 'block' }, minWidth: 0 }}>
          {brothers.length > 0
            ? <ListaCenso hermanos={brothers} abierta={fichaAbierta} enlace={enlaceFicha} />
            : <Alert severity="info">No hay hermanos con esta búsqueda o estos filtros.</Alert>}
          {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="censo de hermanos" />}
        </Box>
        <Box sx={{ display: { xs: fichaAbierta ? 'block' : 'none', md: 'block' }, position: { md: 'sticky' }, top: { md: 16 }, minWidth: 0 }}>
          {fichaAbierta
            ? <FichaCenso key={fichaAbierta} id={fichaAbierta} puedeGestionar={puedeGestionar} volver={consultaListado} enlace={enlaceFicha} onCerrar={cerrarFicha} />
            : (
              <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography>Elige a un hermano de la lista para ver su ficha.</Typography>
              </Paper>
            )}
        </Box>
      </Box>
    )}
    </>}
  </>
}
