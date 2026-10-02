import { useRef, useState, type KeyboardEvent, type TouchEvent } from 'react'
import { Box, Button, ButtonBase, Dialog, IconButton, Typography } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded'
import type { FichaEnLaProcesion, SalidaDelHermano } from '../../../lib/api/procesion'
import Boton from '../../../components/Boton'
import TarjetaPapeleta from './TarjetaPapeleta'
import { BURDEOS, CREMA, GRIS, NEGRO, ORO, SERIFA, imagenDelQr } from './papeleta-estilo'

/** Lo que hay que mover el dedo de lado para pasar de papeleta. */
const DESLIZAR_PX = 50

interface Props {
  /** Las fichas con la papeleta ya recogida (con QR), en el orden de la familia. */
  fichas: FichaEnLaProcesion[]
  salida: SalidaDelHermano
  /** «Tú», «Hijo», «Sobrina»…: quién es cada uno para el titular. */
  quienEs: (f: FichaEnLaProcesion) => string
}

/**
 * Las papeletas para enseñar en la puerta. Con una, la tarjeta tal cual. Con
 * varias, en fila no cabían (cinco tarjetas son cinco pantallas de móvil), así
 * que van en una lista corta y un «modo puerta» a pantalla completa que las
 * pasa de una en una: es la maqueta C, elegida el 02-10-2026, pensada para el
 * padre que enseña las de todos sus hijos seguidas.
 */
