// Saca los datos de la base de este equipo (Windows) para cargarlos en el
// servidor de pruebas. Los pasos para cargarlos allí, en docs/servidor.md.
//
//   node --env-file=.env scripts/exportar-base-pruebas.mjs <fichero.sql> [correo-que-se-queda ...]
//
// No vale un `mariadb-dump` a secas, por dos cosas:
//
//   1. La MariaDB de Windows guarda los nombres de tabla en minúsculas
//      (`lower_case_table_names`): `user`, `hermano`. En Linux distinguen
//      mayúsculas y Prisma busca `User` y `Hermano`. Por eso aquí solo salen
//      los DATOS, con cada tabla devuelta al nombre de su modelo de
//      prisma/schema.prisma. Las tablas las crean en el servidor las
//      migraciones, como en cualquier despliegue.
//   2. Desde el servidor los correos salen de verdad. Todo correo que no sea de
//      ejemplo (@ejemplo.invalido, @ejemplo.test) ni esté en la lista de los que
//      se quedan pasa a @ejemplo.invalido, con lo que lleva delante de la arroba
//      y el id de la fila: `pepe+12@ejemplo.invalido`. Sin el id,
//      pepe@gmail.com y pepe@hotmail.com acababan los dos en
//      pepe@ejemplo.invalido, el `UPDATE` de `User` (correo único) fallaba con
//      el 1062 y el cliente se paraba ahí: los datos ya cargados, y los
//      correos reales de las fichas, los pedidos y los donativos, sin tocar.
//      También el correo de los donativos en línea, que va dentro del JSON
//      `PagoEnLinea.donativo` (con él se mandan los certificados del 182).
//      Al final, el fichero dice cuántos correos de verdad quedan: tiene que
//      ser 0 (ver docs/servidor.md).
//
// Antes de los datos, el fichero vacía cada tabla: el servidor ya tiene filas
// propias (los módulos que siembra la API al arrancar). `_prisma_migrations` no
// se toca: es la del servidor, que dice qué migraciones tiene aplicadas.
//
// mariadb-dump se busca en MARIADB_DUMP o en la instalación de siempre.

import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [destino, ...seQuedan] = process.argv.slice(2)
if (!destino) {
  console.error('Uso: node --env-file=.env scripts/exportar-base-pruebas.mjs <fichero.sql> [correo-que-se-queda ...]')
  process.exit(2)
}

const volcador = process.env.MARIADB_DUMP ?? 'C:/Program Files/MariaDB 11.8/bin/mariadb-dump.exe'
if (!existsSync(volcador)) {
  console.error(`No encuentro mariadb-dump en «${volcador}». Pon su ruta en MARIADB_DUMP.`)
  process.exit(1)
}
for (const v of ['DATABASE_HOST', 'DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME']) {
  if (!process.env[v]) { console.error(`Falta ${v} en el .env.`); process.exit(1) }
}

// El nombre bueno de cada tabla: el de su modelo, y `_Nombre` para las que
// Prisma crea solo en las relaciones de muchos a muchos (@relation("Nombre")).
const esquema = readFileSync(path.join(raiz, 'prisma/schema.prisma'), 'utf8')
const modelos = [
  ...[...esquema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]),
  ...muchosAMuchos(esquema).map((n) => `_${n}`),
]
const nombreDe = new Map(modelos.map((m) => [m.toLowerCase(), m]))

