import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useTemaCms } from '../../../app/useTemaCms'
import type { ApiEvent } from '../../../lib/api/agenda'
import AccionesActo from './AccionesActo'
import PuntoTipo from './PuntoTipo'
import { rejillaEvento } from './rejilla'
import { diaDelMes, diaSemana, hora, finEnOtroDia, loQueFalta } from './fechas'

interface Props {
  evento: ApiEvent
  /** Sale ahora en la lista de la portada de la web. */
  enPortada: boolean
  /** La consulta del listado, para que la ficha devuelva a la misma página y filtros. */
  volver: string
  onBorrar: () => void
}

/**
 * Un acto de la agenda: el día como en la agenda de la portada, el título con
 * la hora y el lugar, el tipo, quién lo ve y las acciones. Avisa de lo que en
 * la web se nota: sin lugar, la línea bajo el título se queda en la hora; sin
 * descripción, al abrir el acto en la portada no sale nada.
 */
export default function FilaEvento({ evento, enPortada, volver, onBorrar }: Props) {
  const { superficies } = useTemaCms()
  const inicio = new Date(evento.startDate)
  const fin = finEnOtroDia(evento)
  const avisos = loQueFalta(evento)

  return (
    <Box component="li" sx={{ ...rejillaEvento, px: { xs: 2, md: 2.5 }, py: 1.5, borderTop: 1, borderColor: 'divider', listStyle: 'none' }}>
      {/* En el móvil la fila crece hacia abajo con el tipo y los botones: el día, arriba, junto al título. */}
      <Box sx={{ gridArea: 'dia', alignSelf: { xs: 'start', md: 'center' }, pt: { xs: 0.25, md: 0 }, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        <Box sx={{ fontSize: fin ? 16 : 24, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap', color: superficies.enlace }}>
          {fin ? `${diaDelMes(inicio)}–${diaDelMes(fin)}` : diaDelMes(inicio)}
        </Box>
        <Box sx={{ mt: 0.5, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {fin ? `${diaSemana(inicio)}–${diaSemana(fin)}` : diaSemana(inicio)}
        </Box>
      </Box>

      <Box sx={{ gridArea: 'texto', minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Typography component="h3" sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{evento.title}</Typography>
          {enPortada && <EnPortada />}
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[hora(inicio), evento.location?.trim()].filter(Boolean).join(' · ')}
        </Typography>
        {avisos.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25, flexWrap: 'wrap' }}>
            {avisos.map((texto) => <Aviso key={texto}>{texto}</Aviso>)}
          </Box>
        )}
        {/* En el móvil no hay columna de tipo: va aquí. */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mt: 0.75, flexWrap: 'wrap' }}>
          <PuntoTipo tipo={evento.type} />
        </Box>
      </Box>

      <Box sx={{ gridArea: 'tipo', display: { xs: 'none', md: 'block' } }}><PuntoTipo tipo={evento.type} /></Box>

      <Box sx={{ gridArea: 'acciones', display: 'flex', gap: 0.5, justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center' }}>
        <AccionesActo evento={evento} volver={volver} onBorrar={onBorrar} />
      </Box>
    </Box>
  )
}

/** Sale ahora en la lista de la portada de la web. */
export function EnPortada() {
  const { superficies } = useTemaCms()
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12, fontWeight: 600, color: superficies.enlace, whiteSpace: 'nowrap', '& svg': { fontSize: 15, alignSelf: 'center' } }}>
      <HomeOutlinedIcon aria-hidden="true" />En portada
    </Box>
  )
}

export function Aviso({ children }: { children: ReactNode }) {
  const { superficies } = useTemaCms()
  return (
    <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: superficies.avisoTexto, fontWeight: 500, '& svg': { fontSize: 14 } }}>
      <WarningAmberIcon aria-hidden="true" />{children}
    </Typography>
  )
}
