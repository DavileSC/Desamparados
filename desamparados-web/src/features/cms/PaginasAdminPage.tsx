import { useState } from 'react'
import { Box, ButtonBase, Chip, Collapse, Paper, Stack, Typography } from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import CabeceraSeccion from './CabeceraSeccion'
import { PAGINAS_PUBLICAS, type PaginaPublica } from '../../app/cmsNavegacion'

/**
 * El índice del apartado «Web pública»: qué páginas se editan por bloques y
 * dónde vive cada una.
 *
 * La lista sale de `shared/paginas-publicas.json` y no está escrita aquí: al
 * convertir una página más, aparece sola en este índice, con su enlace de
 * edición y su vista previa. Agrupadas como en el menú de la web pública,
 * porque quien edita busca la página donde la ve el visitante.
 */
export default function PaginasAdminPage() {
  const grupos = agruparPorGrupo(PAGINAS_PUBLICAS)

  return (
    <>
      <Helmet><title>Páginas de la web | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Páginas de la web" />

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, maxWidth: '65ch' }}>
        Estas páginas se componen con bloques: se les añade y se les quita texto, fotos,
        galerías y tarjetas, y se reordenan sin tocar código. Los cambios se ven en la web
        en cuanto se guardan.
      </Typography>

      <Stack spacing={2}>
        {grupos.map(([grupo, paginas]) => (
          <GrupoPlegable key={grupo} titulo={grupo} paginas={paginas} />
        ))}
      </Stack>
    </>
  )
}

/**
 * Una sección del índice, plegable.
 *
 * Plegada por omisión: así el índice cabe en una pantalla y se ven todas las
 * secciones de un vistazo, con cuántas páginas tiene cada una; se abre solo
 * la que se va a tocar.
 *
 * La estructura es la del patrón de divulgación, la misma que `constructor/ListaDeBloques`
 * y por el mismo motivo: el encabezado lleva SOLO el botón que pliega, y lo
 * demás va fuera de él. Un `Accordion` de MUI mete un `<button>` en el resumen,
 * y dentro de un botón no puede haber enlaces.
 */
function GrupoPlegable({ titulo, paginas }: { titulo: string; paginas: PaginaPublica[] }) {
  const [abierto, setAbierto] = useState(false)
  const id = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const idCabecera = `grupo-${id}-cabecera`
  const idDetalle = `grupo-${id}-detalle`

  return (
    <Box component="section">
      <Box component="h2" sx={{ m: 0, display: 'flex' }}>
        <ButtonBase
          id={idCabecera}
          aria-expanded={abierto}
          aria-controls={idDetalle}
          onClick={() => setAbierto((estaba) => !estaba)}
          sx={{ flexGrow: 1, gap: 1, p: 1, borderRadius: 1, justifyContent: 'flex-start', textAlign: 'left' }}
        >
          <ExpandMoreIcon
            sx={{
              color: 'text.secondary',
              transform: abierto ? 'none' : 'rotate(-90deg)',
              transition: (t) => t.transitions.create('transform'),
            }}
          />
          <Typography component="span" variant="h6" sx={{ flexGrow: 1 }}>{titulo}</Typography>
          <Chip component="span" size="small" label={paginas.length} />
        </ButtonBase>
      </Box>

      <Collapse in={abierto}>
        <Box id={idDetalle} role="region" aria-labelledby={idCabecera} sx={{ pt: 1 }}>
          <Stack spacing={1.5}>
            {paginas.map((pagina) => <FilaDePagina key={pagina.slug} pagina={pagina} />)}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  )
}

function FilaDePagina({ pagina }: { pagina: PaginaPublica }) {
  return (
    <Paper variant="outlined">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, p: 2 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {/* El enlace envuelve solo el título, no la fila entera: dentro va
              otro enlace (la vista previa), y un enlace dentro de otro no es
              marcado válido ni se puede tabular. */}
          <Typography variant="subtitle1" component="h3" sx={{ m: 0 }}>
            <Box
              component={Link}
              to={`/cms/paginas/${pagina.slug}`}
              sx={{ color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {pagina.nombre}
              <ChevronRightIcon fontSize="small" sx={{ verticalAlign: 'text-bottom', ml: 0.5 }} />
            </Box>
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {pagina.descripcion}
          </Typography>
        </Box>
        <Chip
          component="a"
          href={pagina.ruta}
          target="_blank"
          rel="noopener noreferrer"
          clickable
          size="small"
          variant="outlined"
          icon={<OpenInNewIcon />}
          label={pagina.ruta}
          aria-label={`Ver ${pagina.nombre} en la web, en otra pestaña`}
        />
      </Stack>
    </Paper>
  )
}

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
