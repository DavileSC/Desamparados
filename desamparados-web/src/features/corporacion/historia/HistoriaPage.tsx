import MetaDePagina from '../../../components/MetaDePagina'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import FondoDePagina from '../../../components/FondoDePagina'
import { Revela } from '../../../components/SeccionAnimada'
import BloquesDePagina from '../../../components/bloques/BloquesDePagina'
import BloqueCronologia from '../../../components/bloques/BloqueCronologia'
import { idDeHito } from '../../../components/bloques/cronologia'
import { GOLD, SERIF, ceja, enlaceBloque } from '../../inicio/estilos'
import { esDestinoValido } from '../../../lib/destinos'
import { useBorradorPagina } from '../../../components/bloques/borrador'
import {
  getContenido,
  type Bloque, type BloqueCronologia as Cronologia, type BloqueLlamada, type PaginaDeBloques,
} from '../../../lib/api/contenido'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'

// Mismo umbral que el navbar (`DESKTOP_NAV_MIN`): desde ahí la barra es fija de
// 72 px y se pone encima de la página, así que la cabecera la deja pasar.
const ESCRITORIO = '@media (min-width:1024px)'

/** La cronología va en tinta translúcida: sigue siendo un bloque y deja pasar el velo. */
const TINTA_VELADA = 'rgba(29, 27, 30, 0.55)'
const FILETE = 'rgba(204, 196, 201, 0.22)'
const FILETE_LEVE = 'rgba(204, 196, 201, 0.1)'

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
  const { data } = useQuery({
    queryKey: ['contenido', 'historia'],
    queryFn: () => getContenido<PaginaDeBloques>('historia'),
    retry: false,
    staleTime: 5 * 60_000,
    enabled: borrador === null,
  })
  // Mientras carga y si falla, la historia de siempre: la página no puede
  // quedarse en blanco porque el servidor tarde o no conteste.
  const { cabecera, bloques } = borrador ?? data ?? (POR_DEFECTO.historia as PaginaDeBloques)
  const conIndice = bloques.findIndex((bloque) => bloque.tipo === 'cronologia')
  const hitosDelIndice = conIndice === -1 ? [] : (bloques[conIndice] as Cronologia).hitos

  return (
    <>
      {/* En la vista previa, la pestaña sigue siendo la del CMS. */}
      {!borrador && <MetaDePagina
        titulo={cabecera.titulo}
        descripcion="Historia del Grupo Parroquial de Nuestra Señora de los Desamparados: de la devoción en la Parroquia de los Padres Pasionistas a la salida procesional del Sábado de Pasión por Málaga."
      />}

      <Box sx={{ position: 'relative', isolation: 'isolate', '& a:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 4 } }}>
        {cabecera.foto !== '' && <FondoDePagina url={cabecera.foto} />}

        <Box component="header" sx={{ pt: { xs: 8, md: 14 }, pb: { xs: 7, md: 12 }, [ESCRITORIO]: { pt: 'calc(72px + 96px)' } }}>
          <ContenedorDePagina>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 380px' },
                columnGap: { md: 8 },
                rowGap: 5,
                alignItems: 'end',
              }}
            >
              <Box>
                {cabecera.ceja && <Revela><Typography component="span" sx={ceja}>{cabecera.ceja}</Typography></Revela>}
                <Revela efecto="cortina" orden={1}>
                  <Typography
                    component="h1"
                    sx={{ fontFamily: SERIF, fontSize: 'clamp(56px, 8vw, 104px)', lineHeight: 1, letterSpacing: '-0.025em' }}
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

        {bloques.map((bloque, posicion) => (
          <BloqueDeHistoria
            key={`${bloque.tipo}-${posicion}`}
            bloque={bloque}
            idTitulo={`historia-bloque-${posicion + 1}`}
            conAnclas={posicion === conIndice}
          />
        ))}
      </Box>
    </>
  )
}

/** Cada bloque de Historia, con el aspecto que le toca en esta página. */
function BloqueDeHistoria({ bloque, idTitulo, conAnclas }: { bloque: Bloque; idTitulo: string; conAnclas: boolean }) {
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

  return (
    <Box component="section" sx={{ py: { xs: 8, md: 12 } }}>
      <ContenedorDePagina>
        <Box sx={{ maxWidth: 1072, mx: 'auto' }}>
          <BloquesDePagina bloques={[bloque]} />
        </Box>
      </ContenedorDePagina>
    </Box>
  )
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
