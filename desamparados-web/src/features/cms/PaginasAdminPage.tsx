import { createContext, useContext, useState, type ReactNode } from 'react'
import { Alert, Box, Button, ButtonBase, Collapse, Paper, Typography } from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import CabeceraSeccion from './CabeceraSeccion'
import { PAGINAS_PUBLICAS, paginasPublicasActivas, type PaginaPublica } from '../../app/cmsNavegacion'
import { useModulos } from '../../hooks/useModulos'
import { useQuery } from '@tanstack/react-query'
import { CLAVE_NOMBRES_EN_MENU, NOMBRE_DE_SIEMPRE, nombresEnMenu, type NombresEnMenu } from '../../lib/api/menu'
import { site } from '../../config/site'
import { enlacesDelMenu, menuPublico, menuVisible } from '../../config/navegacion'
import DialogoNombreEnMenu, { type EntradaARenombrar } from './DialogoNombreEnMenu'

/**
 * El nombre de cada página en el menú público y cómo cambiarlo, al alcance de
 * cada fila sin pasarlo de mano en mano por las secciones.
 */
const SIN_NOMBRES: NombresEnMenu = {}

const NombresDelMenu = createContext<{ nombres: Readonly<Record<string, string>>; listos: boolean; renombrar: (e: EntradaARenombrar) => void }>({
  nombres: {},
  listos: false,
  renombrar: () => {},
})

/**
 * El índice del apartado «Web pública»: qué páginas se editan por bloques,
 * en árbol, como el menú de la web pública.
 *
 * La lista sale de `shared/paginas-publicas.json` y no está escrita aquí: al
 * convertir una página más, aparece sola en su sección. Agrupadas como en el
 * menú, porque quien edita busca la página donde la ve el visitante.
 *
 * Una línea por página y la fila entera lleva al editor, que es a lo que se
 * viene aquí; ver la página en la web es secundario y va como icono al final.
 * La jerarquía se marca solo con sangría y peso de letra: sección en negrita,
 * sus páginas dentro y las subpáginas un paso más adentro, con una línea guía.
 *
 * Aquí se cambia también el nombre de cada página en el menú de la web (un
 * icono más en la fila, junto al de verla), y al final van las entradas del
 * menú que no son páginas de bloques (Inicio, Tienda, Hazte hermano…), solo
 * para eso.
 */
