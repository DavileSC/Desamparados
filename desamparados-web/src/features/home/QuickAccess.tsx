import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import AnimatedSection from '../../components/AnimatedSection'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import ChurchIcon from '@mui/icons-material/Church'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import AddIcon from '@mui/icons-material/Add'
import MailIcon from '@mui/icons-material/Mail'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import { site } from '../../config/site'

interface QuickItemProps {
  icon: React.ReactNode
  label: string
  href: string
}

function QuickItem({ icon, label, href }: QuickItemProps) {
  return (
    <Box
      component={Link}
      to={href}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        p: 2,
        borderRadius: '8px',
        textDecoration: 'none',
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          '& .quick-icon': { borderColor: 'secondary.main', color: 'secondary.main' },
          '& .quick-label': { color: 'text.primary' },
        },
      }}
    >
      <Box
        className="quick-icon"
        sx={{
          width: { xs: 64, md: 80 },
          height: { xs: 64, md: 80 },
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(204, 196, 201, 0.2)',
          color: 'text.primary',
          transition: 'all 0.3s ease',
        }}
      >
        <Box sx={{ fontSize: { xs: 24, md: 32 } }}>{icon}</Box>
      </Box>
      <Typography
        className="quick-label"
        variant="overline"
        sx={{
          color: 'text.secondary',
          fontSize: { xs: '10px', md: '11px' },
          textAlign: 'center',
          transition: 'color 0.3s ease',
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}

export default function QuickAccess() {
  return (
    <AnimatedSection sx={{ py: { xs: 6, md: 10 }, backgroundColor: 'background.paper' }}>
      <PageContainer>
        <Box
          sx={{
            display: 'grid',
            // 4 columnas fijas desbordaban 93px a 375px (barra de scroll horizontal en toda la home)
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            gap: { xs: 2, md: 4 },
            justifyItems: 'center',
          }}
        >
          <QuickItem icon={<VpnKeyIcon fontSize="inherit" />} label="Acceso de hermanos" href="/hermanos/acceso" />
          <QuickItem icon={<PersonAddIcon fontSize="inherit" />} label="Alta de hermanos" href="/hermanos/hazte-hermano" />
          <QuickItem icon={<ChurchIcon fontSize="inherit" />} label="Templo" href="/corporacion/parroquia-pasionistas" />
          <QuickItem icon={<VolunteerActivismIcon fontSize="inherit" />} label="Caridad" href="/corporacion/nuestros-fines/caridad" />
          <QuickItem icon={<AddIcon fontSize="inherit" />} label="Columbarios" href="/corporacion" />
          <QuickItem icon={<MailIcon fontSize="inherit" />} label="Contacto" href="/contacto" />
          {site.redes.youtube && (
            <QuickItem
              icon={<PlayCircleIcon fontSize="inherit" />}
              label="Canal de Youtube"
              href={site.redes.youtube}
            />
          )}
          <QuickItem icon={<ChurchIcon fontSize="inherit" />} label="Sede en directo" href="#live" />
        </Box>
      </PageContainer>
    </AnimatedSection>
  )
}
