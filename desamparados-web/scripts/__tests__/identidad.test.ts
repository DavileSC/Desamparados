import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { leerDatosEntidad, rutaDeDatosEntidad } from '../../../shared/datos-entidad.mjs'

// index.html, el manifest y robots.txt son de cada instalación y no están en
// git: se generan antes de dev y de build. Aquí se generan con el ejemplo en
// una carpeta aparte, para no pisar los de esta máquina.

const raiz = process.cwd()
const destino = mkdtempSync(join(tmpdir(), 'identidad-'))
afterAll(() => rmSync(destino, { recursive: true, force: true }))

const generar = (entorno: NodeJS.ProcessEnv) =>
  spawnSync(process.execPath, ['scripts/generar-identidad.mjs', '--destino', destino], { cwd: raiz, encoding: 'utf8', env: entorno })

describe('los ficheros de la identidad', () => {
  it('se generan con los datos de la instalación, sin marcas de la plantilla', () => {
    const r = generar({ ...process.env, DATOS_ENTIDAD: 'shared/datos-entidad.ejemplo.json' })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)

    const html = readFileSync(join(destino, 'index.html'), 'utf8')
    expect(html).not.toMatch(/\{\{/)
    const { identidad } = leerDatosEntidad()
    expect(html).toContain(`<title>${identidad.nombre} | ${identidad.localidad}</title>`)
    expect(html).toContain(`"url": "https://${identidad.dominio}/"`)
    expect(readFileSync(join(destino, 'public/robots.txt'), 'utf8')).toContain(`Sitemap: https://${identidad.dominio}/sitemap.xml`)
  })

  it('sin el fichero de la instalación falla y dice qué hacer, en vez de usar el ejemplo', () => {
    const r = generar({ ...process.env, DATOS_ENTIDAD: 'instalacion/no-existe.json' })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('no existe')
  })

  it('acepta el fichero con la marca BOM que deja Windows al guardar', () => {
    // PowerShell 5.1 y el Bloc de notas la ponen, y JSON.parse no la acepta: el
    // 08-10-2026 llegó así al servidor. Se escribe por su código para que se vea.
    const conBom = join(destino, 'con-bom.json')
    writeFileSync(conBom, String.fromCharCode(0xfeff) + readFileSync(rutaDeDatosEntidad(), 'utf8'))
    expect(leerDatosEntidad({ DATOS_ENTIDAD: conBom }).identidad.dominio).toBe(leerDatosEntidad().identidad.dominio)

    const sitio = join(destino, 'sitio.conf')
    const r = spawnSync(process.execPath, ['../docker/nginx/generar-sitio.mjs', conBom, '../docker/nginx/sitio.conf', sitio], { cwd: raiz, encoding: 'utf8' })
    expect(r.stderr).toBe('')
    expect(readFileSync(sitio, 'utf8')).toContain(`server_name ${leerDatosEntidad().identidad.dominio}`)
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
