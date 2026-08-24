import type { PublicationItem } from '../../types'

export const publicationItems: PublicationItem[] = [
  {
    id: '1',
    title: 'Boletín 2024',
    description: 'Número anual con toda la información de la corporación y la pasada estación de penitencia.',
    image: '/images/procesion.jpg',
    fileUrl: '#',
    date: '2024-05-01',
    category: 'boletin',
  },
  {
    id: '2',
    title: 'Boletín 2023',
    description: 'Revista anual de la Hermandad con artículos de historia, cultos y actividades.',
    image: '/images/triduo.jpg',
    fileUrl: '#',
    date: '2023-05-01',
    category: 'boletin',
  },
  {
    id: '3',
    title: 'Dossier de Prensa 2024',
    description: 'Recopilación de apariciones mediáticas y noticias publicadas sobre la cofradía.',
    fileUrl: '#',
    date: '2024-04-15',
    category: 'dossier',
  },
  {
    id: '4',
    title: 'Anuario Histórico',
    description: 'Compilación de documentos y fotografías de los primeros años de la Hermandad.',
    fileUrl: '#',
    date: '2022-12-01',
    category: 'historia',
  },
]

export function getPublicationsByCategory(category: PublicationItem['category']): PublicationItem[] {
  return publicationItems.filter((item) => item.category === category)
}
