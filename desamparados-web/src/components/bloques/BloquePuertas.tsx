import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, ButtonBase, Typography } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import { SERIF } from '../../features/inicio/estilos'
import { esDestinoValido } from '../../lib/destinos'
import { BOTON } from '../estiloDeBoton'
import { anchoMaximo } from './presentacion'
import type { BloquePuertas as Datos, DatoDePuerta, Puerta } from '../../lib/api/contenido'

/**
 * El acento y el botón de cada puerta, en orden: la primera en oro con el
 * botón de filete dorado (la de quien busca ayuda) y la segunda en rosa con el granate
 * (la de quien quiere darla), el mismo rosa de la caridad en Nuestros fines.
 */
const ACENTOS = ['#dec72b', '#fc858a'] as const
const BOTONES = [BOTON.claro, BOTON.principal] as const

/** El recuadro de las puertas: el de la paleta Noche, para que se lea igual sobre cualquier fondo. */
const RECUADRO = '#1a181b'
const FILETE = 'rgba(255, 255, 255, 0.09)'

/**
 * Dos puertas: dos paneles, uno al lado del otro, para dos lectores que
 * llegan a la misma página buscando cosas distintas —en Caridad, quien
 * necesita ayuda y quien quiere darla—. Cada uno con su ceja, su título, un
 * texto, unos datos a la vista (el despacho, la dirección, el Bizum) y un botón.
 *
 * Un dato sin valor no se pinta: así el del donativo espera en el CMS sin dejar
 * un hueco. Uno copiable lleva al lado un botón que lo copia. En el móvil, una
 * puerta debajo de la otra.
 */
export default function BloquePuertas({ bloque }: { bloque: Datos }) {
  return (
    <Box sx={{
      maxWidth: anchoMaximo(bloque, '1100px'), mx: 'auto',
      display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 2.5, md: 3 },
    }}>
      {bloque.puertas.map((puerta, i) => (
        <PanelDePuerta key={i} puerta={puerta} acento={ACENTOS[i]} boton={BOTONES[i]} />
      ))}
    </Box>
  )
}

function PanelDePuerta({ puerta, acento, boton }: { puerta: Puerta; acento: string; boton: object }) {
  const datos = puerta.datos.filter((dato) => dato.valor.trim() !== '')
  const conBoton = puerta.boton.trim() !== '' && esDestinoValido(puerta.enlace)
  return (
    <Box component="section" aria-label={puerta.titulo} sx={{
      display: 'flex', flexDirection: 'column', gap: 2.25,
      p: { xs: 3.5, md: 5.5 }, pb: { md: 5 },
      backgroundColor: RECUADRO, color: '#ffffff', borderTop: `3px solid ${acento}`, borderRadius: '2px',
    }}>
      {puerta.ceja && (
        <Typography component="span" sx={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: acento }}>
          {puerta.ceja}
        </Typography>
      )}
      <Typography component="h3" sx={{ fontFamily: SERIF, fontSize: { xs: 30, md: 36 }, lineHeight: 1.1, color: '#ffffff' }}>
        {puerta.titulo}
      </Typography>
      {puerta.texto && (
        <Typography sx={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(255, 255, 255, 0.82)' }}>{puerta.texto}</Typography>
      )}
      {datos.length > 0 && (
        <Box component="dl" sx={{
          m: 0, py: 2.25, borderTop: `1px solid ${FILETE}`, borderBottom: `1px solid ${FILETE}`,
          // Cada columna mide lo que su dato, y encoge si no cabe: una dirección no se parte por el número.
          display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${datos.length}, minmax(0, max-content))` }, gap: { xs: 2, sm: 5 },
        }}>
          {datos.map((dato, j) => <Dato key={j} dato={dato} acento={acento} />)}
        </Box>
      )}
      {conBoton && (
        <Box sx={{ mt: 'auto', pt: 1 }}>
          <Box component={Link} to={puerta.enlace} sx={{ ...boton, fontFamily: 'inherit' }}>
            {puerta.boton} <ArrowForwardIcon aria-hidden sx={{ fontSize: 18 }} />
          </Box>
        </Box>
      )}
    </Box>
  )
}

function Dato({ dato, acento }: { dato: DatoDePuerta; acento: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = () => {
    navigator.clipboard?.writeText(dato.valor).then(() => {
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    }, () => setCopiado(false))
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Typography component="dt" sx={{ fontSize: 11.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)' }}>
        {dato.etiqueta}
      </Typography>
      <Typography component="dd" sx={{ m: 0, fontSize: 17, color: dato.copiable ? acento : '#ffffff', overflowWrap: 'anywhere' }}>
        {dato.valor}
      </Typography>
      {dato.nota && (
        <Typography component="dd" sx={{ m: 0, fontSize: 15, color: 'rgba(255, 255, 255, 0.7)' }}>{dato.nota}</Typography>
      )}
      {dato.copiable && (
        <Box component="dd" sx={{ m: 0 }}>
          <ButtonBase onClick={copiar} aria-label={copiado ? `${dato.etiqueta}: copiado` : `Copiar ${dato.etiqueta.toLowerCase()}`} sx={{
            mt: 0.5, gap: 0.75, minHeight: 36, px: 1.25, ml: -1.25, borderRadius: '4px', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
            color: acento, '&:hover': { color: '#ffffff' },
            '&:focus-visible': { outline: `2px solid ${acento}`, outlineOffset: '2px' },
          }}>
            {copiado ? <CheckIcon sx={{ fontSize: 16 }} aria-hidden /> : <ContentCopyIcon sx={{ fontSize: 16 }} aria-hidden />}
            <span aria-live="polite">{copiado ? 'Copiado' : 'Copiar'}</span>
          </ButtonBase>
        </Box>
      )}
    </Box>
  )
}
