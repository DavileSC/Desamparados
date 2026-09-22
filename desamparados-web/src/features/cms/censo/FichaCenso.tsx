import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { Link } from 'react-router-dom'
import { fichaDeHermano, type FichaDeLaCuenta, type FichaDelCenso } from '../../../lib/api/hermanos'
import { urlDocumentoPrivado } from '../../../lib/api/cliente'
import { PARENTESCOS } from '../../../lib/api/auth'
import { ESTADO_RECIBO } from '../../areaHermano/recibos/etiquetas'
import { ETIQUETA_TIPO } from '../ropero'
import Pildora from '../listados/Pildora'
import { SITUACION, iniciales, situacionDe } from './situacion'
import { ESTADO_CIVIL, SEXO } from '../../areaHermano/perfil/etiquetas'

interface Props {
  id: number
  puedeGestionar: boolean
  /** La consulta del listado: «Editar ficha» la lleva para volver aquí mismo. */
  volver: string
  enlace: (id: number) => string
  /** En el móvil la ficha tapa la lista: esto la cierra. */
  onCerrar: () => void
}

/** Día de Madrid, como lo razona el servidor: un alta a las 00:30 no sale el día anterior. */
const dia = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })

const edad = (nacimiento: string) => {
  const hoy = new Date()
  const n = new Date(nacimiento)
  let anios = hoy.getFullYear() - n.getFullYear()
  if (hoy.getMonth() < n.getMonth() || (hoy.getMonth() === n.getMonth() && hoy.getDate() < n.getDate())) anios -= 1
  return anios
}

const PARENTESCO = Object.fromEntries(PARENTESCOS.map((p) => [p.value, p.label])) as Record<string, string>

/** Qué es la otra ficha para esta cuenta: «Titular de la cuenta», «Sobrino o sobrina»... Nunca «hijo» por defecto. */
const papelEnLaCuenta = (f: FichaDeLaCuenta) =>
  f.esTitular ? 'Titular de la cuenta' : f.parentesco ? PARENTESCO[f.parentesco] : 'En la misma cuenta'

/**
 * La ficha de un hermano, de solo lectura, al lado de la lista del censo.
 * Para cambiar algo, «Editar ficha» lleva a la pantalla de edición, que es
 * donde están también la baja y la reactivación (piden fecha y confirmación).
 */
