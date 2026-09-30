import MetaDePagina from '../../components/MetaDePagina'
import Hero from './Hero'
import NoticiasDestacadas from './NoticiasDestacadas'
import AccesosRapidos from './AccesosRapidos'
import AgendaYDirecto from './AgendaYDirecto'
import PublicacionesDestacadas from './PublicacionesDestacadas'
import EscenaProcesion from './EscenaProcesion'
import './home.css'
import { site } from '../../config/site'

export default function InicioPage() {
  return (
    <div className="home-refined">
      <MetaDePagina
        titulo={`${site.nombreCorto} ${site.entidad.localidad}`}
        conSufijo={false}
        descripcion={site.descripcion}
      />
      {/* Lo útil primero (noticias y agenda) y la banda emocional como pausa antes del cierre.
          Ritmo por bloques: oscuro y foto a sangre se alternan y dos fotos nunca se tocan. */}
      <Hero />
      <NoticiasDestacadas />
      <AgendaYDirecto />
      <AccesosRapidos />
      <EscenaProcesion />
      <PublicacionesDestacadas />
    </div>
  )
}
