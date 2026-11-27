import { useEffect } from 'react'
import { Box } from '@mui/material'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ContenedorDePagina from '../ContenedorDePagina'
import MetaDePagina from '../MetaDePagina'
import SeccionAnimada from '../SeccionAnimada'
import BloquesDePagina from './BloquesDePagina'
import CabeceraASangre, { CabeceraASangreEsqueleto } from './CabeceraASangre'
import BloquesEsqueleto from './BloquesEsqueleto'
import ConBloquesCargados from './ConBloquesCargados'
import EnCarga from '../esqueleto/EnCarga'
import { estadoDeConsulta } from '../esqueleto/esperaDeCarga'
import { cejaDePagina } from './cabecera'
import { useBorradorPagina } from './borrador'
import { useNombresEnMenu } from '../../hooks/useNombresEnMenu'
import CATALOGO from '../../../../shared/paginas-publicas.json'
import { getContenido, type PaginaDeBloques, type SlugContenido } from '../../lib/api/contenido'
import { SECCION_TRAS_CABECERA } from '../espaciado'

/**
 * Una página pública compuesta por bloques: su cabecera y, debajo, lo que el
 * CMS haya puesto.
 *
 * Es el mismo componente para todas porque lo único que las distingue es su
 * slug. Antes cada una llevaba su texto escrito dentro del `.tsx` y cambiar un
 * párrafo exigía tocar código y desplegar.
 *
 * La cabecera es la misma en todas: la foto a todo el ancho con el título
 * encima (`CabeceraASangre`). Agenda y Cultos no llevaban ninguna e Historia
 * una suya, hasta que el 28-11-2026 se igualaron: cada página tiene su
 * carácter de la cabecera abajo, pero todas se abren igual.
 *
 * El título de la pestaña sale de la cabecera del documento, así que también se
 * edita desde el CMS. Era lo que ya decía cada página («Cultos | Desamparados»),
 * pero escrito a mano en dos sitios que podían separarse.
 *
 * La descripción para buscadores sale del subtítulo, por lo mismo: es la frase
 * que ya resume la página, se escribe en el CMS y el esquema la limita a 200
 * caracteres, que es lo que cabe en un resultado de búsqueda. Sin esto, las 22
 * páginas de bloques compartían la descripción de `index.html` y en Google se
 * leían todas igual.
 *
 * Mientras llega el documento, la cabecera y el cuerpo van en esqueleto; si no
 * llega, la cabecera se queda quieta y el cuerpo lleva el aviso con «Volver a
 * intentar». Antes se enseñaba el contenido de partida del repositorio: en
 * cuanto la Secretaría edita una página ya no es el suyo (se veía un momento el
 * texto viejo y luego saltaba), y con el servidor caído habría pasado por
 * verdadero lo que solo es de ejemplo.
 */
interface Props {
  slug: SlugContenido
}

