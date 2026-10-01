import { useEffect, useRef, useState } from 'react'
import { Box, ButtonBase, CircularProgress, InputAdornment, Stack, TextField, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import {
  buscarPersonas, esperadosHoy, type Esperado, type PersonaEncontrada, type ZonaDeBusqueda,
} from '../../../lib/api/mesa'
import Pildora from '../listados/Pildora'
import { fechaCorta } from './formato'

interface Props {
  etiqueta?: string
  onElegir: (persona: { id: number; nombre: string; apellidos: string }) => void
  /** Qué busca la zona: Inscripción no ve a los ya apuntados; Túnicas, solo a los que no han recogido. */
  zona?: ZonaDeBusqueda
  /** El slug de la salida: «apuntado» y los esperados de hoy son de esa salida. */
  salida: string
  /** Con la lista de quién pidió día para hoy mientras no se escribe nada. */
  conEsperados?: boolean
  autoFocus?: boolean
  /** El id del campo, para llevarle el foco con el teclado (F2). */
  id?: string
}

const ESPERA_MS = 250

/**
 * Buscar a una persona en el censo, como el panel de la hoja: por nombre,
 * apellidos, DNI, teléfono, correo o número, y con la fecha de nacimiento al
 * lado para distinguir a dos que se llaman igual. Hecho para ir rápido:
 * Enter elige el primero, las flechas se mueven por la lista.
 */
export default function BuscadorPersonas({
  etiqueta = 'Buscar en el censo', onElegir, zona = 'todas', salida, conEsperados, autoFocus, id,
}: Props) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<PersonaEncontrada[] | null>(null)
  const [esperados, setEsperados] = useState<Esperado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(false)
  const [marcado, setMarcado] = useState(0)
  const lista = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!conEsperados) return
    let cancelado = false
    esperadosHoy(salida).then((e) => { if (!cancelado) setEsperados(e) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [conEsperados, salida])

  useEffect(() => {
    const q = texto.trim()
    if (q.length < 2) { setResultados(null); setBuscando(false); return }
    let cancelado = false
    setBuscando(true)
    const espera = window.setTimeout(() => {
      buscarPersonas(q, salida, zona)
        .then((r) => { if (!cancelado) { setResultados(r); setMarcado(0); setError(false) } })
        .catch(() => { if (!cancelado) setError(true) })
        .finally(() => { if (!cancelado) setBuscando(false) })
    }, ESPERA_MS)
    return () => { cancelado = true; window.clearTimeout(espera) }
  }, [texto, zona, salida])

  const visibles: { id: number; nombre: string; apellidos: string; fechaNacimiento: string }[] = resultados ?? (conEsperados ? esperados : [])
  const elegir = (p: { id: number; nombre: string; apellidos: string }) => { onElegir(p); setTexto('') }

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && visibles[marcado]) { e.preventDefault(); elegir(visibles[marcado]) }
    if (e.key === 'ArrowDown') { e.preventDefault(); setMarcado((m) => Math.min(m + 1, visibles.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setMarcado((m) => Math.max(m - 1, 0)) }
  }

  const fila = (p: { id: number; nombre: string; apellidos: string; fechaNacimiento: string }, indice: number, extra?: React.ReactNode, clave?: number) => (
    <Box role="listitem" key={clave ?? p.id}>
      <ButtonBase
        onClick={() => elegir(p)}
        onMouseEnter={() => setMarcado(indice)}
        sx={{
          width: '100%', justifyContent: 'space-between', gap: 1, textAlign: 'left', px: 1.25, py: 1, borderRadius: 1,
          backgroundColor: indice === marcado ? 'action.selected' : undefined,
          '&:hover, &:focus-visible': { backgroundColor: 'action.hover' },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14.5 }}>{p.nombre} {p.apellidos}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fechaCorta(p.fechaNacimiento)}</Typography>
        </Box>
        {extra}
      </ButtonBase>
    </Box>
  )

  return (
    <Stack spacing={1}>
      <TextField
        size="small"
        fullWidth
        id={id}
        label={etiqueta}
        placeholder="Nombre, apellidos, DNI, teléfono o n.º"
        value={texto}
        autoFocus={autoFocus}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={alTeclear}
        slotProps={{
          input: {
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            endAdornment: buscando ? <InputAdornment position="end"><CircularProgress size={16} aria-label="Buscando" /></InputAdornment> : undefined,
          },
          htmlInput: { autoComplete: 'off' },
        }}
      />

      {error && <Typography variant="body2" color="error">No se ha podido buscar. Vuelve a intentarlo.</Typography>}

      {resultados && (
        <Box role="list" aria-label="Resultados de la búsqueda" ref={lista}>
          {resultados.length === 0 && !buscando && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 1.25, py: 1 }}>
              {zona === 'inscripcion' ? `Nadie sin apuntar con «${texto.trim()}».`
                : zona === 'tunicas' ? `Nadie con «${texto.trim()}» pendiente de recoger.`
                  : zona === 'devolucion' ? `Nadie con «${texto.trim()}» que tenga ropa sin devolver.`
                    : `Nadie con «${texto.trim()}» en el censo.`}
            </Typography>
          )}
          {resultados.map((p, i) => fila(p, i, (
            <Stack spacing={0.5} sx={{ alignItems: 'flex-end', flexShrink: 0 }}>
              {p.apuntado && <Pildora texto={p.apuntado.recogida ? `Recogida · ${p.apuntado.puesto}` : `Apuntado · ${p.apuntado.puesto}`} tono={p.apuntado.recogida ? 'neutro' : 'ok'} />}
              {p.situacion === 'baja' && <Pildora texto="De baja" tono="neutro" />}
              {p.situacion === 'pendiente' && <Pildora texto="Alta pendiente" tono="aviso" />}
            </Stack>
          )))}
        </Box>
      )}

      {!resultados && conEsperados && esperados.length > 0 && (
        <Box role="list" aria-label="Vienen hoy">
          <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', px: 1.25, pt: 1 }}>
            Pidieron hoy · {esperados.length}
          </Typography>
          {esperados.map((p, i) => fila(p, i, <Pildora texto="Con cita" tono="info" />, p.citaId))}
        </Box>
      )}
    </Stack>
  )
}
