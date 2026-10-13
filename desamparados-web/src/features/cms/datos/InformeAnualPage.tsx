import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../altas/auth/store'
import {
  guardarEnDisco, guardarInformeAnual, traerInformeAnual, traerInformeAnualPdf,
  type CampoInforme, type InformeAnualResponse, type TextosInforme,
} from '../../../lib/api/datos'
import { FILETE, FONDO_PIEZA, ORO, ROSA_URGENTE, SERIF, VERSALITAS } from '../inicio/estiloRetablo'
import { useAltoDisponible } from '../inicio/useAltoDisponible'
import { site } from '../../../config/site'
import { useModulos } from '../../../hooks/useModulos'
import { cumple, type Modulo } from '../../../domain/modulos'

/**
 * El año que se abre sin elegir: de enero a marzo, el anterior (es cuando se
 * termina de escribir y se presenta al cabildo); desde abril, el de ahora, que
 * se va preparando mientras transcurre.
 */
export function anioPorDefecto(hoy = new Date()): number {
  return hoy.getMonth() < 3 ? hoy.getFullYear() - 1 : hoy.getFullYear()
}

/** Lo que escribe cada cargo: igual que `puedeEscribir` del backend. */
export function puedeEscribir(role: string | undefined, campo: CampoInforme): boolean {
  if (role === 'ADMIN' || role === 'HERMANO_MAYOR') return true
  return role === 'SECRETARIA' && (campo === 'epilogo' || campo === 'firmaEpilogo')
}

type ClaveCapitulo = 'portada' | 'presentacion' | 'patrimonio' | 'epilogo' | 'datos'

interface Capitulo { numero: string; titulo: string; clave: ClaveCapitulo; modulo: Modulo }

const CAPITULOS: Capitulo[] = [
  { numero: '', titulo: 'Portada', clave: 'portada', modulo: 'nucleo' },
  { numero: 'I', titulo: 'Presentación del Hermano Mayor', clave: 'presentacion', modulo: 'nucleo' },
  { numero: 'II', titulo: 'El año de un vistazo', clave: 'datos', modulo: 'nucleo' },
  { numero: 'III', titulo: 'Cultos y actos', clave: 'datos', modulo: 'agenda' },
  { numero: 'IV', titulo: 'Hermanos', clave: 'datos', modulo: 'nucleo' },
  // El PDF lo titula con los nombres de las salidas del año; aquí, que solo guía, basta el genérico.
  { numero: 'V', titulo: 'Salidas procesionales', clave: 'datos', modulo: 'procesion' },
  { numero: 'VI', titulo: 'Cuentas', clave: 'datos', modulo: 'nucleo' },
  { numero: 'VII', titulo: 'Patrimonio', clave: 'patrimonio', modulo: 'inventario' },
  { numero: 'VIII', titulo: 'Comunicación', clave: 'datos', modulo: 'nucleo' },
  { numero: '—', titulo: 'Epílogo del Secretario', clave: 'epilogo', modulo: 'nucleo' },
]

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

/** Los capítulos con estos módulos, renumerados como los numera el PDF (sin huecos). */
function capitulosVisibles(activos: ReadonlySet<string>): Capitulo[] {
  let n = 0
  return CAPITULOS.filter((c) => cumple(c.modulo, activos)).map((c) => (c.numero && c.numero !== '—' ? { ...c, numero: ROMANOS[n++] } : c))
}

/** Los campos que se escriben en cada capítulo: el primero es el texto largo. */
const CAMPOS: Record<Exclude<ClaveCapitulo, 'datos'>, { campo: CampoInforme; etiqueta: string; largo?: boolean; ayuda?: string }[]> = {
  portada: [{ campo: 'fechaCabildo', etiqueta: 'Fecha del cabildo', ayuda: 'Sale al pie de la portada: «Presentada al Cabildo General de hermanos el …». Déjalo en blanco si aún no hay fecha.' }],
  presentacion: [
    { campo: 'presentacion', etiqueta: 'Texto de la presentación', largo: true },
    { campo: 'firmaPresentacion', etiqueta: 'Firma' },
    { campo: 'lugarFecha', etiqueta: 'Lugar y fecha' },
  ],
  patrimonio: [{ campo: 'notaPatrimonio', etiqueta: 'Estrenos, restauraciones y donaciones (opcional)', largo: true, ayuda: 'Va delante de las cifras del inventario. Sin nota, el capítulo lleva solo las cifras.' }],
  epilogo: [
    { campo: 'epilogo', etiqueta: 'Texto del epílogo', largo: true },
    { campo: 'firmaEpilogo', etiqueta: 'Firma' },
  ],
}