// Una relación con nombre es de muchos a muchos (y tiene tabla propia) cuando
// sus DOS lados son listas; si solo uno lo es, es de uno a muchos y no la tiene.
function muchosAMuchos(texto) {
  const lados = new Map()
  for (const [, nombre] of texto.matchAll(/^\s+\w+\s+\w+\[\]\s+@relation\("(\w+)"/gm)) {
    lados.set(nombre, (lados.get(nombre) ?? 0) + 1)
  }
  return [...lados].filter(([, n]) => n === 2).map(([nombre]) => nombre)
}

// Las columnas de correo, por modelo (las que se llaman email, email2…). `User`
// va la última: es la única con el correo único, y si aun así fallara, lo
// demás ya estaría cambiado.
const correos = { Hermano: ['email', 'email2'], PedidoTienda: ['email'], Apadrinamiento: ['email'], ComunicadoEnvio: ['email'], User: ['email'] }

const salida = createWriteStream(destino, { encoding: 'utf8' })
salida.write(`-- Datos de la base de pruebas, sacados el ${new Date().toISOString()}.
-- Ver backend-desamparados/scripts/exportar-base-pruebas.mjs.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
${modelos.map((m) => `TRUNCATE TABLE \`${m}\`;`).join('\n')}
`)

const volcado = spawn(volcador, [
  `--host=${process.env.DATABASE_HOST}`,
  `--port=${process.env.DATABASE_PORT ?? '3306'}`,
  `--user=${process.env.DATABASE_USER}`,
  '--no-create-info',     // solo datos: las tablas las crean las migraciones
  '--complete-insert',    // con los nombres de columna, por si el orden no coincide
  '--skip-triggers',
  '--single-transaction',
  '--default-character-set=utf8mb4',
  `--ignore-table=${process.env.DATABASE_NAME}._prisma_migrations`,
  process.env.DATABASE_NAME,
], { env: { ...process.env, MYSQL_PWD: process.env.DATABASE_PASSWORD }, stdio: ['ignore', 'pipe', 'inherit'] })

// Solo se tocan los nombres de tabla al principio de las líneas que los llevan;
// los valores van detrás y nunca empiezan una línea.
const conTabla = /^(INSERT INTO|LOCK TABLES|\/\*!40000 ALTER TABLE) `([^`]+)`/
const desconocidas = new Set()
for await (const linea of createInterface({ input: volcado.stdout, crlfDelay: Infinity })) {
  salida.write(linea.replace(conTabla, (todo, orden, tabla) => {
    const bueno = nombreDe.get(tabla.toLowerCase())
    if (!bueno) { desconocidas.add(tabla); return todo }
    return `${orden} \`${bueno}\``
  }) + '\n')
}
const codigo = await new Promise((resolver) => volcado.on('close', resolver))
if (codigo !== 0) { console.error(`mariadb-dump ha terminado con ${codigo}.`); process.exit(1) }
if (desconocidas.size) {
  console.error(`Tablas que no son de ningún modelo (no se cargarían en el servidor): ${[...desconocidas].join(', ')}`)
  process.exit(1)
}

// Los correos que no son de ejemplo ni están en la lista, a @ejemplo.invalido.
const lista = seQuedan.map((c) => `'${c.toLowerCase().replaceAll("'", "''")}'`).join(', ') || "''"
// Un correo de verdad: con arroba, que no es de ejemplo ni de la lista.
const deVerdad = (x) => `${x} LIKE '%@%' AND ${x} NOT LIKE '%@ejemplo.invalido' AND ${x} NOT LIKE '%@ejemplo.test' AND LOWER(${x}) NOT IN (${lista})`
// Lo de delante de la arroba (recortado: la columna es de 191) y el id de la fila, que lo hace único.
const inventado = (x) => `CONCAT(LEFT(SUBSTRING_INDEX(${x}, '@', 1), 120), '+', \`id\`, '@ejemplo.invalido')`
const enElDonativo = "JSON_VALUE(`donativo`, '$.email')"
// mariadb-dump deja la conexión con `autocommit=0` tras la última tabla: sin
// volver a encenderlo, estos UPDATE quedan en una transacción que nadie
// confirma y se deshacen al cerrar el cliente, sin ningún error.
salida.write('\n-- Ningún correo de verdad, salvo los que se quedan.\nSET autocommit = 1;\n')
salida.write(`UPDATE \`PagoEnLinea\` SET \`donativo\` = JSON_SET(\`donativo\`, '$.email', ${inventado(enElDonativo)}) WHERE ${deVerdad(enElDonativo)};\n`)
for (const [tabla, columnas] of Object.entries(correos)) {
  for (const c of columnas) {
    salida.write(`UPDATE \`${tabla}\` SET \`${c}\` = ${inventado(`\`${c}\``)} WHERE ${deVerdad(`\`${c}\``)};\n`)
  }
}
// La comprobación: cuántos quedan. Si no es 0, algo falló y no se arranca la API.
const quedan = [
  `SELECT COUNT(*) AS n FROM \`PagoEnLinea\` WHERE ${deVerdad(enElDonativo)}`,
  ...Object.entries(correos).flatMap(([tabla, columnas]) => columnas.map((c) => `SELECT COUNT(*) AS n FROM \`${tabla}\` WHERE ${deVerdad(`\`${c}\``)}`)),
]
salida.write(`SELECT SUM(n) AS correos_de_verdad_que_quedan FROM (${quedan.join(' UNION ALL ')}) AS t;\n`)
salida.end('COMMIT;\nSET FOREIGN_KEY_CHECKS = 1;\n')
await new Promise((resolver) => salida.on('finish', resolver))
console.log(`Hecho: ${destino}. Se quedan con su correo: ${seQuedan.join(', ') || 'ninguno'}.`)
