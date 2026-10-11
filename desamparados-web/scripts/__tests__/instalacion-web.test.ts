import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { gunzipSync } from 'node:zlib'
import { leerDatosEntidad, rutaDeDatosEntidad, type DatosEntidad } from '../../../shared/datos-entidad.mjs'
import { instalacionPublica, rellenarIndex } from '../instalacion-web.mjs'

// La web ya no lleva dentro los datos de la corporación: los escribe esta orden
// al arrancar el contenedor (docker/nginx/40-instalacion.sh), junto a la web
// compilada. Aquí se ejecuta como allí, con el index.html del repositorio (la
// plantilla) y el ejemplo, en carpetas aparte para no pisar nada.

const raiz = process.cwd()
const temporal = mkdtempSync(join(tmpdir(), 'instalacion-web-'))
afterAll(() => rmSync(temporal, { recursive: true, force: true }))

let carpetas = 0
const carpetaNueva = () => {
  const ruta = join(temporal, `destino-${++carpetas}`)
  mkdirSync(ruta)
  return ruta
}

const ejecutar = (destino: string, extra: string[] = [], plantilla = 'index.html') =>
  spawnSync(process.execPath, ['scripts/instalacion-web.mjs', '--plantilla', plantilla, '--destino', destino, ...extra], {
    cwd: raiz,
    encoding: 'utf8',
  })

const datos = leerDatosEntidad()
const { identidad } = datos
const leer = (carpeta: string, fichero: string) => readFileSync(join(carpeta, fichero), 'utf8')

function jsonLd(html: string): Record<string, unknown> {
  const bloque = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)
  if (!bloque) throw new Error('no hay datos estructurados')
  return JSON.parse(bloque[1]) as Record<string, unknown>
}

/** Lo que dejaría /instalacion.js en el navegador, evaluado en un contexto aparte. */
function evaluar(js: string) {
  const ventana: { __INSTALACION__?: unknown } = {}
  runInNewContext(js, { window: ventana })
  return { congelado: Object.isFrozen(ventana.__INSTALACION__), valor: JSON.parse(JSON.stringify(ventana.__INSTALACION__)) as unknown }
}

