import { useId } from 'react'
import { Paper, Stack, Typography } from '@mui/material'
import CampoTexto from '../contenido/CampoTexto'
import type { Tesela } from './useEdicionDePortada'


/**
 * Un acceso del mosaico, bajo su nombre actual: es lo único que lo distingue en
 * esta pantalla, porque el destino y el icono los pone el código
 * (features/inicio/AccesosRapidos.tsx) y no se editan desde aquí.
 */
export default function EdicionTesela({ tesela, onCambio }: { tesela: Tesela; onCambio: (cambios: Partial<Tesela>) => void }) {
  const id = useId()
  const nombre = tesela.titulo.trim() || 'Acceso sin nombre'

  return (
    <Paper variant="outlined" role="group" aria-labelledby={id} sx={{ p: 2 }}>
      <Typography id={id} variant="subtitle2" sx={{ mb: 1.5 }}>{nombre}</Typography>
      <Stack spacing={2}>
        <CampoTexto
          etiqueta="Título"
          valor={tesela.titulo}
          onCambio={(titulo) => onCambio({ titulo })}
          maxLength={120}
          ayuda="El nombre del acceso, en grande dentro de la tesela."
        />
        <CampoTexto
          etiqueta="Descripción"
          valor={tesela.descripcion}
          onCambio={(descripcion) => onCambio({ descripcion })}
          maxLength={600}
          ayuda="La línea pequeña bajo el nombre."
        />
      </Stack>
    </Paper>
  )
}

