import { Box, Checkbox, FormControlLabel, TextField, Typography, type SxProps, type Theme } from '@mui/material'
import { codigoPostalBueno, nifPareceBueno, type CertificadoPedido } from '../lib/certificado'

interface Props {
  valor: CertificadoPedido
  onChange: (c: CertificadoPedido) => void
  /** Los estilos de los campos y la casilla del formulario en el que va (el donativo es oscuro). */
  sxCampo?: SxProps<Theme>
  sxCasilla?: SxProps<Theme>
  /** Tras pulsar pagar con algo pendiente: marca también lo que está vacío, no solo lo mal escrito. */
  marcarVacios?: boolean
}

/**
 * «Quiero el certificado para la renta»: al marcarlo, los datos que pide
 * Hacienda. Lo usan el donativo y el apadrinamiento, que se pagan sin cuenta.
 */
export default function CamposCertificado({ valor, onChange, sxCampo, sxCasilla, marcarVacios = false }: Props) {
  const cambiar = (c: Partial<CertificadoPedido>) => onChange({ ...valor, ...c })
  const nifMal = valor.nif.trim() !== '' && !nifPareceBueno(valor.nif)
  const cpMal = valor.codigoPostal.trim() !== '' && !codigoPostalBueno(valor.codigoPostal)
  const vacio = (texto: string) => marcarVacios && texto.trim() === ''
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <FormControlLabel
        control={<Checkbox checked={valor.quiere} onChange={(e) => cambiar({ quiere: e.target.checked })} />}
        label="Quiero el certificado para desgravarlo en la renta"
        sx={sxCasilla}
      />
      {valor.quiere && <>
        <Typography variant="body2" sx={{ mt: -1, opacity: 0.8 }}>
          Hacienda pide estos datos para la deducción. Te mandaremos el certificado al correo cuando acabe el año.
        </Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField label="Nombre" value={valor.nombre} onChange={(e) => cambiar({ nombre: e.target.value })}
            error={vacio(valor.nombre)} helperText={vacio(valor.nombre) ? 'Falta el nombre.' : undefined} slotProps={{ htmlInput: { maxLength: 120, autoComplete: 'given-name' } }} sx={sxCampo} />
          <TextField label="Apellidos" value={valor.apellidos} onChange={(e) => cambiar({ apellidos: e.target.value })}
            error={vacio(valor.apellidos)} helperText={vacio(valor.apellidos) ? 'Faltan los apellidos.' : undefined} slotProps={{ htmlInput: { maxLength: 120, autoComplete: 'family-name' } }} sx={sxCampo} />
          <TextField label="NIF" value={valor.nif} onChange={(e) => cambiar({ nif: e.target.value.toUpperCase() })} error={nifMal || vacio(valor.nif)}
            helperText={nifMal ? 'Revisa el NIF: la letra no cuadra.' : vacio(valor.nif) ? 'Falta el NIF (DNI, NIE o CIF).' : 'DNI, NIE o CIF'} slotProps={{ htmlInput: { maxLength: 12, autoCapitalize: 'characters' } }} sx={sxCampo} />
          <TextField label="Código postal" value={valor.codigoPostal} onChange={(e) => cambiar({ codigoPostal: e.target.value })} error={cpMal || vacio(valor.codigoPostal)}
            helperText={cpMal || vacio(valor.codigoPostal) ? 'Un código postal español de cinco cifras.' : ' '} slotProps={{ htmlInput: { maxLength: 5, inputMode: 'numeric', autoComplete: 'postal-code' } }} sx={sxCampo} />
        </Box>
      </>}
    </Box>
  )
}
