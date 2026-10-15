import { Alert, Box, Link, Skeleton, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import CabeceraSeccion from './CabeceraSeccion'
import { site } from '../../config/site'
import { CLAVE_ESTADISTICAS, URL_DEL_INFORME, estadoDelInforme } from '../../lib/api/estadisticas'

const cuando = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/** El marco ocupa lo que queda de pantalla, con un mínimo para el portátil de 552 px útiles. */
const ALTO_DEL_INFORME = { xs: 640, md: 'max(560px, calc(100vh - 230px))' }

/**
 * Web → «Estadísticas de visitas»: el informe de GoAccess de la web pública
 * (páginas vistas, procedencia, dispositivos y horas), que el servidor rehace
 * cada hora. Va en un marco con el informe tal cual: la API lo sirve aislado
 * del CMS (ver estadisticas-de-visitas.controller.ts) y el marco lo aísla
 * otra vez con `sandbox`.
 */
export default function EstadisticasDeVisitasPage() {
  const { data, isPending, isError } = useQuery({ queryKey: CLAVE_ESTADISTICAS, queryFn: estadoDelInforme })

  return (
    <>
      <Helmet><title>{`Estadísticas de visitas | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion
        titulo="Estadísticas de visitas"
        subtitulo={data?.hay && data.actualizado ? `Actualizado el ${cuando(data.actualizado)} · se rehace cada hora` : 'Las visitas de la web pública, sin cookies'}
      >
        {data?.hay && (
          <Link href={URL_DEL_INFORME} target="_blank" rel="noopener" sx={{ fontWeight: 600, alignSelf: 'center' }}>
            Abrir en una pestaña
          </Link>
        )}
      </CabeceraSeccion>

      {isPending ? (
        <Skeleton variant="rounded" sx={{ height: ALTO_DEL_INFORME }} />
      ) : isError ? (
        <Alert severity="error">No se ha podido saber si hay informe. Vuelve a probar en un momento.</Alert>
      ) : !data.hay ? (
        <Alert severity="info" sx={{ maxWidth: 760 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Todavía no hay informe.</Typography>
          El servidor lo prepara cada hora con las páginas que se van viendo: si acabas de encender el módulo,
          vuelve dentro de un rato. Si sigue sin salir, falta ponerlo en marcha en el servidor
          (docs/servidor.md, «Estadísticas de visitas»).
        </Alert>
      ) : (
        <Box
          component="iframe"
          src={URL_DEL_INFORME}
          title="Informe de visitas de la web"
          sandbox="allow-scripts"
          sx={{ display: 'block', width: '100%', height: ALTO_DEL_INFORME, border: 0, borderRadius: 2, bgcolor: 'background.paper' }}
        />
      )}

      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2, maxWidth: 760 }}>
        Se cuentan las páginas vistas de la web pública, con la dirección de quien entra recortada y sin cookies.
        No se cuenta a quien ha pedido en su navegador no ser seguido.
      </Typography>
    </>
  )
}
