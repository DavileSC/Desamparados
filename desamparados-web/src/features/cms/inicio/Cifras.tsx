import { Box, Paper, Typography } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import { eurosResumen, fechaCorta, numero } from '../contabilidad/formato'
import { contar } from './plural'

function Cifra({ etiqueta, valor, pie }: { etiqueta: string; valor: string | number; pie: string }) {
  return (
    <Paper sx={{ p: 2.25, borderRadius: 1.75, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
        {etiqueta}
      </Typography>
      <Typography sx={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </Typography>
      <Typography variant="caption" color="text.secondary">{pie}</Typography>
    </Paper>
  )
}

/**
 * Las cuatro cifras de hoy. No las toca el selector de ejercicio: son cosas que
 * hacer ahora, y mezclarlas con un año cerrado despistaría.
 */
export default function Cifras({ panel }: { panel: PanelResponse }) {
  // REMESADO cuenta como «por cobrar»: es dinero ya enviado al banco en un
  // lote SEPA, pero todavía no está en la cuenta. «Cómo va el año» ya lo
  // sumaba en el mismo sentido; sin él aquí, esta cifra y esa tarjeta se
  // contradecían en la misma pantalla.
  const porCobrar = panel.dinero.porEstado
    .filter((e) => e.estado === 'PENDIENTE' || e.estado === 'REMESADO' || e.estado === 'DEVUELTO')
    .reduce((s, e) => ({ total: s.total + e.total, importe: s.importe + e.importe }), { total: 0, importe: 0 })
  const saldo = panel.dinero.ejercicio.saldo

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.75 }}>
        <Cifra
          etiqueta="Hermanos activos"
          valor={numero(panel.censo.activos)}
          pie={`+${numero(panel.censo.altas12m)} / −${numero(panel.censo.bajas12m)} en doce meses`}
        />
        <Cifra etiqueta={`Papeletas ${panel.procesion.anio}`} valor={numero(panel.procesion.papeletas)} pie="de sitio" />
        <Cifra
          etiqueta="Por cobrar"
          valor={eurosResumen(porCobrar.importe)}
          pie={contar(porCobrar.total, 'recibo', 'recibos')}
        />
        <Cifra
          etiqueta={`Saldo ${panel.dinero.ejercicio.anio}`}
          valor={eurosResumen(saldo)}
          pie={saldo >= 0 ? 'superávit' : 'déficit'}
        />
      </Box>

      {/* Venía de «Actividad del equipo», que se retiró con la auditoría: son
          dos números y una fecha, no un registro de quién hizo qué. */}
      <Typography variant="caption" color="text.secondary" sx={{ px: 0.25 }}>
        {contar(panel.actividad.noticias.publicadas, 'noticia publicada', 'noticias publicadas')} ·{' '}
        {contar(panel.actividad.publicaciones.total, 'publicación', 'publicaciones')}
        {panel.actividad.publicaciones.ultima && ` · última el ${fechaCorta(panel.actividad.publicaciones.ultima)}`}
      </Typography>
    </Box>
  )
}
