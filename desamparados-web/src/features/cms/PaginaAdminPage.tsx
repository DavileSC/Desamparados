import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, Dialog, IconButton, Paper, Slider, Snackbar, Stack, Tooltip, Typography, useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import HistoryIcon from '@mui/icons-material/History'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import CloseIcon from '@mui/icons-material/Close'
import { Helmet } from 'react-helmet-async'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import topes from '../../../../shared/topes-contenido.json'
import PantallaEdicion from './PantallaEdicion'
import CampoImagen from './CampoImagen'
import CampoTexto from './contenido/CampoTexto'
import SeccionPlegable from './contenido/SeccionPlegable'
import ListaDeBloques, { type AccionDeBloque } from './constructor/ListaDeBloques'
import GaleriaDeBloques from './constructor/GaleriaDeBloques'
import VistaEnVivo from './constructor/VistaEnVivo'
import { DialogoCopiarBloque, DialogoGuardarSeccion, HistorialDeVersiones } from './constructor/Dialogos'
import { useDeshacer } from './constructor/useDeshacer'
import { conClave, sinClave, type Fila } from './bloques/filas'
import { NOMBRE_BLOQUE, bloqueNuevo, problemaDeBloque, problemaDePresentacion } from './bloques/formularios'
import { libreDe } from '../../components/bloques/presentacion'
import { ENCUADRE_POR_DEFECTO, tipoDeCabecera } from '../../components/bloques/cabecera'
import { paginaPublica } from '../../app/cmsNavegacion'
import { ErrorDeApi } from '../../lib/api/cliente'
import {
  getContenido, guardarContenido,
  type Bloque, type CabeceraPagina, type PaginaDeBloques, type SlugContenido,
} from '../../lib/api/contenido'

export const AVISO_SIN_TITULO = 'La página se ha quedado sin título. Ponle uno antes de guardar.'

/**
 * Traduce `ErrorDeApi.fields` («bloques.2»: motivo) a algo que diga de qué
 * bloque habla, con su posición y su tipo, igual que la comprobación del
 * cliente: es la red de seguridad para lo que el cliente no haya previsto, y
 * el mensaje tiene que ser tan localizable como el suyo.
 */
function mensajeDelServidor(fields: Record<string, string>, filas: Fila[]): string {
  const detalle = Object.entries(fields)
    .map(([campo, texto]) => {
      const bloque = /^bloques\.(\d+)/.exec(campo)
      if (!bloque) return `${campo}: ${texto}`
      const indice = Number(bloque[1])
      const nombre = filas[indice] ? (NOMBRE_BLOQUE[filas[indice].bloque.tipo] ?? filas[indice].bloque.tipo) : null
      return `El bloque ${indice + 1}${nombre ? ` (${nombre})` : ''}: ${texto}`
    })
    .join(' ')
  return `El servidor ha rechazado la página. ${detalle}`
}

/** Las claves de las filas que nombra `ErrorDeApi.fields`, para desplegarlas. */
function clavesDelServidor(fields: Record<string, string>, filas: Fila[]): Set<number> {
  const claves = new Set<number>()
  for (const campo of Object.keys(fields)) {
    const indice = /^bloques\.(\d+)/.exec(campo)?.[1]
    if (indice !== undefined && filas[Number(indice)]) claves.add(filas[Number(indice)].clave)
  }
  return claves
}

/** Qué falla en un bloque antes de mandarlo: su contenido o su presentación. */
const problemaDe = (bloque: Bloque) => problemaDeBloque(bloque) ?? problemaDePresentacion(bloque)

/** Un bloque con cambios aplicados; una presentación `undefined` se quita, no se guarda vacía. */
function conCambios(bloque: Bloque, cambios: Partial<Bloque>): Bloque {
  const nuevo = { ...bloque, ...cambios } as Bloque
  if ('presentacion' in cambios && cambios.presentacion === undefined) delete nuevo.presentacion
  return nuevo
}

/** Una copia del bloque para duplicarlo: sin ancla, que no puede repetirse en la página. */
function copiaDe(bloque: Bloque): Bloque {
  const copia = structuredClone(bloque)
  if (copia.presentacion?.ancla) {
    delete copia.presentacion.ancla
    if (Object.keys(copia.presentacion).length === 0) delete copia.presentacion
  }
  return copia
}

interface Estado { cabecera: CabeceraPagina | null; filas: Fila[] }

