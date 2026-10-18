import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  Alert, Box, Button, ButtonBase, Chip, CircularProgress, Dialog, IconButton, InputAdornment, Stack, TextField,
  Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import VistaPreviaDeBloque from './VistaPreviaDeBloque'
import { CARPETAS_DE_BLOQUES, ETIQUETA_OPCION, FICHA_DE_BLOQUE, etiquetaDeValor, ordenDeValores } from './etiquetas'
import { ejemploDe } from './ejemplos'
import { NOMBRE_BLOQUE } from '../bloques/formularios'
import { moduloDeTipo } from '../../../components/bloques/modulos'
import { opcionesPropias } from '../../../components/bloques/presentacion'
import { useModulos } from '../../../hooks/useModulos'
import { borrarSeccion, seccionesGuardadas, type Bloque, type SeccionGuardada } from '../../../lib/api/contenido'

/** Entre qué bloques irá el nuevo, por su nombre; `null` en un extremo de la página. */
export interface Hueco { antes: string | null; despues: string | null }

/** La carpeta de las secciones guardadas: no es de tipos, sino de bloques ya hechos. */
const SECCIONES = 'secciones'

/** Para buscar sin que importen tildes ni mayúsculas: «galeria» encuentra «Galería». */
const sinTildes = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Las opciones que dicen de qué formas se puede mostrar un tipo, de la más a la menos reveladora. */
const OPCIONES_DE_FORMA = ['disposicion', 'estilo', 'tamano', 'alto', 'lado', 'ladoDibujo']

/** La primera opción de presentación que cambia la forma del bloque, con sus valores ya nombrados. */
function formasDe(tipo: string): { rotulo: string; valores: string[] } | null {
  const propias = opcionesPropias(tipo)
  const clave = OPCIONES_DE_FORMA.find((c) => propias[c] && 'valores' in propias[c])
  if (!clave) return null
  const opcion = propias[clave] as { valores: string[] }
  return { rotulo: ETIQUETA_OPCION[clave] ?? clave, valores: ordenDeValores(opcion.valores).map(etiquetaDeValor) }
}

/** Dónde irá el bloque, dicho con los nombres de los de alrededor. */
function dondeIra({ antes, despues }: Hueco): string {
  if (antes && despues) return `Irá entre «${antes}» y «${despues}».`
  if (antes) return `Irá al final, después de «${antes}».`
  if (despues) return `Irá al principio, antes de «${despues}».`
  return 'Será el primer bloque de la página.'
}

/**
 * La galería de «Añadir bloque», en tres columnas: las carpetas, los bloques
 * de la carpeta y, del elegido, una vista previa con el bloque de verdad (el
 * mismo componente que la web, con contenido de ejemplo) y sus formas de
 * mostrarse. Las secciones guardadas son una carpeta más.
 *
 * Elegir un bloque no lo añade: lo enseña. Se añade con el botón, con doble
 * clic o con Intro sobre él. En el móvil, las carpetas pasan a una fila que se
 * desliza y la vista previa va debajo de la lista.
 */
export default function GaleriaDeBloques({ abierta, hueco, fotos, onElegir, onElegirSeccion, onCerrar }: {
  abierta: boolean
  hueco: Hueco
  /** Las fotos de la página, para los ejemplos. */
  fotos: string[]
  onElegir: (tipo: string) => void
  onElegirSeccion: (bloques: Bloque[]) => void
  onCerrar: () => void
}) {
  const tema = useTheme()
  const movil = useMediaQuery(tema.breakpoints.down('md'), { noSsr: true })
  return (
    <Dialog open={abierta} onClose={onCerrar} fullScreen={movil} maxWidth={false} aria-labelledby="titulo-galeria-bloques"
      // Arriba y no centrada: al buscar, la lista encoge, y centrada la ventana saltaba con cada letra.
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
      slotProps={{ paper: { sx: movil ? undefined : { width: 1120, maxWidth: 'calc(100% - 32px)', height: 'min(720px, calc(100% - 64px))', mt: 4 } } }}>
      <Contenido hueco={hueco} fotos={fotos} onElegir={onElegir} onElegirSeccion={onElegirSeccion} onCerrar={onCerrar} />
    </Dialog>
  )
}

