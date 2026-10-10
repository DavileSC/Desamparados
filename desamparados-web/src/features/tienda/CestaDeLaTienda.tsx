import { useRef, useState } from 'react'
import { Alert, Box, ButtonBase, Link as EnlaceMui, Paper, TextField, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import Boton from '../../components/Boton'
import type { MetodoEnLinea } from '../../lib/api/tienda'
import { GOLD, PAPEL } from '../inicio/estilos'
import { Contador } from './ElegirTalla'
import { euros, nombreConTalla, quedanDe, topeDe, type LineaDeLaCesta } from './cesta'
import { esTelefonoValido, normalizarTelefono } from '../../lib/validacion/identidad'

export interface Comprador { nombre: string; email: string; telefono: string; metodo: MetodoEnLinea }

const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.trim())

type Campo = 'nombre' | 'email' | 'telefono'

/** Qué falla en cada dato del comprador, o `null`. */
function fallosDe(c: Comprador): Record<Campo, string | null> {
  return {
    nombre: c.nombre.trim() === '' ? 'Escribe tu nombre.' : null,
    email: c.email.trim() === '' ? 'Escribe tu correo.' : !correoValido(c.email) ? 'Revisa el correo: tiene que ser como nombre@dominio.es.' : null,
    telefono: c.telefono.trim() === '' ? 'Escribe tu teléfono.' : !esTelefonoValido(c.telefono) ? 'Un teléfono de nueve cifras.' : null,
  }
}

/**
 * La cesta, en el cajón de la tienda, en dos pasos: lo que llevas (con «− n +»
 * en cada línea) y, al seguir, tus datos y cómo pagas. Partirlo deja la
 * cesta corta mientras se elige, que es lo que más rato se mira.
 */
