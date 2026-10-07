import { useEffect, useState } from 'react'
import { Alert, Button, ButtonBase, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { asignarPrenda, buscarHermanosDelRopero, type HermanoDelRopero, type Prenda } from '../../lib/api/inventario'
import { ETIQUETA_TIPO } from './ropero'

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto)

/** Años cumplidos a hoy. */
function edad(fechaNacimiento: string) {
  const nacio = new Date(fechaNacimiento)
  const hoy = new Date()
  let anios = hoy.getFullYear() - nacio.getFullYear()
  if (hoy.getMonth() < nacio.getMonth() || (hoy.getMonth() === nacio.getMonth() && hoy.getDate() < nacio.getDate())) anios -= 1
  return anios
}

const nombreCompleto = (h: Pick<HermanoDelRopero, 'nombre' | 'apellidos'>) => `${h.nombre} ${h.apellidos}`

interface DialogoPrestamoProps {
  /** La prenda que se va a prestar; null con el diálogo cerrado. */
  prenda: Prenda | null
  onCerrar: () => void
  onPrestada: (aviso: string) => void
}

/**
 * Prestar una prenda del ropero, buscando al hermano por su nombre y
 * apellidos: el número de hermano no se lo sabe nadie en la albacería, y un
 * dígito de más se la prestaba a otro. Como dos pueden llamarse igual, cada
 * resultado lleva su número, su edad y quién lleva su cuenta, y si coinciden
 * los nombres se avisa. El botón repite el nombre elegido.
 *
 * El padre lo monta con `key` de la prenda: cada préstamo empieza en blanco.
 */
