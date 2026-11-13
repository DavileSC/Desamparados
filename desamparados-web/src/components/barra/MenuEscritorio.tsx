/**
 * El menú de escritorio, en el piso de abajo de la barra: una entrada por
 * sección y, en las que tienen subpáginas, una hoja de cristal oscuro que se
 * abre al pasar el ratón o al llegar con el teclado. El título de esas
 * secciones no lleva a ninguna página (para eso están las subpáginas de
 * dentro): pulsarlo solo abre o cierra la hoja.
 */
import { useState, useRef, type FocusEvent, type KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Box, Button } from '@mui/material'
import { ALTO_MENU, VIDRIO, compactMq, esActiva, estrechoMq, seccionActiva } from './estilos'
import type { EntradaMenu } from '../../config/navegacion'
import { designTokens } from '../../theme'
import { MARCA } from '../../theme/marca'
import { useMenuPublico } from '../../hooks/useMenuPublico'
// La serif de la agenda: importarla de ahí trae también sus ficheros de letra.
import { CORMORANT } from '../../features/actualidad/agenda/letraAlmanaque'

/** El dorado del foco de los botones (estiloDeBoton.ts): el mismo en toda la web. */
const FOCO = { outline: `2px solid ${designTokens.colors.tertiaryFixedDim}`, outlineOffset: '2px' } as const

/** El cristal, con su desenfoque también en Safari. */
const cristal = {
  backgroundColor: VIDRIO.fondo,
  backdropFilter: VIDRIO.filtro,
  WebkitBackdropFilter: VIDRIO.filtro,
} as const

/**
 * Una página de la hoja, centrada; las suyas de dentro, debajo y en pequeño.
 * Entre página y página, un filete: así quedan igual de separadas tengan o no
 * subpáginas, y las de dentro se leen como suyas.
 */
