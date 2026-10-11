import { useEffect, useRef, useState } from 'react'
import { Box, Checkbox, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material'
import { actualizarFicha, type ApiProfile, type CambiosDeFicha, type EstadoCivil, type FormaDePago, type Sexo, type TitularidadCuenta } from '../../../lib/api/perfil'
import { PARENTESCOS, type Parentesco } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'
import {
  esCodigoPostalValido, esDniValido, esIbanValido, esTelefonoValido,
  normalizarIban, normalizarTelefono,
} from '../../../lib/validacion/identidad'
import { aniosCumplidos } from '../../altas/public/schema'
import { useAuthStore } from '../../altas/auth/store'
import Apartado, { Dato, Rejilla } from './Apartado'
import { ESTADO_CIVIL, FORMAS_DE_PAGO, FORMA_DE_PAGO, PARENTESCO, SEXO, TITULARIDAD_CUENTA, aDia, diaLegible } from './etiquetas'
import { deLaCorporacion } from '../../../domain/articulos'

/**
 * Cómo se usa el apartado dentro de la revisión del primer acceso: sin lápiz
 * (allí se cambia con «Hay algo que cambiar»), abierto ya en edición si hace
 * falta, y avisando al terminar, guarde o cancele.
 */
export interface Revision {
  sinLapiz?: boolean
  editando?: boolean
  /** El título ya lo da la pantalla: se queda solo para los lectores de pantalla. */
  tituloOculto?: boolean
  alTerminar?: () => void
}

interface PropsApartado {
  ficha: ApiProfile
  /** La ficha tal como la devuelve el servidor tras guardar. */
  onGuardada: (ficha: ApiProfile) => void
  revision?: Revision
  /**
   * Avisa de si hay una edición a medias (abierta y con algo cambiado): «Mi
   * perfil» lo usa para preguntar antes de cambiar de pestaña, de ficha o de
   * pantalla, que desmontan el apartado y tiraban lo escrito sin decir nada.
   */
  onSucio?: (sucio: boolean) => void
}

/** Lo que falla al validar: el campo, para marcarlo y llevar el foco a él, y el motivo. */
type Fallo<T> = readonly [campo: keyof T & string, mensaje: string]

const EMAIL = /^[^\s@,;<>()":\\[\]]+@[^\s@,;<>()":\\[\]]+\.[^\s@,;<>()":\\[\]]+$/
const CON_ETIQUETAS = /[<>]/

/** Texto de un campo opcional: vacío es `null`, que en el servidor lo borra. */
const opcional = (valor: string) => (valor.trim() === '' ? null : valor.trim())

/**
 * El motivo de un texto obligatorio que no vale. Van separados porque con un
 * «<» en la dirección el aviso decía «Escribe la dirección», y estaba escrita.
 */
const textoObligatorio = (valor: string, vacio: string, nombre: string) =>
  !valor.trim() ? vacio : CON_ETIQUETAS.test(valor) ? `${nombre} no puede llevar «<» ni «>».` : null

/** El primero de los opcionales que lleva «<» o «>», con su motivo. */
function conEtiquetas<T>(valores: T, campos: (keyof T & string)[]): Fallo<T> | null {
  const campo = campos.find((c) => CON_ETIQUETAS.test(String(valores[c] ?? '')))
  return campo ? [campo, 'No puede llevar «<» ni «>».'] : null
}

const iguales = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Lleva el foco al campo que falla. El de un desplegable de MUI es el
 * `combobox` de al lado: el `input` que tiene el `name` está oculto.
 */
function enfocar(formulario: HTMLFormElement | null, campo: string) {
  const elemento = formulario?.querySelector<HTMLElement>(`[name="${campo}"]`)
  const destino = elemento?.classList.contains('MuiSelect-nativeInput') ? elemento.parentElement?.querySelector<HTMLElement>('[role="combobox"]') : elemento
  destino?.focus()
}

/**
 * Lo común a los cuatro apartados: sus valores mientras se editan, validar,
 * mandar solo sus campos y volver a leer con lo que devuelve el servidor.
 */
function useApartado<T>(ficha: ApiProfile, desde: (f: ApiProfile) => T, validar: (v: T) => Fallo<T> | null, cambios: (v: T) => CambiosDeFicha, onGuardada: (f: ApiProfile) => void, revision?: Revision, onSucio?: (sucio: boolean) => void) {
  const [editando, setEditando] = useState(revision?.editando === true)
  const [valores, setValores] = useState<T>(() => desde(ficha))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errores, setErrores] = useState<Partial<Record<keyof T, string>>>({})
  const [hecho, setHecho] = useState(false)
  const formulario = useRef<HTMLFormElement>(null)

  const sinCambios = iguales(valores, desde(ficha))
  const sucio = editando && !sinCambios
  useEffect(() => {
    onSucio?.(sucio)
    // Al desmontarse (otra pestaña, otra ficha) ya no queda nada a medias.
    return () => onSucio?.(false)
  }, [sucio, onSucio])

  // Al corregir un campo, su aviso se va: seguir viéndolo en rojo confundía.
  const campo = <K extends keyof T>(clave: K) => (valor: T[K]) => {
    setValores((actuales) => ({ ...actuales, [clave]: valor }))
    setErrores((actuales) => (actuales[clave] ? { ...actuales, [clave]: undefined } : actuales))
  }
  const terminar = () => { setEditando(false); setError(null); setErrores({}); revision?.alTerminar?.() }

  return {
    editando, valores, guardando, error, hecho, campo, formulario,
    errorDe: (clave: keyof T) => errores[clave],
    editar: () => { setValores(desde(ficha)); setError(null); setErrores({}); setHecho(false); setEditando(true) },
    cancelar: terminar,
    guardar: async () => {
      const fallo = validar(valores)
      if (fallo) {
        const [clave, mensaje] = fallo
        setErrores({ [clave]: mensaje } as Partial<Record<keyof T, string>>); setError(null)
        enfocar(formulario.current, clave)
        return
      }
      // Guardar sin tocar nada no es un cambio: ni petición ni «Guardado» (en
      // la revisión del primer acceso salía «Cambiado» en el repaso).
      if (sinCambios) { terminar(); return }
      setGuardando(true); setError(null); setErrores({})
      try {
        const { data } = await actualizarFicha(ficha.id, cambios(valores))
        onGuardada(data)
        setEditando(false); setHecho(true)
        revision?.alTerminar?.()
      } catch (e: unknown) {
        // Lo que el servidor diga de un campo de este apartado, en ese campo.
        const propios = e instanceof ErrorDeApi ? Object.entries(e.fields).filter(([clave]) => clave in (valores as object)) : []
        if (propios.length > 0) {
          setErrores(Object.fromEntries(propios) as Partial<Record<keyof T, string>>)
          enfocar(formulario.current, propios[0]![0])
        }
        setError(e instanceof Error ? e.message : 'No se ha podido guardar.')
      } finally {
        setGuardando(false)
      }
    },
  }
}

/** Un TextField de la ficha: etiqueta encima, a todo el ancho de su celda. El error va debajo, en el propio campo. */
function Campo({ nombre, etiqueta, valor, onCambiar, tipo = 'text', obligatorio = false, ayuda, error, completo = false, autoComplete, placeholder, deshabilitado = false }: {
  nombre: string; etiqueta: string; valor: string; onCambiar: (valor: string) => void; tipo?: string; obligatorio?: boolean
  ayuda?: string; error?: string; completo?: boolean; autoComplete?: string; placeholder?: string; deshabilitado?: boolean
}) {
  return (
    <TextField
      name={nombre}
      label={etiqueta}
      value={valor}
      onChange={(e) => onCambiar(e.target.value)}
      type={tipo}
      required={obligatorio}
      error={!!error}
      helperText={error ?? ayuda}
      autoComplete={autoComplete}
      placeholder={placeholder}
      disabled={deshabilitado}
      fullWidth
      slotProps={tipo === 'date' ? { inputLabel: { shrink: true } } : undefined}
      sx={completo ? { gridColumn: '1 / -1' } : undefined}
    />
  )
}

function Opciones<V extends string>({ nombre, etiqueta, valor, onCambiar, opciones, vacio, obligatorio = false, error }: {
  nombre: string; etiqueta: string; valor: V | ''; onCambiar: (valor: V | '') => void; opciones: Record<V, string>; vacio?: string
  obligatorio?: boolean; error?: string
}) {
  return (
    <TextField select name={nombre} label={etiqueta} value={valor} onChange={(e) => onCambiar(e.target.value as V | '')} required={obligatorio} error={!!error} helperText={error} fullWidth>
      {vacio !== undefined && <MenuItem value=""><em>{vacio}</em></MenuItem>}
      {(Object.entries(opciones) as [V, string][]).map(([clave, texto]) => <MenuItem key={clave} value={clave}>{texto}</MenuItem>)}
    </TextField>
  )
}

// --------------------------------------------------------------- Datos personales

export function DatosPersonales({ ficha, onGuardada, revision, onSucio }: PropsApartado) {
  const aCargo = !ficha.esTitular
  const fechaFija = aCargo && ficha.activo
  const edad = ficha.fechaNacimiento ? aniosCumplidos(aDia(ficha.fechaNacimiento)) : null
  // A un menor no se le pregunta por su estado civil ni por su profesión.
  const menor = edad !== null && edad < 18
  const dniGuardado = (ficha.dni ?? '').trim()
  const a = useApartado(
    ficha,
    (f) => ({
      nombre: f.nombre, primerApellido: f.primerApellido ?? f.apellidos, segundoApellido: f.segundoApellido ?? '',
      dni: f.dni ?? '', fechaNacimiento: aDia(f.fechaNacimiento), sexo: (f.sexo ?? '') as Sexo | '',
      estadoCivil: (f.estadoCivil ?? '') as EstadoCivil | '', profesion: f.profesion ?? '', lugarNacimiento: f.lugarNacimiento ?? '',
      parentesco: (f.parentesco ?? '') as Parentesco | '',
    }),
    (v) => {
      const nombre = textoObligatorio(v.nombre, 'Escribe el nombre.', 'El nombre')
      if (nombre) return ['nombre', nombre]
      const apellido = textoObligatorio(v.primerApellido, 'Escribe el primer apellido.', 'El apellido')
      if (apellido) return ['primerApellido', apellido]
      // El titular entró con su DNI y no puede quedarse sin él; un menor pequeño no tiene.
      if (!aCargo && !v.dni.trim()) return ['dni', 'Tu ficha necesita el DNI.']
      // Solo si lo ha cambiado: uno del censo con la letra mal no debe impedir
      // guardar lo demás (se le marca en rojo para que lo corrija cuando pueda).
      if (v.dni.trim() !== dniGuardado && v.dni.trim() && !esDniValido(v.dni)) return ['dni', 'La letra no corresponde con el número.']
      if (!v.fechaNacimiento) return ['fechaNacimiento', 'Falta la fecha de nacimiento.']
      return conEtiquetas(v, ['segundoApellido', 'lugarNacimiento', ...(menor ? [] : ['profesion' as const])])
    },
    (v) => ({
      nombre: v.nombre.trim(), primerApellido: v.primerApellido.trim(), segundoApellido: opcional(v.segundoApellido),
      fechaNacimiento: v.fechaNacimiento,
      // El DNI solo viaja si cambia: así uno guardado con la letra mal no se reenvía y no tumba el guardado.
      ...(v.dni.trim() && v.dni.trim() !== dniGuardado ? { dni: v.dni.trim() } : {}),
      sexo: v.sexo || null, lugarNacimiento: opcional(v.lugarNacimiento),
      ...(menor ? {} : { estadoCivil: v.estadoCivil || null, profesion: opcional(v.profesion) }),
      ...(aCargo && v.parentesco ? { parentesco: v.parentesco } : {}),
    }),
    onGuardada,
    revision,
    onSucio,
  )
  const v = a.valores
  const dniGuardadoMal = dniGuardado !== '' && v.dni.trim() === dniGuardado && !esDniValido(dniGuardado)

  return (
    <Apartado
      titulo="Datos personales"
      editando={a.editando} onEditar={revision?.sinLapiz ? undefined : a.editar} onCancelar={a.cancelar} onGuardar={() => void a.guardar()}
      tituloOculto={revision?.tituloOculto} refFormulario={a.formulario}
      guardando={a.guardando} error={a.error} hecho={a.hecho}
      vista={
        <Rejilla lista>
          <Dato etiqueta="Nombre" valor={ficha.nombre} />
          <Dato etiqueta="Primer apellido" valor={ficha.primerApellido ?? ficha.apellidos} />
          <Dato etiqueta="Segundo apellido" valor={ficha.segundoApellido} />
          <Dato etiqueta="DNI" valor={ficha.dni} />
          <Dato etiqueta="Fecha de nacimiento" valor={ficha.fechaNacimiento ? `${diaLegible(ficha.fechaNacimiento)}${edad !== null ? ` · ${edad} años` : ''}` : null} />
          <Dato etiqueta="Natural de" valor={ficha.lugarNacimiento} />
          <Dato etiqueta="Sexo" valor={ficha.sexo ? SEXO[ficha.sexo] : null} />
          {!menor && <Dato etiqueta="Estado civil" valor={ficha.estadoCivil ? ESTADO_CIVIL[ficha.estadoCivil] : null} />}
          {!menor && <Dato etiqueta="Profesión" valor={ficha.profesion} />}
          {aCargo && <Dato etiqueta="Qué es para ti" valor={ficha.parentesco ? PARENTESCO[ficha.parentesco] : null} />}
        </Rejilla>
      }
      formulario={
        <Rejilla>
          <Campo nombre="nombre" etiqueta="Nombre" valor={v.nombre} onCambiar={a.campo('nombre')} error={a.errorDe('nombre')} obligatorio completo autoComplete={aCargo ? 'off' : 'given-name'} />
          <Campo nombre="primerApellido" etiqueta="Primer apellido" valor={v.primerApellido} onCambiar={a.campo('primerApellido')} error={a.errorDe('primerApellido')} obligatorio />
          <Campo nombre="segundoApellido" etiqueta="Segundo apellido" valor={v.segundoApellido} onCambiar={a.campo('segundoApellido')} error={a.errorDe('segundoApellido')} />
          <Campo
            nombre="dni" etiqueta="DNI o NIE" valor={v.dni} onCambiar={a.campo('dni')} obligatorio={!aCargo}
            error={a.errorDe('dni') ?? (dniGuardadoMal ? 'La letra no corresponde con el número: corrígelo cuando puedas.' : undefined)}
            ayuda={aCargo ? 'Si ya lo tiene' : undefined}
          />
          {/* La de una ficha a cargo ya aprobada la corrige Secretaría: cambiándola, un menor pasaba por adulto. */}
          <Campo nombre="fechaNacimiento" etiqueta="Fecha de nacimiento" valor={v.fechaNacimiento} onCambiar={a.campo('fechaNacimiento')} tipo="date" obligatorio
            deshabilitado={fechaFija} error={a.errorDe('fechaNacimiento')} ayuda={fechaFija ? 'Para corregirla, habla con Secretaría' : undefined} />
          <Opciones nombre="sexo" etiqueta="Sexo" valor={v.sexo} onCambiar={a.campo('sexo')} opciones={SEXO} vacio="Sin indicar" />
          {!menor && <Opciones nombre="estadoCivil" etiqueta="Estado civil" valor={v.estadoCivil} onCambiar={a.campo('estadoCivil')} opciones={ESTADO_CIVIL} vacio="Sin indicar" />}
          {!menor && <Campo nombre="profesion" etiqueta="Profesión" valor={v.profesion} onCambiar={a.campo('profesion')} error={a.errorDe('profesion')} />}
          <Campo nombre="lugarNacimiento" etiqueta="Natural de" valor={v.lugarNacimiento} onCambiar={a.campo('lugarNacimiento')} error={a.errorDe('lugarNacimiento')} ayuda="Dónde nació" />
          {aCargo && (
            <TextField select name="parentesco" label="Qué es para ti" value={v.parentesco} onChange={(e) => a.campo('parentesco')(e.target.value as Parentesco)} fullWidth sx={{ gridColumn: '1 / -1' }}>
              {PARENTESCOS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </TextField>
          )}
        </Rejilla>
      }
    />
  )
}

// --------------------------------------------------------------- Contacto y domicilio

export function Contacto({ ficha, onGuardada, revision, onSucio }: PropsApartado) {
  // El de la cuenta (con el que entra y al que llegan los avisos) no es el de
  // la ficha: cambiando este, el titular creía haber cambiado aquel.
  const correoDeLaCuenta = useAuthStore((s) => s.hermano?.email) ?? null
  const deLaCuenta = ficha.esTitular && correoDeLaCuenta
  const a = useApartado(
    ficha,
    (f) => ({
      email: f.email ?? '', email2: f.email2 ?? '', telefono: f.telefono ?? '', telefonoFijo: f.telefonoFijo ?? '',
      direccion: f.direccion ?? '', codigoPostal: f.codigoPostal ?? '', poblacion: f.poblacion ?? '',
      provincia: f.provincia ?? '', comunidadAutonoma: f.comunidadAutonoma ?? '', pais: f.pais ?? '', boletin: f.boletin,
      autorizaImagen: f.autorizaImagen,
    }),
    (v) => {
      if (!EMAIL.test(v.email.trim())) return ['email', v.email.trim() ? 'Revisa el correo: falta algo o sobra un espacio.' : 'Escribe un correo de contacto.']
      if (v.email2.trim() && !EMAIL.test(v.email2.trim())) return ['email2', 'Revisa el segundo correo.']
      if (!esTelefonoValido(v.telefono)) return ['telefono', 'Tiene que tener 9 cifras.']
      if (v.telefonoFijo.trim() && !esTelefonoValido(v.telefonoFijo)) return ['telefonoFijo', 'Tiene que tener 9 cifras.']
      const direccion = textoObligatorio(v.direccion, 'Escribe la dirección.', 'La dirección')
      if (direccion) return ['direccion', direccion]
      if (!esCodigoPostalValido(v.codigoPostal)) return ['codigoPostal', 'Tiene que tener 5 cifras.']
      const poblacion = textoObligatorio(v.poblacion, 'Escribe la localidad.', 'La localidad')
      if (poblacion) return ['poblacion', poblacion]
      return conEtiquetas(v, ['provincia', 'comunidadAutonoma', 'pais'])
    },
    (v) => ({
      email: v.email.trim(), email2: opcional(v.email2),
      telefono: normalizarTelefono(v.telefono), telefonoFijo: v.telefonoFijo.trim() ? normalizarTelefono(v.telefonoFijo) : null,
      direccion: v.direccion.trim(), codigoPostal: v.codigoPostal.trim(), poblacion: v.poblacion.trim(),
      provincia: opcional(v.provincia), comunidadAutonoma: opcional(v.comunidadAutonoma), pais: opcional(v.pais),
      boletin: v.boletin,
      autorizaImagen: v.autorizaImagen,
    }),
    onGuardada,
    revision,
    onSucio,
  )
  const v = a.valores
  const localidad = [ficha.codigoPostal, ficha.poblacion].filter(Boolean).join(' ')
  const notaDeLaCuenta = <Box component="span" sx={{ display: 'block', mt: 0.25, fontSize: 13, fontWeight: 400, color: 'text.secondary' }}>Para cambiarlo, habla con Secretaría.</Box>

  return (
    <Apartado
      titulo="Contacto y domicilio"
      editando={a.editando} onEditar={revision?.sinLapiz ? undefined : a.editar} onCancelar={a.cancelar} onGuardar={() => void a.guardar()}
      tituloOculto={revision?.tituloOculto} refFormulario={a.formulario}
      guardando={a.guardando} error={a.error} hecho={a.hecho}
      vista={
        <Rejilla lista>
          {deLaCuenta && <Dato etiqueta="Correo con el que entras" valor={<>{correoDeLaCuenta}{notaDeLaCuenta}</>} completo />}
          <Dato etiqueta="Correo de contacto" valor={ficha.email} />
          <Dato etiqueta="Segundo correo" valor={ficha.email2} />
          <Dato etiqueta="Teléfono móvil" valor={ficha.telefono} />
          <Dato etiqueta="Teléfono fijo" valor={ficha.telefonoFijo} />
          <Dato etiqueta="Dirección" valor={ficha.direccion} completo />
          <Dato etiqueta="Localidad" valor={localidad} />
          <Dato etiqueta="Provincia" valor={ficha.provincia} />
          <Dato etiqueta="Comunidad autónoma" valor={ficha.comunidadAutonoma} />
          <Dato etiqueta="País" valor={ficha.pais} />
          <Dato etiqueta="Boletín de noticias" valor={ficha.boletin ? 'Sí, por correo' : 'No'} />
          <Dato etiqueta={ficha.esTitular ? 'Publicar mis fotos' : 'Publicar sus fotos'} valor={ficha.autorizaImagen ? 'Sí, autorizado' : 'No'} />
        </Rejilla>
      }
      formulario={
        <>
          {deLaCuenta && (
            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
              Correo con el que entras: <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600, overflowWrap: 'anywhere' }}>{correoDeLaCuenta}</Box>. Para cambiarlo, habla con Secretaría.
            </Typography>
          )}
          <Rejilla>
            <Campo nombre="email" etiqueta="Correo de contacto" valor={v.email} onCambiar={a.campo('email')} error={a.errorDe('email')} tipo="email" obligatorio autoComplete="email"
              ayuda={deLaCuenta ? 'El de la ficha; no cambia el de entrar' : undefined} />
            <Campo nombre="email2" etiqueta="Segundo correo" valor={v.email2} onCambiar={a.campo('email2')} error={a.errorDe('email2')} tipo="email" ayuda="Opcional" />
            <Campo nombre="telefono" etiqueta="Teléfono móvil" valor={v.telefono} onCambiar={a.campo('telefono')} error={a.errorDe('telefono')} tipo="tel" obligatorio autoComplete="tel" />
            <Campo nombre="telefonoFijo" etiqueta="Teléfono fijo" valor={v.telefonoFijo} onCambiar={a.campo('telefonoFijo')} error={a.errorDe('telefonoFijo')} tipo="tel" ayuda="Opcional" />
            <Campo nombre="direccion" etiqueta="Dirección" valor={v.direccion} onCambiar={a.campo('direccion')} error={a.errorDe('direccion')} obligatorio completo autoComplete="street-address" />
            <Campo nombre="codigoPostal" etiqueta="Código postal" valor={v.codigoPostal} onCambiar={a.campo('codigoPostal')} error={a.errorDe('codigoPostal')} obligatorio autoComplete="postal-code" />
            <Campo nombre="poblacion" etiqueta="Localidad" valor={v.poblacion} onCambiar={a.campo('poblacion')} error={a.errorDe('poblacion')} obligatorio autoComplete="address-level2" />
            <Campo nombre="provincia" etiqueta="Provincia" valor={v.provincia} onCambiar={a.campo('provincia')} error={a.errorDe('provincia')} autoComplete="address-level1" />
            <Campo nombre="comunidadAutonoma" etiqueta="Comunidad autónoma" valor={v.comunidadAutonoma} onCambiar={a.campo('comunidadAutonoma')} error={a.errorDe('comunidadAutonoma')} />
            <Campo nombre="pais" etiqueta="País" valor={v.pais} onCambiar={a.campo('pais')} error={a.errorDe('pais')} autoComplete="country-name" placeholder="España" completo />
            <FormControlLabel
              control={<Checkbox checked={v.boletin} onChange={(e) => a.campo('boletin')(e.target.checked)} />}
              label="Quiero recibir el boletín de noticias por correo"
              sx={{ gridColumn: '1 / -1' }}
            />
            <FormControlLabel
              control={<Checkbox checked={v.autorizaImagen} onChange={(e) => a.campo('autorizaImagen')(e.target.checked)} />}
              label={`Autorizo que se publiquen en la web y en las redes ${deLaCorporacion()} las fotos de cultos y salidas en que aparezca`}
              sx={{ gridColumn: '1 / -1' }}
            />
          </Rejilla>
        </>
      }
    />
  )
}

