import { useState, type ReactNode } from 'react'
import { ButtonBase, useMediaQuery, useTheme } from '@mui/material'
import VisorGaleria from '../galeria/VisorGaleria'
import { useMedidas } from '../galeria/formato'
import { MARCA } from '../../theme/marca'

/**
 * Una foto suelta que se abre a pantalla completa al pulsarla, con el mismo
 * visor que las galerías. Envuelve lo que ya pinta el bloque (la foto con su
 * marco y su recorte) en un botón.
 */
export default function FotoAmpliable({ url, alt, pie, children }: { url: string; alt: string; pie: string; children: ReactNode }) {
  const [abierta, setAbierta] = useState(false)
  const theme = useTheme()
  const escritorio = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const { medir, medidaDe } = useMedidas()
  const medios = [{ tipo: 'foto' as const, url, portada: '', alt, pie }]
  return (
    <>
      <ButtonBase
        onClick={() => setAbierta(true)}
        aria-label={`Ampliar la foto: ${alt}`}
        sx={{ display: 'block', width: '100%', cursor: 'zoom-in', '&.Mui-focusVisible': { outline: `2px solid ${MARCA.acento}`, outlineOffset: 3 } }}
      >
        {children}
      </ButtonBase>
      <VisorGaleria
        medios={medios}
        actual={abierta ? 0 : null}
        onIr={() => {}}
        onCerrar={() => setAbierta(false)}
        reproduciendo={[]}
        onReproducir={() => {}}
        medidaDe={medidaDe}
        medir={medir}
        escritorio={escritorio}
      />
    </>
  )
}
