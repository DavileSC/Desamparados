import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import AnimatedSection, { Revela } from '../../components/AnimatedSection'
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined'
import ChurchOutlinedIcon from '@mui/icons-material/ChurchOutlined'
import VolunteerActivismOutlinedIcon from '@mui/icons-material/VolunteerActivismOutlined'
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import MailOutlinedIcon from '@mui/icons-material/MailOutlined'
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined'
import { site } from '../../config/site'
import { GOLD, SERIF, TINTA } from './estilos'

interface Acceso {
  icon: ReactNode
  title: string
  description: string
  href: string
}

// «Acceso de hermanos» no está aquí a propósito: el menú ya lo muestra siempre.
// Tampoco la agenda ni el recorrido: tienen bloque propio en la portada, y los
// accesos son para lo que no se ve en ella.
const ACCESOS: Acceso[] = [
  { icon: <PersonAddOutlinedIcon fontSize="inherit" />, title: 'Hazte hermano', description: 'Únete al Grupo Parroquial', href: '/hermanos/hazte-hermano' },
  { icon: <ChurchOutlinedIcon fontSize="inherit" />, title: 'Nuestra sede', description: 'Parroquia de los Pasionistas', href: '/corporacion/parroquia-pasionistas' },
  { icon: <VolunteerActivismOutlinedIcon fontSize="inherit" />, title: 'Caridad', description: 'Ayuda social y obra asistencial', href: '/corporacion/nuestros-fines/caridad' },
  { icon: <HistoryEduOutlinedIcon fontSize="inherit" />, title: 'Historia', description: 'Orígenes y evolución del Grupo Parroquial', href: '/corporacion/historia' },
  { icon: <ArticleOutlinedIcon fontSize="inherit" />, title: 'Boletines', description: 'Boletín informativo y anuarios', href: '/publicaciones/boletines' },
  { icon: <MailOutlinedIcon fontSize="inherit" />, title: 'Contacto', description: 'Estamos a tu disposición', href: '/contacto' },
]

function QuickItem({ icon, title, description, href }: Acceso) {
  const externo = href.startsWith('http')

  return (
    <Box
      component={externo ? 'a' : Link}
      {...(externo ? { href, target: '_blank', rel: 'noopener noreferrer' } : { to: href })}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        height: '100%',
        px: 1.5,
        py: { xs: 2.25, md: 1.5 },
        borderRadius: '8px',
        color: 'inherit',
        textDecoration: 'none',
        '@media (hover: hover)': {
          '&:hover .quick-icon': { backgroundColor: 'rgba(222, 199, 43, 0.14)', boxShadow: `inset 0 0 0 1px ${GOLD}` },
          '&:hover .quick-title': { color: GOLD },
        },
      }}
    >
      <Box
        className="quick-icon"
        aria-hidden="true"
        sx={{
          width: { xs: 48, md: 56 },
          height: { xs: 48, md: 56 },
          mb: 2,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: { xs: 22, md: 24 },
          color: GOLD,
          boxShadow: 'inset 0 0 0 1px rgba(222, 199, 43, 0.45)',
          transition: 'background-color .3s ease, box-shadow .3s ease',
        }}
      >
        {icon}
      </Box>
      <Typography
        component="span"
        className="quick-title"
        sx={{ display: 'block', fontFamily: SERIF, fontSize: { xs: 18, md: 24 }, lineHeight: 1.2, color: '#fff', mb: 0.75, transition: 'color .3s ease' }}
      >
        {title}
      </Typography>
      <Typography component="span" sx={{ display: 'block', fontSize: { xs: 13, md: 14 }, lineHeight: 1.45, color: 'rgba(228, 226, 223, 0.72)' }}>
        {description}
      </Typography>
    </Box>
  )
}

/** Accesos directos: bloque de tinta sin foto, con la «D» de Desamparados como marca de agua. */
export default function QuickAccess() {
  const accesos: Acceso[] = site.redes.youtube
    ? [...ACCESOS, { icon: <PlayCircleOutlinedIcon fontSize="inherit" />, title: 'Canal de YouTube', description: 'Vídeos y retransmisiones', href: site.redes.youtube }]
    : ACCESOS

  return (
    <AnimatedSection
      cascada
      aria-labelledby="quick-access-title"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        '@supports (overflow: clip)': { overflow: 'clip' },
        py: { xs: 8, md: 11 },
        backgroundColor: TINTA,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          left: { xs: -24, md: -38 },
          top: '50%',
          transform: 'translateY(-52%)',
          fontFamily: SERIF,
          fontSize: { xs: 300, md: 460 },
          lineHeight: 1,
          color: 'rgba(255, 255, 255, 0.035)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        D
      </Box>
      <PageContainer sx={{ position: 'relative' }}>
        <Typography id="quick-access-title" component="h2" className="home-visually-hidden">
          Accesos directos
        </Typography>
        <Box
          component="ul"
          role="list"
          aria-labelledby="quick-access-title"
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', rowGap: { xs: 1, md: 5.75 }, maxWidth: 1060, mx: 'auto' }}
        >
          {accesos.map((acceso, i) => (
            // Tres por fila en escritorio y dos en móvil; si sobra alguno, queda centrado.
            <Revela as="li" key={acceso.href} orden={i} sx={{ flex: { xs: '0 0 50%', md: '0 0 33.333%' } }}>
              <QuickItem {...acceso} />
            </Revela>
          ))}
        </Box>
      </PageContainer>
    </AnimatedSection>
  )
}
