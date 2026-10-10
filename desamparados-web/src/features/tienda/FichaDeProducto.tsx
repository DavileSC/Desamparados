import { useEffect, useState } from 'react'
import { Box, ButtonBase, Typography, useMediaQuery, useTheme } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Link } from 'react-router-dom'
import Boton from '../../components/Boton'
import VisorGaleria from '../../components/galeria/VisorGaleria'
import { useMedidas } from '../../components/galeria/formato'
import type { Producto, TallaDeProducto } from '../../lib/api/tienda'
import { GOLD, PAPEL } from '../inicio/estilos'
import { Contador, ElegirTalla } from './ElegirTalla'
import { FotoSobrePapel } from './TarjetaDeProducto'
import { agotado, avisoDeTallas, claveDe, euros, conTallas, primeraConExistencias, quedanDe, topeDe, type Cesta } from './cesta'
import { propsDeFoto } from '../../lib/fotoSubida'

/** La foto grande de la ficha: media pantalla desde md (dos columnas), entera en el móvil. */
const TAMANO_GRANDE = '(min-width: 900px) 50vw, 100vw'

/** La foto nueva aparece fundiéndose sobre la que había (la «A · Fundido» de las maquetas). */
const fundido = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

/**
 * La ficha de un producto: sus fotos en grande con las miniaturas debajo
 * (al pulsar la grande, el visor de la web a pantalla completa), la
 * descripción entera, la talla y cuántas. Tiene su propia dirección
 * (/tienda/producto/12) para poder mandarla a alguien.
 */