describe('la orden instalacion-web.mjs', () => {
  it('escribe index.html, el manifest, robots.txt e instalacion.js con los datos, sin marcas de la plantilla', () => {
    const destino = carpetaNueva()
    const r = ejecutar(destino)
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(readdirSync(destino).sort()).toEqual(['index.html', 'instalacion.js', 'manifest.json', 'robots.txt'])

    const html = leer(destino, 'index.html')
    expect(html).not.toMatch(/\{\{/)
    expect(html).toContain(`<title>${identidad.nombre} | ${identidad.localidad}</title>`)
    expect(jsonLd(html).url).toBe(`https://${identidad.dominio}/`)
    expect(leer(destino, 'robots.txt')).toContain(`Sitemap: https://${identidad.dominio}/sitemap.xml`)
    const manifest = JSON.parse(leer(destino, 'manifest.json')) as Record<string, unknown>
    expect(manifest.name).toBe(identidad.nombre)
    expect(manifest.short_name).toBe(identidad.nombreCorto)
  })

  it('instalacion.js deja en window lo público de la identidad y la marca, congelado, y nada más', () => {
    const destino = carpetaNueva()
    expect(ejecutar(destino).status).toBe(0)
    const { congelado, valor } = evaluar(leer(destino, 'instalacion.js'))
    expect(congelado).toBe(true)
    expect(valor).toEqual(instalacionPublica(datos))
    // Secretaría, sede, redes y privacidad se cambian en el CMS y llegan de la
    // API; los módulos, también. Escritos aquí se quedarían viejos.
    for (const clave of ['secretaria', 'sede', 'redes', 'privacidad', 'modulos']) expect(valor).not.toHaveProperty(clave)
  })

  it('instalacionPublica copia los campos uno a uno: un dato nuevo del fichero no se publica solo', () => {
    const conDeMas = { ...datos, identidad: { ...identidad, nif: 'G00000000' } } as unknown as DatosEntidad
    const publica = instalacionPublica(conDeMas)
    expect(Object.keys(publica)).toEqual(['identidad', 'marca'])
    expect(Object.keys(publica.identidad)).toEqual([
      'nombre', 'nombreCorto', 'tipo', 'tipoCorto', 'articulo', 'titular', 'localidad', 'dominio', 'descripcion',
      'denominacion', 'domicilio', 'normas',
    ])
    expect(Object.keys(publica.marca)).toEqual(['colorPrincipal', 'colorAcento'])
  })

  it('un dato pendiente (null) quita su línea del JSON-LD sin dejar una coma colgando', () => {
    const plantilla = readFileSync(join(raiz, 'index.html'), 'utf8')
    const sin = jsonLd(rellenarIndex(plantilla, { ...datos, identidad: { ...identidad, denominacion: null } }))
    expect(sin).not.toHaveProperty('legalName')
    const con = jsonLd(rellenarIndex(plantilla, { ...datos, identidad: { ...identidad, denominacion: 'Hermandad de Ejemplo, inscrita' } }))
    expect(con.legalName).toBe('Hermandad de Ejemplo, inscrita')
  })

  it('escapa las comillas, < > y & en los atributos y en el JSON-LD', () => {
    const plantilla = readFileSync(join(raiz, 'index.html'), 'utf8')
    const raro = 'Hermandad "de" <la> & Paz'
    const html = rellenarIndex(plantilla, { ...datos, identidad: { ...identidad, nombre: raro, descripcion: raro } })
    expect(html).toContain('content="Hermandad &quot;de&quot; &lt;la&gt; &amp; Paz"')
    expect(html).not.toContain('<la>')
    expect(jsonLd(html).name).toBe(raro)
    // Dentro del <script> no puede aparecer «</script>» aunque lo traiga el dato.
    const cierre = rellenarIndex(plantilla, { ...datos, identidad: { ...identidad, nombre: '</script><b>' } })
    expect(jsonLd(cierre).name).toBe('</script><b>')
  })

  it('con --comprimir deja además index.html.gz, que es el mismo index.html', () => {
    const destino = carpetaNueva()
    const r = ejecutar(destino, ['--comprimir'])
    expect(r.status).toBe(0)
    expect(gunzipSync(readFileSync(join(destino, 'index.html.gz'))).toString('utf8')).toBe(leer(destino, 'index.html'))
  })

  it('con un dato mal puesto no escribe nada y dice todos los errores', () => {
    const roto = join(temporal, 'roto.json')
    const crudo = JSON.parse(readFileSync(rutaDeDatosEntidad(), 'utf8'))
    crudo.identidad.articulo = 'El'
    crudo.identidad.nombre_corto = 'X'
    writeFileSync(roto, JSON.stringify(crudo))
    const destino = carpetaNueva()
    const r = ejecutar(destino, ['--datos', roto])
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('identidad.articulo')
    expect(r.stderr).toContain('identidad.nombre_corto')
    expect(readdirSync(destino)).toEqual([])
  })

  it('sin el fichero de datos falla y dice que hay que montar la carpeta de la instalación', () => {
    const destino = carpetaNueva()
    const r = ejecutar(destino, ['--datos', join(temporal, 'no-existe.json')])
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('no-existe.json')
    expect(r.stderr).toContain('./instalacion')
    expect(r.stderr).toContain('/app/instalacion')
    expect(readdirSync(destino)).toEqual([])
  })

  it('acepta el fichero con la marca BOM que deja Windows al guardar', () => {
    // PowerShell 5.1 y el Bloc de notas la ponen, y JSON.parse no la acepta: el
    // 08-10-2026 llegó así al servidor. Se escribe por su código para que se vea.
    const conBom = join(temporal, 'con-bom.json')
    writeFileSync(conBom, String.fromCharCode(0xfeff) + readFileSync(rutaDeDatosEntidad(), 'utf8'))
    const destino = carpetaNueva()
    const r = ejecutar(destino, ['--datos', conBom])
    expect(r.stderr).toBe('')
    expect(leer(destino, 'robots.txt')).toContain(`Sitemap: https://${identidad.dominio}/sitemap.xml`)

    // El sitio de nginx, que también se escribe al arrancar el contenedor.
    const sitio = join(temporal, 'sitio.conf')
    const s = spawnSync(process.execPath, ['../docker/nginx/generar-sitio.mjs', conBom, '../docker/nginx/sitio.conf', sitio], { cwd: raiz, encoding: 'utf8' })
    expect(s.stderr).toBe('')
    expect(readFileSync(sitio, 'utf8')).toContain(`server_name ${identidad.dominio}`)
  })

  it('rechaza una plantilla que no carga /instalacion.js, o que lo carga detrás del código de la web', () => {
    const plantilla = readFileSync(join(raiz, 'index.html'), 'utf8')
    const sinScript = join(temporal, 'sin-script.html')
    writeFileSync(sinScript, plantilla.replace(/<script src="\/instalacion\.js"><\/script>/, ''))
    const destino = carpetaNueva()
    const r = ejecutar(destino, [], sinScript)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('/instalacion.js')
    expect(readdirSync(destino)).toEqual([])

    const detras = join(temporal, 'detras.html')
    writeFileSync(detras, plantilla.replace('<head>', '<head><script type="module" src="/assets/x.js"></script>'))
    expect(ejecutar(carpetaNueva(), [], detras).status).not.toBe(0)
  })

  it('dos ejecuciones dan lo mismo: el contenedor la repite en cada arranque', () => {
    const una = carpetaNueva()
    const otra = carpetaNueva()
    expect(ejecutar(una, ['--comprimir']).status).toBe(0)
    expect(ejecutar(otra, ['--comprimir']).status).toBe(0)
    for (const fichero of readdirSync(una)) {
      expect(readFileSync(join(otra, fichero)).equals(readFileSync(join(una, fichero))), fichero).toBe(true)
    }
  })

  it('fuera de las pruebas busca instalacion/ y no cae en el ejemplo', () => {
    expect(rutaDeDatosEntidad({ VITEST: 'true' })).toMatch(/shared[\\/]datos-entidad\.ejemplo\.json$/)
    // En esta máquina puede existir o no: si existe es ese; si no, el error lo dice.
    let resultado: string
    try {
      resultado = rutaDeDatosEntidad({})
    } catch (error) {
      resultado = String(error)
    }
    expect(resultado).toMatch(/instalacion[\\/]datos-entidad\.json/)
  })
})
