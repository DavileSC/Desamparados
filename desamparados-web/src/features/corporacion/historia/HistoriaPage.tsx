import MetaDePagina from '../../../components/MetaDePagina'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import FondoDePagina from '../../../components/FondoDePagina'
import { Revela } from '../../../components/SeccionAnimada'
import BloquesDePagina from '../../../components/bloques/BloquesDePagina'
import MarcoEditable from '../../../components/bloques/MarcoEditable'
import BloqueCronologia from '../../../components/bloques/BloqueCronologia'
import { idDeHito } from '../../../components/bloques/cronologia'
import { GOLD, SERIF, ceja, enlaceBloque } from '../../inicio/estilos'
import { esDestinoValido } from '../../../lib/destinos'
import { useBorradorPagina } from '../../../components/bloques/borrador'
import BloquesEsqueleto from '../../../components/bloques/BloquesEsqueleto'
import ConBloquesCargados from '../../../components/bloques/ConBloquesCargados'
import EnCarga, { estadoDeConsulta } from '../../../components/esqueleto/EnCarga'
import { Lineas } from '../../../components/esqueleto/Hueso'
import {
  getContenido,
  type Bloque, type BloqueCronologia as Cronologia, type BloqueLlamada, type PaginaDeBloques,
} from '../../../lib/api/contenido'
import { historia } from '../../../../../shared/contenido-por-defecto.json'
import { deLaCorporacion } from '../../../domain/articulos'
import { site } from '../../../config/site'

// Mismo umbral que el navbar (`DESKTOP_NAV_MIN`): desde ahí la barra es fija de
// 72 px y se pone encima de la página, así que la cabecera la deja pasar.
const ESCRITORIO = '@media (min-width:1024px)'

/** La cronología va en tinta translúcida: sigue siendo un bloque y deja pasar el velo. */
const TINTA_VELADA = 'rgba(12, 11, 13, 0.55)'
const FILETE = 'rgba(204, 196, 201, 0.22)'
const FILETE_LEVE = 'rgba(204, 196, 201, 0.1)'

/** La cabecera: la comparten la página y su esqueleto. */
const cabeceraSx = { pt: { xs: 8, md: 14 }, pb: { xs: 7, md: 12 }, [ESCRITORIO]: { pt: 'calc(72px + 96px)' } } as const
const cabeceraRejilla = {
  display: 'grid',
  gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 380px' },
  columnGap: { md: 8 },
  rowGap: 5,
  alignItems: 'end',
} as const
const TITULO = 'clamp(56px, 8vw, 104px)'

