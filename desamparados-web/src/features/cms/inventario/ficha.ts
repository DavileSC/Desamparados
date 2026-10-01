export const MAX_FOTOS = 12

/** Lo que se edita de la ficha de patrimonio, como texto de formulario. */
export interface FormFicha {
  imagenUrl: string
  descripcion: string
  autor: string
  epoca: string
  materiales: string
  dimensiones: string
  conservacion: string
  fotos: { url: string; pie: string }[]
  valorTasacion: string
  fechaTasacion: string
  tasadoPor: string
}

/** «18.500,50», «18500.5» o «18500» → 18500.5; vacío → null; lo demás, undefined (no vale). */
export function leerTasacion(texto: string): number | null | undefined {
  const t = texto.trim().replace(/\s/g, '')
  if (!t) return null
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  return /^\d+(\.\d{1,2})?$/.test(normal) ? Number(normal) : undefined
}

/** Lo que se manda al servidor: los vacíos, a null para borrarlos. */
export function fichaParaGuardar(f: FormFicha) {
  const texto = (v: string) => v.trim() || null
  return {
    imagenUrl: f.imagenUrl || null,
    descripcion: texto(f.descripcion),
    autor: texto(f.autor),
    epoca: texto(f.epoca),
    materiales: texto(f.materiales),
    dimensiones: texto(f.dimensiones),
    conservacion: texto(f.conservacion),
    fotos: f.fotos.filter((x) => x.url).map((x) => ({ url: x.url, pie: x.pie.trim() })),
    valorTasacion: leerTasacion(f.valorTasacion) ?? null,
    fechaTasacion: f.fechaTasacion || null,
    tasadoPor: texto(f.tasadoPor),
  }
}

/** El formulario de la ficha a partir de lo que trae el servidor. */
export function fichaDelEnser(e: Partial<Record<keyof FormFicha | 'valorTasacion' | 'fechaTasacion' | 'fotos', unknown>>): FormFicha {
  const texto = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    imagenUrl: texto(e.imagenUrl), descripcion: texto(e.descripcion), autor: texto(e.autor), epoca: texto(e.epoca),
    materiales: texto(e.materiales), dimensiones: texto(e.dimensiones), conservacion: texto(e.conservacion),
    fotos: Array.isArray(e.fotos) ? (e.fotos as { url: string; pie: string }[]).map((f) => ({ url: f.url, pie: f.pie ?? '' })) : [],
    valorTasacion: e.valorTasacion === null || e.valorTasacion === undefined ? '' : String(e.valorTasacion).replace('.', ','),
    fechaTasacion: typeof e.fechaTasacion === 'string' ? e.fechaTasacion.slice(0, 10) : '',
    tasadoPor: texto(e.tasadoPor),
  }
}
