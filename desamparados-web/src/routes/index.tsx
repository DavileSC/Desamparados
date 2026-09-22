import { Suspense, lazy } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet, ScrollRestoration } from 'react-router-dom'
import CargandoPagina from '../components/CargandoPagina'
import MarcoPublico from '../app/MarcoPublico'
import MarcoAcceso from '../app/MarcoAcceso'
import MarcoAreaHermano from '../app/MarcoAreaHermano'
import ExigeSesion from './ExigeSesion'
import ExigeRol from './ExigeRol'
import MarcoCms from '../app/MarcoCms'
import { rolesPorRutaCms } from '../app/cmsNavegacion'
import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'

// Public pages
const InicioPage = lazy(() => import('../features/inicio/InicioPage'))
const CorporacionPage = lazy(() => import('../features/corporacion/CorporacionPage'))
const HistoriaPage = lazy(() => import('../features/corporacion/historia/HistoriaPage'))
const OrganosDeGobiernoPage = lazy(() => import('../features/corporacion/gobierno/OrganosDeGobiernoPage'))
const ParroquiaPage = lazy(() => import('../features/corporacion/parroquia/ParroquiaPage'))
const NuestrosFinesPage = lazy(() => import('../features/corporacion/fines/NuestrosFinesPage'))
const CaridadPage = lazy(() => import('../features/corporacion/fines/CaridadPage'))
const FormacionPage = lazy(() => import('../features/corporacion/fines/FormacionPage'))
const CultosPage = lazy(() => import('../features/corporacion/cultos/CultosPage'))
const SabadoPasionPage = lazy(() => import('../features/corporacion/sabado-pasion/SabadoPasionPage'))
const RecorridoPage = lazy(() => import('../features/corporacion/sabado-pasion/RecorridoPage'))
const TronoPage = lazy(() => import('../features/corporacion/sabado-pasion/TronoPage'))
const EnseresPage = lazy(() => import('../features/corporacion/sabado-pasion/EnseresPage'))
const TitularPage = lazy(() => import('../features/titular/TitularPage'))
const DesamparadosPage = lazy(() => import('../features/titular/DesamparadosPage'))
const AjuarPage = lazy(() => import('../features/titular/AjuarPage'))
const ActualidadPage = lazy(() => import('../features/actualidad/ActualidadPage'))
const AgendaPage = lazy(() => import('../features/actualidad/agenda/AgendaPage'))
const NoticiasPage = lazy(() => import('../features/actualidad/noticias/NoticiasPage'))
const NoticiaDetallePage = lazy(() => import('../features/actualidad/noticias/NoticiaDetallePage'))
const PublicacionesPage = lazy(() => import('../features/publicaciones/PublicacionesPage'))
const BoletinesPage = lazy(() => import('../features/publicaciones/BoletinesPage'))
const DossierPrensaPage = lazy(() => import('../features/publicaciones/DossierPrensaPage'))
const HermanosPage = lazy(() => import('../features/altas/public/HermanosPage'))
const HazteHermanoPage = lazy(() => import('../features/altas/public/HazteHermanoPage'))
const ContactoPage = lazy(() => import('../features/contacto/ContactoPage'))
const NoEncontradaPage = lazy(() => import('../features/noEncontrado/NoEncontradaPage'))
const PortadaAdminPage = lazy(() => import('../features/cms/PortadaAdminPage'))
const PaginasAdminPage = lazy(() => import('../features/cms/PaginasAdminPage'))
const PaginaAdminPage = lazy(() => import('../features/cms/PaginaAdminPage'))
const NoticiasAdminPage = lazy(() => import('../features/cms/NoticiasAdminPage'))
const PublicacionesAdminPage = lazy(() => import('../features/cms/PublicacionesAdminPage'))
const AgendaAdminPage = lazy(() => import('../features/cms/AgendaAdminPage'))
const HermanosAdminPage = lazy(() => import('../features/cms/HermanosAdminPage'))
const HermanoEditPage = lazy(() => import('../features/cms/HermanoEditPage'))
const NoticiaEditPage = lazy(() => import('../features/cms/NoticiaEditPage'))
const PublicacionEditPage = lazy(() => import('../features/cms/PublicacionEditPage'))
const AgendaEditPage = lazy(() => import('../features/cms/AgendaEditPage'))
const InventarioEditPage = lazy(() => import('../features/cms/InventarioEditPage'))
const TesoreriaAdminPage = lazy(() => import('../features/cms/TesoreriaAdminPage'))
const InventarioAdminPage = lazy(() => import('../features/cms/InventarioAdminPage'))
const ContabilidadAdminPage = lazy(() => import('../features/cms/ContabilidadAdminPage'))
const AuditoriaAdminPage = lazy(() => import('../features/cms/AuditoriaAdminPage'))
const AccesosAdminPage = lazy(() => import('../features/cms/AccesosAdminPage'))
const PanelPage = lazy(() => import('../features/cms/PanelPage'))
const MiSeguridadPage = lazy(() => import('../features/cms/MiSeguridadPage'))

