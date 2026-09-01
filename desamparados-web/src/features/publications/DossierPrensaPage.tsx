import { Helmet } from 'react-helmet-async'
import { Alert, Box, CircularProgress, Grid } from '@mui/material'
import { useEffect, useState } from 'react'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import SectionTitle from '../../components/SectionTitle'
import PublicationCard from '../../components/PublicationCard'
import AnimatedSection from '../../components/AnimatedSection'
import Paginador from '../../components/Paginador'
import { usePaginacion } from '../../hooks/usePaginacion'
import { getPublications } from '../../lib/api/publications'
import type { MetaPaginacion } from '../../lib/api/tipos'
import type { PublicationItem } from '../../types'

export default function DossierPrensaPage() {
  const [dossieres, setDossieres] = useState<PublicationItem[]>([])
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()

  useEffect(() => {
    let cancelado = false

    getPublications('dossier', { pagina, porPagina })
      .then((respuesta) => {
        if (cancelado) return
        setDossieres(respuesta.data)
        setMeta(respuesta.meta)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar los dossieres.')
      })
      .finally(() => { if (!cancelado) setLoading(false) })

    return () => { cancelado = true }
  }, [pagina, porPagina])

  const alCambiarPagina = (numero: number) => {
    irAPagina(numero)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <Helmet>
        <title>Dossier de Prensa | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Dossier de Prensa"
        subtitle="Recopilación de apariciones mediáticas."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <SectionTitle title="Apariciones mediáticas" />
          {loading && <CircularProgress aria-label="Cargando dossieres" />}
          {error && <Alert severity="error">{error}</Alert>}
          {!loading && !error && dossieres.length === 0 && <Alert severity="info">No hay dossieres disponibles.</Alert>}
          <Grid container spacing={3}>
            {dossieres.map((publication) => (
              <Grid key={publication.id} size={{ xs: 12, sm: 6, lg: 3 }}>
                <PublicationCard publication={publication} />
              </Grid>
            ))}
          </Grid>
          {meta && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Paginador meta={meta} onPagina={alCambiarPagina} onTamano={cambiarTamano} etiqueta="dossieres de prensa" />
            </Box>
          )}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
