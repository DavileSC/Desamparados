import { Suspense, lazy, useState } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet, ScrollRestoration } from 'react-router-dom'
import CargandoPagina from '../components/CargandoPagina'
import MarcoPublico from '../app/MarcoPublico'
import MarcoAcceso from '../app/MarcoAcceso'
import ExigeSesion from './ExigeSesion'
import ExigeRol from './ExigeRol'
import ExigeModulo from './ExigeModulo'
import DireccionAntigua from './DireccionAntigua'
import { rolesPorRutaCms } from '../app/rolesCms'
import { Helmet } from 'react-helmet-async'
import { QuitarCanonico } from '../lib/canonico'
import { useLocation } from 'react-router-dom'
import { site } from '../config/site'
import ErrorDeRuta from '../components/ErrorDeRuta'
import type { Requisito } from '../domain/modulos'

// Los marcos del CMS y del área de hermanos van aparte, como las páginas: con
// ellos dentro, cada visita a la web pública bajaba su menú, sus iconos, el tema
// del CMS y el formulario de acceso (con zod y react-hook-form), unos 70 KB que
// el público no usa nunca. Los roles salen de `rolesCms`, que no importa iconos.
const MarcoCms = lazy(() => import('../app/MarcoCms'))
const MarcoAreaHermano = lazy(() => import('../app/MarcoAreaHermano'))

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
const EmailsPage = lazy(() => import('../features/cms/emails/EmailsPage'))
const EmailEditPage = lazy(() => import('../features/cms/emails/EmailEditPage'))
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
const DatosCorporacionPage = lazy(() => import('../features/cms/DatosCorporacionPage'))
const AjustesInicioPage = lazy(() => import('../features/cms/AjustesInicioPage'))
const DatosInformesPage = lazy(() => import('../features/cms/datos/DatosInformesPage'))
const InformeAnualPage = lazy(() => import('../features/cms/datos/InformeAnualPage'))
const CartasPage = lazy(() => import('../features/cms/cartas/CartasPage'))
const AccesosAdminPage = lazy(() => import('../features/cms/AccesosAdminPage'))
const ModulosAdminPage = lazy(() => import('../features/cms/ModulosAdminPage'))
const PanelPage = lazy(() => import('../features/cms/PanelPage'))
const MiSeguridadPage = lazy(() => import('../features/cms/MiSeguridadPage'))

// Legal pages
const AvisoLegalPage = lazy(() => import('../features/legal/AvisoLegalPage'))
const PoliticaDePrivacidadPage = lazy(() => import('../features/legal/PoliticaDePrivacidadPage'))
const PoliticaDeCookiesPage = lazy(() => import('../features/legal/PoliticaDeCookiesPage'))
const CondicionesDeCompraPage = lazy(() => import('../features/legal/CondicionesDeCompraPage'))
const BajaBoletinPage = lazy(() => import('../features/boletin/BajaBoletinPage'))
const TiendaPage = lazy(() => import('../features/tienda/TiendaPage'))
const PedidoTiendaPage = lazy(() => import('../features/tienda/PedidoTiendaPage'))
const ApadrinaPage = lazy(() => import('../features/apadrinamiento/ApadrinaPage'))
const GraciasApadrinamientoPage = lazy(() => import('../features/apadrinamiento/GraciasApadrinamientoPage'))

// Auth pages
const AccesoPage = lazy(() => import('../features/altas/auth/AccesoPage'))
const AccesoCmsPage = lazy(() => import('../features/altas/auth/AccesoCmsPage'))
const AprobarEntradaPage = lazy(() => import('../features/cms/aprobar/AprobarEntradaPage'))
const NuevaContrasenaPage = lazy(() => import('../features/altas/auth/NuevaContrasenaPage'))
const PrimerAccesoPage = lazy(() => import('../features/areaHermano/primerAcceso/PrimerAccesoPage'))
const RevisarFichaPage = lazy(() => import('../features/areaHermano/primerAcceso/RevisarFichaPage'))

// Brother area pages
const PerfilPage = lazy(() => import('../features/areaHermano/perfil/PerfilPage'))
const FamiliaPage = lazy(() => import('../features/areaHermano/familia/FamiliaPage'))
const AvisosPage = lazy(() => import('../features/areaHermano/avisos/AvisosPage'))
const AvisoPage = lazy(() => import('../features/areaHermano/avisos/AvisoPage'))
const ProcesionPage = lazy(() => import('../features/areaHermano/procesion/ProcesionPage'))
const HistoricoPage = lazy(() => import('../features/areaHermano/procesion/HistoricoPage'))
const RecibosPage = lazy(() => import('../features/areaHermano/recibos/RecibosPage'))
const ReciboPage = lazy(() => import('../features/areaHermano/recibos/ReciboPage'))

