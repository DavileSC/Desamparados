import { Suspense, lazy } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet, ScrollRestoration } from 'react-router-dom'
import PageLoader from '../components/PageLoader'
import PublicLayout from '../app/PublicLayout'
import AuthLayout from '../app/AuthLayout'
import BrotherLayout from '../app/BrotherLayout'
import RequireAuth from './RequireAuth'
import RequireRole from './RequireRole'
import AdminLayout from '../app/AdminLayout'
import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'

// Public pages
const HomePage = lazy(() => import('../features/home/HomePage'))
const CorporationPage = lazy(() => import('../features/corporation/CorporationPage'))
const HistoryPage = lazy(() => import('../features/corporation/history/HistoryPage'))
const GovernmentPage = lazy(() => import('../features/corporation/government/GovernmentPage'))
const ParishPage = lazy(() => import('../features/corporation/parish/ParishPage'))
const PurposesPage = lazy(() => import('../features/corporation/purposes/PurposesPage'))
const CaridadPage = lazy(() => import('../features/corporation/purposes/CaridadPage'))
const FormacionPage = lazy(() => import('../features/corporation/purposes/FormacionPage'))
const CultsPage = lazy(() => import('../features/corporation/cults/CultsPage'))
const SabadoPasionPage = lazy(() => import('../features/corporation/sabado-pasion/SabadoPasionPage'))
const RecorridoPage = lazy(() => import('../features/corporation/sabado-pasion/RecorridoPage'))
const TronoPage = lazy(() => import('../features/corporation/sabado-pasion/TronoPage'))
const EnseresPage = lazy(() => import('../features/corporation/sabado-pasion/EnseresPage'))
const TitularPage = lazy(() => import('../features/titular/TitularPage'))
const DesamparadosPage = lazy(() => import('../features/titular/DesamparadosPage'))
const AjuarPage = lazy(() => import('../features/titular/AjuarPage'))
const NewsPage = lazy(() => import('../features/news/NewsPage'))
const AgendaPage = lazy(() => import('../features/news/agenda/AgendaPage'))
const NoticiasPage = lazy(() => import('../features/news/noticias/NoticiasPage'))
const NoticiaDetallePage = lazy(() => import('../features/news/noticias/NoticiaDetallePage'))
const PublicationsPage = lazy(() => import('../features/publications/PublicationsPage'))
const BoletinesPage = lazy(() => import('../features/publications/BoletinesPage'))
const DossierPrensaPage = lazy(() => import('../features/publications/DossierPrensaPage'))
const MembersPage = lazy(() => import('../features/members/public/MembersPage'))
const HazteHermanoPage = lazy(() => import('../features/members/public/HazteHermanoPage'))
const ContactPage = lazy(() => import('../features/contact/ContactPage'))
const NotFoundPage = lazy(() => import('../features/notFound/NotFoundPage'))
const NewsAdminPage = lazy(() => import('../features/cms/NewsAdminPage'))
const PublicationsAdminPage = lazy(() => import('../features/cms/PublicationsAdminPage'))
const AgendaAdminPage = lazy(() => import('../features/cms/AgendaAdminPage'))
const BrothersAdminPage = lazy(() => import('../features/cms/BrothersAdminPage'))
const TreasuryAdminPage = lazy(() => import('../features/cms/TreasuryAdminPage'))
const InventoryAdminPage = lazy(() => import('../features/cms/InventoryAdminPage'))
const AccountingAdminPage = lazy(() => import('../features/cms/AccountingAdminPage'))
const AuditAdminPage = lazy(() => import('../features/cms/AuditAdminPage'))
const PanelPage = lazy(() => import('../features/cms/PanelPage'))

// Legal pages
const LegalNoticePage = lazy(() => import('../features/legal/LegalNoticePage'))
const PrivacyPolicyPage = lazy(() => import('../features/legal/PrivacyPolicyPage'))
const CookiesPolicyPage = lazy(() => import('../features/legal/CookiesPolicyPage'))