/** Un título que solo oye quien usa lector de pantalla. */
const soloLector = { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

/**
 * La página de Historia. Se edita en el CMS como las demás, en «Web pública →
 * Páginas», pero no se pinta como las demás: tiene maquetación propia (la foto
 * velada detrás de todo, el titular grande, el índice de momentos) y el
 * constructor genérico la habría dejado en una página más.
 *
 * Así que la edición es la común y el aspecto es el suyo:
 *
 * - la **cabecera** del documento es la de siempre: su foto es el fondo velado
 *   y su ceja, el rótulo de encima del título;
 * - un bloque de **cronología** va en su franja de tinta, y el primero forma el
 *   índice de la cabecera;
 * - un bloque de **llamada** es el cierre: su texto es el rótulo pequeño, su
 *   título la frase grande y su botón el enlace con flecha;
 * - cualquier otro bloque se pinta como en el resto de la web.
 */
export default function HistoriaPage() {
  // En la vista previa del CMS, lo que se está escribiendo; fuera, lo guardado.
  const borrador = useBorradorPagina()
  const consulta = useQuery({
    queryKey: ['contenido', 'historia'],
    queryFn: () => getContenido<PaginaDeBloques>('historia'),
    retry: false,
    staleTime: 5 * 60_000,
    enabled: borrador === null,
  })
  const guardada = borrador ?? consulta.data
  // Mientras llega, la cabecera y el cuerpo en esqueleto, y si no llega, el
  // aviso (como en las demás páginas de bloques). La de partida solo da el
  // título de la pestaña.
  const { cabecera, bloques } = guardada ?? (historia as PaginaDeBloques)
  const conIndice = bloques.findIndex((bloque) => bloque.tipo === 'cronologia')
  const hitosDelIndice = conIndice === -1 ? [] : (bloques[conIndice] as Cronologia).hitos

  const meta = !borrador && (
    <MetaDePagina
      titulo={cabecera.titulo}
      // La entradilla de la cabecera, como en las demás páginas de bloques
      // (PaginaDeBloquesPublica): el resumen que había aquí contaba la historia
      // de una corporación concreta, y la de cada instalación la escribe ella.
      descripcion={cabecera.subtitulo || `Historia ${deLaCorporacion()} de ${site.titular}.`}
    />
  )

  if (!guardada) {
    const reintentar = () => { void consulta.refetch() }
    return (
      <>
        {meta}
        {estadoDeConsulta(consulta) === 'error' ? (
          <>
            <Box className="esqueleto-quieto"><CabeceraEsqueleto /></Box>
            <Box sx={{ pb: { xs: 8, md: 12 } }}>
              <ContenedorDePagina>
                <EnCarga avisoArriba estado="error" que="esta página" alReintentar={reintentar} esqueleto={<BloquesEsqueleto />} />
              </ContenedorDePagina>
            </Box>
          </>
        ) : (
          <EnCarga
            estado="cargando"
            que="esta página"
            alReintentar={reintentar}
            esqueleto={(
              <>
                <CabeceraEsqueleto />
                <Box sx={{ pb: { xs: 8, md: 12 } }}><ContenedorDePagina><BloquesEsqueleto /></ContenedorDePagina></Box>
              </>
            )}
          />
        )}
      </>
    )
  }

  return (
    <>
      {/* En la vista previa, la pestaña sigue siendo la del CMS. */}
      {meta}

      <Box sx={{ position: 'relative', isolation: 'isolate', overflowX: 'clip', '& a:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 4 } }}>
        {cabecera.foto !== '' && <FondoDePagina url={cabecera.foto} />}

        <Box component="header" sx={cabeceraSx}>
          <ContenedorDePagina>
            <Box sx={cabeceraRejilla}>
              <Box>
                {cabecera.ceja && <Revela><Typography component="span" sx={ceja}>{cabecera.ceja}</Typography></Revela>}
                <Revela efecto="cortina" orden={1}>
                  <Typography
                    component="h1"
                    sx={{ fontFamily: SERIF, fontSize: TITULO, lineHeight: 1, letterSpacing: '-0.025em' }}
                  >
                    {cabecera.titulo}
                  </Typography>
                </Revela>
                <Revela orden={2}>
                  <Typography sx={{ mt: { xs: 2.5, md: 3.5 }, fontSize: { xs: 17, md: 20 }, lineHeight: 1.5, color: 'text.secondary', maxWidth: '34ch' }}>
                    {cabecera.subtitulo}
                  </Typography>
                </Revela>
              </Box>

              {/* Índice de los momentos: cada línea lleva a su hito. */}
              {hitosDelIndice.length > 0 && (
                <Revela efecto="crecer" orden={3}>
                  <Box component="nav" aria-label="Momentos de la historia" sx={{ borderTop: `1px solid ${FILETE}`, pt: 1 }}>
                    {hitosDelIndice.map((hito, indice) => (
                      <Box
                        key={idDeHito(indice)}
                        component="a"
                        href={`#${idDeHito(indice)}`}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 3,
                          py: 1.25,
                          borderBottom: `1px solid ${FILETE_LEVE}`,
                          fontSize: 14,
                          color: '#cbc5c8',
                          transition: 'color .25s ease',
                          '& b': { fontWeight: 600, color: '#fff' },
                          '&:hover': { color: GOLD },
                          '&:hover b': { color: GOLD },
                        }}
                      >
                        <b>{hito.periodo}</b>
                        <span>{hito.etiqueta}</span>
                      </Box>
                    ))}
                  </Box>
                </Revela>
              )}
            </Box>
          </ContenedorDePagina>
        </Box>

        <ConBloquesCargados
          bloques={bloques}
          esqueleto={<Box sx={{ pb: { xs: 8, md: 12 } }}><ContenedorDePagina><BloquesEsqueleto /></ContenedorDePagina></Box>}
        >
          {bloques.map((bloque, posicion) => (
            <BloqueDeHistoria
              key={`${bloque.tipo}-${posicion}`}
              bloque={bloque}
              posicion={posicion}
              idTitulo={`historia-bloque-${posicion + 1}`}
              conAnclas={posicion === conIndice}
            />
          ))}
        </ConBloquesCargados>
      </Box>
    </>
  )
}

/**
 * La cabecera mientras llega la historia: la ceja, el titular grande, la
 * entradilla y el índice de momentos, en huesos del tamaño de los de verdad.
 */
function CabeceraEsqueleto() {
  return (
    <Box component="header" sx={cabeceraSx}>
      <ContenedorDePagina>
        <Box sx={cabeceraRejilla}>
          <Box>
            <Box sx={{ mb: 1.75 }}><Lineas anchos={['140px']} linea={16.5} grosor={9} /></Box>
            <Lineas anchos={['min(70%, 520px)']} linea={TITULO} grosor={`calc(${TITULO} * 0.62)`} />
            <Box sx={{ mt: { xs: 2.5, md: 3.5 }, maxWidth: '34ch' }}>
              <Lineas anchos={['96%', '58%']} linea={{ xs: 25.5, md: 30 }} grosor={{ xs: 10, md: 12 }} />
            </Box>
          </Box>
          <Box sx={{ borderTop: `1px solid ${FILETE}`, pt: 1 }}>
            {[0, 1, 2, 3].map((i) => (
              <Box key={i} sx={{ py: 1.25, borderBottom: `1px solid ${FILETE_LEVE}` }}>
                <Lineas anchos={[`${88 - i * 9}%`]} linea={21} grosor={9} />
              </Box>
            ))}
          </Box>
        </Box>
      </ContenedorDePagina>
    </Box>
  )
}

/** Cada bloque de Historia, con el aspecto que le toca en esta página. */
function BloqueDeHistoria({ bloque, posicion, idTitulo, conAnclas }: { bloque: Bloque; posicion: number; idTitulo: string; conAnclas: boolean }) {
  // La cronología y el cierre tienen su maquetación aquí: el marco editable
  // (oculto, programado, pulsable en el constructor) se les pone a mano. Los
  // demás lo llevan dentro de `BloquesDePagina`.
  if (bloque.tipo === 'cronologia' || bloque.tipo === 'llamada') {
    return <MarcoEditable bloque={bloque} indice={posicion}><BloqueEspecial bloque={bloque} idTitulo={idTitulo} conAnclas={conAnclas} /></MarcoEditable>
  }
  return (
    <Box component="section" sx={{ py: { xs: 8, md: 12 } }}>
      <ContenedorDePagina>
        <Box sx={{ maxWidth: 1072, mx: 'auto' }}>
          <BloquesDePagina bloques={[bloque]} desde={posicion} />
        </Box>
      </ContenedorDePagina>
    </Box>
  )
}

function BloqueEspecial({ bloque, idTitulo, conAnclas }: { bloque: Bloque; idTitulo: string; conAnclas: boolean }) {
  if (bloque.tipo === 'cronologia') {
    return (
      <Box component="section" aria-labelledby={idTitulo} sx={{ backgroundColor: TINTA_VELADA, py: { xs: 8, md: 13 } }}>
        {/* El título no se ve: la franja y el raíl ya dicen qué es. */}
        <Typography id={idTitulo} component="h2" sx={soloLector}>{bloque.titulo || 'Cronología'}</Typography>
        <ContenedorDePagina>
          <BloqueCronologia bloque={bloque} conAnclas={conAnclas} />
        </ContenedorDePagina>
      </Box>
    )
  }

  if (bloque.tipo === 'llamada') return <Cierre bloque={bloque} idTitulo={idTitulo} />
  return null
}

/** El cierre de la página: rótulo, frase grande y un enlace con flecha. */
function Cierre({ bloque, idTitulo }: { bloque: BloqueLlamada; idTitulo: string }) {
  return (
    <Box component="section" aria-labelledby={bloque.titulo ? idTitulo : undefined} sx={{ py: { xs: 8, md: 12 } }}>
      <ContenedorDePagina>
        <Box
          sx={{
            maxWidth: 1072,
            mx: 'auto',
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
            gap: { xs: 4, md: 6 },
            alignItems: 'end',
          }}
        >
          <Revela>
            {bloque.texto && <Typography component="span" sx={ceja}>{bloque.texto}</Typography>}
            {bloque.titulo && (
              <Typography id={idTitulo} component="h2" sx={{ fontFamily: SERIF, fontSize: { xs: 28, md: 34 }, lineHeight: 1.2, letterSpacing: '-0.01em', maxWidth: '20ch' }}>
                {bloque.titulo}
              </Typography>
            )}
          </Revela>
          {/* Como en BloqueLlamada: un destino que no existe no se pinta. */}
          {esDestinoValido(bloque.enlace) && (
            <Revela orden={1}>
              <Box component={Link} to={bloque.enlace} sx={enlaceBloque}>
                {bloque.boton} <ArrowForwardIcon />
              </Box>
            </Revela>
          )}
        </Box>
      </ContenedorDePagina>
    </Box>
  )
}
