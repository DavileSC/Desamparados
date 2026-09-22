import { Box } from '@mui/material'
import { useTonos, type TonoPildora } from './tonos'

/** Una situación o un estado: punto de color sobre fondo suave, como «Publicada» en la redacción. */
export default function Pildora({ texto, tono }: { texto: string; tono: TonoPildora }) {
  const { punto, fondo } = useTonos()
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 24, px: 1.25, borderRadius: 12,
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: fondo[tono],
      }}
    >
      <Box component="span" aria-hidden="true" sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: punto[tono] }} />
      {texto}
    </Box>
  )
}
