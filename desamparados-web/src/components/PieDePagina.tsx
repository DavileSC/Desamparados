import { useState } from 'react'
import { Box, Typography, Link as MuiLink, IconButton, Button } from '@mui/material'
import { Link } from 'react-router-dom'
import MailOutlinedIcon from '@mui/icons-material/MailOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import NorthEastIcon from '@mui/icons-material/NorthEast'
import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import XIcon from '@mui/icons-material/X'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import type { ReactNode } from 'react'
import { site } from '../config/site'
import { aplanarMenu, menuPublico } from '../config/navegacion'
import ContenedorDePagina from './ContenedorDePagina'
import { useConsentimientoDeCookies } from '../hooks/useConsentimientoDeCookies'
import { BOTON } from './estiloDeBoton'
import { designTokens } from '../theme'

type SocialLink = { icon: ReactNode; href: string; label: string }

// Solo se pintan los perfiles cuya URL está confirmada en `site.redes`: un
// icono que lleva a `#` es un enlace muerto de cara al visitante.
const socialLinks: SocialLink[] = [
  { icon: <InstagramIcon fontSize="small" />, href: site.redes.instagram, label: 'Instagram' },
  { icon: <XIcon fontSize="small" />, href: site.redes.x, label: 'X' },
  { icon: <FacebookIcon fontSize="small" />, href: site.redes.facebook, label: 'Facebook' },
  { icon: <PlayCircleIcon fontSize="small" />, href: site.redes.youtube, label: 'YouTube' },
].flatMap((red) => (red.href ? [{ ...red, href: red.href }] : []))

// Las columnas de enlaces se sacan del menú principal por su ruta: si una
// sección cambia de nombre, el pie lo recoge solo, y si desaparece, su enlace
// deja de pintarse en vez de quedar muerto.
const entradasMenu = new Map(aplanarMenu(menuPublico).map((entrada) => [entrada.href, entrada.label]))

// Los mismos grupos que el menú, y en su orden. Son cinco y caben tres
// columnas: Corporación, la larga, va sola, y las cortas van de dos en dos.
const columnas: { titulo: string; rutas: string[] }[][] = [
  [
    {
      titulo: 'Corporación',
      rutas: [
        '/historia',
        '/historia/organos-de-gobierno',
        '/parroquia-pasionistas',
        '/nuestros-fines',
        '/cultos',
        '/sabado-de-pasion',
        '/rosario',
      ],
    },
  ],
  [
    { titulo: 'Sagrada titular', rutas: ['/desamparados', '/ajuar', '/apadrina'] },
    { titulo: 'Actualidad', rutas: ['/agenda', '/noticias', '/tienda'] },
  ],
  [
    { titulo: 'Publicaciones', rutas: ['/publicaciones', '/publicaciones/boletines', '/publicaciones/dossier-prensa'] },
    { titulo: 'Hermanos', rutas: ['/hazte-hermano', '/acceso', '/contacto'] },
  ],
]

const legalLinks = [
  { label: 'Aviso legal', to: '/aviso-legal' },
  { label: 'Privacidad', to: '/politica-privacidad' },
  { label: 'Cookies', to: '/politica-cookies' },
]

const MAP_EMBED_URL =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1067.3544649056719!2d-4.449098871278157!3d36.711765554466446!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd72f77028f9b929%3A0xe34fc3610f0d1398!2sIglesia%20Parroquial%20Santa%20Mar%C3%ADa%20Goretti!5e0!3m2!1ses!2ses!4v1789660222285!5m2!1ses!2ses'

const LINEA = 'rgba(204, 196, 201, 0.18)'

const tituloColumna = {
  mb: 2,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'text.primary',
} as const

