import { Suspense, lazy } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet, ScrollRestoration } from 'react-router-dom'
import CargandoPagina from '../components/CargandoPagina'
import MarcoPublico from '../app/MarcoPublico'
import MarcoAcceso from '../app/MarcoAcceso'
import MarcoAreaHermano from '../app/MarcoAreaHermano'
import ExigeSesion from './ExigeSesion'
import ExigeRol from './ExigeRol'
import DireccionAntigua from './DireccionAntigua'
import MarcoCms from '../app/MarcoCms'
import { rolesPorRutaCms } from '../app/cmsNavegacion'
import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import { site } from '../config/site'

// Public pages
const InicioPage = lazy(() => import('../features/inicio/InicioPage'))
const HistoriaPage = lazy(() => import('../features/corporacion/historia/HistoriaPage'))
const OrganosDeGobiernoPage = lazy(() => import('../features/corporacion/gobierno/OrganosDeGobiernoPage'))
const ParroquiaPage = lazy(() => import('../features/corporacion/parroquia/ParroquiaPage'))
const NuestrosFinesPage = lazy(() => import('../features/corporacion/fines/NuestrosFinesPage'))
const CaridadPage = lazy(() => import('../features/corporacion/fines/CaridadPage'))
const FormacionPage = lazy(() => import('../features/corporacion/fines/FormacionPage'))
const CultosPage = lazy(() => import('../features/corporacion/cultos/CultosPage'))
const RosarioPage = lazy(() => import('../features/corporacion/rosario/RosarioPage'))
const SabadoPasionPage = lazy(() => import('../features/corporacion/sabado-pasion/SabadoPasionPage'))
const RecorridoPage = lazy(() => import('../features/corporacion/sabado-pasion/RecorridoPage'))
const TronoPage = lazy(() => import('../features/corporacion/sabado-pasion/TronoPage'))
const EnseresPage = lazy(() => import('../features/corporacion/sabado-pasion/EnseresPage'))
const DesamparadosPage = lazy(() => import('../features/titular/DesamparadosPage'))
const AjuarPage = lazy(() => import('../features/titular/AjuarPage'))
const AgendaPage = lazy(() => import('../features/actualidad/agenda/AgendaPage'))
const NoticiasPage = lazy(() => import('../features/actualidad/noticias/NoticiasPage'))
const NoticiaDetallePage = lazy(() => import('../features/actualidad/noticias/NoticiaDetallePage'))
const PublicacionesPage = lazy(() => import('../features/publicaciones/PublicacionesPage'))
const BoletinesPage = lazy(() => import('../features/publicaciones/BoletinesPage'))
const DossierPrensaPage = lazy(() => import('../features/publicaciones/DossierPrensaPage'))
const HazteHermanoPage = lazy(() => import('../features/altas/public/HazteHermanoPage'))
const ContactoPage = lazy(() => import('../features/contacto/ContactoPage'))
const NoEncontradaPage = lazy(() => import('../features/noEncontrado/NoEncontradaPage'))
const PaginaEnVivo = lazy(() => import('../features/cms/constructor/PaginaEnVivo'))
const PortadaAdminPage = lazy(() => import('../features/cms/PortadaAdminPage'))
const PaginasAdminPage = lazy(() => import('../features/cms/PaginasAdminPage'))
const PaginaAdminPage = lazy(() => import('../features/cms/PaginaAdminPage'))
const NoticiasAdminPage = lazy(() => import('../features/cms/NoticiasAdminPage'))
const PublicacionesAdminPage = lazy(() => import('../features/cms/PublicacionesAdminPage'))
const AgendaAdminPage = lazy(() => import('../features/cms/AgendaAdminPage'))
const HermanosAdminPage = lazy(() => import('../features/cms/HermanosAdminPage'))
const ProcesionAdminPage = lazy(() => import('../features/cms/ProcesionAdminPage'))
const SalidasAdminPage = lazy(() => import('../features/cms/salidas/SalidasAdminPage'))
const SalidaEditPage = lazy(() => import('../features/cms/salidas/SalidaEditPage'))
const MesaProcesionPage = lazy(() => import('../features/cms/mesa/MesaProcesionPage'))
const CortejoDirectoPage = lazy(() => import('../features/cms/CortejoDirectoPage'))
const PuertaTemploPage = lazy(() => import('../features/cms/puerta/PuertaTemploPage'))
const HermanoEditPage = lazy(() => import('../features/cms/HermanoEditPage'))
const NoticiaEditPage = lazy(() => import('../features/cms/NoticiaEditPage'))
const ComunicadosAdminPage = lazy(() => import('../features/cms/ComunicadosAdminPage'))
const ComunicadoEditPage = lazy(() => import('../features/cms/ComunicadoEditPage'))
const CabildosAdminPage = lazy(() => import('../features/cms/CabildosAdminPage'))
const CabildoPage = lazy(() => import('../features/cms/CabildoPage'))
const PartidaDoblePage = lazy(() => import('../features/cms/PartidaDoblePage'))
const TiendaAdminPage = lazy(() => import('../features/cms/TiendaAdminPage'))
const LoteriaAdminPage = lazy(() => import('../features/cms/loteria/LoteriaAdminPage'))
const ApadrinamientosAdminPage = lazy(() => import('../features/cms/ApadrinamientosAdminPage'))
const CampanaApadrinamientoPage = lazy(() => import('../features/cms/CampanaApadrinamientoPage'))
const PublicacionEditPage = lazy(() => import('../features/cms/PublicacionEditPage'))
const AgendaEditPage = lazy(() => import('../features/cms/AgendaEditPage'))
const InventarioEditPage = lazy(() => import('../features/cms/InventarioEditPage'))
const TesoreriaAdminPage = lazy(() => import('../features/cms/TesoreriaAdminPage'))
const InventarioAdminPage = lazy(() => import('../features/cms/InventarioAdminPage'))
const ContabilidadAdminPage = lazy(() => import('../features/cms/ContabilidadAdminPage'))
const AuditoriaAdminPage = lazy(() => import('../features/cms/AuditoriaAdminPage'))
const AjustesInicioPage = lazy(() => import('../features/cms/AjustesInicioPage'))
const DatosInformesPage = lazy(() => import('../features/cms/datos/DatosInformesPage'))
const InformeAnualPage = lazy(() => import('../features/cms/datos/InformeAnualPage'))
const CartasPage = lazy(() => import('../features/cms/cartas/CartasPage'))
const AccesosAdminPage = lazy(() => import('../features/cms/AccesosAdminPage'))
const PanelPage = lazy(() => import('../features/cms/PanelPage'))
const MiSeguridadPage = lazy(() => import('../features/cms/MiSeguridadPage'))

