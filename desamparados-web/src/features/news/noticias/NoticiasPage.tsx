import { Helmet } from 'react-helmet-async'
import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Grid } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import NewsCard from '../../../components/NewsCard'
import AnimatedSection from '../../../components/AnimatedSection'
import Paginador from '../../../components/Paginador'
import { usePaginacion } from '../../../hooks/usePaginacion'
import { getNewsArchive } from '../../../lib/api/news'
import type { MetaPaginacion } from '../../../lib/api/tipos'
import type { NewsItem } from '../../../types'

export default function NoticiasPage() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()

  useEffect(() => {
    let cancelled = false

    getNewsArchive({ pagina, porPagina })
      .then((resultado) => {
        if (!cancelled) {
          setNewsItems(resultado.noticias)
          setMeta(resultado.meta)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se han podido cargar las noticias.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [pagina, porPagina])

  const alCambiarPagina = (numero: number) => {
    irAPagina(numero)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
