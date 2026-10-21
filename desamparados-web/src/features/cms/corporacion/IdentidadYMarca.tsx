import { useId, useState, type ChangeEvent, type ReactNode } from 'react'
import { Alert, Box, Button, CircularProgress, Collapse, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useBlocker } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AvisoCambiosSinGuardar from '../ficha/AvisoCambiosSinGuardar'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { useAvisoAlCerrarLaPestana } from '../../../hooks/useAvisoAlCerrarLaPestana'
import {
  guardarIdentidad, marcaDelCms, quitarImagenDeMarca, subirImagenDeMarca,
  type ClaveDeImagen, type EstadoDeLaMarca, type ImagenDeLaMarca,
} from '../../../lib/api/corporacion'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { FONDOS, avisosDeMarca, paletaDeMarca } from '../../../../../shared/colores-de-marca.mjs'
import type { Articulo } from '../../../../../shared/datos-entidad.mjs'
import type { AccionesDelFormulario } from './acciones'

export const CLAVE_MARCA = ['cms', 'corporacion', 'marca'] as const
const CLAVE = CLAVE_MARCA

// Los de shared/datos-entidad.mjs, escritos aquí: ese módulo lee el disco
// (node:fs) y en el navegador no se puede importar más que su tipo.
const ARTICULOS: readonly Articulo[] = ['el', 'la', 'los', 'las']

/** Lo que se edita, todo en texto: vacío es «pendiente» o «el de partida». */
interface Formulario {
  nombre: string
  nombreCorto: string
  tipo: string
  tipoCorto: string
  articulo: Articulo
  /** Uno o varios, en orden: el primero es el principal. */
  titulares: string[]
  localidad: string
  descripcion: string
  denominacion: string
  domicilio: string
  normasTitulo: string
  normasUrl: string
  colorPrincipal: string
  colorAcento: string
}
/** Los campos de una línea; los titulares van aparte, que son una lista. */
type Campo = Exclude<keyof Formulario, 'titulares'>

/** Hasta seis: los que caben en un membrete sin que el nombre se pierda. */
const MAX_TITULARES = 6

function aFormulario({ identidad: i, colores }: EstadoDeLaMarca): Formulario {
  return {
    nombre: i.nombre, nombreCorto: i.nombreCorto, tipo: i.tipo, tipoCorto: i.tipoCorto, articulo: i.articulo,
    titulares: [...i.titulares], localidad: i.localidad, descripcion: i.descripcion,
    denominacion: i.denominacion ?? '', domicilio: i.domicilio ?? '',
    normasTitulo: i.normas?.titulo ?? '', normasUrl: i.normas?.url ?? '',
    colorPrincipal: colores.colorPrincipal ?? '', colorAcento: colores.colorAcento ?? '',
  }
}

const nulo = (v: string) => v.trim() || null
const COLOR = /^#[0-9a-f]{6}$/i

function aDatos(f: Formulario) {
  const titulo = nulo(f.normasTitulo)
  const url = nulo(f.normasUrl)
  return {
    identidad: {
      nombre: f.nombre.trim(), nombreCorto: f.nombreCorto.trim(), tipo: f.tipo.trim(), tipoCorto: f.tipoCorto.trim(),
      articulo: f.articulo, titulares: f.titulares.map((t) => t.trim()), localidad: f.localidad.trim(), descripcion: f.descripcion.trim(),
      denominacion: nulo(f.denominacion), domicilio: nulo(f.domicilio),
      normas: titulo && url ? { titulo, url } : null,
    },
    colores: { colorPrincipal: nulo(f.colorPrincipal)?.toLowerCase() ?? null, colorAcento: nulo(f.colorAcento)?.toLowerCase() ?? null },
  }
}

const OBLIGATORIOS: Campo[] = ['nombre', 'nombreCorto', 'tipo', 'tipoCorto', 'localidad', 'descripcion']

