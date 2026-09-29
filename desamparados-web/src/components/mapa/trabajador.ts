import { setWorkerUrl } from 'maplibre-gl'
import urlDelTrabajador from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

/**
 * Desde la 6, MapLibre busca su worker junto a su propio módulo, y dentro del
 * bundle de Vite ese fichero no existe: el mapa se quedaría sin dibujar nada.
 * Se le da la dirección del worker que emite Vite. `?worker&url` y no `?url`:
 * el worker importa `maplibre-gl-shared.mjs`, y solo por la vía de los workers
 * sale en un único fichero con todo dentro.
 *
 * Se importa por su efecto desde cada componente que crea un mapa.
 */
setWorkerUrl(urlDelTrabajador)
