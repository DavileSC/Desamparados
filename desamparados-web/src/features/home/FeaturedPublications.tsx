import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import PageContainer from '../../components/PageContainer'
import AnimatedSection, { Revela } from '../../components/AnimatedSection'
import { getLatestPublications } from '../../lib/api/publications'
import type { PublicationItem } from '../../types'
import { useHomeData } from './useHomeData'
import HomeFeedback from './HomeFeedback'
import { GOLD, GRANATE, PAPEL, SERIF, TINTA, ceja } from './estilos'

const CATEGORIAS: Record<PublicationItem['category'], { nombre: string; corto: string }> = {
  boletin: { nombre: 'Boletín informativo', corto: 'boletín' },
  anuario: { nombre: 'Anuario', corto: 'anuario' },
  dossier: { nombre: 'Dossier', corto: 'dossier' },
  historia: { nombre: 'Historia', corto: 'documento' },
}

// Un color fijo por tipo de publicación: la cubierta dice qué es antes de leerla.
const CUBIERTAS: Record<PublicationItem['category'], { fondo: string; texto: string; cifra: string }> = {
  boletin: { fondo: GRANATE, texto: '#fbe9e7', cifra: '#fbe9e7' },
  anuario: { fondo: PAPEL, texto: '#3a3538', cifra: GRANATE },
  dossier: { fondo: '#3a3437', texto: '#e3d8bf', cifra: GOLD },
  historia: { fondo: PAPEL, texto: '#3a3538', cifra: GRANATE },
}

const mes = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { month: 'long' })
// Tres letras siempre («jun», no «jun.»): la abreviatura de cada motor varía.
const mesCorto = (iso: string) => mes(iso).slice(0, 3)
const anio = (iso: string) => new Date(iso).getFullYear()

/** La cifra grande de la cubierta: el número del boletín («n.º 12»), el curso de un anuario («25·26») o, si no, el año. */
function cifra(publicacion: PublicationItem) {
  const numero = publicacion.title.match(/n\.?\s*º\s*(\d+)/i)
  if (numero) return numero[1]
  const curso = publicacion.title.match(/(\d{4})\s*[-–/]\s*(\d{4})/)
  if (curso) return `${curso[1].slice(2)}·${curso[2].slice(2)}`
  return String(anio(publicacion.date))
}

const versal = { fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase' } as const

// El antetítulo es el h2 de la sección: `.home-refined h2` (home.css) le pondría 40 px sin el !important.
const cejaTitulo = { ...ceja, fontSize: '11px !important', fontFamily: 'inherit', lineHeight: 1.5 } as const

const boton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1.25,
  minHeight: 48,
  px: 3,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  transition: 'background-color .25s ease, border-color .25s ease, color .25s ease',
} as const

/** Tapa del ejemplar: la portada subida desde el CMS o, sin ella, una cubierta tipográfica del color de su tipo. */
function Cubierta({ publicacion, pequena = false }: { publicacion: PublicationItem; pequena?: boolean }) {
  if (publicacion.image) {
    return <Box component="img" src={publicacion.image} alt="" sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
  }
  const colores = CUBIERTAS[publicacion.category]
  const texto = cifra(publicacion)
  const larga = texto.length > 3
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', p: pequena ? 2.25 : { xs: 2.5, md: 3 }, backgroundColor: colores.fondo, color: colores.texto }}>
      <Box component="span" sx={{ ...versal, fontSize: pequena ? 9 : 11 }}>{CATEGORIAS[publicacion.category].nombre}</Box>
      <Box
        component="span"
        sx={{ fontFamily: SERIF, lineHeight: 0.9, color: colores.cifra, fontSize: pequena ? 30 : larga ? { xs: 56, md: 64 } : { xs: 96, md: 112 } }}
      >
        {texto}
      </Box>
      <Box component="span" sx={{ ...versal, fontSize: pequena ? 9 : 11 }}>{mes(publicacion.date)} · {anio(publicacion.date)}</Box>
    </Box>
  )
}

// Canto de las hojas: sombras escalonadas de un píxel que imitan el taco de papel.
const CANTO = '1px 1px 0 #e6dfd2, 2px 2px 0 #cfc6b6, 3px 3px 0 #e6dfd2, 4px 4px 0 #cfc6b6, 5px 5px 0 #e6dfd2, 6px 6px 0 #c4baa8'
const CURVA = 'cubic-bezier(.2, .7, .2, 1)'
const INCLINACION = 'rotateY(-22deg) rotateX(4deg)'