// Relleno y margen negativo a la vez: la maqueta no se mueve, pero el dedo
// tiene más alto que la letra. En el móvil, 40 px (con 28 aún se fallaba el
// toque); en el ordenador, con ratón, bastan 28.
const enlace = {
  display: 'inline-block',
  py: { xs: '10px', md: '4px' },
  my: { xs: '-10px', md: '-4px' },
  color: 'text.secondary',
  fontSize: 14,
  lineHeight: 1.4,
  textDecoration: 'none',
  transition: 'color .2s ease',
  '&:hover': { color: 'secondary.main' },
} as const

function Dato({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, color: 'text.secondary', fontSize: 14, lineHeight: 1.5 }}>
      <Box sx={{ display: 'flex', pt: '2px', '& svg': { fontSize: 17 } }} aria-hidden="true">{icono}</Box>
      <Box>{children}</Box>
    </Box>
  )
}

export default function PieDePagina() {
  const { aceptadas, volverAPreguntar } = useConsentimientoDeCookies()
  // RGPD: el iframe de Google Maps envía la IP del visitante a Google. Solo se carga si el
  // usuario ha aceptado las cookies o pulsa explícitamente "Mostrar mapa" (click-to-load).
  const [mapRequested, setMapRequested] = useState(false)
  const verMapa = aceptadas || mapRequested
  const year = new Date().getFullYear()

  return (
    <Box component="footer" data-pie-publico="" sx={{ backgroundColor: designTokens.colors.footer, borderTop: `1px solid ${LINEA}` }}>
      <ContenedorDePagina>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'minmax(0, 1.3fr) repeat(3, minmax(0, 1fr))',
              lg: 'minmax(0, 1.35fr) repeat(3, minmax(0, 0.8fr)) minmax(0, 1.25fr)',
            },
            columnGap: { xs: 4, lg: 5 },
            rowGap: 5,
            py: { xs: 6, md: 8 },
          }}
        >
          {/* Identidad y contacto. Desde la tableta apaisada, al lado de las columnas:
              sola en su fila dejaba medio pie vacío. */}
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
            <Typography component="div" sx={{ ...tituloColumna, color: 'text.secondary', mb: 1 }}>
              {site.tipo}
            </Typography>
            <Typography
              component={Link}
              to="/"
              variant="h4"
              sx={{ display: 'block', color: 'text.primary', textDecoration: 'none', fontSize: 22, lineHeight: 1.25, mb: 0.75 }}
            >
              {site.titular}
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 13, letterSpacing: '0.08em', mb: 3 }}>
              {site.sede.localidad}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: socialLinks.length > 0 ? 3 : 0 }}>
              <Dato icono={<MailOutlinedIcon />}>
                <MuiLink href={`mailto:${site.contacto.email}`} sx={enlace}>{site.contacto.email}</MuiLink>
              </Dato>
              {site.contacto.telefono && (
                <Dato icono={<PhoneOutlinedIcon />}>
                  <MuiLink href={`tel:${site.contacto.telefono.replace(/\s/g, '')}`} sx={enlace}>{site.contacto.telefono}</MuiLink>
                </Dato>
              )}
              <Dato icono={<AccessTimeIcon />}>{site.contacto.horario}</Dato>
            </Box>

            {socialLinks.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, ml: -1.5 }}>
                {socialLinks.map((social) => (
                  <IconButton
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${social.label} (se abre en otra pestaña)`}
                    sx={{ width: 44, height: 44, color: 'text.secondary', '&:hover': { color: 'secondary.main' } }}
                  >
                    {social.icon}
                  </IconButton>
                ))}
              </Box>
            )}
          </Box>

          {/* Mapa del sitio */}
          {columnas.map((grupos, i) => (
            // En el móvil (dos columnas), Corporación, la larga, ocupa dos filas y
            // las otras dos columnas caen una debajo de otra a su lado.
            <Box key={grupos[0].titulo} sx={{ gridRow: i === 0 ? { xs: 'span 2', md: 'auto' } : undefined, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {grupos.map((grupo) => (
                <Box key={grupo.titulo} component="nav" aria-label={grupo.titulo}>
                  <Typography component="h2" sx={tituloColumna}>{grupo.titulo}</Typography>
                  <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 1.25 } }}>
                    {grupo.rutas.flatMap((ruta) => {
                      const label = entradasMenu.get(ruta)
                      return label
                        ? [<li key={ruta}><MuiLink component={Link} to={ruta} sx={enlace}>{label}</MuiLink></li>]
                        : []
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          ))}

          {/* Dónde estamos: en tableta, la dirección a un lado y el mapa al otro */}
          <Box
            sx={{
              gridColumn: { xs: '1 / -1', lg: 'auto' },
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)', lg: '1fr' },
              gridTemplateRows: { sm: 'auto auto 1fr', lg: 'none' },
              columnGap: 4,
              alignContent: 'start',
            }}
          >
            <Typography component="h2" sx={tituloColumna}>Dónde estamos</Typography>
            <Box sx={{ gridColumn: { sm: 1, lg: 'auto' } }}>
              <Dato icono={<PlaceOutlinedIcon />}>
                <Box component="span" sx={{ display: 'block', color: 'text.primary' }}>{site.sede.nombre}</Box>
                {site.sede.direccion}, {site.sede.localidad}
              </Dato>
            </Box>

            <Box
              sx={{
                gridColumn: { sm: 2, lg: 'auto' },
                gridRow: { sm: '1 / span 3', lg: 'auto' },
                mt: { xs: 2, sm: 0, lg: 2 },
                height: 160,
                borderRadius: '8px',
                overflow: 'hidden',
                border: `1px solid ${LINEA}`,
                backgroundColor: 'rgba(255,255,255,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {verMapa ? (
                <Box
                  component="iframe"
                  src={MAP_EMBED_URL}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Mapa: ${site.sede.nombre}`}
                />
              ) : (
                <Box sx={{ textAlign: 'center', px: 2 }}>
                  <MapOutlinedIcon sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
                  <Typography sx={{ color: 'text.secondary', fontSize: 12, lineHeight: 1.4, mb: 1 }}>
                    Al mostrar el mapa, tu IP se envía a Google.
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setMapRequested(true)}
                    sx={{ ...BOTON.oscuro, px: 2, minHeight: 36, fontSize: 13 }}
                  >
                    Mostrar mapa
                  </Button>
                </Box>
              )}
            </Box>

            <MuiLink
              href={site.sede.comoLlegar}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ ...enlace, gridColumn: { sm: 1, lg: 'auto' }, justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1.5, color: 'text.primary', fontSize: 13, fontWeight: 600 }}
            >
              Cómo llegar
              <NorthEastIcon sx={{ fontSize: 14 }} />
              <Box component="span" sx={visualmenteOculto}>(se abre en Google Maps)</Box>
            </MuiLink>
          </Box>
        </Box>
      </ContenedorDePagina>

      {/* Franja inferior */}
      <Box sx={{ borderTop: `1px solid ${LINEA}` }}>
        <ContenedorDePagina>
          <Box
            sx={{
              py: 3,
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
              © {year} {site.nombre}
            </Typography>
            <Box component="nav" aria-label="Información legal" sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 1 }}>
              {legalLinks.map((link) => (
                <MuiLink key={link.to} component={Link} to={link.to} sx={{ ...enlace, fontSize: 13 }}>
                  {link.label}
                </MuiLink>
              ))}
              <MuiLink
                component="button"
                type="button"
                onClick={volverAPreguntar}
                sx={{ font: 'inherit', ...enlace, fontSize: 13, border: 0, background: 'none', cursor: 'pointer', px: 0 }}
              >
                Gestionar cookies
              </MuiLink>
            </Box>
          </Box>
        </ContenedorDePagina>
      </Box>
    </Box>
  )
}

// Solo para lectores de pantalla. Tamaños en px y no `1`: en `sx`, un 1 es el
// 100 %, y este span medía toda la pantalla y alargaba la página a lo ancho y
// por debajo del pie.
const visualmenteOculto = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const