/** Lo mismo que comprueba la API, dicho antes de guardar. */
function erroresDe(f: Formulario): Partial<Record<Campo, string>> {
  const errores: Partial<Record<Campo, string>> = {}
  for (const campo of OBLIGATORIOS) if (!f[campo].trim()) errores[campo] = 'No puede quedar vacío.'
  for (const campo of ['colorPrincipal', 'colorAcento'] as const) {
    if (f[campo].trim() && !COLOR.test(f[campo].trim())) errores[campo] = 'Un color #rrggbb, como #1f3a6b.'
  }
  const titulo = f.normasTitulo.trim()
  const url = f.normasUrl.trim()
  if (titulo && !url) errores.normasUrl = 'Falta el enlace (o vacía las dos).'
  if (url && !titulo) errores.normasTitulo = 'Falta el título (o vacía las dos).'
  if (url && !/^https:\/\/\S+$/.test(url)) errores.normasUrl = 'Tiene que empezar por https://'
  return errores
}

/** Las rutas de los errores del servidor (`identidad.nombre`, `colores.colorPrincipal`) a su campo. */
function campoDelServidor(ruta: string): Campo | null {
  const [, clave, sub] = ruta.split('.')
  if (clave === 'normas') return sub === 'url' ? 'normasUrl' : 'normasTitulo'
  return (clave as Campo) ?? null
}

/**
 * Una ficha como las de Contacto: título y resumen a la izquierda, lo suyo a la
 * derecha. Suelta, solo lo suyo: en el asistente cada paso ya lleva su título.
 */
function Ficha({ titulo, resumen, suelta, children }: { titulo: string; resumen: string; suelta: boolean; children: ReactNode }) {
  if (suelta) return <Box component="section" aria-label={titulo}>{children}</Box>
  return (
    <Paper variant="outlined" component="section" aria-label={titulo}
      sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: { xs: 2, md: 4 }, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 260px) minmax(0, 1fr)' } }}>
      <Stack spacing={0.75}>
        <Typography variant="h3" component="h2" sx={{ fontSize: 22 }}>{titulo}</Typography>
        <Typography variant="body2" color="text.secondary">{resumen}</Typography>
      </Stack>
      {children}
    </Paper>
  )
}

const DOS_COLUMNAS = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, alignContent: 'start' } as const
const ANCHO_ENTERO = { gridColumn: '1 / -1' } as const

/** Cada imagen: dónde sale, qué fondo lleva detrás en su sitio y si se puede quedar sin ella. */
const IMAGENES: { clave: ClaveDeImagen; nombre: string; donde: string; fondo: string; foto?: boolean; opcional?: boolean }[] = [
  { clave: 'escudoSobreOscuro', nombre: 'Escudo sobre oscuro', donde: 'La barra de la web', fondo: FONDOS.profundo },
  { clave: 'escudoSobreClaro', nombre: 'Escudo sobre claro', donde: 'Correos y pie de los PDF', fondo: FONDOS.blanco },
  { clave: 'escudoDestacado', nombre: 'Escudo destacado', donde: 'Papeleta, cartas, informes', fondo: FONDOS.almanaque, opcional: true },
  { clave: 'compartir', nombre: 'Imagen para compartir', donde: 'WhatsApp, Facebook', fondo: FONDOS.profundo, foto: true, opcional: true },
  { clave: 'correoCabecera', nombre: 'Cabecera de los correos', donde: 'Bajo el membrete, a los hermanos', fondo: FONDOS.profundo, foto: true, opcional: true },
]

const formato = (tipo: string) => (tipo === 'image/png' ? 'PNG' : 'JPEG')

/**
 * La tarjeta de una imagen: se guarda al subirla, sin pasar por «Guardar».
 * Cualquier PNG, JPEG o WebP vale: el servidor la pasa al formato y la medida
 * de su sitio y saca los iconos del escudo sobre oscuro.
 */
