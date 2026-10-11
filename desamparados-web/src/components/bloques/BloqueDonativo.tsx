import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, ButtonBase, TextField, Typography } from '@mui/material'
import CATALOGO from '../../../../shared/paginas-publicas.json'
import topes from '../../../../shared/topes-contenido.json'
import Boton from '../Boton'
import CamposCertificado from '../CamposCertificado'
import { SIN_CERTIFICADO, certificadoCompleto, datosFiscalesDe } from '../../lib/certificado'
import { enfocarLoQueFalla } from '../../lib/enfocarLoQueFalla'
import { eurosRedondos } from '../../lib/euros'
import { SERIF } from '../../features/inicio/estilos'
import { anchoMaximo } from './presentacion'
import { irAlBanco, type EstadoDelPago, type MetodoEnLinea } from '../../lib/api/procesion'
import { donar, estadoDelDonativo, metodosDePago } from '../../lib/api/pagos'
import type { BloqueDonativo as Datos } from '../../lib/api/contenido'
import { MARCA, alfa } from '../../theme/marca'

/** El recuadro y el acento: los de la puerta de «Quiero ayudar» en Caridad. */
const RECUADRO = '#1a181b'
const ACENTO = MARCA.principalClaro
const FILETE = 'rgba(255, 255, 255, 0.14)'


/** «12,5» o «12.50» → 12.5; lo que no es un importe con dos decimales como mucho, null. */
function leerImporte(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null
  return Number(limpio)
}

/** La página en la que está el bloque, por su ruta: el servidor lee de ella qué se admite. */
function useSlugDeLaPagina(): string | null {
  const { pathname } = useLocation()
  return CATALOGO.paginas.find((p) => p.ruta === pathname)?.slug ?? null
}

/**
 * Donativo: el visitante elige un importe (o escribe otro), el destino si el
 * Grupo lo pide y, si quiere, su nombre y su correo para recibir las gracias.
 * Paga en la página segura del banco, con tarjeta o Bizum, sin cuenta.
 *
 * El formulario es de código: lo editable es el texto, los importes y los
 * destinos. Sin pago en línea encendido, no se ofrece pagar: se dice.
 */
