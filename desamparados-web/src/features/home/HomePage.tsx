import { Helmet } from 'react-helmet-async'
import Hero from './Hero'
import FeaturedNews from './FeaturedNews'
import QuickAccess from './QuickAccess'
import EventsAndLive from './EventsAndLive'
import FeaturedPublications from './FeaturedPublications'

export default function HomePage() {
  return (
    <>
      <Helmet>
        <title>Desamparados Málaga</title>
        <meta
          name="description"
          content="Grupo Parroquial de Nuestra Señora de los Desamparados de Málaga. Devoción, historia y patrimonio en el corazón de la ciudad."
        />
      </Helmet>
      <Hero />
      <FeaturedNews />
      <QuickAccess />
      <EventsAndLive />
      <FeaturedPublications />
    </>
  )
}
