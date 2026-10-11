// Rellena el dominio en la configuración de nginx con el de
// instalacion/datos-entidad.json, al arrancar el contenedor de la web
// (40-instalacion.sh). Así el dominio se escribe en un único sitio para la web,
// su dirección canónica y nginx.
//
//   node docker/nginx/generar-sitio.mjs <instalacion/datos-entidad.json> <sitio.conf> <salida>
//
// El dominio tiene que ir con «www.»: nginx atiende también el nombre sin él y
// lo redirige, y el certificado se pide para los dos.

import { readFileSync, writeFileSync } from 'node:fs'

const [entidad, plantilla, salida] = process.argv.slice(2)
if (!salida) {
  console.error('Uso: node generar-sitio.mjs <datos-entidad.json> <sitio.conf> <salida>')
  process.exit(2)
}

// Sin la marca BOM que deja Windows al guardar (U+FEFF): JSON.parse no la acepta.
const texto = readFileSync(entidad, 'utf8')
const { dominio } = JSON.parse(texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto).identidad
if (!/^www\.[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dominio ?? '')) {
  console.error(`El dominio de ${entidad} («${dominio}») tiene que ser del tipo www.ejemplo.com.`)
  process.exit(1)
}

const conf = readFileSync(plantilla, 'utf8')
  .replaceAll('__DOMINIO_SIN_WWW__', dominio.slice(4))
  .replaceAll('__DOMINIO__', dominio)
writeFileSync(salida, conf)
