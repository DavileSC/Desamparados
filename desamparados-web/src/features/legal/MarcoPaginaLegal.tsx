import { Box } from '@mui/material'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import MetaDePagina from '../../components/MetaDePagina'
import CabeceraDePagina from '../../components/CabeceraDePagina'
import SeccionAnimada from '../../components/SeccionAnimada'
import { SECCION_TRAS_CABECERA } from '../../components/espaciado'

interface MarcoPaginaLegalProps {
  title: string
  /** Para buscadores: qué resuelve esta página, en una frase. */
  descripcion: string
  children: React.ReactNode
}

export default function MarcoPaginaLegal({ title, descripcion, children }: MarcoPaginaLegalProps) {
  return (
    <>
      <MetaDePagina titulo={title} descripcion={descripcion} />
      <CabeceraDePagina title={title} />
      <SeccionAnimada sx={SECCION_TRAS_CABECERA}>
        <ContenedorDePagina>
          <Box sx={{ maxWidth: '850px', mx: 'auto', color: 'text.secondary', lineHeight: 1.8 }}>
            {children}
          </Box>
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
