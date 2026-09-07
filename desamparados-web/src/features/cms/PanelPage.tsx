import { Alert, Box, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { getPanel } from '../../lib/api/panel'
import { designTokens } from '../../theme'
import LineaTemporal from '../../components/charts/LineaTemporal'
import BarrasHorizontales from '../../components/charts/BarrasHorizontales'
import BarraEstados from '../../components/charts/BarraEstados'
import Cifra from './panel/Cifra'
import { contar } from './panel/plural'

const euros = (valor: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(valor)

/** Los estados de recibo que interesan en el panel, con su severidad. */
const ESTADOS = [
  { clave: 'PAGADO', etiqueta: 'Cobrados', estado: 'ok' as const },
  { clave: 'PENDIENTE', etiqueta: 'Pendientes', estado: 'aviso' as const },
  { clave: 'DEVUELTO', etiqueta: 'Devueltos', estado: 'error' as const },
]

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h5" component="h2">{titulo}</Typography>
      {children}
    </Paper>
  )
}

export default function PanelPage() {
  const { data, isPending, isError } = useQuery({ queryKey: ['panel'], queryFn: getPanel })

  if (isPending) {
    return <CircularProgress aria-label="Cargando el panel" />
  }

  if (isError || !data) {
    return <Alert severity="error">No se ha podido cargar el panel. Inténtalo de nuevo en unos minutos.</Alert>
  }

  const pendientes = data.dinero.porEstado.find((e) => e.estado === 'PENDIENTE')

  return (
    <>
      <Helmet><title>Panel | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>

      <Typography variant="h3" component="h1" sx={{ mb: 0.5 }}>Panel informativo</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Datos a {new Date(data.generadoEn).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <Cifra
          etiqueta="Hermanos activos"
          valor={data.censo.activos}
          pie={`+${data.censo.altas12m} altas / −${data.censo.bajas12m} bajas en doce meses`}
        />
        <Cifra etiqueta="Papeletas emitidas" valor={data.procesion.papeletas} pie={`Año ${data.procesion.anio}`} />
        <Cifra
          etiqueta="Pendiente de cobro"
          valor={euros(pendientes?.importe ?? 0)}
          pie={`${pendientes?.total ?? 0} recibos sin pagar`}
        />
        <Cifra etiqueta="Saldo del ejercicio" valor={euros(data.dinero.ejercicio.saldo)} pie={`Año ${data.dinero.ejercicio.anio}`} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' }, gap: 2 }}>
        <Bloque titulo="Censo de hermanos">
          <LineaTemporal
            etiqueta="Hermanos activos mes a mes"
            puntos={data.censo.serieMensual.map((p) => ({ x: p.mes, y: p.activos }))}
          />
          <BarrasHorizontales filas={data.censo.porEdad.map((t) => ({ etiqueta: t.tramo, valor: t.total }))} />
          <Typography variant="body2" color="text.secondary">
            {contar(data.censo.sinNumeroHermano, 'hermano activo', 'hermanos activos')} sin número de hermano
            asignado
          </Typography>
        </Bloque>

        <Bloque titulo="Tesorería">
          <BarraEstados
            segmentos={ESTADOS.map((e) => ({
              etiqueta: e.etiqueta,
              valor: data.dinero.porEstado.find((f) => f.estado === e.clave)?.total ?? 0,
              estado: e.estado,
            }))}
          />
          <Stack direction="row" spacing={3}>
            <Typography variant="body2">Ingresos <strong>{euros(data.dinero.ejercicio.ingresos)}</strong></Typography>
            <Typography variant="body2">Gastos <strong>{euros(data.dinero.ejercicio.gastos)}</strong></Typography>
          </Stack>
          <LineaTemporal
            etiqueta="Ingresos"
            puntos={data.dinero.serieMensual.map((m) => ({ x: m.mes, y: m.ingresos }))}
            comparar={{
              etiqueta: 'Gastos',
              puntos: data.dinero.serieMensual.map((m) => ({ x: m.mes, y: m.gastos })),
              color: designTokens.dataviz.series[1],
            }}
          />
          <Typography variant="overline" color="text.secondary">Por categoría contable</Typography>
          <BarrasHorizontales filas={data.dinero.porCategoria.map((c) => ({ etiqueta: c.categoria, valor: c.total }))} />
        </Bloque>

        <Bloque titulo="Procesión">
          <BarrasHorizontales filas={data.procesion.porPuesto.map((p) => ({ etiqueta: p.etiqueta, valor: p.total }))} />
          <Typography variant="overline" color="text.secondary">Previsión de túnicas</Typography>
          <BarrasHorizontales filas={data.procesion.porTalla.map((t) => ({ etiqueta: t.etiqueta, valor: t.total }))} />
          <Typography variant="overline" color="text.secondary">Altura de hombro, para los varales</Typography>
          <BarrasHorizontales filas={data.procesion.porAlturaHombro.map((a) => ({ etiqueta: a.tramo, valor: a.total }))} />
          <Typography variant="overline" color="text.secondary">Papeletas por año</Typography>
          <BarrasHorizontales filas={data.procesion.porAnio.map((a) => ({ etiqueta: String(a.anio), valor: a.total }))} />
        </Bloque>

        <Bloque titulo="Actividad">
          <Stack spacing={1}>
            {data.actividad.proximosEventos.map((evento) => (
              <Box key={evento.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="body2">{evento.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(evento.startDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </Typography>
              </Box>
            ))}
            {data.actividad.proximosEventos.length === 0 && (
              <Typography variant="body2" color="text.secondary">No hay actos convocados.</Typography>
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {contar(data.actividad.noticias.publicadas, 'noticia publicada', 'noticias publicadas')} ·{' '}
            {contar(data.actividad.noticias.borradores, 'borrador', 'borradores')} ·{' '}
            {contar(data.actividad.publicaciones.total, 'publicación', 'publicaciones')} ·{' '}
            {contar(data.actividad.reparto.citasReservadas, 'cita de reparto', 'citas de reparto')} ·{' '}
            {contar(data.actividad.reparto.turnosProximos, 'turno próximo', 'turnos próximos')} (capacidad{' '}
            {data.actividad.reparto.capacidadEstimada})
          </Typography>
        </Bloque>
      </Box>
    </>
  )
}
