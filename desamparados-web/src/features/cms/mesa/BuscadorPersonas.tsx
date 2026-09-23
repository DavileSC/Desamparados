import { useEffect, useState } from 'react'
import { Box, ButtonBase, CircularProgress, InputAdornment, Stack, TextField, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { buscarPersonas, esperadosHoy, type Esperado, type PersonaEncontrada } from '../../../lib/api/mesa'
import Pildora from '../listados/Pildora'
import { fechaCorta } from './formato'

interface Props {
  etiqueta?: string
  onElegir: (persona: { id: number; nombre: string; apellidos: string }) => void
  /** Sin la lista de quién viene hoy (para buscar al tutor de un menor). */
  sinEsperados?: boolean
  autoFocus?: boolean
}

const ESPERA_MS = 300

/**
 * Buscar a una persona en el censo, como el panel de la hoja: por nombre,
 * apellidos, DNI, teléfono, correo o número, y con la fecha de nacimiento al
 * lado para distinguir a dos que se llaman igual. Sin escribir nada, salen
 * quienes pidieron día para hoy.
 */
export default function BuscadorPersonas({ etiqueta = 'Buscar en el censo', onElegir, sinEsperados, autoFocus }: Props) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<PersonaEncontrada[] | null>(null)
  const [esperados, setEsperados] = useState<Esperado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (sinEsperados) return
    let cancelado = false
    esperadosHoy().then((e) => { if (!cancelado) setEsperados(e) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [sinEsperados])

  useEffect(() => {
    const q = texto.trim()
    if (q.length < 2) { setResultados(null); setBuscando(false); return }
    let cancelado = false
    setBuscando(true)
    const espera = window.setTimeout(() => {
      buscarPersonas(q)
        .then((r) => { if (!cancelado) { setResultados(r); setError(false) } })
        .catch(() => { if (!cancelado) setError(true) })
        .finally(() => { if (!cancelado) setBuscando(false) })
    }, ESPERA_MS)
    return () => { cancelado = true; window.clearTimeout(espera) }
  }, [texto])

  const fila = (p: { id: number; nombre: string; apellidos: string; fechaNacimiento: string }, extra?: React.ReactNode) => (
    <ButtonBase
      key={p.id}
      onClick={() => onElegir(p)}
      sx={{
        width: '100%', justifyContent: 'space-between', gap: 1, textAlign: 'left', px: 1.25, py: 1, borderRadius: 1,
        '&:hover, &:focus-visible': { backgroundColor: 'action.hover' },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14.5 }}>{p.nombre} {p.apellidos}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fechaCorta(p.fechaNacimiento)}</Typography>
      </Box>
      {extra}
    </ButtonBase>
  )

  return (
    <Stack spacing={1}>
      <TextField
        size="small"
        fullWidth
        label={etiqueta}
        placeholder="Nombre, apellidos, DNI, teléfono o n.º"
        value={texto}
        autoFocus={autoFocus}
        onChange={(e) => setTexto(e.target.value)}
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
        <Box role="list" aria-label="Resultados de la búsqueda">
          {resultados.length === 0 && !buscando && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 1.25, py: 1 }}>Nadie con «{texto.trim()}» en el censo.</Typography>
          )}
          {resultados.map((p) => (
            <Box role="listitem" key={p.id}>
              {fila(p, (
                <Stack spacing={0.5} sx={{ alignItems: 'flex-end', flexShrink: 0 }}>
                  {p.papeleta && <Pildora texto={`Apuntado · ${p.papeleta.puesto}`} tono="ok" />}
                  {p.situacion === 'baja' && <Pildora texto="De baja" tono="neutro" />}
                  {p.situacion === 'pendiente' && <Pildora texto="Alta pendiente" tono="aviso" />}
                </Stack>
              ))}
            </Box>
          ))}
        </Box>
      )}

      {!resultados && !sinEsperados && esperados.length > 0 && (
        <Box role="list" aria-label="Vienen hoy">
          <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', px: 1.25, pt: 1 }}>
            Vienen hoy · {esperados.length}
          </Typography>
          {esperados.map((p) => <Box role="listitem" key={p.citaId}>{fila(p, <Pildora texto="Con cita" tono="info" />)}</Box>)}
        </Box>
      )}
    </Stack>
  )
}