const TITULO_EDITOR: Record<Exclude<ClaveCapitulo, 'datos'>, string> = {
  portada: 'Portada',
  presentacion: 'Presentación del Hermano Mayor',
  patrimonio: 'Patrimonio: la nota',
  epilogo: 'Epílogo del Secretario',
}

const ESPERA_GUARDADO = 900

function estadoDe(cap: Capitulo, textos: TextosInforme): { texto: string; tono: 'ok' | 'falta' | 'hecho' } {
  if (cap.clave === 'datos') return { texto: 'de los datos', tono: 'ok' }
  if (cap.clave === 'portada') return { texto: textos.fechaCabildo ? 'con fecha del cabildo' : 'de los datos', tono: 'ok' }
  if (cap.clave === 'patrimonio') return { texto: textos.notaPatrimonio ? 'datos y nota' : 'datos + nota opcional', tono: 'ok' }
  const escrito = cap.clave === 'presentacion' ? textos.presentacion : textos.epilogo
  return escrito ? { texto: 'escrito', tono: 'hecho' } : { texto: 'falta escribir', tono: 'falta' }
}

const palabras = (t: string | null) => (t?.trim() ? t.trim().split(/\s+/).length : 0)

/**
 * Junta › Informe anual: los textos que se escriben a mano (presentación,
 * epílogo, nota de patrimonio y fecha del cabildo) y el PDF. El resto del
 * Informe sale solo de las cifras del año. Se guarda solo mientras se escribe.
 *
 * El definitivo espera a la presentación y al epílogo; el borrador sale
 * siempre, con lo que falta a la vista.
 */
