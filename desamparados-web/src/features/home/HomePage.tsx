import { Helmet } from 'react-helmet-async'
import Hero from './Hero'
import FeaturedNews from './FeaturedNews'
import QuickAccess from './QuickAccess'
import EventsAndLive from './EventsAndLive'
import FeaturedPublications from './FeaturedPublications'
import ProcessionScene from './ProcessionScene'
import './home.css'

export default function HomePage() {
  return (
    <div className="home-refined">
      <Helmet>
        <title>Desamparados Málaga</title>
        <meta
          name="description"
          content="Grupo Parroquial de Nuestra Señora de los Desamparados de Málaga. Devoción, historia y patrimonio en el corazón de la ciudad."
        />
      </Helmet>
      {/* Lo útil primero (noticias y agenda) y la banda emocional como pausa antes del cierre.
          Ritmo por bloques: oscuro y foto a sangre se alternan y dos fotos nunca se tocan. */}
      <Hero />
      <FeaturedNews />
      <EventsAndLive />
      <QuickAccess />
      <ProcessionScene />
      <FeaturedPublications />
    </div>
  )
}
