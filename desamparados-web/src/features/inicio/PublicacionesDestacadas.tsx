import { Box, Typography } from '@mui/material'
import { BOTON } from '../../components/estiloDeBoton'
import { Link } from 'react-router-dom'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import SeccionAnimada, { Revela } from '../../components/SeccionAnimada'
import { publicacionesDePortada } from '../../lib/api/publicaciones'
import type { Publicacion } from '../../types'
import { useDatosDePortada } from './useDatosDePortada'
import { usePortadaEnCarga, useTextosPortada } from './useContenidoPortada'
import TextoDePortada from './TextoDePortada'
import AvisosDeInicio from './AvisosDeInicio'
import CintaDestacada from './CintaDestacada'
import EnCarga from '../../components/esqueleto/EnCarga'
import { estadoDeConsulta } from '../../components/esqueleto/esperaDeCarga'
import Hueso, { Lineas } from '../../components/esqueleto/Hueso'
import { GOLD, GRANATE, PAPEL, SERIF, TINTA, ceja } from './estilos'
import { site } from '../../config/site'
import { useModulos } from '../../hooks/useModulos'
import { propsDeFoto } from '../../lib/fotoSubida'
import { MARCA, componentes } from '../../theme/marca'

const CATEGORIAS: Record<Publicacion['categoria'], { nombre: string; corto: string }> = {
  boletin: { nombre: 'Boletín informativo', corto: 'boletín' },
  anuario: { nombre: 'Anuario', corto: 'anuario' },
  dossier: { nombre: 'Dossier', corto: 'dossier' },
  historia: { nombre: 'Historia', corto: 'documento' },
}

// Un color fijo por tipo de publicación: la cubierta dice qué es antes de leerla.
// `velo` es el fondo en «r, g, b», para el degradado que va sobre la foto.
const CUBIERTAS: Record<Publicacion['categoria'], { fondo: string; velo: string; texto: string; cifra: string }> = {
  boletin: { fondo: GRANATE, velo: componentes(MARCA.principal), texto: MARCA.sobrePrincipal, cifra: MARCA.sobrePrincipal },
  anuario: { fondo: PAPEL, velo: '247, 243, 236', texto: '#242125', cifra: GRANATE },
  dossier: { fondo: '#242125', velo: '36, 33, 37', texto: '#e3d8bf', cifra: GOLD },
  historia: { fondo: PAPEL, velo: '247, 243, 236', texto: '#242125', cifra: GRANATE },
}

const mes = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { month: 'long' })
// Tres letras siempre («jun», no «jun.»): la abreviatura de cada motor varía.
const mesCorto = (iso: string) => mes(iso).slice(0, 3)
const anio = (iso: string) => new Date(iso).getFullYear()

/** La cifra grande de la cubierta: el número del boletín («n.º 12»), el curso de un anuario («25·26») o, si no, el año. */
function cifra(publicacion: Publicacion) {
  const numero = publicacion.titulo.match(/n\.?\s*º\s*(\d+)/i)
  if (numero) return numero[1]
  const curso = publicacion.titulo.match(/(\d{4})\s*[-–/]\s*(\d{4})/)
  if (curso) return `${curso[1].slice(2)}·${curso[2].slice(2)}`
  return String(anio(publicacion.fecha))
}

