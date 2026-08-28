import type { NewsItem } from '../../types'

export const newsItems: NewsItem[] = [
  {
    id: '1',
    title: 'Solemnes Cultos en honor a nuestra Sagrada Titular',
    excerpt:
      'Durante los próximos días se celebrarán los solemnes cultos anuales, invitando a todos los hermanos y devotos a participar de estos días de recogimiento.',
    content:
      'El Grupo Parroquial de los Desamparados convoca a todos sus hermanos, devotos y feligreses a los Solemnes Cultos que se celebrarán en honor a Nuestra Señora de los Desamparados...',
    image: '/images/procesion.jpg',
    category: 'Cultos',
    date: '2023-11-10',
    slug: 'solemnes-cultos-sagrada-titular',
  },
  {
    id: '2',
    title: 'Cabildo General Ordinario',
    excerpt:
      'Convocatoria oficial para el próximo Cabildo General Ordinario de cuentas y proyectos.',
    category: 'Institucional',
    date: '2023-10-12',
    slug: 'cabildo-general-ordinario',
  },
  {
    id: '3',
    title: 'Restauración del Manto',
    excerpt:
      'Presentamos los avances en el proceso de restauración del manto procesional histórico.',
    category: 'Patrimonio',
    date: '2023-10-05',
    slug: 'restauracion-del-manto',
  },
  {
    id: '4',
    title: 'Nueva Junta de Gobierno toma posesión de sus cargos',
    excerpt:
      'Tras el Cabildo de Elecciones, la nueva Junta de Gobierno ha tomado posesión oficialmente de sus cargos para el próximo mandato.',
    category: 'Institucional',
    date: '2023-09-28',
    slug: 'nueva-junta-gobierno',
  },
  {
    id: '5',
    title: 'Carta de agradecimiento a los hermanos',
    excerpt:
      'El Hermano Mayor dirige una carta de agradecimiento a todos los hermanos por su participación en la última estación de penitencia.',
    category: 'Grupo Parroquial',
    date: '2023-09-15',
    slug: 'carta-agradecimiento-hermanos',
  },
]

export function getLatestNews(count = 4): NewsItem[] {
  return newsItems.slice(0, count)
}

export function getNewsBySlug(slug: string): NewsItem | undefined {
  return newsItems.find((item) => item.slug === slug)
}
