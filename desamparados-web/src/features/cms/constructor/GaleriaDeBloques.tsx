import { useEffect, useRef, useState } from 'react'
import {
  Alert, Box, Button, ButtonBase, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
  IconButton, InputAdornment, Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import TIPOS from '../../../../../shared/tipos-de-bloque.json'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import Miniatura from './Miniatura'
import { FICHA_DE_BLOQUE, GRUPOS_DE_BLOQUES } from './etiquetas'
import { NOMBRE_BLOQUE } from '../bloques/formularios'
import { moduloDeTipo } from '../../../components/bloques/modulos'
import { useModulos } from '../../../hooks/useModulos'
import { borrarSeccion, seccionesGuardadas, type Bloque, type SeccionGuardada } from '../../../lib/api/contenido'

/**
 * La galería de «Añadir bloque»: todos los tipos, por grupos, cada uno con su
 * dibujo y una frase de para qué sirve; y en la otra pestaña, las secciones
 * guardadas, que se añaden enteras.
 *
 * `posicion` es dónde irá lo elegido: se dice en el título para que quien
 * pulsó el «+» entre dos bloques sepa que no va al final.
 */
export default function GaleriaDeBloques({ abierta, posicion, total, onElegir, onElegirSeccion, onCerrar }: {
  abierta: boolean
  posicion: number
  total: number
  onElegir: (tipo: string) => void
  onElegirSeccion: (bloques: Bloque[]) => void
  onCerrar: () => void
}) {
  const [pestana, setPestana] = useState<'bloques' | 'secciones'>('bloques')
  const donde = posicion >= total ? 'al final de la página' : `en la posición ${posicion + 1}`

  return (
    // Arriba y no centrada: al buscar, la lista encoge, y centrada la ventana saltaba con cada letra.
    <Dialog open={abierta} onClose={onCerrar} maxWidth="md" fullWidth aria-labelledby="titulo-galeria-bloques"
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}>
      <DialogTitle id="titulo-galeria-bloques" sx={{ pr: 7 }}>
        Añadir un bloque
        <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>Irá {donde}.</Typography>
        <IconButton aria-label="Cerrar" onClick={onCerrar} sx={{ position: 'absolute', right: 12, top: 12 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <Tabs value={pestana} onChange={(_, v) => setPestana(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="bloques" label="Bloques" />
        <Tab value="secciones" label="Secciones guardadas" />
      </Tabs>
      <DialogContent sx={{ pt: 3 }}>
        {pestana === 'bloques'
          ? <Tipos onElegir={onElegir} />
          : <Secciones abierta={abierta} onElegir={onElegirSeccion} />}
      </DialogContent>
    </Dialog>
  )
}

/** Para buscar sin que importen tildes ni mayúsculas: «galeria» encuentra «Galería». */
const sinTildes = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function Tipos({ onElegir }: { onElegir: (tipo: string) => void }) {
  const { activo } = useModulos()
  // Son casi treinta: buscar por el nombre o por lo que hace va antes que recorrerlos.
  const [busqueda, setBusqueda] = useState('')
  // Se escribe nada más abrir. Con `autoFocus` no bastaba: al abrirse, la
  // ventana se lleva el foco a sí misma después de que el campo lo coja.
  const campo = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const espera = window.setTimeout(() => campo.current?.focus(), 0)
    return () => window.clearTimeout(espera)
  }, [])
  const buscado = sinTildes(busqueda.trim())
  const encaja = (tipo: string) => buscado === ''
    || sinTildes(`${FICHA_DE_BLOQUE[tipo].nombre} ${FICHA_DE_BLOQUE[tipo].descripcion}`).includes(buscado)
  const porGrupo = GRUPOS_DE_BLOQUES.map((grupo) => ({
    grupo,
    tipos: TIPOS.tipos.filter((tipo) => FICHA_DE_BLOQUE[tipo]?.grupo === grupo && activo(moduloDeTipo(tipo)) && encaja(tipo)),
  }))
  const ninguno = porGrupo.every(({ tipos }) => tipos.length === 0)
  return (
    <Stack spacing={3}>
      <TextField size="small" fullWidth inputRef={campo} value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar: foto, mapa, botón…" aria-label="Buscar un bloque"
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
      {ninguno && <Typography color="text.secondary">Ningún bloque coincide con «{busqueda.trim()}».</Typography>}
      {porGrupo.map(({ grupo, tipos }) => {
        if (tipos.length === 0) return null
        return (
          <Box key={grupo} component="section" aria-labelledby={`grupo-${grupo}`}>
            <Typography id={`grupo-${grupo}`} variant="overline" color="text.secondary">{grupo}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1.5, mt: 1 }}>
              {tipos.map((tipo) => (
                <ButtonBase key={tipo} onClick={() => onElegir(tipo)}
                  aria-label={`${FICHA_DE_BLOQUE[tipo].nombre}: ${FICHA_DE_BLOQUE[tipo].descripcion}`}
                  sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5, textAlign: 'left', borderRadius: 2,
                    border: 1, borderColor: 'divider', transition: 'border-color .15s ease, background-color .15s ease',
                    '&:hover, &.Mui-focusVisible': { borderColor: 'primary.main', backgroundColor: 'action.hover' },
                  }}>
                  <Box sx={{ flexShrink: 0, p: 0.75, borderRadius: 1.5, backgroundColor: 'action.hover' }}><Miniatura tipo={tipo} ancho={84} /></Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{FICHA_DE_BLOQUE[tipo].nombre}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>{FICHA_DE_BLOQUE[tipo].descripcion}</Typography>
                  </Box>
                </ButtonBase>
              ))}
            </Box>
          </Box>
        )
      })}
    </Stack>
  )
}

/** Las secciones guardadas: se piden al abrir la pestaña, y se pueden borrar. */
function Secciones({ abierta, onElegir }: { abierta: boolean; onElegir: (bloques: Bloque[]) => void }) {
  const [secciones, setSecciones] = useState<SeccionGuardada[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Aparte del de cargar: un borrado que falla no tapa la lista, que sigue ahí.
  const [errorAlBorrar, setErrorAlBorrar] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<SeccionGuardada | null>(null)

  useEffect(() => {
    if (!abierta) return
    let vigente = true
    seccionesGuardadas()
      .then((lista) => { if (vigente) setSecciones(lista) })
      .catch((e: unknown) => { if (vigente) setError(e instanceof Error ? e.message : 'No se han podido cargar las secciones.') })
    return () => { vigente = false }
  }, [abierta])

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