export default function BloqueDonativo({ bloque }: { bloque: Datos }) {
  const pagina = useSlugDeLaPagina()
  const { data } = useQuery({ queryKey: ['pagos', 'metodos'], queryFn: metodosDePago, staleTime: 5 * 60_000 })
  const pago = data?.pago ?? null
  const [elegido, setElegido] = useState<number | 'otro'>(bloque.importes[1] ?? bloque.importes[0])
  const [otro, setOtro] = useState('')
  const [destino, setDestino] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [certificado, setCertificado] = useState(SIN_CERTIFICADO)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  const importe = elegido === 'otro' ? leerImporte(otro) : elegido
  const fueraDeLimites = importe !== null && (importe < topes.donativoMinimoEuros || importe > topes.donativoMaximoEuros)
  const faltaDestino = bloque.destinos.length > 0 && destino === null
  // El certificado se manda por correo: si lo pide, el correo deja de ser opcional.
  const correoBueno = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const correoMal = email.trim() === '' ? certificado.quiere : !correoBueno
  const listo = importe !== null && !fueraDeLimites && !faltaDestino && pagina !== null && certificadoCompleto(certificado) && !correoMal
  /*
   * Los botones de pagar no se quedan en gris sin decir por qué: al pulsar, si
   * falta algo, se marca en su sitio y el foco va a lo primero.
   */
  const [intentado, setIntentado] = useState(false)
  const formulario = useRef<HTMLElement>(null)
  const importeMal = (otro !== '' || intentado) && (importe === null || fueraDeLimites)

  const enviar = async (metodo: MetodoEnLinea) => {
    if (!listo) {
      flushSync(() => setIntentado(true))
      enfocarLoQueFalla(formulario.current)
      return
    }
    if (importe === null || pagina === null) return
    setEnviando(true); setError(null); setHecho(null)
    try {
      const inicio = await donar({
        pagina, importe, metodo,
        ...(destino && { destino }),
        ...(nombre.trim() && { nombre: nombre.trim() }),
        ...(email.trim() && { email: email.trim() }),
        ...(certificado.quiere && { fiscal: datosFiscalesDe(certificado) }),
      })
      if (inicio.tipo === 'banco') {
        irAlBanco(inicio)
        return
      }
      setHecho(`Gracias: hemos recibido tu donativo de ${eurosRedondos(importe)}.`)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se ha podido empezar el donativo. Inténtalo de nuevo.')
    }
    setEnviando(false)
  }

  const opcion = (activa: boolean) => ({
    px: 2.25, py: 1.25, minHeight: 44, borderRadius: '2px', fontSize: 16, fontWeight: 600,
    border: `1px solid ${activa ? ACENTO : FILETE}`,
    backgroundColor: activa ? alfa(MARCA.principalClaro, 0.14) : 'transparent',
    color: activa ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
    '&:focus-visible': { outline: `2px solid ${ACENTO}`, outlineOffset: 2 },
  })
  const campo = {
    '& .MuiInputBase-root': { color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.04)' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: FILETE },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
    '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.6)' },
    // Lo de arriba pisa el color de error de MUI: lo marcado al intentar pagar va con el acento.
    '& .Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: ACENTO },
    '& .MuiFormHelperText-root.Mui-error': { color: ACENTO },
  }

  return (
    <Box component="section" ref={formulario} aria-label={bloque.titulo || 'Donativo'} sx={{
      maxWidth: anchoMaximo(bloque, '760px'), mx: 'auto', p: { xs: 3.5, md: 5.5 },
      backgroundColor: RECUADRO, color: '#ffffff', borderRadius: '2px', display: 'grid', gap: 3,
    }}>
      <VueltaDelBanco />
      {bloque.texto && <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 19, md: 21 }, lineHeight: 1.5, color: 'rgba(255,255,255,0.9)' }}>{bloque.texto}</Typography>}

      <Box role="group" aria-label="Importe" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
        {bloque.importes.map((n) => (
          <ButtonBase key={n} aria-pressed={elegido === n} onClick={() => setElegido(n)} sx={opcion(elegido === n)}>{eurosRedondos(n)}</ButtonBase>
        ))}
        <ButtonBase aria-pressed={elegido === 'otro'} onClick={() => setElegido('otro')} sx={opcion(elegido === 'otro')}>Otro</ButtonBase>
      </Box>
      {elegido === 'otro' && (
        <TextField
          label="Importe (€)" value={otro} onChange={(e) => setOtro(e.target.value)} inputMode="decimal" autoFocus
          error={importeMal}
          helperText={importeMal ? `Escribe un importe entre ${topes.donativoMinimoEuros} y ${topes.donativoMaximoEuros} €.` : ' '}
          sx={{ ...campo, maxWidth: 220 }}
        />
      )}

      {bloque.destinos.length > 0 && (
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          <Typography id="donativo-destino" sx={{ fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: ACENTO }}>¿A qué lo destinas?</Typography>
          <Box role="group" aria-labelledby="donativo-destino" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
            {bloque.destinos.map((d, i) => (
              <ButtonBase key={d} aria-pressed={destino === d} onClick={() => setDestino(d)} sx={opcion(destino === d)}
                {...(intentado && faltaDestino && i === 0 && { 'data-falta': true, 'aria-describedby': 'donativo-falta-destino' })}>{d}</ButtonBase>
            ))}
          </Box>
          {intentado && faltaDestino && <Typography id="donativo-falta-destino" sx={{ fontSize: 14, color: ACENTO }}>Elige a qué lo destinas.</Typography>}
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label="Tu nombre (opcional)" value={nombre} onChange={(e) => setNombre(e.target.value)} slotProps={{ htmlInput: { maxLength: 120 } }} sx={campo} />
        <TextField label={certificado.quiere ? 'Tu correo' : 'Tu correo (opcional)'} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          error={intentado && correoMal}
          helperText={intentado && correoMal ? (email.trim() === '' ? 'Escribe tu correo para mandarte el certificado.' : 'Revisa el correo: tiene que ser como nombre@dominio.es.')
            : certificado.quiere ? 'Para mandarte el certificado.' : 'Solo para darte las gracias.'} slotProps={{ htmlInput: { maxLength: 254 } }} sx={campo} />
      </Box>

      <CamposCertificado valor={certificado} onChange={setCertificado} sxCampo={campo} marcarVacios={intentado}
        sxCasilla={{ color: 'rgba(255,255,255,0.9)', '& .MuiCheckbox-root': { color: 'rgba(255,255,255,0.7)' }, '& .Mui-checked': { color: `${ACENTO} !important` } }} />

      {/* La primera capa de información que pide el RGPD donde se recogen los datos; el resto, en la política. */}
      <Typography sx={{ fontSize: 13.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.65)' }}>
        Tus datos solo se usan para el donativo y, si pides el certificado, para declararlo a Hacienda (modelo 182). Más en la{' '}
        <Box component={Link} to="/politica-privacidad" target="_blank" sx={{ color: ACENTO }}>política de privacidad</Box>.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}
      {hecho && <Alert severity="success">{hecho}</Alert>}

      {pago ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {pago.metodos.map((m, i) => (
              <Boton key={m} appVariant={i === 0 ? 'primary' : 'claro'} disabled={enviando || pagina === null} onClick={() => void enviar(m)}>
                {enviando ? 'Un momento…' : m === 'BIZUM' ? 'Con Bizum' : `Donar ${importe !== null && !fueraDeLimites ? eurosRedondos(importe) : ''}${pago.metodos.length > 1 ? ' con tarjeta' : ''}`.replace('  ', ' ')}
              </Boton>
            ))}
          </Box>
          <Typography sx={{ fontSize: 13.5, color: 'rgba(255,255,255,0.65)' }}>
            {pago.pruebas
              ? 'El pago en línea está en pruebas: todavía no se cobra de verdad.'
              : 'Se paga en la página segura del banco. No guardamos los datos de tu tarjeta.'}
          </Typography>
        </Box>
      ) : data && (
        <Typography sx={{ fontSize: 14.5, color: 'rgba(255,255,255,0.75)' }}>
          Los donativos en línea todavía no están disponibles. Mientras tanto, puedes hacerlo en Secretaría.
        </Typography>
      )}
    </Box>
  )
}