function PaginaDeLaHoja({ entrada }: { entrada: EntradaMenu }) {
  const location = useLocation()
  const activa = esActiva(location.pathname, entrada.href, entrada.exacta)
  const nietos = entrada.hijos ?? []
  return (
    <Box
      component="li"
      sx={{
        py: 0.75,
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        '&:first-of-type': { borderTop: 'none', pt: 0 },
        '&:last-of-type': { pb: 0 },
      }}
    >
      <Box
        component={Link}
        to={entrada.href}
        aria-current={activa ? 'page' : undefined}
        sx={{
          fontFamily: CORMORANT,
          // A la escala del menú (versalitas de 12): con 22 la hoja abultaba más
          // que la barra entera.
          fontSize: 18,
          fontWeight: 600,
          lineHeight: 1.15,
          color: activa ? 'secondary.main' : 'text.primary',
          textDecoration: 'none',
          '&:hover': { color: 'secondary.main' },
          '&:focus-visible': FOCO,
        }}
      >
        {entrada.label}
      </Box>
      {nietos.length > 0 && (
        <Box
          component="ul"
          sx={{
            listStyle: 'none',
            m: 0,
            mt: 0.5,
            p: 0,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            columnGap: 1.5,
            rowGap: 0.25,
          }}
        >
          {nietos.map((nieto) => (
            <Box component="li" key={nieto.href}>
              <SubpaginaDeLaHoja entrada={nieto} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

function SubpaginaDeLaHoja({ entrada }: { entrada: EntradaMenu }) {
  const location = useLocation()
  const activa = esActiva(location.pathname, entrada.href, entrada.exacta)
  return (
    <Box
      component={Link}
      to={entrada.href}
      aria-current={activa ? 'page' : undefined}
      sx={{
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.3,
        color: activa ? 'secondary.main' : 'text.secondary',
        textDecoration: 'none',
        '&:hover': { color: 'secondary.main' },
        '&:focus-visible': FOCO,
      }}
    >
      {entrada.label}
    </Box>
  )
}

/**
 * La hoja de una sección: cristal oscuro de esquinas rectas, como los botones
 * de la web, con una flecha dorada que señala su título (la sección abierta no
 * lleva más marca: la flecha ya dice cuál es). El relleno de arriba cubre el
 * hueco hasta el título, para que el ratón pueda bajar a las páginas sin que se
 * cierre.
 */
function Hoja({ hijos }: { hijos: EntradaMenu[] }) {
  return (
    // El título acaba en el espaciado de su última letra: sin restarlo, la
    // flecha caía un poco a la derecha de la palabra.
    <Box sx={{ position: 'absolute', top: '100%', left: 'calc(50% - 1px)', transform: 'translateX(-50%)', pt: '10px', zIndex: 1 }}>
      <Box
        component="svg"
        viewBox="0 0 12 6"
        aria-hidden
        sx={{ position: 'absolute', top: '4px', left: '50%', transform: 'translateX(-50%)', width: 12, height: 6, display: 'block', color: 'secondary.main' }}
      >
        <path d="M0 6L6 0l6 6z" fill="currentColor" />
      </Box>
      <Box
        component="ul"
        sx={{
          ...cristal,
          listStyle: 'none',
          m: 0,
          p: '12px 20px',
          // Ajustada a sus nombres y con ellos centrados bajo la flecha.
          width: 'max-content',
          maxWidth: 300,
          border: VIDRIO.borde,
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 24px 48px -18px rgba(0, 0, 0, 0.7)',
          textAlign: 'center',
        }}
      >
        {hijos.map((hijo) => (
          <PaginaDeLaHoja key={hijo.href} entrada={hijo} />
        ))}
      </Box>
    </Box>
  )
}

/**
 * Entrada de primer nivel del menú de escritorio. Si tiene subpáginas, despliega
 * su hoja al pasar el ratón o al llegar con el teclado; Escape la cierra y
 * devuelve el foco a la sección.
 */
function SeccionEscritorio({ entrada }: { entrada: EntradaMenu }) {
  const location = useLocation()
  // Se guarda la ruta en la que se abrió: al navegar deja de coincidir y la hoja
  // se cierra sola, sin efecto ni `setState` en cascada.
  const [abiertaEn, setAbiertaEn] = useState<string | null>(null)
  const abierta = abiertaEn === location.pathname
  const setAbierta = (valor: boolean) => setAbiertaEn(valor ? location.pathname : null)
  const enlaceRef = useRef<HTMLButtonElement>(null)
  const hijos = entrada.hijos ?? []
  const desplegable = hijos.length > 0
  const activa = seccionActiva(location.pathname, entrada)

  const vieneDeFuera = (e: FocusEvent<HTMLDivElement>) => !e.currentTarget.contains(e.relatedTarget as Node | null)

  const alPulsarTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return
    setAbierta(false)
    enlaceRef.current?.focus()
  }

  return (
    <Box
      sx={{ position: 'relative', flexShrink: 0, display: 'flex' }}
      onMouseEnter={desplegable ? () => setAbierta(true) : undefined}
      onMouseLeave={desplegable ? () => setAbierta(false) : undefined}
      onFocus={desplegable ? (e) => { if (vieneDeFuera(e)) setAbierta(true) } : undefined}
      onBlur={desplegable ? (e) => { if (vieneDeFuera(e)) setAbierta(false) } : undefined}
      onKeyDown={desplegable ? alPulsarTecla : undefined}
    >
      <Button
        ref={enlaceRef}
        {...(desplegable
          ? { disableRipple: true, tabIndex: 0 }
          : { component: Link, to: entrada.href })}
        // Sin esto, Enter y Espacio no hacían nada y, tras cerrar con Escape, no
        // había forma de reabrir sin salir de la sección. `detail === 0` es una
        // pulsación de teclado: alterna. Con el ratón la hoja ya se abrió al
        // pasar por encima, y un clic no debe cerrarla.
        onClick={desplegable ? (e: React.MouseEvent) => setAbierta(e.detail === 0 ? !abierta : true) : undefined}
        aria-haspopup={desplegable ? 'true' : undefined}
        aria-expanded={desplegable ? abierta : undefined}
        sx={{
          position: 'relative',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          lineHeight: 1,
          height: ALTO_MENU,
          px: 0,
          minWidth: 'auto',
          borderRadius: 0,
          // En oro solo la sección de la página que se ve: dos oros a la vez no
          // decían cuál era cuál. La abierta la señala la flecha de su hoja.
          color: activa ? 'secondary.main' : 'text.primary',
          // El título que despliega no se pulsa: sin la mano del enlace.
          cursor: desplegable ? 'default' : 'pointer',
          // La sección de la página que se ve, subrayada (el color solo no basta).
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            // Sin el espaciado de la última letra, que deja la raya descentrada.
            right: '0.18em',
            bottom: 0,
            height: 2,
            backgroundColor: 'secondary.main',
            transform: activa ? 'scaleX(1)' : 'scaleX(0)',
            transformOrigin: 'center',
            transition: 'transform 0.25s ease',
          },
          '&:hover': { color: 'secondary.main', backgroundColor: 'transparent' },
          // disableRipple quita también la marca de foco de MUI: se pone la de la web.
          '&.Mui-focusVisible': FOCO,
          [compactMq]: { fontSize: '11.5px', letterSpacing: '0.14em', '&::after': { right: '0.14em' } },
          [estrechoMq]: { fontSize: '11px', letterSpacing: '0.1em', '&::after': { right: '0.1em' } },
        }}
      >
        {entrada.label}
      </Button>

      {desplegable && abierta && <Hoja hijos={hijos} />}
    </Box>
  )
}

/** Todas las secciones, en una fila centrada bajo un filete burdeos. */
export default function MenuEscritorio() {
  const menu = useMenuPublico()
  return (
    <Box
      component="nav"
      aria-label="Navegación principal"
      sx={{
        height: ALTO_MENU,
        mx: '40px',
        // El burdeos vivo y no el de los botones: sobre la barra casi negra,
        // aquel se pierde; este, más vivo, se lee como el mismo color.
        borderTop: `1px solid ${MARCA.principalVivo}`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'stretch',
        flexWrap: 'nowrap',
        gap: '44px',
        [compactMq]: { mx: '24px', gap: '30px' },
        [estrechoMq]: { gap: '20px' },
      }}
    >
      {menu.map((entrada) => (
        <SeccionEscritorio key={entrada.href} entrada={entrada} />
      ))}
    </Box>
  )
}
