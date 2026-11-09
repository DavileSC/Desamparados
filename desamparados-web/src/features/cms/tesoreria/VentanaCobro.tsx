import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Autocomplete, Box, Checkbox, CircularProgress, FormControlLabel, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import VentanaFormulario from '../VentanaFormulario'
import { hoy } from '../../../lib/fechas'
import {
  buscarHermanosConRecibo, cobrarRecibos, recibosDelCms,
  type AdminReceipt, type MetodoEnMano, type ReceiptBrother,
} from '../../../lib/api/tesoreria'
import { euros } from '../contabilidad/formato'

const METODOS: { valor: MetodoEnMano; etiqueta: string }[] = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'BIZUM', etiqueta: 'Bizum' },
  { valor: 'TARJETA', etiqueta: 'Tarjeta' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
]

const nombreHermano = (h: ReceiptBrother) => `${h.apellidos}, ${h.nombre}${h.numeroHermano !== null ? ` · n.º ${h.numeroHermano}` : ''}`

interface Props {
  abierto: boolean
  /**
   * Los recibos elegidos en el listado. Vacío, la ventana empieza buscando al
   * hermano y trae todo lo que tiene pendiente, de cualquier año: es lo que
   * se hace cuando alguien viene a pagar.
   */
  recibos: AdminReceipt[]
  onCerrar: () => void
  /** Cobrado: el mensaje del servidor, para enseñarlo en la pantalla. */
  onCobrado: (mensaje: string) => void
}

/**
 * «Registrar cobro»: uno o varios recibos, de uno o varios hermanos, con la
 * forma de pago, el día en que entró el dinero y una nota. El servidor los
 * cobra todos o ninguno, cada uno con su apunte en Contabilidad. Lo remesado
 * no entra: lo cobra el banco y se confirma desde su remesa.
 */
