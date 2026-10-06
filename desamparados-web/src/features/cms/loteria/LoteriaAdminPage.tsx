import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CabeceraSeccion from '../CabeceraSeccion'
import VentanaFormulario from '../VentanaFormulario'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { euros, fechaCorta, etiquetaMetodo } from '../contabilidad/formato'
import { site } from '../../../config/site'
import {
  apuntarCompra, borrarSorteo, crearSorteo, crearTalonarios, deshacerCompra, deshacerLiquidacion, entregarTalonarios, guardarPremios,
  guardarSorteo, liquidarTalonario, pdfDeParticipaciones, quitarTalonario, sorteo as leerSorteo, sorteos as leerSorteos,
  type DatosSorteo, type SorteoConTalonarios, type Talonario,
} from '../../../lib/api/loteria'
import { DialogoCompra, DialogoEntrega, DialogoImprimir, DialogoLiquidacion, DialogoPremios, aNumero } from './DialogosLoteria'

const CLAVE = ['loteria'] as const
const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error && e.message ? e.message : porDefecto)
const plural = (n: number, una: string, varias: string) => `${n} ${n === 1 ? una : varias}`

interface Formulario { nombre: string; fecha: string; numeros: string; precioDecimo: string; decimos: string; precioParticipacion: string; jugado: string; porTalonario: string; leyenda: string }

const anio = new Date().getFullYear()
const EN_BLANCO: Formulario = { nombre: `Lotería de Navidad ${anio}`, fecha: `${anio}-12-22`, numeros: '', precioDecimo: '20', decimos: '', precioParticipacion: '5', jugado: '4', porTalonario: '50', leyenda: '' }
const coma = (n: number) => String(n).replace('.', ',')
const aFormulario = (s: SorteoConTalonarios): Formulario => ({
  nombre: s.nombre, fecha: s.fecha, numeros: s.numeros.map((n) => n.numero).join(', '), precioDecimo: coma(s.precioDecimo), decimos: String(s.decimos),
  precioParticipacion: coma(s.precioParticipacion), jugado: coma(s.jugado), porTalonario: String(s.porTalonario), leyenda: s.leyenda,
})
/** El formulario leído; null si falta algo o algo no se entiende. */
function aDatos(f: Formulario): DatosSorteo | null {
  const numeros = f.numeros.split(/[\s,;·]+/).filter(Boolean)
  const [precioDecimo, precioParticipacion, jugado] = [f.precioDecimo, f.precioParticipacion, f.jugado].map(aNumero)
  const decimos = /^\d+$/.test(f.decimos.trim()) ? Number(f.decimos) : 0
  const porTalonario = /^\d+$/.test(f.porTalonario.trim()) ? Number(f.porTalonario) : 0
  if (!f.nombre.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha) || numeros.length === 0 || numeros.some((n) => !/^\d{5}$/.test(n))) return null
  if (!precioDecimo || !precioParticipacion || !jugado || jugado > precioParticipacion || decimos < 1 || porTalonario < 1) return null
  return { nombre: f.nombre.trim(), fecha: f.fecha, numeros, precioDecimo, decimos, precioParticipacion, jugado, porTalonario, leyenda: f.leyenda.trim() }
}

type Filtro = 'todos' | 'secretaria' | 'calle' | 'liquidados'
const FILTROS: { valor: Filtro; etiqueta: string; cumple: (t: Talonario) => boolean }[] = [
  { valor: 'todos', etiqueta: 'Todos', cumple: () => true },
  { valor: 'secretaria', etiqueta: 'En Secretaría', cumple: (t) => !t.responsable && !t.liquidadoEl },
  { valor: 'calle', etiqueta: 'En la calle', cumple: (t) => Boolean(t.responsable) && !t.liquidadoEl },
  { valor: 'liquidados', etiqueta: 'Liquidados', cumple: (t) => Boolean(t.liquidadoEl) },
]

type Dialogo =
  | { tipo: 'entrega'; talonario: Talonario | null }
  | { tipo: 'liquidar'; talonario: Talonario }
  | { tipo: 'compra' | 'premios' | 'imprimir' | 'borrar' | 'deshacerCompra' }
  | { tipo: 'deshacerLiquidacion'; talonario: Talonario }
const CON_CAMPOS: Dialogo['tipo'][] = ['entrega', 'liquidar', 'compra', 'premios', 'imprimir']

/**
 * La lotería: el sorteo (números, décimos y cómo se reparten en
 * participaciones), sus talonarios y a quién se dieron, y la liquidación de
 * cada uno al devolverlo. La compra de los décimos y lo que se recauda se
 * apuntan solos en Contabilidad.
 */
