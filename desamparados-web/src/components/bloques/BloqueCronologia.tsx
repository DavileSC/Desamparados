import { Box, Typography } from '@mui/material'
import { Revela } from '../SeccionAnimada'
import { GOLD, GRANATE, SERIF, ceja } from '../../features/inicio/estilos'
import { parrafosDe, type BloqueCronologia as Datos, type HitoHistoria } from '../../lib/api/contenido'
import { idDeHito } from './cronologia'

/** El fondo de la página: el hueco del punto del raíl se rellena con él. */
const FONDO = '#262326'
const FILETE = 'rgba(204, 196, 201, 0.22)'
/** Rosa claro del tema (`primary.light`): el granate puro no se lee sobre tinta. */
const GRANATE_CLARO = '#fc858a'

/** Lo que separa un hito del siguiente; la línea del raíl lo cruza. */
const HUECO = { xs: 7, md: 11 } as const
/** Dónde está el punto del raíl respecto al alto del periodo. */
const PUNTO_TOP = { xs: 14, md: 20 } as const

/** Color del periodo y del punto de cada hito según su tono. */
const TONOS = {
  ninguno: null,
  granate: { texto: GRANATE_CLARO, punto: { backgroundColor: GRANATE, borderColor: GRANATE_CLARO } },
  oro: { texto: GOLD, punto: { backgroundColor: GOLD, borderColor: GOLD } },
} as const

/**
 * La cronología: los hitos en orden, con el periodo a un lado, un raíl que los
 * une y el relato al otro.
 *
 * Nació dentro de la página de Historia y salió de ella al pasar Historia al
 * constructor de páginas: así se edita como un bloque más y se puede poner en
 * cualquier otra página. Historia la sigue envolviendo en su franja de tinta
 * velada; en las demás va tal cual, sobre el fondo de la página.
 *
 * `conAnclas` pone a cada hito el id al que enlaza el índice de la cabecera de
 * Historia. Solo lo pide Historia, y solo para su primera cronología: dos
 * bloques con anclas repetirían ids.
 */
export default function BloqueCronologia({ bloque, conAnclas = false }: { bloque: Datos; conAnclas?: boolean }) {
  return (
    <Box component="ol" aria-label={bloque.titulo || 'Cronología'} sx={{ listStyle: 'none', m: 0, p: 0, maxWidth: 1072, mx: 'auto' }}>
      {bloque.hitos.map((hito, indice) => (
        <HitoDeLaLinea
          // Clave posicional: un hito no tiene identificador, y ninguno de sus
          // elementos guarda estado propio que pudiera quedarse en otra fila.
          key={indice}
          hito={hito}
          id={conAnclas ? idDeHito(indice) : undefined}
          primero={indice === 0}
          ultimo={indice === bloque.hitos.length - 1}
        />
      ))}
    </Box>
  )
}

interface HitoDeLaLineaProps {
  hito: HitoHistoria
  id?: string
  primero: boolean
  ultimo: boolean
}

/**
 * Un hito de la cronología: el periodo, el raíl con su punto y el cuerpo. En
 * escritorio van en tres columnas; en móvil el periodo pasa encima del texto
 * y el raíl se pega al margen izquierdo.
 */
function HitoDeLaLinea({ hito, id, primero, ultimo }: HitoDeLaLineaProps) {
  const tono = TONOS[hito.tono] ?? null
  const parrafos = parrafosDe(hito.relato)

  return (
    <Revela
      as="li"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '24px minmax(0, 1fr)', md: '200px 40px minmax(0, 1fr)' },
        gridTemplateAreas: { xs: '"rail periodo" "rail cuerpo"', md: '"periodo rail cuerpo"' },
        columnGap: { xs: 2.5, md: 5 },
        rowGap: { xs: 2, md: 0 },
        pb: ultimo ? 0 : HUECO,
        scrollMarginTop: { xs: 80, md: 104 },
      }}
      id={id}
    >
      <Box sx={{ gridArea: 'periodo', textAlign: { md: 'right' }, pt: { md: '6px' } }}>
        <Typography
          component="span"
          sx={{ display: 'block', fontFamily: SERIF, fontSize: { xs: 40, md: 52 }, lineHeight: 1, letterSpacing: '-0.02em', color: tono?.texto ?? '#fff' }}
        >
          {hito.periodo}
        </Typography>
        <Typography component="span" sx={{ ...ceja, mb: 0, mt: { xs: 1, md: 1.75 }, letterSpacing: '0.22em' }}>
          {hito.etiqueta}
        </Typography>
      </Box>

      {/* El raíl: una línea que cruza todos los hitos y un punto por cada uno.
          La línea de cada hito llega hasta el hueco con el siguiente; la del
          primero arranca en su punto y la del último termina en el suyo. */}
      <Box
        aria-hidden="true"
        sx={{
          gridArea: 'rail',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: '50%',
            width: '1px',
            transform: 'translateX(-50%)',
            backgroundColor: FILETE,
            top: primero ? PUNTO_TOP : 0,
            bottom: ultimo ? 'auto' : { xs: -56, md: -88 },
            height: ultimo ? PUNTO_TOP : 'auto',
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: PUNTO_TOP,
            width: 13,
            height: 13,
            transform: 'translateX(-50%)',
            borderRadius: '50%',
            boxSizing: 'border-box',
            border: '2px solid #cbc5c8',
            backgroundColor: FONDO,
            ...tono?.punto,
          }}
        />
      </Box>

      <Box sx={{ gridArea: 'cuerpo' }}>
        {/* h3: el bloque cuelga de un h2 (su título, o el oculto «Cronología»
            de Historia), y cada hito es una parte de él. */}
        <Typography component="h3" sx={{ fontFamily: SERIF, fontSize: { xs: 26, md: 30 }, lineHeight: 1.2, letterSpacing: '-0.01em', mb: 2 }}>
          {hito.titulo}
        </Typography>
        {parrafos.map((parrafo, indice) => (
          <Typography key={indice} sx={{ color: 'text.secondary', fontSize: { xs: 16, md: 17 }, lineHeight: 1.75, maxWidth: '56ch', mb: 2.75, '&:last-of-type': { mb: 0 } }}>
            {parrafo}
          </Typography>
        ))}
        {hito.foto.url !== '' && (
          <Revela efecto="desvelar" retraso={0.2} sx={{ mt: 4 }}>
            <Box
              component="img"
              src={hito.foto.url}
              alt={hito.foto.alt}
              loading="lazy"
              decoding="async"
              sx={{ display: 'block', width: '100%', maxWidth: 560, aspectRatio: '560 / 340', objectFit: 'cover' }}
            />
            {hito.foto.pie !== '' && (
              <Typography component="span" sx={{ ...ceja, mb: 0, mt: 1.75, fontSize: 12, letterSpacing: '0.12em' }}>
                {hito.foto.pie}
              </Typography>
            )}
          </Revela>
        )}
      </Box>
    </Revela>
  )
}