// Auth pages
const LoginPage = lazy(() => import('../features/members/auth/LoginPage'))
const ResetPasswordPage = lazy(() => import('../features/members/auth/ResetPasswordPage'))

// Brother area pages
const ProfilePage = lazy(() => import('../features/brotherArea/profile/ProfilePage'))
const EditProfilePage = lazy(() => import('../features/brotherArea/profile/EditProfilePage'))
const ProcessionPage = lazy(() => import('../features/brotherArea/procession/ProcessionPage'))
const PapeletaPage = lazy(() => import('../features/brotherArea/procession/PapeletaPage'))
const HistoricoPage = lazy(() => import('../features/brotherArea/procession/HistoricoPage'))
const ReceiptsPage = lazy(() => import('../features/brotherArea/receipts/ReceiptsPage'))

function withSuspense(Component: React.ComponentType) {
  return (
    <Suspense fallback={<PageLoader />}>
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
          { path: 'actualidad', element: withSuspense(NewsPage) },
          { path: 'actualidad/agenda', element: withSuspense(AgendaPage) },
          { path: 'actualidad/noticias', element: withSuspense(NoticiasPage) },
          { path: 'actualidad/noticias/:slug', element: withSuspense(NoticiaDetallePage) },
          { path: 'publicaciones', element: withSuspense(PublicationsPage) },
          { path: 'publicaciones/boletines', element: withSuspense(BoletinesPage) },
          { path: 'publicaciones/dossier-prensa', element: withSuspense(DossierPrensaPage) },
          { path: 'hermanos', element: withSuspense(MembersPage) },
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
        children: [{ index: true, element: withSuspense(LoginPage) }],
      },
      {
        path: '/reset-password',
        element: <AuthLayout />,
        children: [{ index: true, element: withSuspense(ResetPasswordPage) }],
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
          { path: 'perfil', element: withSuspense(ProfilePage) },
          { path: 'perfil/editar', element: withSuspense(EditProfilePage) },
          { path: 'procesion', element: withSuspense(ProcessionPage) },
          { path: 'procesion/papeleta', element: withSuspense(PapeletaPage) },
          { path: 'procesion/historico', element: withSuspense(HistoricoPage) },
          { path: 'recibos', element: withSuspense(ReceiptsPage) },
          { path: '*', element: <Navigate to="/area-hermano/perfil" replace /> },
        ],
      },
      {
        path: '/cms',
        element: <RequireRole roles={['ADMIN', 'REDES', 'SECRETARIA', 'HERMANO_MAYOR', 'TESORERIA', 'ALBACERIA']}><AdminLayout /></RequireRole>,
        children: [
          { index: true, element: withSuspense(PanelPage) },
          { path: 'noticias', element: <RequireRole roles={['ADMIN', 'REDES']}>{withSuspense(NewsAdminPage)}</RequireRole> },
          { path: 'publicaciones', element: <RequireRole roles={['ADMIN', 'REDES']}>{withSuspense(PublicationsAdminPage)}</RequireRole> },
          { path: 'agenda', element: <RequireRole roles={['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR']}>{withSuspense(AgendaAdminPage)}</RequireRole> },
          { path: 'hermanos', element: <RequireRole roles={['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR']}>{withSuspense(BrothersAdminPage)}</RequireRole> },
          { path: 'tesoreria', element: <RequireRole roles={['ADMIN', 'TESORERIA']}>{withSuspense(TreasuryAdminPage)}</RequireRole> },
          { path: 'inventario', element: <RequireRole roles={['ADMIN', 'ALBACERIA', 'HERMANO_MAYOR']}>{withSuspense(InventoryAdminPage)}</RequireRole> },
          { path: 'contabilidad', element: <RequireRole roles={['ADMIN', 'TESORERIA']}>{withSuspense(AccountingAdminPage)}</RequireRole> },
          { path: 'auditoria', element: <RequireRole roles={['ADMIN']}>{withSuspense(AuditAdminPage)}</RequireRole> },
        ],
      },
    ],
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
