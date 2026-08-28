import type { EventItem } from '../../types'

export const eventItems: EventItem[] = [
  {
    id: '1',
    title: 'Solemne Triduo',
    description: 'En honor a nuestra Amantísima Titular en la Sede Canónica.',
    date: '15 - 17 Noviembre',
    time: '20:00h',
    location: 'Sede Canónica',
    highlighted: true,
  },
  {
    id: '2',
    title: 'Besamanos',
    description: 'Solemne y devoto besamanos a la Santísima Virgen.',
    date: '24 Noviembre',
    time: 'Todo el día',
    location: 'Sede Canónica',
  },
  {
    id: '3',
    title: 'Misa de Grupo Parroquial',
    description: 'Celebración eucarística semanal de nuestra corporación.',
    date: 'Todos los Domingos',
    time: '12:00h',
    location: 'Sede Canónica',
  },
  {
    id: '4',
    title: 'Sábado de Pasión',
    description: 'Solemne estación de penitencia por las calles de Málaga.',
    date: 'Próximo Sábado de Pasión',
    time: '17:30h',
    location: 'Recorrido oficial',
    highlighted: true,
  },
]

export function getUpcomingEvents(count = 4): EventItem[] {
  return eventItems.slice(0, count)
}
