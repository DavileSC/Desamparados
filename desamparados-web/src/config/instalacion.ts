/**
 * Los datos de la corporación de esta instalación, tal como llegan en
 * `window.__INSTALACION__` (src/instalacion.d.ts). Es el único sitio de la web
 * que lo lee: `config/site.ts` y `domain/articulos.ts` toman de aquí lo suyo.
 *
 * No van compilados dentro: una misma web sirve a cualquier corporación, y
 * /instalacion.js se escribe al arrancar el contenedor con su fichero de datos.
 *
 * Si no ha llegado (el fichero no se cargó, o se sirvió otro), ningún módulo
 * lanza al importarse: se toma una instalación vacía para que todo cargue, y
 * main.tsx, al ver `faltaInstalacion`, no monta la web y enseña el aviso. Una
 * web con el nombre en blanco publicaría títulos y textos legales rotos.
 */

const INSTALACION_VACIA: Instalacion = {
  identidad: {
    nombre: '',
    nombreCorto: '',
    tipo: '',
    tipoCorto: '',
    articulo: 'el',
    titulares: [],
    titular: '',
    localidad: '',
    dominio: '',
    descripcion: '',
    denominacion: null,
    domicilio: null,
    normas: null,
  },
  // Sin imágenes: con la instalación vacía la web no se monta (main.tsx), y
  // un módulo que lea aquí la URL del escudo al importarse no debe lanzar.
  marca: { colorPrincipal: null, colorAcento: null, imagenes: { escudo: '', escudoDestacado: '', compartir: '' } },
}

const recibida = typeof window === 'undefined' ? undefined : window.__INSTALACION__

export const faltaInstalacion = !recibida
export const instalacion: Instalacion = recibida ?? INSTALACION_VACIA

export const AVISO_SIN_INSTALACION =
  'No se han podido cargar los datos de esta web (/instalacion.js). Recarga la página; si sigue igual, avisa a quien la administra.'

/**
 * El aviso en lugar de la web, con DOM simple: sin React, sin el tema y sin
 * nada que dependa de los datos que faltan. El estilo va en el atributo (la
 * CSP permite estilos en línea, no scripts).
 */
export function avisarSinInstalacion(raiz: HTMLElement) {
  console.error('No ha llegado window.__INSTALACION__: /instalacion.js no se ha cargado o no es el que toca. La web no se monta.')
  const aviso = document.createElement('p')
  aviso.setAttribute('role', 'alert')
  aviso.textContent = AVISO_SIN_INSTALACION
  aviso.setAttribute('style', 'max-width:36rem;margin:0 auto;padding:20vh 16px 0;font:1.125rem/1.6 system-ui,sans-serif')
  const fondo = document.createElement('div')
  // Los colores del tema público, que cumplen el contraste (notas-del-proyecto.md §11).
  fondo.setAttribute('style', 'min-height:100vh;background:#262326;color:#ffffff')
  fondo.append(aviso)
  raiz.replaceChildren(fondo)
}
