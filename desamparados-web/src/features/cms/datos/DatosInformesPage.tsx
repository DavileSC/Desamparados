import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { guardarEnDisco, traerDatos, traerInforme, type AreaDato, type CifraDato, type ClaveArea } from '../../../lib/api/datos'
import { eurosResumen, numero } from '../contabilidad/formato'
import { useAltoDisponible } from '../inicio/useAltoDisponible'
import { entrada } from '../inicio/animaciones'
import { FILETE, FONDO_PIEZA, ORO, ROJO_GRAFICA, SERIF, VERDE, VERSALITAS } from '../inicio/estiloRetablo'
import GraficaDatos, { Muestra } from './GraficaDatos'
import { site } from '../../../config/site'

const decimal = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** La cifra escrita igual que en el PDF: con signo las diferencias, con coma la edad. */
export function escribirCifra(c: Pick<CifraDato, 'valor' | 'formato'>): string {
  const signo = c.valor > 0 ? '+' : c.valor < 0 ? '−' : ''
  switch (c.formato) {
    case 'euros': return eurosResumen(Math.round(c.valor))
    case 'decimal': return decimal.format(c.valor)
    case 'diferencia': return `${signo}${numero(Math.abs(c.valor))}`
    case 'diferencia-euros': return `${signo}${eurosResumen(Math.round(Math.abs(c.valor)))}`
    default: return numero(c.valor)
  }
}

/**
 * Junta › Datos e informes: cómo va el Grupo, área por área, con una gráfica
 * protagonista (como las Cifras del Inicio) y el informe de cada área en PDF.
 * Siempre por año natural. El año y la pestaña viajan en la dirección: se
 * puede volver o mandar el enlace y se abre igual.
 *
 * Cabe en la pantalla sin scroll: la gráfica se queda con el alto que sobra.
 */
