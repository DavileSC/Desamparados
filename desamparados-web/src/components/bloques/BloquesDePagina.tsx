import { Box } from '@mui/material'
import TituloDeSeccion from '../TituloDeSeccion'
import { componenteDeBloque, pintaSuTitulo } from './registro'
import BandaDeFondo, { type Fondo } from './BandaDeFondo'
import MarcoEditable from './MarcoEditable'
import { useModoEdicion } from './modoEdicion'
import { libreDe, siDe, valorDe, visibilidadDe } from './presentacion'
import { GOLD } from '../../features/inicio/estilos'
import type { Bloque } from '../../lib/api/contenido'

/** El aire encima de un bloque, según su espaciado. `normal` es el de siempre. */
const ESPACIO = {
  compacto: { xs: 3, md: 4 },
  normal: { xs: 5, md: 8 },
  amplio: { xs: 8, md: 13 },
} as const

/**
 * Pinta los bloques de una página en su orden.
 *
 * Un tipo que no esté en el registro se salta en vez de tirar la página entera:
 * el servidor ya lo rechaza al guardar, pero un documento guardado antes de
 * retirar un tipo del catálogo seguiría en la base.
 *
 * Los que hoy no se ven (ocultos o fuera de sus fechas) se quitan antes de
 * repartir el aire entre bloques: si no, el primero visible heredaría el hueco
 * de encima de uno que no está. En la vista en vivo del CMS se ven todos.
 *
 * `desde` es la posición del primero en el documento: Historia pinta sus
 * bloques de uno en uno y así cada uno sigue sabiendo cuál es.
 */
export default function BloquesDePagina({ bloques, desde = 0 }: { bloques: Bloque[]; desde?: number }) {
  const modo = useModoEdicion()
  const aPintar = bloques
    .map((bloque, i) => ({ bloque, indice: desde + i }))
    .filter(({ bloque }) => modo !== null || visibilidadDe(bloque) === 'visible')
  if (aPintar.length === 0) return null

  return (
    <Box>
      {aPintar.map(({ bloque, indice }, orden) => (
        // La clave es posicional porque `Bloque` no tiene identificador propio;
        // el prefijo del tipo evita que React reutilice el nodo de un bloque de
        // un tipo para pintar otro distinto. Al reordenar dos bloques del mismo
        // tipo, el estado propio de uno (el vídeo en reproducción de una
        // galería) se queda en su posición: es una rareza visible, no un fallo.
        <BloqueDePagina key={`${bloque.tipo}-${indice}`} bloque={bloque} indice={indice} primero={orden === 0}
          pegado={orden > 0 && mismaFranja(aPintar[orden - 1].bloque, bloque)} />
      ))}
    </Box>
  )
}

/**
 * Dos bloques seguidos con la misma franja de color forman una sola: sin el
 * aire de entre bloques, que dejaría una tira del fondo de la página cortando
 * la franja. La foto no cuenta: cada una lleva la suya.
 */
function mismaFranja(anterior: Bloque, bloque: Bloque): boolean {
  const fondo = valorDe(bloque, 'fondo')
  return fondo !== 'ninguno' && fondo !== 'foto' && fondo === valorDe(anterior, 'fondo') && !siDe(bloque, 'separador')
}

/**
 * Un bloque con su presentación: el aire de encima, el separador, la franja de
 * color, el ancla y su título de sección. Lo usa también la vista en vivo del
 * CMS, para que un bloque se pinte exactamente como dentro de la página.
 */
export function BloqueDePagina({ bloque, indice = 0, primero = true, pegado = false }: { bloque: Bloque; indice?: number; primero?: boolean; pegado?: boolean }) {
  const Componente = componenteDeBloque(bloque)
  if (!Componente) return null

  const fondo = valorDe(bloque, 'fondo') as Fondo
  const ancla = libreDe(bloque, 'ancla')
  const espacio = ESPACIO[valorDe(bloque, 'espacio') as keyof typeof ESPACIO] ?? ESPACIO.normal
  const centrado = valorDe(bloque, 'alineacionTitulo') === 'centro'

  return (
    <Box id={ancla || undefined} sx={{ mt: primero || pegado ? 0 : espacio, scrollMarginTop: 96 }}>
      <MarcoEditable bloque={bloque} indice={indice}>
        {siDe(bloque, 'separador') && (
          <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center', mb: { xs: 4, md: 6 } }}>
            <Box sx={{ width: 56, height: '1px', backgroundColor: 'rgba(222, 199, 43, 0.6)' }} />
            <Box sx={{ width: 7, height: 7, transform: 'rotate(45deg)', border: `1px solid ${GOLD}` }} />
            <Box sx={{ width: 56, height: '1px', backgroundColor: 'rgba(222, 199, 43, 0.6)' }} />
          </Box>
        )}
        <BandaDeFondo fondo={fondo} foto={libreDe(bloque, 'fondoFoto')}>
          {bloque.titulo && !pintaSuTitulo(bloque) && <TituloDeSeccion title={bloque.titulo} centered={centrado} />}
          {/*
            El aviso da por hecho que un componente resuelto durante el render se
            acaba de crear ahí, y entonces perdería su estado en cada vuelta. Aquí
            no: `componenteDeBloque` solo busca en `REGISTRO_BLOQUES`, que es una
            constante de módulo con todos los componentes ya declarados. La regla
            no ve a través del índice.
          */}
          {/* eslint-disable-next-line react/static-components */}
          <Componente bloque={bloque as never} />
        </BandaDeFondo>
      </MarcoEditable>
    </Box>
  )
}
