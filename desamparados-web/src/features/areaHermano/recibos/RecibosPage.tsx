import { Fragment } from 'react'
import { Alert, Box, CircularProgress, Divider, Typography } from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { Helmet } from 'react-helmet-async'
import { Link, useLocation } from 'react-router-dom'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import Paginador from '../../../components/Paginador'
import { useListadoPaginado } from '../../../hooks/useListadoPaginado'
import { misRecibos, type MyReceipt } from '../../../lib/api/recibos'
import { estadoDelRecibo, formatearImporte } from './etiquetas'
import AvisoSuave from '../../../components/AvisoSuave'
import CertificadosDonativos from './CertificadosDonativos'
import { site } from '../../../config/site'

/**
 * Los recibos de la familia, agrupados por año.
 *
 * Antes era una tabla de seis columnas. En un móvil eso son unos 700 px dentro
 * de una pantalla de 360, así que el importe y el estado —lo que se viene a
 * mirar— quedaban fuera y había que arrastrar la página de lado. Ahora cada
 * recibo es una fila que cabe entera: concepto y hermano a la izquierda,
 * importe y estado a la derecha, y el desglose completo al entrar en él.
 *
 * El servidor ya los sirve ordenados por año descendente, así que para
 * encabezar los años basta con mirar si el de la fila anterior era otro. Un año
 * puede quedar partido entre dos páginas: entonces la siguiente lo vuelve a
 * encabezar, que es justo lo que se quiere leer.
 */
export default function RecibosPage() {
  const { items: receipts, meta, loading, error, alCambiarPagina, cambiarTamano } =
    useListadoPaginado<MyReceipt>(misRecibos, 'No se han podido cargar tus recibos.')

  // Quien está solo en su ficha veía su propio nombre repetido en cada fila.
  // En una familia con varias fichas, en cambio, el nombre es lo único que
  // distingue la cuota de la madre de la del hijo, así que ahí sí se pone.
  const nombraAlHermano = new Set(receipts.map((r) => `${r.hermano.nombre} ${r.hermano.apellidos}`)).size > 1

  return (
    <>
      <Helmet>
        <title>{`Recibos | ${site.nombreCorto}`}</title>
      </Helmet>

      <SeccionAnimada sx={{ py: { xs: 4, md: 6 } }}>
        <ContenedorDePagina>
          <Typography variant="h2" component="h1" sx={{ mb: 4 }}>
            Recibos
          </Typography>

          {loading && <CircularProgress aria-label="Cargando recibos" sx={{ mb: 4 }} />}
          {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}
          {!loading && !error && receipts.length === 0 && (
            <AvisoSuave>No hay recibos disponibles para tu familia.</AvisoSuave>
          )}

          {!loading && !error && receipts.length > 0 && (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {receipts.map((receipt, indice) => (
                <Fragment key={receipt.id}>
                  {receipt.year !== receipts[indice - 1]?.year && (
                    <Box component="li" sx={{ mt: indice === 0 ? 0 : 4 }}>
                      <Typography
                        variant="h3"
                        component="h2"
                        sx={{ fontSize: { xs: 20, md: 24 }, mb: 1 }}
                      >
                        {receipt.year}
                      </Typography>
                      <Divider />
                    </Box>
                  )}
                  <Box component="li">
                    <FilaRecibo receipt={receipt} nombraAlHermano={nombraAlHermano} />
                    <Divider />
                  </Box>
                </Fragment>
              ))}
            </Box>
          )}

          {meta && <Paginador meta={meta} onPagina={alCambiarPagina} onTamano={cambiarTamano} etiqueta="mis recibos" />}

          <CertificadosDonativos />
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}

/**
 * Una fila pulsable. El enlace envuelve la fila entera para que el blanco de
 * toque sea toda ella y no solo el texto del concepto; `minHeight: 56` la deja
 * por encima del mínimo cómodo en táctil aunque el concepto ocupe una línea.
 */
function FilaRecibo({ receipt, nombraAlHermano }: { receipt: MyReceipt; nombraAlHermano: boolean }) {
  const estado = estadoDelRecibo(receipt)
  // La página de la que se sale viaja en el `state` para que el detalle sepa
  // volver a ella y no a la primera (`useVolverAlListado`).
  const { search } = useLocation()

  return (
    <Box
      component={Link}
      to={`/area-hermano/recibos/${receipt.id}`}
      state={{ volver: search }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 56,
        py: 1.5,
        color: 'inherit',
        textDecoration: 'none',
        '&:hover': { backgroundColor: 'rgba(255,255,255,.04)' },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, lineHeight: 1.35 }}>{receipt.concepto}</Typography>
        {nombraAlHermano && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {receipt.hermano.nombre} {receipt.hermano.apellidos}
          </Typography>
        )}
      </Box>

      {/* Alineado a la derecha y sin encogerse: el importe no puede partirse en
          dos líneas ni quedar fuera de la pantalla, que era el problema. */}
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
          {formatearImporte(receipt.importe)}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: estado.color, fontWeight: 600, textTransform: 'uppercase', fontSize: 12 }}
        >
          {estado.texto}
        </Typography>
      </Box>

      <ChevronRightIcon sx={{ color: 'text.secondary', flexShrink: 0 }} aria-hidden />
    </Box>
  )
}
