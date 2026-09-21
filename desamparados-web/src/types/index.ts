export interface NewsItem {
  id: string
  title: string
  excerpt: string
  content?: string
  image?: string
  category: string
  date: string
  slug: string
  /** Destacada a mano en el CMS: en la portada va primera y con cinta. */
  fijada?: boolean
}

export interface EventItem {
  id: string
  title: string
  description: string
  date: string
  time?: string
  location?: string
  highlighted?: boolean
}

export interface PublicationItem {
  id: string
  title: string
  description?: string
  image?: string
  fileUrl?: string
  date: string
  category: 'boletin' | 'dossier' | 'anuario' | 'historia'
  /** Destacada a mano en el CMS: en la portada va primera y con cinta. */
  fijada?: boolean
}

export interface BrotherProfile {
  id: string
  name: string
  surname: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  memberSince: string
  brotherNumber: string
}

export interface Receipt {
  id: string
  year: number
  concept: string
  amount: number
  status: 'paid' | 'pending' | 'overdue'
  date: string
}

export interface ProcessionTicket {
  id: string
  year: number
  section: string
  seat: string
  status: 'assigned' | 'pending' | 'not-assigned'
}