export default function InformeAnualPage() {
  const { anio: anioRuta } = useParams()
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.cms?.role)
  const actual = new Date().getFullYear()
  const anio = anioRuta && /^\d{4}$/.test(anioRuta) ? Number(anioRuta) : anioPorDefecto()
  const cliente = useQueryClient()
  const { referencia, alto } = useAltoDisponible()
  const clave = ['informe-anual', anio]
  const { activos, activo: moduloActivo } = useModulos()
  const capitulos = capitulosVisibles(activos ?? new Set())

  const { data, isPending, isError } = useQuery({ queryKey: clave, queryFn: () => traerInformeAnual(anio) })

  const [textos, setTextos] = useState<TextosInforme | null>(null)
  const pendientes = useRef<Partial<TextosInforme>>({})
  // Lo mismo que «hay algo en `pendientes`», en estado: el aviso de «Guardando…»
  // se pinta con esto, y un ref leído al pintar no avisa a React de que cambia.
  const [hayPendientes, setHayPendientes] = useState(false)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [elegido, setElegido] = useState<Exclude<ClaveCapitulo, 'datos'>>(role === 'SECRETARIA' ? 'epilogo' : 'presentacion')

  // Lo escrito en pantalla se carga una vez por año: después manda lo que se
  // teclea. Si se recargara con cada guardado, borraría lo que llega mientras.
  // Se ajusta al pintar y no en un efecto: así no hay una vuelta con los textos
  // del año anterior en pantalla.
  const [cargado, setCargado] = useState<number | null>(null)
  if (data && data.anio === anio && cargado !== anio) {
    setCargado(anio)
    setTextos(data.textos)
  }

  const guardar = useMutation({
    // El año viaja con los cambios: lo pendiente al cambiar de año es del anterior.
    mutationFn: ({ deAnio, cambios }: { deAnio: number; cambios: Partial<TextosInforme> }) => guardarInformeAnual(deAnio, cambios),
    onSuccess: (respuesta, { deAnio }) => cliente.setQueryData<InformeAnualResponse>(['informe-anual', deAnio], (antes) => (antes ? { ...antes, faltan: respuesta.faltan, actualizada: respuesta.actualizada } : respuesta)),
  })

  const { mutateAsync: guardarCambios } = guardar
  const volcar = useCallback((deAnio: number) => {
    if (reloj.current) clearTimeout(reloj.current)
    reloj.current = null
    const cambios = pendientes.current
    pendientes.current = {}
    setHayPendientes(false)
    if (Object.keys(cambios).length) return guardarCambios({ deAnio, cambios })
    return Promise.resolve()
  }, [guardarCambios])
  // Lo que quede por guardar al salir de la pantalla o cambiar de año, se
  // guarda en el año en que se escribió.
  useEffect(() => () => { void volcar(anio) }, [anio, volcar])

  const escribir = (campo: CampoInforme, valor: string) => {
    setTextos((t) => (t ? { ...t, [campo]: valor } : t))
    pendientes.current = { ...pendientes.current, [campo]: valor }
    setHayPendientes(true)
    if (reloj.current) clearTimeout(reloj.current)
    reloj.current = setTimeout(() => { void volcar(anio) }, ESPERA_GUARDADO)
  }

  const pdf = useMutation({
    mutationFn: async (borrador: boolean) => {
      // El borrador se abre en otra pestaña: se abre ya, antes de esperar al
      // servidor, porque el navegador bloquea las ventanas que no nacen de un clic.
      const ventana = borrador ? window.open('', '_blank') : null
      try {
        await volcar(anio)
        const archivo = await traerInformeAnualPdf(anio, borrador)
        if (ventana) ventana.location.href = URL.createObjectURL(archivo.blob)
        else guardarEnDisco(archivo, `informe-anual-${anio}.pdf`)
      } catch (e) {
        ventana?.close()
        throw e
      }
    },
  })

  if (isPending || ((!textos || cargado !== anio) && !isError)) return <CircularProgress aria-label="Cargando el Informe anual" />
  if (isError || !data || !textos) return <Alert severity="error">No se ha podido cargar el Informe anual. Inténtalo de nuevo en unos minutos.</Alert>

  const faltan = data.faltan
  const avisoFalta = faltan.length === 2 ? 'Faltan la presentación y el epílogo' : faltan[0] === 'presentacion' ? 'Falta la presentación' : faltan[0] === 'epilogo' ? 'Falta el epílogo' : null
  const anios = Array.from({ length: 6 }, (_, i) => actual - i)
  // Si se apaga el Inventario con Patrimonio elegido, ese capítulo ya no está en la lista: se enseña la Presentación.
  const elegidoEfectivo = elegido === 'patrimonio' && !moduloActivo('inventario') ? 'presentacion' : elegido
  const campos = CAMPOS[elegidoEfectivo]
  // El texto largo llena el hueco: tantas filas como quepan bajo los campos cortos.
  const cortos = campos.filter((c) => !c.largo).length
  const filasDelTexto = Math.min(26, Math.max(6, Math.floor(((alto ?? 700) - 250 - (cortos ? 64 : 0)) / 25.5)))
  const estadoGuardado = guardar.isPending || hayPendientes ? 'Guardando…' : guardar.isError ? `No se ha guardado: ${guardar.error.message}` : guardar.isSuccess || data.actualizada ? 'Guardado' : ''

  const campo = (c: (typeof campos)[number]) => (
    <TextField
      key={c.campo}
      label={c.etiqueta}
      value={textos[c.campo] ?? ''}
      onChange={(e) => escribir(c.campo, e.target.value)}
      disabled={!puedeEscribir(role, c.campo)}
      multiline={c.largo}
      minRows={c.largo ? filasDelTexto : undefined}
      maxRows={c.largo ? filasDelTexto : undefined}
      helperText={c.ayuda ?? (c.largo ? 'Una línea en blanco separa los párrafos. Se guarda solo.' : undefined)}
      slotProps={{ htmlInput: { maxLength: c.largo ? 20000 : 120 } }}
      sx={c.largo ? { '& textarea': { fontFamily: SERIF.fontFamily, fontSize: 17, lineHeight: 1.5 } } : undefined}
    />
  )

  return (
    <Box
      ref={referencia}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: { md: alto ? `${Math.max(alto - 32, 460)}px` : 'auto' }, '& > *': { flexShrink: 0 } }}
    >
      <Helmet><title>{`Informe anual ${anio} | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box component="span" sx={{ ...VERSALITAS, fontSize: 10.5 }}>
            {role === 'SECRETARIA' ? 'Junta' : <Box component={Link} to={`/cms/datos?anio=${anio}`} sx={{ color: ORO, textDecoration: 'none' }}>Datos e informes</Box>} › Informe anual
          </Box>
          <Typography component="h1" sx={{ ...SERIF, fontSize: 'clamp(26px, 4.4vh, 32px)', lineHeight: 1.05 }}>{`Informe anual ${anio}`}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
          <TextField select size="small" label="Año" value={anio} onChange={(e) => { void volcar(anio); navigate(`/cms/informe-anual/${e.target.value}`) }} sx={{ minWidth: 150 }}>
            {anios.map((a) => <MenuItem key={a} value={a}>{a}{a === actual ? ' (en marcha)' : ''}</MenuItem>)}
          </TextField>
          <Button variant="outlined" disabled={pdf.isPending} onClick={() => pdf.mutate(true)}>Ver borrador</Button>
          <Box component="span" title={avisoFalta ? `${avisoFalta}: mientras, «Ver borrador».` : undefined}>
            <Button variant="contained" disabled={faltan.length > 0 || pdf.isPending} onClick={() => pdf.mutate(false)} startIcon={pdf.isPending ? <CircularProgress size={14} /> : undefined}>
              Generar PDF
            </Button>
          </Box>
        </Box>
      </Box>

      {pdf.isError && <Alert severity="error" onClose={() => pdf.reset()}>{pdf.error.message}</Alert>}

      <Box sx={{ flex: { md: '1 1 0 !important' }, minHeight: 0, display: 'grid', gap: 1.75, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(260px, 360px) minmax(0, 1fr)' }, gridTemplateRows: { md: 'minmax(0, 1fr)' } }}>
        <Box component="nav" aria-label="Capítulos del Informe anual" sx={{ minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: '1px', p: 1, borderRadius: 2.5, border: `1px solid ${FILETE}` }}>
          <Box component="span" sx={{ ...VERSALITAS, fontSize: 10.5, px: 1.5, pb: 0.75 }}>Capítulos</Box>
          {capitulos.map((cap) => {
            const estado = estadoDe(cap, textos)
            const editable = cap.clave !== 'datos'
            const activo = editable && cap.clave === elegidoEfectivo
            const contenido = (
              <>
                <Box component="span" sx={{ ...SERIF, fontSize: 16, color: 'primary.main', width: 30, flexShrink: 0 }}>{cap.numero}</Box>
                <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: activo ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cap.titulo}</Box>
                <Box component="span" sx={{ fontSize: 11.5, whiteSpace: 'nowrap', color: estado.tono === 'falta' ? ROSA_URGENTE : activo ? ORO : 'text.secondary' }}>{estado.texto}</Box>
              </>
            )
            const estilo = {
              display: 'flex', alignItems: 'baseline', gap: 1, px: 1.5, py: 'clamp(3px, 0.9vh, 8px)', borderRadius: 1.5, textAlign: 'left', width: '100%',
              ...(activo && { backgroundColor: `color-mix(in srgb, ${ORO} 9%, transparent)`, boxShadow: `inset 2px 0 0 ${ORO}` }),
            } as const
            return editable ? (
              <Box
                key={cap.titulo}
                component="button"
                type="button"
                aria-current={activo ? 'true' : undefined}
                onClick={() => setElegido(cap.clave as Exclude<ClaveCapitulo, 'datos'>)}
                sx={{ ...estilo, border: 0, background: 'none', fontFamily: 'inherit', color: 'text.primary', cursor: 'pointer', '&:hover': { backgroundColor: `color-mix(in srgb, ${ORO} 6%, transparent)` }, '&:focus-visible': { outline: `2px solid ${ORO}`, outlineOffset: -2 } }}
              >
                {contenido}
              </Box>
            ) : (
              <Box key={cap.titulo} sx={{ ...estilo, color: 'text.secondary' }}>{contenido}</Box>
            )
          })}
        </Box>

        <Box component="section" aria-label={TITULO_EDITOR[elegidoEfectivo]} sx={{ minWidth: 0, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: 1.5, px: 'clamp(14px, 2vw, 22px)', py: 1.75, borderRadius: 2.5, border: `1px solid ${FILETE}`, backgroundColor: FONDO_PIEZA }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
            <Typography component="h2" sx={{ ...SERIF, fontSize: 22 }}>{TITULO_EDITOR[elegidoEfectivo]}</Typography>
            <Typography aria-live="polite" sx={{ fontSize: 12.5, color: guardar.isError ? ROSA_URGENTE : 'text.secondary' }}>
              {[campos[0].largo ? `${palabras(textos[campos[0].campo])} palabras` : '', estadoGuardado].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          {!campos.some((c) => puedeEscribir(role, c.campo)) && (
            <Alert severity="info">{elegidoEfectivo === 'epilogo' ? 'El epílogo lo escribe Secretaría, o el Hermano Mayor.' : 'Esta parte la escriben el Hermano Mayor o Administración.'}</Alert>
          )}
          {campos.filter((c) => c.largo).map(campo)}
          {campos.some((c) => !c.largo) && (
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
              {campos.filter((c) => !c.largo).map(campo)}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