// --------------------------------------------------------------- Vida de hermano

export function VidaDeHermano({ ficha, onGuardada, revision, onSucio }: PropsApartado) {
  const a = useApartado(
    ficha,
    (f) => ({ fechaBautismo: aDia(f.fechaBautismo), lugarBautismo: f.lugarBautismo ?? '', parroquiaBautismo: f.parroquiaBautismo ?? '' }),
    (v) => conEtiquetas(v, ['lugarBautismo', 'parroquiaBautismo']),
    (v) => ({ fechaBautismo: v.fechaBautismo || null, lugarBautismo: opcional(v.lugarBautismo), parroquiaBautismo: opcional(v.parroquiaBautismo) }),
    onGuardada,
    revision,
    onSucio,
  )
  const v = a.valores
  const presentado = [ficha.presentadoPor, ficha.presentadoPor2].filter(Boolean).join(' y ')
  const tunica = ficha.tieneTunicaPropia ? `Propia${ficha.tunica ? ` · talla ${ficha.tunica}` : ''}` : ficha.tunica ? `Talla ${ficha.tunica}` : null

  return (
    <Apartado
      titulo="Vida de hermano"
      editando={a.editando} onEditar={revision?.sinLapiz ? undefined : a.editar} onCancelar={a.cancelar} onGuardar={() => void a.guardar()}
      tituloOculto={revision?.tituloOculto} refFormulario={a.formulario}
      guardando={a.guardando} error={a.error} hecho={a.hecho}
      candado="Número, alta, jura, padrinos y procesión los lleva Secretaría"
      vista={
        <Rejilla lista>
          <Dato etiqueta="Número de hermano" valor={ficha.numeroHermano ?? (ficha.activo ? 'Pendiente de asignar' : null)} />
          <Dato etiqueta="Hermano desde" valor={ficha.activo ? diaLegible(ficha.fechaAlta) : null} />
          <Dato etiqueta="Fecha de jura" valor={diaLegible(ficha.fechaJura)} />
          <Dato etiqueta="Presentado por" valor={presentado} />
          <Dato etiqueta="Fecha de bautismo" valor={diaLegible(ficha.fechaBautismo)} />
          <Dato etiqueta="Bautizado/a en" valor={ficha.lugarBautismo} />
          <Dato etiqueta="Parroquia de bautismo" valor={ficha.parroquiaBautismo} />
          <Dato etiqueta="Túnica" valor={tunica} />
          <Dato etiqueta="Puesto habitual" valor={ficha.puesto} />
          {ficha.alturaHombro ? <Dato etiqueta="Altura al hombro" valor={`${ficha.alturaHombro} cm`} /> : null}
        </Rejilla>
      }
      formulario={
        <>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            Son datos opcionales. Solo los ves tú y la Secretaría {deLaCorporacion()}.
          </Typography>
          <Rejilla>
            <Campo nombre="fechaBautismo" etiqueta="Fecha de bautismo" valor={v.fechaBautismo} onCambiar={a.campo('fechaBautismo')} tipo="date" />
            <Campo nombre="lugarBautismo" etiqueta="Bautizado/a en" valor={v.lugarBautismo} onCambiar={a.campo('lugarBautismo')} error={a.errorDe('lugarBautismo')} ayuda="La localidad" />
            <Campo nombre="parroquiaBautismo" etiqueta="Parroquia de bautismo" valor={v.parroquiaBautismo} onCambiar={a.campo('parroquiaBautismo')} error={a.errorDe('parroquiaBautismo')} completo />
          </Rejilla>
        </>
      }
    />
  )
}

