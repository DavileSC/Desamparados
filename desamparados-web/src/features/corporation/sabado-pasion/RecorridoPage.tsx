import { Helmet } from 'react-helmet-async'
import { Box, Grid, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import AnimatedSection from '../../../components/AnimatedSection'
import GlassCard from '../../../components/GlassCard'
import { CLAVE_RECORRIDO, getContenido, type ContenidoRecorrido } from '../../../lib/api/contenido'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'

export default function RecorridoPage() {
  const { data } = useQuery({
    queryKey: CLAVE_RECORRIDO,
    queryFn: () => getContenido<ContenidoRecorrido>('recorrido'),
    retry: false,
    staleTime: 5 * 60_000,
  })
  // Mientras carga y si falla, el itinerario de siempre: esta página es
  // información práctica —a qué hora pasa la procesión por cada sitio— y un
  // hueco es peor que un dato de hace un año.
  const recorrido = data ?? (POR_DEFECTO.recorrido as ContenidoRecorrido)

  return (
    <>
      <Helmet>
        <title>Recorrido | Desamparados</title>
      </Helmet>

      <PageHeader
        title={recorrido.titulo}
        subtitle={recorrido.subtitulo}
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto', mb: 6 }}>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, textAlign: 'center' }}>
              {recorrido.introduccion}
            </Typography>
          </Box>

          {recorrido.plano.url && (
            <Box sx={{ maxWidth: 900, mx: 'auto', mb: 6 }}>
              <Box
                component="img"
                src={recorrido.plano.url}
                alt={recorrido.plano.alt}
                sx={{ width: '100%', height: 'auto', borderRadius: '8px' }}
                loading="lazy"
                decoding="async"
              />
            </Box>
          )}

          {recorrido.paradas.length > 0 && (
            <>
              <SectionTitle title={recorrido.tituloItinerario} centered />
              <Grid container spacing={2}>
                {recorrido.paradas.map((parada, i) => (
                  // El itinerario repite lugares (la procesión pasa dos veces por la
                  // misma plaza): la clave necesita el índice o React se lía al
                  // reordenar las paradas desde el CMS.
                  <Grid key={`${parada.hora}-${parada.lugar}-${i}`} size={{ xs: 12, md: 6 }}>
                    <GlassCard
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        p: 3,
                      }}
                    >
                      <Box
                        sx={{
                          minWidth: '80px',
                          textAlign: 'center',
                          px: 1.5,
                          py: 1,
                          borderRadius: '8px',
                          backgroundColor: 'rgba(110, 24, 34, 0.25)',
                          color: 'secondary.main',
                          fontWeight: 600,
                        }}
                      >
                        {parada.hora}
                      </Box>
                      <Typography variant="body1" sx={{ color: 'text.primary' }}>
                        {parada.lugar}
                      </Typography>
                    </GlassCard>
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