export function DialogoPrestamo({ prenda, onCerrar, onPrestada }: DialogoPrestamoProps) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<HermanoDelRopero[] | null>(null)
  const [elegido, setElegido] = useState<HermanoDelRopero | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Se busca al dejar de escribir; una respuesta que llega tarde no pisa a la de un texto más nuevo.
  useEffect(() => {
    const limpio = texto.trim()
    if (limpio.replace(/\s/g, '').length < 2) { setResultados(null); return }
    let vigente = true
    const espera = window.setTimeout(() => {
      setBuscando(true)
      buscarHermanosDelRopero(limpio)
        .then((r) => { if (vigente) { setResultados(r); setError(null) } })
        .catch((e: unknown) => { if (vigente) setError(mensaje(e, 'No se ha podido buscar.')) })
        .finally(() => { if (vigente) setBuscando(false) })
    }, 300)
    return () => { vigente = false; window.clearTimeout(espera) }
  }, [texto])

  const prestar = async () => {
    if (!prenda || !elegido) return
    setGuardando(true)
    setError(null)
    try {
      await asignarPrenda(prenda.id, elegido.id)
      onPrestada(`Prenda ${prenda.numero} prestada a ${nombreCompleto(elegido)}.`)
    } catch (e: unknown) {
      setError(mensaje(e, 'No se ha podido prestar la prenda.'))
      setGuardando(false)
    }
  }

  const repetidos = new Set(
    (resultados ?? []).map(nombreCompleto).filter((n, i, todos) => todos.indexOf(n) !== i),
  )

  return (
    <Dialog open={prenda !== null} onClose={guardando ? undefined : onCerrar} aria-labelledby="dialogo-prestamo-titulo" fullWidth maxWidth="sm">
      <DialogTitle id="dialogo-prestamo-titulo">
        {prenda ? `Prestar la prenda ${prenda.numero}` : 'Prestar'}
        {prenda && (
          <Typography component="span" sx={{ display: 'block', fontSize: 14, color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
            {ETIQUETA_TIPO[prenda.tipo]}{prenda.talla ? ` · talla ${prenda.talla}` : ''}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <TextField
          label="Nombre y apellidos"
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setElegido(null) }}
          helperText="En cualquier orden, sin importar tildes. Solo salen hermanos de alta."
          autoFocus
          fullWidth
          autoComplete="off"
          sx={{ mt: 1 }}
          slotProps={{ input: { endAdornment: buscando ? <CircularProgress size={18} aria-label="Buscando" /> : undefined } }}
        />
        {resultados?.length === 0 && (
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>Nadie de alta se llama así.</Typography>
        )}
        {resultados && resultados.length > 0 && (
          <Stack role="listbox" aria-label="Hermanos que coinciden" spacing={1} sx={{ mt: 2 }}>
            {resultados.map((h) => {
              const marcado = elegido?.id === h.id
              const datos = [h.numeroHermano ? `N.º ${h.numeroHermano}` : 'Sin número', `${edad(h.fechaNacimiento)} años`, h.puesto].filter(Boolean).join(' · ')
              return (
                <ButtonBase
                  key={h.id}
                  role="option"
                  aria-selected={marcado}
                  onClick={() => setElegido(h)}
                  sx={{
                    display: 'block', textAlign: 'left', width: '100%', borderRadius: 2, px: 2, py: 1.25,
                    border: 2, borderColor: marcado ? 'primary.main' : 'divider',
                    backgroundColor: marcado ? 'action.selected' : 'transparent',
                    '&:hover, &:focus-visible': { backgroundColor: 'action.hover' },
                  }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{nombreCompleto(h)}</Typography>
                  <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>
                    {datos}{h.gestor ? ` · su cuenta la lleva ${h.gestor}` : ''}
                  </Typography>
                  {h.prendas.length > 0 && (
                    <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>
                      Ya tiene: {h.prendas.map((p) => `${ETIQUETA_TIPO[p.tipo].toLowerCase()} ${p.numero}`).join(', ')}
                    </Typography>
                  )}
                  {repetidos.has(nombreCompleto(h)) && (
                    <Typography sx={{ fontSize: 13.5, color: 'warning.main', fontWeight: 600 }}>Hay otro con el mismo nombre: mira la edad y el número.</Typography>
                  )}
                </ButtonBase>
              )
            })}
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button variant="contained" onClick={() => void prestar()} disabled={!elegido || guardando}>
          {elegido ? `Prestar a ${nombreCompleto(elegido)}` : 'Prestar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

interface DialogoDevolucionProps {
  /** La prenda que vuelve; null con el diálogo cerrado. */
  prenda: Prenda | null
  onElegir: (rota: boolean) => void
  onCancelar: () => void
}

/**
 * Registrar la devolución de una prenda: tres salidas claras. Las túnicas se
 * lavan todas, sin excepción, así que la pregunta es solo si vuelve rota
 * (al taller, para arreglarla).
 */
export function DialogoDevolucion({ prenda, onElegir, onCancelar }: DialogoDevolucionProps) {
  const tunica = prenda?.tipo === 'TUNICA'
  return (
    <Dialog open={prenda !== null} onClose={onCancelar} aria-labelledby="dialogo-devolucion-titulo">
      <DialogTitle id="dialogo-devolucion-titulo">{prenda ? `¿Cómo vuelve la prenda ${prenda.numero}?` : 'Devolver'}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {prenda?.hermano ? `La tenía ${prenda.hermano.nombre} ${prenda.hermano.apellidos}. ` : ''}
          {tunica
            ? 'Las túnicas se lavan todas: pasa al lavado. Si vuelve rota, al taller para arreglarla.'
            : 'Si vuelve bien, queda disponible para prestarla otra vez; si vuelve rota, al taller para arreglarla.'}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap' }}>
        <Button onClick={onCancelar}>Cancelar</Button>
        <Button variant="outlined" onClick={() => onElegir(true)}>Está rota: al taller</Button>
        <Button variant="contained" onClick={() => onElegir(false)}>{tunica ? 'Vuelve bien: al lavado' : 'Vuelve bien: disponible'}</Button>
      </DialogActions>
    </Dialog>
  )
}
