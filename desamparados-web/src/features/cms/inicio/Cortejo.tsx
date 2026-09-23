import { Box, Paper, Typography } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import { useTemaCms } from '../../../app/useTemaCms'
import { MECER, fondoResplandor } from '../../../theme/resplandor'
import { numero } from '../contabilidad/formato'
import { CIFRA, encender, entrada, sinMovimiento } from './animaciones'

/** Puntos que caben con holgura en la pieza; por encima, cada punto vale por varios. */
const MAX_PUNTOS = 360
/** Lo que tarda en encenderse el cortejo entero, sea largo o corto. */
const DURACION_MS = 2200

/**
 * Las papeletas del año como el cortejo: un punto por hermano (o por cada
 * dos, tres… si son muchos), agrupados por puesto. Al entrar se encienden en
 * orden, como los cirios de una fila que se prenden uno tras otro.
 */
export default function Cortejo({ procesion, orden = 0 }: { procesion: PanelResponse['procesion']; orden?: number }) {
  const { modo, superficies } = useTemaCms()
  const puestos = procesion.porPuesto.filter((p) => p.total > 0)
  const total = puestos.reduce((s, p) => s + p.total, 0)
  const porPunto = Math.max(1, Math.ceil(total / MAX_PUNTOS))
  const puntos = puestos.reduce((s, p) => s + Math.ceil(p.total / porPunto), 0)
  const paso = puntos > 0 ? DURACION_MS / puntos : 0
  // Dónde empieza cada puesto en la cuenta de puntos, para encenderlos en orden.
  const inicios = puestos.map((_, i) => puestos.slice(0, i).reduce((s, p) => s + Math.ceil(p.total / porPunto), 0))

  return (
    <Paper component="section" aria-labelledby="cortejo" sx={{ ...fondoResplandor(modo, 'burdeos', superficies.card), borderRadius: 1.75, p: { xs: 2, md: 2.75 }, height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', ...entrada(orden, MECER) }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
        <Typography id="cortejo" variant="h5" component="h2">El cortejo de {procesion.anio}</Typography>
        <Typography variant="body2" color="text.secondary">
          {numero(procesion.papeletas)} papeletas{porPunto > 1 ? ` · cada punto, ${porPunto} hermanos` : ''}
        </Typography>
      </Box>

      {puestos.length === 0 ? (
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          Todavía no hay papeletas de sitio de {procesion.anio}.
        </Typography>
      ) : (
        <Box
          role="img"
          aria-label={`Papeletas por puesto: ${puestos.map((p) => `${p.etiqueta}, ${p.total}`).join('; ')}`}
          sx={{
            '--apagado': modo === 'oscuro' ? 'rgba(255,255,255,0.1)' : '#e4ded9',
            '--encendido': modo === 'oscuro' ? '#ffb3b4' : '#6e1822',
            display: 'flex', flexWrap: 'wrap', gap: { xs: 2, md: 3 }, alignItems: 'flex-end',
            // Centrado en lo que quede de alto: la pieza se estira a la altura de su vecina.
            my: 'auto', pt: 2.25,
            '& i': {
              width: 9, height: 9, borderRadius: '50%', backgroundColor: 'var(--encendido)',
              animation: `${encender} .35s ease-out backwards`, ...sinMovimiento,
            },
          }}
        >
          {puestos.map((puesto, i) => {
            const cuantos = Math.ceil(puesto.total / porPunto)
            const desde = inicios[i]
            return (
              <Box key={puesto.etiqueta} sx={{ display: 'grid', gap: 0.75, minWidth: 0 }}>
                <Box aria-hidden="true" sx={{ display: 'grid', gridAutoFlow: 'column', gridTemplateRows: 'repeat(10, 9px)', gap: '4px', justifyContent: 'start' }}>
                  {Array.from({ length: cuantos }, (_, k) => (
                    <i key={k} style={{ animationDelay: `${400 + (desde + k) * paso}ms` }} />
                  ))}
                </Box>
                <Box sx={{ maxWidth: 120 }}>
                  <Typography sx={{ ...CIFRA, fontSize: 17, lineHeight: 1.1 }}>{numero(puesto.total)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.25 }}>{puesto.etiqueta}</Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
    </Paper>
  )
}
