import { useState, type ReactNode } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TemaCmsProvider } from '../../../app/temaCms'
import VentanaSesionCaducada from '../../../app/VentanaSesionCaducada'
import {
  CLAVE_ASISTENTE, asistenteDelCms, guardarAsistente, marcaDelCms,
  type EstadoDeLaMarca, type EstadoDelAsistente, type PasoSaltable,
} from '../../../lib/api/corporacion'
import { modulosDelCms } from '../../../lib/api/modulos'
import IdentidadYMarca, { CLAVE_MARCA, vistaDeLaMarca, type VistaDeLaMarca } from '../corporacion/IdentidadYMarca'
import Contacto from '../corporacion/Contacto'
import type { AccionesDelFormulario } from '../corporacion/acciones'
import ListaDeModulos, { CLAVE_LISTA } from '../modulos/ListaDeModulos'
import VistaPrevia from './VistaPrevia'
import { site } from '../../../config/site'

/**
 * «Seguir más tarde» vale para esta sesión del navegador: al volver a entrar,
 * el asistente sale otra vez. La lee también el Inicio (PanelPage), escrita
 * allí a mano para no cargar esta pantalla con él.
 */
const LUEGO = 'cms.asistente.luego'

type Clave = 'nombre' | PasoSaltable | 'listo'
const PASOS: { clave: Clave; titulo: string; texto: string }[] = [
  { clave: 'nombre', titulo: 'El nombre', texto: 'Cómo os llamáis: sale en la web, en los correos, en los PDF y en los textos legales.' },
  { clave: 'escudo', titulo: 'El escudo', texto: 'Cualquier PNG, JPEG o WebP: se ajusta solo. Se guarda al subirlo.' },
  { clave: 'colores', titulo: 'Los colores', texto: 'De estos dos salen todos los tonos de la web, los correos y los PDF. Vacíos, se quedan los de partida.' },
  { clave: 'contacto', titulo: 'El contacto', texto: 'Secretaría, dónde estáis y vuestras redes. Lo que dejes vacío no sale en la web.' },
  { clave: 'legales', titulo: 'Los datos legales', texto: 'Los del aviso legal y la privacidad. Si aún no los tenéis, salta el paso: esos apartados no salen hasta que se pongan.' },
  { clave: 'secciones', titulo: 'Las secciones', texto: 'Lo que usa esta web. Lo apagado desaparece del CMS y de la web; sus datos se conservan y vuelven al encenderlo.' },
  { clave: 'listo', titulo: 'Listo', texto: 'Todo esto se cambia cuando queráis en Sistema → Datos de la corporación y en Módulos.' },
]
const LISTO = PASOS.length - 1

/**
 * El asistente de primer arranque: la primera vez que entra Administración, la
 * lleva paso a paso por lo que hace suya la web. No tiene formularios propios:
 * cada paso es una ficha de su pantalla de siempre (Identidad y marca,
 * Contacto, Módulos) con «Siguiente» en lugar de «Guardar», y al lado, cómo
 * queda la web. La API solo apunta por qué paso va, para retomarlo.
 */
export default function AsistentePage() {
  // Va fuera del marco del CMS (sin su menú), así que trae su tema y su aviso de sesión caducada.
  return (
    <TemaCmsProvider>
      <Asistente />
      <VentanaSesionCaducada />
    </TemaCmsProvider>
  )
}

