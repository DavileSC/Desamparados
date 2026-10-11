import { Box, Typography } from '@mui/material'
import type { FichaEnLaProcesion, SalidaDelHermano } from '../../../lib/api/procesion'
import { site } from '../../../config/site'
import { BURDEOS, CREMA, FILETE, GRIS, NEGRO, ORO, SERIFA, imagenDelQr } from './papeleta-estilo'

/**
 * La papeleta en el móvil: lo que el hermano enseña en la puerta del templo.
 * Es la maqueta «Tarjeta» elegida el 30-09-2026, negra y oro como la portada
 * del Informe anual, y no sigue el tema claro u oscuro de la web: es un
 * documento, se ve igual siempre. El QR va sobre crema y grande, para que el
 * lector lo coja a la primera con el brillo de la pantalla bajo.
 *
 * Solo en pantalla, sin descarga: quien la quiera en papel tiene el A4 que se
 * le dio en la mesa y que le llegó por correo.
 */

const etiqueta = { fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRIS } as const

export default function TarjetaPapeleta({ ficha, salida }: { ficha: FichaEnLaProcesion; salida: SalidaDelHermano }) {
  const papeleta = ficha.porSalida[salida.salida].papeleta
  if (!papeleta?.qr) return null
  const nombre = `${ficha.nombre} ${ficha.apellidos}`
  const celdas: [string, string][] = [
    ['Entrada', salida.evento.horaSalida],
    ['Acceso', salida.evento.accesoPuerta],
    ...(papeleta.tunica ? [['Túnica', papeleta.tunica] as [string, string]] : []),
  ]

  return (
    <Box
      component="article"
      aria-label={`Papeleta de ${nombre}`}
      sx={{ width: '100%', maxWidth: 400, bgcolor: NEGRO, color: CREMA, display: 'flex', flexDirection: 'column', pt: 2.75, px: 3, borderRadius: 1, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box component="img" src={site.imagenes.escudoDestacado} alt="" sx={{ width: 38, height: 46, objectFit: 'contain' }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: ORO, fontWeight: 600 }}>Papeleta de sitio</Typography>
          <Typography sx={{ fontFamily: SERIFA, fontSize: 18, lineHeight: 1.2 }}>{salida.nombre} · {papeleta.year}</Typography>
        </Box>
        <Typography sx={{ fontSize: 12, color: GRIS, fontVariantNumeric: 'tabular-nums' }}>{papeleta.referencia}</Typography>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography sx={{ fontFamily: SERIFA, fontSize: 22, lineHeight: 1.15 }}>{nombre}</Typography>
        {ficha.numeroHermano && <Typography sx={{ fontSize: 12.5, color: GRIS }}>Hermano n.º {ficha.numeroHermano}</Typography>}
      </Box>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ bgcolor: CREMA, p: 1.75, display: 'flex' }}>
          <Box
            component="img"
            src={imagenDelQr(papeleta.qr.svg)}
            alt={`Código QR de la papeleta ${papeleta.referencia}`}
            sx={{ width: 180, height: 180, display: 'block', imageRendering: 'pixelated' }}
          />
        </Box>
      </Box>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography sx={{ fontFamily: SERIFA, fontSize: 30, lineHeight: 1.05, color: ORO }}>{papeleta.puesto}</Typography>
        {papeleta.tramo && <Typography sx={{ fontSize: 14 }}>{papeleta.tramo}</Typography>}
      </Box>

      <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: `repeat(${celdas.length}, minmax(0, 1fr))`, borderTop: `1px solid ${FILETE}`, borderBottom: `1px solid ${FILETE}` }}>
        {celdas.map(([rotulo, valor], i) => (
          <Box key={rotulo} sx={{ py: 1.25, pl: i === 0 ? 0 : 1, pr: 1, borderLeft: i === 0 ? 0 : `1px solid ${FILETE}` }}>
            <Typography sx={etiqueta}>{rotulo}</Typography>
            <Typography sx={{ fontSize: 13.5, fontWeight: 500 }}>{valor}</Typography>
          </Box>
        ))}
      </Box>

      <Typography sx={{ py: 1.75, fontSize: 12, color: GRIS, textAlign: 'center', lineHeight: 1.45 }}>
        Enséñala en la puerta junto a tu DNI · Personal e intransferible
      </Typography>
      <Box sx={{ height: 4, mx: -3, bgcolor: BURDEOS }} />
    </Box>
  )
}
