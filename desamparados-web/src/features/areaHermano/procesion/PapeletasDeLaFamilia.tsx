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
        A pantalla completa y con el QR grande.{salida.qrFamilia ? ' Empieza por uno solo para toda la familia; luego, las de cada uno.' : ' Se pasa de una a otra sin buscar.'}
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mt: 2 }}>
        {fichas.map((f, i) => {
          const papeleta = f.porSalida[salida.salida].papeleta!
          return (
            <Box component="li" key={f.id}>
              <ButtonBase
                onClick={() => setEnPuerta(salida.qrFamilia ? i + 1 : i)}
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

/** Un paso del modo puerta: el QR de toda la familia o la papeleta de uno. */
type Paso = { tipo: 'familia' } | { tipo: 'papeleta'; ficha: FichaEnLaProcesion }

/**
 * La puerta: a pantalla completa, con el QR lo más grande que quepa, y debajo
 * el nombre del paso anterior y del siguiente. Con QR de familia, el primero
 * es ese: el diputado lo lee, marca a los que estén y entran todos de una vez.
 * Se pasa con los botones, deslizando el dedo o con las flechas del teclado.
 */
function ModoPuerta({ fichas, salida, inicio, onCerrar }: { fichas: FichaEnLaProcesion[]; salida: SalidaDelHermano; inicio: number; onCerrar: () => void }) {
  const pasos: Paso[] = [
    ...(salida.qrFamilia ? [{ tipo: 'familia' } as const] : []),
    ...fichas.map((ficha) => ({ tipo: 'papeleta', ficha }) as const),
  ]
  const [i, setI] = useState(inicio)
  const toque = useRef<number | null>(null)
  const paso = pasos[i]
  const primera = i === 0
  const ultima = i === pasos.length - 1
  const ir = (destino: number) => setI(Math.max(0, Math.min(pasos.length - 1, destino)))
  const siguiente = () => (ultima ? onCerrar() : ir(i + 1))
  const nombreDe = (p: Paso) => (p.tipo === 'familia' ? 'Todos' : p.ficha.nombre)
  const deQuien = paso.tipo === 'familia' ? 'Toda la familia' : `Papeleta de ${paso.ficha.nombre} ${paso.ficha.apellidos}`

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
      slotProps={{ paper: { 'aria-label': `${deQuien}, ${i + 1} de ${pasos.length}`, sx: { bgcolor: NEGRO, color: CREMA, backgroundImage: 'none' } } }}
    >
      <Box onTouchStart={empezarToque} onTouchEnd={acabarToque} sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column', maxWidth: 520, width: '100%', mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.25, pt: 1.5, pb: 1 }}>
          <IconButton onClick={onCerrar} aria-label="Cerrar el modo puerta" sx={{ color: CREMA, width: 44, height: 44 }}><CloseRoundedIcon /></IconButton>
          <Typography sx={{ fontSize: 10.5, letterSpacing: '2.5px', textTransform: 'uppercase', color: ORO, fontWeight: 600 }}>
            {salida.nombre} · {salida.year}
          </Typography>
          <Typography sx={{ width: 44, textAlign: 'center', fontSize: 14, color: GRIS, fontVariantNumeric: 'tabular-nums' }}>{i + 1} de {pasos.length}</Typography>
        </Box>
        <Box aria-hidden="true" sx={{ display: 'flex', gap: 0.5, px: 2.5 }}>
          {pasos.map((p, k) => (
            <Box key={p.tipo === 'familia' ? 'familia' : p.ficha.id} sx={{ flexGrow: 1, height: 3, borderRadius: 2, bgcolor: k <= i ? ORO : 'rgba(244,239,229,0.2)', transition: 'background-color 200ms' }} />
          ))}
        </Box>

        {paso.tipo === 'familia'
          ? <PasoFamilia fichas={fichas} salida={salida} />
          : <PasoPapeleta ficha={paso.ficha} salida={salida} />}

        <Box sx={{ display: 'flex', gap: 1.5, p: 2.5 }}>
          <Button
            fullWidth
            disabled={primera}
            onClick={() => ir(i - 1)}
            startIcon={<ChevronLeftRoundedIcon />}
            sx={{ minHeight: 56, borderRadius: 2, border: '1px solid rgba(244,239,229,0.35)', color: CREMA, fontSize: 16, fontWeight: 600, textTransform: 'none', '&.Mui-disabled': { color: CREMA, opacity: 0.3 } }}
          >
            {primera ? 'Anterior' : nombreDe(pasos[i - 1])}
          </Button>
          <Button
            fullWidth
            onClick={siguiente}
            endIcon={ultima ? undefined : <ChevronRightRoundedIcon />}
            sx={{ minHeight: 56, borderRadius: 2, bgcolor: CREMA, color: NEGRO, fontSize: 16, fontWeight: 600, textTransform: 'none', '&:hover': { bgcolor: '#ffffff' } }}
          >
            {ultima ? 'Terminar' : nombreDe(pasos[i + 1])}
          </Button>
        </Box>
        <Box sx={{ height: 4, bgcolor: BURDEOS, flexShrink: 0 }} />
      </Box>
    </Dialog>
  )
}

/** El QR grande, sobre crema: el lector lo coge a la primera aunque el brillo esté bajo. */
function QrGrande({ svg, alt }: { svg: string; alt: string }) {
  return (
    <Box sx={{ mt: 2.75, bgcolor: CREMA, p: 2.25, display: 'flex' }}>
      <Box component="img" src={imagenDelQr(svg)} alt={alt} sx={{ width: 'min(290px, calc(100vw - 76px))', aspectRatio: '1', display: 'block', imageRendering: 'pixelated' }} />
    </Box>
  )
}

const centro = { flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', px: 2.5, pt: 3 } as const

function PasoFamilia({ fichas, salida }: { fichas: FichaEnLaProcesion[]; salida: SalidaDelHermano }) {
  return (
    <Box sx={centro}>
      <Typography sx={{ fontFamily: SERIFA, fontSize: 26, lineHeight: 1.15 }}>Toda la familia</Typography>
      <Typography sx={{ fontSize: 13.5, color: GRIS, mt: 0.25 }}>{fichas.length} papeletas con un solo QR</Typography>
      <QrGrande svg={salida.qrFamilia!.svg} alt="Código QR de toda la familia" />
      <Typography sx={{ mt: 2.75, fontFamily: SERIFA, fontSize: 22, lineHeight: 1.3, color: ORO }}>
        {fichas.map((f) => f.nombre).join(' · ')}
      </Typography>
      <Typography sx={{ mt: 1.5, fontSize: 12.5, color: GRIS, maxWidth: 320 }}>
        En la puerta marcan a los que estáis. Quien llegue más tarde entra con su propia papeleta.
      </Typography>
    </Box>
  )
}

function PasoPapeleta({ ficha, salida }: { ficha: FichaEnLaProcesion; salida: SalidaDelHermano }) {
  const papeleta = ficha.porSalida[salida.salida].papeleta!
  return (
    <Box sx={centro}>
      <Typography sx={{ fontFamily: SERIFA, fontSize: 26, lineHeight: 1.15 }}>{ficha.nombre} {ficha.apellidos}</Typography>
      {ficha.numeroHermano && <Typography sx={{ fontSize: 13.5, color: GRIS, mt: 0.25 }}>Hermano n.º {ficha.numeroHermano}</Typography>}
      <QrGrande svg={papeleta.qr!.svg} alt={`Código QR de la papeleta ${papeleta.referencia}`} />
      <Typography sx={{ mt: 2.75, fontFamily: SERIFA, fontSize: 36, lineHeight: 1.05, color: ORO }}>{papeleta.puesto}</Typography>
      {papeleta.tramo && <Typography sx={{ fontSize: 15, mt: 0.5 }}>{papeleta.tramo}</Typography>}
      <Typography sx={{ mt: 0.75, fontSize: 13, color: GRIS, fontVariantNumeric: 'tabular-nums' }}>
        Ref. {papeleta.referencia}{papeleta.tunica ? ` · Túnica ${papeleta.tunica}` : ''}
      </Typography>
      <Typography sx={{ mt: 1.75, fontSize: 12.5, color: GRIS }}>Sube el brillo si el lector no la coge a la primera.</Typography>
    </Box>
  )
}