const versal = { fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase' } as const

// El antetítulo es el h2 de la sección: `.home-refined h2` (home.css) le pondría 40 px sin el !important.
const cejaTitulo = { ...ceja, fontSize: '11px !important', fontFamily: 'inherit', lineHeight: 1.5 } as const

/**
 * Tapa del ejemplar. Con la portada subida desde el CMS, cabecera de revista:
 * la foto a sangre y, encima, el nombre del tipo en grande, una línea con el
 * Grupo y la fecha, y el número abajo; el velo del color del tipo deja leerlos
 * y dice qué es. Sola, la foto parecía una foto enmarcada y no un boletín.
 * Sin portada, una cubierta tipográfica del color de su tipo.
 */
function Cubierta({ publicacion, pequena = false }: { publicacion: Publicacion; pequena?: boolean }) {
  const colores = CUBIERTAS[publicacion.categoria]
  const texto = cifra(publicacion)
  if (publicacion.imagen) {
    const velo = (opacidad: number) => `rgba(${colores.velo}, ${opacidad})`
    return (
      <Box sx={{ position: 'relative', height: '100%', color: colores.texto }}>
        <Box component="img" {...propsDeFoto(publicacion.imagen, '(min-width: 900px) 400px, 100vw')} alt="" sx={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
        <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${velo(0.88)} 0%, ${velo(0.4)} 22%, ${velo(0)} 38%, ${velo(0)} 70%, ${velo(0.75)} 100%)` }} />
        <Box sx={{ position: 'relative', px: pequena ? 1.75 : 2, pt: 1.5 }}>
          <Box
            component="span"
            sx={{ display: 'block', fontFamily: SERIF, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', textTransform: 'uppercase', fontSize: pequena ? 40 : { xs: 34, md: 44 } }}
          >
            {CATEGORIAS[publicacion.categoria].nombre.split(' ')[0]}
          </Box>
          <Box
            component="span"
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 0.75, pt: 0.75, borderTop: '1px solid currentColor', fontSize: pequena ? 9 : { xs: 8, md: 9 }, letterSpacing: pequena ? '0.2em' : { xs: '0.15em', md: '0.2em' }, textTransform: 'uppercase', whiteSpace: 'nowrap' }}
          >
            <span>{site.tipo}</span>
            <span>{mesCorto(publicacion.fecha)} · {anio(publicacion.fecha)}</span>
          </Box>
        </Box>
        <Box
          component="span"
          sx={{ position: 'absolute', left: pequena ? 14 : 18, bottom: pequena ? 12 : 16, fontFamily: SERIF, fontWeight: 500, lineHeight: 1, color: colores.cifra, fontSize: pequena ? 28 : { xs: 36, md: 44 } }}
        >
          {publicacion.categoria === 'boletin' && <Box component="small" sx={{ fontSize: '0.4em', mr: 0.5, letterSpacing: '0.05em' }}>n.º</Box>}
          {texto}
        </Box>
      </Box>
    )
  }
  const larga = texto.length > 3
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', p: pequena ? 2.25 : { xs: 2.5, md: 3 }, backgroundColor: colores.fondo, color: colores.texto }}>
      <Box component="span" sx={{ ...versal, fontSize: pequena ? 9 : 11 }}>{CATEGORIAS[publicacion.categoria].nombre}</Box>
      <Box
        component="span"
        sx={{ fontFamily: SERIF, lineHeight: 0.9, color: colores.cifra, fontSize: pequena ? 30 : larga ? { xs: 56, md: 64 } : { xs: 96, md: 112 } }}
      >
        {texto}
      </Box>
      <Box component="span" sx={{ ...versal, fontSize: pequena ? 9 : 11 }}>{mes(publicacion.fecha)} · {anio(publicacion.fecha)}</Box>
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
  height: { xs: 330, md: 480 },
  perspective: '1800px',
  '& .ejemplar': {
    position: 'absolute',
    width: { xs: 208, md: 270 },
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
  '& .ejemplar-1': { left: { xs: '50%', md: 110, lg: 150 }, ml: { xs: '-104px', md: 0 }, top: { xs: 20, md: 34 }, zIndex: 3, transform: `${INCLINACION} rotateZ(1deg)` },
  // Detrás, en abanico, las dos anteriores. En móvil no caben: solo el ejemplar de delante.
  '& .ejemplar-2': { display: { xs: 'none', md: 'block' }, left: { md: 36, lg: 56 }, top: 20, zIndex: 2, filter: 'brightness(.7)', transform: `${INCLINACION} rotateZ(-5deg)` },
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
  '& i': { display: 'block', height: 6, backgroundColor: 'rgba(12, 11, 13, 0.1)' },
  '& i:nth-of-type(3n)': { width: '70%' },
} as const

/** El boletín como objeto: el último de frente y, detrás, los dos anteriores. */
function Ejemplares({ destacada, anteriores }: { destacada: Publicacion; anteriores: Publicacion[] }) {
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
  return destacada.archivoUrl ? (
    <Box component="a" href={destacada.archivoUrl} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" sx={escena}>
      {contenido}
    </Box>
  ) : (
    <Box aria-hidden="true" sx={escena}>{contenido}</Box>
  )
}

// El texto a la izquierda y el ejemplar a la derecha; en el móvil, el ejemplar
// arriba. Los comparten el bloque y su esqueleto.
const rejilla = { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 380px', lg: '1fr 440px' }, gap: { xs: 4, md: 5, lg: 7 }, alignItems: 'center' } as const
const columnaDelEjemplar = { position: 'relative', order: { xs: -1, md: 0 }, gridColumn: { md: 2 }, gridRow: { md: 1 }, width: '100%', maxWidth: 440, mx: { xs: 'auto', md: 0 } } as const
const columnaDelTexto = { gridColumn: { md: 1 }, gridRow: { md: 1 } } as const

const visualmenteOculto = {
  position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: 0, border: 0,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
} as const

/**
 * El bloque mientras llegan las publicaciones: el ejemplar ya en su postura,
 * en blanco, y a su lado la ceja, el título, la descripción, los dos botones y
 * las dos anteriores, en huesos del tamaño de los de verdad.
 */
function PublicacionesEsqueleto() {
  return (
    <Box sx={rejilla}>
      <Box sx={columnaDelEjemplar}>
        <Box sx={escena}>
          <Box className="ejemplar ejemplar-1">
            <Hueso sx={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
          </Box>
        </Box>
      </Box>
      <Box sx={columnaDelTexto}>
        <Box sx={{ mb: 1.75 }}><Lineas anchos={['220px']} linea={16.5} grosor={9} /></Box>
        <Lineas anchos={['88%', '52%']} linea={{ xs: 36, md: 46.6, lg: 55.1 }} grosor={{ xs: 22, md: 28, lg: 34 }} />
        <Box sx={{ mt: 2.5, maxWidth: 470 }}><Lineas anchos={['96%', '60%']} linea={27.2} grosor={11} /></Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 3.75 }}>
          <Hueso sx={{ width: 200, height: 48, borderRadius: 0 }} />
          <Hueso sx={{ width: 236, height: 48, borderRadius: 0 }} />
        </Box>
        <Box sx={{ mt: 5, maxWidth: 520, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 0, sm: 3 } }}>
          {[0, 1].map((i) => (
            <Box key={i} sx={{ py: 1.75, boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.14)' }}>
              <Lineas anchos={['64px']} linea={16.5} grosor={8} />
              <Box sx={{ mt: 0.75 }}><Lineas anchos={['80%']} linea={22.1} grosor={12} /></Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

/**
 * Publicaciones: bloque de tinta con una publicación en 3D y el resto en lista.
 *
 * El puesto grande es de la destacada, si se ha destacado alguna en el CMS, y
 * si no de la más reciente: el servidor las manda ya en ese orden.
 */
export default function PublicacionesDestacadas() {
  const { activos, activo } = useModulos()
  // La lista llega en milisegundos y en esta instalación todo está encendido:
  // mejor un esqueleto mientras no se sabe que un hueco que luego crece.
  const apagado = activos !== null && !activo('publicaciones')
  const consulta = useDatosDePortada('publicaciones', publicacionesDePortada, activos !== null && activo('publicaciones'))
  const { data: publicaciones = [], isPending, isError, refetch } = consulta
  const textos = useTextosPortada()
  const enCarga = usePortadaEnCarga()
  const [destacada, ...resto] = publicaciones
  const otras = resto.slice(0, 2)
  if (apagado) return null

  return (
    <SeccionAnimada
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
        {/* Decorativa y en vertical: mientras cargan los textos, nada (un hueso tumbado no dice nada). */}
        {!enCarga && textos.publicaciones.marcaDeAgua}
      </Box>
      {/* El texto empieza donde acaba la marca de agua: con la página a 1440 px o menos,
          los 64 px de margen la dejarían debajo del título. */}
      <ContenedorDePagina sx={{ position: 'relative', pl: { md: 'max(64px, calc(128px - max(0px, (100vw - 1440px) / 2)))' } }}>
        {destacada ? (
          <Box sx={rejilla}>
            {/* Los ejemplares son el objeto del bloque: crecen al posarse. En tableta
                apaisada ya van al lado del texto: encima dejaban media pantalla vacía. */}
            <Revela efecto="crecer" sx={columnaDelEjemplar}>
              {/* Sobre el ejemplar, que es lo que hace de portada aquí. */}
              {destacada.fijada && <CintaDestacada />}
              <Ejemplares destacada={destacada} anteriores={otras} />
            </Revela>
            <Box sx={columnaDelTexto}>
              <Revela orden={1}>
                <Typography id="publicaciones-titulo" component="h2" sx={cejaTitulo}>
                  Publicaciones · {mes(destacada.fecha)} {anio(destacada.fecha)}
                </Typography>
              </Revela>
              <Revela efecto="cortina" orden={2}>
                <Typography variant="h3" component="h3" sx={{ fontFamily: SERIF, fontSize: { xs: 34, md: 44, lg: 52 }, lineHeight: 1.06, letterSpacing: '-0.015em', color: '#fff', textWrap: 'balance' }}>
                  {destacada.titulo}
                </Typography>
              </Revela>
              <Revela orden={3}>
                {destacada.descripcion && (
                  <Typography sx={{ mt: 2.5, maxWidth: 470, fontSize: 16, lineHeight: 1.7, color: '#d9d5d0' }}>
                    {destacada.descripcion}
                  </Typography>
                )}
                {/* Apilados, a lo ancho: dos anchos distintos uno encima del otro parecían descolocados.
                    Pasa en el móvil y en la columna estrecha de la tableta apaisada. */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 3.75, '& > a': { flex: { xs: '1 1 100%', sm: '0 0 auto', md: '1 1 100%', lg: '0 0 auto' } } }}>
                  {destacada.archivoUrl && (
                    <Box
                      component="a"
                      href={destacada.archivoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={BOTON.claro}
                    >
                      Descargar {CATEGORIAS[destacada.categoria].corto}
                      <span className="home-visually-hidden"> (PDF, nueva pestaña)</span>
                    </Box>
                  )}
                  <Box
                    component={Link}
                    to="/publicaciones"
                    sx={BOTON.oscuro}
                  >
                    <TextoDePortada anchos={['10em']}>{textos.publicaciones.boton}</TextoDePortada>
                  </Box>
                </Box>
              </Revela>
              {otras.length > 0 && (
                <Revela orden={4}>
                  <Box
                    component="ul"
                    aria-label="Otras publicaciones"
                    sx={{ listStyle: 'none', m: 0, mt: 5, p: 0, maxWidth: 520, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 0, sm: 3 } }}
                  >
                    {otras.map(publicacion => (
                      <Box component="li" key={publicacion.id}>
                        <Box
                          component="a"
                          href={publicacion.archivoUrl}
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
                            {mesCorto(publicacion.fecha)} {anio(publicacion.fecha)}
                          </Box>
                          <Box component="span" className="titulo" sx={{ display: 'block', mt: 0.75, fontFamily: SERIF, fontSize: 17, lineHeight: 1.3, color: '#f2f0ed', transition: 'color .25s ease' }}>
                            {publicacion.titulo}
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
        ) : isPending || isError ? (
          <>
            <Typography id="publicaciones-titulo" component="h2" sx={visualmenteOculto}>Publicaciones</Typography>
            <EnCarga estado={estadoDeConsulta(consulta)} que="las publicaciones" alReintentar={() => { void refetch() }} esqueleto={<PublicacionesEsqueleto />} />
          </>
        ) : (
          <Box sx={{ maxWidth: 640 }}>
            <Typography id="publicaciones-titulo" component="h2" sx={cejaTitulo}>Publicaciones</Typography>
            <AvisosDeInicio mensaje="No hay publicaciones disponibles por el momento." />
          </Box>
        )}
      </ContenedorDePagina>
    </SeccionAnimada>
  )
}
