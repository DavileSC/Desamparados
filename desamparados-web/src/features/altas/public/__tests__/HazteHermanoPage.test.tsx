import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import HazteHermanoPage from '../HazteHermanoPage'

// `delay: null` quita la espera que userEvent mete entre pulsación y
// pulsación. Son diez campos tecleados letra a letra: con la espera, cada
// test rondaba los 3 s estando solo y se pasaba del tope de 5 s en cuanto la
// batería completa competía por la CPU. Aquí no se comprueba nada del ritmo
// de escritura, así que la espera solo costaba tiempo y falsos rojos.
const usuario = () => userEvent.setup({ delay: null })
type Usuario = ReturnType<typeof usuario>

const DATOS: Record<string, string> = {
  Nombre: 'Juan', 'Primer apellido': 'Pérez', 'Segundo apellido': 'Ruiz', 'DNI/NIE': '12345678Z', 'Fecha de nacimiento': '1990-04-12',
  'Fecha de bautismo': '1990-06-10',
  Email: 'juan@ejemplo.es', Teléfono: '600123456',
  Dirección: 'Calle Real 14', Localidad: 'Málaga', 'Código postal': '29013',
  Contraseña: 'Prueba-2026-Segura',
}

// El formulario va por pasos: todos están en el DOM (así la tarjeta mide
// siempre lo mismo) pero solo se ve, y se puede usar, el paso actual. El
// primero no tiene campos: pregunta quién se apunta, y de eso depende el resto.
const PASO_1 = ['Nombre', 'Primer apellido', 'Segundo apellido', 'DNI/NIE', 'Fecha de nacimiento']
const PASO_2 = ['Email', 'Teléfono', 'Dirección', 'Código postal', 'Localidad']
/** Lo que el servidor guarda de la ficha propia con los datos de arriba. */
const TITULAR = { fechaNacimiento: '1990-04-12', sexo: 'HOMBRE', estadoCivil: 'SOLTERO', fechaBautismo: '1990-06-10' }

/** Elegir camino es el «Continuar» del primer paso. */
const elegir = (u: Usuario, nombre: RegExp) => u.click(screen.getByRole('radio', { name: nombre }))
// Los rótulos son los que se leen en la pantalla: el nombre accesible de cada
// opción es su título (`aria-label`), no el título más su explicación.
const CAMINO_HERMANO = /^Quiero ser hermano$/
const CAMINO_CON_MENORES = /^Queremos ser hermanos$/
const CAMINO_SOLO_MENORES = /^Apunto a un familiar$/

/**
 * Los campos de un menor, acotados a su bloque: «Nombre» y los apellidos también
 * están en el paso del adulto, y todos los pasos viven en el DOM a la vez.
 */
const bloqueMenor = (indice: number) => screen.getByRole('group', { name: new RegExp(`^Menor ${indice + 1}`) })

async function rellenarMenor(u: Usuario, indice: number, datos: Record<string, string>) {
  const bloque = within(bloqueMenor(indice))
  for (const [etiqueta, valor] of Object.entries(datos)) {
    const campo = bloque.getByLabelText(etiqueta)
    await u.clear(campo)
    await u.type(campo, valor)
  }
}

/**
 * El paso que se está usando. Todos viven en el DOM a la vez y los que no
 * tocan van `inert`, así que «Nombre» o «Primer apellido» aparecen varias veces
 * (el del adulto y el de cada menor): hay que buscar dentro del que toca.
 */
const pasoActivo = () =>
  // `closest` y no `hasAttribute`: cada menor tiene su propio fieldset dentro
  // del paso, y esos no llevan el inert que lleva el paso entero.
  Array.from(document.querySelectorAll('fieldset')).find((f) => f.closest('[inert]') === null)!

async function rellenar(u: Usuario, etiquetas: string[], datos: Partial<Record<string, string>> = {}) {
  for (const etiqueta of etiquetas) {
    const campo = within(pasoActivo()).getByLabelText(etiqueta)
    await u.clear(campo)
    await u.type(campo, datos[etiqueta] ?? DATOS[etiqueta])
  }
}

const continuar = (u: Usuario) => u.click(screen.getByRole('button', { name: 'Continuar' }))

/** Un desplegable de MUI no es un <select>: se abre y se elige la opción. */
async function escoger(u: Usuario, etiqueta: string, opcion: RegExp) {
  await u.click(within(pasoActivo()).getByRole('combobox', { name: etiqueta }))
  await u.click(await screen.findByRole('option', { name: opcion }))
}

