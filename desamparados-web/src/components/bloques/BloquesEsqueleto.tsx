import { Box } from '@mui/material'
import Hueso, { Lineas } from '../esqueleto/Hueso'

/**
 * El cuerpo de una página de bloques mientras llega. Hasta que llega no se
 * sabe qué bloques tiene, así que va lo más común: un párrafo y un bloque de
 * foto y texto. Es lo que queda por debajo de la cabecera, casi siempre fuera
 * de la primera pantalla, y en la segunda visita la página ya está guardada y
 * sale al momento.
 */
export default function BloquesEsqueleto() {
  return (
    <Box sx={{ display: 'grid', gap: { xs: 5, md: 7 } }}>
      <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto' }}>
        <Lineas anchos={['100%', '97%', '88%', '42%']} linea={{ xs: 28.8, md: 30.6 }} grosor={11} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 3, md: 6 }, alignItems: 'center' }}>
        <Hueso sx={{ aspectRatio: '4 / 3', maxWidth: '100%', borderRadius: 0 }} />
        <Box>
          <Box sx={{ mb: 1.5 }}><Lineas anchos={['55%']} linea={{ xs: 31, md: 38 }} grosor={{ xs: 18, md: 22 }} /></Box>
          <Lineas anchos={['100%', '94%', '70%']} linea={27} grosor={10} />
        </Box>
      </Box>
    </Box>
  )
}