function Asistente() {
  const navigate = useNavigate()
  const cliente = useQueryClient()
  const estado = useQuery({ queryKey: CLAVE_ASISTENTE, queryFn: asistenteDelCms })
  const marca = useQuery({ queryKey: CLAVE_MARCA, queryFn: marcaDelCms })
  const [copiado, setCopiado] = useState<EstadoDelAsistente | undefined>(undefined)
  const [paso, setPaso] = useState(0)
  const [saltados, setSaltados] = useState<PasoSaltable[]>([])
  const apuntar = useMutation({
    mutationFn: guardarAsistente,
    onSuccess: (nuevo) => cliente.setQueryData(CLAVE_ASISTENTE, nuevo),
  })

  // Se retoma donde se dejó; una vez copiado, manda lo de esta pantalla.
  if (estado.data && !copiado) {
    setCopiado(estado.data)
    // Terminado, se repasa desde el principio.
    setPaso(estado.data.terminado ? 0 : estado.data.paso)
    setSaltados(estado.data.saltados)
    return null
  }

  if (estado.isPending || marca.isPending) {
    return <Centrado><CircularProgress aria-label="Cargando el asistente" /></Centrado>
  }
  if (estado.isError || marca.isError) {
    return <Centrado><Alert severity="error">No se ha podido cargar el asistente. Inténtalo de nuevo en unos minutos.</Alert></Centrado>
  }

  const terminado = Boolean(estado.data.terminado)
  const ir = (destino: number, nuevosSaltados: PasoSaltable[]) => {
    setPaso(destino)
    setSaltados(nuevosSaltados)
    apuntar.mutate({ paso: destino, saltados: nuevosSaltados, terminar: destino === LISTO })
    window.scrollTo({ top: 0 })
  }
  const clave = PASOS[paso].clave
  const sinEste = saltados.filter((s) => s !== clave)
  const avanzar = () => ir(paso + 1, sinEste)
  const saltar = () => ir(paso + 1, [...sinEste, clave as PasoSaltable])
  const salir = () => {
    try { sessionStorage.setItem(LUEGO, '1') } catch { /* sin almacenamiento, volverá a salir al entrar en el Inicio */ }
    navigate('/cms')
  }

  const pantalla = (contenido: ReactNode, vista: VistaDeLaMarca, acciones?: AccionesDelFormulario) => (
    <Pantalla
      paso={paso}
      terminado={terminado}
      vista={vista}
      onSalir={salir}
      pie={(
        <>
          <Button variant="text" color="inherit" disabled={paso === 0} onClick={() => ir(paso - 1, saltados)} sx={{ minHeight: 44 }}>Atrás</Button>
          <Box sx={{ flex: 1 }} />
          {clave !== 'nombre' && <Button variant="text" color="inherit" onClick={saltar} sx={{ minHeight: 44 }}>Saltar este paso</Button>}
          <Button
            variant="contained"
            disabled={acciones?.hayErrores || acciones?.guardando}
            // Con algo escrito se guarda y, al guardarse, se avanza (`alGuardar`); sin cambios, se avanza sin más.
            onClick={() => (acciones?.sinGuardar ? acciones.guardar() : avanzar())}
            sx={{ minHeight: 44 }}
          >
            {acciones?.guardando ? 'Guardando…' : 'Siguiente'}
          </Button>
        </>
      )}
    >
      {contenido}
    </Pantalla>
  )
  const guardada = vistaDeLaMarca(marca.data)
  const deLaMarca = (fichas: ('identidad' | 'legales' | 'colores' | 'imagenes')[]) => (
    <IdentidadYMarca key={clave} fichas={fichas} enAsistente alGuardar={avanzar}
      marco={(contenido, acciones, vista) => pantalla(contenido, vista, acciones)} />
  )

  switch (clave) {
    case 'nombre': return deLaMarca(['identidad'])
    case 'escudo': return deLaMarca(['imagenes'])
    case 'colores': return deLaMarca(['colores'])
    case 'legales': return deLaMarca(['legales'])
    case 'contacto':
      return <Contacto key={clave} bloques={['Secretaría', 'Sede', 'Redes']} enAsistente alGuardar={avanzar}
        marco={(contenido, acciones) => pantalla(contenido, guardada, acciones)} />
    case 'secciones': return pantalla(<ListaDeModulos />, guardada)
    case 'listo':
      return (
        <Pantalla paso={paso} terminado={terminado} vista={guardada} onSalir={salir}
          pie={(
            <>
              <Button variant="text" color="inherit" onClick={() => ir(paso - 1, saltados)} sx={{ minHeight: 44 }}>Atrás</Button>
              <Box sx={{ flex: 1 }} />
              <Button variant="outlined" href="/" target="_blank" rel="noopener" sx={{ minHeight: 44 }}>Ver la web</Button>
              {/* Con recarga: el nombre y los colores del CMS se leen al cargar la página. */}
              <Button variant="contained" onClick={() => window.location.assign('/cms')} sx={{ minHeight: 44 }}>Ir al CMS</Button>
            </>
          )}
        >
          <Resumen marca={marca.data} saltados={saltados} onIr={(n) => ir(n, saltados)} />
        </Pantalla>
      )
  }
}

function Centrado({ children }: { children: ReactNode }) {
  return <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>{children}</Box>
}

/**
 * El paso a la izquierda, con su barra de progreso y sus botones pegados abajo;
 * a la derecha, «Así queda». En el móvil la vista va encima, en pequeño, y solo
 * en los pasos que la cambian.
 */
