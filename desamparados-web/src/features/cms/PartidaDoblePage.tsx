import { useEffect, useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, MenuItem, Pagination, Paper, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import {
  asignarCuenta, contabilidadEnExcel, ejercicioContable, libroDiario, planDeCuentas,
  type EjercicioContable, type PaginaDelDiario, type PlanDeCuentas,
} from '../../lib/api/contabilidad'
import { guardarEnDisco } from '../../lib/api/datos'
import CabeceraSeccion from './CabeceraSeccion'
import { euros } from './contabilidad/formato'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const importe = (n: number) => (n ? euros(n) : '')
const POR_PAGINA = 50

type Vista = 'resultados' | 'sumas' | 'diario' | 'plan'

/**
 * La contabilidad por partida doble del ejercicio, sacada del libro de caja:
 * cuenta de resultados, sumas y saldos, libro diario y el plan de cuentas de
 * las categorías. Nada se apunta aquí: se apunta en el libro de caja, como
 * siempre, y aquí se ve con sus cuentas.
 */
export default function PartidaDoblePage() {
  const [anio, setAnio] = useState(String(new Date().getFullYear()))
  const [vista, setVista] = useState<Vista>('resultados')
  const [ejercicio, setEjercicio] = useState<EjercicioContable | null>(null)
  const [plan, setPlan] = useState<PlanDeCuentas | null>(null)
  const [diario, setDiario] = useState<PaginaDelDiario | null>(null)
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  const anioValido = /^\d{4}$/.test(anio)
  useEffect(() => {
    if (!anioValido) return
    let cancelado = false
    Promise.all([ejercicioContable(Number(anio)), planDeCuentas()])
      .then(([e, p]) => { if (!cancelado) { setEjercicio(e); setPlan(p); setError(null) } })
      .catch((err: unknown) => { if (!cancelado) setError(mensaje(err, 'No se ha podido cargar la contabilidad.')) })
    return () => { cancelado = true }
  }, [anio, anioValido, recarga])

  useEffect(() => {
    if (!anioValido || vista !== 'diario') return
    let cancelado = false
    libroDiario(Number(anio), pagina, POR_PAGINA)
      .then((d) => { if (!cancelado) setDiario(d) })
      .catch((err: unknown) => { if (!cancelado) setError(mensaje(err, 'No se ha podido cargar el libro diario.')) })
    return () => { cancelado = true }
  }, [anio, anioValido, vista, pagina, recarga])

  const cambiarCuenta = async (categoriaId: number, cuenta: string) => {
    setError(null)
    try { setPlan(await asignarCuenta(categoriaId, cuenta || null)); setRecarga((r) => r + 1) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido cambiar la cuenta.')) }
  }

  const descargar = async () => {
    setError(null)
    try { guardarEnDisco(await contabilidadEnExcel(Number(anio)), `contabilidad-${anio}.xlsx`) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido descargar.')) }
  }

  const r = ejercicio?.resultados
  return <>
    <Helmet><title>Partida doble | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Partida doble" subtitulo="El libro de caja con sus cuentas del plan de las entidades sin fines lucrativos.">
      <TextField size="small" label="Ejercicio" type="number" value={anio} onChange={(e) => { setAnio(e.target.value); setPagina(1) }} sx={{ width: 120 }} />
      <Button variant="outlined" startIcon={<DownloadIcon />} disabled={!anioValido} onClick={() => void descargar()}>Excel</Button>
      <Button component={Link} to="/cms/contabilidad">Libro de caja</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {ejercicio && ejercicio.categoriasPropuestas > 0 && (
      <Alert severity="info" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => setVista('plan')}>Revisar</Button>}>
        {ejercicio.categoriasPropuestas === 1 ? 'Una categoría usa' : `${ejercicio.categoriasPropuestas} categorías usan`} la cuenta que se propone por su nombre. Revísalas en el plan de cuentas.
      </Alert>
    )}

    <Tabs value={vista} onChange={(_, v: Vista) => setVista(v)} sx={{ mb: 2 }} variant="scrollable" allowScrollButtonsMobile>
      <Tab value="resultados" label="Cuenta de resultados" />
      <Tab value="sumas" label="Sumas y saldos" />
      <Tab value="diario" label="Libro diario" />
      <Tab value="plan" label="Plan de cuentas" />
    </Tabs>

    {!ejercicio && !error && <CircularProgress aria-label="Cargando la contabilidad" />}

    {ejercicio && r && vista === 'resultados' && (
      <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: 760 }}>
        {ejercicio.asientos === 0 && <Alert severity="info" sx={{ mb: 2 }}>No hay apuntes en {ejercicio.anio}.</Alert>}
        {([['Ingresos de la actividad', r.ingresos, r.totalIngresos, 1], ['Gastos de la actividad', r.gastos, r.totalGastos, -1]] as const).map(([titulo, filas, total, signo]) => (
          <Box key={titulo} sx={{ mb: 3 }}>
            <Typography sx={{ fontWeight: 600, mb: 1 }}>{titulo}</Typography>
            {filas.map((x) => (
              <Box key={x.cuenta} sx={{ display: 'flex', gap: 2, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ width: 40, color: 'text.secondary' }}>{x.cuenta}</Typography>
                <Typography variant="body2" sx={{ flex: 1 }}>{x.nombre}</Typography>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{euros(signo * x.importe)}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Total</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{euros(signo * total)}</Typography>
            </Box>
          </Box>
        ))}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2, borderTop: '2px solid', borderColor: 'text.primary' }}>
          <Typography sx={{ fontWeight: 700 }}>Excedente del ejercicio</Typography>
          <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{euros(r.excedente)}</Typography>
        </Box>
      </Paper>
    )}

    {ejercicio && vista === 'sumas' && (
      <TableContainer component={Paper}>
        <Table size="small" sx={{ minWidth: 640 }} aria-label="Sumas y saldos">
          <TableHead><TableRow><TableCell>Cuenta</TableCell><TableCell>Nombre</TableCell><TableCell align="right">Debe</TableCell><TableCell align="right">Haber</TableCell><TableCell align="right">Saldo</TableCell></TableRow></TableHead>
          <TableBody>
            {ejercicio.sumas.map((s) => (
              <TableRow key={s.cuenta}>
                <TableCell>{s.cuenta}</TableCell><TableCell>{s.nombre}</TableCell>
                <TableCell align="right">{importe(s.debe)}</TableCell><TableCell align="right">{importe(s.haber)}</TableCell>
                <TableCell align="right">{s.saldo === 0 ? '' : `${euros(Math.abs(s.saldo))} ${s.saldo > 0 ? 'D' : 'A'}`}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={2} sx={{ fontWeight: 600 }}>Total</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>{euros(ejercicio.sumas.reduce((t, s) => t + s.debe, 0))}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>{euros(ejercicio.sumas.reduce((t, s) => t + s.haber, 0))}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    )}

    {vista === 'diario' && (diario ? <>
      <TableContainer component={Paper}>
        <Table size="small" sx={{ minWidth: 720 }} aria-label="Libro diario">
          <TableHead><TableRow><TableCell>N.º</TableCell><TableCell>Fecha</TableCell><TableCell>Cuenta</TableCell><TableCell>Concepto</TableCell><TableCell align="right">Debe</TableCell><TableCell align="right">Haber</TableCell></TableRow></TableHead>
          <TableBody>
            {diario.asientos.flatMap((a) => a.lineas.map((l, i) => (
              <TableRow key={`${a.numero}-${i}`} sx={i === a.lineas.length - 1 ? { '& td': { borderBottomColor: 'text.secondary' } } : undefined}>
                <TableCell>{i === 0 ? a.numero : ''}</TableCell>
                <TableCell>{i === 0 ? a.fecha.split('-').reverse().join('/') : ''}</TableCell>
                <TableCell sx={{ pl: l.haber ? 4 : 2 }}>{l.cuenta} {l.nombre}</TableCell>
                <TableCell>{i === 0 ? a.concepto : ''}</TableCell>
                <TableCell align="right">{importe(l.debe)}</TableCell>
                <TableCell align="right">{importe(l.haber)}</TableCell>
              </TableRow>
            )))}
          </TableBody>
        </Table>
      </TableContainer>
      {diario.total > POR_PAGINA && (
        <Stack sx={{ alignItems: 'center', mt: 2 }}>
          <Pagination count={Math.ceil(diario.total / POR_PAGINA)} page={pagina} onChange={(_, p) => setPagina(p)} />
        </Stack>
      )}
    </> : <CircularProgress aria-label="Cargando el libro diario" />)}

    {plan && vista === 'plan' && (
      <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, display: 'grid', gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          La cuenta de cada categoría del libro de caja. Las marcadas como «propuesta» se han sacado del nombre: elige la que corresponda y queda guardada.
          La tesorería va sola: el efectivo a 570 Caja y lo demás a 572 Bancos.
        </Typography>
        {plan.categorias.map((c) => (
          <Box key={c.id} sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', opacity: c.activa ? 1 : 0.6 }}>
            <Typography sx={{ flex: '1 1 220px' }}>{c.nombre} <Typography component="span" variant="body2" color="text.secondary">· {c.tipo === 'INGRESO' ? 'ingreso' : 'gasto'}{c.activa ? '' : ' · desactivada'}</Typography></Typography>
            <TextField
              select size="small" value={c.cuenta} onChange={(e) => void cambiarCuenta(c.id, e.target.value)}
              helperText={c.propuesta ? 'Propuesta por el nombre' : undefined} sx={{ flex: '1 1 320px' }}
              slotProps={{ htmlInput: { 'aria-label': `Cuenta de ${c.nombre}` } }}
            >
              {plan.cuentas.filter((x) => /^[67]/.test(x.codigo)).map((x) => <MenuItem key={x.codigo} value={x.codigo}>{x.codigo} · {x.nombre}</MenuItem>)}
            </TextField>
          </Box>
        ))}
      </Paper>
    )}
  </>
}