/** El paso de «Tus datos» de quien se hace hermano: los textos y los dos desplegables. */
async function rellenarDatos(u: Usuario, datos: Partial<Record<string, string>> = {}) {
  await rellenar(u, PASO_1, datos)
  await escoger(u, 'Sexo', /^Hombre$/)
  await escoger(u, 'Estado civil', /^Soltero/)
}

/** Cuota en Secretaría: el camino sin datos bancarios. */
const pagarEnSecretaria = (u: Usuario) => escoger(u, 'Forma de pago', /^En Secretaría$/)

/**
 * El paso de un campo, por su fieldset. Los pasos que no tocan van `inert`
 * (ni se usan ni los lee un lector). No se comprueba la visibilidad porque el
 * envoltorio animado arranca con opacidad 0 y en jsdom nunca entra en pantalla.
 */
const pasoDe = (etiqueta: string) => screen.getByLabelText(etiqueta).closest('fieldset')!

/** Recorre los pasos del camino más corto y deja el formulario listo para enviar. */
async function rellenarTodo(datos: Partial<Record<string, string>> = {}) {
  const u = usuario()
  await elegir(u, CAMINO_HERMANO)
  await rellenarDatos(u, datos)
  await continuar(u)
  await rellenar(u, ['Fecha de bautismo'], datos)
  await continuar(u)
  await rellenar(u, PASO_2, datos)
  await continuar(u)
  await pagarEnSecretaria(u)
  await continuar(u)
  await rellenar(u, ['Contraseña'], datos)
  await u.click(screen.getByLabelText('Acepto la política de privacidad'))
  return u
}

const enviar = (u: Usuario) => u.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

const respuesta = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

