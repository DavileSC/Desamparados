/** Textos y tipos de las publicaciones, compartidos por el listado y la ficha del CMS. */
export const ETIQUETA_PORTADA = 'Portada de la publicación'
export const AYUDA_PORTADA =
  'JPG, PNG o WebP de hasta 5 MB, en vertical (3:4), como la primera página del PDF. Sin portada, la web dibuja una cubierta con el número o el año.'

export const AYUDA_PDF =
  'PDF de hasta 20 MB. Es lo que se descarga desde la web. Al sustituirlo o quitarlo y guardar, el anterior se borra del servidor.'

/** El PDF que pone el seed mientras falta el de verdad (el mismo que PDF_DE_RELLENO en el backend). */
export const PDF_DE_RELLENO = '/storage/public/documentos/pendiente.pdf'

/** Los cuatro tipos, en el orden en que se ofrecen. */
export const TIPOS_PUBLICACION = [
  { value: 'boletin', label: 'Boletín' },
  { value: 'dossier', label: 'Dossier de prensa' },
  { value: 'anuario', label: 'Anuario' },
  { value: 'historia', label: 'Historia' },
] as const

export const nombreTipo = (tipo: string) => TIPOS_PUBLICACION.find((t) => t.value === tipo)?.label ?? tipo
