import { Box, Link as EnlaceMui, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import EscudoDelGrupo from '../../components/EscudoDelGrupo'
import { useEnlacesDeRedes } from '../../components/barra/redes'
import { site } from '../../config/site'
import { designTokens } from '../../theme'
import { MARCA } from '../../theme/marca'
import type { EstadoDeLaWeb } from '../../lib/api/web'

/** Lo que dice si el CMS no ha puesto texto. */
export const MENSAJE_DE_SIEMPRE = 'Estamos preparando la nueva web. Muy pronto podrás conocer aquí nuestra historia, los cultos y la agenda.'

/** «Sábado, 20 de marzo de 2027». En UTC: el día guardado es un día, no un instante. */
function diaDeLaPresentacion(fecha: string): string {
  const texto = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${fecha}T00:00:00Z`))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Las que siguen abiertas con la web cerrada (`MarcoPublico`): se enlazan desde aquí. */
const LEGALES = [
  { a: '/aviso-legal', texto: 'Aviso legal' },
  { a: '/politica-privacidad', texto: 'Privacidad' },
  { a: '/politica-cookies', texto: 'Cookies' },
]

/**
 * Lo que ve quien entra con la web cerrada (Sistema → Abrir la web). Va sin
 * barra ni pie: no lleva a ninguna página, salvo los textos legales, que la
 * ley pide a la vista. `noindex`, para que el buscador no guarde esta portada
 * en lugar de la de verdad.
 */
export default function ProximamentePage({ estado }: { estado: EstadoDeLaWeb }) {
  const redes = useEnlacesDeRedes()
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        px: 3,
        pt: { xs: 4.5, md: 7 },
        pb: 3,
        bgcolor: designTokens.colors.primaryContainer,
        // Un halo apenas más claro detrás del escudo: la página es solo eso y,
        // sobre el negro liso, el escudo flotaba sin sitio.
        backgroundImage: `radial-gradient(ellipse at 50% 30%, #221f22 0%, ${designTokens.colors.primaryContainer} 65%)`,
        color: 'text.primary',
      }}
    >
      <Helmet>
        <title>{`Próximamente | ${site.nombreCorto}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Stack spacing={{ xs: 1.6, md: 2.25 }} sx={{ alignItems: 'center', my: 'auto', maxWidth: 640 }}>
        <EscudoDelGrupo alto={120} sx={{ height: { xs: 84, md: 120 } }} />
        <Typography variant="overline" sx={{ letterSpacing: '0.3em', color: 'text.secondary' }}>{site.entidad.localidad}</Typography>
        <Typography variant="h1" sx={{ fontWeight: 300, fontSize: { xs: 26, md: 38 }, lineHeight: 1.15, textWrap: 'balance' }}>{site.nombre}</Typography>
        <Typography component="p" sx={{ color: MARCA.acento, textTransform: 'uppercase', letterSpacing: '0.32em', fontWeight: 500, fontSize: 15 }}>Próximamente</Typography>
        <Typography sx={{ lineHeight: 1.6, maxWidth: '52ch', color: 'text.secondary', fontSize: { xs: 15, md: 16 } }}>{estado.mensaje ?? MENSAJE_DE_SIEMPRE}</Typography>
        {estado.fecha && (
          <Box sx={{ display: 'grid', gap: 0.5, pt: 0.5 }}>
            <Typography variant="overline" sx={{ letterSpacing: '0.24em', color: 'text.secondary', lineHeight: 1.4 }}>Presentación</Typography>
            <Typography component="p" sx={{ fontSize: 18 }}>{diaDeLaPresentacion(estado.fecha)}</Typography>
          </Box>
        )}
        {redes.length > 0 && (
          // Con su nombre y no con el icono: aquí son lo único que se puede pulsar
          // y tienen que decir adónde llevan.
          <Stack component="nav" aria-label="Redes sociales" direction="row" sx={{ pt: 0.5, flexWrap: 'wrap', justifyContent: 'center', columnGap: 1 }}>
            {redes.map((red) => (
              <EnlaceMui key={red.label} href={red.href} target="_blank" rel="noopener noreferrer" underline="hover"
                sx={{ color: 'text.secondary', fontSize: 14, px: 1, py: 1.25, '&:hover': { color: 'text.primary' } }}>
                {red.label}
              </EnlaceMui>
            ))}
          </Stack>
        )}
      </Stack>
      <Typography component="nav" aria-label="Textos legales" sx={{ color: 'text.secondary', fontSize: 13, display: 'flex', columnGap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        {LEGALES.map((l) => <EnlaceMui key={l.a} component={Link} to={l.a} color="inherit" underline="hover" sx={{ px: 1, py: 1 }}>{l.texto}</EnlaceMui>)}
      </Typography>
    </Box>
  )
}
