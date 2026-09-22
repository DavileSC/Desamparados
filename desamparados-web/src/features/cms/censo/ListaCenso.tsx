import { Box, Paper, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { AdminBrother } from '../../../lib/api/hermanos'
import { useTonos } from '../listados/tonos'
import { SITUACION, situacionDe } from './situacion'

interface Props {
  hermanos: AdminBrother[]
  /** La ficha abierta a la derecha, marcada en la lista. */
  abierta: number | null
  /** La consulta con `ficha=<id>`: abrir una ficha no pierde la búsqueda, los filtros ni la página. */
  enlace: (id: number) => string
}

/**
 * La columna izquierda del censo: una fila por hermano, apellidos delante,
 * con su número, su DNI y un punto con la situación. Cada fila abre su ficha
 * a la derecha sin salir de la pantalla.
 */
export default function ListaCenso({ hermanos, abierta, enlace }: Props) {
  const { punto } = useTonos()
  return (
    <Paper component="ul" aria-label="Censo de hermanos" sx={{ m: 0, p: 0, listStyle: 'none', overflow: 'hidden' }}>
      {hermanos.map((h) => {
        const situacion = SITUACION[situacionDe(h)]
        const marcada = h.id === abierta
        return (
          <Box component="li" key={h.id} sx={{ '& + &': { borderTop: 1, borderColor: 'divider' } }}>
            <Box
              component={Link}
              to={{ search: enlace(h.id) }}
              aria-current={marcada ? 'true' : undefined}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 56, py: 1, pr: 2, pl: marcada ? 1.625 : 2,
                color: 'inherit', textDecoration: 'none',
                borderLeft: marcada ? 3 : 0, borderColor: 'secondary.main',
                backgroundColor: marcada ? 'action.selected' : 'transparent',
                '&:hover': { backgroundColor: marcada ? 'action.selected' : 'action.hover' },
                '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
              }}
            >
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography sx={{ fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <Box component="span" sx={{ fontWeight: 600 }}>{h.apellidos}</Box>
                  <Box component="span" sx={{ color: 'text.secondary' }}>, {h.nombre}</Box>
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                  {h.numeroHermano ? `N.º ${h.numeroHermano}` : 'Sin número'} · {h.dni ?? 'sin DNI'}
                </Typography>
              </Box>
              {/* El punto dice la situación a la vista; al lector de pantalla, con palabras. */}
              <Box component="span" aria-hidden="true" sx={{ flexShrink: 0, width: 9, height: 9, borderRadius: '50%', backgroundColor: punto[situacion.tono] }} />
              <Box component="span" sx={soloLector}>{situacion.texto}</Box>
            </Box>
          </Box>
        )
      })}
    </Paper>
  )
}

const soloLector = { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const
