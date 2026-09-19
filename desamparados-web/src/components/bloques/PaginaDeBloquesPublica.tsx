import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import PageContainer from '../PageContainer'
import PageHeader from '../PageHeader'
import AnimatedSection from '../AnimatedSection'
import BloquesDePagina from './BloquesDePagina'
import { useBorradorPagina } from './borrador'
import POR_DEFECTO from '../../../../shared/contenido-por-defecto.json'
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
 * El título de la pestaña sale de la cabecera del documento, así que también se
 * edita desde el CMS. Era lo que ya decía cada página («Cultos | Desamparados»),
 * pero escrito a mano en dos sitios que podían separarse.
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
      {!borrador && <Helmet><title>{`${pagina.cabecera.titulo} | Desamparados`}</title></Helmet>}
      <PageHeader
        title={pagina.cabecera.titulo}
        subtitle={pagina.cabecera.subtitulo}
        image={pagina.cabecera.foto || undefined}
        imageAlt={pagina.cabecera.fotoAlt}
      />
      <AnimatedSection sx={SECCION_TRAS_CABECERA}>
        <PageContainer>
          <BloquesDePagina bloques={pagina.bloques} />
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
