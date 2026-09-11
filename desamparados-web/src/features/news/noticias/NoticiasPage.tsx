import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import { Alert, Box, CircularProgress } from '@mui/material'
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

// El tono de las placas sin foto va por el índice, módulo 3, y la rejilla tiene
// tres columnas: con el índice tal cual, cada columna repetía color fila tras
// fila. Sumando la fila, los tonos corren en diagonal y no se tocan ni en
// horizontal ni en vertical.
const indiceEnDiagonal = (posicion: number) => posicion + Math.floor(posicion / 3)
// La placa de la destacada queda encima de las dos primeras columnas: la
// «piedra» (2) no coincide con ninguna de las dos tarjetas de debajo.
const INDICE_DESTACADA = 2

export default function NoticiasPage() {
  // Antes esta pantalla llevaba su propio bloque de carga, escrito antes de que
  // el hook existiera, y con él el fallo que el hook arregló: el `setError` del
  // .catch no se limpiaba nunca en el éxito, así que un tropiezo pasajero al
  // pasar de página dejaba al visitante con el paginador, una alerta y ni una
  // noticia hasta que recargara a mano.
  const { items: newsItems, meta, loading, error, alCambiarPagina } =
    useListadoPaginado(pedirNoticias, 'No se han podido cargar las noticias.')
  // La página en la que está el visitante viaja con cada tarjeta: al volver
  // desde la ficha de una noticia aterriza donde estaba, no en la primera.
  const { search: consultaArchivo } = useLocation()
  // Solo la primera de la primera página es la última noticia publicada; en la
  // página 3, destacar la primera sería destacar una cualquiera.
  const hayDestacada = meta?.page === 1

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
          {!loading && !error && newsItems.length > 0 && (
            <Box
              component="ul"
              aria-label="Noticias"
              sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 3, md: 3.25 } }}
            >
              {newsItems.map((news, i) => {
                const destacada = hayDestacada && i === 0
                return (
                  <Box component="li" key={news.id} sx={{ display: 'flex', gridColumn: destacada ? '1 / -1' : undefined }}>
                    <NewsCard news={news} indice={destacada ? INDICE_DESTACADA : indiceEnDiagonal(hayDestacada ? i - 1 : i)} destacada={destacada} volver={consultaArchivo} />
                  </Box>
                )
              })}
            </Box>
          )}
          {meta && <Paginador meta={meta} onPagina={alCambiarPagina} etiqueta="noticias" />}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
