import { useState } from 'react'
import { Box, Typography, Link as MuiLink, IconButton, Button } from '@mui/material'
import { Link } from 'react-router-dom'
import MailOutlinedIcon from '@mui/icons-material/MailOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import NorthEastIcon from '@mui/icons-material/NorthEast'
import type { ReactNode } from 'react'
import { site } from '../config/site'
import { aplanarMenu } from '../config/navegacion'
import { useMenuPublico } from '../hooks/useMenuPublico'
import ContenedorDePagina from './ContenedorDePagina'
import { useEnlacesDeRedes } from './barra/redes'
import { comoLlegar, mapaDeLaSede, useContacto } from '../hooks/useContacto'
import { useConsentimientoDeCookies } from '../hooks/useConsentimientoDeCookies'
import { useModulos } from '../hooks/useModulos'
import { BOTON } from './estiloDeBoton'
import { designTokens } from '../theme'

// El pie es una sola franja (05-10-2026): el mapa del sitio entero lo hacía
// demasiado alto y repetía el menú de arriba. Quedan los destinos que más se buscan,
// el contacto y el mapa.
const destacados = ['/agenda', '/noticias', '/tienda', '/hazte-hermano', '/contacto']

// Las condiciones de compra, solo con la tienda encendida.
const legalLinks = [
  { label: 'Aviso legal', to: '/aviso-legal' },
  { label: 'Privacidad', to: '/politica-privacidad' },
  { label: 'Cookies', to: '/politica-cookies' },
  { label: 'Condiciones de compra', to: '/condiciones-de-compra', modulo: 'tienda-web' as const },
]

const DESARROLLO = { nombre: 'David Silva Cuevas', url: 'https://www.linkedin.com/in/david-silva-cuevas/' }

const LINEA = 'rgba(204, 196, 201, 0.18)'

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
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, color: 'text.secondary', fontSize: 13, lineHeight: 1.5 }}>
      <Box sx={{ display: 'flex', pt: '2px', '& svg': { fontSize: 16 } }} aria-hidden="true">{icono}</Box>
      <Box>{children}</Box>
    </Box>
  )
}

