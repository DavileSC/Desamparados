import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import AnimatedSection from '../../components/AnimatedSection'
import BloquesDePagina from '../../components/bloques/BloquesDePagina'
import POR_DEFECTO from '../../../../shared/contenido-por-defecto.json'
import { CLAVE_CORPORACION, getContenido, type PaginaDeBloques } from '../../lib/api/contenido'

const DE_PARTIDA = POR_DEFECTO.corporacion as unknown as PaginaDeBloques

export default function CorporationPage() {
  // Con `initialData`, si el servidor tarda o falla la página no se queda en
  // blanco: enseña el contenido de partida y lo sustituye cuando llega el suyo.
  const { data } = useQuery({
    queryKey: CLAVE_CORPORACION,
    queryFn: () => getContenido<PaginaDeBloques>('corporacion'),
    initialData: DE_PARTIDA,
  })

  return (
    <>
      <Helmet><title>Corporación | Desamparados</title></Helmet>
      <PageHeader
        title={data.cabecera.titulo}
        subtitle={data.cabecera.subtitulo}
        image={data.cabecera.foto || undefined}
        imageAlt={data.cabecera.fotoAlt}
      />
      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <BloquesDePagina bloques={data.bloques} />
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