export default function LoteriaAdminPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const lista = useQuery({ queryKey: CLAVE, queryFn: leerSorteos })
  const idElegido = Number(params.get('sorteo')) || lista.data?.[0]?.id || null
  const detalle = useQuery({ queryKey: [...CLAVE, idElegido], queryFn: () => leerSorteo(idElegido!), enabled: idElegido !== null })
  const s = detalle.data

  const [editando, setEditando] = useState<{ id: number | null; form: Formulario; original: Formulario } | null>(null)
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [nuevos, setNuevos] = useState('')
  const [aviso, setAviso] = useState<{ tono: 'success' | 'error'; texto: string } | null>(null)

  /** Toda operación devuelve el sorteo entero: se pinta tal cual y se refresca la lista. */
  const alDia = (r: SorteoConTalonarios) => {
    queryClient.setQueryData([...CLAVE, r.id], r)
    void queryClient.invalidateQueries({ queryKey: CLAVE, exact: true })
  }
  const operacion = useMutation({
    mutationFn: (hacer: () => Promise<SorteoConTalonarios | void>) => hacer(),
    onSuccess: (r) => { if (r) alDia(r); setDialogo(null) },
    // En un diálogo con campos, el error sale dentro, junto a lo escrito; las
    // confirmaciones no tienen dónde: se cierran y el error sale arriba.
    onError: (e) => {
      if (dialogo && CON_CAMPOS.includes(dialogo.tipo)) return
      setDialogo(null)
      setAviso({ tono: 'error', texto: mensaje(e, 'No se ha podido hacer.') })
    },
  })
  const hacer = (fn: () => Promise<SorteoConTalonarios | void>) => { setAviso(null); operacion.reset(); operacion.mutate(fn) }
  const errorDialogo = dialogo && operacion.isError ? mensaje(operacion.error, 'No se ha podido hacer.') : null
  const cerrar = () => { setDialogo(null); operacion.reset() }
  const base = { error: errorDialogo, ocupado: operacion.isPending, onCerrar: cerrar }

  const guardar = useMutation({
    mutationFn: (d: DatosSorteo) => (editando?.id ? guardarSorteo(editando.id, d) : crearSorteo(d)),
    onSuccess: (r) => { alDia(r); setEditando(null); setParams({ sorteo: String(r.id) }); setAviso({ tono: 'success', texto: 'Sorteo guardado.' }) },
  })

  const imprimir = async (desde: number, hasta: number) => {
    // La pestaña se abre ya, en el clic: el navegador bloquea las que nacen después de esperar.
    const ventana = window.open('', '_blank')
    try {
      const archivo = await pdfDeParticipaciones(s!.id, desde, hasta)
      if (ventana) ventana.location.href = URL.createObjectURL(archivo.blob)
    } catch (e) {
      ventana?.close()
      throw e
    }
  }

  const datosForm = editando ? aDatos(editando.form) : null
  const cabenEnForm = datosForm ? Math.floor((datosForm.numeros.length * datosForm.decimos * datosForm.precioDecimo + 1e-9) / datosForm.jugado) : null
  const f = editando?.form
  const campo = (clave: keyof Formulario) => ({
    value: f?.[clave] ?? '',
    onChange: (e: { target: { value: string } }) => editando && setEditando({ ...editando, form: { ...editando.form, [clave]: e.target.value } }),
  })
  const conTalonarios = Boolean(editando?.id && s && s.talonarios > 0)
  const conCompra = Boolean(editando?.id && s?.compra)

  const talonarios = s ? s.lista.filter(FILTROS.find((x) => x.valor === filtro)!.cumple) : []
  const caben = s ? Math.floor(s.maximoDeParticipaciones / s.porTalonario) - s.talonarios : 0
  const ultimo = s?.lista.at(-1)
  const premiado = s ? s.numeros.some((n) => n.premio) : false

  return (
    <>
      <Helmet><title>{`Lotería | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Lotería" subtitulo="Los décimos, los talonarios de participaciones y a quién se dieron. La compra y lo vendido se apuntan solos en Contabilidad.">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { guardar.reset(); setEditando({ id: null, form: EN_BLANCO, original: EN_BLANCO }) }}>Nuevo sorteo</Button>
      </CabeceraSeccion>
      {aviso && <Alert severity={aviso.tono} sx={{ mb: 2 }} onClose={() => setAviso(null)}>{aviso.texto}</Alert>}

      {lista.isPending && <CircularProgress aria-label="Cargando los sorteos" />}
      {lista.isError && <Alert severity="error">{mensaje(lista.error, 'No se han podido cargar los sorteos.')}</Alert>}
      {lista.data?.length === 0 && <Alert severity="info">Todavía no hay ningún sorteo. Créalo con «Nuevo sorteo»: los números, los décimos y cómo se reparten.</Alert>}

      {lista.data && lista.data.length > 1 && (
        <TextField select size="small" label="Sorteo" value={idElegido ?? ''} onChange={(e) => setParams({ sorteo: e.target.value })} sx={{ mb: 2, minWidth: 280 }}>
          {lista.data.map((x) => <MenuItem key={x.id} value={x.id}>{x.nombre}</MenuItem>)}
        </TextField>
      )}

      {idElegido !== null && !s && detalle.isPending && <CircularProgress aria-label="Cargando el sorteo" />}
      {s && (
        <Stack spacing={2.5}>
          <Paper component="section" aria-label={s.nombre} sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-start' } }}>
              <Box>
                <Typography variant="h6" component="h2">{s.nombre}</Typography>
                <Typography color="text.secondary">Sorteo del {fechaCorta(s.fecha)} · {plural(s.decimos, 'décimo', 'décimos')} de {euros(s.precioDecimo)} de cada número</Typography>
                <Typography sx={{ fontFamily: 'serif', fontSize: 30, letterSpacing: '0.08em', mt: 1 }}>{s.numeros.map((n) => n.numero).join('  ·  ')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Participación de {euros(s.precioParticipacion)}: juega {euros(s.jugado)}{s.precioParticipacion > s.jugado ? ` y ${euros(s.precioParticipacion - s.jugado)} de donativo` : ''} · {s.porTalonario} por talonario
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <Button size="small" variant="outlined" onClick={() => { guardar.reset(); setEditando({ id: s.id, form: aFormulario(s), original: aFormulario(s) }) }}>Editar</Button>
                <Button size="small" variant="outlined" onClick={() => setDialogo({ tipo: 'premios' })}>Premios</Button>
                <Button size="small" variant="outlined" disabled={s.talonarios === 0} onClick={() => setDialogo({ tipo: 'imprimir' })}>Imprimir participaciones</Button>
              </Stack>
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mt: 2.5 }}>
              <Cifra titulo="Talonarios" valor={String(s.talonarios)} detalle={`caben ${Math.floor(s.maximoDeParticipaciones / s.porTalonario)} con los décimos`} />
              <Cifra titulo="En la calle" valor={String(s.entregados)} detalle="dados y sin liquidar" />
              <Cifra titulo="Vendidas" valor={String(s.vendidas)} detalle={`${plural(s.liquidados, 'talonario liquidado', 'talonarios liquidados')}`} />
              <Cifra titulo="Recaudado" valor={euros(s.recaudado)} detalle="apuntado en Contabilidad" />
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5, alignItems: { sm: 'center' } }}>
              {s.compra
                ? <>
                    <Typography variant="body2">Compra de los décimos: <strong>{euros(s.compra.importe)}</strong>, apuntada el {fechaCorta(s.compra.fecha)} ({etiquetaMetodo(s.compra.metodoPago)}).</Typography>
                    <Button size="small" onClick={() => setDialogo({ tipo: 'deshacerCompra' })}>Deshacer</Button>
                  </>
                : <>
                    <Typography variant="body2" color="text.secondary">La compra de los décimos ({euros(s.numeros.length * s.decimos * s.precioDecimo)}) todavía no está apuntada.</Typography>
                    <Button size="small" variant="outlined" onClick={() => setDialogo({ tipo: 'compra' })}>Apuntar la compra</Button>
                  </>}
            </Stack>
            {premiado && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Ha tocado: cada participación cobra {euros(s.premioPorParticipacion)}. Las {s.vendidas} vendidas suman {euros(s.premiosVendidos)}.
              </Alert>
            )}
          </Paper>

          <Paper component="section" aria-label="Talonarios" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' }, mb: 2 }}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {FILTROS.map((x) => (
                  <Chip key={x.valor} label={`${x.etiqueta} (${s.lista.filter(x.cumple).length})`} color={filtro === x.valor ? 'primary' : 'default'}
                    variant={filtro === x.valor ? 'filled' : 'outlined'} onClick={() => setFiltro(x.valor)} />
                ))}
              </Stack>
              <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'flex-start', flexWrap: 'wrap', '& .MuiButton-root': { whiteSpace: 'nowrap', mt: 0.25 } }}>
                <TextField size="small" label="Cuántos" value={nuevos} onChange={(e) => setNuevos(e.target.value)} sx={{ width: 130 }}
                  helperText={caben > 0 ? `Caben ${caben} más` : 'No caben más'} slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
                <Button variant="outlined" disabled={!/^\d+$/.test(nuevos) || Number(nuevos) < 1 || Number(nuevos) > caben || operacion.isPending}
                  onClick={() => hacer(async () => { const r = await crearTalonarios(s.id, Number(nuevos)); setNuevos(''); return r })}>Añadir talonarios</Button>
                <Button variant="outlined" disabled={s.talonarios === 0} onClick={() => setDialogo({ tipo: 'entrega', talonario: null })}>Dar varios</Button>
              </Stack>
            </Stack>

            {s.talonarios === 0
              ? <Alert severity="info">Sin talonarios todavía. Con estos décimos caben {Math.floor(s.maximoDeParticipaciones / s.porTalonario)} de {s.porTalonario} participaciones.</Alert>
              : talonarios.length === 0
              ? <Typography color="text.secondary">Ninguno aquí.</Typography>
              : (
                <Box component="ul" aria-label="Lista de talonarios" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                  {talonarios.map((t, i) => (
                    <Box component="li" key={t.id} sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', py: 1.25, borderTop: i === 0 ? 'none' : '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }}>Talonario n.º {t.numero} <Typography component="span" variant="body2" color="text.secondary">· participaciones {t.desde}–{t.hasta}</Typography></Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t.liquidadoEl
                            ? `Liquidado el ${fechaCorta(t.liquidadoEl)}: ${t.vendidas} vendidas, ${euros(t.importe ?? 0)}${t.metodoPago ? ` (${etiquetaMetodo(t.metodoPago)})` : ''}${t.responsable ? ` · ${t.responsable}` : ''}`
                            : t.responsable
                            ? `${t.responsable}${t.telefono ? ` · ${t.telefono}` : ''} · desde el ${fechaCorta(t.entregadoEl!)}`
                            : 'En Secretaría'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        {t.liquidadoEl
                          ? <Button size="small" onClick={() => setDialogo({ tipo: 'deshacerLiquidacion', talonario: t })}>Deshacer</Button>
                          : <>
                              <Button size="small" onClick={() => setDialogo({ tipo: 'entrega', talonario: t })}>{t.responsable ? 'Cambiar' : 'Dar'}</Button>
                              <Button size="small" variant="outlined" onClick={() => setDialogo({ tipo: 'liquidar', talonario: t })}>Liquidar</Button>
                              {t.id === ultimo?.id && !t.responsable && <Button size="small" color="error" onClick={() => hacer(() => quitarTalonario(t.id))}>Quitar</Button>}
                            </>}
                      </Stack>
                    </Box>
                  ))}
                </Box>
              )}
          </Paper>

          {s.compra === null && s.talonarios === 0 && (
            <Button color="error" sx={{ alignSelf: 'flex-start' }} onClick={() => setDialogo({ tipo: 'borrar' })}>Borrar este sorteo</Button>
          )}
        </Stack>
      )}

      <VentanaFormulario
        abierto={editando !== null}
        titulo={editando?.id ? 'Editar el sorteo' : 'Nuevo sorteo'}
        sucio={Boolean(editando && JSON.stringify(editando.form) !== JSON.stringify(editando.original))}
        guardando={guardar.isPending}
        puedeGuardar={datosForm !== null}
        error={guardar.isError ? mensaje(guardar.error, 'No se ha podido guardar.') : null}
        onGuardar={() => { if (datosForm) guardar.mutate(datosForm) }}
        onCerrar={() => setEditando(null)}
      >
        {f && <>
          {conTalonarios && <Alert severity="info">Ya hay talonarios: los números, los precios y cuántas lleva cada talonario no se pueden cambiar.</Alert>}
          {!conTalonarios && conCompra && <Alert severity="info">La compra está apuntada: para cambiar los números o los décimos, deshazla antes.</Alert>}
          <TextField label="Nombre" {...campo('nombre')} slotProps={{ htmlInput: { maxLength: 120 } }} fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Fecha del sorteo" type="date" {...campo('fecha')} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
            <TextField label="Números" {...campo('numeros')} disabled={conTalonarios || conCompra} helperText="De cinco cifras; varios, separados por comas." fullWidth />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Precio del décimo (€)" {...campo('precioDecimo')} disabled={conCompra} slotProps={{ htmlInput: { inputMode: 'decimal' } }} fullWidth />
            <TextField label="Décimos de cada número" {...campo('decimos')} disabled={conCompra} slotProps={{ htmlInput: { inputMode: 'numeric' } }} fullWidth />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Precio de la participación (€)" {...campo('precioParticipacion')} disabled={conTalonarios} slotProps={{ htmlInput: { inputMode: 'decimal' } }} fullWidth />
            <TextField label="Juega (€)" {...campo('jugado')} disabled={conTalonarios} helperText="El resto es donativo." slotProps={{ htmlInput: { inputMode: 'decimal' } }} fullWidth />
            <TextField label="Por talonario" {...campo('porTalonario')} disabled={conTalonarios} slotProps={{ htmlInput: { inputMode: 'numeric' } }} fullWidth />
          </Stack>
          {cabenEnForm !== null && datosForm && (
            <Typography variant="body2" color="text.secondary">
              Con esos décimos caben {plural(cabenEnForm, 'participación', 'participaciones')}: {plural(Math.floor(cabenEnForm / datosForm.porTalonario), 'talonario', 'talonarios')} de {datosForm.porTalonario}.
            </Typography>
          )}
          <TextField label="Texto legal de la participación (opcional)" {...campo('leyenda')} multiline minRows={3} slotProps={{ htmlInput: { maxLength: 1000 } }}
            helperText="Vacío: dónde quedan depositados los décimos, que se cobra en Secretaría, la caducidad a los tres meses y las retenciones." fullWidth />
        </>}
      </VentanaFormulario>

      {s && dialogo?.tipo === 'entrega' && (
        <DialogoEntrega key={dialogo.talonario?.id ?? 'varios'} abierto talonario={dialogo.talonario} total={ultimo?.numero ?? 0} {...base}
          onEntregar={(e) => hacer(() => entregarTalonarios(s.id, e))} />
      )}
      {s && dialogo?.tipo === 'liquidar' && (
        <DialogoLiquidacion key={dialogo.talonario.id} abierto talonario={dialogo.talonario} sorteo={s} {...base}
          onLiquidar={(vendidas, metodo) => hacer(() => liquidarTalonario(dialogo.talonario.id, vendidas, metodo))} />
      )}
      {s && dialogo?.tipo === 'compra' && <DialogoCompra abierto sorteo={s} {...base} onApuntar={(m) => hacer(() => apuntarCompra(s.id, m))} />}
      {s && dialogo?.tipo === 'premios' && <DialogoPremios abierto sorteo={s} {...base} onGuardar={(p) => hacer(() => guardarPremios(s.id, p))} />}
      {s && dialogo?.tipo === 'imprimir' && <DialogoImprimir abierto sorteo={s} {...base} onImprimir={(d, h) => hacer(() => imprimir(d, h))} />}
      <DialogoConfirmacion abierto={dialogo?.tipo === 'deshacerCompra'} titulo="¿Deshacer la compra?" peligro textoConfirmar="Deshacer"
        mensaje="Se borra el gasto de los décimos en Contabilidad. Hazlo solo si se apuntó mal."
        onConfirmar={() => s && hacer(() => deshacerCompra(s.id))} onCancelar={cerrar} />
      <DialogoConfirmacion abierto={dialogo?.tipo === 'deshacerLiquidacion'} titulo="¿Deshacer la liquidación?" peligro textoConfirmar="Deshacer"
        mensaje={dialogo?.tipo === 'deshacerLiquidacion' ? `El talonario n.º ${dialogo.talonario.numero} vuelve a estar sin liquidar y su ingreso se borra de Contabilidad.` : ''}
        onConfirmar={() => dialogo?.tipo === 'deshacerLiquidacion' && hacer(() => deshacerLiquidacion(dialogo.talonario.id))} onCancelar={cerrar} />
      <DialogoConfirmacion abierto={dialogo?.tipo === 'borrar'} titulo="¿Borrar el sorteo?" peligro textoConfirmar="Borrar"
        mensaje={s ? `«${s.nombre}» desaparece. No tiene talonarios ni la compra apuntada.` : ''}
        onConfirmar={() => s && hacer(async () => { await borrarSorteo(s.id); setParams({}); void queryClient.invalidateQueries({ queryKey: CLAVE }) })} onCancelar={cerrar} />
    </>
  )
}

function Cifra({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>{titulo}</Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
      <Typography variant="body2" color="text.secondary">{detalle}</Typography>
    </Box>
  )
}
