import { Box, Typography } from '@mui/material'
import { BOTON } from '../../components/estiloDeBoton'
import { Link } from 'react-router-dom'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import SeccionAnimada, { Revela } from '../../components/SeccionAnimada'
import { publicacionesDePortada } from '../../lib/api/publicaciones'
import type { Publicacion, TintaDePortada, TintaDeZona } from '../../types'
import TINTAS from '../../../../shared/tinta-de-portada.json'
import { CORMORANT } from '../actualidad/agenda/letraAlmanaque'
import { useDatosDePortada } from './useDatosDePortada'
import { usePortadaEnCarga, useTextosPortada } from './useContenidoPortada'
import TextoDePortada from './TextoDePortada'
import AvisosDeInicio from './AvisosDeInicio'
import CintaDestacada from './CintaDestacada'
import EnCarga from '../../components/esqueleto/EnCarga'
import { estadoDeConsulta } from '../../components/esqueleto/esperaDeCarga'
import Hueso, { Lineas } from '../../components/esqueleto/Hueso'
import { GOLD, GRANATE, SERIF, TINTA, ceja } from './estilos'
import { site } from '../../config/site'
import { useModulos } from '../../hooks/useModulos'
import { propsDeFoto } from '../../lib/fotoSubida'
import { alfa } from '../../theme/marca'

const CATEGORIAS: Record<Publicacion['categoria'], { nombre: string; corto: string }> = {
  boletin: { nombre: 'Boletín informativo', corto: 'boletín' },
  anuario: { nombre: 'Anuario', corto: 'anuario' },
  dossier: { nombre: 'Dossier', corto: 'dossier' },
  historia: { nombre: 'Historia', corto: 'documento' },
}

// Las de la cubierta: las mismas con que la API mide el contraste al guardar.
const LETRA: Record<TintaDeZona['letra'], string> = { clara: TINTAS.letraClara, oscura: TINTAS.letraOscura }
const VELO: Record<TintaDeZona['letra'], string> = { clara: TINTAS.veloOscuro, oscura: TINTAS.veloClaro }
// Con foto pero sin tinta calculada (no se pudo leer): letra clara con un velo
// que se lee sobre casi todo, como la sombra que llevaba la tapa antes.
const TINTA_DE_SIEMPRE: TintaDePortada = { arriba: { letra: 'clara', velo: 0.5 }, abajo: { letra: 'clara', velo: 0.5 } }
const SIN_FOTO: TintaDePortada = { arriba: { letra: 'oscura', velo: 0 }, abajo: { letra: 'oscura', velo: 0 } }
// El papel de la tapa sin foto: crema, ni el blanco de la web ni un color por tipo.
const PAPEL_DE_TAPA = TINTAS.veloClaro

const mes = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { month: 'long' })
// Tres letras siempre («jun», no «jun.»): la abreviatura de cada motor varía.
const mesCorto = (iso: string) => mes(iso).slice(0, 3)
const anio = (iso: string) => new Date(iso).getFullYear()

/** Lo que identifica el ejemplar al pie: el número del boletín («N.º 12»), el curso de un anuario («2025 – 2026») o, si no, el año. */
function referencia(publicacion: Publicacion) {
  const numero = publicacion.titulo.match(/n\.?\s*º\s*(\d+)/i)
  if (numero) return `N.º ${numero[1]}`
  const curso = publicacion.titulo.match(/(\d{4})\s*[-–/]\s*(\d{4})/)
  if (curso) return `${curso[1]} – ${curso[2]}`
  return String(anio(publicacion.fecha))
}

// El antetítulo es el h2 de la sección: `.home-refined h2` (home.css) le pondría 40 px sin el !important.
const cejaTitulo = { ...ceja, fontSize: '11px !important', fontFamily: 'inherit', lineHeight: 1.5 } as const

const versalitas = { fontFamily: SERIF, fontWeight: 500, textTransform: 'uppercase' } as const

/**
 * Velo bajo el texto de una zona: lleno donde va la letra y se apaga hacia la
 * foto. `hacia` es el borde de la tapa del que sale.
 */