export default function FichaCenso({ id, puedeGestionar, volver, enlace, onCerrar }: Props) {
  const [ficha, setFicha] = useState<FichaDelCenso | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Pasar rápido por la lista lanza varias cargas: solo escribe la última.
    // La pantalla la monta con `key={id}`: cada ficha empieza vacía, sin arrastrar la anterior.
    let vigente = true
    fichaDeHermano(id)
      .then((f) => { if (vigente) setFicha(f) })
      .catch(() => { if (vigente) setError('No se ha podido cargar la ficha del hermano.') })
    return () => { vigente = false }
  }, [id])

  const cerrar = (
    <Button size="small" startIcon={<ArrowBackIcon />} onClick={onCerrar} sx={{ display: { md: 'none' }, mb: 2 }}>
      Volver a la lista
    </Button>
  )

  if (error) return <Paper sx={{ p: 3 }}>{cerrar}<Alert severity="error">{error}</Alert></Paper>
  if (!ficha) return <Paper sx={{ p: 3, display: 'grid', placeItems: 'center', minHeight: 240 }}><CircularProgress aria-label="Cargando la ficha" /></Paper>

  const situacion = situacionDe(ficha)
  const correo = ficha.email ?? ficha.user?.email ?? null
  const telefono = ficha.telefono ?? ficha.user?.telefono ?? null
  const poblacion = [ficha.codigoPostal, ficha.poblacion].filter(Boolean).join(' ')
  const provincia = [ficha.provincia, ficha.comunidadAutonoma, ficha.pais].filter(Boolean).join(' · ')
  const presentado = [ficha.presentadoPor, ficha.presentadoPor2].filter(Boolean).join(' y ')
  const bautismo = [ficha.fechaBautismo ? dia(ficha.fechaBautismo) : null, ficha.lugarBautismo, ficha.parroquiaBautismo].filter(Boolean).join(' · ')
  const personal = [ficha.sexo ? SEXO[ficha.sexo] : null, ficha.estadoCivil ? ESTADO_CIVIL[ficha.estadoCivil] : null].filter(Boolean).join(' · ')
  const familia = ficha.user?.hermanos ?? []
  const recibo = ficha.recibos?.[0]
  const papeleta = ficha.papeletas?.[0]
  const prendas = ficha.prendas ?? []

  const campos: [string, string | null][] = [
    ['DNI', ficha.dni],
    ['Fecha de nacimiento', `${dia(ficha.fechaNacimiento)} · ${edad(ficha.fechaNacimiento)} años`],
    ['Natural de', ficha.lugarNacimiento],
    ['Sexo y estado civil', personal || null],
    ['Profesión', ficha.profesion],
    ['Teléfono', [telefono, ficha.telefonoFijo].filter(Boolean).join(' · ') || null],
    ['Correo', [correo, ficha.email2].filter(Boolean).join(' · ') || null],
    ['Dirección', ficha.direccion],
    ['Población', poblacion || null],
    ['Provincia, comunidad y país', provincia || null],
    ['Boletín de noticias', ficha.boletin ? 'Sí' : 'No'],
    ['Fecha de jura', ficha.fechaJura ? dia(ficha.fechaJura) : null],
    ['Presentado por', presentado || null],
    ['Bautismo', bautismo || null],
    ['Túnica', ficha.tieneTunicaPropia ? `Propia${ficha.tunica ? ` · talla ${ficha.tunica}` : ''}` : ficha.tunica ? `Talla ${ficha.tunica}` : null],
    ['Altura al hombro', ficha.alturaHombro ? `${ficha.alturaHombro} cm` : null],
    ['Puesto habitual', ficha.puesto],
  ]

  return (
    <Paper component="section" aria-labelledby="ficha-censo-titulo" sx={{ p: { xs: 2.5, md: 3.5 } }}>
      {cerrar}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        {/* La foto del alta, si la adjuntó; si no, sus iniciales. */}
        {ficha.foto ? (
          <Box
            component="img"
            src={urlDocumentoPrivado(ficha.foto)}
            alt={`Foto de ${ficha.nombre} ${ficha.apellidos}`}
            sx={{ flexShrink: 0, width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', backgroundColor: 'action.selected' }}
          />
        ) : (
          <Box aria-hidden="true" sx={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: '50%', backgroundColor: 'action.selected', fontSize: 19, fontWeight: 600 }}>
            {iniciales(ficha.apellidos, ficha.nombre)}
          </Box>
        )}
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Typography id="ficha-censo-titulo" component="h2" sx={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}>
            {ficha.apellidos}, {ficha.nombre}
          </Typography>
          <Box sx={{ mt: 0.75, display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', fontSize: 13.5, color: 'text.secondary' }}>
            <Pildora {...SITUACION[situacion]} />
            <span>
              {ficha.numeroHermano
                ? <>Hermano n.º <Box component="strong" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{ficha.numeroHermano}</Box></>
                : 'Sin número'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{situacion === 'baja' && ficha.fechaBaja ? `De baja desde el ${dia(ficha.fechaBaja)}` : situacion === 'pendiente' ? `Pidió el alta el ${dia(ficha.fechaAlta)}` : `Alta el ${dia(ficha.fechaAlta)}`}</span>
          </Box>
        </Box>
        {puedeGestionar && (
          <Button
            variant="contained"
            startIcon={<EditOutlinedIcon />}
            component={Link}
            to={`/cms/hermanos/${ficha.id}/editar`}
            state={{ volver }}
            aria-label={`Editar ${ficha.nombre} ${ficha.apellidos}`}
          >
            Editar ficha
          </Button>
        )}
      </Box>

      <Box component="dl" sx={{ m: 0, mt: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: '20px 24px' }}>
        {campos.map(([etiqueta, valor]) => (
          <Box key={etiqueta} sx={{ minWidth: 0 }}>
            <Etiqueta component="dt">{etiqueta}</Etiqueta>
            <Box component="dd" sx={{ m: 0, mt: 0.5, fontSize: 14.5, overflowWrap: 'anywhere', color: valor ? 'text.primary' : 'text.disabled' }}>{valor ?? '—'}</Box>
          </Box>
        ))}
      </Box>

      {(ficha.foto || ficha.certificadoBautismo) && (
        <Box sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
          <Etiqueta component="h3" sx={{ mb: 1.25 }}>Documentos del alta</Etiqueta>
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', fontSize: 14.5 }}>
            {ficha.foto && <a href={urlDocumentoPrivado(ficha.foto)} target="_blank" rel="noopener">Fotografía</a>}
            {ficha.certificadoBautismo && <a href={urlDocumentoPrivado(ficha.certificadoBautismo)} target="_blank" rel="noopener">Certificado de bautismo</a>}
          </Box>
        </Box>
      )}

      {familia.length > 0 && (
        <Box sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
          <Etiqueta component="h3" sx={{ mb: 1.25 }}>{ficha.esTitular ? 'A su cargo' : 'En la misma cuenta'}</Etiqueta>
          <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
            {familia.map((f) => (
              <Box
                key={f.id}
                component={Link}
                to={{ search: enlace(f.id) }}
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, py: 1, pl: 1.25, pr: 1.75, borderRadius: 1, backgroundColor: 'action.hover', color: 'inherit', textDecoration: 'none', '&:hover': { backgroundColor: 'action.selected' } }}
              >
                <Box aria-hidden="true" sx={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: '50%', backgroundColor: 'action.selected', fontSize: 11.5, fontWeight: 600 }}>
                  {iniciales(f.apellidos, f.nombre)}
                </Box>
                <span>
                  <Box component="span" sx={{ display: 'block', fontSize: 13.5 }}>{f.apellidos}, {f.nombre}</Box>
                  <Box component="span" sx={{ display: 'block', fontSize: 11.5, color: 'text.secondary' }}>
                    {[papelEnLaCuenta(f), `${edad(f.fechaNacimiento)} años`, f.numeroHermano ? `n.º ${f.numeroHermano}` : SITUACION[situacionDe(f)].texto.toLowerCase()].join(' · ')}
                  </Box>
                </span>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <Box sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider', display: 'flex', gap: { xs: 2, sm: 4 }, flexWrap: 'wrap' }}>
        <Resumen titulo="Último recibo">
          {recibo ? `${recibo.concepto} · ${ESTADO_RECIBO[recibo.estado]?.texto ?? recibo.estado}` : 'Ninguno'}
        </Resumen>
        <Resumen titulo="Papeleta de sitio">
          {papeleta ? [papeleta.year, papeleta.puesto, papeleta.tramo].filter(Boolean).join(' · ') : 'Ninguna'}
        </Resumen>
        <Resumen titulo="Del ropero">
          {prendas.length > 0
            ? prendas.map((p) => `${ETIQUETA_TIPO[p.tipo] ?? p.tipo} ${p.numero}${p.talla ? ` (${p.talla})` : ''}`).join(', ')
            : 'Nada prestado'}
        </Resumen>
      </Box>
    </Paper>
  )
}

function Etiqueta({ component, sx, children }: { component: 'dt' | 'h3'; sx?: object; children: ReactNode }) {
  return (
    <Typography component={component} sx={{ m: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', ...sx }}>
      {children}
    </Typography>
  )
}

function Resumen({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{titulo}</Typography>
      <Typography sx={{ mt: 0.25, fontSize: 14, fontWeight: 600 }}>{children}</Typography>
    </div>
  )
}