export default function PaginaDeBloquesPublica({ slug }: Props) {
  // En la vista previa del CMS, lo que se está escribiendo; fuera, lo guardado.
  const borrador = useBorradorPagina()
  const consulta = useQuery({
    queryKey: ['contenido', slug],
    queryFn: () => getContenido<PaginaDeBloques>(slug),
    retry: false,
    staleTime: 5 * 60_000,
    enabled: borrador === null,
  })
  const { data } = consulta
  const guardada = borrador ?? data
  // Mientras llega lo guardado, el título de la pestaña sale del catálogo de
  // páginas: importar el contenido de partida entero (75 KB) solo para eso lo
  // metía en un trozo compartido que bajaba también la portada.
  const titulo = guardada?.cabecera.titulo ?? CATALOGO.paginas.find((p) => p.slug === slug)?.nombre ?? ''
  useBajarAlAncla(Boolean(data))
  const nombresEnMenu = useNombresEnMenu()
  const ceja = cejaDePagina(slug, titulo, nombresEnMenu)
  const seccion = SECCION_TRAS_CABECERA

  return (
    <>
      {/* En la vista previa, la pestaña sigue siendo la del CMS. */}
      {!borrador && <MetaDePagina titulo={titulo} descripcion={guardada?.cabecera.subtitulo || undefined} />}
      {/* La caja aísla el fondo: su `zIndex: -1` se queda detrás de la página y
          no se va por detrás del documento. Abarca cabecera y bloques, y ahí
          acaba: el pie queda fuera y la foto no lo pisa. */}
      {/* `overflow-x: clip` recorta las franjas de color de los bloques, que van
          de lado a lado de la ventana: en Windows, ese ancho incluye la barra de
          desplazamiento y sin esto la página se movería de lado. `clip` y no
          `hidden`, que rompería el `position: sticky` de dentro. */}
      <Box sx={{ position: 'relative', isolation: 'isolate', overflowX: 'clip' }}>
        {guardada ? (
          <>
            <CabeceraASangre
              titulo={guardada.cabecera.titulo}
              subtitulo={guardada.cabecera.subtitulo}
              foto={guardada.cabecera.foto}
              fotoAlt={guardada.cabecera.fotoAlt}
              encuadre={guardada.cabecera.encuadre}
              ceja={ceja}
            />
            <SeccionAnimada sx={seccion}>
              <ContenedorDePagina>
                <ConBloquesCargados bloques={guardada.bloques} esqueleto={<BloquesEsqueleto slug={slug} />}>
                  <BloquesDePagina bloques={guardada.bloques} />
                </ConBloquesCargados>
              </ContenedorDePagina>
            </SeccionAnimada>
          </>
        ) : estadoDeConsulta(consulta) === 'error' ? (
          <>
            <Box className="esqueleto-quieto"><CabeceraASangreEsqueleto ceja={ceja} titulo={titulo} /></Box>
            <Box sx={seccion}>
              <ContenedorDePagina>
                <EnCarga avisoArriba estado="error" que="esta página" alReintentar={() => { void consulta.refetch() }} esqueleto={<BloquesEsqueleto slug={slug} />} />
              </ContenedorDePagina>
            </Box>
          </>
        ) : (
          <EnCarga
            estado="cargando"
            que="esta página"
            alReintentar={() => { void consulta.refetch() }}
            esqueleto={(
              <>
                <CabeceraASangreEsqueleto ceja={ceja} />
                <Box sx={seccion}>
                  <ContenedorDePagina><BloquesEsqueleto slug={slug} /></ContenedorDePagina>
                </Box>
              </>
            )}
          />
        )}
      </Box>
    </>
  )
}

/**
 * Con un ancla en la dirección (`/historia#fundacion`), baja hasta el bloque
 * que la lleva. El router no lo hace solo, y el bloque no existe cuando llega
 * el contenido si la página lleva bloques que se descargan aparte: hasta que
 * llegan, `ConBloquesCargados` enseña el esqueleto. Por eso se vigila la página
 * hasta que aparece el ancla, con un tope para no quedarse mirando siempre por
 * un ancla que no existe.
 */
const ESPERA_DEL_ANCLA = 5000

function useBajarAlAncla(cargado: boolean) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash || !cargado) return
    const id = decodeURIComponent(hash.slice(1))
    let marco = 0
    const bajar = () => {
      const destino = document.getElementById(id)
      if (!destino) return false
      // Un marco más tarde: el bloque recién montado aún no tiene su alto.
      marco = requestAnimationFrame(() => destino.scrollIntoView?.({ block: 'start' }))
      return true
    }
    if (bajar()) return () => cancelAnimationFrame(marco)
    const vigia = new MutationObserver(() => { if (bajar()) vigia.disconnect() })
    vigia.observe(document.body, { childList: true, subtree: true })
    const tope = window.setTimeout(() => vigia.disconnect(), ESPERA_DEL_ANCLA)
    return () => { vigia.disconnect(); window.clearTimeout(tope); cancelAnimationFrame(marco) }
  }, [hash, cargado])
}