export default function PaginasAdminPage() {
  const { activos } = useModulos()
  // Con el estado y no con useNombresEnMenu: aquí «ninguno» porque aún no han
  // llegado (o fallaron) no es lo mismo que «ninguno guardado». El diálogo
  // parte del nombre actual, y abrirlo vacío por error lo borraría al guardar.
  const consultaNombres = useQuery({ queryKey: CLAVE_NOMBRES_EN_MENU, queryFn: nombresEnMenu, staleTime: 10 * 60_000 })
  const nombres = consultaNombres.data ?? SIN_NOMBRES
  const [renombrando, setRenombrando] = useState<EntradaARenombrar | null>(null)
  // Mientras no llega la lista, solo las del núcleo: mejor eso que enseñar
  // un momento las de un módulo apagado y quitarlas.
  const grupos = agruparPorGrupo(paginasPublicasActivas(activos ?? new Set()))
  const otrasEntradas = enlacesDelMenu(menuVisible(menuPublico, activos ?? new Set()))
    .filter((e) => !RUTAS_DE_PAGINAS.has(e.href))

  return (
    <>
      <Helmet><title>{`Páginas | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Páginas" />

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: '65ch' }}>
        Estas páginas se componen con bloques: se les añade y se les quita texto, fotos,
        galerías y tarjetas, y se reordenan sin tocar código. Pulsa una para editarla; los
        cambios se ven en la web en cuanto se guardan.
      </Typography>

      {consultaNombres.isError && (
        <Alert severity="warning" sx={{ maxWidth: 820, mb: 2 }}
          action={<Button color="inherit" size="small" onClick={() => void consultaNombres.refetch()}>Reintentar</Button>}>
          No se han podido cargar los nombres del menú. Hasta que lleguen no se pueden cambiar.
        </Alert>
      )}
      <NombresDelMenu.Provider value={{ nombres, listos: consultaNombres.isSuccess, renombrar: setRenombrando }}>
        <Paper variant="outlined" sx={{ maxWidth: 820, p: { xs: 0.5, sm: 0.75 } }}>
          {grupos.map(([grupo, paginas], i) => (
            <Box key={grupo} sx={i > 0 ? { borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 0.5 } : undefined}>
              <Seccion titulo={grupo} paginas={paginas} />
            </Box>
          ))}
          {otrasEntradas.length > 0 && (
            <Box sx={{ borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 0.5 }}>
              <SeccionPlegable titulo="Otras entradas del menú" cuantas={otrasEntradas.length}>
                {otrasEntradas.map((entrada) => (
                  <li key={entrada.href}>
                    <Box sx={{ ...fila, ...conIconos, pl: `${SANGRIA.pagina}px` }}>
                      <Typography component="span" sx={{ flexGrow: 1, minWidth: 0, fontSize: '0.95rem' }}>
                        {nombres[entrada.href] ?? entrada.label}
                      </Typography>
                      <BotonRenombrar ruta={entrada.href} pagina={NOMBRE_DE_SIEMPRE.get(entrada.href) ?? entrada.label} />
                    </Box>
                  </li>
                ))}
              </SeccionPlegable>
            </Box>
          )}
        </Paper>
        {renombrando && <DialogoNombreEnMenu entrada={renombrando} nombres={nombres} alCerrar={() => setRenombrando(null)} />}
      </NombresDelMenu.Provider>
    </>
  )
}

/**
 * Las rutas de las páginas de bloques, encendidas o no: las de un módulo
 * apagado no salen en el menú, y aquí tampoco como «otra entrada».
 */
const RUTAS_DE_PAGINAS = new Set(PAGINAS_PUBLICAS.map((p) => p.ruta))

/**
 * El icono que abre «Nombre en el menú», en las filas que son una entrada del
 * menú público. Por encima del enlace estirado de la fila, como el de verla en
 * la web, y con las mismas reglas para aparecer.
 */
function BotonRenombrar({ ruta, pagina }: { ruta: string; pagina: string }) {
  const { renombrar, listos } = useContext(NombresDelMenu)
  const deSiempre = NOMBRE_DE_SIEMPRE.get(ruta)
  if (!deSiempre || !listos) return null
  return (
    <ButtonBase
      className="icono-de-fila"
      onClick={() => renombrar({ ruta, deSiempre, pagina })}
      title="Nombre en el menú"
      aria-label={`Cambiar el nombre en el menú de la página ${pagina}`}
      sx={icono}
    >
      <DriveFileRenameOutlineIcon sx={{ fontSize: 17 }} />
    </ButtonBase>
  )
}

/** Cómo se llama en el menú, si no es como la página: así se ve sin abrir nada. */
function NombreEnMenu({ pagina }: { pagina: PaginaPublica }) {
  const { nombres } = useContext(NombresDelMenu)
  const enMenu = nombres[pagina.ruta] ?? NOMBRE_DE_SIEMPRE.get(pagina.ruta)
  if (!enMenu || enMenu === pagina.nombre) return null
  return (
    <Typography
      component="span"
      variant="caption"
      sx={{ flexShrink: 1, minWidth: 0, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
    >
      En el menú: {enMenu}
    </Typography>
  )
}

/**
 * Sangría de cada nivel, en px. La flecha de la sección mide 20 y la separa un
 * hueco de 10, así que el nombre de la sección arranca en 42: ahí va también la
 * sección de una sola página, y sus páginas un escalón más adentro.
 */
const SANGRIA = { seccion: 12, nombreDeSeccion: 42, pagina: 56, subpagina: 82 } as const
/** Dónde cae la línea guía de las subpáginas: bajo el arranque del nombre de su madre. */
const GUIA = 64

/**
 * Una sección del árbol, plegada de entrada: así caben todas en una pantalla y
 * se abre solo la que se va a tocar.
 *
 * Una sección con una sola página que se llama como ella (Rosario, Contacto)
 * no se pliega: la fila es ya el enlace a su editor, sin repetir el nombre dentro.
 */
function Seccion({ titulo, paginas }: { titulo: string; paginas: PaginaPublica[] }) {
  if (paginas.length === 1 && paginas[0].nombre === titulo) {
    return (
      <Box component="h2" sx={{ m: 0 }}>
        <FilaDePagina pagina={paginas[0]} sangria={SANGRIA.nombreDeSeccion} seccion />
      </Box>
    )
  }

  return (
    <SeccionPlegable titulo={titulo} cuantas={paginas.length}>
      {arbolDeSeccion(paginas).map(({ madre, hijas }) => (
        <li key={madre.slug}>
          <FilaDePagina pagina={madre} sangria={SANGRIA.pagina} />
          {hijas.length > 0 && (
            <Box component="ul" sx={lista}>
              {hijas.map((hija) => (
                <li key={hija.slug}><FilaDePagina pagina={hija} sangria={SANGRIA.subpagina} subpagina /></li>
              ))}
            </Box>
          )}
        </li>
      ))}
    </SeccionPlegable>
  )
}

/**
 * La cabecera que pliega y despliega una sección, con su lista debajo.
 *
 * El encabezado lleva SOLO el botón que pliega (patrón de divulgación, como
 * `constructor/ListaDeBloques`): un `Accordion` de MUI mete un `<button>` en el
 * resumen, y dentro de un botón no puede haber enlaces.
 */
function SeccionPlegable({ titulo, cuantas, children }: { titulo: string; cuantas: number; children: ReactNode }) {
  const [abierta, setAbierta] = useState(false)
  const id = titulo.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')
  const idCabecera = `seccion-${id}-cabecera`
  const idDetalle = `seccion-${id}-detalle`

  return (
    <Box component="section">
      <Box component="h2" sx={{ m: 0, display: 'flex' }}>
        <ButtonBase
          id={idCabecera}
          aria-expanded={abierta}
          aria-controls={idDetalle}
          onClick={() => setAbierta((estaba) => !estaba)}
          sx={{ ...fila, pl: `${SANGRIA.seccion}px`, flexGrow: 1, justifyContent: 'flex-start', textAlign: 'left' }}
        >
          <ChevronRightIcon
            aria-hidden
            sx={{
              fontSize: 20, color: 'text.secondary',
              transform: abierta ? 'rotate(90deg)' : 'none',
              transition: (t) => t.transitions.create('transform', { duration: t.transitions.duration.shortest }),
            }}
          />
          <Typography component="span" sx={{ flexGrow: 1, fontWeight: 600, fontSize: '1rem' }}>{titulo}</Typography>
          <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums', pr: 1.5 }}>
            {cuantas}
          </Typography>
        </ButtonBase>
      </Box>

      <Collapse in={abierta}>
        <Box component="ul" id={idDetalle} role="region" aria-labelledby={idCabecera} sx={lista}>
          {children}
        </Box>
      </Collapse>
    </Box>
  )
}

/**
 * Una página del árbol. La fila entera lleva al editor con el truco del enlace
 * estirado (su `::after` cubre la fila), y los iconos de renombrar en el menú
 * y de ver en la web quedan por encima: un enlace o un botón dentro de otro
 * enlace no es marcado válido ni se puede tabular.
 */
function FilaDePagina({ pagina, sangria, subpagina = false, seccion = false }: {
  pagina: PaginaPublica
  sangria: number
  subpagina?: boolean
  seccion?: boolean
}) {
  return (
    <Box sx={{
      ...fila,
      ...conIconos,
      position: 'relative',
      pl: `${sangria}px`,
      ...(subpagina && { '&::before': { content: '""', position: 'absolute', left: GUIA, top: 0, bottom: 0, borderLeft: 1, borderColor: 'divider' } }),
    }}>
      <Box
        component={Link}
        to={`/cms/paginas/${pagina.slug}`}
        sx={{
          flexGrow: 1, minWidth: 0, color: subpagina ? 'text.secondary' : 'text.primary', textDecoration: 'none',
          fontWeight: seccion ? 600 : 400, fontSize: seccion ? '1rem' : subpagina ? '0.9rem' : '0.95rem',
          '&::after': { content: '""', position: 'absolute', inset: 0, borderRadius: 1 },
          '&:focus-visible': { outline: 'none' },
          '&:focus-visible::after': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        {pagina.nombre}
      </Box>
      <NombreEnMenu pagina={pagina} />
      <BotonRenombrar ruta={pagina.ruta} pagina={pagina.nombre} />
      <Box
        component="a"
        className="icono-de-fila"
        href={pagina.ruta}
        target="_blank"
        rel="noopener noreferrer"
        title={`Ver en la web: ${pagina.ruta}`}
        aria-label={`Ver ${pagina.nombre} en la web, en otra pestaña`}
        sx={icono}
      >
        <OpenInNewIcon sx={{ fontSize: 17 }} />
      </Box>
    </Box>
  )
}

/** Una fila del árbol: una línea, alta de sobra para el dedo en el móvil. */
const fila = {
  display: 'flex', alignItems: 'center', gap: '10px', minHeight: { xs: 48, sm: 42 }, pr: 0.5, py: 0.25,
  borderRadius: 1, '&:hover': { backgroundColor: 'action.hover' },
} as const

const lista = { listStyle: 'none', m: 0, p: 0 } as const

/** Los iconos del final de la fila (renombrar, ver en la web), por encima del enlace estirado. */
const icono = {
  position: 'relative', zIndex: 1, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 36, height: 36, borderRadius: 1, color: 'text.secondary', transition: 'opacity .15s',
  '&:hover': { color: 'text.primary', backgroundColor: 'action.selected' },
} as const

/**
 * Con ratón, los iconos aparecen al pasar por la fila o al llegar con el
 * teclado; en pantallas táctiles, donde no hay «pasar por encima», siempre.
 */
const conIconos = {
  '@media (hover: hover)': { '& .icono-de-fila': { opacity: 0 }, '&:hover .icono-de-fila, &:focus-within .icono-de-fila': { opacity: 1 } },
} as const

/** Los grupos en el orden en que aparecen en el catálogo, sin repetirlos. */
function agruparPorGrupo(paginas: PaginaPublica[]): [string, PaginaPublica[]][] {
  const porGrupo = new Map<string, PaginaPublica[]>()
  for (const pagina of paginas) {
    const lista = porGrupo.get(pagina.grupo)
    if (lista) lista.push(pagina)
    else porGrupo.set(pagina.grupo, [pagina])
  }
  return [...porGrupo.entries()]
}

/**
 * Qué página cuelga de cuál dentro de una sección: la subpágina es la que
 * tiene la ruta de otra como prefijo (/sabado-de-pasion/trono cuelga de
 * /sabado-de-pasion), que es también como las anida el menú de la web. Las
 * madres, en el orden del catálogo, y cada una con sus hijas detrás aunque en
 * el catálogo haya otra página por medio.
 */
function arbolDeSeccion(paginas: PaginaPublica[]): { madre: PaginaPublica; hijas: PaginaPublica[] }[] {
  const cuelga = (hija: PaginaPublica, madre: PaginaPublica) => hija !== madre && hija.ruta.startsWith(`${madre.ruta}/`)
  return paginas
    .filter((pagina) => !paginas.some((otra) => cuelga(pagina, otra)))
    .map((madre) => ({ madre, hijas: paginas.filter((pagina) => cuelga(pagina, madre)) }))
}
