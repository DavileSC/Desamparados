import { Fragment, Suspense, useContext, useEffect, useId, useState } from 'react'
import { Box, Collapse, Typography } from '@mui/material'
import { bajoElVelo, desktopMq } from '../barra/estilos'
import TituloDeSeccion from '../TituloDeSeccion'
import Hueso from '../esqueleto/Hueso'
import { componenteDeBloque, pintaSuTitulo } from './registro'
import BandaDeFondo, { type Fondo } from './BandaDeFondo'
import { DentroDePliegueContext, PliegueContext } from './pliegue'
import MarcoEditable from './MarcoEditable'
import { useModoEdicion } from './modoEdicion'
import { moduloDeBloque } from './modulos'
import { anchoMaximo, libreDe, siDe, valorDe, visibilidadDe } from './presentacion'
import { GOLD } from '../../features/inicio/estilos'
import { useModulos } from '../../hooks/useModulos'
import { nombreDeModulo, type Modulo } from '../../domain/modulos'
import type { Bloque } from '../../lib/api/contenido'
import { MARCA, alfa } from '../../theme/marca'

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
  const { activo } = useModulos()
  const aPintar = bloques
    .map((bloque, i) => ({ bloque, indice: desde + i }))
    .filter(({ bloque }) => modo !== null || (visibilidadDe(bloque) === 'visible' && activo(moduloDeBloque(bloque))))
  const partes = enPartes(aPintar)
  const pliegues = partes.flatMap((parte) => (parte.pliegue ? [parte.pliegue] : []))
  // Una parte abierta a la vez: de partida, la primera.
  const [abierta, setAbierta] = useState<number | null>(() => pliegues[0]?.indice ?? null)
  const base = useId()

  // Una dirección con el ancla de un pliegue (#trono) abre su parte: al llegar
  // y al pulsar un enlace dentro de la misma página. Bajar hasta ella ya lo
  // hace quien atiende las anclas de la página.
  const anclas = pliegues.map(({ bloque, indice }) => `${indice}:${libreDe(bloque, 'ancla')}`).join('|')
  useEffect(() => {
    if (!anclas) return
    const abrirLaDelAncla = () => {
      const ancla = decodeURIComponent(window.location.hash.slice(1))
      if (!ancla) return
      const suya = anclas.split('|').map((par) => par.split(':')).find(([, a]) => a === ancla)
      if (suya) setAbierta(Number(suya[0]))
    }
    abrirLaDelAncla()
    window.addEventListener('hashchange', abrirLaDelAncla)
    return () => window.removeEventListener('hashchange', abrirLaDelAncla)
  }, [anclas])

  if (aPintar.length === 0) return null

  return (
    <Box>
      {partes.map((parte, p) => {
        const filas = parte.bloques.map(({ bloque, indice }, orden) => (
          // La clave es posicional porque `Bloque` no tiene identificador propio;
          // el prefijo del tipo evita que React reutilice el nodo de un bloque de
          // un tipo para pintar otro distinto. Al reordenar dos bloques del mismo
          // tipo, el estado propio de uno (el vídeo en reproducción de una
          // galería) se queda en su posición: es una rareza visible, no un fallo.
          <BloqueDePagina key={`${bloque.tipo}-${indice}`} bloque={bloque} indice={indice}
            primero={orden === 0 && (p === 0 || parte.pliegue !== undefined)}
            pegado={orden > 0 && mismaFranja(parte.bloques[orden - 1].bloque, bloque)} />
        ))
        if (!parte.pliegue) return <Fragment key={`suelta-${p}`}>{filas}</Fragment>

        const { bloque, indice } = parte.pliegue
        const estaAbierta = abierta === indice
        const idParte = `${base}-parte-${indice}`
        const anteriorEsPliegue = p > 0 && partes[p - 1].pliegue !== undefined
        const ultimaDeLaSerie = !partes[p + 1]?.pliegue
        return (
          <Box key={`pliegue-${indice}`} sx={{
            mt: p === 0 || anteriorEsPliegue ? 0 : ESPACIO.normal,
            borderTop: FILETE, ...(ultimaDeLaSerie && { borderBottom: FILETE }),
          }}>
            <PliegueContext.Provider value={{ abierta: estaAbierta, alternar: () => setAbierta(estaAbierta ? null : indice), idParte }}>
              <BloqueDePagina bloque={bloque} indice={indice} />
            </PliegueContext.Provider>
            {/* En el constructor, todas abiertas: lo que está plegado no se puede editar. */}
            <Collapse in={estaAbierta || modo !== null} unmountOnExit={false}>
              <Box id={idParte} role="region" aria-label={bloque.titulo} sx={{ pt: 1, pb: { xs: 6, md: 9 } }}>
                <DentroDePliegueContext.Provider value>{filas}</DentroDePliegueContext.Provider>
              </Box>
            </Collapse>
          </Box>
        )
      })}
    </Box>
  )
}