/**
 * El constructor de una página de la web pública.
 *
 * A la izquierda, la cabecera y los bloques, que se abren de uno en uno con su
 * contenido y su presentación; a la derecha, la página en vivo al ancho de un
 * móvil, una tableta o un escritorio, donde pulsar un bloque lo abre aquí.
 *
 * Todo cambio se puede deshacer (Ctrl+Z) y rehacer (Ctrl+Mayús+Z), también
 * quitar un bloque o cargar una versión del historial: por eso ninguna de esas
 * acciones pregunta antes. Nada se publica hasta «Guardar», que deja una
 * versión nueva en el historial.
 */
export default function PaginaAdminPage() {
  const { slug = '' } = useParams()
  const ficha = paginaPublica(slug)
  const ruta = ficha?.ruta ?? '/'
  const queryClient = useQueryClient()
  const tema = useTheme()
  const conVistaAlLado = useMediaQuery(tema.breakpoints.up('lg'))
  const { estado, fijar, deshacer, rehacer, reiniciar, puedeDeshacer, puedeRehacer } = useDeshacer<Estado>({ cabecera: null, filas: [] })
  const { cabecera, filas } = estado
  const [inicial, setInicial] = useState<PaginaDeBloques | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [clavesInvalidas, setClavesInvalidas] = useState<Set<number>>(new Set())
  const [abierta, setAbierta] = useState<number | null>(null)
  const [insertarEn, setInsertarEn] = useState<number | null>(null)
  const [copiando, setCopiando] = useState<Bloque | null>(null)
  const [seccionDesde, setSeccionDesde] = useState<number | null | undefined>(undefined)
  const [historial, setHistorial] = useState(false)
  const [vistaEnPantalla, setVistaEnPantalla] = useState(false)
  const [quitado, setQuitado] = useState(false)

  useEffect(() => {
    getContenido<PaginaDeBloques>(slug as SlugContenido)
      .then(({ cabecera: c, bloques }) => {
        reiniciar({ cabecera: c, filas: bloques.map(conClave) })
        setInicial({ cabecera: c, bloques })
      })
      .catch(() => setError('No se ha podido cargar la página.'))
  }, [slug, reiniciar])

  // Ctrl+Z y Ctrl+Mayús+Z (o Ctrl+Y). Dentro del editor de texto con formato
  // no: tiene su propio deshacer, el de lo que se está escribiendo ahí.
  useEffect(() => {
    const teclas = (evento: KeyboardEvent) => {
      if (!(evento.ctrlKey || evento.metaKey)) return
      if ((evento.target as HTMLElement | null)?.isContentEditable) return
      const tecla = evento.key.toLowerCase()
      if (tecla === 'z' && !evento.shiftKey) { evento.preventDefault(); deshacer() }
      else if ((tecla === 'z' && evento.shiftKey) || tecla === 'y') { evento.preventDefault(); rehacer() }
    }
    window.addEventListener('keydown', teclas)
    return () => window.removeEventListener('keydown', teclas)
  }, [deshacer, rehacer])

  const cambiarCabecera = (cambios: Partial<CabeceraPagina>, grupo: string) =>
    fijar((e) => ({ ...e, cabecera: e.cabecera ? { ...e.cabecera, ...cambios } : e.cabecera }), `cabecera-${grupo}`)

  const cambiarBloque = (clave: number, cambios: Partial<Bloque>, grupo?: string) =>
    fijar((e) => ({ ...e, filas: e.filas.map((f) => (f.clave === clave ? { ...f, bloque: conCambios(f.bloque, cambios) } : f)) }), grupo)

  const insertar = (nuevas: Fila[], posicion: number) => {
    fijar((e) => ({ ...e, filas: [...e.filas.slice(0, posicion), ...nuevas, ...e.filas.slice(posicion)] }))
    setAbierta(nuevas[0]?.clave ?? null)
    setInsertarEn(null)
  }

  const alAccion = (accion: AccionDeBloque, clave: number) => {
    const indice = filas.findIndex((f) => f.clave === clave)
    const fila = filas[indice]
    if (!fila) return
    if (accion === 'duplicar') insertar([conClave(copiaDe(fila.bloque))], indice + 1)
    if (accion === 'ocultar') {
      const { oculto: _fuera, ...resto } = fila.bloque.presentacion ?? {}
      const presentacion = fila.bloque.presentacion?.oculto ? resto : { ...resto, oculto: true }
      cambiarBloque(clave, { presentacion: Object.keys(presentacion).length > 0 ? presentacion : undefined })
    }
    if (accion === 'copiar') setCopiando(fila.bloque)
    if (accion === 'seccion') setSeccionDesde(indice)
    if (accion === 'quitar') {
      fijar((e) => ({ ...e, filas: e.filas.filter((f) => f.clave !== clave) }))
      setQuitado(true)
    }
  }

  // Pulsar un bloque en la vista en vivo lo abre aquí y lo trae a la vista.
  const alPulsarEnLaVista = useCallback((indice: number) => {
    const fila = filas[indice]
    if (!fila) return
    setAbierta(fila.clave)
    requestAnimationFrame(() => document.querySelector(`[data-fila-bloque="${indice}"]`)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }))
  }, [filas])

  const guardar = async () => {
    if (!cabecera) return
    if (cabecera.titulo.trim() === '') { setError(AVISO_SIN_TITULO); return }

    const invalida = filas
      .map((fila, indice) => ({ fila, indice, motivo: problemaDe(fila.bloque) }))
      .find((f) => f.motivo !== null)
    if (invalida) {
      setClavesInvalidas(new Set([invalida.fila.clave]))
      setAbierta(invalida.fila.clave)
      const nombre = NOMBRE_BLOQUE[invalida.fila.bloque.tipo] ?? invalida.fila.bloque.tipo
      setError(`El bloque ${invalida.indice + 1} (${nombre}) ${invalida.motivo}.`)
      return
    }
    // Un enlace a `#ancla` solo puede bajar a un bloque.
    const vistas = new Map<string, number>()
    for (const [indice, { bloque, clave }] of filas.entries()) {
      const ancla = libreDe(bloque, 'ancla')
      if (!ancla) continue
      if (vistas.has(ancla)) {
        setClavesInvalidas(new Set([clave])); setAbierta(clave)
        setError(`El bloque ${indice + 1} repite el ancla «${ancla}» del bloque ${(vistas.get(ancla) ?? 0) + 1}. Cámbiala o quítala.`)
        return
      }
      vistas.set(ancla, indice)
    }

    const datos: PaginaDeBloques = { cabecera, bloques: sinClave(filas) }
    if (JSON.stringify(datos) === JSON.stringify(inicial)) return
    setGuardando(true); setError(null); setClavesInvalidas(new Set())
    try {
      await guardarContenido(slug as SlugContenido, datos)
      setInicial(datos)
      // Lo guardado es el nuevo punto de partida: deshacer no vuelve a antes de guardar.
      reiniciar({ cabecera, filas })
      setAviso('Página guardada y publicada. Queda una versión nueva en el historial.')
      void queryClient.invalidateQueries({ queryKey: ['contenido', slug] })
    } catch (e: unknown) {
      if (e instanceof ErrorDeApi && Object.keys(e.fields).length > 0) {
        setError(mensajeDelServidor(e.fields, filas))
        const claves = clavesDelServidor(e.fields, filas)
        setClavesInvalidas(claves)
        const primera = [...claves][0]
        if (primera !== undefined) setAbierta(primera)
      } else {
        setError(e instanceof Error ? e.message : 'No se ha podido guardar la página.')
      }
    } finally { setGuardando(false) }
  }

  /** Vuelve a lo guardado sin salir de la pantalla, como en la portada. */
  const descartar = () => {
    if (!inicial) return
    reiniciar({ cabecera: inicial.cabecera, filas: inicial.bloques.map(conClave) })
    setError(null)
    setClavesInvalidas(new Set())
    setAbierta(null)
  }

  if (error && !cabecera) return <Alert severity="error">{error}</Alert>
  if (!cabecera) return <CircularProgress aria-label="Cargando la página" />

  const documento: PaginaDeBloques = { cabecera, bloques: sinClave(filas) }
  // La foto se ve a todo el ancho arriba (y tiene encuadre) o velada detrás de la página.
  const aSangre = tipoDeCabecera(slug) === 'a-sangre'
  const indiceAbierto = filas.findIndex((f) => f.clave === abierta)
  const seleccionado = indiceAbierto === -1 ? null : indiceAbierto
  const vista = (alto: string) => (
    <VistaEnVivo slug={slug} documento={documento} seleccionado={seleccionado} onSeleccionar={alPulsarEnLaVista} alto={alto} />
  )

  return (
    <>
      <Helmet><title>{`${cabecera.titulo} | CMS Desamparados`}</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      <PantallaEdicion
        titulo={cabecera.titulo || 'Página'}
        nombre={ficha ? `Página «${ficha.nombre}»` : 'Página de la web pública'}
        sucio={JSON.stringify(documento) !== JSON.stringify(inicial)}
        guardando={guardando}
        volverA="/cms/paginas"
        onGuardar={guardar}
        onDescartar={descartar}
        anchoCompleto
        extra={(
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Deshacer (Ctrl+Z)"><span>
              <IconButton aria-label="Deshacer" disabled={!puedeDeshacer} onClick={deshacer}><UndoIcon /></IconButton>
            </span></Tooltip>
            <Tooltip title="Rehacer (Ctrl+Mayús+Z)"><span>
              <IconButton aria-label="Rehacer" disabled={!puedeRehacer} onClick={rehacer}><RedoIcon /></IconButton>
            </span></Tooltip>
          </Stack>
        )}
      >
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 3 }}>
          {!conVistaAlLado && (
            <Button variant="outlined" startIcon={<VisibilityOutlinedIcon />} onClick={() => setVistaEnPantalla(true)}>Vista en vivo</Button>
          )}
          <Button startIcon={<HistoryIcon />} onClick={() => setHistorial(true)}>Historial</Button>
          {/* Lo publicado, no lo que se está escribiendo: por eso en otra pestaña y dicho así. */}
          <Button component="a" href={ruta} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNewIcon />}>Abrir la publicada</Button>
        </Stack>

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: conVistaAlLado ? 'minmax(420px, 5fr) minmax(0, 7fr)' : '1fr', alignItems: 'start' }}>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            {/* La cabecera va aparte y sin botón de quitar: está siempre. */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <SeccionPlegable titulo="Cabecera de la página" abiertaPorDefecto>
                {/* Solo la trae Historia: las demás cabeceras no pintan ceja. */}
                {cabecera.ceja !== undefined && (
                  <CampoTexto etiqueta="Antetítulo" valor={cabecera.ceja}
                    onCambio={(ceja) => cambiarCabecera({ ceja }, 'ceja')}
                    ayuda="Línea pequeña en mayúsculas, encima del título grande." maxLength={topes.etiqueta} />
                )}
                <CampoTexto etiqueta="Título" valor={cabecera.titulo}
                  onCambio={(titulo) => cambiarCabecera({ titulo }, 'titulo')}
                  ayuda="Encabezado grande de la página, arriba del todo." maxLength={topes.titulo} />
                <CampoTexto etiqueta="Subtítulo" valor={cabecera.subtitulo}
                  onCambio={(subtitulo) => cambiarCabecera({ subtitulo }, 'subtitulo')}
                  ayuda="Frase bajo el título." maxLength={topes.descripcion} />
                {aSangre ? (
                  <>
                    <CampoImagen valor={cabecera.foto} onCambio={(foto) => cambiarCabecera({ foto }, 'foto')}
                      etiqueta="Foto de cabecera"
                      ayuda="JPG, PNG o WebP de hasta 5 MB, apaisada y de al menos 1600 px de ancho. Ocupa todo el ancho arriba de la página, con el título encima de su parte de abajo. Sin foto, la banda queda en granate oscuro." apaisada />
                    {cabecera.foto !== '' && (
                      <Box sx={{ px: 1 }}>
                        <Typography id="encuadre-cabecera" variant="body2" gutterBottom>Encuadre</Typography>
                        <Slider
                          aria-labelledby="encuadre-cabecera"
                          value={cabecera.encuadre ?? ENCUADRE_POR_DEFECTO}
                          onChange={(_, valor) => cambiarCabecera({ encuadre: valor as number }, 'encuadre')}
                          min={0} max={100} step={5}
                          marks={[{ value: 0, label: 'Arriba' }, { value: 50, label: 'Centro' }, { value: 100, label: 'Abajo' }]}
                          getAriaValueText={(v) => `${v} %`}
                        />
                        <Typography variant="caption" color="text.secondary">
                          La banda recorta la foto: apaisada en el ordenador y vertical en el móvil. Elige qué parte se queda a la vista; en la vista en vivo se ve al momento.
                        </Typography>
                      </Box>
                    )}
                    <CampoTexto etiqueta="Descripción de la foto" valor={cabecera.fotoAlt}
                      onCambio={(fotoAlt) => cambiarCabecera({ fotoAlt }, 'fotoAlt')}
                      ayuda="Qué se ve en la foto, para quien no la ve: la leen los lectores de pantalla. Sin ella, la foto se trata como adorno." maxLength={topes.descripcion} />
                  </>
                ) : (
                  <>
                    <CampoImagen valor={cabecera.foto} onCambio={(foto) => cambiarCabecera({ foto }, 'foto')}
                      etiqueta="Foto de fondo"
                      ayuda="Opcional. JPG, PNG o WebP grande y apaisado, de hasta 5 MB. Se ve muy velada detrás de toda la página, hasta el pie. Sin foto, el fondo queda liso." apaisada />
                    <CampoTexto etiqueta="Descripción de la foto" valor={cabecera.fotoAlt}
                      onCambio={(fotoAlt) => cambiarCabecera({ fotoAlt }, 'fotoAlt')}
                      ayuda="Opcional: el fondo es decorativo y los lectores de pantalla lo saltan. Escríbela si quieres dejar apuntado qué se ve." maxLength={topes.descripcion} />
                  </>
                )}
                {slug === 'historia' && (
                  <Typography variant="body2" color="text.secondary">
                    En Historia, los bloques de cronología van en una franja oscura y el primero forma el
                    índice de la cabecera, y un bloque de llamada es el cierre: su texto es la línea pequeña,
                    su título la frase grande y su botón el enlace con flecha.
                  </Typography>
                )}
              </SeccionPlegable>
            </Paper>

            <Typography variant="h6" component="h2">Bloques ({filas.length})</Typography>
            <ListaDeBloques
              filas={filas}
              abierta={abierta}
              onAbrir={setAbierta}
              onCambiarBloque={cambiarBloque}
              onReordenar={(nuevas) => fijar((e) => ({ ...e, filas: nuevas }))}
              onInsertar={setInsertarEn}
              onAccion={alAccion}
              clavesInvalidas={clavesInvalidas}
              ruta={ruta}
            />
          </Stack>

          {conVistaAlLado && (
            <Box sx={{ position: 'sticky', top: 16, minWidth: 0 }}>{vista('calc(100vh - 150px)')}</Box>
          )}
        </Box>
      </PantallaEdicion>

      <GaleriaDeBloques
        abierta={insertarEn !== null}
        posicion={insertarEn ?? filas.length}
        total={filas.length}
        onElegir={(tipo) => insertar([conClave(bloqueNuevo(tipo))], insertarEn ?? filas.length)}
        onElegirSeccion={(bloques) => insertar(bloques.map((b) => conClave(structuredClone(b))), insertarEn ?? filas.length)}
        onCerrar={() => setInsertarEn(null)}
      />
      <DialogoCopiarBloque bloque={copiando} slugActual={slug} onCerrar={() => setCopiando(null)} />
      <DialogoGuardarSeccion abierto={seccionDesde !== undefined} bloques={documento.bloques} marcadoDeInicio={seccionDesde ?? null} onCerrar={() => setSeccionDesde(undefined)} />
      <HistorialDeVersiones
        abierto={historial}
        slug={slug as SlugContenido}
        onCerrar={() => setHistorial(false)}
        onCargar={(cargado, version) => {
          fijar({ cabecera: cargado.cabecera, filas: cargado.bloques.map(conClave) })
          setAbierta(null)
          setHistorial(false)
          setAviso(`Cargada la versión del ${new Date(version.fecha).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}. Revísala y guarda para publicarla, o deshaz.`)
        }}
      />
      <Dialog open={vistaEnPantalla && !conVistaAlLado} onClose={() => setVistaEnPantalla(false)} fullScreen aria-label="Vista en vivo">
        <Box sx={{ p: 2 }}>
          <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 1 }}>
            <IconButton aria-label="Cerrar la vista en vivo" onClick={() => setVistaEnPantalla(false)}><CloseIcon /></IconButton>
          </Stack>
          {vista('calc(100vh - 150px)')}
        </Box>
      </Dialog>

      <Snackbar open={quitado} autoHideDuration={6000} onClose={() => setQuitado(false)} message="Bloque quitado"
        action={<Button color="inherit" size="small" onClick={() => { deshacer(); setQuitado(false) }}>Deshacer</Button>} />
      <Snackbar open={aviso !== null} autoHideDuration={7000} onClose={() => setAviso(null)} message={aviso} />
    </>
  )
}
