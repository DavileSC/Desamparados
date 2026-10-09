import { useState } from 'react'
import { Box, Button, Collapse, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import Boton from '../../../components/Boton'
import TarjetaCristal from '../../../components/TarjetaCristal'
import type { ApiProfile } from '../../../lib/api/perfil'
import { aniosCumplidos } from '../../altas/public/schema'
import { Contacto, DatosPersonales, VidaCofrade } from '../perfil/apartados'
import { ESTADO_CIVIL, SEXO, aDia, diaLegible } from '../perfil/etiquetas'
import CamposDeFicha from './CamposDeFicha'
import { enUnaFrase, estaVacio, faltanDeTusDatos, opcionalesVacios } from './obligatorios'

const FALTA = Symbol('falta')
type Fila = [etiqueta: string, valor: string | null | typeof FALTA]

/**
 * El primer paso de la revisión: datos personales, contacto y bautismo en una
 * sola ficha de lectura. Solo enseña lo que tiene valor; lo obligatorio que
 * falta se pide arriba, campo a campo, y sin ello no se puede dar por bueno;
 * lo opcional vacío queda plegado, a su elección. «Hay algo que cambiar» abre
 * los apartados de «Mi perfil», con su lápiz cada uno.
 */
export default function PasoTusDatos({ ficha, onGuardada, onSi, cambiado }: {
  ficha: ApiProfile
  onGuardada: (ficha: ApiProfile) => void
  onSi: () => void
  cambiado: boolean
}) {
  const [cambiando, setCambiando] = useState(false)
  const [masAbierto, setMasAbierto] = useState(false)
  const faltan = faltanDeTusDatos(ficha)
  const opcionales = opcionalesVacios(ficha)

  if (cambiando) {
    return (
      <>
        <Box sx={{ display: 'grid', gap: 2.5 }}>
          <DatosPersonales ficha={ficha} onGuardada={onGuardada} />
          <Contacto ficha={ficha} onGuardada={onGuardada} />
          <VidaCofrade ficha={ficha} onGuardada={onGuardada} />
        </Box>
        <Boton onClick={() => setCambiando(false)} sx={{ alignSelf: { sm: 'flex-start' }, py: 1.75, px: 4 }}>Hecho, volver al resumen</Boton>
      </>
    )
  }

  const o = (campo: keyof ApiProfile, valor: string | null): Fila[1] => (estaVacio(ficha, campo) && faltan.some((c) => c.campo === campo) ? FALTA : valor)
  const edad = ficha.fechaNacimiento ? aniosCumplidos(aDia(ficha.fechaNacimiento)) : null
  const quien: Fila[] = [
    ['Nombre', [ficha.nombre, ficha.apellidos].filter(Boolean).join(' ')],
    ['DNI', o('dni', ficha.dni)],
    ['Nacimiento', o('fechaNacimiento', ficha.fechaNacimiento ? `${diaLegible(ficha.fechaNacimiento)}${edad !== null ? ` · ${edad} años` : ''}` : null)],
    ['Natural de', ficha.lugarNacimiento],
    ['Sexo', o('sexo', ficha.sexo ? SEXO[ficha.sexo] : null)],
    ['Estado civil', o('estadoCivil', ficha.estadoCivil ? ESTADO_CIVIL[ficha.estadoCivil] : null)],
    ['Profesión', ficha.profesion],
    ['Bautismo', o('fechaBautismo', ficha.fechaBautismo ? [diaLegible(ficha.fechaBautismo), ficha.parroquiaBautismo ?? ficha.lugarBautismo].filter(Boolean).join(' · ') : null)],
  ]
  const donde: Fila[] = [
    ['Correo', o('email', ficha.email)],
    ['Segundo correo', ficha.email2],
    ['Móvil', o('telefono', ficha.telefono)],
    ['Fijo', ficha.telefonoFijo],
    ['Domicilio', o('direccion', ficha.direccion)],
    ['Localidad', faltan.some((c) => c.campo === 'codigoPostal' || c.campo === 'poblacion') ? FALTA : [ficha.codigoPostal, ficha.poblacion].filter(Boolean).join(' ') + (ficha.provincia && ficha.provincia !== ficha.poblacion ? ` (${ficha.provincia})` : '')],
  ]

  return (
    <>
      {faltan.length > 0 && (
        <TarjetaCristal component="section" aria-label="Datos que faltan" sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2, border: '1px solid', borderColor: 'warning.main' }}>
          <Box>
            <Typography sx={{ fontWeight: 600, color: 'warning.light' }}>
              {faltan.length === 1 ? `Nos falta tu ${enUnaFrase(faltan)}` : `Nos faltan algunos datos: ${enUnaFrase(faltan)}`}
            </Typography>
            <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>El censo no los traía y la Secretaría los necesita. Rellénalos y guarda para seguir.</Typography>
          </Box>
          <CamposDeFicha key={faltan.map((c) => c.campo).join()} ficha={ficha} campos={faltan} onGuardada={onGuardada} />
        </TarjetaCristal>
      )}

      <TarjetaCristal component="section" aria-label="Tu ficha" sx={{ p: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
          <Grupo titulo="Quién eres" filas={quien} />
          <Grupo titulo="Dónde localizarte" filas={donde} borde />
        </Box>
        <Box sx={{ borderTop: 1, borderColor: 'divider', px: { xs: 2, md: 3 }, py: 1.75, display: 'flex', flexWrap: 'wrap', gap: { xs: 0.75, md: '8px 28px' }, flexDirection: { xs: 'column', md: 'row' }, fontSize: 15, color: 'text.secondary' }}>
          <span>Boletín por correo: <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>{ficha.boletin ? 'Sí' : 'No'}</Box></span>
          <span>Publicar fotos en que aparezcas: <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>{ficha.autorizaImagen ? 'Sí' : 'No'}</Box></span>
        </Box>
        {opcionales.length > 0 && (
          <Box sx={{ borderTop: 1, borderColor: 'divider', px: { xs: 1, md: 1.5 }, py: 0.5 }}>
            <Button
              onClick={() => setMasAbierto((a) => !a)}
              aria-expanded={masAbierto}
              startIcon={masAbierto ? <RemoveIcon /> : <AddIcon />}
              sx={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', minHeight: 48, color: 'text.secondary', textTransform: 'none', letterSpacing: 0, fontSize: 15, fontWeight: 500, '& .MuiButton-startIcon': { color: 'secondary.light' } }}
            >
              Puedes añadir también (opcional): {enUnaFrase(opcionales)}
            </Button>
            <Collapse in={masAbierto} unmountOnExit>
              <Box sx={{ px: 1, pt: 1, pb: 2 }}>
                <CamposDeFicha key={opcionales.map((c) => c.campo).join()} ficha={ficha} campos={opcionales} opcionales onGuardada={onGuardada} />
              </Box>
            </Collapse>
          </Box>
        )}
      </TarjetaCristal>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {cambiado && <Typography role="status" sx={{ fontSize: 14, color: 'success.light' }}>Guardado. Comprueba que ahora está bien.</Typography>}
        <Typography component="p" sx={{ fontSize: 18, fontWeight: 600 }}>¿Está todo bien?</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <Boton onClick={onSi} disabled={faltan.length > 0} sx={{ py: 1.75, fontSize: 16 }}>
            {faltan.length > 0 ? 'Sí, es correcto · antes, lo que falta' : 'Sí, es correcto'}
          </Boton>
          <Boton appVariant="outline" onClick={() => setCambiando(true)} sx={{ py: 1.75, fontSize: 16 }}>Hay algo que cambiar</Boton>
        </Box>
      </Box>
    </>
  )
}

function Grupo({ titulo, filas, borde = false }: { titulo: string; filas: Fila[]; borde?: boolean }) {
  return (
    <Box sx={{
      px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1.75,
      ...(borde ? { borderTop: { xs: 1, md: 0 }, borderLeft: { md: 1 }, borderColor: 'divider' } : {}),
    }}>
      <Typography component="h2" sx={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>{titulo}</Typography>
      <Box component="dl" sx={{ m: 0, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {filas.filter(([, valor]) => valor === FALTA || (valor ?? '').trim() !== '').map(([etiqueta, valor]) => (
          <Box key={etiqueta}>
            <Typography component="dt" sx={{ fontSize: 13, color: 'text.secondary' }}>{etiqueta}</Typography>
            <Typography component="dd" sx={{ m: 0, mt: 0.25, fontSize: { xs: 16, md: 17 }, overflowWrap: 'anywhere', ...(valor === FALTA ? { color: 'warning.light' } : {}) }}>
              {valor === FALTA ? 'Falta' : valor}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
