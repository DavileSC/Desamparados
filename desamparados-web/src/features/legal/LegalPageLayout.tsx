import { Helmet } from 'react-helmet-async'
import { Box } from '@mui/material'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import CabeceraDePagina from '../../components/CabeceraDePagina'
import SeccionAnimada from '../../components/SeccionAnimada'
import { SECCION_TRAS_CABECERA } from '../../components/espaciado'

interface LegalPageLayoutProps {
  title: string
  children: React.ReactNode
}

export default function LegalPageLayout({ title, children }: LegalPageLayoutProps) {
  return (
    <>
      <Helmet>
        <title>{`${title} | Desamparados`}</title>
      </Helmet>
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
