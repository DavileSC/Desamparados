import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../altas/auth/store'
import { sabadoDePasion } from '../../../domain/sabadoDePasion'
import {
  guardarEnDisco, guardarMemoria, traerMemoria, traerMemoriaPdf,
  type CampoMemoria, type MemoriaResponse, type TextosMemoria,
} from '../../../lib/api/datos'
import { FILETE, FONDO_PIEZA, ORO, ROSA_URGENTE, SERIF, VERSALITAS } from '../inicio/estiloRetablo'
import { useAltoDisponible } from '../inicio/useAltoDisponible'

/** El curso en marcha, por el año en que empezó (el día después de su Sábado de Pasión). */
export function cursoDeHoy(hoy = new Date()): number {
  const anio = hoy.getFullYear()
  const sabado = sabadoDePasion(anio)
  const despues = new Date(sabado.getFullYear(), sabado.getMonth(), sabado.getDate() + 1)
  return hoy >= despues ? anio : anio - 1
}

/** Lo que escribe cada cargo: igual que `puedeEscribir` del backend. */
export function puedeEscribir(role: string | undefined, campo: CampoMemoria): boolean {
  if (role === 'ADMIN' || role === 'HERMANO_MAYOR') return true
  return role === 'SECRETARIA' && (campo === 'epilogo' || campo === 'firmaEpilogo')
}

type ClaveCapitulo = 'portada' | 'presentacion' | 'patrimonio' | 'epilogo' | 'datos'

interface Capitulo { numero: string; titulo: string; clave: ClaveCapitulo }

const CAPITULOS: Capitulo[] = [
  { numero: '', titulo: 'Portada', clave: 'portada' },
  { numero: 'I', titulo: 'Presentación del Hermano Mayor', clave: 'presentacion' },
  { numero: 'II', titulo: 'El curso de un vistazo', clave: 'datos' },
  { numero: 'III', titulo: 'Cultos y actos', clave: 'datos' },
  { numero: 'IV', titulo: 'Hermanos', clave: 'datos' },
  { numero: 'V', titulo: 'Sábado de Pasión y Rosario', clave: 'datos' },
  { numero: 'VI', titulo: 'Cuentas', clave: 'datos' },
  { numero: 'VII', titulo: 'Patrimonio', clave: 'patrimonio' },
  { numero: 'VIII', titulo: 'Comunicación', clave: 'datos' },
  { numero: '·', titulo: 'Epílogo del Secretario', clave: 'epilogo' },
]