/** Lo de dentro: se monta al abrir, así que cada vez empieza en la primera carpeta y sin búsqueda. */
function Contenido({ hueco, fotos, onElegir, onElegirSeccion, onCerrar }: {
  hueco: Hueco
  fotos: string[]
  onElegir: (tipo: string) => void
  onElegirSeccion: (bloques: Bloque[]) => void
  onCerrar: () => void
}) {
  const { activo } = useModulos()
  const tema = useTheme()
  const movil = useMediaQuery(tema.breakpoints.down('md'), { noSsr: true })
  // En el móvil la vista previa queda debajo de la lista: al elegir, se baja hasta ella.
  const vista = useRef<HTMLDivElement>(null)
  const elegir = (tipo: string) => {
    setElegido(tipo)
    if (movil) window.setTimeout(() => vista.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }
  // Las carpetas con lo que se puede añadir aquí: un tipo de un módulo apagado no se ofrece.
  const carpetas = CARPETAS_DE_BLOQUES
    .map((c) => ({ ...c, tipos: c.tipos.filter((tipo) => FICHA_DE_BLOQUE[tipo] && activo(moduloDeTipo(tipo))) }))
    .filter((c) => c.tipos.length > 0)

  // Sin elegir, la primera carpeta: los módulos pueden llegar después de abrir.
  const [carpetaElegida, setCarpeta] = useState<string | null>(null)
  const carpeta = carpetaElegida ?? carpetas[0]?.nombre ?? SECCIONES
  const [busqueda, setBusqueda] = useState('')
  const [elegido, setElegido] = useState<string | null>(null)

  // Se escribe nada más abrir. Con `autoFocus` no bastaba: al abrirse, la
  // ventana se lleva el foco a sí misma después de que el campo lo coja.
  const campo = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const espera = window.setTimeout(() => campo.current?.focus(), 0)
    return () => window.clearTimeout(espera)
  }, [])

  const buscado = sinTildes(busqueda.trim())
  const buscando = buscado !== ''
  const enSecciones = !buscando && carpeta === SECCIONES
  const tipos = buscando
    ? carpetas.flatMap((c) => c.tipos).filter((tipo) => sinTildes(`${FICHA_DE_BLOQUE[tipo].nombre} ${FICHA_DE_BLOQUE[tipo].descripcion}`).includes(buscado))
    : carpetas.find((c) => c.nombre === carpeta)?.tipos ?? []
  // Lo elegido, si sigue a la vista; si no (otra carpeta, otra búsqueda), el primero.
  const actual = elegido && tipos.includes(elegido) ? elegido : tipos[0] ?? null

  const abrirCarpeta = (nombre: string) => {
    setCarpeta(nombre)
    setBusqueda('')
    setElegido(null)
  }
  const alTeclear = (tipo: string) => (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    onElegir(tipo)
  }

  const ejemplo = actual ? ejemploDe(actual, fotos) : []
  const formas = actual ? formasDe(actual) : null
  const cabecera = buscando
    ? `Resultados para «${busqueda.trim()}» · ${tipos.length}`
    : `${carpeta} · ${tipos.length === 1 ? '1 bloque' : `${tipos.length} bloques`}`

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', px: { xs: 2, md: 3.5 }, pt: 2.25, pb: 2 }}>
        <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
          <Typography id="titulo-galeria-bloques" component="h2" variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>Añadir un bloque</Typography>
          <Typography variant="body2" color="text.secondary">{dondeIra(hueco)}</Typography>
        </Box>
        <TextField size="small" inputRef={campo} value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en todas las carpetas"
          sx={{ order: { xs: 3, md: 0 }, flex: { xs: '1 1 100%', md: '0 0 340px' } }}
          slotProps={{
            htmlInput: { 'aria-label': 'Buscar un bloque' },
            input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
          }} />
        <IconButton aria-label="Cerrar" onClick={onCerrar}><CloseIcon /></IconButton>
      </Stack>

      <Box sx={{
        flex: 1, minHeight: 0, borderTop: 1, borderColor: 'divider', display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '210px 300px minmax(0, 1fr)' },
        // En el móvil cada fila mide lo suyo y baja todo junto; con `auto`, la fila de carpetas se quedaba aplastada.
        gridTemplateRows: { xs: 'max-content max-content max-content', md: 'minmax(0, 1fr)' },
        overflow: { xs: 'auto', md: 'hidden' },
      }}>
        <Box component="nav" aria-label="Carpetas" sx={{
          display: 'flex', flexDirection: { xs: 'row', md: 'column' }, gap: 0.25, p: { xs: 1, md: 1.25 },
          // En el móvil, una fila que se desliza con el dedo: sin barra, que tapaba la mitad de la fila.
          overflowX: { xs: 'auto', md: 'visible' }, overflowY: { md: 'auto' }, scrollbarWidth: { xs: 'none', md: 'auto' },
          // Grosor por pantalla y color aparte: con `borderRight: { md: 1 }` el color
          // de la regla de pantalla gana al de `borderColor` y la raya sale blanca.
          backgroundColor: 'action.hover', borderStyle: 'solid', borderColor: 'divider', borderWidth: 0, borderRightWidth: { md: 1 }, borderBottomWidth: { xs: 1, md: 0 },
        }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' }, px: 1.5, pt: 0.5, lineHeight: 2.2 }}>Carpetas</Typography>
          {carpetas.map((c) => (
            <Carpeta key={c.nombre} nombre={c.nombre} cuantos={c.tipos.length} actual={!buscando && carpeta === c.nombre}
              onClick={() => abrirCarpeta(c.nombre)} icono={<FolderOutlinedIcon fontSize="small" />} />
          ))}
          <Box sx={{ display: { xs: 'none', md: 'block' }, height: '1px', backgroundColor: 'divider', mx: 1, my: 1 }} />
          <Carpeta nombre="Secciones guardadas" actual={enSecciones} onClick={() => abrirCarpeta(SECCIONES)} icono={<BookmarkBorderIcon fontSize="small" />} />
        </Box>

        {enSecciones ? (
          <Box sx={{ gridColumn: { md: 'span 2' }, overflow: 'auto', p: { xs: 2, md: 3 } }}>
            <Secciones onElegir={onElegirSeccion} />
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: { md: 0 }, borderStyle: 'solid', borderColor: 'divider', borderWidth: 0, borderRightWidth: { md: 1 } }}>
              <Typography variant="body2" color="text.secondary" sx={{ px: 2.25, pt: 2, pb: 1 }}>{cabecera}</Typography>
              <Box sx={{ flex: 1, overflow: { md: 'auto' }, px: 1, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {tipos.map((tipo) => (
                  <ButtonBase key={tipo} onClick={() => elegir(tipo)} onDoubleClick={() => onElegir(tipo)} onKeyDown={alTeclear(tipo)}
                    aria-pressed={tipo === actual}
                    aria-label={`${FICHA_DE_BLOQUE[tipo].nombre}: ${FICHA_DE_BLOQUE[tipo].descripcion}`}
                    sx={{
                      display: 'block', textAlign: 'left', borderRadius: 2, px: 1.5, py: 1.25, width: '100%',
                      backgroundColor: tipo === actual ? 'action.selected' : 'transparent',
                      '&:hover': { backgroundColor: tipo === actual ? 'action.selected' : 'action.hover' },
                      '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
                    }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14.5, color: tipo === actual ? 'primary.main' : 'text.primary' }}>{FICHA_DE_BLOQUE[tipo].nombre}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{FICHA_DE_BLOQUE[tipo].descripcion}</Typography>
                  </ButtonBase>
                ))}
                {tipos.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ px: 1.5 }}>Ningún bloque coincide con «{busqueda.trim()}».</Typography>}
              </Box>
            </Box>

            {/* En el móvil todo baja de una vez, sin barras dentro de barras; en el ordenador cada columna va por su cuenta. */}
            <Box ref={vista} sx={{ scrollMarginTop: 8, display: 'flex', flexDirection: 'column', gap: 1.75, minHeight: { md: 0 }, overflow: { md: 'auto' }, p: { xs: 2, md: 3 }, pt: { md: 2.5 }, borderTop: { xs: 1, md: 0 }, borderColor: 'divider' }}>
              {actual && (
                <>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 2 }}>
                    <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, whiteSpace: 'nowrap' }}>Vista previa</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>Así se ve en la web, con contenido de ejemplo</Typography>
                  </Stack>
                  <VistaPreviaDeBloque bloques={ejemplo} />
                  <Box>
                    <Typography sx={{ fontSize: 19, fontWeight: 600 }}>{FICHA_DE_BLOQUE[actual].nombre}</Typography>
                    <Typography variant="body2" color="text.secondary">{FICHA_DE_BLOQUE[actual].descripcion}</Typography>
                  </Box>
                  <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
                    {formas ? (
                      <>
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>{formas.rotulo}:</Typography>
                        {formas.valores.map((valor) => <Chip key={valor} label={valor} size="small" variant="outlined" />)}
                      </>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Una sola forma: lo demás se ajusta en «Presentación».</Typography>
                    )}
                  </Stack>
                  {/* En el móvil se queda pegado abajo: el botón de añadir, siempre a mano. */}
                  <Stack direction="row" useFlexGap sx={{
                    mt: 'auto', pt: 1, alignItems: 'center', gap: 1, flexWrap: 'wrap',
                    position: { xs: 'sticky', md: 'static' }, bottom: 0, pb: { xs: 1.5, md: 0 }, mx: { xs: -2, md: 0 }, px: { xs: 2, md: 0 }, backgroundColor: 'background.paper',
                  }}>
                    <Typography variant="caption" color="text.secondary" sx={{ flex: '1 1 200px', display: { xs: 'none', md: 'block' } }}>Doble clic o Intro en la lista también lo añade.</Typography>
                    <Button onClick={onCerrar}>Cancelar</Button>
                    <Button variant="contained" onClick={() => onElegir(actual)}>Añadir «{FICHA_DE_BLOQUE[actual].nombre}»</Button>
                  </Stack>
                </>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  )
}