function TarjetaDeImagen({ pieza, imagen, iconos, ocupada, onSubir, onQuitar }: {
  pieza: (typeof IMAGENES)[number]
  imagen: ImagenDeLaMarca | null
  iconos: EstadoDeLaMarca['iconos'] | null
  ocupada: boolean
  onSubir: (fichero: File) => void
  onQuitar: () => void
}) {
  const id = useId()
  const sinImagen = !imagen
  return (
    <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ height: 150, bgcolor: pieza.fondo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {imagen
          ? <Box component="img" src={imagen.url} alt={pieza.nombre} sx={pieza.foto ? { width: '100%', height: '100%', objectFit: 'cover' } : { maxHeight: 120, maxWidth: '90%' }} />
          : <Typography variant="body2" sx={{ color: 'common.white' }}>Sin imagen</Typography>}
      </Box>
      <Stack spacing={0.75} sx={{ p: 1.75, flex: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>{pieza.nombre}</Typography>
        <Typography variant="body2" color="text.secondary">
          {imagen ? `${imagen.ancho} × ${imagen.alto} · ${formato(imagen.tipo)} · ` : ''}{pieza.donde}
          {imagen && !imagen.propia ? ' · De partida' : ''}
        </Typography>
        {pieza.clave === 'escudoSobreOscuro' && iconos && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">Iconos:</Typography>
            <Box component="img" src={iconos.favicon32} alt="Icono de la pestaña" sx={{ width: 16, height: 16 }} />
            <Box component="img" src={iconos.appleTouchIcon} alt="Icono del móvil" sx={{ width: 28, height: 28, borderRadius: 1.5 }} />
            <Box component="img" src={iconos.icono512} alt="Icono grande" sx={{ width: 36, height: 36, borderRadius: 2 }} />
          </Stack>
        )}
        <Stack direction="row" spacing={1} sx={{ pt: 0.5, mt: 'auto', alignItems: 'center' }}>
          <input id={id} type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={ocupada}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onSubir(f) }} />
          <Button component="label" htmlFor={id} variant="outlined" size="small" disabled={ocupada} sx={{ minHeight: 40 }}>
            {ocupada ? 'Subiendo…' : sinImagen ? 'Subir' : 'Cambiar'}
          </Button>
          {imagen?.propia && (
            <Button variant="text" size="small" color="inherit" disabled={ocupada} onClick={onQuitar} sx={{ minHeight: 40 }}>Quitar</Button>
          )}
        </Stack>
      </Stack>
    </Box>
  )
}

/** Cómo quedan los colores, con la paleta que sale de ellos (la misma que usará la web). */
function MuestraDeColores({ principal, acento }: { principal: string | null; acento: string | null }) {
  const p = paletaDeMarca({ colorPrincipal: principal, colorAcento: acento })
  const boton = { alignSelf: 'flex-start', bgcolor: p.principal, color: FONDOS.blanco, fontSize: 14, fontWeight: 600, px: 2, py: 1, borderRadius: 1 } as const
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
      <Stack spacing={1.25} sx={{ bgcolor: FONDOS.publico, borderRadius: 1.5, p: 2 }} aria-label="Muestra en la web pública">
        <Typography sx={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: p.acentoApagado }}>Web pública</Typography>
        <Typography sx={{ color: FONDOS.blanco }}>Cultos de <Box component="span" sx={{ color: p.acento, textDecoration: 'underline' }}>noviembre</Box></Typography>
        <Box sx={boton}>Hazte hermano</Box>
      </Stack>
      <Stack spacing={1.25} sx={{ bgcolor: FONDOS.blanco, border: 1, borderColor: 'divider', borderRadius: 1.5, p: 2 }} aria-label="Muestra en el CMS y los PDF">
        <Typography sx={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'text.secondary' }}>CMS y PDF</Typography>
        <Typography sx={{ color: 'text.primary' }}>Recibo de <Box component="span" sx={{ color: p.principal, textDecoration: 'underline' }}>octubre</Box></Typography>
        <Box sx={boton}>Guardar</Box>
      </Stack>
    </Box>
  )
}

export type FichaDeLaMarca = 'identidad' | 'legales' | 'colores' | 'imagenes'
const TODAS: FichaDeLaMarca[] = ['identidad', 'legales', 'colores', 'imagenes']

/** Lo que la vista previa del asistente necesita para pintar la web como quedará. */
export interface VistaDeLaMarca {
  nombre: string
  nombreCorto: string
  localidad: string
  colorPrincipal: string | null
  colorAcento: string | null
  escudo: string | null
  escudoSobreClaro: string | null
  icono: string | null
}

