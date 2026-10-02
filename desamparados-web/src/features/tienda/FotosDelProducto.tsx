import { useState } from 'react'
import { Box, ButtonBase, useMediaQuery, useTheme } from '@mui/material'
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined'
import VisorGaleria from '../../components/galeria/VisorGaleria'
import { useMedidas } from '../../components/galeria/formato'
import type { Producto } from '../../lib/api/tienda'

/**
 * La foto de un producto en la tienda. Al pulsarla se abre el visor de las
 * galerías de la web con todas las suyas (la principal y las de más), a
 * pantalla completa: quien compra quiere ver el reverso, un detalle, el
 * tamaño en la mano.
 */
export default function FotosDelProducto({ producto }: { producto: Producto }) {
  const [abierta, setAbierta] = useState<number | null>(null)
  const theme = useTheme()
  const escritorio = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const { medir, medidaDe } = useMedidas()

  if (!producto.foto) return <Box sx={{ width: '100%', aspectRatio: '4 / 3', bgcolor: 'action.hover' }} />

  const medios = [
    { tipo: 'foto' as const, url: producto.foto, portada: '', alt: producto.nombre, pie: '' },
    ...producto.fotos.map((f, i) => ({ tipo: 'foto' as const, url: f.url, portada: '', alt: f.pie || `${producto.nombre}, foto ${i + 2}`, pie: f.pie })),
  ]
  const varias = medios.length > 1

  return (
    <>
      <ButtonBase
        onClick={() => setAbierta(0)}
        aria-label={varias ? `Ver las ${medios.length} fotos de ${producto.nombre}` : `Ampliar la foto de ${producto.nombre}`}
        sx={{
          display: 'block', width: '100%', position: 'relative', overflow: 'hidden', cursor: 'zoom-in',
          '& img': { transition: 'transform 400ms ease' },
          '&:hover img, &.Mui-focusVisible img': { transform: 'scale(1.04)' },
          '&.Mui-focusVisible': { outline: '2px solid #dec72b', outlineOffset: -2 },
        }}
      >
        <Box component="img" src={producto.foto} alt={producto.nombre} loading="lazy" sx={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />
        {varias && (
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute', right: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.25, borderRadius: 4, bgcolor: 'rgba(12, 11, 13, 0.72)', color: '#fff', fontSize: 13, fontWeight: 600,
            }}
          >
            <PhotoLibraryOutlinedIcon sx={{ fontSize: 16 }} />{medios.length}
          </Box>
        )}
      </ButtonBase>
      <VisorGaleria
        medios={medios}
        actual={abierta}
        onIr={setAbierta}
        onCerrar={() => setAbierta(null)}
        reproduciendo={[]}
        onReproducir={() => {}}
        medidaDe={medidaDe}
        medir={medir}
        escritorio={escritorio}
      />
    </>
  )
}