export default function PapeletasDeLaFamilia({ fichas, salida, quienEs }: Props) {
  const [enPuerta, setEnPuerta] = useState<number | null>(null)

  if (fichas.length === 1) {
    return (
      <Box sx={{ display: 'flex', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
        <TarjetaPapeleta ficha={fichas[0]} salida={salida} />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Boton fullWidth startIcon={<QrCode2RoundedIcon />} onClick={() => setEnPuerta(0)} sx={{ py: 1.5, fontSize: 16 }}>
        Modo puerta · las {fichas.length} seguidas
      </Boton>
      <Typography sx={{ mt: 1, fontSize: 13.5, color: 'text.secondary' }}>
        A pantalla completa y con el QR grande. Se pasa de una a otra sin buscar.
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mt: 2 }}>
        {fichas.map((f, i) => {
          const papeleta = f.porSalida[salida.salida].papeleta!
          return (
            <Box component="li" key={f.id}>
              <ButtonBase
                onClick={() => setEnPuerta(i)}
                aria-label={`Enseñar la papeleta de ${f.nombre} ${f.apellidos}`}
                sx={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 2, py: 1.5, textAlign: 'left',
                  borderBottom: 1, borderColor: 'divider', fontFamily: 'inherit',
                  '&:hover .flecha': { transform: 'translateX(3px)' },
                }}
              >
                <Box sx={{ width: 52, height: 52, flexShrink: 0, bgcolor: CREMA, p: '5px', borderRadius: 0.5 }}>
                  <Box component="img" src={imagenDelQr(papeleta.qr!.svg)} alt="" sx={{ width: 42, height: 42, display: 'block' }} />
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{f.nombre} {f.apellidos}</Typography>
                  <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>
                    {[papeleta.puesto, papeleta.tramo, quienEs(f)].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <ChevronRightRoundedIcon className="flecha" sx={{ color: 'text.secondary', transition: 'transform 150ms' }} />
              </ButtonBase>
            </Box>
          )
        })}
      </Box>
      {enPuerta !== null && (
        <ModoPuerta fichas={fichas} salida={salida} inicio={enPuerta} onCerrar={() => setEnPuerta(null)} />
      )}
    </Box>
  )
}

/**
 * La puerta: una papeleta a pantalla completa, con el QR lo más grande que
 * quepa, y debajo el nombre de la anterior y de la siguiente. Se pasa con los
 * botones, deslizando el dedo o con las flechas del teclado.
 */
function ModoPuerta({ fichas, salida, inicio, onCerrar }: { fichas: FichaEnLaProcesion[]; salida: SalidaDelHermano; inicio: number; onCerrar: () => void }) {
  const [i, setI] = useState(inicio)
  const toque = useRef<number | null>(null)
  const f = fichas[i]
  const papeleta = f.porSalida[salida.salida].papeleta!
  const primera = i === 0
  const ultima = i === fichas.length - 1
  const ir = (destino: number) => setI(Math.max(0, Math.min(fichas.length - 1, destino)))
  const siguiente = () => (ultima ? onCerrar() : ir(i + 1))

  const teclado = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') ir(i + 1)
    else if (e.key === 'ArrowLeft') ir(i - 1)
  }
  const empezarToque = (e: TouchEvent) => { toque.current = e.touches[0].clientX }
  const acabarToque = (e: TouchEvent) => {
    if (toque.current === null) return
    const recorrido = e.changedTouches[0].clientX - toque.current
    toque.current = null
    if (recorrido <= -DESLIZAR_PX) ir(i + 1)
    else if (recorrido >= DESLIZAR_PX) ir(i - 1)
  }

  return (
    <Dialog
      open
      fullScreen
      onClose={onCerrar}
      onKeyDown={teclado}
      slotProps={{ paper: { 'aria-label': `Papeleta de ${f.nombre} ${f.apellidos}, ${i + 1} de ${fichas.length}`, sx: { bgcolor: NEGRO, color: CREMA, backgroundImage: 'none' } } }}
    >
      <Box onTouchStart={empezarToque} onTouchEnd={acabarToque} sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column', maxWidth: 520, width: '100%', mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.25, pt: 1.5, pb: 1 }}>
          <IconButton onClick={onCerrar} aria-label="Cerrar el modo puerta" sx={{ color: CREMA, width: 44, height: 44 }}><CloseRoundedIcon /></IconButton>
          <Typography sx={{ fontSize: 10.5, letterSpacing: '2.5px', textTransform: 'uppercase', color: ORO, fontWeight: 600 }}>
            {salida.nombre} · {papeleta.year}
          </Typography>
          <Typography sx={{ width: 44, textAlign: 'center', fontSize: 14, color: GRIS, fontVariantNumeric: 'tabular-nums' }}>{i + 1} de {fichas.length}</Typography>
        </Box>
        <Box aria-hidden="true" sx={{ display: 'flex', gap: 0.5, px: 2.5 }}>
          {fichas.map((otra, k) => (
            <Box key={otra.id} sx={{ flexGrow: 1, height: 3, borderRadius: 2, bgcolor: k <= i ? ORO : 'rgba(244,239,229,0.2)', transition: 'background-color 200ms' }} />
          ))}
        </Box>

        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', px: 2.5, pt: 3 }}>
          <Typography sx={{ fontFamily: SERIFA, fontSize: 26, lineHeight: 1.15 }}>{f.nombre} {f.apellidos}</Typography>
          {f.numeroHermano && <Typography sx={{ fontSize: 13.5, color: GRIS, mt: 0.25 }}>Hermano n.º {f.numeroHermano}</Typography>}
          <Box sx={{ mt: 2.75, bgcolor: CREMA, p: 2.25, display: 'flex' }}>
            <Box
              component="img"
              src={imagenDelQr(papeleta.qr!.svg)}
              alt={`Código QR de la papeleta ${papeleta.referencia}`}
              sx={{ width: 'min(290px, calc(100vw - 76px))', aspectRatio: '1', display: 'block', imageRendering: 'pixelated' }}
            />
          </Box>
          <Typography sx={{ mt: 2.75, fontFamily: SERIFA, fontSize: 36, lineHeight: 1.05, color: ORO }}>{papeleta.puesto}</Typography>
          {papeleta.tramo && <Typography sx={{ fontSize: 15, mt: 0.5 }}>{papeleta.tramo}</Typography>}
          <Typography sx={{ mt: 0.75, fontSize: 13, color: GRIS, fontVariantNumeric: 'tabular-nums' }}>
            Ref. {papeleta.referencia}{papeleta.tunica ? ` · Túnica ${papeleta.tunica}` : ''}
          </Typography>
          <Typography sx={{ mt: 1.75, fontSize: 12.5, color: GRIS }}>Sube el brillo si el lector no la coge a la primera.</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, p: 2.5 }}>
          <Button
            fullWidth
            disabled={primera}
            onClick={() => ir(i - 1)}
            startIcon={<ChevronLeftRoundedIcon />}
            sx={{ minHeight: 56, borderRadius: 2, border: '1px solid rgba(244,239,229,0.35)', color: CREMA, fontSize: 16, fontWeight: 600, textTransform: 'none', '&.Mui-disabled': { color: CREMA, opacity: 0.3 } }}
          >
            {primera ? 'Anterior' : fichas[i - 1].nombre}
          </Button>
          <Button
            fullWidth
            onClick={siguiente}
            endIcon={ultima ? undefined : <ChevronRightRoundedIcon />}
            sx={{ minHeight: 56, borderRadius: 2, bgcolor: CREMA, color: NEGRO, fontSize: 16, fontWeight: 600, textTransform: 'none', '&:hover': { bgcolor: '#ffffff' } }}
          >
            {ultima ? 'Terminar' : fichas[i + 1].nombre}
          </Button>
        </Box>
        <Box sx={{ height: 4, bgcolor: BURDEOS, flexShrink: 0 }} />
      </Box>
    </Dialog>
  )
}
