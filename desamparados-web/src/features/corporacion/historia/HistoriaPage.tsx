import MetaDePagina from '../../../components/MetaDePagina'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import CabeceraASangre, { CabeceraASangreEsqueleto } from '../../../components/bloques/CabeceraASangre'
import { cejaDePagina } from '../../../components/bloques/cabecera'
import { useNombresEnMenu } from '../../../hooks/useNombresEnMenu'
import { Revela } from '../../../components/SeccionAnimada'
import BloquesDePagina from '../../../components/bloques/BloquesDePagina'
import MarcoEditable from '../../../components/bloques/MarcoEditable'
import BloqueCronologia from '../../../components/bloques/BloqueCronologia'
import { GOLD, SERIF, ceja, enlaceBloque } from '../../inicio/estilos'
import { useEnlaceVivo } from '../../../hooks/useEnlaceVivo'
import { useBorradorPagina } from '../../../components/bloques/borrador'
import BloquesEsqueleto from '../../../components/bloques/BloquesEsqueleto'
import ConBloquesCargados from '../../../components/bloques/ConBloquesCargados'
import EnCarga from '../../../components/esqueleto/EnCarga'
import { estadoDeConsulta } from '../../../components/esqueleto/esperaDeCarga'
import {
  getContenido,
  type Bloque, type BloqueLlamada, type PaginaDeBloques,
} from '../../../lib/api/contenido'
import { historia } from '../../../../../shared/contenido-por-defecto.json'
import { deLaCorporacion } from '../../../domain/articulos'
import { site } from '../../../config/site'

/** La cronología va en una franja de tinta, un punto más oscura que el fondo. */
const TINTA = 'rgba(12, 11, 13, 0.55)'

/** Un título que solo oye quien usa lector de pantalla. */
const soloLector = { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

/**
 * La página de Historia. Se edita en el CMS como las demás, en «Web pública →
 * Páginas», y se abre con la misma cabecera a sangre, pero lo de debajo tiene
 * maquetación propia: el constructor genérico la habría dejado en una página
 * más.
 *
 * - un bloque de **cronología** va en su franja de tinta (el primero, con un
 *   ancla en cada hito: `/historia#hito-2`). El índice de momentos que
 *   llevaba a la derecha del título se quitó el 28-11-2026: repetía la
 *   cronología de más abajo;
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
  const cejaDeMenu = cejaDePagina('historia', cabecera.titulo, useNombresEnMenu())
  const conAnclas = bloques.findIndex((bloque) => bloque.tipo === 'cronologia')

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
            <Box className="esqueleto-quieto"><CabeceraASangreEsqueleto ceja={cejaDeMenu} titulo={cabecera.titulo} /></Box>
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
                <CabeceraASangreEsqueleto ceja={cejaDeMenu} />
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
        <CabeceraASangre
          titulo={cabecera.titulo}
          subtitulo={cabecera.subtitulo}
          foto={cabecera.foto}
          fotoAlt={cabecera.fotoAlt}
          encuadre={cabecera.encuadre}
          ceja={cejaDeMenu}
        />

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
              conAnclas={posicion === conAnclas}
            />
          ))}
        </ConBloquesCargados>
      </Box>
    </>
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
      <Box component="section" aria-labelledby={idTitulo} sx={{ backgroundColor: TINTA, py: { xs: 8, md: 13 } }}>
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
  const enlaceVivo = useEnlaceVivo()
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
          {enlaceVivo(bloque.enlace) && (
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