function velo({ letra, velo: opacidad }: TintaDeZona, hacia: 'arriba' | 'abajo') {
  if (opacidad <= 0) return 'none'
  const lleno = alfa(VELO[letra], opacidad)
  const nada = alfa(VELO[letra], 0)
  return hacia === 'arriba'
    ? `linear-gradient(180deg, ${lleno} 0, ${lleno} 20%, ${nada} 36%)`
    : `linear-gradient(0deg, ${lleno} 0, ${lleno} 12%, ${nada} 26%)`
}

/**
 * Tapa del ejemplar, «foto callada»: la foto entera manda y el texto va
 * pequeño en dos sitios, el nombre arriba y número y fecha abajo. La letra de
 * cada sitio (clara u oscura) y el velo justo para leerla los calcula la API
 * con la foto (`tintaPortada`), así una foto limpia queda sin sombra. Sin
 * portada, papel crema con la letra oscura.
 */
function Cubierta({ publicacion }: { publicacion: Publicacion }) {
  const tinta = publicacion.imagen ? (publicacion.tintaPortada ?? TINTA_DE_SIEMPRE) : SIN_FOTO
  const mesLargo = mes(publicacion.fecha)
  return (
    <Box sx={{ position: 'relative', height: '100%', overflow: 'hidden', backgroundColor: publicacion.imagen ? TINTA : PAPEL_DE_TAPA }}>
      {publicacion.imagen && (
        <Box component="img" {...propsDeFoto(publicacion.imagen, '(min-width: 900px) 300px, 240px')} alt="" sx={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      <Box sx={{ position: 'absolute', inset: 0, background: velo(tinta.arriba, 'arriba') }} />
      <Box sx={{ position: 'absolute', inset: 0, background: velo(tinta.abajo, 'abajo') }} />
      <Box sx={{ position: 'absolute', left: { xs: 16, md: 18 }, top: { xs: 16, md: 18 }, color: LETRA[tinta.arriba.letra] }}>
        <Box component="span" sx={{ display: 'block', fontFamily: CORMORANT, fontStyle: 'italic', fontWeight: 500, fontSize: { xs: 27, md: 32 }, lineHeight: 1 }}>
          {CATEGORIAS[publicacion.categoria].nombre.split(' ')[0]}
        </Box>
        <Box component="span" sx={{ ...versalitas, display: 'block', mt: 0.75, fontSize: { xs: 7.5, md: 8.5 }, letterSpacing: '0.3em' }}>{site.tipo}</Box>
      </Box>
      <Box
        sx={{
          ...versalitas,
          position: 'absolute',
          left: { xs: 16, md: 18 },
          right: { xs: 16, md: 18 },
          bottom: { xs: 13, md: 15 },
          display: 'flex',
          justifyContent: 'space-between',
          gap: 1,
          pt: 0.75,
          borderTop: '1px solid currentColor',
          fontSize: { xs: 8, md: 9 },
          letterSpacing: '0.2em',
          whiteSpace: 'nowrap',
          color: LETRA[tinta.abajo.letra],
        }}
      >
        <span>{referencia(publicacion)}</span>
        <span>{mesLargo.charAt(0).toUpperCase() + mesLargo.slice(1)} {anio(publicacion.fecha)}</span>
      </Box>
    </Box>
  )
}

// Canto de las hojas: sombras escalonadas de un píxel que imitan el taco de papel.
const CANTO = '1px 1px 0 #e6dfd2, 2px 2px 0 #cfc6b6, 3px 3px 0 #e6dfd2, 4px 4px 0 #cfc6b6'
const CURVA = 'cubic-bezier(.2, .7, .2, 1)'
// En reposo, apenas girado: de frente del todo parecía una foto pegada.
const REPOSO = 'rotateY(-9deg) rotateX(2deg)'
const GIRO = `transform .8s ${CURVA}`

const escena = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: { xs: 400, md: 520 },
  perspective: '1400px',
  // Luz de cera detrás del libro: lo separa del fondo sin marco ni tarjeta.
  '& .halo': {
    position: 'absolute',
    left: '50%',
    top: '44%',
    width: { xs: 380, md: 520 },
    aspectRatio: '1',
    transform: 'translate(-50%, -50%)',
    background: `radial-gradient(circle, ${alfa(GOLD, 0.13)} 0%, ${alfa(GOLD, 0.05)} 35%, ${alfa(GOLD, 0)} 65%)`,
    pointerEvents: 'none',
  },
  '& .libro': {
    position: 'relative',
    width: { xs: 220, md: 272 },
    aspectRatio: '3 / 4',
    transformStyle: 'preserve-3d',
    transform: REPOSO,
    transition: GIRO,
  },
  '& .hojas': {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, #d9d1c2, #f4efe6 8%, #f7f3ec)',
    boxShadow: `${CANTO}, 0 50px 70px -36px rgba(0, 0, 0, 1)`,
  },
  '& .tapa': {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    transformOrigin: 'left center',
    transition: GIRO,
    boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.07)',
    // El pliegue del lomo y el brillo de la luz, encima de la foto.
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.4) 0, rgba(0, 0, 0, 0) 12px), linear-gradient(115deg, rgba(255, 240, 200, 0.16) 0%, rgba(255, 240, 200, 0) 34%)',
      pointerEvents: 'none',
    },
  },
  // El reflejo es el mismo libro volteado bajo el de verdad: así también se abre.
  // Lleva su propia perspectiva porque la máscara aplana lo que tiene dentro.
  '& .reflejo': {
    position: 'relative',
    width: { xs: 220, md: 272 },
    height: { xs: 80, md: 120 },
    mt: '6px',
    overflow: 'hidden',
    perspective: '1400px',
    opacity: 0.22,
    maskImage: 'linear-gradient(180deg, #000 0%, transparent 80%)',
    transform: REPOSO,
    transition: GIRO,
    '& .libro': { position: 'absolute', top: 0, left: 0, transformOrigin: 'top', transform: 'translateY(100%) scaleY(-1)', transition: 'none' },
  },
  // Solo con ratón: el libro se pone de frente y la tapa se abre.
  '@media (hover: hover)': {
    '&:hover > .libro, &:hover > .reflejo': { transform: 'none' },
    '&:hover .tapa': { transform: 'rotateY(-58deg)' },
  },
  '@media (prefers-reduced-motion: reduce)': {
    '& .libro, & .reflejo, & .tapa': { transition: 'none' },
  },
} as const

