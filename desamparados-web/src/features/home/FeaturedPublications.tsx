import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
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

const mes = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { month: 'long' })
// Tres letras siempre («jun», no «jun.»): la abreviatura de cada motor varía.
const mesCorto = (iso: string) => mes(iso).slice(0, 3)
const anio = (iso: string) => new Date(iso).getFullYear()

/** La cifra grande de la portada: el número del boletín («n.º 12») o, si no lo lleva, el año. */
function cifra(publicacion: PublicationItem) {
  const numero = publicacion.title.match(/n\.?\s*º\s*(\d+)/i)
  return numero ? numero[1] : String(anio(publicacion.date))
}

const versal = { fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase' } as const

// El antetítulo es el h2 de la sección: `.home-refined h2` (home.css) le pondría 40 px sin el !important.
const cejaTitulo = { ...ceja, fontSize: '11px !important', fontFamily: 'inherit', lineHeight: 1.5 } as const

const boton = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 48,
  px: 3,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  transition: 'background-color .25s ease, border-color .25s ease, color .25s ease',
} as const

function Portada({ publicacion }: { publicacion: PublicationItem }) {
  return (
    <Box
      data-testid="portada-publicacion"
      sx={{ aspectRatio: '3 / 4', width: '100%', maxWidth: 330, mx: { xs: 'auto', md: 0 }, boxShadow: '18px 18px 0 #3a3538' }}
    >
      {publicacion.image ? (
        <Box component="img" src={publicacion.image} alt="" sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        // Sin portada, una cubierta tipográfica: nunca queda un hueco vacío.
        <Box aria-hidden="true" sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', p: { xs: 3, md: 3.5 }, backgroundColor: GRANATE, color: '#fbe9e7' }}>
          <Box component="span" sx={versal}>{CATEGORIAS[publicacion.category].nombre}</Box>
          <Box component="span" sx={{ fontFamily: SERIF, fontSize: { xs: 96, md: 120 }, lineHeight: 0.9 }}>{cifra(publicacion)}</Box>
          <Box component="span" sx={versal}>{mes(publicacion.date)} · {anio(publicacion.date)}</Box>
        </Box>
      )}
    </Box>
  )
}

/** Publicaciones: bloque de tinta con la última publicación destacada y el resto en lista. */
export default function FeaturedPublications() {
  const { data: publications = [], isPending, isError, refetch } = useHomeData('publications', getLatestPublications)
  const [destacada, ...resto] = publications

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
      <PageContainer sx={{ position: 'relative' }}>
        {destacada ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '330px 1fr' }, gap: { xs: 6, md: 8 }, alignItems: 'center' }}>
            <Revela><Portada publicacion={destacada} /></Revela>
            <Box>
              <Revela orden={1}>
                <Typography id="publicaciones-titulo" component="h2" sx={cejaTitulo}>Publicaciones</Typography>
                <Typography variant="h3" component="h3" sx={{ fontFamily: SERIF, fontSize: { xs: 32, md: 44 }, lineHeight: 1.1, color: '#fff', textWrap: 'balance' }}>
                  {destacada.title}
                </Typography>
                {destacada.description && (
                  <Typography sx={{ mt: 2.25, maxWidth: 480, fontSize: 15, lineHeight: 1.7, color: '#d9d5d0' }}>
                    {destacada.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 3.25 }}>
                  {destacada.fileUrl && (
                    <Box
                      component="a"
                      href={destacada.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ ...boton, backgroundColor: PAPEL, color: '#1b1c1a', '&:hover': { backgroundColor: '#fff' } }}
                    >
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
              {resto.length > 0 && (
                <Revela orden={2}>
                  <Box component="ul" aria-label="Otras publicaciones" sx={{ listStyle: 'none', m: 0, mt: 4.25, p: 0, maxWidth: 520 }}>
                    {resto.slice(0, 2).map(publicacion => (
                      <Box component="li" key={publicacion.id} sx={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12)' }}>
                        <Box
                          component="a"
                          href={publicacion.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, py: 1.75, color: '#f2f0ed', textDecoration: 'none', fontFamily: SERIF, fontSize: 17, transition: 'color .25s ease', '&:hover': { color: GOLD } }}
                        >
                          {publicacion.title}
                          <Box component="span" sx={{ fontFamily: '"Hanken Grotesk", sans-serif', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a79fa4', whiteSpace: 'nowrap' }}>
                            {mesCorto(publicacion.date)} {anio(publicacion.date)}
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
