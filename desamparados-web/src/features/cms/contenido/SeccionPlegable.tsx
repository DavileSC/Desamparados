import type { ReactNode } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

/**
 * Un bloque de la portada o del recorrido dentro de la pantalla de edición.
 * Van plegados porque son varios y unos treinta campos entre todos: abiertos
 * de golpe, encontrar el texto que se viene a cambiar exige recorrer la
 * pantalla entera.
 *
 * El `Accordion` de MUI ya pone `aria-expanded` en el botón del resumen, así
 * que quien no ve la pantalla sabe si la sección está abierta.
 */
export default function SeccionPlegable(
  { titulo, abiertaPorDefecto = false, children }:
  { titulo: string; abiertaPorDefecto?: boolean; children: ReactNode },
) {
  return (
    <Accordion defaultExpanded={abiertaPorDefecto} disableGutters variant="outlined" sx={{ mb: 1.5 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 600 }}>{titulo}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2.5} sx={{ pt: 1 }}>{children}</Stack>
      </AccordionDetails>
    </Accordion>
  )
}
