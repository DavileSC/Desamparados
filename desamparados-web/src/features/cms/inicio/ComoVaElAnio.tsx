import { useState } from 'react'
import { Box, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { getPanel, type PanelResponse } from '../../../lib/api/panel'
import { useTemaCms } from '../../../app/temaCms'
import LineaTemporal from '../../../components/charts/LineaTemporal'
import BarrasHorizontales from '../../../components/charts/BarrasHorizontales'
import ColumnasDivergentes from '../../../components/charts/ColumnasDivergentes'
import ColumnasPorPares from '../../../components/charts/ColumnasPorPares'
import ColumnasPorAnio from '../../../components/charts/ColumnasPorAnio'
import ProporcionEstados, { type FilaEstado } from '../../../components/charts/ProporcionEstados'
import TablaDeDatos from '../../../components/charts/TablaDeDatos'
import { euros, eurosResumen, numero, etiquetaPunto, etiquetaPuntoLarga } from '../contabilidad/formato'

/** Cuántos ejercicios ofrece el selector. Cinco cubre de sobra la reunión de enero. */
const EJERCICIOS = 5

/** Los estados de recibo que interesan, con su severidad. */
const ESTADOS = [
  { clave: 'PAGADO', etiqueta: 'Cobrados', estado: 'ok' as const },
  { clave: 'PENDIENTE', etiqueta: 'Pendientes', estado: 'aviso' as const },
  { clave: 'DEVUELTO', etiqueta: 'Devueltos por el banco', estado: 'error' as const },
]

function Tarjeta({
  titulo, subtitulo, ancha = false, children,
}: {
  titulo: string
  subtitulo: string
  ancha?: boolean
  children: React.ReactNode
}) {
  return (
    <Paper
      component="section"
      sx={{
        borderRadius: 1.75, p: 2.75, display: 'flex', flexDirection: 'column', gap: 1.75,
        gridColumn: { xs: '1 / -1', lg: ancha ? '1 / -1' : 'span 6' },
      }}
    >
      <Box>
        <Typography variant="h5" component="h3" sx={{ fontSize: 20 }}>{titulo}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.375 }}>{subtitulo}</Typography>
      </Box>
      {children}
    </Paper>
  )
}

/**
 * «Cómo va el año»: un selector de ejercicio que gobierna las siete gráficas y
 * nada más. La cabecera del Inicio, «Para hoy», los actos y la cuenta atrás no
 * cambian nunca; el selector existe porque el Inicio se enseña a la junta en la
 * reunión de principios de año, cuando lo que importa es el ejercicio cerrado.
 */
