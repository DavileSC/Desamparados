import { Box, Typography, Grid } from '@mui/material'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import MetaDePagina from '../../../components/MetaDePagina'
import CabeceraDePagina from '../../../components/CabeceraDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import Boton from '../../../components/Boton'
import { SECCION_TRAS_CABECERA } from '../../../components/espaciado'

export default function HermanosPage() {
  return (
    <>
      <MetaDePagina
        titulo="Hermanos"
        descripcion="Qué supone ser hermano del Grupo Parroquial Nuestra Señora de los Desamparados de Málaga y cómo solicitar el alta."
      />

      <CabeceraDePagina
        title="Hermanos"
        subtitle="Forma parte de nuestra corporación."
      />

      <SeccionAnimada sx={SECCION_TRAS_CABECERA}>
        <ContenedorDePagina>
          <Grid container spacing={6} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
                Ser hermano del Grupo Parroquial Nuestra Señora de los Desamparados es formar parte de una
                comunidad de fe que vive la devoción a nuestra Sagrada Titular y trabaja
                por el bien común a través de la caridad, la formación y el culto.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
                Como hermano podrás participar en los cultos, acompañar a la Virgen en su
                estación de penitencia, acceder al área privada de hermanos y contribuir
                activamente al crecimiento espiritual y social de la corporación.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                Te invitamos a unirte a esta gran familia. Si ya eres hermano, accede a tu
                área privada para consultar tu perfil, papeleta de sitio y recibos.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  alignItems: { xs: 'stretch', md: 'flex-start' },
                }}
              >
                <Boton component="a" href="/hermanos/hazte-hermano" fullWidth>
                  Hazte hermano
                </Boton>
                <Boton
                  component="a"
                  href="/hermanos/acceso"
                  appVariant="outline"
                  fullWidth
                >
                  Acceso hermanos
                </Boton>
              </Box>
            </Grid>
          </Grid>
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