// Legal pages
const AvisoLegalPage = lazy(() => import('../features/legal/AvisoLegalPage'))
const PoliticaDePrivacidadPage = lazy(() => import('../features/legal/PoliticaDePrivacidadPage'))
const PoliticaDeCookiesPage = lazy(() => import('../features/legal/PoliticaDeCookiesPage'))

// Auth pages
const AccesoPage = lazy(() => import('../features/altas/auth/AccesoPage'))
const AccesoCmsPage = lazy(() => import('../features/altas/auth/AccesoCmsPage'))
const NuevaContrasenaPage = lazy(() => import('../features/altas/auth/NuevaContrasenaPage'))

// Brother area pages
const PerfilPage = lazy(() => import('../features/areaHermano/perfil/PerfilPage'))
const EditarPerfilPage = lazy(() => import('../features/areaHermano/perfil/EditarPerfilPage'))
const FamiliaPage = lazy(() => import('../features/areaHermano/familia/FamiliaPage'))
const ProcesionPage = lazy(() => import('../features/areaHermano/procesion/ProcesionPage'))
const PapeletaPage = lazy(() => import('../features/areaHermano/procesion/PapeletaPage'))
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
  const canonical = `https://www.desamparadosmalaga.com${location.pathname === '/' ? '/' : location.pathname.replace(/\/$/, '')}`
  return (
    <>
      <Helmet>
        <link rel="canonical" href={canonical} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content="Grupo Parroquial de los Desamparados" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.desamparadosmalaga.com/images/hero-1920.webp" />
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
          { path: 'corporacion', element: withSuspense(CorporacionPage) },
          { path: 'corporacion/historia', element: withSuspense(HistoriaPage) },
          { path: 'corporacion/historia/organos-de-gobierno', element: withSuspense(OrganosDeGobiernoPage) },
          { path: 'corporacion/parroquia-pasionistas', element: withSuspense(ParroquiaPage) },
          { path: 'corporacion/nuestros-fines', element: withSuspense(NuestrosFinesPage) },
          { path: 'corporacion/nuestros-fines/caridad', element: withSuspense(CaridadPage) },
          { path: 'corporacion/nuestros-fines/formacion', element: withSuspense(FormacionPage) },
          { path: 'corporacion/cultos', element: withSuspense(CultosPage) },
          { path: 'corporacion/sabado-de-pasion', element: withSuspense(SabadoPasionPage) },
          { path: 'corporacion/sabado-de-pasion/recorrido', element: withSuspense(RecorridoPage) },
          { path: 'corporacion/sabado-de-pasion/trono', element: withSuspense(TronoPage) },
          { path: 'corporacion/sabado-de-pasion/enseres', element: withSuspense(EnseresPage) },
          { path: 'sagrada-titular', element: withSuspense(TitularPage) },
          { path: 'sagrada-titular/desamparados', element: withSuspense(DesamparadosPage) },
          { path: 'sagrada-titular/ajuar', element: withSuspense(AjuarPage) },
          { path: 'actualidad', element: withSuspense(ActualidadPage) },
          { path: 'actualidad/agenda', element: withSuspense(AgendaPage) },
          { path: 'actualidad/noticias', element: withSuspense(NoticiasPage) },
          { path: 'actualidad/noticias/:slug', element: withSuspense(NoticiaDetallePage) },
          { path: 'publicaciones', element: withSuspense(PublicacionesPage) },
          { path: 'publicaciones/boletines', element: withSuspense(BoletinesPage) },
          { path: 'publicaciones/dossier-prensa', element: withSuspense(DossierPrensaPage) },
          { path: 'hermanos', element: withSuspense(HermanosPage) },
          { path: 'hermanos/hazte-hermano', element: withSuspense(HazteHermanoPage) },
          { path: 'contacto', element: withSuspense(ContactoPage) },
          { path: 'aviso-legal', element: withSuspense(AvisoLegalPage) },
          { path: 'politica-privacidad', element: withSuspense(PoliticaDePrivacidadPage) },
          { path: 'politica-cookies', element: withSuspense(PoliticaDeCookiesPage) },
          // 404 real (con cabecera y pie): antes cualquier URL errónea redirigía a la portada
          { path: '*', element: withSuspense(NoEncontradaPage) },
        ],
      },
      {
        path: '/hermanos/acceso',
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
          { path: 'perfil/editar', element: withSuspense(EditarPerfilPage) },
          { path: 'familia', element: withSuspense(FamiliaPage) },
          { path: 'procesion', element: withSuspense(ProcesionPage) },
          { path: 'procesion/papeleta', element: withSuspense(PapeletaPage) },
          { path: 'procesion/historico', element: withSuspense(HistoricoPage) },
          { path: 'recibos', element: withSuspense(RecibosPage) },
          { path: 'recibos/:id', element: withSuspense(ReciboPage) },
          { path: '*', element: <Navigate to="/area-hermano/perfil" replace /> },
        ],
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
          { path: 'paginas/:slug', element: <ExigeRol roles={rolesPorRutaCms['paginas/corporacion']}>{withSuspense(PaginaAdminPage)}</ExigeRol> },
          { path: 'portada', element: <ExigeRol roles={rolesPorRutaCms.portada}>{withSuspense(PortadaAdminPage)}</ExigeRol> },
          // Historia se edita ya como las demás páginas; la dirección vieja sigue llevando a ella.
          { path: 'historia', element: <Navigate to="/cms/paginas/historia" replace /> },
          { path: 'noticias', element: <ExigeRol roles={rolesPorRutaCms.noticias}>{withSuspense(NoticiasAdminPage)}</ExigeRol> },
          { path: 'noticias/nueva', element: <ExigeRol roles={rolesPorRutaCms.noticias}>{withSuspense(NoticiaEditPage)}</ExigeRol> },
          { path: 'noticias/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.noticias}>{withSuspense(NoticiaEditPage)}</ExigeRol> },
          { path: 'publicaciones', element: <ExigeRol roles={rolesPorRutaCms.publicaciones}>{withSuspense(PublicacionesAdminPage)}</ExigeRol> },
          { path: 'publicaciones/nueva', element: <ExigeRol roles={rolesPorRutaCms.publicaciones}>{withSuspense(PublicacionEditPage)}</ExigeRol> },
          { path: 'publicaciones/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.publicaciones}>{withSuspense(PublicacionEditPage)}</ExigeRol> },
          { path: 'agenda', element: <ExigeRol roles={rolesPorRutaCms.agenda}>{withSuspense(AgendaAdminPage)}</ExigeRol> },
          { path: 'agenda/nuevo', element: <ExigeRol roles={rolesPorRutaCms.agenda}>{withSuspense(AgendaEditPage)}</ExigeRol> },
          { path: 'agenda/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.agenda}>{withSuspense(AgendaEditPage)}</ExigeRol> },
          { path: 'hermanos', element: <ExigeRol roles={rolesPorRutaCms.hermanos}>{withSuspense(HermanosAdminPage)}</ExigeRol> },
          { path: 'hermanos/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.hermanos}>{withSuspense(HermanoEditPage)}</ExigeRol> },
          { path: 'tesoreria', element: <ExigeRol roles={rolesPorRutaCms.tesoreria}>{withSuspense(TesoreriaAdminPage)}</ExigeRol> },
          { path: 'inventario', element: <ExigeRol roles={rolesPorRutaCms.inventario}>{withSuspense(InventarioAdminPage)}</ExigeRol> },
          { path: 'inventario/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.inventario}>{withSuspense(InventarioEditPage)}</ExigeRol> },
          { path: 'contabilidad', element: <ExigeRol roles={rolesPorRutaCms.contabilidad}>{withSuspense(ContabilidadAdminPage)}</ExigeRol> },
          { path: 'accesos', element: <ExigeRol roles={rolesPorRutaCms.accesos}>{withSuspense(AccesosAdminPage)}</ExigeRol> },
          { path: 'auditoria', element: <ExigeRol roles={rolesPorRutaCms.auditoria}>{withSuspense(AuditoriaAdminPage)}</ExigeRol> },
        ],
      },
    ],
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
