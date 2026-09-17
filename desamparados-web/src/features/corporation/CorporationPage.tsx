import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import AnimatedSection from '../../components/AnimatedSection'
import BloquesDePagina from '../../components/bloques/BloquesDePagina'
import POR_DEFECTO from '../../../../shared/contenido-por-defecto.json'
import { CLAVE_CORPORACION, getContenido, type PaginaDeBloques } from '../../lib/api/contenido'

export default function CorporationPage() {
  const { data } = useQuery({
    queryKey: CLAVE_CORPORACION,
    queryFn: () => getContenido<PaginaDeBloques>('corporacion'),
    retry: false,
    staleTime: 5 * 60_000,
  })
  // Mientras carga y si falla, el contenido de partida: la página no puede
  // quedarse en blanco porque el servidor tarde o no conteste.
  const pagina = data ?? (POR_DEFECTO.corporacion as unknown as PaginaDeBloques)

  return (
    <>
      <Helmet><title>Corporación | Desamparados</title></Helmet>
      <PageHeader
        title={pagina.cabecera.titulo}
        subtitle={pagina.cabecera.subtitulo}
        image={pagina.cabecera.foto || undefined}
        imageAlt={pagina.cabecera.fotoAlt}
      />
      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <BloquesDePagina bloques={pagina.bloques} />
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