// Renglones del sumario que asoma al abrir la tapa: decorado, sin texto que leer.
const renglones = {
  position: 'absolute',
  inset: '34px 28px 28px 38px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  '& i': { display: 'block', height: 6, backgroundColor: 'rgba(12, 11, 13, 0.1)' },
  '& i:nth-of-type(3n)': { width: '70%' },
  '& i:first-of-type': { height: 10, width: '55%', mb: '6px', backgroundColor: alfa(GRANATE, 0.55) },
} as const

function Libro({ publicacion, conTestId = false }: { publicacion: Publicacion; conTestId?: boolean }) {
  return (
    <Box className="libro">
      <Box className="hojas">
        <Box sx={renglones}>{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</Box>
      </Box>
      <Box className="tapa" data-testid={conTestId ? 'portada-publicacion' : undefined}><Cubierta publicacion={publicacion} /></Box>
    </Box>
  )
}

/** El último número, solo, con la luz detrás y su reflejo en el suelo. */
function Ejemplar({ destacada }: { destacada: Publicacion }) {
  const contenido = (
    <>
      <Box className="halo" />
      <Libro publicacion={destacada} conTestId />
      <Box className="reflejo"><Libro publicacion={destacada} /></Box>
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

/**
 * La tapa en pequeño de las anteriores: solo la foto, o el papel si no tiene.
 * A este tamaño las letras no se leen; el tipo ya lo dice la fila.
 */
function Miniatura({ publicacion }: { publicacion: Publicacion }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{ position: 'relative', display: 'block', width: 44, aspectRatio: '3 / 4', overflow: 'hidden', backgroundColor: publicacion.imagen ? TINTA : PAPEL_DE_TAPA, boxShadow: '0 6px 14px rgba(0, 0, 0, 0.5)' }}
    >
      {publicacion.imagen && (
        <Box component="img" {...propsDeFoto(publicacion.imagen, '44px')} alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </Box>
  )
}

// El texto a la izquierda y el ejemplar a la derecha; en el móvil, el ejemplar
// arriba. Los comparten el bloque y su esqueleto.
const rejilla = { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 380px', lg: '1fr 440px' }, gap: { xs: 4, md: 5, lg: 7 }, alignItems: 'center' } as const
const columnaDelEjemplar = { position: 'relative', order: { xs: -1, md: 0 }, gridColumn: { md: 2 }, gridRow: { md: 1 }, width: '100%', maxWidth: 440, mx: { xs: 'auto', md: 0 } } as const
const columnaDelTexto = { gridColumn: { md: 1 }, gridRow: { md: 1 } } as const

// Las anteriores, una por fila y con su tapa en pequeño: ya no están detrás del
// libro, y la tapa las reconoce antes de leer el título.
const listaDeOtras = { listStyle: 'none', m: 0, mt: 4.5, p: 0, maxWidth: 540, borderBottom: '1px solid rgba(255, 255, 255, 0.12)' } as const
const filaDeOtra = {
  display: 'grid',
  gridTemplateColumns: '44px minmax(0, 1fr) auto',
  gap: 2.25,
  alignItems: 'center',
  py: 1.5,
  borderTop: '1px solid rgba(255, 255, 255, 0.12)',
} as const

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
          <Box className="libro">
            <Hueso sx={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
          </Box>
          {/* El hueco del reflejo: sin él, el libro llegaría más abajo y saltaría al cargar. */}
          <Box className="reflejo" sx={{ opacity: 0 }} />
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
        <Box sx={listaDeOtras}>
          {[0, 1].map((i) => (
            <Box key={i} sx={filaDeOtra}>
              <Hueso sx={{ width: 44, aspectRatio: '3 / 4', borderRadius: 0 }} />
              <Box>
                <Lineas anchos={['120px']} linea={16.5} grosor={8} />
                <Box sx={{ mt: 0.5 }}><Lineas anchos={['80%']} linea={22.1} grosor={12} /></Box>
              </Box>
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
            {/* El ejemplar es el objeto del bloque: crece al posarse. En tableta
                apaisada ya va al lado del texto: encima dejaba media pantalla vacía. */}
            <Revela efecto="crecer" sx={columnaDelEjemplar}>
              {/* Sobre el ejemplar, que es lo que hace de portada aquí. */}
              {destacada.fijada && <CintaDestacada />}
              <Ejemplar destacada={destacada} />
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
                    sx={listaDeOtras}
                  >
                    {otras.map(publicacion => (
                      <Box component="li" key={publicacion.id}>
                        <Box
                          component="a"
                          href={publicacion.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            ...filaDeOtra,
                            textDecoration: 'none',
                            '&:hover .titulo': { color: GOLD },
                          }}
                        >
                          <Miniatura publicacion={publicacion} />
                          <Box component="span">
                            <Box component="span" sx={{ display: 'block', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a79fa4' }}>
                              {CATEGORIAS[publicacion.categoria].nombre.split(' ')[0]} · {mesCorto(publicacion.fecha)} {anio(publicacion.fecha)}
                            </Box>
                            <Box component="span" className="titulo" sx={{ display: 'block', mt: 0.5, fontFamily: SERIF, fontSize: 17, lineHeight: 1.3, color: '#f2f0ed', transition: 'color .25s ease' }}>
                              {publicacion.titulo}
                            </Box>
                          </Box>
                          <Box component="span" aria-hidden="true" sx={{ fontSize: 11, letterSpacing: '0.14em', color: '#a79fa4' }}>PDF</Box>
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
