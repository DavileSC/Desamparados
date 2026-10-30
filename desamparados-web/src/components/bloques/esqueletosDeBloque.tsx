import { Box } from '@mui/material'
import Hueso, { Lineas } from '../esqueleto/Hueso'
import ContenedorDePagina from '../ContenedorDePagina'
import CalendarioDeCultosEsqueleto from '../../features/actualidad/agenda/CalendarioDeCultosEsqueleto'

/*
 * Los esqueletos de los bloques que abren algunas páginas y no se parecen al
 * párrafo del esqueleto común (ver `BloquesEsqueleto`). Cada uno copia las
 * medidas de su bloque, no su dibujo: lo que importa es que al llegar no se
 * mueva nada en la primera pantalla.
 */

const NOCHE = '#0a090b'

/** El título de un bloque (`TituloDeSeccion`) con algo a su derecha, como el «Suscribirse» de la Agenda. */
function TituloConAccion() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, mb: 4 }}>
      <Hueso sx={{ width: { xs: 220, md: 420 }, height: { xs: 32, md: 44 } }} />
      <Hueso sx={{ width: { xs: 120, md: 190 }, height: 40, borderRadius: 1 }} />
    </Box>
  )
}

/** La Agenda: su título con la suscripción y la hoja del calendario. */
export function AgendaEsqueleto() {
  return (
    <>
      <TituloConAccion />
      <CalendarioDeCultosEsqueleto />
    </>
  )
}

/** Las rayas de un título grande y un párrafo, sobre fondo oscuro. */
function TextoSobreFoto({ lineasDeTitulo }: { lineasDeTitulo: number }) {
  return (
    <Box sx={{ width: '100%', maxWidth: 460 }}>
      <Box sx={{ mb: 1.5 }}><Lineas anchos={['30%']} linea={20} grosor={9} /></Box>
      <Box sx={{ mb: 2.5 }}>
        <Lineas anchos={['92%', '78%', '64%'].slice(0, lineasDeTitulo)} linea={{ xs: 40, md: 57 }} grosor={{ xs: 26, md: 38 }} />
      </Box>
      <Lineas anchos={['100%', '96%', '88%', '52%']} linea={29} grosor={10} />
    </Box>
  )
}

/**
 * La foto fundida de Foto y texto (Cultos): a sangre, la foto en tres cuartos
 * del ancho por su lado y el texto en el otro; en el móvil, el texto abajo.
 */
export function FotoFundidaEsqueleto({ derecha = true }: { derecha?: boolean }) {
  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', backgroundColor: NOCHE, mx: 'calc(50% - 50vw)', minHeight: { xs: 520, md: 560 }, display: 'flex', alignItems: { xs: 'flex-end', md: 'center' } }}>
      <Box sx={{ position: 'absolute', top: 0, bottom: 0, [derecha ? 'right' : 'left']: 0, width: { xs: '100%', md: '75%' } }}>
        <Hueso sx={{ width: '100%', height: '100%', borderRadius: 0 }} />
      </Box>
      <ContenedorDePagina sx={{ position: 'relative', width: '100%', py: { xs: 5, md: 8 }, display: 'flex', justifyContent: derecha ? 'flex-start' : 'flex-end' }}>
        <TextoSobreFoto lineasDeTitulo={3} />
      </ContenedorDePagina>
    </Box>
  )
}

/** El telón de Foto fija (Trono): la foto del alto de la pantalla, con el texto de la primera parte a un lado. */
export function TelonEsqueleto() {
  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', backgroundColor: NOCHE, borderRadius: 1.5, height: '100svh', display: 'flex', alignItems: { xs: 'flex-end', md: 'center' } }}>
      <Box sx={{ position: 'absolute', inset: 0, left: { md: '30%' } }}>
        <Hueso sx={{ width: '100%', height: '100%', borderRadius: 0 }} />
      </Box>
      <Box sx={{ position: 'relative', width: '100%', px: { xs: 2.5, md: 9 }, pb: { xs: 7, md: 0 } }}>
        <TextoSobreFoto lineasDeTitulo={1} />
      </Box>
    </Box>
  )
}

/** Los tres fines en foco (Nuestros fines): su ceja, la franja de las tres palabras grandes y el texto debajo, en dos columnas. */
export function FinesEnFocoEsqueleto() {
  const raya = '1px solid rgba(255,255,255,0.08)'
  return (
    <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
      <Lineas anchos={['42%']} linea={{ xs: 20, md: 25 }} grosor={10} />
      <Box sx={{ mt: { xs: 3, md: 5 }, py: { xs: 3, md: 6 }, borderTop: raya, borderBottom: raya, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', gap: { xs: 1.5, md: 2 } }}>
        {['26%', '30%', '36%'].map((ancho) => (
          <Box key={ancho} sx={{ px: { xs: 1.5, md: 2.5 }, py: 0.75, width: { xs: '70%', md: ancho } }}>
            <Hueso sx={{ height: { xs: 44, sm: 60, md: 'min(84px, 6.2vw)', lg: 'min(108px, 7vw)' } }} />
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: { xs: 4, md: 7 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: 4, md: 12 } }}>
        <Lineas anchos={['100%', '95%', '60%']} linea={{ xs: 30.6, md: 37.4 }} grosor={12} />
        <Box sx={{ pl: { xs: 2.5, md: 5 }, borderLeft: raya }}>
          <Box sx={{ mb: 2.5 }}><Lineas anchos={['34%']} linea={20} grosor={9} /></Box>
          <Lineas anchos={['100%', '94%', '72%']} linea={33} grosor={11} />
        </Box>
      </Box>
    </Box>
  )
}

/** El dibujo con su texto (Parroquia): el título y el texto a un lado, el dibujo al otro. */
export function DibujoEsqueleto({ derecha = true }: { derecha?: boolean }) {
  return (
    <Box sx={{ maxWidth: '1150px', mx: 'auto', display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '1fr 1fr' }, gap: { xs: 4, md: 8 }, alignItems: 'center' }}>
      <Box sx={{ order: { md: derecha ? 0 : 1 } }}>
        <Box sx={{ mb: 2.5 }}><Lineas anchos={['60%']} linea={{ xs: 38, md: 58 }} grosor={{ xs: 24, md: 34 }} /></Box>
        <Lineas anchos={['100%', '97%', '92%', '98%', '60%']} linea={30.6} grosor={10} />
      </Box>
      <Hueso sx={{ aspectRatio: '4 / 3', width: '100%', maxWidth: { xs: 320, md: 'none' }, mx: 'auto' }} />
    </Box>
  )
}
