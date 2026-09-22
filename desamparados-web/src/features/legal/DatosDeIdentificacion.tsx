import { Box, Typography } from '@mui/material'
import { site, legal, faltanDatosIdentificativos, DATO_PENDIENTE } from '../../config/site'

/**
 * Datos identificativos del responsable, comunes al aviso legal y a la
 * política de privacidad. Lee de `src/config/site.ts`: los campos que la
 * Grupo Parroquial aún no ha confirmado se muestran como pendientes y el aviso final
 * desaparece solo en cuanto se rellenan allí.
 */
export default function DatosDeIdentificacion() {
  const filas: Array<[string, string]> = [
    ['Denominación', legal(site.entidad.denominacion)],
    ['NIF', legal(site.entidad.nif)],
    ['Domicilio', site.entidad.domicilio ?? `${DATO_PENDIENTE} (${site.entidad.localidad})`],
    ['Correo de contacto', site.contacto.email],
  ]

  if (site.contacto.telefono) {
    filas.push(['Teléfono', site.contacto.telefono])
  }

  return (
    <>
      <Box component="dl" sx={{ m: 0, mb: 2 }}>
        {filas.map(([etiqueta, valor]) => (
          <Box key={etiqueta} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
            <Typography component="dt" sx={{ fontWeight: 600, minWidth: 170 }}>
              {etiqueta}:
            </Typography>
            <Typography component="dd" sx={{ m: 0 }}>
              {valor}
            </Typography>
          </Box>
        ))}
      </Box>

      {faltanDatosIdentificativos && (
        <Typography component="p" sx={{ mb: 2, fontStyle: 'italic' }}>
          Los datos marcados como «{DATO_PENDIENTE}» deben incorporarse antes de la publicación
          definitiva del sitio, conforme al artículo 10 de la Ley 34/2002 (LSSI-CE).
        </Typography>
      )}
    </>
  )
}