export default function FichaDeProducto({ producto: p, pagoDisponible, cesta, onAnadir }: {
  producto: Producto
  pagoDisponible: boolean
  cesta: Cesta
  onAnadir: (talla: TallaDeProducto | null, cantidad: number) => void
}) {
  const theme = useTheme()
  const escritorio = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const { medir, medidaDe } = useMedidas()
  const [foto, setFoto] = useState(0)
  // La que se estaba viendo, debajo, mientras la nueva se funde encima.
  const [previa, setPrevia] = useState<number | null>(null)
  const cambiar = (i: number) => { if (i !== foto) { setPrevia(foto); setFoto(i) } }
  // Acabado el fundido, la de debajo sobra. Con un temporizador y no con el
  // fin de la animación, que no llega si se pide menos movimiento.
  useEffect(() => {
    if (previa === null) return
    const t = window.setTimeout(() => setPrevia(null), 500)
    return () => window.clearTimeout(t)
  }, [previa, foto])
  const [visor, setVisor] = useState<number | null>(null)
  const [talla, setTalla] = useState<TallaDeProducto | null>(() => primeraConExistencias(p))
  const [cantidad, setCantidad] = useState(1)

  const medios = [
    ...(p.foto ? [{ tipo: 'foto' as const, url: p.foto, portada: '', alt: p.nombre, pie: '' }] : []),
    ...p.fotos.map((f, i) => ({ tipo: 'foto' as const, url: f.url, portada: '', alt: f.pie || `${p.nombre}, foto ${i + 2}`, pie: f.pie })),
  ]
  // El visor pide la anterior o la siguiente sin mirar los bordes: aquí se da la vuelta.
  const ir = (i: number) => setVisor(((i % medios.length) + medios.length) % medios.length)
  const sinNada = agotado(p)
  const yaEnCesta = cesta[claveDe(p.id, conTallas(p) ? talla?.id : null)] ?? 0
  const tope = Math.max(0, topeDe(quedanDe(p, talla)) - yaEnCesta)
  const aviso = conTallas(p) ? avisoDeTallas(p, talla) : ''

  const elegir = (t: TallaDeProducto) => { setTalla(t); setCantidad(1) }
  const anadir = () => { onAnadir(conTallas(p) ? talla : null, cantidad); setCantidad(1) }

  return (
    <Box>
      <ButtonBase component={Link} to="/tienda"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 44, fontFamily: 'inherit', fontWeight: 600, fontSize: 14, color: 'text.secondary', '&:hover': { color: 'text.primary' }, '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 } }}>
        <ArrowBackIcon sx={{ fontSize: 18 }} aria-hidden /> Toda la tienda
      </ButtonBase>

      <Box sx={{ mt: 1.5, display: 'grid', gap: { xs: 3, md: 4.5 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start' }}>
        <Box>
          {medios.length > 0 ? (
            <ButtonBase onClick={() => setVisor(foto)} aria-label={medios.length > 1 ? `Ampliar la foto ${foto + 1} de ${medios.length}` : `Ampliar la foto de ${p.nombre}`}
              sx={{ display: 'block', width: '100%', cursor: 'zoom-in', borderRadius: '4px', '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: 3 } }}>
              <Box sx={{ position: 'relative' }}>
                {previa !== null && medios[previa] && (
                  <Box aria-hidden sx={{ position: 'absolute', inset: 0 }}>
                    <FotoSobrePapel src={medios[previa].url} sizes={TAMANO_GRANDE} alt="" proporcion="1 / 1" ajuste="contain" relleno={3} />
                  </Box>
                )}
                {/* Con cada foto se monta de nuevo (su `key`), y el fundido vuelve a empezar. */}
                <Box key={foto} sx={{
                  position: 'relative', animation: previa !== null ? `${fundido} .45s ease both` : 'none',
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                }}>
                  <FotoSobrePapel src={medios[foto].url} sizes={TAMANO_GRANDE} alt={medios[foto].alt} proporcion="1 / 1" ajuste="contain" relleno={3} />
                </Box>
              </Box>
            </ButtonBase>
          ) : <FotoSobrePapel src={null} sizes={TAMANO_GRANDE} alt="" proporcion="1 / 1" />}
          {medios.length > 1 && (
            <Box sx={{ display: 'flex', gap: 1.25, mt: 1.5, flexWrap: 'wrap' }}>
              {medios.map((m, i) => (
                <ButtonBase key={m.url} onClick={() => cambiar(i)} aria-label={`Ver la foto ${i + 1}${m.pie ? `: ${m.pie}` : ''}`} aria-pressed={i === foto}
                  sx={{ width: 72, height: 72, borderRadius: '4px', overflow: 'hidden', bgcolor: PAPEL, border: '2px solid', borderColor: i === foto ? GOLD : 'transparent', '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 } }}>
                  <Box component="img" {...propsDeFoto(m.url, '72px')} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 0.5, boxSizing: 'border-box', mixBlendMode: 'multiply' }} />
                </ButtonBase>
              ))}
            </Box>
          )}
        </Box>

        <Box>
          <Typography component="h1" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 500, lineHeight: 1.15 }}>{p.nombre}</Typography>
          <Typography sx={{ mt: 1, fontSize: { xs: 22, md: 26 }, fontWeight: 300, color: '#e3d8bf', fontVariantNumeric: 'tabular-nums' }}>{euros(p.precio)}</Typography>
          {p.descripcion && <Typography sx={{ mt: 2, fontSize: 16, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{p.descripcion}</Typography>}

          {sinNada ? (
            <Typography sx={{ mt: 3, color: 'text.secondary' }}>Agotado. Pregunta en Secretaría si van a llegar más.</Typography>
          ) : pagoDisponible && <>
            {conTallas(p) && (
              <Box sx={{ mt: 3 }}>
                <Typography component="p" sx={{ mb: 1.25, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'text.secondary' }}>Talla</Typography>
                <ElegirTalla producto={p} elegida={talla} onElegir={elegir} grande />
                {aviso && <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>{aviso}</Typography>}
              </Box>
            )}
            <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Box sx={{ border: '1px solid rgba(204, 196, 201, 0.35)', borderRadius: '6px' }}>
                <Contador cantidad={Math.min(cantidad, Math.max(1, tope))} minimo={1} tope={tope} nombre={p.nombre} onCambiar={setCantidad} />
              </Box>
              <Boton onClick={anadir} disabled={tope < 1 || (conTallas(p) && !talla)} sx={{ flex: '1 1 200px' }}>
                {tope < 1 ? 'Ya tienes todas en la cesta' : `Añadir · ${euros(p.precio * cantidad)}`}
              </Boton>
            </Box>
            {yaEnCesta > 0 && (
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                Ya tienes {yaEnCesta} en la cesta{conTallas(p) && talla ? ` (talla ${talla.nombre})` : ''}.
              </Typography>
            )}
          </>}
          <Typography variant="body2" sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider', color: 'text.secondary', lineHeight: 1.6 }}>
            {pagoDisponible ? 'Se paga aquí y se recoge en Secretaría. No hacemos envíos.' : 'De momento se compra en Secretaría.'}
          </Typography>
        </Box>
      </Box>

      {medios.length > 0 && (
        <VisorGaleria medios={medios} actual={visor} onIr={ir} onCerrar={() => setVisor(null)}
          reproduciendo={[]} onReproducir={() => {}} medidaDe={medidaDe} medir={medir} escritorio={escritorio} />
      )}
    </Box>
  )
}
