import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Divider, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import PageContainer from '../../../components/PageContainer'
import AnimatedSection from '../../../components/AnimatedSection'
import { useVolverAlListado } from '../../../hooks/useVolverAlListado'
import { miRecibo, type MyReceiptDetail } from '../../../lib/api/recibos'
import { ESTADO_RECIBO, METODO_PAGO, TIPO_RECIBO, formatearFecha, formatearImporte } from './etiquetas'

/**
 * Un recibo entero. La fila del listado solo enseña concepto, hermano, importe
 * y estado, que es lo que cabe en un móvil sin arrastrar la pantalla; lo demás
 * —tipo, forma de pago, las dos fechas— está aquí.
 *
 * Cualquier fallo sale como un mensaje único en vez del texto del servidor: se
 * llega a esta pantalla pulsando una fila del propio listado, así que un
 * «Recibo no encontrado» a secas solo despistaría. Y quien haya llegado
 * tecleando el id de un recibo ajeno recibe lo mismo, sin saber si existe.
 */
export default function ReceiptDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  // Vuelve a la página del listado de la que se salió, no a la primera.
  const volverAlListado = useVolverAlListado('/area-hermano/recibos')

  const [recibo, setRecibo] = useState<MyReceiptDetail | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelado = false

    miRecibo(Number(id))
      .then((datos) => { if (!cancelado) setRecibo(datos) })
      .catch(() => { if (!cancelado) setError(true) })
      .finally(() => { if (!cancelado) setCargando(false) })

    return () => { cancelado = true }
  }, [id])

  const estado = recibo ? ESTADO_RECIBO[recibo.estado] : null

  return (
    <>
      <Helmet>
        <title>{`${recibo ? `${recibo.concepto} | Recibos` : 'Recibo'} | Desamparados`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <AnimatedSection sx={{ py: { xs: 4, md: 6 } }}>
        <PageContainer sx={{ maxWidth: 760 }}>
          <Box
            component={Link}
            to={volverAlListado}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              minHeight: 44,
              mb: 2,
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <ArrowBackIcon fontSize="small" /> Recibos
          </Box>

          {cargando && <CircularProgress aria-label="Cargando el recibo" sx={{ display: 'block', mb: 4 }} />}
          {error && <Alert severity="error">No se ha podido cargar el recibo.</Alert>}

          {recibo && estado && (
            <>
              <Typography variant="h2" component="h1" sx={{ mb: 0.5 }}>
                {recibo.concepto}
              </Typography>
              <Typography
                sx={{ color: estado.color, fontWeight: 600, textTransform: 'uppercase', fontSize: 13, mb: 4 }}
              >
                {estado.texto}
              </Typography>

              <Box component="dl" sx={{ m: 0 }}>
                <Dato etiqueta="Hermano" valor={`${recibo.hermano.nombre} ${recibo.hermano.apellidos}`} />
                <Dato etiqueta="Año" valor={String(recibo.year)} />
                {/* «Tipo», no «Concepto»: el concepto es el titular de la pantalla. */}
                <Dato etiqueta="Tipo" valor={TIPO_RECIBO[recibo.tipo]} />
                <Dato etiqueta="Importe" valor={formatearImporte(recibo.importe)} />
                <Dato etiqueta="Fecha de emisión" valor={formatearFecha(recibo.fechaEmision)} />
                <Dato
                  etiqueta="Fecha de pago"
                  valor={recibo.fechaPago ? formatearFecha(recibo.fechaPago) : 'Sin pagar'}
                />
                <Dato
                  etiqueta="Forma de pago"
                  valor={recibo.metodoPago ? METODO_PAGO[recibo.metodoPago] : 'Sin determinar'}
                />
              </Box>
            </>
          )}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}

/**
 * Una pareja etiqueta/valor. En columna en el móvil y en dos columnas a partir
 * de `sm`: en 360 px, «Fecha de emisión» y su fecha en la misma línea no caben
 * sin partir una de las dos.
 */
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          gap: { xs: 0.25, sm: 2 },
          py: 1.5,
        }}
      >
        <Box component="dt" sx={{ color: 'text.secondary', fontSize: 14 }}>{etiqueta}</Box>
        <Box component="dd" sx={{ m: 0, fontWeight: 600, textAlign: { sm: 'right' } }}>{valor}</Box>
      </Box>
      <Divider />
    </>
  )
}