/** Lo que se dice a la vuelta del banco. */
const TRAS_EL_BANCO: Record<Exclude<EstadoDelPago, 'PENDIENTE'>, { tono: 'success' | 'error' | 'warning'; texto: (importe: string) => string }> = {
  PAGADO: { tono: 'success', texto: (i) => `¡Gracias! Hemos recibido tu donativo de ${i}.` },
  RECHAZADO: { tono: 'error', texto: () => 'El banco no ha hecho el pago y no se te ha cobrado nada. Puedes intentarlo otra vez.' },
  INCIDENCIA: { tono: 'warning', texto: (i) => `El banco ha cobrado ${i}, pero algo no ha cuadrado. Tesorería lo revisará y, si hace falta, te lo devolverá.` },
}

type Aviso = { tono: 'info' | 'success' | 'error' | 'warning'; texto: string }

/**
 * La vuelta de la página del banco (`?donativo=<pedido>`). Como en el pago de
 * recibos, la vuelta no prueba nada: se pregunta al servidor hasta que el
 * aviso del banco llega. Si no se pagó, el banco vuelve con `&resultado=no`.
 */
function VueltaDelBanco() {
  const [params, setParams] = useSearchParams()
  const pedido = params.get('donativo')
  const fallido = params.get('resultado') === 'no'
  // Solo se guarda la respuesta final, con el pedido al que contesta; el fallo
  // y el «Comprobando…» se deducen de la dirección al pintar.
  const [final, setFinal] = useState<{ pedido: string; aviso: Aviso } | null>(null)
  const aviso: Aviso | null = !pedido ? null
    : fallido ? { tono: 'error', texto: 'El donativo no se ha completado y no se te ha cobrado nada. Puedes intentarlo otra vez.' }
      : final?.pedido === pedido ? final.aviso : { tono: 'info', texto: 'Comprobando el donativo con el banco…' }

  useEffect(() => {
    if (!pedido || fallido) return
    let cancelado = false
    let intento = 0
    const setAviso = (nuevo: Aviso) => setFinal({ pedido, aviso: nuevo })
    const preguntar = async () => {
      try {
        const { estado, importe } = await estadoDelDonativo(pedido)
        if (cancelado) return
        if (estado !== 'PENDIENTE') {
          const final = TRAS_EL_BANCO[estado]
          setAviso({ tono: final.tono, texto: final.texto(eurosRedondos(importe)) })
          return
        }
      } catch {
        if (cancelado) return
      }
      intento += 1
      if (intento < 10) { setTimeout(() => void preguntar(), 2000); return }
      setAviso({ tono: 'info', texto: 'Aún no tenemos la respuesta del banco. Si has pagado, se registrará en unos minutos; si lo dejaste a medias, no se ha cobrado nada.' })
    }
    void preguntar()
    return () => { cancelado = true }
  }, [pedido, fallido])

  if (!aviso) return null
  const cerrar = () => {
    setParams((p) => { p.delete('donativo'); p.delete('resultado'); return p }, { replace: true })
  }
  return <Alert severity={aviso.tono} onClose={aviso.texto.startsWith('Comprobando') ? undefined : cerrar}>{aviso.texto}</Alert>
}
