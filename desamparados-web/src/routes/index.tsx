import { Suspense, lazy } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet, ScrollRestoration } from 'react-router-dom'
import CargandoPagina from '../components/CargandoPagina'
import PublicLayout from '../app/PublicLayout'
import AuthLayout from '../app/AuthLayout'
import BrotherLayout from '../app/BrotherLayout'
import RequireAuth from './RequireAuth'
import RequireRole from './RequireRole'
import AdminLayout from '../app/AdminLayout'
import { rolesPorRutaCms } from '../app/cmsNavegacion'
import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'

// Public pages
const HomePage = lazy(() => import('../features/inicio/HomePage'))
const CorporationPage = lazy(() => import('../features/corporacion/CorporationPage'))
const HistoryPage = lazy(() => import('../features/corporacion/history/HistoryPage'))
const GovernmentPage = lazy(() => import('../features/corporacion/government/GovernmentPage'))
const ParishPage = lazy(() => import('../features/corporacion/parish/ParishPage'))
const PurposesPage = lazy(() => import('../features/corporacion/purposes/PurposesPage'))
const CaridadPage = lazy(() => import('../features/corporacion/purposes/CaridadPage'))
const FormacionPage = lazy(() => import('../features/corporacion/purposes/FormacionPage'))
const CultsPage = lazy(() => import('../features/corporacion/cults/CultsPage'))
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
const ContactPage = lazy(() => import('../features/contacto/ContactPage'))
const NotFoundPage = lazy(() => import('../features/noEncontrado/NotFoundPage'))
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
const LegalNoticePage = lazy(() => import('../features/legal/LegalNoticePage'))
const PrivacyPolicyPage = lazy(() => import('../features/legal/PrivacyPolicyPage'))
const CookiesPolicyPage = lazy(() => import('../features/legal/CookiesPolicyPage'))

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
        element: <PublicLayout />,
        children: [
          { index: true, element: withSuspense(HomePage) },
          { path: 'corporacion', element: withSuspense(CorporationPage) },
          { path: 'corporacion/historia', element: withSuspense(HistoryPage) },
          { path: 'corporacion/historia/organos-de-gobierno', element: withSuspense(GovernmentPage) },
          { path: 'corporacion/parroquia-pasionistas', element: withSuspense(ParishPage) },
          { path: 'corporacion/nuestros-fines', element: withSuspense(PurposesPage) },
          { path: 'corporacion/nuestros-fines/caridad', element: withSuspense(CaridadPage) },
          { path: 'corporacion/nuestros-fines/formacion', element: withSuspense(FormacionPage) },
          { path: 'corporacion/cultos', element: withSuspense(CultsPage) },
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
          { path: 'contacto', element: withSuspense(ContactPage) },
          { path: 'aviso-legal', element: withSuspense(LegalNoticePage) },
          { path: 'politica-privacidad', element: withSuspense(PrivacyPolicyPage) },
          { path: 'politica-cookies', element: withSuspense(CookiesPolicyPage) },
          // 404 real (con cabecera y pie): antes cualquier URL errónea redirigía a la portada
          { path: '*', element: withSuspense(NotFoundPage) },
        ],
      },
      {
        path: '/hermanos/acceso',
        element: <AuthLayout />,
        children: [{ index: true, element: withSuspense(AccesoPage) }],
      },
      {
        path: '/reset-password',
        element: <AuthLayout />,
        children: [{ index: true, element: withSuspense(NuevaContrasenaPage) }],
      },
      {
        path: '/area-hermano',
        element: (
          <RequireAuth>
            <BrotherLayout />
          </RequireAuth>
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
        element: <RequireRole roles={rolesPorRutaCms.panel}><AdminLayout /></RequireRole>,
        children: [
          { index: true, element: withSuspense(PanelPage) },
          { path: 'mi-seguridad', element: <RequireRole roles={rolesPorRutaCms['mi-seguridad']}>{withSuspense(MiSeguridadPage)}</RequireRole> },
          { path: 'paginas', element: <RequireRole roles={rolesPorRutaCms.paginas}>{withSuspense(PaginasAdminPage)}</RequireRole> },
          { path: 'paginas/:slug', element: <RequireRole roles={rolesPorRutaCms['paginas/corporacion']}>{withSuspense(PaginaAdminPage)}</RequireRole> },
          { path: 'portada', element: <RequireRole roles={rolesPorRutaCms.portada}>{withSuspense(PortadaAdminPage)}</RequireRole> },
          // Historia se edita ya como las demás páginas; la dirección vieja sigue llevando a ella.
          { path: 'historia', element: <Navigate to="/cms/paginas/historia" replace /> },
          { path: 'noticias', element: <RequireRole roles={rolesPorRutaCms.noticias}>{withSuspense(NoticiasAdminPage)}</RequireRole> },
          { path: 'noticias/nueva', element: <RequireRole roles={rolesPorRutaCms.noticias}>{withSuspense(NoticiaEditPage)}</RequireRole> },
          { path: 'noticias/:id/editar', element: <RequireRole roles={rolesPorRutaCms.noticias}>{withSuspense(NoticiaEditPage)}</RequireRole> },
          { path: 'publicaciones', element: <RequireRole roles={rolesPorRutaCms.publicaciones}>{withSuspense(PublicacionesAdminPage)}</RequireRole> },
          { path: 'publicaciones/nueva', element: <RequireRole roles={rolesPorRutaCms.publicaciones}>{withSuspense(PublicacionEditPage)}</RequireRole> },
          { path: 'publicaciones/:id/editar', element: <RequireRole roles={rolesPorRutaCms.publicaciones}>{withSuspense(PublicacionEditPage)}</RequireRole> },
          { path: 'agenda', element: <RequireRole roles={rolesPorRutaCms.agenda}>{withSuspense(AgendaAdminPage)}</RequireRole> },
          { path: 'agenda/nuevo', element: <RequireRole roles={rolesPorRutaCms.agenda}>{withSuspense(AgendaEditPage)}</RequireRole> },
          { path: 'agenda/:id/editar', element: <RequireRole roles={rolesPorRutaCms.agenda}>{withSuspense(AgendaEditPage)}</RequireRole> },
          { path: 'hermanos', element: <RequireRole roles={rolesPorRutaCms.hermanos}>{withSuspense(HermanosAdminPage)}</RequireRole> },
          { path: 'hermanos/:id/editar', element: <RequireRole roles={rolesPorRutaCms.hermanos}>{withSuspense(HermanoEditPage)}</RequireRole> },
          { path: 'tesoreria', element: <RequireRole roles={rolesPorRutaCms.tesoreria}>{withSuspense(TesoreriaAdminPage)}</RequireRole> },
          { path: 'inventario', element: <RequireRole roles={rolesPorRutaCms.inventario}>{withSuspense(InventarioAdminPage)}</RequireRole> },
          { path: 'inventario/:id/editar', element: <RequireRole roles={rolesPorRutaCms.inventario}>{withSuspense(InventarioEditPage)}</RequireRole> },
          { path: 'contabilidad', element: <RequireRole roles={rolesPorRutaCms.contabilidad}>{withSuspense(ContabilidadAdminPage)}</RequireRole> },
          { path: 'accesos', element: <RequireRole roles={rolesPorRutaCms.accesos}>{withSuspense(AccesosAdminPage)}</RequireRole> },
          { path: 'auditoria', element: <RequireRole roles={rolesPorRutaCms.auditoria}>{withSuspense(AuditoriaAdminPage)}</RequireRole> },
        ],
      },
    ],
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
