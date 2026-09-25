import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Drawer, FormControlLabel, IconButton, Link, List, ListItem, MenuItem, Stack, TextField, Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import HistoryIcon from '@mui/icons-material/History'
import CATALOGO from '../../../../../shared/paginas-publicas.json'
import { NOMBRE_BLOQUE } from '../bloques/formularios'
import {
  getContenido, guardarContenido, guardarSeccion, versionDePagina, versionesDePagina,
  type Bloque, type PaginaDeBloques, type SlugContenido, type VersionDePagina,
} from '../../../lib/api/contenido'

/** Cómo se llama un bloque en una lista: su tipo y, si tiene, su título. */
const resumenDe = (bloque: Bloque, indice: number) =>
  `${indice + 1}. ${NOMBRE_BLOQUE[bloque.tipo] ?? bloque.tipo}${bloque.titulo ? ` · ${bloque.titulo}` : ''}`

/** Un bloque sin su ancla: en otra página podría chocar con una que ya existe. */
function sinAncla(bloque: Bloque): Bloque {
  if (!bloque.presentacion?.ancla) return bloque
  const { ancla: _fuera, ...resto } = bloque.presentacion
  return { ...bloque, presentacion: Object.keys(resto).length > 0 ? resto : undefined }
}

/**
 * Copia un bloque al final de otra página y la guarda. Se guarda de una vez
 * (no se abre la otra página): así no hace falta salir de la que se está
 * editando. La otra página pasa por la validación de siempre y deja su versión
 * en el historial, así que se puede deshacer desde allí.
 */