export default function DatosInformesPage() {
  const [params, setParams] = useSearchParams()
  const anioPedido = params.get('anio') ?? undefined
  const { referencia, alto } = useAltoDisponible()
  const [elegidas, setElegidas] = useState<Partial<Record<ClaveArea, number>>>({})
  const botones = useRef<(HTMLButtonElement | null)[]>([])
  const idPanel = useId()

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ['datos', anioPedido ?? 'actual'],
    queryFn: () => traerDatos(anioPedido),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const informe = useMutation({
    mutationFn: ({ area, anio }: { area: AreaDato; anio: string }) => traerInforme(area.clave, anio).then((f) => ({ f, area })),
    onSuccess: ({ f, area }) => guardarEnDisco(f, `${area.informe}.pdf`),
  })

  if (isPending) return <CircularProgress aria-label="Cargando los datos" />
  if (isError || !data) return <Alert severity="error">No se han podido cargar los datos. Inténtalo de nuevo en unos minutos.</Alert>

  const claves = data.areas.map((a) => a.clave)
  const pedida = params.get('area') as ClaveArea | null
  const area = data.areas.find((a) => a.clave === pedida) ?? data.areas[0]
  const elegida = elegidas[area.clave] ?? 0
  const cifra = area.cifras[elegida]

  const cambiar = (cambios: Record<string, string>) => {
    const nuevos = new URLSearchParams(params)
    for (const [k, v] of Object.entries(cambios)) nuevos.set(k, v)
    setParams(nuevos, { replace: true })
  }
  const abrir = (clave: ClaveArea) => cambiar({ area: clave })
  const conTeclas = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const siguiente = (i + (e.key === 'ArrowRight' ? 1 : -1) + claves.length) % claves.length
    abrir(claves[siguiente])
    botones.current[siguiente]?.focus()
  }

  return (
    <Box
      ref={referencia}
      sx={{
        display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.6vh, 14px)',
        height: { md: alto ? `${Math.max(alto - 32, 460)}px` : 'auto' },
        '& > *': { flexShrink: 0 },
      }}
    >
      <Helmet><title>{`Datos e informes | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box component="span" sx={{ ...VERSALITAS, fontSize: 10.5, color: ORO }}>Junta</Box>
          <Typography component="h1" sx={{ ...SERIF, fontSize: 'clamp(26px, 4.4vh, 32px)', lineHeight: 1.05 }}>Datos e informes</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
          <TextField
            select
            size="small"
            label="Año"
            value={data.periodo.clave}
            onChange={(e) => cambiar({ anio: e.target.value })}
            sx={{ minWidth: 160 }}
          >
            {data.periodos.map((p) => <MenuItem key={p.clave} value={p.clave}>{p.etiqueta}</MenuItem>)}
          </TextField>
          <Button variant="contained" component={Link} to={`/cms/informe-anual/${data.periodo.anio}`}>Informe anual</Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, borderBottom: `1px solid ${FILETE}`, flexWrap: 'wrap' }}>
        <Box role="tablist" aria-label="Datos" sx={{ display: 'flex', gap: { xs: 2, md: 3.25 }, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', maxWidth: '100%' }}>
          {data.areas.map((a, i) => {
            const activa = a.clave === area.clave
            return (
              <Box
                key={a.clave}
                component="button"
                type="button"
                role="tab"
                id={`datos-pestana-${a.clave}`}
                aria-selected={activa}
                aria-controls={idPanel}
                tabIndex={activa ? 0 : -1}
                ref={(nodo: HTMLButtonElement | null) => { botones.current[i] = nodo }}
                onClick={() => abrir(a.clave)}
                onKeyDown={(e: KeyboardEvent) => conTeclas(e, i)}
                sx={{
                  flexShrink: 0, height: 'clamp(34px, 5.4vh, 40px)', px: 0.25, mb: '-1px', border: 0, borderBottom: '2px solid', borderColor: activa ? ORO : 'transparent',
                  background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: activa ? 'text.primary' : 'text.secondary', '&:hover': { color: 'text.primary' }, '&:focus-visible': { outline: `2px solid ${ORO}`, outlineOffset: 2 },
                }}
              >
                {a.nombre}
              </Box>
            )
          })}
        </Box>
        <Button
          variant="outlined"
          size="small"
          disabled={informe.isPending}
          startIcon={informe.isPending ? <CircularProgress size={14} /> : undefined}
          onClick={() => informe.mutate({ area, anio: data.periodo.clave })}
          sx={{ mb: 0.5, whiteSpace: 'nowrap' }}
        >
          {`${area.informe} · PDF`}
        </Button>
      </Box>

      {informe.isError && <Alert severity="error" onClose={() => informe.reset()}>{informe.error.message}</Alert>}

      <Box
        id={idPanel}
        role="tabpanel"
        aria-labelledby={`datos-pestana-${area.clave}`}
        aria-busy={isFetching}
        sx={{
          flex: { md: '1 1 0 !important' }, minHeight: 0, display: 'grid', gap: 'clamp(8px, 1.6vh, 12px)',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(180px, 220px) minmax(0, 1fr)' },
          gridTemplateRows: { xs: 'auto minmax(340px, auto)', md: 'minmax(0, 1fr)' },
          opacity: isFetching ? 0.6 : 1, transition: 'opacity .2s',
        }}
      >
        <Box sx={{ minHeight: 0, display: 'grid', gap: 1, gridTemplateRows: { md: 'repeat(4, minmax(0, 1fr))' }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'minmax(0, 1fr)' } }}>
          {area.cifras.map((c, i) => {
            const activa = i === elegida
            const tono = c.formato.startsWith('diferencia') && c.tono ? (c.tono === 'bueno' ? VERDE : ROJO_GRAFICA) : undefined
            return (
              <Box
                key={`${area.clave}-${c.etiqueta}`}
                component="button"
                type="button"
                aria-pressed={activa}
                aria-controls={`${idPanel}-grafica`}
                onClick={() => setElegidas((e) => ({ ...e, [area.clave]: i }))}
                sx={{
                  minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.25,
                  px: 2, py: 1, m: 0, borderRadius: 2, textAlign: 'left', fontFamily: 'inherit', color: 'text.primary', cursor: 'pointer',
                  border: '1px solid', borderColor: activa ? `color-mix(in srgb, ${ORO} 60%, transparent)` : FILETE,
                  backgroundColor: activa ? `color-mix(in srgb, ${ORO} 9%, transparent)` : 'transparent',
                  '&:hover': { borderColor: `color-mix(in srgb, ${ORO} 45%, transparent)` },
                  '&:focus-visible': { outline: `2px solid ${ORO}`, outlineOffset: 2 },
                  ...entrada(i + 1),
                }}
              >
                <Box component="span" sx={{ ...VERSALITAS, fontSize: 10.5, color: activa ? ORO : 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.etiqueta}</Box>
                <Box component="span" sx={{ ...SERIF, fontSize: 'clamp(24px, 4.4vh, 30px)', lineHeight: 1, whiteSpace: 'nowrap', color: tono }}>
                  {escribirCifra(c)}
                  {c.sufijo && <Box component="em" sx={{ fontSize: '0.6em', color: 'text.secondary', ml: 0.75 }}>{c.sufijo}</Box>}
                </Box>
                <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nota}</Box>
              </Box>
            )
          })}
        </Box>

        <Box
          id={`${idPanel}-grafica`}
          aria-live="polite"
          sx={{
            minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 0.75,
            px: 'clamp(14px, 2vw, 24px)', py: 'clamp(10px, 2vh, 16px)', borderRadius: 2.5, border: `1px solid ${FILETE}`, backgroundColor: FONDO_PIEZA,
            '& > *': { flexShrink: 0 },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '2px 16px', flexWrap: 'wrap' }}>
            <Typography component="h2" sx={{ ...SERIF, fontSize: 'clamp(19px, 3vh, 23px)', lineHeight: 1.15 }}>{cifra.grafica.titulo}</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{cifra.grafica.resumen}</Typography>
          </Box>
          {!!cifra.grafica.leyenda?.length && !cifra.grafica.vacio && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: 'text.secondary' }}>
              {cifra.grafica.leyenda.map((l) => <Muestra key={l.texto} color={l.color}>{l.texto}</Muestra>)}
            </Box>
          )}
          <Box key={`${area.clave}-${elegida}-${data.periodo.clave}`} sx={{ flex: '1 1 0 !important', minHeight: 0, display: 'flex', flexDirection: 'column', pt: 1 }}>
            <GraficaDatos grafica={cifra.grafica} />
          </Box>
          {(cifra.grafica.pie || area.alcance) && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{cifra.grafica.pie ?? area.alcance}</Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}
