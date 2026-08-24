import { Suspense, lazy } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import PublicLayout from '../app/PublicLayout'
import AuthLayout from '../app/AuthLayout'
import BrotherLayout from '../app/BrotherLayout'
import RequireAuth from './RequireAuth'

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
const PublicationsPage = lazy(() => import('../features/publications/PublicationsPage'))
const BoletinesPage = lazy(() => import('../features/publications/BoletinesPage'))
const DossierPrensaPage = lazy(() => import('../features/publications/DossierPrensaPage'))
const MembersPage = lazy(() => import('../features/members/public/MembersPage'))
const HazteHermanoPage = lazy(() => import('../features/members/public/HazteHermanoPage'))
const ContactPage = lazy(() => import('../features/contact/ContactPage'))

// Legal pages
const LegalNoticePage = lazy(() => import('../features/legal/LegalNoticePage'))
const PrivacyPolicyPage = lazy(() => import('../features/legal/PrivacyPolicyPage'))
const CookiesPolicyPage = lazy(() => import('../features/legal/CookiesPolicyPage'))

// Auth pages
const LoginPage = lazy(() => import('../features/members/auth/LoginPage'))

// Brother area pages
const ProfilePage = lazy(() => import('../features/brotherArea/profile/ProfilePage'))
const EditProfilePage = lazy(() => import('../features/brotherArea/profile/EditProfilePage'))
const ProcessionPage = lazy(() => import('../features/brotherArea/procession/ProcessionPage'))
const PapeletaPage = lazy(() => import('../features/brotherArea/procession/PapeletaPage'))
const HistoricoPage = lazy(() => import('../features/brotherArea/procession/HistoricoPage'))
const ReceiptsPage = lazy(() => import('../features/brotherArea/receipts/ReceiptsPage'))

function PageLoader() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
      }}
    >
      <CircularProgress color="primary" />
    </Box>
  )
}

function withSuspense(Component: React.ComponentType) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  )
}

const router = createBrowserRouter([
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
      { path: 'publicaciones', element: withSuspense(PublicationsPage) },
      { path: 'publicaciones/boletines', element: withSuspense(BoletinesPage) },
      { path: 'publicaciones/dossier-prensa', element: withSuspense(DossierPrensaPage) },
      { path: 'hermanos', element: withSuspense(MembersPage) },
      { path: 'hermanos/hazte-hermano', element: withSuspense(HazteHermanoPage) },
      { path: 'contacto', element: withSuspense(ContactPage) },
      { path: 'aviso-legal', element: withSuspense(LegalNoticePage) },
      { path: 'politica-privacidad', element: withSuspense(PrivacyPolicyPage) },
      { path: 'politica-cookies', element: withSuspense(CookiesPolicyPage) },
    ],
  },
  {
    path: '/hermanos/acceso',
    element: <AuthLayout />,
    children: [{ index: true, element: withSuspense(LoginPage) }],
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
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
