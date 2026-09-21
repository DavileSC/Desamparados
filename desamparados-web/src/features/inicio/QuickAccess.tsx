import { useId, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import SeccionAnimada, { Revela } from '../../components/SeccionAnimada'
import ChurchOutlinedIcon from '@mui/icons-material/ChurchOutlined'
import VolunteerActivismOutlinedIcon from '@mui/icons-material/VolunteerActivismOutlined'
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import MailOutlinedIcon from '@mui/icons-material/MailOutlined'
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import NorthEastIcon from '@mui/icons-material/NorthEast'
import { site } from '../../config/site'
import { GOLD, GRANATE, PAPEL, SERIF, TINTA, ceja } from './estilos'
import { useTextosPortada, TEXTOS_POR_DEFECTO } from './useContenidoPortada'
import type { TextosPortada } from '../../lib/api/portada'

// Lo que NO se edita desde el CMS: qué teselas hay, su icono, su destino y su
// orden. El documento solo pone título y descripción, casados por `clave`.
interface Acceso {
  clave: string
  icon: ReactNode
  href: string
}

// «Hazte hermano» abre el mosaico en su propia placa: captar hermanos es lo que
// más importa de este bloque. El destino se queda en el código; el texto llega
// por props desde el documento (`textos.accesos.placa`).
const HAZTE_HERMANO = { href: '/hermanos/hazte-hermano' }

// «Acceso de hermanos» no está aquí a propósito: el menú ya lo muestra siempre.
// Tampoco la agenda ni el recorrido: tienen bloque propio en la portada, y los
// accesos son para lo que no se ve en ella.
const ACCESOS: Acceso[] = [
  { clave: 'sede', icon: <ChurchOutlinedIcon fontSize="inherit" />, href: '/corporacion/parroquia-pasionistas' },
  { clave: 'caridad', icon: <VolunteerActivismOutlinedIcon fontSize="inherit" />, href: '/corporacion/nuestros-fines/caridad' },
  { clave: 'historia', icon: <HistoryEduOutlinedIcon fontSize="inherit" />, href: '/corporacion/historia' },
  { clave: 'boletines', icon: <ArticleOutlinedIcon fontSize="inherit" />, href: '/publicaciones/boletines' },
]

const CONTACTO: Acceso = { clave: 'contacto', icon: <MailOutlinedIcon fontSize="inherit" />, href: '/contacto' }

const FONDO_TESELA = '#262326'

function PlacaHazteHermano({ placa }: { placa: TextosPortada['accesos']['placa'] }) {
  const id = useId()

  return (
    <Box
      component={Link}
      to={HAZTE_HERMANO.href}
      aria-labelledby={`${id}-ceja ${id}-titulo ${id}-boton`}
      aria-describedby={`${id}-texto`}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        '@supports (overflow: clip)': { overflow: 'clip' },
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        p: { xs: '30px 24px 26px', md: '40px 38px' },
        backgroundColor: GRANATE,
        color: '#fff',
        textDecoration: 'none',
        transition: 'background-color .3s ease',
        '@media (hover: hover)': {
          '&:hover': { backgroundColor: '#7a1c27' },
          '&:hover .placa-boton svg': { transform: 'translateX(4px)' },
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          right: { xs: -24, md: -30 },
          bottom: { xs: -80, md: -110 },
          fontFamily: SERIF,
          fontSize: { xs: 280, md: 400 },
          lineHeight: 1,
          color: 'rgba(255, 255, 255, 0.06)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        D
      </Box>
      <Typography component="span" id={`${id}-ceja`} sx={{ ...ceja, position: 'relative', color: '#f1d9d6' }}>
        {placa.ceja}
      </Typography>
      <Typography
        component="span"
        id={`${id}-titulo`}
        sx={{ position: 'relative', display: 'block', maxWidth: 320, fontFamily: SERIF, fontSize: { xs: 30, md: 40 }, lineHeight: 1.1, letterSpacing: '-0.015em' }}
      >
        {placa.titulo}
      </Typography>
      <Typography
        component="span"
        id={`${id}-texto`}
        sx={{ position: 'relative', display: 'block', maxWidth: 320, mt: { xs: 1.75, md: 2.5 }, mb: { xs: 3, md: 4 }, fontSize: { xs: 14, md: 15 }, lineHeight: 1.7, color: '#f3dedb' }}
      >
        {placa.texto}
      </Typography>
      <Box
        component="span"
        id={`${id}-boton`}
        className="placa-boton"
        sx={{
          position: 'relative',
          mt: { md: 'auto' },
          alignSelf: { xs: 'stretch', md: 'flex-start' },
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.25,
          minHeight: 44,
          px: 2.75,
          py: 1.5,
          borderRadius: '3px',
          backgroundColor: PAPEL,
          color: GRANATE,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          '& svg': { fontSize: 18, transition: 'transform .25s ease' },
        }}
      >
        {placa.boton} <ArrowForwardIcon aria-hidden="true" />
      </Box>
    </Box>
  )
}

interface TeselaProps {
  icon: ReactNode
  title: string
  description: string
  href: string
  ancha: boolean
}

/** Tesela del mosaico. La ancha ocupa una fila entera y cambia la flecha por «Escríbenos». */
function Tesela({ icon, title, description, href, ancha }: TeselaProps) {
  const externo = href.startsWith('http')

  return (
    <Box
      component={externo ? 'a' : Link}
      {...(externo ? { href, target: '_blank', rel: 'noopener noreferrer' } : { to: href })}
      sx={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: ancha ? 'row' : 'column',
        alignItems: ancha ? 'center' : 'stretch',
        gap: ancha ? { xs: 1.75, md: 2.5 } : 0,
        minHeight: ancha ? 0 : { xs: 140, md: 158 },
        p: ancha ? { xs: '20px 16px', md: '24px 26px' } : { xs: '18px 16px 16px', md: '26px 26px 24px' },
        backgroundColor: FONDO_TESELA,
        color: 'inherit',
        textDecoration: 'none',
        transition: 'background-color .3s ease',
        '@media (hover: hover)': {
          '&:hover': { backgroundColor: '#2f2b2f' },
          '&:hover .tesela-titulo, &:hover .tesela-cta': { color: GOLD },
          '&:hover .tesela-flecha': { color: GOLD, transform: 'translate(3px, -3px)' },
        },
      }}
    >
      <Box
        component="span"
        aria-hidden="true"
        sx={{ display: 'flex', color: GOLD, fontSize: { xs: 22, md: 26 }, ...(ancha ? {} : { mb: 'auto', pb: { xs: 2.25, md: 2.75 } }) }}
      >
        {icon}
      </Box>
      <Box component="span" sx={{ display: 'block', flex: ancha ? 1 : 'none' }}>
        <Typography
          component="span"
          className="tesela-titulo"
          sx={{ display: 'block', fontFamily: SERIF, fontSize: { xs: 18, md: 22 }, lineHeight: 1.2, color: '#fff', mb: 0.75, transition: 'color .3s ease' }}
        >
          {title}
        </Typography>
        <Typography component="span" sx={{ display: 'block', fontSize: { xs: 13, md: 14 }, lineHeight: 1.45, color: 'rgba(228, 226, 223, 0.72)' }}>
          {description}
        </Typography>
      </Box>
      {externo && <span className="home-visually-hidden"> (nueva pestaña)</span>}
      {ancha ? (
        <Box
          component="span"
          aria-hidden="true"
          className="tesela-cta"
          sx={{ pb: '5px', borderBottom: `2px solid ${GOLD}`, color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', whiteSpace: 'nowrap', transition: 'color .3s ease' }}
        >
          Escríbenos
        </Box>
      ) : (
        <NorthEastIcon
          aria-hidden="true"
          className="tesela-flecha"
          sx={{
            position: 'absolute',
            top: { xs: 16, md: 24 },
            right: { xs: 14, md: 22 },
            fontSize: { xs: 16, md: 20 },
            color: 'rgba(255, 255, 255, 0.35)',
            transition: 'color .3s ease, transform .3s ease',
          }}
        />
      )}
    </Box>
  )
}

/** Accesos directos: mosaico sobre tinta con «Hazte hermano» destacado en granate. */
export default function QuickAccess() {
  const textos = useTextosPortada()
  // El servidor ya mezcla, pero un documento viejo en caché podría no traer una
  // tesela: se cae en el texto de siempre para no pintar una tesela en blanco.
  const textoDe = (clave: string) =>
    textos.accesos.teselas.find((t) => t.clave === clave)
    ?? TEXTOS_POR_DEFECTO.accesos.teselas.find((t) => t.clave === clave)!

  const teselas: Acceso[] = [
    ...ACCESOS,
    ...(site.redes.youtube
      ? [{ clave: 'youtube', icon: <PlayCircleOutlinedIcon fontSize="inherit" />, href: site.redes.youtube }]
      : []),
    CONTACTO,
  ]
  // Las teselas van de dos en dos junto a la placa; si son impares, la última
  // (Contacto) se estira a la fila entera para no dejar hueco.
  const filas = Math.ceil(teselas.length / 2)
  const ultimaAncha = teselas.length % 2 === 1

  return (
    <SeccionAnimada
      cascada
      aria-labelledby="quick-access-title"
      sx={{ py: { xs: 7, md: 11 }, backgroundColor: TINTA }}
    >
      <ContenedorDePagina>
        <Typography id="quick-access-title" component="h2" className="home-visually-hidden">
          Accesos directos
        </Typography>
        <Box
          component="ul"
          role="list"
          aria-labelledby="quick-access-title"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: '1.3fr 1fr 1fr' },
            gap: { xs: 1.25, md: 1.75 },
            maxWidth: 1060,
            mx: 'auto',
          }}
        >
          {/* La placa se descubre de izquierda a derecha; las teselas van creciendo detrás. */}
          <Revela as="li" efecto="desvelar" sx={{ display: 'flex', gridColumn: { xs: '1 / -1', md: '1' }, gridRow: { md: `1 / span ${filas}` } }}>
            <PlacaHazteHermano placa={textos.accesos.placa} />
          </Revela>
          {teselas.map((acceso, i) => {
            const ancha = ultimaAncha && i === teselas.length - 1
            const { titulo, descripcion } = textoDe(acceso.clave)
            return (
              <Revela
                as="li"
                key={acceso.href}
                efecto="crecer"
                orden={i + 1}
                sx={{ display: 'flex', ...(ancha ? { gridColumn: { xs: '1 / -1', md: '2 / -1' } } : {}) }}
              >
                <Tesela icon={acceso.icon} href={acceso.href} title={titulo} description={descripcion} ancha={ancha} />
              </Revela>
            )
          })}
        </Box>
      </ContenedorDePagina>
    </SeccionAnimada>
  )
}
