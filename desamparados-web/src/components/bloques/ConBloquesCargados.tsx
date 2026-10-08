import { Suspense, use, type ReactNode } from 'react'
import { cargarBloques } from './registro'
import { useBorradorPagina } from './borrador'
import type { Bloque } from '../../lib/api/contenido'

/**
 * Enseña `esqueleto` hasta que han llegado los bloques perezosos que llevan
 * estos bloques, y entonces todo de una vez.
 *
 * El esqueleto es el mismo que mientras llegaba el documento, así que quien
 * visita ve un solo esqueleto que dura un poco más, no la página montándose a
 * trozos y cambiando de alto cada vez que llega uno.
 *
 * En la vista previa del CMS no espera: al añadir un bloque nuevo, la página
 * entera volvería al esqueleto; ahí basta con que ese bloque llegue solo (ver
 * el `Suspense` de `BloqueDePagina`).
 */
export default function ConBloquesCargados({ bloques, esqueleto, children }: { bloques: Bloque[]; esqueleto: ReactNode; children: ReactNode }) {
  const borrador = useBorradorPagina()
  if (borrador) return children
  return (
    <Suspense fallback={esqueleto}>
      <Esperar bloques={bloques}>{children}</Esperar>
    </Suspense>
  )
}

function Esperar({ bloques, children }: { bloques: Bloque[]; children: ReactNode }) {
  const pendiente = cargarBloques(bloques)
  if (pendiente) use(pendiente)
  return children
}