/**
 * Una página con su módulo: `nucleo` para lo que no se apaga, la clave para
 * lo demás. La guardiana (backend, test/modulos-cobertura.test.ts) exige que
 * toda ruta de este fichero pase por aquí o sea una redirección.
 */
function pagina(Component: React.ComponentType, modulo: Requisito) {
  return (
    <ExigeModulo modulo={modulo}>
      <Suspense fallback={<CargandoPagina />}>
        <Component />
      </Suspense>
    </ExigeModulo>
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
  // Lo pide una página sin indexar (lib/canonico.ts): con noindex, sin canonical.
  const [sinCanonico, setSinCanonico] = useState(false)
  return (
    <QuitarCanonico.Provider value={setSinCanonico}>
      <Helmet>
        {!sinCanonico && <link rel="canonical" href={canonical} />}
        <meta property="og:url" content={canonical} />
        {/* og:site_name, og:type y og:image no van: son las mismas en todas
            las páginas, ya vienen en index.html y aquí salían repetidas. */}
      </Helmet>
      <ScrollRestoration />
      <Outlet />
    </QuitarCanonico.Provider>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <ErrorDeRuta />,
    children: [
      {
        path: '/',
        element: <MarcoPublico />,
        children: [
          { index: true, element: pagina(InicioPage, 'nucleo') },
          { path: 'historia', element: pagina(HistoriaPage, 'nucleo') },
          { path: 'historia/organos-de-gobierno', element: pagina(OrganosDeGobiernoPage, 'nucleo') },
          { path: 'parroquia', element: pagina(ParroquiaPage, 'nucleo') },
          { path: 'nuestros-fines', element: pagina(NuestrosFinesPage, 'nucleo') },
          { path: 'nuestros-fines/caridad', element: pagina(CaridadPage, 'nucleo') },
          { path: 'nuestros-fines/formacion', element: pagina(FormacionPage, 'nucleo') },
          { path: 'cultos', element: pagina(CultosPage, 'nucleo') },
          { path: 'sabado-de-pasion', element: pagina(SabadoPasionPage, 'paginas-propias') },
          { path: 'sabado-de-pasion/recorrido', element: pagina(RecorridoPage, 'paginas-propias') },
          { path: 'sabado-de-pasion/trono', element: pagina(TronoPage, 'paginas-propias') },
          { path: 'sabado-de-pasion/enseres', element: pagina(EnseresPage, 'paginas-propias') },
          { path: 'rosario', element: pagina(RosarioPage, 'paginas-propias') },
          { path: 'desamparados', element: pagina(DesamparadosPage, 'paginas-propias') },
          { path: 'ajuar', element: pagina(AjuarPage, 'nucleo') },
          { path: 'agenda', element: pagina(AgendaPage, 'agenda') },
          { path: 'noticias', element: pagina(NoticiasPage, 'noticias') },
          { path: 'noticias/:slug', element: pagina(NoticiaDetallePage, 'noticias') },
          { path: 'publicaciones', element: pagina(PublicacionesPage, 'publicaciones') },
          { path: 'publicaciones/boletines', element: pagina(BoletinesPage, 'publicaciones') },
          { path: 'publicaciones/dossier-prensa', element: pagina(DossierPrensaPage, 'publicaciones') },
          { path: 'hazte-hermano', element: pagina(HazteHermanoPage, 'alta-web') },
          { path: 'contacto', element: pagina(ContactoPage, 'nucleo') },
          { path: 'tienda', element: pagina(TiendaPage, 'tienda-web') },
          // La ficha de un producto: la misma página que la rejilla, que comparte la cesta.
          { path: 'tienda/producto/:id', element: pagina(TiendaPage, 'tienda-web') },
          { path: 'tienda/pedido/:token', element: pagina(PedidoTiendaPage, 'tienda-web') },
          { path: 'apadrina', element: pagina(ApadrinaPage, 'apadrinamientos') },
          { path: 'apadrina/gracias/:token', element: pagina(GraciasApadrinamientoPage, 'apadrinamientos') },
          { path: 'aviso-legal', element: pagina(AvisoLegalPage, 'nucleo') },
          { path: 'politica-privacidad', element: pagina(PoliticaDePrivacidadPage, 'nucleo') },
          { path: 'politica-cookies', element: pagina(PoliticaDeCookiesPage, 'nucleo') },
          { path: 'condiciones-de-compra', element: pagina(CondicionesDeCompraPage, 'tienda-web') },
          // La parroquia se llamaba como la orden que la atiende (hasta el 12-10-2026).
          { path: 'parroquia-pasionistas', element: <DireccionAntigua a="/parroquia" /> },
          // Las direcciones de antes de quitar las portadas de sección (25-09-2026):
          // /corporacion/historia sigue llevando a /historia, y así con todas.
          { path: 'corporacion/*', element: <DireccionAntigua /> },
          { path: 'sagrada-titular/*', element: <DireccionAntigua /> },
          { path: 'actualidad/*', element: <DireccionAntigua /> },
          { path: 'hermanos/*', element: <DireccionAntigua /> },
          // 404 real (con cabecera y pie): antes cualquier URL errónea redirigía a la portada
          { path: '*', element: pagina(NoEncontradaPage, 'nucleo') },
        ],
      },
      // La baja del boletín, desde el enlace de cada correo y sin sesión. Con el
      // marco público, pero FUERA del bloque de arriba a propósito: es un enlace
      // de un solo uso, no una página que buscar, y el sitemap (y su prueba)
      // recorren ese bloque entero.
      {
        path: '/boletin/baja',
        element: <MarcoPublico />,
        // Del núcleo: la baja de un boletín ya enviado funciona aunque se
        // apague Comunicados (notas §12), igual que su ruta en la API.
        children: [{ index: true, element: pagina(BajaBoletinPage, 'nucleo') }],
      },
      {
        path: '/acceso',
        element: <MarcoAcceso />,
        // Del núcleo a propósito: con el área de hermanos apagada, la pantalla de acceso enseña ella misma el aviso.
        children: [{ index: true, element: pagina(AccesoPage, 'nucleo') }],
      },
      {
        path: '/reset-password',
        element: <MarcoAcceso />,
        children: [{ index: true, element: pagina(NuevaContrasenaPage, 'nucleo') }],
      },
      {
        // El enlace de la invitación del censo importado: pone la contraseña y entra.
        path: '/primer-acceso',
        element: <MarcoAcceso />,
        children: [{ index: true, element: pagina(PrimerAccesoPage, 'area-hermanos') }],
      },
      {
        // La revisión de la ficha: con sesión, pero fuera del marco del área,
        // porque hasta confirmarla no se puede ir a ninguna otra pantalla.
        path: '/primer-acceso/ficha',
        element: <ExigeSesion revision><Outlet /></ExigeSesion>,
        children: [{ index: true, element: pagina(RevisarFichaPage, 'area-hermanos') }],
      },
      {
        path: '/area-hermano',
        element: (
          <ExigeModulo modulo="area-hermanos">
            <ExigeSesion>
              <Suspense fallback={<CargandoPagina />}>
                <MarcoAreaHermano />
              </Suspense>
            </ExigeSesion>
          </ExigeModulo>
        ),
        children: [
          { index: true, element: <Navigate to="/area-hermano/perfil" replace /> },
          { path: 'perfil', element: pagina(PerfilPage, 'nucleo') },
          // La edición se hace ya en el propio perfil, apartado a apartado.
          { path: 'perfil/editar', element: <Navigate to="/area-hermano/perfil" replace /> },
          { path: 'familia', element: pagina(FamiliaPage, 'nucleo') },
          { path: 'procesion', element: pagina(ProcesionPage, 'procesion') },
          // La papeleta se pide y se consulta ya en la propia página de Procesión.
          { path: 'procesion/papeleta', element: <Navigate to="/area-hermano/procesion" replace /> },
          { path: 'procesion/historico', element: pagina(HistoricoPage, 'procesion') },
          { path: 'recibos', element: pagina(RecibosPage, 'nucleo') },
          { path: 'recibos/:id', element: pagina(ReciboPage, 'nucleo') },
          { path: 'avisos', element: pagina(AvisosPage, 'comunicados') },
          { path: 'avisos/:id', element: pagina(AvisoPage, 'comunicados') },
          { path: '*', element: <Navigate to="/area-hermano/perfil" replace /> },
        ],
      },
      {
        // La vista en vivo del constructor de páginas: la página pública con lo
        // que se está escribiendo, dentro de un iframe del propio CMS. Va fuera
        // de <MarcoCms /> (sin menú del CMS) y fuera de <MarcoPublico /> (sin la
        // barra ni el pie ni el aviso de cookies de la web).
        path: '/cms/vista-previa/:slug', element: <ExigeRol roles={rolesPorRutaCms['paginas/:slug']}>{pagina(PaginaEnVivo, 'nucleo')}</ExigeRol>,
      },
      { path: '/cms/acceso', element: pagina(AccesoCmsPage, 'nucleo') },
      // Lo que abre el aviso en el móvil: sin sesión del CMS (puede haber
      // caducado allí) y fuera de <MarcoCms />; la clave del móvil es la prueba.
      { path: '/cms/aprobar/:id', element: pagina(AprobarEntradaPage, 'avisos-en-el-movil') },
      {
        path: '/cms',
        element: <ExigeRol roles={rolesPorRutaCms.panel}><Suspense fallback={<CargandoPagina />}><MarcoCms /></Suspense></ExigeRol>,
        children: [
          { index: true, element: pagina(PanelPage, 'nucleo') },
          { path: 'mi-seguridad', element: <ExigeRol roles={rolesPorRutaCms['mi-seguridad']}>{pagina(MiSeguridadPage, 'nucleo')}</ExigeRol> },
          { path: 'paginas', element: <ExigeRol roles={rolesPorRutaCms.paginas}>{pagina(PaginasAdminPage, 'nucleo')}</ExigeRol> },
          { path: 'paginas/:slug', element: <ExigeRol roles={rolesPorRutaCms['paginas/:slug']}>{pagina(PaginaAdminPage, 'nucleo')}</ExigeRol> },
          { path: 'portada', element: <ExigeRol roles={rolesPorRutaCms.portada}>{pagina(PortadaAdminPage, 'nucleo')}</ExigeRol> },
          // Historia se edita ya como las demás páginas; la dirección vieja sigue llevando a ella.
          { path: 'historia', element: <Navigate to="/cms/paginas/historia" replace /> },
          { path: 'noticias', element: <ExigeRol roles={rolesPorRutaCms.noticias}>{pagina(NoticiasAdminPage, 'noticias')}</ExigeRol> },
          { path: 'emails', element: <ExigeRol roles={rolesPorRutaCms.emails}>{pagina(EmailsPage, 'nucleo')}</ExigeRol> },
          { path: 'emails/:id', element: <ExigeRol roles={rolesPorRutaCms['emails/:id']}>{pagina(EmailEditPage, 'nucleo')}</ExigeRol> },
          { path: 'comunicados', element: <ExigeRol roles={rolesPorRutaCms.comunicados}>{pagina(ComunicadosAdminPage, 'comunicados')}</ExigeRol> },
          { path: 'comunicados/:id', element: <ExigeRol roles={rolesPorRutaCms.comunicados}>{pagina(ComunicadoEditPage, 'comunicados')}</ExigeRol> },
          { path: 'cabildos', element: <ExigeRol roles={rolesPorRutaCms.cabildos}>{pagina(CabildosAdminPage, 'cabildos')}</ExigeRol> },
          { path: 'cabildos/:id', element: <ExigeRol roles={rolesPorRutaCms.cabildos}>{pagina(CabildoPage, 'cabildos')}</ExigeRol> },
          { path: 'noticias/nueva', element: <ExigeRol roles={rolesPorRutaCms.noticias}>{pagina(NoticiaEditPage, 'noticias')}</ExigeRol> },
          { path: 'noticias/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.noticias}>{pagina(NoticiaEditPage, 'noticias')}</ExigeRol> },
          { path: 'publicaciones', element: <ExigeRol roles={rolesPorRutaCms.publicaciones}>{pagina(PublicacionesAdminPage, 'publicaciones')}</ExigeRol> },
          { path: 'publicaciones/nueva', element: <ExigeRol roles={rolesPorRutaCms.publicaciones}>{pagina(PublicacionEditPage, 'publicaciones')}</ExigeRol> },
          { path: 'publicaciones/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.publicaciones}>{pagina(PublicacionEditPage, 'publicaciones')}</ExigeRol> },
          { path: 'agenda', element: <ExigeRol roles={rolesPorRutaCms.agenda}>{pagina(AgendaAdminPage, 'agenda')}</ExigeRol> },
          { path: 'agenda/nuevo', element: <ExigeRol roles={rolesPorRutaCms.agenda}>{pagina(AgendaEditPage, 'agenda')}</ExigeRol> },
          { path: 'agenda/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.agenda}>{pagina(AgendaEditPage, 'agenda')}</ExigeRol> },
          { path: 'hermanos', element: <ExigeRol roles={rolesPorRutaCms.hermanos}>{pagina(HermanosAdminPage, 'nucleo')}</ExigeRol> },
          { path: ':id/editar', element: <ExigeRol roles={rolesPorRutaCms.hermanos}>{pagina(HermanoEditPage, 'nucleo')}</ExigeRol> },
          { path: 'procesion', element: <ExigeRol roles={rolesPorRutaCms.procesion}>{pagina(ProcesionAdminPage, 'procesion')}</ExigeRol> },
          { path: 'procesion/salidas', element: <ExigeRol roles={rolesPorRutaCms['procesion/salidas']}>{pagina(SalidasAdminPage, 'procesion')}</ExigeRol> },
          { path: 'procesion/salidas/:id/editar', element: <ExigeRol roles={rolesPorRutaCms['procesion/salidas']}>{pagina(SalidaEditPage, 'procesion')}</ExigeRol> },
          { path: 'procesion/mesa', element: <ExigeRol roles={rolesPorRutaCms['procesion/mesa']}>{pagina(MesaProcesionPage, 'procesion')}</ExigeRol> },
          { path: 'procesion/puerta', element: <ExigeRol roles={rolesPorRutaCms['procesion/puerta']}>{pagina(PuertaTemploPage, 'puerta')}</ExigeRol> },
          { path: 'procesion/directo', element: <ExigeRol roles={rolesPorRutaCms['procesion/directo']}>{pagina(CortejoDirectoPage, 'cortejo-directo')}</ExigeRol> },
          { path: 'tesoreria', element: <ExigeRol roles={rolesPorRutaCms.tesoreria}>{pagina(TesoreriaAdminPage, 'nucleo')}</ExigeRol> },
          { path: 'inventario', element: <ExigeRol roles={rolesPorRutaCms.inventario}>{pagina(InventarioAdminPage, ['inventario', 'procesion'])}</ExigeRol> },
          { path: 'inventario/:id/editar', element: <ExigeRol roles={rolesPorRutaCms.inventario}>{pagina(InventarioEditPage, ['inventario', 'procesion'])}</ExigeRol> },
          { path: 'contabilidad', element: <ExigeRol roles={rolesPorRutaCms.contabilidad}>{pagina(ContabilidadAdminPage, 'contabilidad')}</ExigeRol> },
          { path: 'contabilidad/partida-doble', element: <ExigeRol roles={rolesPorRutaCms.contabilidad}>{pagina(PartidaDoblePage, 'contabilidad')}</ExigeRol> },
          { path: 'tienda', element: <ExigeRol roles={rolesPorRutaCms.tienda}>{pagina(TiendaAdminPage, 'tienda')}</ExigeRol> },
          { path: 'loteria', element: <ExigeRol roles={rolesPorRutaCms.loteria}>{pagina(LoteriaAdminPage, 'loteria')}</ExigeRol> },
          { path: 'apadrinamientos', element: <ExigeRol roles={rolesPorRutaCms.apadrinamientos}>{pagina(ApadrinamientosAdminPage, 'apadrinamientos')}</ExigeRol> },
          { path: 'apadrinamientos/:id', element: <ExigeRol roles={rolesPorRutaCms.apadrinamientos}>{pagina(CampanaApadrinamientoPage, 'apadrinamientos')}</ExigeRol> },
          { path: 'datos', element: <ExigeRol roles={rolesPorRutaCms.datos}>{pagina(DatosInformesPage, 'nucleo')}</ExigeRol> },
          { path: 'cartas', element: <ExigeRol roles={rolesPorRutaCms.cartas}>{pagina(CartasPage, 'cartas')}</ExigeRol> },
          { path: 'informe-anual', element: <ExigeRol roles={rolesPorRutaCms['informe-anual']}>{pagina(InformeAnualPage, 'informe-anual')}</ExigeRol> },
          { path: 'informe-anual/:anio', element: <ExigeRol roles={rolesPorRutaCms['informe-anual/:anio']}>{pagina(InformeAnualPage, 'informe-anual')}</ExigeRol> },
          { path: 'accesos', element: <ExigeRol roles={rolesPorRutaCms.accesos}>{pagina(AccesosAdminPage, 'nucleo')}</ExigeRol> },
          { path: 'modulos', element: <ExigeRol roles={rolesPorRutaCms.modulos}>{pagina(ModulosAdminPage, 'nucleo')}</ExigeRol> },
          { path: 'corporacion', element: <ExigeRol roles={rolesPorRutaCms.corporacion}>{pagina(DatosCorporacionPage, 'nucleo')}</ExigeRol> },
          { path: 'auditoria', element: <ExigeRol roles={rolesPorRutaCms.auditoria}>{pagina(AuditoriaAdminPage, 'nucleo')}</ExigeRol> },
          { path: 'ajustes-inicio', element: <ExigeRol roles={rolesPorRutaCms['ajustes-inicio']}>{pagina(AjustesInicioPage, 'nucleo')}</ExigeRol> },
        ],
      },
    ],
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
