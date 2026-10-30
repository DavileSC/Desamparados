import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import Hueso, { Lineas } from '../esqueleto/Hueso'
import { ArchivoDeNoticiasEsqueleto, PublicacionesEsqueleto } from './esqueletosDeListado'
import { AgendaEsqueleto, DibujoEsqueleto, FinesEnFocoEsqueleto, FotoFundidaEsqueleto, TelonEsqueleto } from './esqueletosDeBloque'

/**
 * Las páginas que no abren con un párrafo, con el esqueleto de lo que sí abren
 * (lo trae así su contenido de partida): los listados, sus tarjetas, las
 * mismas que el listado mientras llegan sus elementos; las demás, la forma de
 * su primer bloque. Con el esqueleto común se veía un párrafo y una foto, y al
 * llegar la página cambiaba entera en la primera pantalla. Si el CMS les
 * cambia el primer bloque, el esqueleto se parece algo menos, nada más.
 */
const POR_PAGINA: Record<string, () => ReactNode> = {
  noticias: () => <ArchivoDeNoticiasEsqueleto />,
  publicaciones: () => <PublicacionesEsqueleto />,
  boletines: () => <PublicacionesEsqueleto />,
  'dossier-prensa': () => <PublicacionesEsqueleto />,
  agenda: () => <AgendaEsqueleto />,
  cultos: () => <FotoFundidaEsqueleto />,
  trono: () => <TelonEsqueleto />,
  'nuestros-fines': () => <FinesEnFocoEsqueleto />,
  parroquia: () => <DibujoEsqueleto />,
}

/**
 * El cuerpo de una página de bloques mientras llega. Hasta que llega no se
 * sabe qué bloques tiene, así que va lo más común: un párrafo y un bloque de
 * foto y texto. Es lo que queda por debajo de la cabecera, casi siempre fuera
 * de la primera pantalla, y en la segunda visita la página ya está guardada y
 * sale al momento. Las que abren con otra cosa llevan el suyo (`POR_PAGINA`).
 */
export default function BloquesEsqueleto({ slug }: { slug?: string }) {
  const propio = slug ? POR_PAGINA[slug] : undefined
  if (propio) return propio()
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
