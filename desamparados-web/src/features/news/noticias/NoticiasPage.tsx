import { Helmet } from 'react-helmet-async'
import { Alert, Box, CircularProgress, Grid } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import NewsCard from '../../../components/NewsCard'
import AnimatedSection from '../../../components/AnimatedSection'
import Paginador from '../../../components/Paginador'
import { getNewsArchive } from '../../../lib/api/news'
import { useListadoPaginado, type Pagina } from '../../../hooks/useListadoPaginado'

// Fuera del componente para que no cambie de identidad en cada render: el hook
// la lleva en las dependencias de su efecto. El listado habla en `data`; el
// archivo de noticias devuelve `noticias` porque el CMS necesita la noticia cruda.
const pedirNoticias = (pagina: Pagina) =>
  getNewsArchive(pagina).then(({ noticias, meta }) => ({ data: noticias, meta }))

export default function NoticiasPage() {
  // Antes esta pantalla llevaba su propio bloque de carga, escrito antes de que
  // el hook existiera, y con él el fallo que el hook arregló: el `setError` del
  // .catch no se limpiaba nunca en el éxito, así que un tropiezo pasajero al
  // pasar de página dejaba al visitante con el paginador, una alerta y ni una
  // noticia hasta que recargara a mano.
  const { items: newsItems, meta, loading, error, alCambiarPagina, cambiarTamano } =
    useListadoPaginado(pedirNoticias, 'No se han podido cargar las noticias.')

  return (
    <>
      <Helmet>
        <title>Noticias | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Noticias"
        subtitle="Últimas noticias del Grupo Parroquial de los Desamparados."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle title="Todas las noticias" />
          {loading && <CircularProgress aria-label="Cargando noticias" />}
          {error && <Alert severity="error">{error}</Alert>}
          {!loading && !error && newsItems.length === 0 && <Alert severity="info">No hay noticias publicadas.</Alert>}
          {!loading && !error && newsItems.length > 0 && <Grid container spacing={3}>
            {newsItems.map((news) => (
              <Grid key={news.id} size={{ xs: 12, md: 6, lg: 3 }}>
                <NewsCard news={news} />
              </Grid>
            ))}
          </Grid>}
          {meta && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Paginador meta={meta} onPagina={alCambiarPagina} onTamano={cambiarTamano} etiqueta="noticias" />
            </Box>
          )}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
