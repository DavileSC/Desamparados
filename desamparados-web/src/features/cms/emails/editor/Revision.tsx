import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import type { BloqueDeUso, VistaPrevia } from '../../../../lib/api/emails'
import { site } from '../../../../config/site'
import Repaso from './Repaso'

interface Props {
  previa: VistaPrevia | null
  asunto: string
  bloques: BloqueDeUso[]
  firma: string
  onProbar: () => void
  probando: boolean
}

/** El texto de la bandeja tal como lo pone el correo (el `data-resumen` del HTML), sin los caracteres de relleno. */
function resumenDelHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.querySelector('[data-resumen]')?.textContent ?? '').replace(/ |﻿|͏/g, '').trim()
}

const rotulo = (texto: string) => (
  <Typography component="h3" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'text.secondary', mb: 1.25 }}>{texto}</Typography>
)

/**
 * Antes de guardar: cómo se verá en la bandeja, qué falta o conviene mirar,
 * y el correo de verdad (el HTML que compone el servidor) en el ordenador y en
 * el móvil a la vez.
 */
export default function Revision({ previa, asunto, bloques, firma, onProbar, probando }: Props) {
  const resumen = previa ? resumenDelHtml(previa.html) : ''
  const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  return (
    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '380px minmax(0, 1fr)' }, alignItems: 'start' }}>
      <Stack spacing={3}>
        <Box>
          {rotulo('Así lo verá en su bandeja')}
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', gap: 1.5, p: 1.5, bgcolor: 'action.hover' }}>
              <Box aria-hidden sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', bgcolor: 'text.primary', color: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', fontSize: 17 }}>{firma.replace(/^(La|El|Los|Las)\s+/i, '').charAt(0)}</Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.nombreCorto}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{ahora}</Typography>
                </Stack>
                <Typography sx={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previa?.asunto || asunto || 'Sin asunto'}</Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumen}</Typography>
              </Box>
            </Box>
          </Paper>
        </Box>

        <Box>
          {rotulo('Repaso')}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Repaso previa={previa} asunto={asunto} bloques={bloques} amplio />
          </Paper>
        </Box>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Antes de guardarla, pruébala</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Te llega a tu correo con los datos de ejemplo, como le llegará a quien lo reciba.</Typography>
          <Button variant="outlined" onClick={onProbar} disabled={probando || !previa || previa.problemas.length > 0}>{probando ? 'Mandando…' : 'Mandarme una prueba'}</Button>
        </Paper>
      </Stack>

      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap', bgcolor: '#eeeae7', borderRadius: 2, p: { xs: 1.5, sm: 3 } }}>
        <Box sx={{ flex: '1 1 480px', minWidth: 0 }}>
          <Typography variant="body2" sx={{ mb: 1, color: '#4a454a' }}>En el ordenador</Typography>
          <Box component="iframe" title="El correo en el ordenador" sandbox="" srcDoc={previa?.html ?? ''} sx={{ width: '100%', height: 760, border: 0, bgcolor: '#eeeae7', display: 'block' }} />
        </Box>
        <Box sx={{ flex: '0 0 auto', mx: 'auto' }}>
          <Typography variant="body2" sx={{ mb: 1, color: '#4a454a' }}>En el móvil</Typography>
          <Box sx={{ width: 375, maxWidth: '100%', border: '10px solid #141111', borderRadius: '34px', overflow: 'hidden', bgcolor: '#eeeae7' }}>
            <Box component="iframe" title="El correo en el móvil" sandbox="" srcDoc={previa?.html ?? ''} sx={{ width: '100%', height: 740, border: 0, display: 'block' }} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
