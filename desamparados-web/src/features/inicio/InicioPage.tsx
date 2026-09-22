import MetaDePagina from '../../components/MetaDePagina'
import Hero from './Hero'
import NoticiasDestacadas from './NoticiasDestacadas'
import AccesosRapidos from './AccesosRapidos'
import AgendaYDirecto from './AgendaYDirecto'
import PublicacionesDestacadas from './PublicacionesDestacadas'
import EscenaProcesion from './EscenaProcesion'
import './home.css'

export default function InicioPage() {
  return (
    <div className="home-refined">
      <MetaDePagina
        titulo="Desamparados Málaga"
        conSufijo={false}
        descripcion="Grupo Parroquial de Nuestra Señora de los Desamparados de Málaga. Devoción, historia y patrimonio en el corazón de la ciudad."
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