export default function ComoVaElAnio({ panelDeHoy }: { panelDeHoy: PanelResponse }) {
  const { graficas } = useTemaCms()
  const anioActual = panelDeHoy.ejercicio.anio
  const [anio, setAnio] = useState(anioActual)
  const esElActual = anio === anioActual

  // Con el año en curso no se pide nada: los datos ya están arriba. Al elegir
  // uno cerrado, la clave incluye el año, así que lo ya cargado no se borra y
  // volver atrás es instantáneo.
  const consulta = useQuery({
    queryKey: ['panel', anio],
    queryFn: () => getPanel(anio),
    enabled: !esElActual,
    placeholderData: (anterior) => anterior,
  })
  const datos = esElActual ? panelDeHoy : consulta.data

  const anios = Array.from({ length: EJERCICIOS }, (_, i) => anioActual - i)

  return (
    <Box component="section" aria-labelledby="como-va" sx={{ mt: 4, pt: 4, borderTop: 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
            El Grupo Parroquial en datos · igual para toda la junta
          </Typography>
          <Typography id="como-va" variant="h4" component="h2" sx={{ fontSize: 30, mt: 1 }}>
            Cómo va el año
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Solo cifras de conjunto: aquí nunca aparecen datos de una persona.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 2.5, flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          label="Ejercicio"
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          sx={{ minWidth: 140 }}
        >
          {anios.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <Typography variant="body2" color="text.secondary">
          {esElActual
            ? 'Ejercicio en curso · el censo, en los últimos doce meses'
            : `Ejercicio ${anio} · cerrado · de enero a diciembre`}
        </Typography>
      </Box>

      {!datos ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
          Cargando el ejercicio {anio}…
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(12, minmax(0, 1fr))' }, gap: 2.5 }}>
          <Tarjeta titulo="Censo de hermanos" subtitulo="Hermanos activos al cierre de cada mes">
            <LineaTemporal
              etiqueta="Hermanos activos"
              paleta={graficas}
              puntos={datos.censo.serieMensual.map((p) => ({ x: p.mes, y: p.activos }))}
              etiquetaX={etiquetaPunto}
            />
            <TablaDeDatos
              titulo="Hermanos activos al cierre de cada mes"
              columnas={['Mes', 'Activos']}
              filas={datos.censo.serieMensual.map((p) => [etiquetaPuntoLarga(p.mes), numero(p.activos)])}
            />
          </Tarjeta>

          <Tarjeta titulo="Altas y bajas" subtitulo="Cuántos entran y cuántos se van cada mes">
            <ColumnasDivergentes
              meses={datos.censo.movimientosMensuales.map((m) => ({ mes: m.mes, arriba: m.altas, abajo: m.bajas }))}
              paleta={graficas}
              etiquetaArriba="Altas"
              etiquetaAbajo="Bajas"
              etiquetaX={etiquetaPunto}
            />
            <TablaDeDatos
              titulo="Altas y bajas por mes"
              columnas={['Mes', 'Altas', 'Bajas']}
              filas={datos.censo.movimientosMensuales.map((m) => [etiquetaPuntoLarga(m.mes), m.altas, m.bajas])}
            />
          </Tarjeta>

          <Tarjeta
            titulo="Ingresos y gastos por mes"
            subtitulo={`Lo que entra y lo que sale cada mes · saldo del ejercicio ${eurosResumen(datos.dinero.ejercicio.saldo)}`}
            ancha
          >
            <ColumnasPorPares
              puntos={datos.dinero.serieMensual.map((m) => ({ clave: m.mes, a: m.ingresos, b: m.gastos }))}
              paleta={graficas}
              etiquetaA="Ingresos"
              etiquetaB="Gastos"
              formatoValor={eurosResumen}
              etiquetaX={etiquetaPunto}
              etiquetaXLarga={etiquetaPuntoLarga}
            />
            <TablaDeDatos
              titulo="Ingresos y gastos por mes"
              columnas={['Mes', 'Ingresos', 'Gastos']}
              filas={datos.dinero.serieMensual.map((m) => [etiquetaPuntoLarga(m.mes), euros(m.ingresos), euros(m.gastos)])}
            />
          </Tarjeta>

          <Tarjeta titulo="En qué se gasta" subtitulo={`Gastos de ${datos.ejercicio.anio} por categoría contable`}>
            <BarrasHorizontales
              color={graficas.salida}
              formatoValor={eurosResumen}
              filas={datos.dinero.porCategoria
                .filter((c) => c.tipo === 'GASTO')
                .sort((a, b) => b.importe - a.importe)
                .map((c) => ({ etiqueta: c.categoria, valor: c.importe }))}
            />
            <TablaDeDatos
              titulo="Gasto por categoría"
              columnas={['Categoría', 'Importe', 'Apuntes']}
              filas={datos.dinero.porCategoria
                .filter((c) => c.tipo === 'GASTO')
                .sort((a, b) => b.importe - a.importe)
                .map((c) => [c.categoria, euros(c.importe), c.total])}
            />
          </Tarjeta>

          <Tarjeta titulo="Cobro de recibos" subtitulo={`Recibos del ejercicio ${datos.ejercicio.anio} según su estado`}>
            <ProporcionEstados
              paleta={graficas}
              formatoImporte={eurosResumen}
              estados={ESTADOS.map<FilaEstado>((e) => {
                const fila = datos.dinero.porEstado.find((f) => f.estado === e.clave)
                return { clave: e.clave, etiqueta: e.etiqueta, estado: e.estado, total: fila?.total ?? 0, importe: fila?.importe ?? 0 }
              })}
            />
            <TablaDeDatos
              titulo="Recibos por estado"
              columnas={['Estado', 'Recibos', 'Importe']}
              filas={datos.dinero.porEstado.map((f) => [f.estado, f.total, euros(f.importe)])}
            />
          </Tarjeta>

          <Tarjeta titulo="Papeletas de sitio" subtitulo="Últimos cinco años, con el ejercicio elegido destacado">
            <ColumnasPorAnio datos={datos.procesion.porAnio} paleta={graficas} destacado={datos.ejercicio.anio} />
            <TablaDeDatos
              titulo="Papeletas por año"
              columnas={['Año', 'Papeletas']}
              filas={datos.procesion.porAnio.map((a) => [String(a.anio), numero(a.total)])}
            />
          </Tarjeta>

          <Tarjeta titulo="Hermanos por edad" subtitulo="Hermanos activos por tramo de edad, a día de hoy">
            {/* De hoy siempre: la edad de quien estaba activo en 2023 no se puede
                reconstruir con agregados, y el subtítulo lo dice. */}
            <BarrasHorizontales
              color={graficas.neutro}
              formatoValor={numero}
              filas={panelDeHoy.censo.porEdad.map((t) => ({ etiqueta: t.tramo, valor: t.total }))}
            />
            <TablaDeDatos
              titulo="Hermanos activos por tramo de edad"
              columnas={['Tramo', 'Hermanos']}
              filas={panelDeHoy.censo.porEdad.map((t) => [t.tramo, numero(t.total)])}
            />
          </Tarjeta>
        </Box>
      )}
    </Box>
  )
}
