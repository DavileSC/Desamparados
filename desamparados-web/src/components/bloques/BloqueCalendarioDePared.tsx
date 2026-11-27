import { Box, Typography } from '@mui/material'
import { SERIF, PAPEL } from '../../features/inicio/estilos'
import { anchoMaximo } from './presentacion'
import type { BloqueCalendarioDePared as Datos, MesDeCalendario } from '../../lib/api/contenido'
import { propsDeFoto } from '../../lib/fotoSubida'
import { useFotoQueFalla } from '../../hooks/useFotoQueFalla'
import { MARCA } from '../../theme/marca'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** Casilla de un mes corriente: un punto más clara que el fondo «vino». */
const CASILLA = '#22161a'
const TINTA_CREMA = '#2a1418'

/**
 * El año del Grupo como un calendario colgado en la sacristía: doce casillas
 * cuadradas y redondeadas, de enero a diciembre, con lo que pasa en cada mes.
 * Los meses grandes van en granate y con foto; uno puede ir en crema, como una
 * nota; los que no tienen nada, tenues. Cuatro por fila en escritorio, dos en
 * el móvil, a todo el ancho de la columna, como su título.
 *
 * Es una lista ordenada: el lector de pantalla oye los doce meses en orden.
 */
export default function BloqueCalendarioDePared({ bloque }: { bloque: Datos }) {
  return (
    <Box component="ol" sx={{
      listStyle: 'none', m: 0, p: 0, maxWidth: anchoMaximo(bloque, 'none'), mx: 'auto',
      display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1.25, md: 1.75 },
    }}>
      {bloque.meses.map((mes, i) => <Mes key={i} mes={mes} numero={i + 1} />)}
    </Box>
  )
}

function Mes({ mes, numero }: { mes: MesDeCalendario; numero: number }) {
  const { visible: conFoto, alFallar } = useFotoQueFalla(mes.foto)
  const crema = mes.tono === 'crema'
  const tenue = mes.titulo.trim() === ''
  const tinta = crema ? TINTA_CREMA : '#fff'
  return (
    <Box component="li" sx={{
      position: 'relative', overflow: 'hidden', isolation: 'isolate',
      aspectRatio: { md: '1' }, minHeight: { xs: 168, sm: 200 },
      borderRadius: { xs: '16px', md: '22px' }, p: { xs: 2, md: 2.75 },
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      backgroundColor: crema ? PAPEL : mes.tono === 'destacado' ? MARCA.principal : CASILLA,
      color: tinta,
    }}>
      {conFoto && (
        <>
          <Box component="img" {...propsDeFoto(mes.foto, '(min-width: 900px) 300px, 50vw', alFallar)} alt={mes.fotoAlt} loading="lazy" decoding="async"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -2 }} />
          {/* El velo, más denso abajo, donde va el texto; granate en los meses destacados. */}
          <Box aria-hidden sx={{
            position: 'absolute', inset: 0, zIndex: -1,
            background: mes.tono === 'destacado'
              ? 'linear-gradient(to top, rgba(92,20,29,.96), rgba(92,20,29,.25) 75%)'
              : 'linear-gradient(to top, rgba(20,13,15,.95), rgba(20,13,15,.15) 70%)',
          }} />
        </>
      )}
      <Typography component="span" aria-hidden sx={{
        fontSize: 12, letterSpacing: '0.16em',
        color: crema ? 'rgba(42,20,24,.5)' : conFoto ? '#fff' : 'rgba(255,255,255,.5)',
        textShadow: conFoto ? '0 1px 8px rgba(0,0,0,.8)' : undefined,
      }}>
        {String(numero).padStart(2, '0')}
      </Typography>
      <Box>
        <Typography component="h3" sx={{ fontFamily: SERIF, fontWeight: 600, fontSize: { xs: 26, md: 34 }, lineHeight: 1, mb: 0.75 }}>
          {MESES[numero - 1]}
        </Typography>
        {!tenue && (
          <Typography component="p" sx={{ fontFamily: SERIF, fontSize: { xs: 17, md: 21 }, lineHeight: 1.15, fontWeight: 600 }}>{mes.titulo}</Typography>
        )}
        {mes.texto && (
          <Typography component="p" sx={{ fontSize: 13, lineHeight: 1.4, mt: 0.25, color: crema ? '#6a4a48' : tenue ? 'rgba(255,255,255,.45)' : '#dccbc5' }}>
            {mes.texto}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