const escena = {
  position: 'relative',
  display: 'block',
  height: { xs: 380, md: 480 },
  perspective: '1800px',
  '& .ejemplar': {
    position: 'absolute',
    width: { xs: 236, md: 270 },
    aspectRatio: '3 / 4',
    transformStyle: 'preserve-3d',
    transition: `transform .6s ${CURVA}`,
  },
  '& .hojas': {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, #d9d1c2, #f4efe6 8%, #f7f3ec)',
    boxShadow: CANTO,
  },
  '& .tapa': {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    transformOrigin: 'left center',
    transition: `transform .7s ${CURVA}`,
    // El pliegue del lomo, a la izquierda de la tapa.
    '&::after': { content: '""', position: 'absolute', inset: 0, boxShadow: 'inset 7px 0 10px -6px rgba(0, 0, 0, 0.55)', pointerEvents: 'none' },
  },
  '& .ejemplar-1': { left: { xs: '50%', md: 150 }, ml: { xs: '-118px', md: 0 }, top: { xs: 20, md: 34 }, zIndex: 3, transform: `${INCLINACION} rotateZ(1deg)` },
  // Detrás, en abanico, las dos anteriores. En móvil no caben: solo el ejemplar de delante.
  '& .ejemplar-2': { display: { xs: 'none', md: 'block' }, left: 56, top: 20, zIndex: 2, filter: 'brightness(.7)', transform: `${INCLINACION} rotateZ(-5deg)` },
  '& .ejemplar-3': { display: { xs: 'none', md: 'block' }, left: -40, top: 10, zIndex: 1, filter: 'brightness(.5)', transform: `${INCLINACION} rotateZ(-10deg)` },
  // Solo con ratón: la tapa se entreabre y asoma el interior.
  '@media (hover: hover)': {
    '&:hover .ejemplar-1': { transform: `rotateY(-14deg) rotateX(3deg) translateY(-8px)` },
    '&:hover .ejemplar-1 .tapa': { transform: 'rotateY(-58deg)' },
  },
} as const

// Renglones del sumario que asoma al abrir la tapa: decorado, sin texto que leer.
const renglones = {
  position: 'absolute',
  inset: '30px 26px 26px 34px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  '& i': { display: 'block', height: 6, backgroundColor: 'rgba(29, 27, 30, 0.1)' },
  '& i:nth-of-type(3n)': { width: '70%' },
} as const