// Legal pages
const AvisoLegalPage = lazy(() => import('../features/legal/AvisoLegalPage'))
const PoliticaDePrivacidadPage = lazy(() => import('../features/legal/PoliticaDePrivacidadPage'))
const PoliticaDeCookiesPage = lazy(() => import('../features/legal/PoliticaDeCookiesPage'))
const BajaBoletinPage = lazy(() => import('../features/boletin/BajaBoletinPage'))
const TiendaPage = lazy(() => import('../features/tienda/TiendaPage'))
const PedidoTiendaPage = lazy(() => import('../features/tienda/PedidoTiendaPage'))
const ApadrinaPage = lazy(() => import('../features/apadrinamiento/ApadrinaPage'))
const GraciasApadrinamientoPage = lazy(() => import('../features/apadrinamiento/GraciasApadrinamientoPage'))

// Auth pages
const AccesoPage = lazy(() => import('../features/altas/auth/AccesoPage'))
const AccesoCmsPage = lazy(() => import('../features/altas/auth/AccesoCmsPage'))
const NuevaContrasenaPage = lazy(() => import('../features/altas/auth/NuevaContrasenaPage'))

// Brother area pages
const PerfilPage = lazy(() => import('../features/areaHermano/perfil/PerfilPage'))
const FamiliaPage = lazy(() => import('../features/areaHermano/familia/FamiliaPage'))
const ProcesionPage = lazy(() => import('../features/areaHermano/procesion/ProcesionPage'))
const HistoricoPage = lazy(() => import('../features/areaHermano/procesion/HistoricoPage'))
const RecibosPage = lazy(() => import('../features/areaHermano/recibos/RecibosPage'))
const ReciboPage = lazy(() => import('../features/areaHermano/recibos/ReciboPage'))

function withSuspense(Component: React.ComponentType) {
  return (
    <Suspense fallback={<CargandoPagina />}>
      <Component />
    </Suspense>
  )
}

/**
 * Layout raíz: restaura el scroll al cambiar de ruta (vuelve arriba en navegaciones
 * nuevas y recupera la posición al usar atrás/adelante). Sin esto, las páginas
 * aparecían con el scroll a mitad.
 */
