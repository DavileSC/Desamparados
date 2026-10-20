import { Box, ButtonBase, Paper, Typography } from '@mui/material'
import type { EnCola } from '../../../lib/api/mesa'
import Pildora from '../listados/Pildora'
import { euros, fechaCorta } from './formato'

interface Props {
  titulo: string
  vacia: string
  filas: EnCola[]
  seleccionado: number | null
  onElegir: (hermanoId: number) => void
}

/**
 * A quién espera esta zona ahora mismo, lo último arriba: Tesorería ve a
 * quien acaban de apuntar con algo por pagar; Túnicas, a quien acaba de
 * pagar o viene con todo al día. Se actualiza sola cuando otra zona termina.
 */
export default function ColaDeZona({ titulo, vacia, filas, seleccionado, onElegir }: Props) {
  return (
    <Paper component="section" aria-label={titulo} sx={{ p: 1.5 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', px: 1, pb: 1 }}>
        {titulo} · {filas.length}
      </Typography>
      {filas.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ px: 1, pb: 1 }}>{vacia}</Typography>}
      <Box role="list" sx={{ display: 'grid', gap: 0.25, maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto' }}>
        {filas.map((f) => (
          <Box role="listitem" key={f.solicitudId}>
            <ButtonBase
              onClick={() => onElegir(f.hermano.id)}
              sx={{
                width: '100%', justifyContent: 'space-between', gap: 1, textAlign: 'left', px: 1, py: 0.9, borderRadius: 1,
                backgroundColor: f.hermano.id === seleccionado ? 'action.selected' : undefined,
                '&:hover, &:focus-visible': { backgroundColor: 'action.hover' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14.5 }}>{f.hermano.nombre} {f.hermano.apellidos}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fechaCorta(f.hermano.fechaNacimiento)} · {f.puesto}
                </Typography>
              </Box>
              {f.puedeRecoger
                ? (f.conCitaHoy ? <Pildora texto="Con cita" tono="info" /> : <Pildora texto="Al día" tono="ok" />)
                : <Pildora texto={f.totalPendiente > 0 ? `Debe ${euros(f.totalPendiente)}` : 'Por revisar'} tono="aviso" />}
            </ButtonBase>
          </Box>
        ))}
      </Box>
    </Paper>
  )
}