/** Los campos que se escriben en cada capítulo: el primero es el texto largo. */
const CAMPOS: Record<Exclude<ClaveCapitulo, 'datos'>, { campo: CampoMemoria; etiqueta: string; largo?: boolean; ayuda?: string }[]> = {
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

function estadoDe(cap: Capitulo, textos: TextosMemoria): { texto: string; tono: 'ok' | 'falta' | 'hecho' } {
  if (cap.clave === 'datos') return { texto: 'de los datos', tono: 'ok' }
  if (cap.clave === 'portada') return { texto: textos.fechaCabildo ? 'con fecha del cabildo' : 'de los datos', tono: 'ok' }
  if (cap.clave === 'patrimonio') return { texto: textos.notaPatrimonio ? 'datos y nota' : 'datos + nota opcional', tono: 'ok' }
  const escrito = cap.clave === 'presentacion' ? textos.presentacion : textos.epilogo
  return escrito ? { texto: 'escrito', tono: 'hecho' } : { texto: 'falta escribir', tono: 'falta' }
}

const palabras = (t: string | null) => (t?.trim() ? t.trim().split(/\s+/).length : 0)

/**
 * Junta › Memoria del curso: los textos que se escriben a mano (presentación,
 * epílogo, nota de patrimonio y fecha del cabildo) y el PDF. El resto de la
 * Memoria sale solo de las cifras. Se guarda sola mientras se escribe.
 *
 * La definitiva espera a la presentación y al epílogo; el borrador sale
 * siempre, con lo que falta a la vista.
 */
export default function MemoriaPage() {
  const { curso: cursoRuta } = useParams()
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.cms?.role)
  const hoy = cursoDeHoy()
  const curso = cursoRuta && /^\d{4}$/.test(cursoRuta) ? Number(cursoRuta) : hoy - 1
  const cliente = useQueryClient()
  const { referencia, alto } = useAltoDisponible()
  const clave = ['memoria', curso]

  const { data, isPending, isError } = useQuery({ queryKey: clave, queryFn: () => traerMemoria(curso) })

  const [textos, setTextos] = useState<TextosMemoria | null>(null)
  const pendientes = useRef<Partial<TextosMemoria>>({})
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [elegido, setElegido] = useState<Exclude<ClaveCapitulo, 'datos'>>(role === 'SECRETARIA' ? 'epilogo' : 'presentacion')

  // Lo escrito en pantalla se carga una vez por curso: después manda lo que se
  // teclea. Si se recargara con cada guardado, borraría lo que llega mientras.
  const cargado = useRef<number | null>(null)
  useEffect(() => {
    if (data && data.curso === curso && cargado.current !== curso) {
      cargado.current = curso
      setTextos(data.textos)
    }
  }, [data, curso])

  const guardar = useMutation({
    mutationFn: (cambios: Partial<TextosMemoria>) => guardarMemoria(curso, cambios),
    onSuccess: (respuesta) => cliente.setQueryData<MemoriaResponse>(clave, (antes) => (antes ? { ...antes, faltan: respuesta.faltan, actualizada: respuesta.actualizada } : respuesta)),
  })

  const volcar = () => {
    if (reloj.current) clearTimeout(reloj.current)
    reloj.current = null
    const cambios = pendientes.current
    pendientes.current = {}
    if (Object.keys(cambios).length) return guardar.mutateAsync(cambios)
    return Promise.resolve()
  }
  // Lo que quede por guardar al salir de la pantalla, se guarda.
  useEffect(() => () => { void volcar() }, [curso])

  const escribir = (campo: CampoMemoria, valor: string) => {
    setTextos((t) => (t ? { ...t, [campo]: valor } : t))
    pendientes.current = { ...pendientes.current, [campo]: valor }
    if (reloj.current) clearTimeout(reloj.current)
    reloj.current = setTimeout(() => { void volcar() }, ESPERA_GUARDADO)
  }

  const pdf = useMutation({
    mutationFn: async (borrador: boolean) => {
      // El borrador se abre en otra pestaña: se abre ya, antes de esperar al
      // servidor, porque el navegador bloquea las ventanas que no nacen de un clic.
      const ventana = borrador ? window.open('', '_blank') : null
      try {
        await volcar()
        const archivo = await traerMemoriaPdf(curso, borrador)
        if (ventana) ventana.location.href = URL.createObjectURL(archivo.blob)
        else guardarEnDisco(archivo, `memoria-del-curso-${curso}-${curso + 1}.pdf`)
      } catch (e) {
        ventana?.close()
        throw e
      }
    },
  })

  if (isPending || ((!textos || cargado.current !== curso) && !isError)) return <CircularProgress aria-label="Cargando la Memoria" />
  if (isError || !data || !textos) return <Alert severity="error">No se ha podido cargar la Memoria. Inténtalo de nuevo en unos minutos.</Alert>

  const faltan = data.faltan
  const avisoFalta = faltan.length === 2 ? 'Faltan la presentación y el epílogo' : faltan[0] === 'presentacion' ? 'Falta la presentación' : faltan[0] === 'epilogo' ? 'Falta el epílogo' : null
  const cursos = Array.from({ length: 6 }, (_, i) => hoy - i)
  const campos = CAMPOS[elegido]
  // El texto largo llena el hueco: tantas filas como quepan bajo los campos cortos.
  const cortos = campos.filter((c) => !c.largo).length
  const filasDelTexto = Math.min(26, Math.max(6, Math.floor(((alto ?? 700) - 250 - (cortos ? 64 : 0)) / 25.5)))
  const estadoGuardado = guardar.isPending || Object.keys(pendientes.current).length ? 'Guardando…' : guardar.isError ? `No se ha guardado: ${guardar.error.message}` : guardar.isSuccess || data.actualizada ? 'Guardado' : ''

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
      <Helmet><title>{`Memoria del curso ${curso}–${curso + 1} | CMS Desamparados`}</title><meta name="robots" content="noindex" /></Helmet>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box component="span" sx={{ ...VERSALITAS, fontSize: 10.5 }}>
            {role === 'SECRETARIA' ? 'Junta' : <Box component={Link} to={`/cms/datos?periodo=curso-${curso}`} sx={{ color: ORO, textDecoration: 'none' }}>Datos e informes</Box>} › Memoria
          </Box>
          <Typography component="h1" sx={{ ...SERIF, fontSize: 'clamp(26px, 4.4vh, 32px)', lineHeight: 1.05 }}>{`Memoria del curso ${curso}–${curso + 1}`}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
          <TextField select size="small" label="Curso" value={curso} onChange={(e) => { void volcar(); navigate(`/cms/memoria/${e.target.value}`) }} sx={{ minWidth: 150 }}>
            {cursos.map((c) => <MenuItem key={c} value={c}>{`${c}–${c + 1}`}{c === hoy ? ' (en marcha)' : ''}</MenuItem>)}
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
        <Box component="nav" aria-label="Capítulos de la Memoria" sx={{ minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: '1px', p: 1, borderRadius: 2.5, border: `1px solid ${FILETE}` }}>
          <Box component="span" sx={{ ...VERSALITAS, fontSize: 10.5, px: 1.5, pb: 0.75 }}>Capítulos</Box>
          {CAPITULOS.map((cap) => {
            const estado = estadoDe(cap, textos)
            const editable = cap.clave !== 'datos'
            const activo = editable && cap.clave === elegido
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

        <Box component="section" aria-label={TITULO_EDITOR[elegido]} sx={{ minWidth: 0, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: 1.5, px: 'clamp(14px, 2vw, 22px)', py: 1.75, borderRadius: 2.5, border: `1px solid ${FILETE}`, backgroundColor: FONDO_PIEZA }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
            <Typography component="h2" sx={{ ...SERIF, fontSize: 22 }}>{TITULO_EDITOR[elegido]}</Typography>
            <Typography aria-live="polite" sx={{ fontSize: 12.5, color: guardar.isError ? ROSA_URGENTE : 'text.secondary' }}>
              {[campos[0].largo ? `${palabras(textos[campos[0].campo])} palabras` : '', estadoGuardado].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          {!campos.some((c) => puedeEscribir(role, c.campo)) && (
            <Alert severity="info">{elegido === 'epilogo' ? 'El epílogo lo escribe Secretaría, o el Hermano Mayor.' : 'Esta parte la escriben el Hermano Mayor o Administración.'}</Alert>
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