/** El boletín como objeto: el último de frente y, detrás, los dos anteriores. */
function Ejemplares({ destacada, anteriores }: { destacada: PublicationItem; anteriores: PublicationItem[] }) {
  const contenido = (
    <>
      <Box sx={{ position: 'absolute', left: { xs: '15%', md: 40 }, right: { xs: '15%', md: 10 }, bottom: { xs: 6, md: 18 }, height: 40, background: 'radial-gradient(closest-side, rgba(0, 0, 0, 0.65), transparent)', filter: 'blur(4px)' }} />
      {anteriores.map((publicacion, indice) => (
        <Box key={publicacion.id} data-testid="ejemplar-anterior" className={`ejemplar ejemplar-${indice + 2}`}>
          <Box className="hojas" />
          <Box className="tapa"><Cubierta publicacion={publicacion} pequena /></Box>
        </Box>
      ))}
      <Box className="ejemplar ejemplar-1">
        <Box className="hojas">
          <Box sx={renglones}>{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</Box>
        </Box>
        <Box className="tapa" data-testid="portada-publicacion"><Cubierta publicacion={destacada} /></Box>
      </Box>
    </>
  )

  // Todo lo que dice ya está en el texto de al lado: para el lector de pantalla es decorado.
  // Con ratón, pinchar el ejemplar también descarga; el teclado usa el botón.
  return destacada.fileUrl ? (
    <Box component="a" href={destacada.fileUrl} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" sx={escena}>
      {contenido}
    </Box>
  ) : (
    <Box aria-hidden="true" sx={escena}>{contenido}</Box>
  )
}

/** Publicaciones: bloque de tinta con la última publicación en 3D y el resto en lista. */
export default function FeaturedPublications() {
  const { data: publications = [], isPending, isError, refetch } = useHomeData('publications', getLatestPublications)
  const [destacada, ...resto] = publications
  const otras = resto.slice(0, 2)

  return (
    <AnimatedSection
      cascada
      aria-labelledby="publicaciones-titulo"
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
          display: { xs: 'none', md: 'grid' },
          placeItems: 'center',
          position: 'absolute',
          left: 26,
          top: 0,
          bottom: 0,
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          fontWeight: 700,
          fontSize: 50,
          letterSpacing: '0.3em',
          color: 'rgba(255, 255, 255, 0.05)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        DESAMPARADOS
      </Box>
      {/* El texto empieza donde acaba la marca de agua: con la página a 1440 px o menos,
          los 64 px de margen la dejarían debajo del título. */}
      <PageContainer sx={{ position: 'relative', pl: { md: 'max(64px, calc(128px - max(0px, (100vw - 1440px) / 2)))' } }}>
        {destacada ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 440px' }, gap: { xs: 4, lg: 7 }, alignItems: 'center' }}>
            <Revela sx={{ order: { xs: -1, lg: 0 }, gridColumn: { lg: 2 }, gridRow: { lg: 1 }, width: '100%', maxWidth: 440, mx: { xs: 'auto', md: 0 }, ml: { md: 5, lg: 0 } }}>
              <Ejemplares destacada={destacada} anteriores={otras} />
            </Revela>
            <Box sx={{ gridColumn: { lg: 1 }, gridRow: { lg: 1 } }}>
              <Revela orden={1}>
                <Typography id="publicaciones-titulo" component="h2" sx={cejaTitulo}>
                  Publicaciones · {mes(destacada.date)} {anio(destacada.date)}
                </Typography>
                <Typography variant="h3" component="h3" sx={{ fontFamily: SERIF, fontSize: { xs: 34, md: 52 }, lineHeight: 1.06, letterSpacing: '-0.015em', color: '#fff', textWrap: 'balance' }}>
                  {destacada.title}
                </Typography>
                {destacada.description && (
                  <Typography sx={{ mt: 2.5, maxWidth: 470, fontSize: 16, lineHeight: 1.7, color: '#d9d5d0' }}>
                    {destacada.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 3.75 }}>
                  {destacada.fileUrl && (
                    <Box
                      component="a"
                      href={destacada.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ ...boton, backgroundColor: PAPEL, color: '#1b1c1a', '&:hover': { backgroundColor: '#fff' } }}
                    >
                      <FileDownloadOutlinedIcon sx={{ fontSize: 20 }} />
                      Descargar {CATEGORIAS[destacada.category].corto}
                      <span className="home-visually-hidden"> (PDF, nueva pestaña)</span>
                    </Box>
                  )}
                  <Box
                    component={Link}
                    to="/publicaciones"
                    sx={{ ...boton, border: '1px solid rgba(255, 255, 255, 0.7)', color: '#fff', '&:hover': { borderColor: GOLD, color: GOLD } }}
                  >
                    Archivo de publicaciones
                  </Box>
                </Box>
              </Revela>
              {otras.length > 0 && (
                <Revela orden={2}>
                  <Box
                    component="ul"
                    aria-label="Otras publicaciones"
                    sx={{ listStyle: 'none', m: 0, mt: 5, p: 0, maxWidth: 520, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 0, sm: 3 } }}
                  >
                    {otras.map(publicacion => (
                      <Box component="li" key={publicacion.id}>
                        <Box
                          component="a"
                          href={publicacion.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            display: 'block',
                            py: 1.75,
                            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.14)',
                            textDecoration: 'none',
                            transition: 'box-shadow .25s ease',
                            '&:hover': { boxShadow: `inset 0 1px 0 ${GOLD}` },
                            '&:hover .titulo': { color: GOLD },
                          }}
                        >
                          <Box component="span" sx={{ display: 'block', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a79fa4' }}>
                            {mesCorto(publicacion.date)} {anio(publicacion.date)}
                          </Box>
                          <Box component="span" className="titulo" sx={{ display: 'block', mt: 0.75, fontFamily: SERIF, fontSize: 17, lineHeight: 1.3, color: '#f2f0ed', transition: 'color .25s ease' }}>
                            {publicacion.title}
                          </Box>
                          <span className="home-visually-hidden"> (PDF, nueva pestaña)</span>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Revela>
              )}
            </Box>
          </Box>
        ) : (
          <Box sx={{ maxWidth: 640 }}>
            <Typography id="publicaciones-titulo" component="h2" sx={cejaTitulo}>Publicaciones</Typography>
            <HomeFeedback loading={isPending} error={isError} empty={!publications.length} label="las publicaciones" emptyMessage="No hay publicaciones disponibles por el momento." retry={() => { void refetch() }} />
          </Box>
        )}
      </PageContainer>
    </AnimatedSection>
  )
}
