import { useState } from 'react'
import { Alert, Box, Button, MenuItem, Paper, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { traerPanelDeHoy, type PanelResponse, type TipoMovimiento } from '../../../lib/api/panel'
import { useTemaCms } from '../../../app/useTemaCms'
import { fondoTarjeta, type TonoTarjeta } from '../../../theme/tarjeta'
import LineaTemporal from '../../../components/charts/LineaTemporal'
import BarrasHorizontales from '../../../components/charts/BarrasHorizontales'
import ColumnasPorPares from '../../../components/charts/ColumnasPorPares'
import ProporcionEstados, { type FilaEstado } from '../../../components/charts/ProporcionEstados'
import TablaDeDatos from '../../../components/charts/TablaDeDatos'
import Cortejo from './Cortejo'
import { euros, eurosResumen, numero, etiquetaPunto, etiquetaPuntoLarga } from '../contabilidad/formato'

/**
 * Los tres temas en que se reparten las gráficas. Todas juntas eran once
 * seguidas —censo, dinero y procesión mezclados— y ninguna se leía: quien
 * entraba a ver cómo va el cobro de recibos bajaba por tallas de túnica.
 * Cada pestaña enseña tres o cuatro, y el ejercicio elegido rige las tres.
 */
const PESTANAS = [
  { clave: 'hermanos', etiqueta: 'Hermanos', resumen: 'Censo, altas y bajas, y edades' },
  { clave: 'dinero', etiqueta: 'Dinero', resumen: 'Ingresos, gastos y cobro de recibos' },
  { clave: 'procesion', etiqueta: 'Procesión', resumen: 'Papeletas, puestos, túnicas y varales' },
] as const

type Pestana = typeof PESTANAS[number]['clave']

/** Cuántos ejercicios ofrece el selector. Cinco cubre de sobra la reunión de enero. */
const EJERCICIOS = 5

/**
 * Los estados de recibo que interesan, con su severidad. ANULADO y EXENTO se
 * quedan fuera a propósito: un recibo anulado o exento no es cobro pendiente,
 * y meterlo en el denominador del porcentaje lo hundiría sin motivo.
 */
const ESTADOS = [
  { clave: 'PAGADO', etiqueta: 'Cobrados', estado: 'ok' as const },
  { clave: 'PENDIENTE', etiqueta: 'Pendientes', estado: 'aviso' as const },
  { clave: 'REMESADO', etiqueta: 'Remesados al banco', estado: 'aviso' as const },
  { clave: 'DEVUELTO', etiqueta: 'Devueltos por el banco', estado: 'error' as const },
]

/**
 * Una gráfica de la sección. `columnas` es lo que ocupa de las doce: cada
 * gráfica pide un ancho distinto (una serie de doce meses necesita sitio; un
 * marcador de cuatro cifras, no), y así cada fila cierra sin dejar medio hueco
 * vacío, que es lo que pasaba cuando todas medían lo mismo.
 */
function Tarjeta({
  titulo, subtitulo, columnas = 6, tono = 'neutro', children,
}: {
  titulo: string
  subtitulo: string
  columnas?: number
  /** El color del velo de la tarjeta, por lo que cuenta la gráfica. */
  tono?: TonoTarjeta
  children: React.ReactNode
}) {
  const { superficies } = useTemaCms()
  return (
    <Paper
      component="section"
      sx={{
        ...fondoTarjeta(tono, superficies.card),
        // Relativa: ancla la tabla oculta, que si no se iría al borde de la página.
        position: 'relative', borderRadius: 1.75, p: 2.75, display: 'flex', flexDirection: 'column', gap: 1.75,
        gridColumn: { xs: '1 / -1', lg: `span ${columnas}` },
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
 * «Cómo va el año»: un selector de ejercicio que gobierna las gráficas de esta
 * sección y nada más. La cabecera del Inicio, «Para hoy», el curso, el mes y la
 * cuenta atrás no cambian nunca; el selector existe porque el Inicio se
 * enseña a la junta en la reunión de principios de año, cuando lo que importa
 * es el ejercicio cerrado.
 */
export default function ComoVaElAnio({ panelDeHoy }: { panelDeHoy: PanelResponse }) {
  const { graficas, superficies } = useTemaCms()
  const anioActual = panelDeHoy.ejercicio.anio
  const [anio, setAnio] = useState(anioActual)
  const [pestana, setPestana] = useState<Pestana>('hermanos')
  const esElActual = anio === anioActual

  // Con el año en curso no se pide nada: los datos ya están arriba. Al elegir
  // uno cerrado, la clave incluye el año, así que lo ya cargado no se borra y
  // volver atrás es instantáneo.
  const consulta = useQuery({
    queryKey: ['panel', anio],
    queryFn: () => traerPanelDeHoy(anio),
    enabled: !esElActual,
    placeholderData: (anterior) => anterior,
  })
  const datos = esElActual ? panelDeHoy : consulta.data

  const anios = Array.from({ length: EJERCICIOS }, (_, i) => anioActual - i)

  // Misma lista para el dibujo y para la tabla de «Cobro de recibos»: así no
  // pueden discrepar nunca, ni cuando aparezca un estado que ESTADOS no cubre.
  const filasEstado: FilaEstado[] = datos
    ? ESTADOS.map((e) => {
        const fila = datos.dinero.porEstado.find((f) => f.estado === e.clave)
        return { clave: e.clave, etiqueta: e.etiqueta, estado: e.estado, total: fila?.total ?? 0, importe: fila?.importe ?? 0 }
      })
    : []

  // Misma lista para la gráfica y para su tabla, tanto en «De dónde entra»
  // como en «En qué se gasta»: así el filtro por tipo y el orden por importe
  // no se escriben dos veces, ni se pueden desincronizar entre las dos.
  const categoriasPorTipo = (tipo: TipoMovimiento) =>
    datos ? [...datos.dinero.porCategoria].filter((c) => c.tipo === tipo).sort((a, b) => b.importe - a.importe) : []
  const ingresosPorCategoria = categoriasPorTipo('INGRESO')
  const gastosPorCategoria = categoriasPorTipo('GASTO')

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

      <Tabs
        value={pestana}
        onChange={(_, valor: Pestana) => setPestana(valor)}
        aria-label="Temas de «Cómo va el año»"
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          borderBottom: 1, borderColor: 'divider', mb: 2,
          // La pestaña elegida, en el color de enlace: el granate primario no se lee sobre oscuro.
          '& .MuiTab-root.Mui-selected': { color: superficies.enlace },
          '& .MuiTabs-indicator': { backgroundColor: superficies.enlace },
        }}
      >
        {PESTANAS.map((p) => (
          <Tab key={p.clave} value={p.clave} label={p.etiqueta} id={`pestana-${p.clave}`} aria-controls={`panel-${p.clave}`} />
        ))}
      </Tabs>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {PESTANAS.find((p) => p.clave === pestana)?.resumen}
      </Typography>

      {consulta.isError ? (
        // Con retry: 1 (App.tsx), tras dos intentos fallidos la consulta se
        // queda en isError para siempre: sin esta rama, el cartel de «Cargando…»
        // se quedaba fijo sin explicación ni forma de salir de ahí.
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => setAnio(anioActual)}>
              Volver al ejercicio en curso
            </Button>
          }
          sx={{ my: 4 }}
        >
          No se ha podido cargar el ejercicio {anio}.
        </Alert>
      ) : !datos ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
          Cargando el ejercicio {anio}…
        </Typography>
      ) : (
        <>
          <Box
            role="tabpanel"
            id="panel-hermanos"
            aria-labelledby="pestana-hermanos"
            hidden={pestana !== 'hermanos'}
            sx={{
              display: pestana === 'hermanos' ? 'grid' : 'none',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(12, minmax(0, 1fr))' },
              gap: 2.5,
            }}
          >
            {/* El censo y lo que lo mueve, juntos: las altas y bajas de cada mes ya
                salen en la gráfica de la baldosa de arriba, así que aquí van solo
                en la tabla. Sin total en el subtítulo: la baldosa cuenta los
                últimos 365 días y esto, meses enteros, y no cuadrarían. */}
            <Tarjeta
              tono="burdeos"
              titulo="Censo de hermanos"
              subtitulo="Hermanos activos al cierre de cada mes, con sus altas y bajas en la tabla"
              columnas={8}
            >
              <LineaTemporal
                etiqueta="Hermanos activos"
                paleta={graficas}
                puntos={datos.censo.serieMensual.map((p) => ({ x: p.mes, y: p.activos }))}
                formatoValor={numero}
                etiquetaX={etiquetaPunto}
              />
              <TablaDeDatos
                titulo="Hermanos activos, altas y bajas de cada mes"
                columnas={['Mes', 'Activos', 'Altas', 'Bajas']}
                filas={datos.censo.serieMensual.map((p) => {
                  const m = datos.censo.movimientosMensuales.find((x) => x.mes === p.mes)
                  return [etiquetaPuntoLarga(p.mes), numero(p.activos), numero(m?.altas ?? 0), numero(m?.bajas ?? 0)]
                })}
              />
            </Tarjeta>

            <Tarjeta tono="rosa" titulo="Hermanos por edad" subtitulo="Hermanos activos por tramo de edad, a día de hoy" columnas={4}>
              {/* De hoy siempre: la edad de quien estaba activo en 2023 no se puede
                  reconstruir con agregados, y el subtítulo lo dice. */}
              <BarrasHorizontales
                color={graficas.acento}
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

          <Box
            role="tabpanel"
            id="panel-dinero"
            aria-labelledby="pestana-dinero"
            hidden={pestana !== 'dinero'}
            sx={{
              display: pestana === 'dinero' ? 'grid' : 'none',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(12, minmax(0, 1fr))' },
              gap: 2.5,
            }}
          >
            <Tarjeta
              tono="azul"
              titulo="Ingresos y gastos por mes"
              subtitulo={`Ingresos ${eurosResumen(datos.dinero.ejercicio.ingresos)} · Gastos ${eurosResumen(datos.dinero.ejercicio.gastos)} · Saldo ${eurosResumen(datos.dinero.ejercicio.saldo)}`}
              columnas={8}
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

            <Tarjeta tono="neutro" titulo="Cobro de recibos" subtitulo={`Recibos del ejercicio ${datos.ejercicio.anio} según su estado`} columnas={4}>
              <ProporcionEstados paleta={graficas} formatoImporte={eurosResumen} formatoNumero={numero} estados={filasEstado} />
              <TablaDeDatos
                titulo="Recibos por estado"
                columnas={['Estado', 'Recibos', 'Importe']}
                filas={filasEstado.map((f) => [f.etiqueta, numero(f.total), euros(f.importe)])}
              />
            </Tarjeta>

            <Tarjeta tono="azul" titulo="De dónde entra" subtitulo={`Ingresos de ${datos.ejercicio.anio} por categoría contable`}>
              <BarrasHorizontales
                color={graficas.entrada}
                formatoValor={eurosResumen}
                filas={ingresosPorCategoria.map((c) => ({ etiqueta: c.categoria, valor: c.importe }))}
              />
              <TablaDeDatos
                titulo="Ingreso por categoría"
                columnas={['Categoría', 'Importe', 'Apuntes']}
                filas={ingresosPorCategoria.map((c) => [c.categoria, euros(c.importe), numero(c.total)])}
              />
            </Tarjeta>

            <Tarjeta tono="burdeos" titulo="En qué se gasta" subtitulo={`Gastos de ${datos.ejercicio.anio} por categoría contable`}>
              <BarrasHorizontales
                color={graficas.salida}
                formatoValor={eurosResumen}
                filas={gastosPorCategoria.map((c) => ({ etiqueta: c.categoria, valor: c.importe }))}
              />
              <TablaDeDatos
                titulo="Gasto por categoría"
                columnas={['Categoría', 'Importe', 'Apuntes']}
                filas={gastosPorCategoria.map((c) => [c.categoria, euros(c.importe), numero(c.total)])}
              />
            </Tarjeta>

          </Box>

          <Box
            role="tabpanel"
            id="panel-procesion"
            aria-labelledby="pestana-procesion"
            hidden={pestana !== 'procesion'}
            sx={{
              display: pestana === 'procesion' ? 'grid' : 'none',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(12, minmax(0, 1fr))' },
              gap: 2.5,
            }}
          >
            {/* El cortejo del ejercicio elegido: el anillo por puestos y, al pie,
                los últimos años. Antes iba también arriba, en lo de hoy, y aquí
                repetían lo mismo «Papeletas de sitio» y «Puestos de la procesión». */}
            <Box sx={{ gridColumn: '1 / -1', minWidth: 0 }}>
              <Cortejo procesion={datos.procesion} />
            </Box>

            {/* Túnicas y varales, cada uno en su tarjeta: juntos en una sola
                a todo lo ancho, las dos gráficas quedaban en dos columnas que
                nada tenían que ver entre sí. Son siempre de hoy, igual que
                «Hermanos por edad»: la talla o la altura de hombro de quien
                estaba activo en un ejercicio cerrado no se pueden reconstruir
                con agregados, así que se leen de panelDeHoy y no del ejercicio
                elegido arriba. */}
            <Tarjeta
              tono="rosa"
              titulo="Tallas de túnica"
              subtitulo="Hermanos activos a día de hoy, para saber cuántas túnicas de cada talla hacen falta"
              columnas={6}
            >
              <BarrasHorizontales
                color={graficas.acento}
                formatoValor={numero}
                filas={panelDeHoy.procesion.porTalla.map((t) => ({ etiqueta: t.etiqueta, valor: t.total }))}
              />
              <TablaDeDatos
                titulo="Hermanos activos por talla de túnica"
                columnas={['Talla', 'Hermanos']}
                filas={panelDeHoy.procesion.porTalla.map((t) => [t.etiqueta, numero(t.total)])}
              />
            </Tarjeta>

            <Tarjeta
              tono="oro"
              titulo="Altura de hombro"
              subtitulo="Hermanos activos a día de hoy, para repartir los varales del trono"
              columnas={6}
            >
              <BarrasHorizontales
                color={graficas.acento}
                formatoValor={numero}
                filas={panelDeHoy.procesion.porAlturaHombro.map((a) => ({ etiqueta: a.tramo, valor: a.total }))}
              />
              <TablaDeDatos
                titulo="Hermanos activos por altura de hombro"
                columnas={['Altura', 'Hermanos']}
                filas={panelDeHoy.procesion.porAlturaHombro.map((a) => [a.tramo, numero(a.total)])}
              />
            </Tarjeta>
          </Box>
        </>
      )}
    </Box>
  )
}