/** El filete que separa las partes plegables. */
const FILETE = '1px solid rgba(255, 255, 255, 0.22)'

type APintar = { bloque: Bloque; indice: number }

/**
 * Reparte los bloques en partes: lo que va antes del primer pliegue, suelto, y
 * cada pliegue con los bloques que le siguen hasta el siguiente.
 */
function enPartes(aPintar: APintar[]): { pliegue?: APintar; bloques: APintar[] }[] {
  const partes: { pliegue?: APintar; bloques: APintar[] }[] = []
  for (const item of aPintar) {
    if (item.bloque.tipo === 'pliegue') partes.push({ pliegue: item, bloques: [] })
    else if (partes.length === 0) partes.push({ bloques: [item] })
    else partes[partes.length - 1].bloques.push(item)
  }
  return partes
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
function BloqueDePagina({ bloque, indice = 0, primero = true, pegado = false }: { bloque: Bloque; indice?: number; primero?: boolean; pegado?: boolean }) {
  const modo = useModoEdicion()
  const { activo } = useModulos()
  const dentroDePliegue = useContext(DentroDePliegueContext)
  const modulo = moduloDeBloque(bloque)
  // Un bloque de un módulo apagado no se pinta; en el constructor se dice por qué,
  // para que quien edita no crea que se ha perdido.
  if (modulo !== 'nucleo' && !activo(modulo)) {
    return modo !== null ? <AvisoDeModuloApagado modulo={modulo} bloque={bloque} indice={indice} /> : null
  }
  const Componente = componenteDeBloque(bloque)
  if (!Componente) return null

  const fondo = valorDe(bloque, 'fondo') as Fondo
  const ancla = libreDe(bloque, 'ancla')
  const espacio = ESPACIO[valorDe(bloque, 'espacio') as keyof typeof ESPACIO] ?? ESPACIO.normal
  const centrado = valorDe(bloque, 'alineacionTitulo') === 'centro'

  return (
    <Box id={ancla || undefined} sx={{ mt: primero || pegado ? 0 : espacio, scrollMarginTop: 96, [desktopMq]: { scrollMarginTop: bajoElVelo(16) } }}>
      <MarcoEditable bloque={bloque} indice={indice}>
        {siDe(bloque, 'separador') && (
          <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center', mb: { xs: 4, md: 6 } }}>
            <Box sx={{ width: 56, height: '1px', backgroundColor: alfa(MARCA.acento, 0.6) }} />
            <Box sx={{ width: 7, height: 7, transform: 'rotate(45deg)', border: `1px solid ${GOLD}` }} />
            <Box sx={{ width: 56, height: '1px', backgroundColor: alfa(MARCA.acento, 0.6) }} />
          </Box>
        )}
        <BandaDeFondo fondo={fondo} foto={libreDe(bloque, 'fondoFoto')}>
          {bloque.titulo && !pintaSuTitulo(bloque) && (dentroDePliegue
            // Dentro de una parte plegada el título de la sección es el del
            // pliegue: el de cada bloque baja a subtítulo, en versalitas, a la
            // izquierda de la columna del bloque (la estrecha, si lo es).
            ? <Typography component="h3" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'text.secondary', mb: 2, maxWidth: anchoMaximo(bloque, 'none'), mx: 'auto' }}>{bloque.titulo}</Typography>
            : <TituloDeSeccion title={bloque.titulo} centered={centrado} />)}
          {/*
            El aviso da por hecho que un componente resuelto durante el render se
            acaba de crear ahí, y entonces perdería su estado en cada vuelta. Aquí
            no: `componenteDeBloque` solo busca en `REGISTRO_BLOQUES`, que es una
            constante de módulo con todos los componentes ya declarados. La regla
            no ve a través del índice.
          */}
          {/*
            Un bloque perezoso que aún no ha llegado. En la web no se llega a ver
            (`ConBloquesCargados` espera antes); sí en la vista previa del CMS al
            añadir uno, o donde se pinte un bloque suelto.
          */}
          <Suspense fallback={<Hueso sx={{ height: 200 }} />}>
            {/* eslint-disable-next-line react/static-components */}
            <Componente bloque={bloque as never} />
          </Suspense>
        </BandaDeFondo>
      </MarcoEditable>
    </Box>
  )
}

/** Lo que se ve en el constructor en el lugar de un bloque de un módulo apagado: por qué no sale en la web. */
function AvisoDeModuloApagado({ modulo, bloque, indice }: { modulo: Exclude<Modulo, 'nucleo'>; bloque: Bloque; indice: number }) {
  return (
    <MarcoEditable bloque={bloque} indice={indice}>
      <Box sx={{ p: 2, border: '1px dashed', borderColor: 'warning.main', borderRadius: 1, color: 'text.secondary', fontSize: 14 }}>
        Este bloque es del módulo «{nombreDeModulo(modulo)}», que no está activado: no se enseña en la web.
      </Box>
    </MarcoEditable>
  )
}