export default function PieDePagina() {
  // Los destacados se sacan del menú principal por su ruta: si una sección
  // cambia de nombre, el pie lo recoge solo, y si desaparece (porque su módulo
  // está apagado), su enlace deja de pintarse en vez de quedar muerto.
  const entradasMenu = new Map(aplanarMenu(useMenuPublico()).map((entrada) => [entrada.href, entrada.label]))
  const enlacesDestacados = destacados.flatMap((ruta) => {
    const label = entradasMenu.get(ruta)
    return label ? [{ ruta, label }] : []
  })
  const { aceptadas, volverAPreguntar } = useConsentimientoDeCookies()
  // RGPD: el iframe de Google Maps envía la IP del visitante a Google. Solo se carga si el
  // usuario ha aceptado las cookies o pulsa explícitamente "Mostrar mapa" (click-to-load).
  const [mapRequested, setMapRequested] = useState(false)
  const verMapa = aceptadas || mapRequested
  const { activo } = useModulos()
  // Mientras llegan, sus huecos quedan vacíos: mejor que un dato inventado.
  const contacto = useContacto()
  const enlacesDeRedes = useEnlacesDeRedes()
  const year = new Date().getFullYear()

  return (
    <Box component="footer" data-pie-publico="" sx={{ backgroundColor: designTokens.colors.footer, borderTop: `1px solid ${LINEA}` }}>
      <ContenedorDePagina>
        <Box
          sx={{
            display: 'grid',
            // Tres bloques en el portátil; en tableta, el mapa baja a su propia fila.
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'auto auto minmax(240px, 300px)' },
            justifyContent: 'space-between',
            alignItems: 'start',
            columnGap: 6,
            rowGap: 3.5,
            py: { xs: 4.5, md: 4 },
          }}
        >
          {/* Quiénes y adónde: el nombre, la dirección y los destinos que más se buscan */}
          <Box sx={{ display: 'grid', gap: { xs: 3, md: 2.25 }, alignContent: 'start' }}>
            <Box>
              <Typography
                component={Link}
                to="/"
                sx={{ display: 'block', color: 'text.primary', textDecoration: 'none', fontFamily: designTokens.fonts.heading, fontSize: 18, fontWeight: 500, lineHeight: 1.3 }}
              >
                {site.titular}
              </Typography>
              {contacto?.sede.nombre && (
                <MuiLink href={comoLlegar(contacto)} target="_blank" rel="noopener noreferrer" sx={{ ...enlace, fontSize: 13, mt: { xs: '-4px', md: '2px' } }}>
                  {[contacto.sede.nombre, contacto.sede.calle].filter(Boolean).join(' · ')}
                  <NorthEastIcon sx={{ fontSize: 12, ml: 0.5, verticalAlign: '-1px' }} />
                  <Box component="span" sx={visualmenteOculto}>(cómo llegar, se abre en Google Maps)</Box>
                </MuiLink>
              )}
            </Box>

            {enlacesDestacados.length > 0 && (
              <Box component="nav" aria-label="Destacados" sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 1 }}>
                {enlacesDestacados.map(({ ruta, label }) => (
                  <MuiLink key={ruta} component={Link} to={ruta} sx={{ ...enlace, color: 'text.primary' }}>{label}</MuiLink>
                ))}
              </Box>
            )}
          </Box>

          {/* Contacto y redes */}
          <Box sx={{ display: 'grid', gap: { xs: 1.75, md: 1 }, alignContent: 'start' }}>
            {contacto?.secretaria.email && (
              <Dato icono={<MailOutlinedIcon />}>
                <MuiLink href={`mailto:${contacto.secretaria.email}`} sx={{ ...enlace, fontSize: 13 }}>{contacto.secretaria.email}</MuiLink>
              </Dato>
            )}
            {contacto?.secretaria.telefono && (
              <Dato icono={<PhoneOutlinedIcon />}>
                <MuiLink href={`tel:${contacto.secretaria.telefono.replace(/\s/g, '')}`} sx={{ ...enlace, fontSize: 13 }}>{contacto.secretaria.telefono}</MuiLink>
              </Dato>
            )}
            {contacto?.secretaria.horario && <Dato icono={<AccessTimeIcon />}>{contacto.secretaria.horario}</Dato>}
            {enlacesDeRedes.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.25, ml: -1.5, mt: { xs: 0, md: -0.5 } }}>
                {enlacesDeRedes.map((social) => (
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

          {/* El mapa */}
          <Box
            sx={{
              gridColumn: { md: '1 / -1', lg: 'auto' },
              height: { xs: 160, lg: 136 },
              borderRadius: '8px',
              overflow: 'hidden',
              border: `1px solid ${LINEA}`,
              backgroundColor: 'rgba(255,255,255,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {verMapa && contacto ? (
              <Box
                component="iframe"
                src={mapaDeLaSede(contacto)}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Mapa: ${contacto.sede.nombre ?? site.titular}`}
              />
            ) : (
              <Box sx={{ textAlign: 'center', px: 2 }}>
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
        </Box>
      </ContenedorDePagina>

      {/* Franja inferior: a 12,5 px cabe en un renglón en el portátil (1280 con barra de desplazamiento). */}
      <Box sx={{ borderTop: `1px solid ${LINEA}` }}>
        <ContenedorDePagina>
          <Box
            sx={{
              py: 2,
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              columnGap: 3,
              rowGap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>
              Copyright © {year} {site.nombre}. Desarrollo web:{' '}
              <MuiLink href={DESARROLLO.url} target="_blank" rel="noopener noreferrer" sx={{ ...enlace, fontSize: 12.5, color: 'text.primary' }}>
                {DESARROLLO.nombre}
                <Box component="span" sx={visualmenteOculto}>(LinkedIn, se abre en otra pestaña)</Box>
              </MuiLink>
            </Typography>
            <Box component="nav" aria-label="Información legal" sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 1 }}>
              {legalLinks.filter((link) => !link.modulo || activo(link.modulo)).map((link) => (
                <MuiLink key={link.to} component={Link} to={link.to} sx={{ ...enlace, fontSize: 12.5 }}>
                  {link.label}
                </MuiLink>
              ))}
              <MuiLink
                component="button"
                type="button"
                onClick={volverAPreguntar}
                sx={{ font: 'inherit', ...enlace, fontSize: 12.5, border: 0, background: 'none', cursor: 'pointer', px: 0 }}
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