function Carpeta({ nombre, cuantos, actual, icono, onClick }: { nombre: string; cuantos?: number; actual: boolean; icono: ReactNode; onClick: () => void }) {
  return (
    <ButtonBase onClick={onClick} aria-current={actual ? 'true' : undefined}
      sx={{
        flexShrink: 0, justifyContent: 'flex-start', gap: 1.25, px: 1.5, py: 1, borderRadius: 1.75, fontSize: 14, whiteSpace: 'nowrap',
        color: actual ? 'primary.main' : 'text.primary', backgroundColor: actual ? 'action.selected' : 'transparent',
        '&:hover': { backgroundColor: actual ? 'action.selected' : 'action.hover' },
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
      }}>
      {icono}
      <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>{nombre}</Box>
      {cuantos !== undefined && <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{cuantos}</Box>}
    </ButtonBase>
  )
}

/** Las secciones guardadas: se piden al abrir la carpeta, y se pueden borrar. */
function Secciones({ onElegir }: { onElegir: (bloques: Bloque[]) => void }) {
  const [secciones, setSecciones] = useState<SeccionGuardada[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Aparte del de cargar: un borrado que falla no tapa la lista, que sigue ahí.
  const [errorAlBorrar, setErrorAlBorrar] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<SeccionGuardada | null>(null)

  useEffect(() => {
    let vigente = true
    seccionesGuardadas()
      .then((lista) => { if (vigente) setSecciones(lista) })
      .catch((e: unknown) => { if (vigente) setError(e instanceof Error ? e.message : 'No se han podido cargar las secciones.') })
    return () => { vigente = false }
  }, [])

  const confirmarBorrado = async () => {
    if (!borrando) return
    const id = borrando.id
    setBorrando(null)
    setErrorAlBorrar(null)
    try {
      await borrarSeccion(id)
      setSecciones((antes) => antes?.filter((s) => s.id !== id) ?? null)
    } catch (e: unknown) {
      setErrorAlBorrar(e instanceof Error ? e.message : 'No se ha podido borrar la sección.')
    }
  }

  if (error) return <Alert severity="error">{error}</Alert>
  if (secciones === null) return <CircularProgress aria-label="Cargando las secciones" />
  if (secciones.length === 0) {
    return (
      <Alert severity="info" variant="outlined">
        Aún no hay secciones guardadas. Para guardar una, abre el menú de un bloque (⋮) y elige «Guardar como sección»: podrás
        juntar varios bloques y ponerlos igual en cualquier otra página.
      </Alert>
    )
  }
  return (
    <>
      <Stack spacing={1.5}>
        {errorAlBorrar && <Alert severity="error" onClose={() => setErrorAlBorrar(null)}>{errorAlBorrar}</Alert>}
        {secciones.map((seccion) => (
          <Stack key={seccion.id} direction="row" spacing={2} sx={{ alignItems: 'center', p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600 }}>{seccion.nombre}</Typography>
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 0.5 }}>
                {seccion.bloques.map((b, i) => <Chip key={i} size="small" label={NOMBRE_BLOQUE[b.tipo] ?? b.tipo} />)}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {new Date(seccion.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                {seccion.autor && ` · ${seccion.autor}`}
              </Typography>
            </Box>
            <Button variant="contained" onClick={() => onElegir(seccion.bloques)}>Añadir</Button>
            <Tooltip title="Borrar la sección">
              <IconButton color="error" aria-label={`Borrar la sección «${seccion.nombre}»`} onClick={() => setBorrando(seccion)}><DeleteOutlineIcon /></IconButton>
            </Tooltip>
          </Stack>
        ))}
      </Stack>
      <DialogoConfirmacion
        abierto={borrando !== null}
        titulo="¿Borrar la sección?"
        mensaje={`«${borrando?.nombre ?? ''}» deja de estar en la galería. Las páginas que ya la llevan no cambian: se copió al ponerla.`}
        textoConfirmar="Borrar"
        peligro
        onConfirmar={() => void confirmarBorrado()}
        onCancelar={() => setBorrando(null)}
      />
    </>
  )
}
