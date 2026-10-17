/**
 * Las redes del Grupo al pie de la página del Rosario. La página no carga
 * /instalacion.js (es suelta, en el dominio principal), así que los enlaces
 * se escriben en el HTML al construirla, desde instalacion/datos-entidad.json
 * (vite.rosario.config.ts). Van en el HTML y no en main.ts: se ven aunque el
 * mapa no llegue a cargar.
 */

export type Redes = Partial<Record<'instagram' | 'tiktok' | 'x' | 'facebook' | 'youtube', string | null>>

// Los trazos de @mui/icons-material, y el de TikTok de Simple Icons (CC0), como en components/barra/redes.tsx.
const ICONOS: { red: keyof Redes; nombre: string; tamano: number; trazo: string }[] = [
  { red: 'instagram', nombre: 'Instagram', tamano: 20, trazo: 'M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z' },
  { red: 'tiktok', nombre: 'TikTok', tamano: 19, trazo: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z' },
  { red: 'x', nombre: 'X', tamano: 17, trazo: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
  { red: 'facebook', nombre: 'Facebook', tamano: 20, trazo: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m13 2h-2.5A3.5 3.5 0 0 0 12 8.5V11h-2v3h2v7h3v-7h3v-3h-3V9a1 1 0 0 1 1-1h2V5z' },
  { red: 'youtube', nombre: 'YouTube', tamano: 22, trazo: 'M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z' },
]

const atributo = (texto: string) => texto.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** El `<nav>` con las redes que tienen dirección; nada si no hay ninguna (un icono a `#` es un enlace muerto). */
export function htmlDeRedes(redes: Redes | undefined): string {
  const enlaces = ICONOS.flatMap(({ red, nombre, tamano, trazo }) => {
    const href = redes?.[red]
    if (!href) return []
    return [`<a href="${atributo(href)}" aria-label="${nombre}" target="_blank" rel="noopener"><svg aria-hidden="true" width="${tamano}" height="${tamano}" viewBox="0 0 24 24" fill="currentColor"><path d="${trazo}"/></svg></a>`]
  })
  if (enlaces.length === 0) return ''
  return `<nav class="redes" aria-label="Redes del Grupo"><span>Síguenos</span>${enlaces.join('')}</nav>`
}