export default function VentanaCobro({ abierto, recibos, onCerrar, onCobrado }: Props) {
  const [lista, setLista] = useState<AdminReceipt[]>([])
  const [elegidos, setElegidos] = useState<Set<number>>(new Set())
  const [metodo, setMetodo] = useState<MetodoEnMano>('EFECTIVO')
  const [dia, setDia] = useState(hoy)
  const [nota, setNota] = useState('')
  const [hermano, setHermano] = useState<ReceiptBrother | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [candidatos, setCandidatos] = useState<ReceiptBrother[]>([])
  const [buscando, setBuscando] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const buscandoHermano = recibos.length === 0

  // Cada vez que se abre, de cero: con lo elegido en el listado, todo marcado.
  const [abiertoAntes, setAbiertoAntes] = useState(false)
  if (abierto !== abiertoAntes) {
    setAbiertoAntes(abierto)
    if (abierto) {
      const cobrables = recibos.filter((r) => r.estado === 'PENDIENTE')
      setLista(cobrables); setElegidos(new Set(cobrables.map((r) => r.id)))
      setMetodo('EFECTIVO'); setDia(hoy()); setNota(''); setHermano(null); setBusqueda(''); setCandidatos([]); setError(null)
    }
  }

  // El buscador: espera a que se deje de teclear y descarta lo que llegue tarde.
  const texto = busqueda.trim()
  useEffect(() => {
    if (!abierto || !buscandoHermano || hermano || texto.length < 2) return
    let vigente = true
    const espera = setTimeout(() => {
      setBuscando(true)
      buscarHermanosConRecibo(texto)
        .then((encontrados) => { if (vigente) setCandidatos(encontrados) })
        .catch(() => { if (vigente) setCandidatos([]) })
        .finally(() => { if (vigente) setBuscando(false) })
    }, 300)
    return () => { vigente = false; clearTimeout(espera) }
  }, [abierto, buscandoHermano, hermano, texto])

  // Elegido el hermano, todo lo que tiene pendiente, de cualquier año. Solo
  // vale la respuesta del último elegido: cambiar rápido de hermano no mezcla.
  const ultimoPedido = useRef(0)
  const elegirHermano = (elegido: ReceiptBrother | null) => {
    setHermano(elegido); setLista([]); setElegidos(new Set()); setError(null)
    const pedido = ++ultimoPedido.current
    if (!elegido) { setCargando(false); return }
    setCargando(true)
    recibosDelCms(undefined, { pagina: 1, porPagina: 100 }, { hermano: String(elegido.id), estado: 'PENDIENTE', orden: 'antiguos' })
      .then((r) => { if (pedido === ultimoPedido.current) { setLista(r.data); setElegidos(new Set(r.data.map((x) => x.id))) } })
      .catch((e: unknown) => { if (pedido === ultimoPedido.current) setError(e instanceof Error ? e.message : 'No se han podido cargar sus recibos.') })
      .finally(() => { if (pedido === ultimoPedido.current) setCargando(false) })
  }

  // Por hermano, en el orden en que llegan: así se lee como un recibo de caja.
  const grupos = useMemo(() => {
    const porHermano = new Map<number, { hermano: ReceiptBrother; recibos: AdminReceipt[] }>()
    for (const r of lista) {
      const g = porHermano.get(r.hermano.id) ?? { hermano: r.hermano, recibos: [] }
      g.recibos.push(r); porHermano.set(r.hermano.id, g)
    }
    return [...porHermano.values()]
  }, [lista])

  const marcados = lista.filter((r) => elegidos.has(r.id))
  const total = marcados.reduce((s, r) => s + Number(r.importe), 0)
  const diaValido = /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia <= hoy()
  const alternar = (id: number) => setElegidos((antes) => {
    const nuevos = new Set(antes)
    if (nuevos.has(id)) nuevos.delete(id); else nuevos.add(id)
    return nuevos
  })

  const cobrar = async () => {
    setGuardando(true); setError(null)
    try {
      const r = await cobrarRecibos({
        ids: marcados.map((x) => x.id), metodoPago: metodo,
        ...(dia !== hoy() ? { fecha: dia } : {}),
        ...(nota.trim() ? { nota: nota.trim() } : {}),
      })
      onCobrado(r.message)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido registrar el cobro.')
    } finally {
      setGuardando(false)
    }
  }

  const textoGuardar = marcados.length === 0 ? 'Registrar cobro'
    : `Registrar ${marcados.length === 1 ? 'el cobro' : `${marcados.length} cobros`} · ${euros(total)}`

  return (
    <VentanaFormulario
      abierto={abierto}
      titulo="Registrar cobro"
      textoGuardar={textoGuardar}
      sucio={Boolean(nota.trim()) || (buscandoHermano && hermano !== null)}
      guardando={guardando}
      puedeGuardar={marcados.length > 0 && diaValido}
      error={error}
      ancho="md"
      onGuardar={cobrar}
      onCerrar={onCerrar}
    >
      {buscandoHermano && (
        <Autocomplete
          options={texto.length >= 2 ? candidatos : []}
          value={hermano}
          onChange={(_, elegido) => elegirHermano(elegido)}
          inputValue={busqueda}
          onInputChange={(_, valor) => setBusqueda(valor)}
          filterOptions={(opciones) => opciones}
          getOptionLabel={nombreHermano}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          loading={buscando}
          loadingText="Buscando…"
          noOptionsText={texto.length < 2 ? 'Escribe al menos dos letras del nombre, los apellidos o el número' : 'Ningún hermano activo coincide'}
          renderInput={(params) => <TextField {...params} label="¿Quién paga?" autoFocus />}
        />
      )}

      {cargando && <CircularProgress size={24} aria-label="Cargando sus recibos" />}
      {buscandoHermano && hermano && !cargando && lista.length === 0 && (
        <Alert severity="info">No tiene nada pendiente de cobro. Lo remesado lo cobra el banco, y un devuelto se reemite antes de cobrarlo.</Alert>
      )}
      {!buscandoHermano && lista.length < recibos.length && (
        <Alert severity="info">
          {recibos.length - lista.length === 1 ? 'Uno de los elegidos no está pendiente y se deja fuera' : `${recibos.length - lista.length} de los elegidos no están pendientes y se dejan fuera`}: lo remesado se confirma desde su remesa y lo devuelto se reemite.
        </Alert>
      )}

      {grupos.length > 0 && (
        <Box role="group" aria-label="Recibos que se cobran" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, px: 2, maxHeight: 340, overflowY: 'auto' }}>
          {grupos.map((g) => {
            const suma = g.recibos.filter((r) => elegidos.has(r.id)).reduce((s, r) => s + Number(r.importe), 0)
            return (
              <Box key={g.hermano.id} sx={{ py: 1.25, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14.5 }}>
                    {g.hermano.nombre} {g.hermano.apellidos}
                    {g.hermano.numeroHermano !== null && <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}> · n.º {g.hermano.numeroHermano}</Box>}
                  </Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: 14.5, fontVariantNumeric: 'tabular-nums' }}>{euros(suma)}</Typography>
                </Box>
                {g.recibos.map((r) => (
                  <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <FormControlLabel
                      control={<Checkbox size="small" checked={elegidos.has(r.id)} onChange={() => alternar(r.id)} />}
                      label={<Typography sx={{ fontSize: 14 }}>{r.concepto}{!/\b\d{4}\b/.test(r.concepto) && ` (${r.year})`}</Typography>}
                      sx={{ mr: 0 }}
                    />
                    <Typography sx={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: elegidos.has(r.id) ? 'text.primary' : 'text.disabled' }}>{euros(Number(r.importe))}</Typography>
                  </Box>
                ))}
              </Box>
            )
          })}
        </Box>
      )}

      <Box>
        <Typography component="span" id="forma-de-pago" sx={{ display: 'block', fontSize: 13, color: 'text.secondary', mb: 0.75 }}>Forma de pago</Typography>
        <ToggleButtonGroup exclusive value={metodo} onChange={(_, valor: MetodoEnMano | null) => { if (valor) setMetodo(valor) }} aria-labelledby="forma-de-pago" fullWidth
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontSize: 14, height: 44 } }}>
          {METODOS.map((m) => <ToggleButton key={m.valor} value={m.valor}>{m.etiqueta}</ToggleButton>)}
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '200px minmax(0, 1fr)' } }}>
        <TextField
          type="date"
          label="Día del cobro"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy() } }}
          error={!diaValido}
          helperText={diaValido ? undefined : 'Hoy, o un día que ya haya pasado.'}
        />
        <TextField
          label="Nota (opcional)"
          value={nota}
          onChange={(e) => setNota(e.target.value.replace(/[<>]/g, ''))}
          placeholder="Por ejemplo, en la mesa de reparto"
          slotProps={{ htmlInput: { maxLength: 300 } }}
        />
      </Box>
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
        Cada recibo queda cobrado con su apunte en Contabilidad, el día que pongas aquí. Si alguno ya no se puede cobrar, no se cobra ninguno y se dice cuál.
      </Typography>
    </VentanaFormulario>
  )
}
