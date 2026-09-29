import { useEffect, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import CabeceraSeccion from './CabeceraSeccion'
import { guardarRetablo, traerRetablo, type Retablo } from '../../lib/api/panel'
import { subirImagenPublica } from '../../lib/api/subida'
import { CLAVE_PANEL_HOY } from '../../app/usePanelDeHoy'
import { FOTO_POR_DEFECTO } from './inicio/Retablo'
import { ORO_CLARO } from './inicio/estiloRetablo'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024
const DE_SIEMPRE: Retablo = { foto: null, x: 50, y: 30 }
const acotar = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

/** La foto recortada como en el Inicio: en columna (ordenador) o en franja (móvil). */
function Vista({ foto, x, y, forma }: { foto: string; x: number; y: number; forma: 'columna' | 'franja' }) {
  const columna = forma === 'columna'
  return (
    <Stack spacing={0.75} sx={{ minWidth: 0 }}>
      <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 1.5, backgroundColor: '#0b0a0c', ...(columna ? { width: 140, aspectRatio: '9 / 19' } : { width: '100%', maxWidth: 420, aspectRatio: '4 / 1' }) }}>
        <Box component="img" src={foto} alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${x}% ${y}%`, opacity: 0.85 }} />
        <Box sx={{ position: 'absolute', inset: 0, background: columna ? 'linear-gradient(180deg, rgba(18,16,19,0) 45%, #121013 100%)' : 'linear-gradient(90deg, rgba(18,16,19,.85), rgba(18,16,19,.1))' }} />
        <Typography component="span" sx={{ position: 'absolute', left: 12, bottom: 8, fontFamily: '"Cormorant Garamond", serif', fontSize: 30, lineHeight: 1, color: '#f7f1e8' }}>
          172 <Box component="em" sx={{ fontSize: 15, color: '#d8cfc6' }}>días</Box>
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">{columna ? 'En el ordenador' : 'En el móvil'}</Typography>
    </Stack>
  )
}

/**
 * Sistema › Ajustes del Inicio: la foto del retablo que ve toda la junta al
 * entrar al CMS. Se elige la foto y se pulsa sobre ella lo que nunca debe
 * cortarse (el rostro): en el ordenador el retablo es una columna alta y en el
 * móvil una franja baja, así que un encuadre solo vertical no bastaba. Con las
 * flechas del teclado también se mueve el punto.
 */
export default function AjustesInicioPage() {
  const cliente = useQueryClient()
  const { data, isPending, isError } = useQuery({ queryKey: ['panel', 'retablo'], queryFn: traerRetablo })
  const [retablo, setRetablo] = useState<Retablo>(DE_SIEMPRE)
  const [subiendo, setSubiendo] = useState(false)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)

  useEffect(() => { if (data) setRetablo(data) }, [data])

  const guardar = useMutation({
    mutationFn: () => guardarRetablo(retablo),
    onSuccess: async (guardado) => {
      setRetablo(guardado)
      cliente.setQueryData(['panel', 'retablo'], guardado)
      await cliente.invalidateQueries({ queryKey: CLAVE_PANEL_HOY })
    },
  })

  if (isPending) return <CircularProgress aria-label="Cargando los ajustes del Inicio" />
  if (isError) return <Alert severity="error">No se han podido cargar los ajustes del Inicio. Inténtalo de nuevo en unos minutos.</Alert>

  const foto = retablo.foto ?? FOTO_POR_DEFECTO
  const sinGuardar = JSON.stringify(retablo) !== JSON.stringify(data)
  const mover = (x: number, y: number) => { setRetablo((r) => ({ ...r, x: acotar(x), y: acotar(y) })); guardar.reset() }

  const pulsar = (e: MouseEvent<HTMLDivElement>) => {
    const caja = e.currentTarget.getBoundingClientRect()
    mover(((e.clientX - caja.left) / caja.width) * 100, ((e.clientY - caja.top) / caja.height) * 100)
  }
  const conTeclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const paso = e.shiftKey ? 10 : 2
    const cambio: Record<string, [number, number]> = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }
    const d = cambio[e.key]
    if (!d) return
    e.preventDefault()
    mover(retablo.x + d[0], retablo.y + d[1])
  }

  const elegir = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return
    setErrorFoto(null)
    if (!TIPOS.includes(archivo.type)) return setErrorFoto('La foto tiene que ser JPG, PNG o WebP.')
    if (archivo.size > MAX_BYTES) return setErrorFoto('La foto pesa más de 5 MB. Redúcela antes de subirla.')
    setSubiendo(true)
    try {
      const ruta = await subirImagenPublica(archivo)
      // Una foto nueva empieza con el punto en el centro, un poco arriba: donde suele estar el rostro.
      setRetablo({ foto: ruta, x: 50, y: 35 })
      guardar.reset()
    } catch (e: unknown) {
      setErrorFoto(e instanceof Error ? e.message : 'No se ha podido subir la foto.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <>
      <Helmet><title>Ajustes del Inicio | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Ajustes del Inicio" subtitulo="La foto del retablo que ve toda la junta al entrar al CMS." />
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 420px) minmax(0, 1fr)' } }}>
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Typography variant="h3" component="h2" sx={{ fontSize: 22 }}>Foto del retablo</Typography>
          <Typography id="punto-ayuda" variant="body2" color="text.secondary">
            Pulsa en la foto lo que nunca debe cortarse: se queda a la vista en el ordenador y en el móvil. También puedes moverlo con las flechas.
          </Typography>
          <Box
            role="slider"
            tabIndex={0}
            aria-label="Punto de la foto que no se recorta"
            aria-describedby="punto-ayuda"
            aria-valuetext={`${retablo.x} % desde la izquierda, ${retablo.y} % desde arriba`}
            aria-valuenow={retablo.x}
            aria-valuemin={0}
            aria-valuemax={100}
            onClick={pulsar}
            onKeyDown={conTeclas}
            sx={{ position: 'relative', borderRadius: 1.5, overflow: 'hidden', cursor: 'crosshair', backgroundColor: '#0b0a0c', '&:focus-visible': { outline: `2px solid ${ORO_CLARO}`, outlineOffset: 2 } }}
          >
            <Box component="img" src={foto} alt="Foto del retablo" sx={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none', pointerEvents: 'none' }} />
            <Box aria-hidden="true" sx={{ position: 'absolute', left: `${retablo.x}%`, top: `${retablo.y}%`, width: 34, height: 34, ml: '-17px', mt: '-17px', borderRadius: '50%', border: `2px solid ${ORO_CLARO}`, boxShadow: '0 0 0 3px rgba(0,0,0,.45)' }} />
          </Box>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button component="label" variant="outlined" disabled={subiendo} startIcon={subiendo ? <CircularProgress size={16} /> : undefined}>
              {subiendo ? 'Subiendo…' : 'Cambiar foto'}
              <Box component="input" type="file" accept={TIPOS.join(',')} onChange={elegir} sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }} />
            </Button>
            <Button variant="outlined" disabled={retablo.foto === null && retablo.x === DE_SIEMPRE.x && retablo.y === DE_SIEMPRE.y} onClick={() => { setRetablo(DE_SIEMPRE); guardar.reset() }}>
              Volver a la de siempre
            </Button>
          </Stack>
          {errorFoto && <Alert severity="error">{errorFoto}</Alert>}
        </Stack>

        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">Así se verá</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', gap: 2, alignItems: 'start' }}>
            <Vista foto={foto} x={retablo.x} y={retablo.y} forma="columna" />
            <Vista foto={foto} x={retablo.x} y={retablo.y} forma="franja" />
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {guardar.isError && <Alert severity="error">{guardar.error.message}</Alert>}
          {guardar.isSuccess && !sinGuardar && <Alert severity="success">Guardado: la junta ya la ve en el Inicio.</Alert>}
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button variant="contained" disabled={!sinGuardar || guardar.isPending || subiendo} onClick={() => guardar.mutate()}>
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </>
  )
}