describe('HazteHermanoPage', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('no pasa del primer paso con un DNI de letra equivocada', async () => {
    // El servidor lo rechazaba con un «Error de validación» sin más: el
    // navegador daba por bueno cualquier letra.
    const fetchFalso = vi.fn()
    vi.stubGlobal('fetch', fetchFalso)
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await elegir(u, CAMINO_HERMANO)
    await rellenarDatos(u, { 'DNI/NIE': '12345678A' })
    await continuar(u)

    expect(await screen.findByText(/la letra no corresponde/i)).toBeInTheDocument()
    expect(pasoDe('Email')).toHaveAttribute('inert')
    expect(screen.getByText('Paso 2 de 6')).toBeInTheDocument()
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('no pasa del segundo paso con un teléfono que no son nueve dígitos', async () => {
    const fetchFalso = vi.fn()
    vi.stubGlobal('fetch', fetchFalso)
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await elegir(u, CAMINO_HERMANO)
    await rellenarDatos(u)
    await continuar(u)
    await rellenar(u, ['Fecha de bautismo'])
    await continuar(u)
    await rellenar(u, PASO_2, { Teléfono: '95212345' })
    await continuar(u)

    expect(await screen.findByText(/nueve d[ií]gitos/i)).toBeInTheDocument()
    expect(pasoDe('Contraseña')).toHaveAttribute('inert')
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('conserva lo escrito al volver atrás', async () => {
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await elegir(u, CAMINO_HERMANO)
    await rellenarDatos(u)
    await continuar(u)
    expect(pasoDe('Fecha de bautismo')).not.toHaveAttribute('inert')
    await u.click(screen.getByRole('button', { name: 'Atrás' }))

    expect(pasoDe('Nombre')).not.toHaveAttribute('inert')
    expect(screen.getByLabelText('Nombre')).toHaveValue('Juan')
    expect(screen.getByLabelText('DNI/NIE')).toHaveValue('12345678Z')
  })

  it('manda el DNI y el teléfono normalizados', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      respuesta({ user: { id: 1, email: 'juan@ejemplo.es' }, fichas: 1, message: 'ok' }, 201),
    )
    vi.stubGlobal('fetch', fetchFalso)
    renderWithProviders(<HazteHermanoPage />)
    const u = await rellenarTodo({ 'DNI/NIE': '12345678-z', Teléfono: '+34 600 12 34 56' })
    await enviar(u)

    expect(fetchFalso).toHaveBeenCalled()
    const cuerpo = JSON.parse(fetchFalso.mock.calls[0][1].body)
    expect(cuerpo.usuario.dni).toBe('12345678Z')
    expect(cuerpo.usuario.telefono).toBe('600123456')
    // Camino 1: su ficha y nadie más.
    expect(cuerpo.titular).toEqual(TITULAR)
    expect(cuerpo.pago).toEqual({ forma: 'EFECTIVO' })
    expect(cuerpo.usuario).toMatchObject({ provincia: 'Málaga', comunidadAutonoma: 'Andalucía', pais: 'España', boletin: false })
    expect(cuerpo.menores).toBeUndefined()
  })

  it('vuelve al paso del campo que rechaza el servidor y lo enfoca', async () => {
    // El servidor manda { message: 'Error de validación', errors: [{field, message}] }
    // y la página solo enseñaba el message: un aviso que no dice qué corregir.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({
      status: 'error',
      message: 'Error de validación',
      errors: [{ field: 'usuario.dni', message: 'ese DNI ya está registrado' }],
    }, 400)))
    renderWithProviders(<HazteHermanoPage />)
    const u = await rellenarTodo()
    await enviar(u)

    expect(await screen.findByText('ese DNI ya está registrado')).toBeInTheDocument()
    expect(pasoDe('DNI/NIE')).not.toHaveAttribute('inert')
    expect(screen.getByLabelText('DNI/NIE')).toHaveFocus()
    expect(screen.getByText('Paso 2 de 6')).toBeInTheDocument()
  })

  it('sustituye el formulario por la confirmación con el email usado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respuesta({ user: { id: 1, email: 'juan@ejemplo.es' }, fichas: 1, message: 'ok' }, 201),
    ))
    renderWithProviders(<HazteHermanoPage />)
    const u = await rellenarTodo()
    await enviar(u)

    // El título recibe el foco: quien va con teclado o lector de pantalla se
    // entera de que la página ha cambiado y no se queda sobre un botón que ya no está.
    const titulo = await screen.findByRole('heading', { name: /Gracias, Juan/ })
    expect(titulo).toHaveFocus()
    expect(screen.getByText('juan@ejemplo.es')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar solicitud' })).not.toBeInTheDocument()
  })

  it('el camino con menores añade un paso, y se pueden apuntar dos', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      respuesta({ user: { id: 1, email: 'juan@ejemplo.es' }, fichas: 3, message: 'ok' }, 201),
    )
    vi.stubGlobal('fetch', fetchFalso)
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await elegir(u, CAMINO_CON_MENORES)
    await rellenarDatos(u)
    await continuar(u)
    await rellenar(u, ['Fecha de bautismo'])
    await continuar(u)

    // El primer menor sale ya puesto: nadie elige este camino para luego tener
    // que pulsar «añadir».
    expect(screen.getByText('Paso 4 de 7')).toBeInTheDocument()
    await rellenarMenor(u, 0, { Nombre: 'Lucía', 'Primer apellido': 'Pérez', 'Segundo apellido': 'Cano', 'Fecha de nacimiento': '2017-04-12' })
    await u.click(screen.getByRole('button', { name: /añadir otro menor/i }))
    await rellenarMenor(u, 1, { Nombre: 'Martín', 'Primer apellido': 'Pérez', 'Segundo apellido': 'Cano', 'Fecha de nacimiento': '2019-06-30' })

    await continuar(u)
    await rellenar(u, PASO_2)
    await continuar(u)
    await pagarEnSecretaria(u)
    await continuar(u)
    await rellenar(u, ['Contraseña'])
    await u.click(screen.getByLabelText('Acepto la política de privacidad'))
    await enviar(u)

    const cuerpo = JSON.parse(fetchFalso.mock.calls[0][1].body)
    expect(cuerpo.titular).toEqual(TITULAR)
    expect(cuerpo.menores).toHaveLength(2)
    expect(cuerpo.menores[0]).toMatchObject({ nombre: 'Lucía', parentesco: 'HIJO' })
    expect(cuerpo.menores[1]).toMatchObject({ nombre: 'Martín' })
    // Sin DNI ni correo no se mandan esos campos: el servidor los quiere ausentes.
    expect(cuerpo.menores[0].dni).toBeUndefined()
  // Siete pasos y dos menores tecleados campo a campo: con la suite entera
  // compitiendo por la CPU se pasa de los 20 s de tope, sin que falle nada.
  }, 45_000)

  it('quien solo apunta a un menor no da su fecha de nacimiento: no tendrá ficha', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      respuesta({ user: { id: 1, email: 'juan@ejemplo.es' }, fichas: 1, message: 'ok' }, 201),
    )
    vi.stubGlobal('fetch', fetchFalso)
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await elegir(u, CAMINO_SOLO_MENORES)

    // Su DNI sí se pide: es el de la cuenta. Su nacimiento no, ni su sexo,
    // estado civil o bautismo: no va a tener ficha.
    expect(screen.getByLabelText('DNI/NIE')).toBeInTheDocument()
    expect(within(pasoActivo()).queryByRole('combobox', { name: 'Sexo' })).not.toBeInTheDocument()
    await rellenar(u, ['Nombre', 'Primer apellido', 'Segundo apellido', 'DNI/NIE'])
    await continuar(u)
    await rellenarMenor(u, 0, { Nombre: 'Lucía', 'Primer apellido': 'Pérez', 'Segundo apellido': 'Cano', 'Fecha de nacimiento': '2017-04-12' })
    await continuar(u)
    await rellenar(u, PASO_2)
    await continuar(u)
    await pagarEnSecretaria(u)
    await continuar(u)
    expect(within(pasoActivo()).queryByText('Fotografía')).not.toBeInTheDocument()
    await rellenar(u, ['Contraseña'])
    await u.click(screen.getByLabelText('Acepto la política de privacidad'))
    await enviar(u)

    const cuerpo = JSON.parse(fetchFalso.mock.calls[0][1].body)
    expect(cuerpo.titular).toBeUndefined()
    expect(cuerpo.menores).toHaveLength(1)
  })

  it('avisa de la autorización cuando el menor no es hijo suyo', async () => {
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await elegir(u, CAMINO_CON_MENORES)
    await rellenarDatos(u)
    await continuar(u)
    await rellenar(u, ['Fecha de bautismo'])
    await continuar(u)

    expect(screen.queryByText(/autorización firmada/i)).not.toBeInTheDocument()
    // El desplegable de MUI no es un <select>: se abre y se elige la opción.
    await u.click(within(bloqueMenor(0)).getByRole('combobox'))
    await u.click(await screen.findByRole('option', { name: /sobrino/i }))
    expect(await screen.findByText(/autorización firmada/i)).toBeInTheDocument()
  })

  it('a quien ya está en el censo le ofrece pedir la reactivación', async () => {
    const fetchFalso = vi.fn()
      .mockResolvedValueOnce(respuesta({ message: 'Ya hay una ficha en el censo con ese DNI. Si fuiste hermano, pide a Secretaría que te reactive.' }, 409))
      .mockResolvedValueOnce(respuesta({ message: 'Si hay una ficha a tu nombre, Secretaría la revisará y se pondrá en contacto contigo.' }, 200))
    vi.stubGlobal('fetch', fetchFalso)
    renderWithProviders(<HazteHermanoPage />)
    const u = await rellenarTodo()
    await enviar(u)

    await u.click(await screen.findByRole('button', { name: /pedir la reactivación/i }))

    expect(await screen.findByText(/Secretaría la revisará/i)).toBeInTheDocument()
    expect(String(fetchFalso.mock.calls[1][0])).toContain('/auth/reactivacion')
    expect(JSON.parse(fetchFalso.mock.calls[1][1].body)).toEqual({ dni: '12345678Z', email: 'juan@ejemplo.es' })
  })

  it('no pasa de «Tus datos» sin sexo ni estado civil', async () => {
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await elegir(u, CAMINO_HERMANO)
    await rellenar(u, PASO_1)
    await continuar(u)

    expect(await screen.findAllByText('Elige una opción')).toHaveLength(2)
    expect(pasoDe('Fecha de bautismo')).toHaveAttribute('inert')
  })

  it('la fecha de bautismo es obligatoria y no puede ser anterior al nacimiento', async () => {
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await elegir(u, CAMINO_HERMANO)
    await rellenarDatos(u)
    await continuar(u)
    await continuar(u)
    expect(await screen.findByText('La fecha de bautismo es obligatoria')).toBeInTheDocument()

    await rellenar(u, ['Fecha de bautismo'], { 'Fecha de bautismo': '1989-01-01' })
    await continuar(u)
    expect(await screen.findByText(/anterior al nacimiento/i)).toBeInTheDocument()
    expect(pasoDe('Email')).toHaveAttribute('inert')
  })

  it('el código postal rellena la provincia y la comunidad, sin pisar lo escrito a mano', async () => {
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await elegir(u, CAMINO_HERMANO)
    await rellenarDatos(u)
    await continuar(u)
    await rellenar(u, ['Fecha de bautismo'])
    await continuar(u)

    expect(screen.getByLabelText('País')).toHaveValue('España')
    await rellenar(u, ['Código postal'], { 'Código postal': '41004' })
    expect(screen.getByLabelText('Provincia')).toHaveValue('Sevilla')
    expect(screen.getByLabelText('Comunidad autónoma')).toHaveValue('Andalucía')

    // Otro código cambia lo que puso la tabla; lo escrito a mano se queda.
    await u.clear(screen.getByLabelText('Comunidad autónoma'))
    await u.type(screen.getByLabelText('Comunidad autónoma'), 'Mi comunidad')
    await rellenar(u, ['Código postal'], { 'Código postal': '28013' })
    expect(screen.getByLabelText('Provincia')).toHaveValue('Madrid')
    expect(screen.getByLabelText('Comunidad autónoma')).toHaveValue('Mi comunidad')
  })

  it('domiciliar pide el IBAN y, si la cuenta es de otra persona, su nombre', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      respuesta({ user: { id: 1, email: 'juan@ejemplo.es' }, fichas: 1, message: 'ok' }, 201),
    )
    vi.stubGlobal('fetch', fetchFalso)
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await elegir(u, CAMINO_HERMANO)
    await rellenarDatos(u)
    await continuar(u)
    await rellenar(u, ['Fecha de bautismo'])
    await continuar(u)
    await rellenar(u, PASO_2)
    await continuar(u)

    // Sin elegir forma de pago no se sigue.
    await continuar(u)
    expect(await screen.findByText('Elige cómo vas a pagar la cuota')).toBeInTheDocument()

    await escoger(u, 'Forma de pago', /^Domiciliación bancaria$/)
    await continuar(u)
    expect(await screen.findByText('Para domiciliar la cuota hace falta el IBAN')).toBeInTheDocument()

    await rellenar(u, ['IBAN'], { IBAN: 'ES91 2100 0418 4502 0005 1332' })
    await u.click(screen.getByRole('radio', { name: 'No, es otra persona' }))
    await continuar(u)
    expect(await screen.findByText('Escribe el nombre del titular de la cuenta')).toBeInTheDocument()

    await rellenar(u, ['Nombre y apellidos del titular'], { 'Nombre y apellidos del titular': 'Ana Ruiz Gil' })
    await continuar(u)
    await rellenar(u, ['Contraseña'])
    await u.click(screen.getByLabelText('Quiero recibir el boletín de noticias por correo'))
    await u.click(screen.getByLabelText('Acepto la política de privacidad'))
    await enviar(u)

    const cuerpo = JSON.parse(fetchFalso.mock.calls[0][1].body)
    expect(cuerpo.pago).toEqual({ forma: 'DOMICILIACION', iban: 'ES9121000418450200051332', titularidad: 'OTRA_PERSONA', titularCuenta: 'Ana Ruiz Gil' })
    expect(cuerpo.usuario.boletin).toBe(true)
  }, 45_000)

  it('con foto o certificado, el alta va en multipart con cada documento en su campo', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      respuesta({ user: { id: 1, email: 'juan@ejemplo.es' }, fichas: 1, message: 'ok' }, 201),
    )
    vi.stubGlobal('fetch', fetchFalso)
    renderWithProviders(<HazteHermanoPage />)
    const u = usuario()
    await elegir(u, CAMINO_HERMANO)
    await rellenarDatos(u)
    await continuar(u)
    await rellenar(u, ['Fecha de bautismo'])
    const certificado = new File(['%PDF-1.4'], 'certificado.pdf', { type: 'application/pdf' })
    await u.upload(within(pasoActivo()).getByLabelText('Certificado de bautismo'), certificado)
    expect(within(pasoActivo()).getByText('certificado.pdf')).toBeInTheDocument()
    await continuar(u)
    await rellenar(u, PASO_2)
    await continuar(u)
    await pagarEnSecretaria(u)
    await continuar(u)

    // Una foto que no es JPG ni PNG se señala antes de enviar. `applyAccept:
    // false`: el selector del sistema ya la escondería, pero se puede arrastrar.
    const subir = userEvent.setup({ delay: null, applyAccept: false })
    await subir.upload(within(pasoActivo()).getByLabelText('Fotografía'), new File(['x'], 'foto.gif', { type: 'image/gif' }))
    expect(await screen.findByText('La foto tiene que ser JPG o PNG')).toBeInTheDocument()
    const foto = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    await u.upload(within(pasoActivo()).getByLabelText('Fotografía'), foto)
    await rellenar(u, ['Contraseña'])
    await u.click(screen.getByLabelText('Acepto la política de privacidad'))
    await enviar(u)

    const cuerpo = fetchFalso.mock.calls[0][1].body as FormData
    expect(cuerpo).toBeInstanceOf(FormData)
    expect(JSON.parse(String(cuerpo.get('datos'))).titular).toEqual(TITULAR)
    expect((cuerpo.get('foto') as File).name).toBe('foto.jpg')
    expect((cuerpo.get('certificadoBautismo') as File).name).toBe('certificado.pdf')
  }, 45_000)
})
