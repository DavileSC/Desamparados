import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useBlocker } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { useAvisoAlCerrarLaPestana } from '../../../hooks/useAvisoAlCerrarLaPestana'
import ApartadoContrasena from './ApartadoContrasena'
import AvisosEnElMovil from './AvisosEnElMovil'
import { ApartadoMisDatos } from './MisDerechos'
import { site } from '../../../config/site'

/**
 * Lo de la cuenta, no de una ficha: los avisos en el móvil, la contraseña y
 * los derechos sobre los datos. Era la última pestaña de «Mi perfil»; desde el
 * 16-10-2026 tiene su sitio en el menú, encima de «Cerrar sesión», y el perfil
 * se queda con la ficha.
 */
export default function CuentaPage() {
  // Con algo escrito en la contraseña, salir de aquí lo tiraba sin avisar.
  const [sucio, setSucio] = useState(false)
  const bloqueo = useBlocker(({ currentLocation, nextLocation }) => sucio && currentLocation.pathname !== nextLocation.pathname)
  useAvisoAlCerrarLaPestana(sucio)

  return (
    <>
      <Helmet><title>{`Cuenta y contraseña | ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <DialogoConfirmacion
        abierto={bloqueo.state === 'blocked'}
        titulo="Hay cambios sin guardar"
        mensaje="Si sales ahora se va a perder lo que has escrito en la contraseña."
        textoConfirmar="Salir sin guardar"
        textoCancelar="Seguir editando"
        peligro
        onConfirmar={() => bloqueo.proceed?.()}
        onCancelar={() => bloqueo.reset?.()}
      />
      <SeccionAnimada sx={{ py: { xs: 1, md: 0 } }}>
        <ContenedorDePagina sx={{ px: { xs: 0, md: 0 } }}>
          <Typography variant="h3" component="h1" sx={{ mb: 3 }}>Cuenta y contraseña</Typography>
          <Box sx={{ maxWidth: 760, display: 'grid', gap: 2 }}>
            <AvisosEnElMovil />
            <ApartadoContrasena onSucio={setSucio} />
            <ApartadoMisDatos />
          </Box>
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