export function DialogoCopiarBloque({ bloque, slugActual, onCerrar }: { bloque: Bloque | null; slugActual: string; onCerrar: () => void }) {
  const [destino, setDestino] = useState('')
  const [estado, setEstado] = useState<'eligiendo' | 'copiando' | 'hecho'>('eligiendo')
  const [error, setError] = useState<string | null>(null)
  const paginas = CATALOGO.paginas.filter((p) => p.slug !== slugActual)
  const elegida = paginas.find((p) => p.slug === destino)

  const cerrar = () => { setDestino(''); setEstado('eligiendo'); setError(null); onCerrar() }

  const copiar = async () => {
    if (!bloque || !destino) return
    setEstado('copiando'); setError(null)
    try {
      const documento = await getContenido<PaginaDeBloques>(destino as SlugContenido)
      await guardarContenido(destino as SlugContenido, { ...documento, bloques: [...documento.bloques, sinAncla(bloque)] })
      setEstado('hecho')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido copiar el bloque.')
      setEstado('eligiendo')
    }
  }

  return (
    <Dialog open={bloque !== null} onClose={cerrar} maxWidth="xs" fullWidth aria-labelledby="titulo-copiar-bloque">
      <DialogTitle id="titulo-copiar-bloque">Copiar el bloque a otra página</DialogTitle>
      <DialogContent>
        {estado === 'hecho' ? (
          <Alert severity="success">
            Copiado al final de «{elegida?.nombre}» y guardado.{' '}
            <Link component={RouterLink} to={`/cms/paginas/${destino}`}>Abrir esa página</Link>
          </Alert>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select label="Página" value={destino} onChange={(e) => setDestino(e.target.value)} fullWidth
              helperText="El bloque se añade al final de esa página y se guarda. Allí se puede mover o deshacer.">
              {paginas.map((p) => <MenuItem key={p.slug} value={p.slug}>{p.grupo} · {p.nombre}</MenuItem>)}
            </TextField>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={cerrar}>{estado === 'hecho' ? 'Cerrar' : 'Cancelar'}</Button>
        {estado !== 'hecho' && (
          <Button variant="contained" disabled={!destino || estado === 'copiando'} onClick={() => void copiar()}>
            {estado === 'copiando' ? 'Copiando…' : 'Copiar'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

/**
 * Guarda uno o varios bloques de la página como una sección con nombre, para
 * ponerla igual en otra página desde la galería de «Añadir bloque».
 */
export function DialogoGuardarSeccion({ abierto, bloques, marcadoDeInicio, onCerrar }: {
  abierto: boolean
  bloques: Bloque[]
  /** El bloque desde cuyo menú se abrió: sale ya marcado. */
  marcadoDeInicio: number | null
  onCerrar: () => void
}) {
  // El formulario se monta al abrir: así empieza en blanco cada vez.
  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth aria-labelledby="titulo-guardar-seccion">
      {abierto && <FormularioDeSeccion bloques={bloques} marcadoDeInicio={marcadoDeInicio} onCerrar={onCerrar} />}
    </Dialog>
  )
}

function FormularioDeSeccion({ bloques, marcadoDeInicio, onCerrar }: { bloques: Bloque[]; marcadoDeInicio: number | null; onCerrar: () => void }) {
  const [nombre, setNombre] = useState('')
  const [marcados, setMarcados] = useState<Set<number>>(() => new Set(marcadoDeInicio !== null ? [marcadoDeInicio] : []))
  const [estado, setEstado] = useState<'eligiendo' | 'guardando' | 'hecho'>('eligiendo')
  const [error, setError] = useState<string | null>(null)

  const alternar = (i: number) => setMarcados((antes) => {
    const despues = new Set(antes)
    if (despues.has(i)) despues.delete(i)
    else despues.add(i)
    return despues
  })

  const guardar = async () => {
    setEstado('guardando'); setError(null)
    try {
      await guardarSeccion(nombre.trim(), bloques.filter((_, i) => marcados.has(i)))
      setEstado('hecho')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar la sección.')
      setEstado('eligiendo')
    }
  }

  return (
    <>
      <DialogTitle id="titulo-guardar-seccion">Guardar como sección</DialogTitle>
      <DialogContent>
        {estado === 'hecho' ? (
          <Alert severity="success">
            Guardada. La tienes en «Añadir bloque», en la pestaña «Secciones guardadas», para cualquier página.
          </Alert>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Nombre de la sección" value={nombre} onChange={(e) => setNombre(e.target.value)} fullWidth autoFocus
              helperText="Para reconocerla en la galería, como «Horario de misas y datos de la parroquia»."
              slotProps={{ htmlInput: { maxLength: 80 } }} />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Bloques que entran</Typography>
              <Stack>
                {bloques.map((bloque, i) => (
                  <FormControlLabel key={i} label={resumenDe(bloque, i)}
                    control={<Checkbox checked={marcados.has(i)} onChange={() => alternar(i)} />} />
                ))}
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>{estado === 'hecho' ? 'Cerrar' : 'Cancelar'}</Button>
        {estado !== 'hecho' && (
          <Button variant="contained" disabled={nombre.trim() === '' || marcados.size === 0 || estado === 'guardando'} onClick={() => void guardar()}>
            {estado === 'guardando' ? 'Guardando…' : 'Guardar sección'}
          </Button>
        )}
      </DialogActions>
    </>
  )
}

const fechaDeVersion = (iso: string) => new Date(iso).toLocaleString('es-ES', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

/**
 * El historial de la página: cada guardado, con quién y cuándo. Una versión
 * anterior se carga en el editor, no se publica sola: se revisa en la vista en
 * vivo y se guarda como cualquier cambio (y si no convence, se deshace).
 */
export function HistorialDeVersiones({ abierto, slug, onCargar, onCerrar }: {
  abierto: boolean
  slug: SlugContenido
  onCargar: (documento: PaginaDeBloques, version: VersionDePagina) => void
  onCerrar: () => void
}) {
  // La lista se monta (y se pide) cada vez que se abre: así está al día.
  return (
    <Drawer anchor="right" open={abierto} onClose={onCerrar} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 400 } } } }}>
      {abierto && <ListaDeVersiones slug={slug} onCargar={onCargar} onCerrar={onCerrar} />}
    </Drawer>
  )
}

function ListaDeVersiones({ slug, onCargar, onCerrar }: {
  slug: SlugContenido
  onCargar: (documento: PaginaDeBloques, version: VersionDePagina) => void
  onCerrar: () => void
}) {
  const [versiones, setVersiones] = useState<VersionDePagina[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState<number | null>(null)

  useEffect(() => {
    let vigente = true
    versionesDePagina(slug)
      .then((lista) => { if (vigente) setVersiones(lista) })
      .catch((e: unknown) => { if (vigente) setError(e instanceof Error ? e.message : 'No se ha podido cargar el historial.') })
    return () => { vigente = false }
  }, [slug])

  const cargar = async (version: VersionDePagina) => {
    setCargando(version.id); setError(null)
    try {
      onCargar(await versionDePagina(slug, version.id), version)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido cargar esa versión.')
    } finally {
      setCargando(null)
    }
  }

  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <HistoryIcon sx={{ mr: 1.5, color: 'text.secondary' }} />
        <Typography variant="h6" component="h2" sx={{ flex: 1 }}>Historial de la página</Typography>
        <IconButton aria-label="Cerrar el historial" onClick={onCerrar}><CloseIcon /></IconButton>
      </Stack>
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Cada vez que se guarda queda una versión. Al cargar una, el editor la enseña en la vista en vivo; no se publica hasta
          que guardes, y se puede deshacer.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {versiones === null && !error && <CircularProgress aria-label="Cargando el historial" />}
        {versiones?.length === 0 && (
          <Alert severity="info" variant="outlined">Aún no hay versiones: la primera se guarda la próxima vez que guardes esta página.</Alert>
        )}
        <List disablePadding>
          {versiones?.map((version) => (
            <ListItem key={version.id} disableGutters sx={{ display: 'block', py: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 600, flex: 1 }}>{fechaDeVersion(version.fecha)}</Typography>
                {version.actual && <Chip size="small" color="primary" label="Publicada" />}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {version.autor || 'Antes de empezar el historial'} · {version.bloques} {version.bloques === 1 ? 'bloque' : 'bloques'}
              </Typography>
              {!version.actual && (
                <Button size="small" sx={{ mt: 0.5, px: 0 }} disabled={cargando !== null} onClick={() => void cargar(version)}>
                  {cargando === version.id ? 'Cargando…' : 'Cargar en el editor'}
                </Button>
              )}
            </ListItem>
          ))}
        </List>
      </Box>
    </>
  )
}