/** La vista de lo guardado o, si se está escribiendo, de lo escrito. */
export function vistaDeLaMarca(estado: EstadoDeLaMarca, escrito?: Pick<VistaDeLaMarca, 'nombre' | 'nombreCorto' | 'localidad' | 'colorPrincipal' | 'colorAcento'>): VistaDeLaMarca {
  return {
    nombre: escrito?.nombre ?? estado.identidad.nombre,
    nombreCorto: escrito?.nombreCorto ?? estado.identidad.nombreCorto,
    localidad: escrito?.localidad ?? estado.identidad.localidad,
    colorPrincipal: escrito ? escrito.colorPrincipal : estado.colores.colorPrincipal,
    colorAcento: escrito ? escrito.colorAcento : estado.colores.colorAcento,
    escudo: estado.imagenes.escudoSobreOscuro?.url ?? null,
    escudoSobreClaro: estado.imagenes.escudoSobreClaro?.propia ? estado.imagenes.escudoSobreClaro.url : null,
    icono: estado.iconos.appleTouchIcon,
  }
}

/**
 * Sistema › Datos de la corporación › Identidad y marca: el nombre, los colores
 * y las imágenes, solo Administración. La primera vez salen del fichero de la
 * instalación; desde entonces mandan los de aquí. Al guardar, la API los aplica
 * a los correos y los PDF y vuelve a escribir lo que lee la web, así que quien
 * abra una página la ve ya nueva; la que está abierta, al recargar.
 */
