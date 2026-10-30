import type { ReactNode } from 'react'
import { Box } from '@mui/material'

/**
 * El dibujo de cada tipo de bloque en la galería de «Añadir bloque»: un
 * esquema de cómo queda en la página, no una foto. Se pinta con el color del
 * texto (`currentColor`) a distintas opacidades, así que se ve igual en el CMS
 * claro y en el oscuro. Es decorativo: el nombre y la descripción van al lado.
 */
const A = 'currentColor'

/** Una raya de texto. */
const raya = (x: number, y: number, w: number, o = 0.35) => <rect x={x} y={y} width={w} height={3} rx={1.5} fill={A} opacity={o} />
/** Un recuadro de foto, con su montaña. */
const foto = (x: number, y: number, w: number, h: number) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={3} fill={A} opacity={0.14} />
    <path d={`M${x + 4} ${y + h - 4} L${x + w * 0.35} ${y + h * 0.45} L${x + w * 0.55} ${y + h * 0.7} L${x + w * 0.7} ${y + h * 0.55} L${x + w - 4} ${y + h - 4} Z`} fill={A} opacity={0.3} />
    <circle cx={x + w * 0.75} cy={y + h * 0.3} r={Math.min(w, h) * 0.08} fill={A} opacity={0.35} />
  </g>
)
const caja = (x: number, y: number, w: number, h: number, o = 0.1) => <rect x={x} y={y} width={w} height={h} rx={3} fill={A} opacity={o} />
const boton = (x: number, y: number, w: number, lleno = true) => (
  <rect x={x} y={y} width={w} height={9} rx={4.5} fill={lleno ? A : 'none'} stroke={A} strokeWidth={1.2} opacity={lleno ? 0.55 : 0.5} />
)