// --------------------------------------------------------------- Cuota y pago

export function CuotaYPago({ ficha, onGuardada, revision, onSucio }: PropsApartado) {
  const a = useApartado(
    ficha,
    (f) => ({ formaPagoPref: f.formaPagoPref, iban: '', titularidadCuenta: (f.titularidadCuenta ?? '') as TitularidadCuenta | '', titularCuenta: f.titularCuenta ?? '', quitarCuenta: false }),
    (v) => {
      // Sin domiciliar, los datos de la cuenta no se piden ni se miran.
      if (v.formaPagoPref !== 'DOMICILIACION') return null
      if (v.iban.trim() && !esIbanValido(v.iban)) return ['iban', 'Revisa el IBAN: los dígitos de control no cuadran.']
      if (!v.iban.trim() && !ficha.ibanEnmascarado) return ['iban', 'Para domiciliar los recibos hace falta el IBAN de la cuenta.']
      // En el primer acceso se pide como en el alta (el banco necesita saber si
      // la cuenta es suya o de otro); «Mi perfil» sigue dejándolo sin indicar.
      if (revision && !v.titularidadCuenta) return ['titularidadCuenta', 'Di de quién es la cuenta.']
      if (CON_ETIQUETAS.test(v.titularCuenta)) return ['titularCuenta', 'No puede llevar «<» ni «>».']
      if (v.titularidadCuenta && v.titularidadCuenta !== 'PROPIA' && !v.titularCuenta.trim()) return ['titularCuenta', 'Escribe el nombre del titular de la cuenta.']
      return null
    },
    // El IBAN solo va si se ha escrito uno nuevo: en blanco se queda el que había.
    // Si la cuenta es del propio hermano, el nombre del titular sobra. Sin
    // domiciliar, la cuenta se queda como estaba salvo que pida quitarla.
    (v) => (v.formaPagoPref === 'DOMICILIACION'
      ? {
        formaPagoPref: v.formaPagoPref, ...(v.iban.trim() ? { iban: normalizarIban(v.iban) } : {}),
        titularidadCuenta: v.titularidadCuenta || null,
        titularCuenta: v.titularidadCuenta === 'PROPIA' ? null : opcional(v.titularCuenta),
      }
      : { formaPagoPref: v.formaPagoPref, ...(v.quitarCuenta ? { iban: null, titularidadCuenta: null, titularCuenta: null } : {}) }),
    onGuardada,
    revision,
    onSucio,
  )
  const v = a.valores
  const domicilia = v.formaPagoPref === 'DOMICILIACION'
  // Pagando en efectivo, «Titular de la cuenta —» e «IBAN —» solo hacían ruido.
  const conCuenta = ficha.formaPagoPref === 'DOMICILIACION' || !!ficha.ibanEnmascarado
  const titular = [ficha.titularidadCuenta ? TITULARIDAD_CUENTA[ficha.titularidadCuenta] : null, ficha.titularCuenta].filter(Boolean).join(': ') || null

  return (
    <Apartado
      titulo="Cuota y pago"
      editando={a.editando} onEditar={revision?.sinLapiz ? undefined : a.editar} onCancelar={a.cancelar} onGuardar={() => void a.guardar()}
      tituloOculto={revision?.tituloOculto} refFormulario={a.formulario}
      guardando={a.guardando} error={a.error} hecho={a.hecho}
      vista={
        <Rejilla lista>
          <Dato etiqueta="Forma de pago" valor={FORMA_DE_PAGO[ficha.formaPagoPref]} />
          {conCuenta && <Dato etiqueta="Titular de la cuenta" valor={titular} />}
          {conCuenta && <Dato etiqueta="IBAN" valor={ficha.ibanEnmascarado} completo />}
        </Rejilla>
      }
      formulario={
        <Rejilla>
          <TextField select name="formaPagoPref" label="Forma de pago" value={v.formaPagoPref} onChange={(e) => a.campo('formaPagoPref')(e.target.value as FormaDePago)} fullWidth sx={{ gridColumn: '1 / -1' }}>
            {FORMAS_DE_PAGO.map((forma) => <MenuItem key={forma} value={forma}>{FORMA_DE_PAGO[forma]}</MenuItem>)}
          </TextField>
          {domicilia ? (
            <>
              <Campo
                nombre="iban"
                etiqueta={ficha.ibanEnmascarado ? 'IBAN nuevo' : 'IBAN'}
                valor={v.iban}
                onCambiar={a.campo('iban')}
                error={a.errorDe('iban')}
                completo
                autoComplete="off"
                placeholder="ES00 0000 0000 0000 0000 0000"
                ayuda={ficha.ibanEnmascarado ? `Ahora: ${ficha.ibanEnmascarado}. Déjalo en blanco para no cambiarlo.` : undefined}
              />
              <Opciones nombre="titularidadCuenta" etiqueta="¿De quién es la cuenta?" valor={v.titularidadCuenta} onCambiar={a.campo('titularidadCuenta')} opciones={TITULARIDAD_CUENTA}
                vacio={revision ? undefined : 'Sin indicar'} obligatorio={!!revision} error={a.errorDe('titularidadCuenta')} />
              {v.titularidadCuenta !== 'PROPIA' && (
                <Campo nombre="titularCuenta" etiqueta="Nombre del titular" valor={v.titularCuenta} onCambiar={a.campo('titularCuenta')} error={a.errorDe('titularCuenta')} ayuda="Si no es el propio hermano" />
              )}
            </>
          ) : ficha.ibanEnmascarado ? (
            // Sin domiciliar, la cuenta ya no sirve para cobrar la cuota: puede quitarla.
            <FormControlLabel
              control={<Checkbox checked={v.quitarCuenta} onChange={(e) => a.campo('quitarCuenta')(e.target.checked)} />}
              label={`Quitar la cuenta ${ficha.ibanEnmascarado}`}
              sx={{ gridColumn: '1 / -1' }}
            />
          ) : null}
        </Rejilla>
      }
    />
  )
}
