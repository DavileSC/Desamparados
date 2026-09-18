import { Suspense, lazy } from 'react'
import { Box, CircularProgress, Dialog, IconButton, Stack, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import PageHeader from '../../../components/PageHeader'
import PageContainer from '../../../components/PageContainer'
import PaginaDeBloquesPublica from '../../../components/bloques/PaginaDeBloquesPublica'
import { BloqueDePagina } from '../../../components/bloques/BloquesDePagina'
import { BorradorPaginaContext } from '../../../components/bloques/borrador'
import MarcoVistaPrevia from '../contenido/MarcoVistaPrevia'
import type { Bloque, CabeceraPagina, PaginaDeBloques, SlugContenido } from '../../../lib/api/contenido'

// Historia tiene maquetación propia; se carga solo si se previsualiza.
const HistoryPage = lazy(() => import('../../corporation/history/HistoryPage'))

/** La cabecera de la página tal como sale arriba del todo en la web. */
export function VistaPreviaCabecera({ cabecera }: { cabecera: CabeceraPagina }) {
  return (
    <MarcoVistaPrevia testId="vista-previa-cabecera">
      <PageHeader
        title={cabecera.titulo || 'Sin título'}
        subtitle={cabecera.subtitulo}
        image={cabecera.foto || undefined}
        imageAlt={cabecera.fotoAlt}
      />
    </MarcoVistaPrevia>
  )
}

/**
 * Un bloque suelto, pintado con el mismo componente y el mismo título de
 * sección que dentro de la página, con el aire que tiene alrededor en ella.
 */
export function VistaPreviaBloque({ bloque }: { bloque: Bloque }) {
  return (
    // La galería se mueve con sus flechas o arrastrando: en la vista previa
    // también, para ver cómo pasan las fotos.
    <MarcoVistaPrevia testId="vista-previa-bloque" interactiva={bloque.tipo === 'galeria'}>
      <PageContainer sx={{ py: 6 }}>
        <BloqueDePagina bloque={bloque} />
      </PageContainer>
    </MarcoVistaPrevia>
  )
}

/**
 * La página entera como quedará al guardar: el componente REAL de la página
 * (el genérico de bloques o, en Historia, su maquetación propia) con el
 * borrador en lugar de lo guardado. Va en una ventana a pantalla completa y se
 * recorre con su barra de desplazamiento.
 */
export function VistaPreviaPagina({ abierta, slug, documento, onCerrar }: {
  abierta: boolean
  slug: SlugContenido
  documento: PaginaDeBloques
  onCerrar: () => void
}) {
  return (
    <Dialog open={abierta} onClose={onCerrar} fullScreen aria-labelledby="titulo-vista-previa-pagina">
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', px: { xs: 2, md: 3 }, py: 1.5, borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}
      >
        <VisibilityOutlinedIcon sx={{ color: 'text.secondary' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id="titulo-vista-previa-pagina" component="h2" sx={{ fontWeight: 600, fontSize: 17 }}>
            Vista previa de «{documento.cabecera.titulo || 'Sin título'}»
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Con lo que hay escrito ahora: puedes pasar las fotos y probarla. No se publica hasta que guardes.
          </Typography>
        </Box>
        <IconButton aria-label="Cerrar la vista previa" onClick={onCerrar}><CloseIcon /></IconButton>
      </Stack>
      <Box sx={{ p: { xs: 1.5, md: 3 } }}>
        {/* La página entera se puede probar: pasar las fotos de sus galerías,
            ampliar una, darle al play; los enlaces siguen sin llevar a ningún sitio. */}
        <MarcoVistaPrevia sinTope sinAviso interactiva testId="vista-previa-pagina">
          <BorradorPaginaContext.Provider value={documento}>
            <Suspense fallback={<CircularProgress sx={{ m: 4 }} aria-label="Cargando la vista previa" />}>
              {slug === 'historia' ? <HistoryPage /> : <PaginaDeBloquesPublica slug={slug} />}
            </Suspense>
          </BorradorPaginaContext.Provider>
        </MarcoVistaPrevia>
      </Box>
    </Dialog>
  )
}
