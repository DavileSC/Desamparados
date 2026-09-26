import { Box, Grid, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import TarjetaCristal from '../TarjetaCristal'
import { GOLD, GRANATE, PAPEL, SERIF } from '../../features/inicio/estilos'
import { ICONOS } from './iconos'
import { anchoMaximo, valorDe } from './presentacion'
import type { BloqueTarjetas as Datos, TarjetaEnlace } from '../../lib/api/contenido'
import { esDestinoValido } from '../../lib/destinos'

type Estilo = 'cristal' | 'papel' | 'contorno' | 'granate' | 'numeradas'

/**
 * Cuántas columnas ocupa cada tarjeta. En `auto` (el de siempre) depende de
 * cuántas haya: una va sola y ancha, dos y cuatro se reparten a pares y lo
 * demás va de tres en tres. Con un número, ese en escritorio.
 */
function columnas(cuantas: number, eleccion: string) {
  if (eleccion === '2') return { xs: 12, sm: 6 }
  if (eleccion === '3') return { xs: 12, sm: 6, md: 4 }
  if (eleccion === '4') return { xs: 12, sm: 6, md: 3 }
  if (cuantas === 1) return { xs: 12 }
  if (cuantas === 2 || cuantas === 4) return { xs: 12, md: 6 }
  return { xs: 12, md: 6, lg: 4 }
}

/** El recuadro de cada estilo. `cristal` es el de siempre. */
const FONDOS: Record<Exclude<Estilo, 'cristal' | 'numeradas'>, object> = {
  papel: { backgroundColor: PAPEL, color: '#1b1c1a', border: '1px solid rgba(27, 28, 26, 0.08)', borderRadius: '8px' },
  contorno: { backgroundColor: 'transparent', border: '1px solid rgba(222, 199, 43, 0.35)', borderRadius: '8px' },
  granate: { backgroundColor: GRANATE, color: '#fff', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px' },
}

/**
 * Una rejilla de tarjetas, cada una con su título, su texto y, si se quiere,
 * una foto arriba o un icono, y un enlace. Con pocas y en `auto`, la rejilla
 * se estrecha a lo que mide una foto (1000 px): a todo el ancho, dos tarjetas
 * quedaban mucho más anchas que el texto de encima.
 */
export default function BloqueTarjetas({ bloque }: { bloque: Datos }) {
  const cuantas = bloque.tarjetas.length
  const eleccion = valorDe(bloque, 'columnas')
  const estrecha = eleccion === 'auto' && cuantas <= 2
  const estilo = valorDe(bloque, 'estilo') as Estilo
  const horizontal = valorDe(bloque, 'orientacion') === 'horizontal'
  const centrada = valorDe(bloque, 'alineacion') === 'centro'
  if (estilo === 'numeradas') return <Numeradas bloque={bloque} />
  return (
    // La última fila, si no se llena, va centrada y no pegada a la izquierda.
    <Grid container spacing={3} sx={{ justifyContent: 'center', maxWidth: anchoMaximo(bloque, estrecha ? '1000px' : 'none'), mx: 'auto' }}>
      {bloque.tarjetas.map((tarjeta, indice) => (
        // La clave es posicional porque una tarjeta no tiene identificador
        // propio y el enlace dejó de servir: ahora es opcional, así que dos
        // tarjetas informativas compartirían la cadena vacía.
        <Grid key={indice} size={columnas(cuantas, eleccion)}>
          <Tarjeta tarjeta={tarjeta} estilo={estilo} horizontal={horizontal} centrada={centrada} />
        </Grid>
      ))}
    </Grid>
  )
}

/**
 * Sin enlace, la tarjeta es informativa: ni `<a>`, ni cursor de mano, ni
 * realce al pasar por encima. Un recuadro que se ilumina y no lleva a ninguna
 * parte es una promesa que no se cumple, y además aparecería en la lista de
 * enlaces de quien navega con lector de pantalla.
 */
function Tarjeta({ tarjeta, estilo, horizontal, centrada }: { tarjeta: TarjetaEnlace; estilo: Exclude<Estilo, 'numeradas'>; horizontal: boolean; centrada: boolean }) {
  const icono = tarjeta.icono ? ICONOS[tarjeta.icono] : null
  const foto = tarjeta.foto ?? ''
  const oscura = estilo === 'granate'

  const media = foto
    ? (
      <Box component="img" src={foto} alt={tarjeta.fotoAlt ?? ''} loading="lazy" decoding="async"
        sx={horizontal
          ? { width: { xs: '100%', sm: '38%' }, aspectRatio: { xs: '16 / 9', sm: 'auto' }, objectFit: 'cover', flexShrink: 0, alignSelf: 'stretch' }
          : { width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }} />
    )
    : icono && (
      <Box aria-hidden sx={{
        display: 'inline-grid', placeItems: 'center', width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
        mb: horizontal ? 0 : 2, mx: centrada && !horizontal ? 'auto' : 0,
        color: oscura ? GOLD : 'secondary.main', backgroundColor: oscura ? 'rgba(255,255,255,0.08)' : 'rgba(222, 199, 43, 0.1)',
      }}>
        <icono.Icono />
      </Box>
    )

  const textos = (
    <Box sx={{ p: foto ? { xs: 3, md: 3.5 } : 0, textAlign: centrada ? 'center' : 'left', minWidth: 0 }}>
      <Typography variant="h6" component="h3" sx={{ mb: 1, color: oscura ? '#fff' : estilo === 'papel' ? '#1b1c1a' : 'text.primary' }}>{tarjeta.titulo}</Typography>
      <Typography variant="body2" sx={{ color: oscura ? 'rgba(255,255,255,0.8)' : estilo === 'papel' ? '#4a454a' : 'text.secondary', lineHeight: 1.6 }}>{tarjeta.descripcion}</Typography>
    </Box>
  )

  const contenido = (
    <Box sx={{
      display: 'flex', height: '100%',
      flexDirection: horizontal ? { xs: 'column', sm: 'row' } : 'column',
      alignItems: horizontal && !foto ? 'flex-start' : 'stretch', gap: horizontal && !foto ? 2.5 : 0,
    }}>
      {media}
      {textos}
    </Box>
  )

  // Con foto, la foto llega al borde de la tarjeta: sin relleno fuera, con relleno en los textos.
  const relleno = foto ? { p: 0, overflow: 'hidden' } : { p: 4 }
  const recuadro = (realce: boolean) => estilo === 'cristal'
    ? (
      <TarjetaCristal sx={{ ...relleno, height: '100%', ...(realce && { '&:hover': { borderColor: 'rgba(193, 172, 0, 0.3)', transform: 'translateY(-4px)' } }) }}>
        {contenido}
      </TarjetaCristal>
    )
    : (
      <Box sx={{ ...FONDOS[estilo], ...relleno, height: '100%', transition: 'all 0.3s ease', ...(realce && { '&:hover': { borderColor: GOLD, transform: 'translateY(-4px)' } }) }}>
        {contenido}
      </Box>
    )

  // Un enlace guardado antes de que el CMS solo dejara elegir páginas que
  // existen puede llevar a ninguna parte: mejor una tarjeta informativa que
  // una que promete y acaba en «página no encontrada».
  if (!tarjeta.enlace || !esDestinoValido(tarjeta.enlace)) return recuadro(false)

  return (
    <Box component={Link} to={tarjeta.enlace} sx={{ display: 'block', height: '100%', textDecoration: 'none', color: 'inherit' }}>
      {recuadro(true)}
    </Box>
  )
}

/** El rosa de la caridad en Nuestros fines: los números de las tarjetas numeradas. */
const ROSA = '#fc858a'

/**
 * Tarjetas numeradas: sin recuadro, en columnas separadas por un filete fino,
 * cada una con su número grande (01, 02…) encima del título. Una lista de lo
 * que se hace, que se lee de izquierda a derecha. Ni foto ni icono: el número
 * hace de icono. En el móvil, una debajo de otra con el filete arriba.
 */
function Numeradas({ bloque }: { bloque: Datos }) {
  const cuantas = bloque.tarjetas.length
  const eleccion = valorDe(bloque, 'columnas')
  const porFila = eleccion === 'auto' ? Math.min(cuantas, 4) : Number(eleccion)
  const centrada = valorDe(bloque, 'alineacion') === 'centro'
  return (
    <Box component="ol" sx={{
      // El ancho de las dos puertas, que en Caridad van justo encima.
      listStyle: 'none', m: 0, p: 0, maxWidth: anchoMaximo(bloque, '1100px'), mx: 'auto',
      display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${porFila}, minmax(0, 1fr))` },
    }}>
      {bloque.tarjetas.map((tarjeta, indice) => {
        const enlace = tarjeta.enlace && esDestinoValido(tarjeta.enlace) ? tarjeta.enlace : ''
        const contenido = (
          <>
            <Typography component="span" aria-hidden sx={{ display: 'block', fontFamily: SERIF, fontSize: { xs: 38, md: 44 }, lineHeight: 1, fontWeight: 300, color: ROSA, mb: 1.5 }}>
              {String(indice + 1).padStart(2, '0')}
            </Typography>
            <Typography variant="h6" component="h3" sx={{ mb: 1, color: 'text.primary' }}>{tarjeta.titulo}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{tarjeta.descripcion}</Typography>
          </>
        )
        return (
          <Box component="li" key={indice} sx={{
            pt: 3.5, pb: { xs: 3.5, md: 0 }, textAlign: centrada ? 'center' : 'left',
            borderColor: 'divider',
            // En el móvil, un filete entre una y otra; en escritorio, entre columnas.
            // La primera y la última de cada fila van al ras de los bordes.
            borderTop: { xs: indice === 0 ? 0 : '1px solid', md: 0 },
            borderLeft: { md: indice % porFila === 0 ? 0 : '1px solid' },
            pl: { md: indice % porFila === 0 ? 0 : 3.5 }, pr: { md: indice % porFila === porFila - 1 ? 0 : 3.5 },
          }}>
            {enlace ? (
              <Box component={Link} to={enlace} sx={{ display: 'block', textDecoration: 'none', color: 'inherit', '&:hover h3': { color: GOLD } }}>{contenido}</Box>
            ) : contenido}
          </Box>
        )
      })}
    </Box>
  )
}