function Pantalla({ paso, terminado, vista, onSalir, pie, children }: {
  paso: number
  terminado: boolean
  vista: VistaDeLaMarca
  onSalir: () => void
  pie: ReactNode
  children: ReactNode
}) {
  const { titulo, texto } = PASOS[paso]
  const cambiaLaVista = paso <= 2
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', color: 'text.primary', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 620px) minmax(0, 1fr)' } }}>
      <Helmet><title>{`Puesta en marcha | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <Box component="main" sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, px: { xs: 2, sm: 3, md: 5 }, pt: { xs: 1.5, md: 3 } }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'text.secondary' }}>
            {paso === LISTO ? 'Puesta en marcha' : `Paso ${paso + 1} de ${LISTO + 1}`}
          </Typography>
          <Button variant="text" color="inherit" onClick={onSalir} sx={{ minHeight: 44, mr: -1 }}>{terminado ? 'Salir' : 'Seguir más tarde'}</Button>
        </Stack>
        <Box role="progressbar" aria-label="Pasos" aria-valuemin={1} aria-valuemax={LISTO + 1} aria-valuenow={paso + 1}
          sx={{ height: 4, borderRadius: 2, bgcolor: 'divider', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${((paso + 1) / (LISTO + 1)) * 100}%`, bgcolor: 'primary.main', transition: 'width .3s' }} />
        </Box>
        <Stack spacing={2.5} sx={{ flex: 1, pt: { xs: 2, md: 3 }, pb: 3 }}>
          <Box>
            <Typography variant="h1" sx={{ fontSize: { xs: 26, md: 30 }, fontWeight: 600 }}>{paso === LISTO ? 'La web ya es vuestra' : titulo}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>{texto}</Typography>
          </Box>
          {cambiaLaVista && <Box sx={{ display: { md: 'none' } }}><VistaPrevia vista={vista} compacta /></Box>}
          {children}
        </Stack>
        <Stack direction="row" spacing={1} sx={{
          position: 'sticky', bottom: 0, zIndex: 1, bgcolor: 'background.default', alignItems: 'center',
          py: 1.5, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap', rowGap: 1,
        }}>
          {pie}
        </Stack>
      </Box>
      <Box component="aside" sx={{ display: { xs: 'none', md: 'block' }, bgcolor: 'action.hover', minWidth: 0 }}>
        <Box sx={{ position: 'sticky', top: 0, p: { md: 4, lg: 5 } }}>
          <VistaPrevia vista={vista} />
        </Box>
      </Box>
    </Box>
  )
}

/** El último paso: lo puesto y lo saltado, con «Ponerlo ahora» en lo que falta. */
function Resumen({ marca, saltados, onIr }: { marca: EstadoDeLaMarca; saltados: PasoSaltable[]; onIr: (paso: number) => void }) {
  const modulos = useQuery({ queryKey: CLAVE_LISTA, queryFn: modulosDelCms })
  const { imagenes, colores, identidad } = marca
  const escudos = [imagenes.escudoSobreOscuro?.propia, imagenes.escudoSobreClaro?.propia].filter(Boolean).length
  const datos: Record<Exclude<Clave, 'listo'>, string> = {
    nombre: identidad.nombre,
    escudo: escudos === 2 ? 'Los dos puestos' : escudos === 1 ? 'Falta uno de los dos' : 'Aún los de partida',
    colores: colores.colorPrincipal || colores.colorAcento ? 'Los vuestros' : 'Los de partida',
    contacto: 'Puesto',
    legales: identidad.denominacion ? 'Puestos' : 'Sin poner',
    secciones: modulos.data ? `${modulos.data.filter((m) => m.activo).length} de ${modulos.data.length} encendidas` : '',
  }
  return (
    <Stack component="ul" sx={{ m: 0, p: 0 }}>
      {PASOS.slice(0, LISTO).map(({ clave, titulo }, n) => {
        const saltado = saltados.includes(clave as PasoSaltable)
        return (
          <Stack key={clave} component="li" direction="row" spacing={1.5}
            sx={{ listStyle: 'none', alignItems: 'center', py: 1.25, minHeight: 44, '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' } }}>
            <Box aria-hidden sx={{
              width: 24, height: 24, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
              ...(saltado ? { border: 1, borderColor: 'warning.main', color: 'warning.main' } : { bgcolor: 'success.main', color: 'success.contrastText' }),
            }}>
              {saltado ? '!' : '✓'}
            </Box>
            <Typography sx={{ flex: 'none' }}>{titulo}</Typography>
            <Box sx={{ flex: 1 }} />
            {saltado
              ? <Button variant="text" onClick={() => onIr(n)} aria-label={`Ponerlo ahora: ${titulo}`} sx={{ minHeight: 40 }}>Ponerlo ahora</Button>
              : <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0 }}>{datos[clave as Exclude<Clave, 'listo'>]}</Typography>}
            <Typography component="span" sx={visualmenteOculto}>{saltado ? '(saltado)' : '(hecho)'}</Typography>
          </Stack>
        )
      })}
    </Stack>
  )
}

const visualmenteOculto = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const
