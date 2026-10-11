import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { gunzipSync } from 'node:zlib'
import { leerDatosEntidad, rutaDeDatosEntidad, type DatosEntidad } from '../../../shared/datos-entidad.mjs'
import { resolverMarca } from '../../../shared/marca.mjs'
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
// En las pruebas, sin --marca, la de partida: la de esta máquina no cuenta.
const partida = resolverMarca().ficheros
const COMPLETA = resolve(raiz, '../shared/__fixtures__/marca/completa')
const leer = (carpeta: string, fichero: string) => readFileSync(join(carpeta, fichero), 'utf8')

function jsonLd(html: string): Record<string, unknown> {
  const bloque = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)
  if (!bloque) throw new Error('no hay datos estructurados')
  return JSON.parse(bloque[1]) as Record<string, unknown>
}

type Publica = ReturnType<typeof instalacionPublica>

/** Lo que dejaría /instalacion.js en el navegador, evaluado en un contexto aparte. */
function evaluar(js: string) {
  const ventana: { __INSTALACION__?: Publica } = {}
  runInNewContext(js, { window: ventana })
  const instalacion = ventana.__INSTALACION__ as Publica
  return { instalacion, valor: JSON.parse(JSON.stringify(instalacion)) as unknown }
}

describe('la orden instalacion-web.mjs', () => {
  it('escribe index.html, el manifest, robots.txt e instalacion.js con los datos, sin marcas de la plantilla', () => {
    const destino = carpetaNueva()
    const r = ejecutar(destino)
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(readdirSync(destino).sort()).toEqual(['index.html', 'instalacion.js', 'manifest.json', 'marca', 'robots.txt'])

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
    const { instalacion, valor } = evaluar(leer(destino, 'instalacion.js'))
    expect(valor).toEqual(instalacionPublica(datos, partida))
    // Congelado hasta el fondo: con freeze solo arriba, `identidad.nombre` se
    // podía cambiar igual.
    for (const objeto of [instalacion, instalacion.identidad, instalacion.marca, instalacion.marca.imagenes, instalacion.identidad.normas]) {
      if (objeto) expect(Object.isFrozen(objeto)).toBe(true)
    }
    // El módulo de la prueba es estricto: asignar a algo congelado lanza.
    expect(() => {
      (instalacion.identidad as { nombre: string }).nombre = 'Otra'
    }).toThrow(TypeError)
    expect(instalacion.identidad.nombre).toBe(identidad.nombre)
    // Secretaría, sede, redes y privacidad se cambian en el CMS y llegan de la
    // API; los módulos, también. Escritos aquí se quedarían viejos.
    for (const clave of ['secretaria', 'sede', 'redes', 'privacidad', 'modulos']) expect(valor).not.toHaveProperty(clave)
  })

  it('instalacionPublica copia los campos uno a uno: un dato nuevo del fichero no se publica solo', () => {
    const conDeMas = { ...datos, identidad: { ...identidad, nif: 'G00000000' } } as unknown as DatosEntidad
    const publica = instalacionPublica(conDeMas, partida)
    expect(Object.keys(publica)).toEqual(['identidad', 'marca'])
    expect(Object.keys(publica.identidad)).toEqual([
      'nombre', 'nombreCorto', 'tipo', 'tipoCorto', 'articulo', 'titular', 'localidad', 'dominio', 'descripcion',
      'denominacion', 'domicilio', 'normas',
    ])
    expect(Object.keys(publica.marca)).toEqual(['colorPrincipal', 'colorAcento', 'imagenes'])
    // Solo las URL de lo que pinta la web: ni la ruta del disco ni los iconos.
    expect(Object.keys(publica.marca.imagenes)).toEqual(['escudo', 'escudoDestacado', 'compartir'])
  })

  it('un dato pendiente (null) quita su línea del JSON-LD sin dejar una coma colgando', () => {
    const plantilla = readFileSync(join(raiz, 'index.html'), 'utf8')
    const sin = jsonLd(rellenarIndex(plantilla, { ...datos, identidad: { ...identidad, denominacion: null } }, partida))
    expect(sin).not.toHaveProperty('legalName')
    const con = jsonLd(rellenarIndex(plantilla, { ...datos, identidad: { ...identidad, denominacion: 'Hermandad de Ejemplo, inscrita' } }, partida))
    expect(con.legalName).toBe('Hermandad de Ejemplo, inscrita')
  })

  it('quita la coma colgante solo dentro del JSON-LD: el resto del HTML no se toca', () => {
    const plantilla = readFileSync(join(raiz, 'index.html'), 'utf8')
    // Con el salto de la plantilla, que en Windows puede ser CRLF y se conserva.
    const salto = plantilla.includes('\r\n') ? '\r\n' : '\n'
    const estilo = `<style>a{b:c,${salto}}</style>`
    const html = rellenarIndex(plantilla.replace('</head>', `${estilo}${salto}</head>`), { ...datos, identidad: { ...identidad, denominacion: null } }, partida)
    expect(html).toContain(estilo)
    expect(jsonLd(html)).not.toHaveProperty('legalName')
  })

  it('escapa las comillas, < > y & en los atributos y en el JSON-LD', () => {
    const plantilla = readFileSync(join(raiz, 'index.html'), 'utf8')
    const raro = 'Hermandad "de" <la> & Paz'
    const html = rellenarIndex(plantilla, { ...datos, identidad: { ...identidad, nombre: raro, descripcion: raro } }, partida)
    expect(html).toContain('content="Hermandad &quot;de&quot; &lt;la&gt; &amp; Paz"')
    expect(html).not.toContain('<la>')
    expect(jsonLd(html).name).toBe(raro)
    // Dentro del <script> no puede aparecer «</script>» aunque lo traiga el dato.
    const cierre = rellenarIndex(plantilla, { ...datos, identidad: { ...identidad, nombre: '</script><b>' } }, partida)
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
    for (const fichero of readdirSync(una, { recursive: true, encoding: 'utf8' })) {
      if (statSync(join(una, fichero)).isDirectory()) continue
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

describe('la marca en la orden instalacion-web.mjs', () => {
  const meta = (html: string, patron: RegExp) => patron.exec(html)?.[1]

  it('sin marca propia copia a marca/ la de partida y comparte el icono grande con la tarjeta pequeña', () => {
    const destino = carpetaNueva()
    const r = ejecutar(destino)
    expect(r.status).toBe(0)
    // Los siete de partida; las tres sin partida (destacado, compartir, cabecera) no están.
    expect(readdirSync(join(destino, 'marca')).sort()).toEqual([
      'apple-touch-icon.png', 'escudo-sobre-claro.png', 'escudo-sobre-oscuro.png', 'favicon-32.png', 'icono-192.png', 'icono-512.png',
    ])
    expect(r.stdout).toContain('[marca] escudo-sobre-oscuro.png: de la marca de partida.')
    const html = leer(destino, 'index.html')
    const icono = `/marca/icono-512.png?v=${partida.icono512.version}`
    expect(meta(html, /<meta property="og:image" content="([^"]+)"/)).toBe(`https://${identidad.dominio}${icono}`)
    expect(meta(html, /<meta name="twitter:card" content="([^"]+)"/)).toBe('summary')
    expect(jsonLd(html).image).toBe(`https://${identidad.dominio}${icono}`)
    const { instalacion } = evaluar(leer(destino, 'instalacion.js'))
    expect(instalacion.marca.imagenes).toEqual({
      escudo: `/marca/escudo-sobre-oscuro.png?v=${partida.escudoSobreOscuro.version}`,
      // Sin escudo destacado, la papeleta de la web lleva el de sobre oscuro.
      escudoDestacado: `/marca/escudo-sobre-oscuro.png?v=${partida.escudoSobreOscuro.version}`,
      compartir: icono,
    })
  })

  it('con --marca copia los de la instalación, cada uno tal cual, y las URL llevan su versión', () => {
    const destino = carpetaNueva()
    const r = ejecutar(destino, ['--marca', COMPLETA, '--comprimir'])
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    const marca = resolverMarca({ carpeta: COMPLETA }).ficheros
    for (const f of Object.values(marca)) {
      expect(f!.origen).toBe('instalacion')
      expect(readFileSync(join(destino, 'marca', f!.fichero)).equals(readFileSync(f!.ruta)), f!.fichero).toBe(true)
      expect(r.stdout).toContain(`[marca] ${f!.fichero}: de la instalación.`)
    }
    const html = leer(destino, 'index.html')
    expect(html).not.toMatch(/\{\{/)
    expect(meta(html, /<meta property="og:image" content="([^"]+)"/)).toBe(`https://${identidad.dominio}/marca/compartir.jpg?v=${marca.compartir!.version}`)
    expect(meta(html, /<meta name="twitter:card" content="([^"]+)"/)).toBe('summary_large_image')
    expect(meta(html, /<link rel="icon"[^>]*href="([^"]+)"/)).toBe(`/marca/favicon-32.png?v=${marca.favicon32.version}`)
    expect(meta(html, /<link rel="apple-touch-icon"[^>]*href="([^"]+)"/)).toBe(`/marca/apple-touch-icon.png?v=${marca.appleTouchIcon.version}`)
    const manifiesto = JSON.parse(leer(destino, 'manifest.json')) as { icons: { src: string }[] }
    expect(manifiesto.icons.map((i) => i.src)).toEqual([
      `/marca/icono-192.png?v=${marca.icono192.version}`,
      `/marca/icono-512.png?v=${marca.icono512.version}`,
      `/marca/icono-512.png?v=${marca.icono512.version}`,
    ])
    expect(evaluar(leer(destino, 'instalacion.js')).instalacion.marca.imagenes.escudoDestacado)
      .toBe(`/marca/escudo-destacado.png?v=${marca.escudoDestacado!.version}`)
  })

  it.skipIf(process.platform === 'win32')('escribe las copias en 0644 aunque el original no deje leer a otros', () => {
    // En el servidor, un fichero instalado en 640 copiado con su modo daría
    // 403 al usuario de nginx. (Windows no tiene estos permisos.)
    const carpeta = join(temporal, 'marca-640')
    mkdirSync(carpeta)
    writeFileSync(join(carpeta, 'favicon-32.png'), readFileSync(join(COMPLETA, 'favicon-32.png')), { mode: 0o640 })
    const destino = carpetaNueva()
    expect(ejecutar(destino, ['--marca', carpeta]).status).toBe(0)
    expect(statSync(join(destino, 'marca', 'favicon-32.png')).mode & 0o777).toBe(0o644)
  })

  it('vacía marca/ antes de copiar: lo que se quitó de la instalación deja de servirse', () => {
    const destino = carpetaNueva()
    mkdirSync(join(destino, 'marca'))
    writeFileSync(join(destino, 'marca', 'compartir.jpg'), 'del arranque anterior')
    expect(ejecutar(destino).status).toBe(0)
    expect(readdirSync(join(destino, 'marca'))).not.toContain('compartir.jpg')
  })

  it('una imagen que no es lo que dice su nombre impide arrancar, lo dice y no escribe nada', () => {
    const carpeta = join(temporal, 'marca-rota')
    mkdirSync(carpeta)
    writeFileSync(join(carpeta, 'escudo-sobre-oscuro.png'), 'esto es un texto, no un PNG')
    const destino = carpetaNueva()
    const r = ejecutar(destino, ['--marca', carpeta])
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('escudo-sobre-oscuro.png')
    expect(r.stderr).toContain('fichero de texto')
    expect(readdirSync(destino)).toEqual([])
  })

  it('con una carpeta de marca que no existe avisa y arranca con la de partida', () => {
    const destino = carpetaNueva()
    const r = ejecutar(destino, ['--marca', join(temporal, 'sin-marca')])
    expect(r.status).toBe(0)
    expect(r.stderr).toContain('[marca] No hay carpeta de la marca')
    expect(r.stdout).toContain('[marca] escudo-sobre-oscuro.png: de la marca de partida.')
  })
})