export default function CestaDeLaTienda({ lineas, metodos, enviando, error, onCambiar, onPagar }: {
  lineas: LineaDeLaCesta[]
  metodos: MetodoEnLinea[]
  enviando: boolean
  error: string | null
  onCambiar: (clave: string, cantidad: number) => void
  onPagar: (comprador: Comprador) => void
}) {
  const [paso, setPaso] = useState<'cesta' | 'datos'>('cesta')
  const [comprador, setComprador] = useState<Comprador>({ nombre: '', email: '', telefono: '', metodo: metodos[0] ?? 'TARJETA' })
  const total = lineas.reduce((s, l) => s + l.producto.precio * l.cantidad, 0)
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)
  /*
   * «Pagar» no se queda en gris sin decir por qué: al pulsarlo, si falta algo,
   * se marca cada campo con lo que le pasa y el foco va al primero.
   */
  const [intentado, setIntentado] = useState(false)
  const fallos = fallosDe(comprador)
  const refs = { nombre: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null), telefono: useRef<HTMLInputElement>(null) }
  const fallo = (campo: Campo) => (intentado ? fallos[campo] : null)
  const pagar = () => {
    const primero = (['nombre', 'email', 'telefono'] as const).find((c) => fallos[c])
    if (primero) {
      setIntentado(true)
      refs[primero].current?.focus()
      return
    }
    // El servidor guarda nueve dígitos pelados: «+34 600 12 34 56» también vale.
    onPagar({ ...comprador, email: comprador.email.trim(), telefono: normalizarTelefono(comprador.telefono) })
  }
  // Si se vacía la cesta estando en los datos, se vuelve a la cesta.
  const enDatos = paso === 'datos' && lineas.length > 0

  return (
    <Paper component="aside" aria-label="Tu cesta" elevation={0} sx={{ px: 3, pb: 3, display: 'grid', gap: 2, bgcolor: 'transparent', backgroundImage: 'none' }}>
      <Box sx={{ display: 'flex', gap: 1, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }} aria-hidden="true">
        <Box component="span" sx={{ color: enDatos ? undefined : GOLD }}>1 · Cesta</Box>
        <span>›</span>
        <Box component="span" sx={{ color: enDatos ? GOLD : undefined }}>2 · Tus datos y pago</Box>
      </Box>

      {!enDatos ? <>
        <Typography component="h2" sx={{ fontSize: 20, fontWeight: 600 }}>Tu cesta</Typography>
        {lineas.length === 0
          ? <Typography variant="body2" color="text.secondary">Todavía está vacía. Pulsa «Añadir» en lo que quieras llevarte.</Typography>
          : <>
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1.5 }}>
              {lineas.map((l) => (
                <Box component="li" key={l.clave} sx={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr) auto', gap: 1.5, alignItems: 'center' }}>
                  <Box sx={{ width: 48, height: 48, bgcolor: PAPEL, borderRadius: '3px', overflow: 'hidden' }}>
                    {l.producto.foto && <Box component="img" src={l.producto.foto} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 0.5, boxSizing: 'border-box', mixBlendMode: 'multiply' }} />}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{l.producto.nombre}</Typography>
                    <Typography variant="body2" color="text.secondary">{l.talla ? `Talla ${l.talla.nombre} · ` : ''}{euros(l.producto.precio)}</Typography>
                    <Box sx={{ ml: -1 }}>
                      <Contador cantidad={l.cantidad} tope={topeDe(quedanDe(l.producto, l.talla))} nombre={nombreConTalla(l.producto.nombre, l.talla?.nombre)} onCambiar={(n) => onCambiar(l.clave, n)} />
                    </Box>
                  </Box>
                  <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>{euros(l.producto.precio * l.cantidad)}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 18 }}>Total</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 18 }}>{euros(total)}</Typography>
            </Box>
            <Boton onClick={() => setPaso('datos')} fullWidth>Seguir con el pago</Boton>
          </>}
      </> : <>
        <Typography component="h2" sx={{ fontSize: 20, fontWeight: 600 }}>Tus datos</Typography>
        <TextField label="Nombre y apellidos" value={comprador.nombre} onChange={(e) => setComprador({ ...comprador, nombre: e.target.value })} fullWidth inputRef={refs.nombre}
          error={!!fallo('nombre')} helperText={fallo('nombre')} slotProps={{ htmlInput: { maxLength: 120, autoComplete: 'name' } }} />
        <TextField label="Correo" type="email" value={comprador.email} onChange={(e) => setComprador({ ...comprador, email: e.target.value })} fullWidth inputRef={refs.email}
          error={!!fallo('email')} helperText={fallo('email') ?? 'Te mandamos ahí la confirmación.'} slotProps={{ htmlInput: { autoComplete: 'email' } }} />
        <TextField label="Teléfono" type="tel" value={comprador.telefono} onChange={(e) => setComprador({ ...comprador, telefono: e.target.value })} fullWidth inputRef={refs.telefono}
          error={!!fallo('telefono')} helperText={fallo('telefono')} slotProps={{ htmlInput: { autoComplete: 'tel' } }} />
        {metodos.length > 1 && (
          <Box role="group" aria-label="Pagar con" sx={{ display: 'grid', gridTemplateColumns: `repeat(${metodos.length}, minmax(0, 1fr))`, gap: 1 }}>
            {metodos.map((m) => {
              const sel = comprador.metodo === m
              return (
                <ButtonBase key={m} aria-pressed={sel} onClick={() => setComprador({ ...comprador, metodo: m })}
                  sx={{ height: 46, borderRadius: '6px', fontFamily: 'inherit', fontWeight: 600, fontSize: 15, border: '1px solid', borderColor: sel ? PAPEL : 'rgba(204, 196, 201, 0.3)', bgcolor: sel ? 'rgba(244, 239, 229, 0.1)' : 'transparent', '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 } }}>
                  {m === 'BIZUM' ? 'Bizum' : 'Tarjeta'}
                </ButtonBase>
              )
            })}
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
          <Typography sx={{ fontWeight: 600 }}>{unidades} {unidades === 1 ? 'artículo' : 'artículos'}</Typography>
          <Typography sx={{ fontWeight: 600 }}>{euros(total)}</Typography>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        {/* Lo que pide la ley antes de pagar: las condiciones de la compra y, al pedir los datos, para qué se usan. */}
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
          Al pagar aceptas las{' '}
          <EnlaceMui component={Link} to="/condiciones-de-compra" target="_blank" sx={{ color: 'secondary.main' }}>condiciones de compra</EnlaceMui>
          . Tus datos solo se usan para gestionar el pedido; más en la{' '}
          <EnlaceMui component={Link} to="/politica-privacidad" target="_blank" sx={{ color: 'secondary.main' }}>política de privacidad</EnlaceMui>.
        </Typography>
        <Boton onClick={pagar} disabled={enviando} fullWidth>{enviando ? 'Un momento…' : `Pagar ${euros(total)}`}</Boton>
        <Boton appVariant="claro" onClick={() => setPaso('cesta')} disabled={enviando} fullWidth>Volver a la cesta</Boton>
      </>}
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>Se recoge en Secretaría: no hacemos envíos.</Typography>
    </Paper>
  )
}