function RootLayout() {
  const location = useLocation()
  const canonical = `${site.url}${location.pathname === '/' ? '/' : location.pathname.replace(/\/$/, '')}`
  return (
    <>
      <Helmet>
        <link rel="canonical" href={canonical} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content={site.nombre} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${site.url}/images/hero-1920.webp`} />
      </Helmet>
      <ScrollRestoration />
      <Outlet />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <MarcoPublico />,
        children: [
          { index: true, element: withSuspense(InicioPage) },
          { path: 'historia', element: withSuspense(HistoriaPage) },
          { path: 'historia/organos-de-gobierno', element: withSuspense(OrganosDeGobiernoPage) },
          { path: 'parroquia-pasionistas', element: withSuspense(ParroquiaPage) },
          { path: 'nuestros-fines', element: withSuspense(NuestrosFinesPage) },
          { path: 'nuestros-fines/caridad', element: withSuspense(CaridadPage) },
          { path: 'nuestros-fines/formacion', element: withSuspense(FormacionPage) },
          { path: 'cultos', element: withSuspense(CultosPage) },
          { path: 'sabado-de-pasion', element: withSuspense(SabadoPasionPage) },
          { path: 'sabado-de-pasion/recorrido', element: withSuspense(RecorridoPage) },
          { path: 'sabado-de-pasion/trono', element: withSuspense(TronoPage) },
          { path: 'sabado-de-pasion/enseres', element: withSuspense(EnseresPage) },
          { path: 'rosario', element: withSuspense(RosarioPage) },
          { path: 'desamparados', element: withSuspense(DesamparadosPage) },
          { path: 'ajuar', element: withSuspense(AjuarPage) },
          { path: 'agenda', element: withSuspense(AgendaPage) },
          { path: 'noticias', element: withSuspense(NoticiasPage) },
          { path: 'noticias/:slug', element: withSuspense(NoticiaDetallePage) },
          { path: 'publicaciones', element: withSuspense(PublicacionesPage) },
          { path: 'publicaciones/boletines', element: withSuspense(BoletinesPage) },
          { path: 'publicaciones/dossier-prensa', element: withSuspense(DossierPrensaPage) },
          { path: 'hazte-hermano', element: withSuspense(HazteHermanoPage) },
          { path: 'contacto', element: withSuspense(ContactoPage) },
          { path: 'tienda', element: withSuspense(TiendaPage) },
          { path: 'tienda/pedido/:token', element: withSuspense(PedidoTiendaPage) },
          { path: 'apadrina', element: withSuspense(ApadrinaPage) },
          { path: 'apadrina/gracias/:token', element: withSuspense(GraciasApadrinamientoPage) },
          { path: 'aviso-legal', element: withSuspense(AvisoLegalPage) },
          { path: 'politica-privacidad', element: withSuspense(PoliticaDePrivacidadPage) },
          { path: 'politica-cookies', element: withSuspense(PoliticaDeCookiesPage) },
          // Las direcciones de antes de quitar las portadas de sección (25-09-2026):
          // /corporacion/historia sigue llevando a /historia, y así con todas.
          { path: 'corporacion/*', element: <DireccionAntigua /> },
          { path: 'sagrada-titular/*', element: <DireccionAntigua /> },
          { path: 'actualidad/*', element: <DireccionAntigua /> },
          { path: 'hermanos/*', element: <DireccionAntigua /> },
          // 404 real (con cabecera y pie): antes cualquier URL errónea redirigía a la portada
          { path: '*', element: withSuspense(NoEncontradaPage) },
        ],
      },
      // La baja del boletín, desde el enlace de cada correo y sin sesión. Con el
      // marco público, pero FUERA del bloque de arriba a propósito: es un enlace
      // de un solo uso, no una página que buscar, y el sitemap (y su prueba)
      // recorren ese bloque entero.
      {
        path: '/boletin/baja',
        element: <MarcoPublico />,
        children: [{ index: true, element: withSuspense(BajaBoletinPage) }],
      },
      {
        path: '/acceso',
        element: <MarcoAcceso />,
        children: [{ index: true, element: withSuspense(AccesoPage) }],
      },
      {
        path: '/reset-password',
        element: <MarcoAcceso />,
        children: [{ index: true, element: withSuspense(NuevaContrasenaPage) }],
      },
      {
        path: '/area-hermano',
        element: (
          <ExigeSesion>
            <MarcoAreaHermano />
          </ExigeSesion>
        ),
        children: [
          { index: true, element: <Navigate to="/area-hermano/perfil" replace /> },
          { path: 'perfil', element: withSuspense(PerfilPage) },
          // La edición se hace ya en el propio perfil, apartado a apartado.
          { path: 'perfil/editar', element: <Navigate to="/area-hermano/perfil" replace /> },
          { path: 'familia', element: withSuspense(FamiliaPage) },
          { path: 'procesion', element: withSuspense(ProcesionPage) },
          // La papeleta se pide y se consulta ya en la propia página de Procesión.
          { path: 'procesion/papeleta', element: <Navigate to="/area-hermano/procesion" replace /> },
          { path: 'procesion/historico', element: withSuspense(HistoricoPage) },
          { path: 'recibos', element: withSuspense(RecibosPage) },
          { path: 'recibos/:id', element: withSuspense(ReciboPage) },
          { path: '*', element: <Navigate to="/area-hermano/perfil" replace /> },
        ],
      },
      {
        // La vista en vivo del constructor de páginas: la página pública con lo
        // que se está escribiendo, dentro de un iframe del propio CMS. Va fuera
        // de <MarcoCms /> (sin menú del CMS) y fuera de <MarcoPublico /> (sin la
        // barra ni el pie ni el aviso de cookies de la web).
        path: '/cms/vista-previa/:slug',
        element: <ExigeRol roles={rolesPorRutaCms['paginas/:slug']}>{withSuspense(PaginaEnVivo)}</ExigeRol>,
      },
      {
        path: '/cms/acceso',
        element: withSuspense(AccesoCmsPage),
      },
      {
        path: '/cms',
        element: <ExigeRol roles={rolesPorRutaCms.panel}><MarcoCms /></ExigeRol>,
        children: [
          { index: true, element: withSuspense(PanelPage) },
          { path: 'mi-seguridad', element: <ExigeRol roles={rolesPorRutaCms['mi-seguridad']}>{withSuspense(MiSeguridadPage)}</ExigeRol> },
          { path: 'paginas', element: <ExigeRol roles={rolesPorRutaCms.paginas}>{withSuspense(PaginasAdminPage)}</ExigeRol> },
          { path: 'paginas/:slug', element: <ExigeRol roles={rolesPorRutaCms['paginas/:slug']}>{withSuspense(PaginaAdminPage)}</ExigeRol> },
          { path: 'portada', element: <ExigeRol roles={rolesPorRutaCms.portada}>{withSuspense(PortadaAdminPage)}</ExigeRol> },
          // Historia se edita ya como las demás páginas; la dirección vieja sigue llevando a ella.
          { path: 'historia', element: <Navigate to="/cms/paginas/historia" replace /> },
          { path: 'noticias', element: <ExigeRol roles={rolesPorRutaCms.noticias}>{withSuspense(NoticiasAdminPage)}</ExigeRol> },
          { path: 'comunicados', element: <ExigeRol roles={rolesPorRutaCms.comunicados}>{withSuspense(ComunicadosAdminPage)}</ExigeRol> },
          { path: 'comunicados/:id', element: <ExigeRol roles={rolesPorRutaCms.comunicados}>{withSuspense(ComunicadoEditPage)}</ExigeRol> },
          { path: 'cabildos', element: <ExigeRol roles={rolesPorRutaCms.cabildos}>{withSuspense(CabildosAdminPage)}</ExigeRol> },
          { path: 'cabildos/:id', element: <ExigeRol roles={rolesPorRutaCms.cabildos}>{withSuspense(CabildoPage)}</ExigeRol> },
          { path: 'noticias/nueva', element: <ExigeRol roles={rolesPorRutaCms.noticias}>{withSuspense(NoticiaEditPage)}</ExigeRol> },
          { path: 'noticias/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.noticias}>{withSuspense(NoticiaEditPage)}</ExigeRol> },
          { path: 'publicaciones', element: <ExigeRol roles={rolesPorRutaCms.publicaciones}>{withSuspense(PublicacionesAdminPage)}</ExigeRol> },
          { path: 'publicaciones/nueva', element: <ExigeRol roles={rolesPorRutaCms.publicaciones}>{withSuspense(PublicacionEditPage)}</ExigeRol> },
          { path: 'publicaciones/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.publicaciones}>{withSuspense(PublicacionEditPage)}</ExigeRol> },
          { path: 'agenda', element: <ExigeRol roles={rolesPorRutaCms.agenda}>{withSuspense(AgendaAdminPage)}</ExigeRol> },
          { path: 'agenda/nuevo', element: <ExigeRol roles={rolesPorRutaCms.agenda}>{withSuspense(AgendaEditPage)}</ExigeRol> },
          { path: 'agenda/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.agenda}>{withSuspense(AgendaEditPage)}</ExigeRol> },
          { path: 'hermanos', element: <ExigeRol roles={rolesPorRutaCms.hermanos}>{withSuspense(HermanosAdminPage)}</ExigeRol> },
          { path: ':id/editar', element: <ExigeRol roles={rolesPorRutaCms.hermanos}>{withSuspense(HermanoEditPage)}</ExigeRol> },
          { path: 'procesion', element: <ExigeRol roles={rolesPorRutaCms.procesion}>{withSuspense(ProcesionAdminPage)}</ExigeRol> },
          { path: 'procesion/salidas', element: <ExigeRol roles={rolesPorRutaCms['procesion/salidas']}>{withSuspense(SalidasAdminPage)}</ExigeRol> },
          { path: 'procesion/salidas/:id/editar', element: <ExigeRol roles={rolesPorRutaCms['procesion/salidas']}>{withSuspense(SalidaEditPage)}</ExigeRol> },
          { path: 'procesion/mesa', element: <ExigeRol roles={rolesPorRutaCms['procesion/mesa']}>{withSuspense(MesaProcesionPage)}</ExigeRol> },
          { path: 'procesion/puerta', element: <ExigeRol roles={rolesPorRutaCms['procesion/puerta']}>{withSuspense(PuertaTemploPage)}</ExigeRol> },
          { path: 'procesion/directo', element: <ExigeRol roles={rolesPorRutaCms['procesion/directo']}>{withSuspense(CortejoDirectoPage)}</ExigeRol> },
          { path: 'tesoreria', element: <ExigeRol roles={rolesPorRutaCms.tesoreria}>{withSuspense(TesoreriaAdminPage)}</ExigeRol> },
          { path: 'inventario', element: <ExigeRol roles={rolesPorRutaCms.inventario}>{withSuspense(InventarioAdminPage)}</ExigeRol> },
          { path: 'inventario/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.inventario}>{withSuspense(InventarioEditPage)}</ExigeRol> },
          { path: 'contabilidad', element: <ExigeRol roles={rolesPorRutaCms.contabilidad}>{withSuspense(ContabilidadAdminPage)}</ExigeRol> },
          { path: 'contabilidad/partida-doble', element: <ExigeRol roles={rolesPorRutaCms.contabilidad}>{withSuspense(PartidaDoblePage)}</ExigeRol> },
          { path: 'tienda', element: <ExigeRol roles={rolesPorRutaCms.tienda}>{withSuspense(TiendaAdminPage)}</ExigeRol> },
          { path: 'loteria', element: <ExigeRol roles={rolesPorRutaCms.loteria}>{withSuspense(LoteriaAdminPage)}</ExigeRol> },
          { path: 'apadrinamientos', element: <ExigeRol roles={rolesPorRutaCms.apadrinamientos}>{withSuspense(ApadrinamientosAdminPage)}</ExigeRol> },
          { path: 'apadrinamientos/:id', element: <ExigeRol roles={rolesPorRutaCms.apadrinamientos}>{withSuspense(CampanaApadrinamientoPage)}</ExigeRol> },
          { path: 'datos', element: <ExigeRol roles={rolesPorRutaCms.datos}>{withSuspense(DatosInformesPage)}</ExigeRol> },
          { path: 'cartas', element: <ExigeRol roles={rolesPorRutaCms.cartas}>{withSuspense(CartasPage)}</ExigeRol> },
          { path: 'informe-anual', element: <ExigeRol roles={rolesPorRutaCms['informe-anual']}>{withSuspense(InformeAnualPage)}</ExigeRol> },
          { path: 'informe-anual/:anio', element: <ExigeRol roles={rolesPorRutaCms['informe-anual/:anio']}>{withSuspense(InformeAnualPage)}</ExigeRol> },
          { path: 'accesos', element: <ExigeRol roles={rolesPorRutaCms.accesos}>{withSuspense(AccesosAdminPage)}</ExigeRol> },
          { path: 'auditoria', element: <ExigeRol roles={rolesPorRutaCms.auditoria}>{withSuspense(AuditoriaAdminPage)}</ExigeRol> },
          { path: 'ajustes-inicio', element: <ExigeRol roles={rolesPorRutaCms['ajustes-inicio']}>{withSuspense(AjustesInicioPage)}</ExigeRol> },
        ],
      },
    ],
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
