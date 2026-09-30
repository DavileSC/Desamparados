// Rellena el dominio en la configuración de nginx con el de
// shared/datos-entidad.json, al construir la imagen de la web. Así el dominio
// se escribe en un único sitio para la web, su dirección canónica y nginx.
//
//   node docker/nginx/generar-sitio.mjs <shared/datos-entidad.json> <sitio.conf> <salida>
//
// El dominio tiene que ir con «www.»: nginx atiende también el nombre sin él y
// lo redirige, y el certificado se pide para los dos.

import { readFileSync, writeFileSync } from 'node:fs'

const [entidad, plantilla, salida] = process.argv.slice(2)
if (!salida) {
  console.error('Uso: node generar-sitio.mjs <datos-entidad.json> <sitio.conf> <salida>')
  process.exit(2)
}

const { dominio } = JSON.parse(readFileSync(entidad, 'utf8')).identidad
if (!/^www\.[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dominio ?? '')) {
  console.error(`El dominio de shared/datos-entidad.json («${dominio}») tiene que ser del tipo www.ejemplo.com.`)
  process.exit(1)
}

const conf = readFileSync(plantilla, 'utf8')
  .replaceAll('__DOMINIO_SIN_WWW__', dominio.slice(4))
  .replaceAll('__DOMINIO__', dominio)
writeFileSync(salida, conf)