const DIBUJOS: Record<string, ReactNode> = {
  texto: <>{raya(14, 14, 70, 0.6)}{raya(14, 24, 92)}{raya(14, 32, 88)}{raya(14, 40, 92)}{raya(14, 48, 60)}</>,
  cita: <><text x={14} y={34} fontSize={34} fill={A} opacity={0.5} fontFamily="serif">“</text>{raya(34, 22, 72, 0.6)}{raya(34, 31, 66, 0.6)}{raya(34, 40, 50, 0.6)}{raya(34, 52, 30, 0.35)}</>,
  preguntas: <>{[14, 30, 46].map((y) => <g key={y}>{raya(14, y, 70, 0.55)}<path d={`M100 ${y - 1} l4 4 l4 -4`} stroke={A} strokeWidth={1.5} fill="none" opacity={0.5} /><rect x={14} y={y + 9} width={92} height={0.8} fill={A} opacity={0.2} /></g>)}</>,
  foto: <>{foto(20, 10, 80, 44)}{raya(40, 60, 40, 0.3)}</>,
  fotoTexto: <>{foto(10, 14, 48, 44)}{raya(66, 18, 40, 0.6)}{raya(66, 28, 44)}{raya(66, 36, 42)}{raya(66, 44, 30)}{boton(66, 52, 26)}</>,
  carrusel: <>{foto(10, 10, 58, 52)}{raya(76, 14, 16, 0.5)}{raya(76, 22, 30, 0.8)}{raya(76, 32, 34)}{raya(76, 38, 28)}<rect x={76} y={54} width={34} height={0.8} fill={A} opacity={0.3} />{raya(76, 58, 8, 0.5)}{raya(98, 58, 12, 0.5)}</>,
  fotoFija: <>{foto(6, 6, 108, 60)}{caja(6, 6, 54, 60, 0.18)}{raya(14, 26, 30, 0.75)}{raya(14, 34, 38, 0.5)}{raya(14, 41, 34, 0.5)}{raya(14, 48, 24, 0.5)}{[22, 30, 38].map((y, i) => <rect key={y} x={i === 0 ? 98 : 102} y={y} width={i === 0 ? 10 : 6} height={1.5} fill={A} opacity={i === 0 ? 0.7 : 0.35} />)}</>,
  galeria: <>{foto(10, 12, 32, 22)}{foto(44, 12, 32, 22)}{foto(78, 12, 32, 22)}{foto(10, 38, 32, 22)}{foto(44, 38, 32, 22)}{foto(78, 38, 32, 22)}</>,
  video: <>{caja(14, 10, 92, 52, 0.16)}<circle cx={60} cy={36} r={11} fill={A} opacity={0.5} /><path d="M56 30 L66 36 L56 42 Z" fill="#fff" opacity={0.9} /></>,
  tarjetas: <>{[10, 44, 78].map((x) => <g key={x}>{caja(x, 12, 32, 48, 0.12)}{raya(x + 4, 20, 18, 0.6)}{raya(x + 4, 30, 24)}{raya(x + 4, 37, 20)}</g>)}</>,
  llamada: <>{caja(14, 12, 92, 48, 0.08)}<rect x={14} y={12} width={92} height={48} rx={3} fill="none" stroke={A} strokeOpacity={0.4} />{raya(30, 24, 60)}{raya(36, 32, 48)}{boton(46, 44, 28)}</>,
  botones: <>{boton(16, 32, 26)}{boton(47, 32, 26, false)}{boton(78, 32, 26, false)}</>,
  horario: <>{caja(14, 8, 92, 22, 0.12)}<circle cx={21} cy={15} r={2} fill={A} opacity={0.7} />{raya(26, 13, 24, 0.4)}<text x={20} y={27} fontSize={9} fill={A} opacity={0.65} fontFamily="serif">Hoy, 19:00</text>{[38, 48, 58].map((y) => <g key={y}>{raya(14, y, 26, 0.45)}<rect x={44} y={y + 2} width={40} height={0.8} fill={A} opacity={0.3} />{raya(88, y, 18, 0.55)}</g>)}</>,
  relacion: <>{raya(10, 10, 100, 0.25)}{[20, 34, 48].map((y, i) => <g key={y}>{raya(10, y + 2, 26, i === 0 ? 0.8 : 0.45)}{raya(44, y + 1, 36, i === 0 ? 0.7 : 0.5)}{raya(86, y + 2, 24, 0.3)}</g>)}</>,
  donativo: <>{caja(8, 8, 104, 58, 0.14)}{raya(16, 16, 60, 0.55)}{[16, 38, 60, 82].map((x, i) => <rect key={x} x={x} y={28} width={18} height={10} rx={2} fill="none" stroke={A} strokeWidth={1.2} opacity={i === 1 ? 0.8 : 0.4} />)}{raya(16, 44, 40)}{boton(16, 52, 40)}</>,
  programa: <>{raya(10, 10, 100, 0.25)}{[20, 36, 52].map((y, i) => <g key={y}><text x={10} y={y + 8} fontSize={9} fill={A} opacity={i === 0 ? 0.8 : 0.4} fontFamily="sans-serif">Oct</text>{raya(36, y + 2, 44, i === 0 ? 0.6 : 0.35)}{i === 0 && <rect x={88} y={y + 1} width={22} height={6} fill={A} opacity={0.7} />}</g>)}</>,
  puertas: <>{caja(10, 10, 48, 52, 0.1)}{caja(62, 10, 48, 52, 0.1)}<rect x={10} y={10} width={48} height={1.6} fill={A} opacity={0.7} /><rect x={62} y={10} width={48} height={1.6} fill={A} opacity={0.45} />{raya(16, 22, 30, 0.6)}{raya(68, 22, 30, 0.6)}{raya(16, 32, 36)}{raya(68, 32, 36)}{boton(16, 48, 22)}{boton(68, 48, 22)}</>,
  anillos: <><circle cx={60} cy={26} r={14} fill="none" stroke={A} strokeWidth={1.3} opacity={0.7} /><circle cx={52} cy={40} r={14} fill="none" stroke={A} strokeWidth={1.3} opacity={0.5} /><circle cx={68} cy={40} r={14} fill="none" stroke={A} strokeWidth={1.3} opacity={0.35} />{raya(46, 6, 28, 0.4)}{raya(8, 42, 26, 0.4)}{raya(86, 42, 26, 0.4)}</>,
  dibujo: <><path d="M14 60 H56 M18 60 C28 52 34 34 35 14 C36 34 42 52 52 60 M35 14 Q30 40 24 60 M35 14 Q40 40 46 60 M35 14 V6 M31 9 H39" stroke={A} strokeWidth={1.3} fill="none" opacity={0.6} />{raya(66, 18, 36, 0.6)}{raya(66, 28, 40)}{raya(66, 36, 42)}{raya(66, 44, 30)}</>,
  espacio: <><path d="M60 14 v12 M55 20 l5 -6 l5 6 M60 58 v-12 M55 52 l5 6 l5 -6" stroke={A} strokeWidth={1.5} fill="none" opacity={0.5} /><rect x={20} y={35} width={80} height={1} fill={A} opacity={0.35} /></>,
  datos: <>{[14, 26, 38, 50].map((y) => <g key={y}>{raya(14, y, 28, 0.6)}{raya(50, y, 54)}</g>)}</>,
  itinerario: <><rect x={31} y={12} width={1.5} height={48} fill={A} opacity={0.3} />{[14, 30, 46].map((y) => <g key={y}>{raya(10, y, 14, 0.6)}<circle cx={32} cy={y + 1.5} r={3} fill="none" stroke={A} strokeWidth={1.4} opacity={0.6} />{raya(42, y, 56)}</g>)}</>,
  cronologia: <><rect x={46} y={10} width={1.2} height={54} fill={A} opacity={0.3} />{[14, 38].map((y) => <g key={y}><text x={14} y={y + 8} fontSize={10} fill={A} opacity={0.55} fontFamily="serif">1954</text><circle cx={46.5} cy={y + 4} r={3} fill={A} opacity={0.5} />{raya(56, y, 48, 0.55)}{raya(56, y + 8, 50)}{raya(56, y + 15, 36)}</g>)}</>,
  descargas: <>{[14, 32, 50].map((y) => <g key={y}><rect x={14} y={y - 2} width={10} height={12} rx={1.5} fill="none" stroke={A} strokeWidth={1.2} opacity={0.55} />{raya(30, y, 50, 0.55)}{raya(30, y + 6, 34)}<path d={`M100 ${y} v6 M97 ${y + 3} l3 3 l3 -3`} stroke={A} strokeWidth={1.3} fill="none" opacity={0.5} /></g>)}</>,
  mapa: <>{caja(14, 10, 92, 52, 0.12)}<path d="M14 40 Q40 30 60 42 T106 34" stroke={A} strokeWidth={1.2} fill="none" opacity={0.3} /><path d="M20 20 L50 58 M70 10 L90 62" stroke={A} strokeWidth={1} opacity={0.2} /><path d="M60 22 a8 8 0 0 1 8 8 c0 6 -8 14 -8 14 s-8 -8 -8 -14 a8 8 0 0 1 8 -8 Z" fill={A} opacity={0.55} /><circle cx={60} cy={30} r={2.5} fill="#fff" /></>,
  cuentaAtras: <>{raya(40, 14, 40, 0.4)}{[14, 40, 66, 92].map((x) => <g key={x}><text x={x} y={46} fontSize={18} fill={A} opacity={0.6} fontFamily="serif">08</text>{raya(x + 2, 54, 14, 0.3)}</g>)}</>,
  listado: <>{[12, 28, 44].map((y) => <g key={y}>{caja(12, y, 22, 12, 0.14)}{raya(40, y + 2, 50, 0.55)}{raya(40, y + 8, 36)}</g>)}</>,
  contacto: <>{[12, 26, 40].map((y) => <rect key={y} x={10} y={y} width={58} height={9} rx={2} fill="none" stroke={A} strokeOpacity={0.4} />)}{boton(10, 54, 24)}{caja(76, 12, 34, 50, 0.1)}{raya(80, 20, 20, 0.55)}{raya(80, 30, 26)}{raya(80, 38, 22)}</>,
}

export default function Miniatura({ tipo, ancho = 120 }: { tipo: string; ancho?: number }) {
  return (
    <Box component="svg" viewBox="0 0 120 72" aria-hidden="true" sx={{ width: ancho, height: (ancho * 72) / 120, display: 'block', color: 'text.primary' }}>
      {DIBUJOS[tipo] ?? caja(10, 10, 100, 52)}
    </Box>
  )
}