export default function IdentidadYMarca({ fichas = TODAS, enAsistente = false, marco, alGuardar }: {
  /** Las fichas que se enseñan; sin él, todas. El asistente enseña una o dos por paso. */
  fichas?: FichaDeLaMarca[]
  /** Sin el marco de ficha, con las imágenes opcionales plegadas y sin el aviso de recargar. */
  enAsistente?: boolean
  /** Quien pone los botones (el asistente): recibe las fichas, lo que hace falta para guardar y la vista previa. */
  marco?: (contenido: ReactNode, acciones: AccionesDelFormulario, vista: VistaDeLaMarca) => ReactNode
  alGuardar?: () => void
} = {}) {
  const cliente = useQueryClient()
  const { data, isPending, isError } = useQuery({ queryKey: CLAVE, queryFn: marcaDelCms })
  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [copiado, setCopiado] = useState<EstadoDeLaMarca | undefined>(undefined)
  const [cambiado, setCambiado] = useState(false)
  const [subiendo, setSubiendo] = useState<ClaveDeImagen | null>(null)
  const [errorDeImagen, setErrorDeImagen] = useState<{ clave: ClaveDeImagen; mensaje: string } | null>(null)
  const [quitando, setQuitando] = useState<(typeof IMAGENES)[number] | null>(null)
  const [masImagenes, setMasImagenes] = useState(false)

  const guardar = useMutation({
    mutationFn: () => guardarIdentidad(aDatos(formulario!)),
    onSuccess: (estado) => {
      cliente.setQueryData(CLAVE, estado)
      // Lo guardado, ya normalizado (vacíos a null, colores en minúscula), pasa al formulario.
      setCopiado(estado)
      setFormulario(aFormulario(estado))
      setCambiado(true)
      alGuardar?.()
    },
  })
  const imagen = useMutation({
    mutationFn: ({ clave, fichero }: { clave: ClaveDeImagen; fichero?: File }) =>
      fichero ? subirImagenDeMarca(clave, fichero) : quitarImagenDeMarca(clave),
    onMutate: ({ clave }) => { setSubiendo(clave); setErrorDeImagen(null) },
    onSuccess: (estado) => {
      // Solo las imágenes: lo que se está escribiendo en el formulario no se toca.
      cliente.setQueryData(CLAVE, estado)
      setCopiado(estado)
      setCambiado(true)
    },
    onError: (error, { clave }) => setErrorDeImagen({ clave, mensaje: error.message }),
    onSettled: () => setSubiendo(null),
  })

  const original = copiado ? aFormulario(copiado) : null
  // Con JSON porque los titulares son una lista: `!==` compararía la referencia.
  const sinGuardar = Boolean(formulario && original) && JSON.stringify(formulario) !== JSON.stringify(original)
  const bloqueo = useBlocker(({ currentLocation, nextLocation }) =>
    sinGuardar && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search))
  useAvisoAlCerrarLaPestana(sinGuardar)

  // Lo del servidor pasa al formulario al pintar, no en un efecto (como en
  // Contacto). Tras subir una imagen llega otro `data` con la misma identidad:
  // el formulario no se pisa si ya estaba copiado.
  if (data && data !== copiado && !formulario) {
    setCopiado(data)
    setFormulario(aFormulario(data))
    return null
  }

  if (isPending) return <CircularProgress aria-label="Cargando la identidad y la marca" />
  if (isError || !data || !formulario) return <Alert severity="error">No se han podido cargar la identidad y la marca. Inténtalo de nuevo en unos minutos.</Alert>

  const errores = erroresDe(formulario)
  const erroresTitulares = formulario.titulares.map((t) => (t.trim() ? null : 'No puede quedar vacío.'))
  const hayErrores = Object.keys(errores).length > 0 || erroresTitulares.some(Boolean)
  const delServidor: Partial<Record<Campo, string>> = {}
  if (guardar.error instanceof ErrorDeApi) {
    for (const [ruta, mensaje] of Object.entries(guardar.error.fields)) {
      const campo = campoDelServidor(ruta)
      if (campo) delServidor[campo] = mensaje
    }
  }
  const cambiar = (campo: Campo, valor: string) => {
    setFormulario((f) => ({ ...f!, [campo]: valor }))
    guardar.reset()
  }
  const cambiarTitulares = (cambio: (titulares: string[]) => string[]) => {
    setFormulario((f) => ({ ...f!, titulares: cambio([...f!.titulares]) }))
    guardar.reset()
  }
  const variosTitulares = formulario.titulares.length > 1
  const campo = (c: Campo, etiqueta: string, extra: { ayuda?: string; max: number; multilinea?: boolean; ejemplo?: string; ancho?: boolean }) => {
    const error = errores[c] ?? delServidor[c]
    return (
      <TextField
        size="small"
        label={etiqueta}
        value={formulario[c]}
        onChange={(e) => cambiar(c, e.target.value)}
        error={Boolean(error)}
        helperText={error ?? extra.ayuda}
        placeholder={extra.ejemplo}
        multiline={extra.multilinea}
        minRows={extra.multilinea ? 2 : undefined}
        sx={extra.ancho ? ANCHO_ENTERO : undefined}
        slotProps={{ htmlInput: { maxLength: extra.max } }}
      />
    )
  }
  const colorValido = (v: string) => (COLOR.test(v.trim()) ? v.trim().toLowerCase() : null)
  const colores = { colorPrincipal: colorValido(formulario.colorPrincipal), colorAcento: colorValido(formulario.colorAcento) }
  const avisosColores = avisosDeMarca(colores)
  const avisosImagenes = data.avisos.filter((a) => !avisosDeMarca(data.colores).includes(a))
  const campoDeColor = (c: 'colorPrincipal' | 'colorAcento', etiqueta: string, ayuda: string, partida: string) => (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
      <Box component="input" type="color" aria-label={`${etiqueta}: elegir en la paleta`}
        value={colores[c] ?? partida}
        onChange={(e: ChangeEvent<HTMLInputElement>) => cambiar(c, e.target.value)}
        sx={{ width: 40, height: 40, p: 0, border: 0, borderRadius: 1, cursor: 'pointer', flex: 'none', bgcolor: 'transparent' }} />
      <Box sx={{ flex: 1, minWidth: 0, display: 'grid' }}>
        {campo(c, etiqueta, { ayuda, max: 7, ejemplo: partida })}
      </Box>
    </Stack>
  )
  const partida = paletaDeMarca(null)

  const tarjeta = (pieza: (typeof IMAGENES)[number]) => (
    <Stack key={pieza.clave} spacing={1}>
      <TarjetaDeImagen
        pieza={pieza}
        imagen={data.imagenes[pieza.clave]}
        iconos={pieza.clave === 'escudoSobreOscuro' ? data.iconos : null}
        ocupada={subiendo === pieza.clave}
        onSubir={(fichero) => imagen.mutate({ clave: pieza.clave, fichero })}
        onQuitar={() => setQuitando(pieza)}
      />
      {errorDeImagen?.clave === pieza.clave && <Alert severity="error">{errorDeImagen.mensaje}</Alert>}
    </Stack>
  )
  const rejilla = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: enAsistente ? undefined : 'repeat(3, minmax(0, 1fr))' } }
  // En el asistente, los dos escudos a la vista y las opcionales plegadas: se pueden poner luego.
  const imagenes = enAsistente ? (
    <Stack spacing={2}>
      <Box sx={rejilla}>{IMAGENES.filter((p) => !p.opcional).map(tarjeta)}</Box>
      <Button variant="text" color="inherit" aria-expanded={masImagenes} onClick={() => setMasImagenes((v) => !v)}
        sx={{ alignSelf: 'flex-start', minHeight: 40 }}>
        {masImagenes ? 'Menos imágenes' : 'Más imágenes (se pueden poner luego)'}
      </Button>
      <Collapse in={masImagenes} unmountOnExit><Box sx={rejilla}>{IMAGENES.filter((p) => p.opcional).map(tarjeta)}</Box></Collapse>
    </Stack>
  ) : <Box sx={rejilla}>{IMAGENES.map(tarjeta)}</Box>

  const contenido = (
    <Stack spacing={3}>
      {fichas.includes('identidad') && (
        <Ficha suelta={enAsistente} titulo="Identidad" resumen="El nombre sale en los títulos de la web, los correos, los PDF y los textos legales.">
          <Box sx={DOS_COLUMNAS}>
            {campo('nombre', 'Nombre completo', { max: 160, ancho: true })}
            {campo('nombreCorto', 'Nombre corto', { max: 40, ayuda: 'En las pestañas y la barra de la web.' })}
            {campo('localidad', 'Localidad', { max: 80, ayuda: 'Junto al nombre, en el título de la web.' })}
            {campo('tipo', 'Tipo', { max: 60, ayuda: 'Como lo dice la papeleta, sobre el titular.' })}
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 1fr) 96px' }}>
              {campo('tipoCorto', 'Tipo corto', { max: 40, ayuda: 'Sin el segundo nombre.' })}
              <TextField select size="small" label="Artículo" value={formulario.articulo} onChange={(e) => cambiar('articulo', e.target.value)}>
                {ARTICULOS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
              </TextField>
            </Box>
            <Stack spacing={1.5} sx={ANCHO_ENTERO} role="group" aria-label="Titulares">
              {formulario.titulares.map((titular, n) => (
                <Stack key={n} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <TextField
                    size="small"
                    fullWidth
                    label={variosTitulares ? `Titular ${n + 1}` : 'Titular'}
                    value={titular}
                    onChange={(e) => cambiarTitulares((t) => { t[n] = e.target.value; return t })}
                    error={Boolean(erroresTitulares[n])}
                    helperText={erroresTitulares[n] ?? (variosTitulares && n === 0 ? 'El principal: el de las fotos y los textos de una sola imagen.' : undefined)}
                    slotProps={{ htmlInput: { maxLength: 160 } }}
                  />
                  {variosTitulares && (
                    <Button variant="text" color="inherit" onClick={() => cambiarTitulares((t) => t.filter((_, i) => i !== n))}
                      aria-label={`Quitar el titular ${n + 1}`} sx={{ minHeight: 40, flex: 'none' }}>
                      Quitar
                    </Button>
                  )}
                </Stack>
              ))}
              {formulario.titulares.length < MAX_TITULARES && (
                <Button variant="text" onClick={() => cambiarTitulares((t) => [...t, ''])} sx={{ alignSelf: 'flex-start', minHeight: 40 }}>
                  Añadir titular
                </Button>
              )}
            </Stack>
            {campo('descripcion', 'Descripción', { max: 300, multilinea: true, ancho: true, ayuda: 'La que enseñan Google y WhatsApp al compartir la web.' })}
          </Box>
        </Ficha>
      )}

      {fichas.includes('legales') && (
        <Ficha suelta={enAsistente} titulo="Datos legales" resumen="Los del aviso legal y la privacidad. Vacíos, esos apartados no salen.">
          <Box sx={DOS_COLUMNAS}>
            {campo('denominacion', 'Denominación jurídica', { max: 240, ancho: true })}
            {campo('domicilio', 'Domicilio social', { max: 200, ancho: true })}
            {campo('normasTitulo', 'Se rige por', { max: 160, ejemplo: 'los estatutos de…' })}
            {campo('normasUrl', 'Enlace a las normas', { max: 300, ejemplo: 'https://…' })}
          </Box>
        </Ficha>
      )}

      {fichas.includes('colores') && (
        <Ficha suelta={enAsistente} titulo="Colores" resumen="De estos dos salen todos los tonos de la web, los PDF y los correos. Vacío: los de partida.">
          <Stack spacing={2.5}>
            <Box sx={DOS_COLUMNAS}>
              {campoDeColor('colorPrincipal', 'Principal', 'El de relleno, con letra blanca: botones, avatar.', partida.principal)}
              {campoDeColor('colorAcento', 'Acento', 'El que se escribe sobre oscuro: enlaces, filetes, foco.', partida.acento)}
            </Box>
            {/* En el asistente la vista previa ya enseña los colores al lado. */}
            {!enAsistente && <MuestraDeColores principal={colores.colorPrincipal} acento={colores.colorAcento} />}
            {avisosColores.length
              ? <Alert severity="warning">{avisosColores.map((a) => <div key={a}>{a}</div>)}</Alert>
              : <Typography variant="body2" sx={{ color: 'success.main' }}>Los dos cumplen el contraste en todos los fondos.</Typography>}
          </Stack>
        </Ficha>
      )}

      {fichas.includes('imagenes') && (
        <Ficha suelta={enAsistente} titulo="Imágenes" resumen="PNG, JPEG o WebP. Se guardan al subirlas; los visitantes las ven en la siguiente página que abran.">
          <Stack spacing={2}>
            {imagenes}
            {avisosImagenes.length > 0 && <Alert severity="warning">{avisosImagenes.map((a) => <div key={a}>{a}</div>)}</Alert>}
          </Stack>
        </Ficha>
      )}

      {guardar.isError && <Alert severity="error">{guardar.error.message}</Alert>}
    </Stack>
  )
  const acciones: AccionesDelFormulario = { sinGuardar, hayErrores, guardando: guardar.isPending, guardar: () => guardar.mutate() }
  const vista = vistaDeLaMarca(data, {
    nombre: formulario.nombre.trim() || data.identidad.nombre,
    nombreCorto: formulario.nombreCorto.trim() || data.identidad.nombreCorto,
    localidad: formulario.localidad.trim(),
    ...colores,
  })

  return (
    <>
      {marco ? marco(contenido, acciones, vista) : (
        <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); guardar.mutate() }}>
          <Stack spacing={3}>
            {cambiado && (
              <Alert severity="success" action={<Button color="inherit" size="small" onClick={() => window.location.reload()}>Recargar</Button>}>
                Guardado. Quien abra la web ya lo ve nuevo; esta pestaña, al recargar.
              </Alert>
            )}
            {contenido}
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
              {hayErrores && <Typography variant="body2" color="text.secondary">Corrige los campos marcados para guardar.</Typography>}
              <Button type="submit" variant="contained" disabled={!sinGuardar || hayErrores || guardar.isPending}>
                {guardar.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
      <DialogoConfirmacion
        abierto={quitando !== null}
        titulo={`Quitar «${quitando?.nombre ?? ''}»`}
        mensaje={quitando?.opcional
          ? 'Dejará de salir en la web, los correos y los PDF. Puedes volver a subirla cuando quieras.'
          : 'Se volverá a usar la de partida, un escudo genérico. Puedes volver a subir el vuestro cuando quieras.'}
        textoConfirmar="Quitar"
        peligro
        onConfirmar={() => { if (quitando) imagen.mutate({ clave: quitando.clave }); setQuitando(null) }}
        onCancelar={() => setQuitando(null)}
      />
      <AvisoCambiosSinGuardar bloqueo={bloqueo} deQue="la identidad y los colores" />
    </>
  )
}
