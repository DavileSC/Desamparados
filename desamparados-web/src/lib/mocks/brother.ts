import type { BrotherProfile, Receipt, ProcessionTicket } from '../../types'

export const brotherProfile: BrotherProfile = {
  id: '1',
  name: 'Juan',
  surname: 'García López',
  email: 'hermano@desamparados.es',
  phone: '612 345 678',
  address: 'Calle Larios, 25',
  city: 'Málaga',
  postalCode: '29015',
  memberSince: '2015-03-15',
  brotherNumber: 'H-1247',
}

export const receipts: Receipt[] = [
  { id: '1', year: 2024, concept: 'Cuota anual 2024', amount: 120, status: 'paid', date: '2024-01-15' },
  { id: '2', year: 2024, concept: 'Papeleta de sitio', amount: 45, status: 'paid', date: '2024-02-20' },
  { id: '3', year: 2023, concept: 'Cuota anual 2023', amount: 110, status: 'paid', date: '2023-01-10' },
  { id: '4', year: 2023, concept: 'Papeleta de sitio', amount: 40, status: 'paid', date: '2023-02-15' },
]

export const processionTickets: ProcessionTicket[] = [
  { id: '1', year: 2024, section: 'Cruz de Guía', seat: 'Fila 1 - Sitio 5', status: 'assigned' },
  { id: '2', year: 2023, section: 'Cruz de Guía', seat: 'Fila 2 - Sitio 8', status: 'assigned' },
  { id: '3', year: 2022, section: 'Paso de Palio', seat: 'Fila 4 - Sitio 12', status: 'assigned' },
]
