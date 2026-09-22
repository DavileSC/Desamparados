import { Box } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import ContenedorDePagina from '../ContenedorDePagina'
import MetaDePagina from '../MetaDePagina'
import CabeceraDePagina from '../CabeceraDePagina'
import FondoDePagina from '../FondoDePagina'
import SeccionAnimada from '../SeccionAnimada'
import BloquesDePagina from './BloquesDePagina'
import { useBorradorPagina } from './borrador'
import POR_DEFECTO from '../../../../shared/contenido-por-defecto.json'
import { getContenido, type PaginaDeBloques, type SlugContenido } from '../../lib/api/contenido'
import { SECCION_TRAS_CABECERA } from '../espaciado'

/**
 * Una página pública compuesta por bloques: su cabecera y, debajo, lo que el
 * CMS haya puesto, con la foto de la cabecera velada detrás de todo.
 *
 * Es el mismo componente para todas porque lo único que las distingue es su
 * slug. Antes cada una llevaba su texto escrito dentro del `.tsx` y cambiar un
 * párrafo exigía tocar código y desplegar.
 *
 * La foto no se queda en una banda arriba: es el fondo de la página entera,
 * como en Historia. Se queda quieta a la altura de la ventana mientras el
 * texto pasa por encima y termina con el último bloque, sin llegar al pie.
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
 */
export default function PaginaDeBloquesPublica({ slug }: { slug: SlugContenido }) {
  // En la vista previa del CMS, lo que se está escribiendo; fuera, lo guardado.
  const borrador = useBorradorPagina()
  const { data } = useQuery({
    queryKey: ['contenido', slug],
    queryFn: () => getContenido<PaginaDeBloques>(slug),
    retry: false,
    staleTime: 5 * 60_000,
    enabled: borrador === null,
  })
  // Mientras carga y si falla, el contenido de partida: la página no puede
  // quedarse en blanco porque el servidor tarde o no conteste.
  const pagina = borrador ?? data ?? ((POR_DEFECTO as Record<string, unknown>)[slug] as PaginaDeBloques)

  return (
    <>
      {/* En la vista previa, la pestaña sigue siendo la del CMS. */}
      {!borrador && <MetaDePagina titulo={pagina.cabecera.titulo} descripcion={pagina.cabecera.subtitulo || undefined} />}
      {/* La caja aísla el fondo: su `zIndex: -1` se queda detrás de la página y
          no se va por detrás del documento. Abarca cabecera y bloques, y ahí
          acaba: el pie queda fuera y la foto no lo pisa. */}
      <Box sx={{ position: 'relative', isolation: 'isolate' }}>
        {Boolean(pagina.cabecera.foto) && <FondoDePagina url={pagina.cabecera.foto} />}
        <CabeceraDePagina
          title={pagina.cabecera.titulo}
          subtitle={pagina.cabecera.subtitulo}
          image={pagina.cabecera.foto || undefined}
          imageAlt={pagina.cabecera.fotoAlt}
          sobreFondo={Boolean(pagina.cabecera.foto)}
        />
        <SeccionAnimada sx={SECCION_TRAS_CABECERA}>
          <ContenedorDePagina>
            <BloquesDePagina bloques={pagina.bloques} />
          </ContenedorDePagina>
        </SeccionAnimada>
      </Box>
    </>
  )
}
