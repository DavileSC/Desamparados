import { useState } from 'react'
import { Checkbox, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material'
import { actualizarFicha, type ApiProfile, type CambiosDeFicha, type EstadoCivil, type FormaDePago, type Sexo, type TitularidadCuenta } from '../../../lib/api/perfil'
import { PARENTESCOS, type Parentesco } from '../../../lib/api/auth'
import {
  esCodigoPostalValido, esDniValido, esIbanValido, esTelefonoValido, esTextoValido,
  normalizarIban, normalizarTelefono,
} from '../../../lib/validacion/identidad'
import { aniosCumplidos } from '../../altas/public/schema'
import Apartado, { Dato, Rejilla } from './Apartado'
import { ESTADO_CIVIL, FORMAS_DE_PAGO, FORMA_DE_PAGO, PARENTESCO, SEXO, TITULARIDAD_CUENTA, aDia, diaLegible } from './etiquetas'

interface PropsApartado {
  ficha: ApiProfile
  /** La ficha tal como la devuelve el servidor tras guardar. */
  onGuardada: (ficha: ApiProfile) => void
}

const EMAIL = /^[^\s@,;<>()":\\[\]]+@[^\s@,;<>()":\\[\]]+\.[^\s@,;<>()":\\[\]]+$/

/** Texto de un campo opcional: vacío es `null`, que en el servidor lo borra. */
const opcional = (valor: string) => (valor.trim() === '' ? null : valor.trim())

/**
 * Lo común a los cuatro apartados: sus valores mientras se editan, validar,
 * mandar solo sus campos y volver a leer con lo que devuelve el servidor.
 */
function useApartado<T>(ficha: ApiProfile, desde: (f: ApiProfile) => T, validar: (v: T) => string | null, cambios: (v: T) => CambiosDeFicha, onGuardada: (f: ApiProfile) => void) {
  const [editando, setEditando] = useState(false)
  const [valores, setValores] = useState<T>(() => desde(ficha))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)

  const campo = <K extends keyof T>(clave: K) => (valor: T[K]) => setValores((actuales) => ({ ...actuales, [clave]: valor }))

  return {
    editando, valores, guardando, error, hecho, campo,
    editar: () => { setValores(desde(ficha)); setError(null); setHecho(false); setEditando(true) },
    cancelar: () => { setEditando(false); setError(null) },
    guardar: async () => {
      const problema = validar(valores)
      if (problema) { setError(problema); return }
      setGuardando(true); setError(null)
      try {
        const { data } = await actualizarFicha(ficha.id, cambios(valores))
        onGuardada(data)
        setEditando(false); setHecho(true)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'No se ha podido guardar.')
      } finally {
        setGuardando(false)
      }
    },
  }
}

/** Un TextField de la ficha: etiqueta encima, a todo el ancho de su celda. */
function Campo({ etiqueta, valor, onCambiar, tipo = 'text', obligatorio = false, ayuda, completo = false, autoComplete, placeholder }: {
  etiqueta: string; valor: string; onCambiar: (valor: string) => void; tipo?: string; obligatorio?: boolean
  ayuda?: string; completo?: boolean; autoComplete?: string; placeholder?: string
}) {
  return (
    <TextField
      label={etiqueta}
      value={valor}
      onChange={(e) => onCambiar(e.target.value)}
      type={tipo}
      required={obligatorio}
      helperText={ayuda}
      autoComplete={autoComplete}
      placeholder={placeholder}
      fullWidth
      slotProps={tipo === 'date' ? { inputLabel: { shrink: true } } : undefined}
      sx={completo ? { gridColumn: '1 / -1' } : undefined}
    />
  )
}

function Opciones<V extends string>({ etiqueta, valor, onCambiar, opciones, vacio }: {
  etiqueta: string; valor: V | ''; onCambiar: (valor: V | '') => void; opciones: Record<V, string>; vacio?: string
}) {
  return (
    <TextField select label={etiqueta} value={valor} onChange={(e) => onCambiar(e.target.value as V | '')} fullWidth>
      {vacio !== undefined && <MenuItem value=""><em>{vacio}</em></MenuItem>}
      {(Object.entries(opciones) as [V, string][]).map(([clave, texto]) => <MenuItem key={clave} value={clave}>{texto}</MenuItem>)}
    </TextField>
  )
}

// --------------------------------------------------------------- Datos personales

export function DatosPersonales({ ficha, onGuardada }: PropsApartado) {
  const aCargo = !ficha.esTitular
  const a = useApartado(
    ficha,
    (f) => ({
      nombre: f.nombre, primerApellido: f.primerApellido ?? f.apellidos, segundoApellido: f.segundoApellido ?? '',
      dni: f.dni ?? '', fechaNacimiento: aDia(f.fechaNacimiento), sexo: (f.sexo ?? '') as Sexo | '',
      estadoCivil: (f.estadoCivil ?? '') as EstadoCivil | '', profesion: f.profesion ?? '', lugarNacimiento: f.lugarNacimiento ?? '',
      parentesco: (f.parentesco ?? '') as Parentesco | '',
    }),
    (v) => {
      if (!esTextoValido(v.nombre)) return 'Escribe el nombre.'
      if (!esTextoValido(v.primerApellido)) return 'Escribe el primer apellido.'
      if (!v.fechaNacimiento) return 'Falta la fecha de nacimiento.'
      // El titular entró con su DNI y no puede quedarse sin él; un menor pequeño no tiene.
      if (!aCargo && !v.dni.trim()) return 'Tu ficha necesita el DNI.'
      if (v.dni.trim() && !esDniValido(v.dni)) return 'Revisa el DNI o NIE: la letra no corresponde con el número.'
      if ([v.segundoApellido, v.profesion, v.lugarNacimiento].some((t) => /[<>]/.test(t))) return 'Los textos no pueden llevar «<» ni «>».'
      return null
    },
    (v) => ({
      nombre: v.nombre.trim(), primerApellido: v.primerApellido.trim(), segundoApellido: opcional(v.segundoApellido),
      fechaNacimiento: v.fechaNacimiento, ...(v.dni.trim() ? { dni: v.dni } : {}),
      sexo: v.sexo || null, estadoCivil: v.estadoCivil || null,
      profesion: opcional(v.profesion), lugarNacimiento: opcional(v.lugarNacimiento),
      ...(aCargo && v.parentesco ? { parentesco: v.parentesco } : {}),
    }),
    onGuardada,
  )
  const v = a.valores
  const edad = ficha.fechaNacimiento ? aniosCumplidos(aDia(ficha.fechaNacimiento)) : null

  return (
    <Apartado
      titulo="Datos personales"
      editando={a.editando} onEditar={a.editar} onCancelar={a.cancelar} onGuardar={() => void a.guardar()}
      guardando={a.guardando} error={a.error} hecho={a.hecho}
      vista={
        <Rejilla lista>
          <Dato etiqueta="Nombre" valor={ficha.nombre} />
          <Dato etiqueta="DNI" valor={ficha.dni} />
          <Dato etiqueta="Primer apellido" valor={ficha.primerApellido ?? ficha.apellidos} />
          <Dato etiqueta="Segundo apellido" valor={ficha.segundoApellido} />
          <Dato etiqueta="Fecha de nacimiento" valor={ficha.fechaNacimiento ? `${diaLegible(ficha.fechaNacimiento)}${edad !== null ? ` · ${edad} años` : ''}` : null} />
          <Dato etiqueta="Natural de" valor={ficha.lugarNacimiento} />
          <Dato etiqueta="Sexo" valor={ficha.sexo ? SEXO[ficha.sexo] : null} />
          <Dato etiqueta="Estado civil" valor={ficha.estadoCivil ? ESTADO_CIVIL[ficha.estadoCivil] : null} />
          <Dato etiqueta="Profesión" valor={ficha.profesion} />
          {aCargo && <Dato etiqueta="Qué es para ti" valor={ficha.parentesco ? PARENTESCO[ficha.parentesco] : null} />}
        </Rejilla>
      }
      formulario={
        <Rejilla>
          <Campo etiqueta="Nombre" valor={v.nombre} onCambiar={a.campo('nombre')} obligatorio completo autoComplete={aCargo ? 'off' : 'given-name'} />
          <Campo etiqueta="Primer apellido" valor={v.primerApellido} onCambiar={a.campo('primerApellido')} obligatorio />
          <Campo etiqueta="Segundo apellido" valor={v.segundoApellido} onCambiar={a.campo('segundoApellido')} />
          <Campo etiqueta="DNI o NIE" valor={v.dni} onCambiar={a.campo('dni')} obligatorio={!aCargo} ayuda={aCargo ? 'Si ya lo tiene' : undefined} />
          <Campo etiqueta="Fecha de nacimiento" valor={v.fechaNacimiento} onCambiar={a.campo('fechaNacimiento')} tipo="date" obligatorio />
          <Opciones etiqueta="Sexo" valor={v.sexo} onCambiar={a.campo('sexo')} opciones={SEXO} vacio="Sin indicar" />
          <Opciones etiqueta="Estado civil" valor={v.estadoCivil} onCambiar={a.campo('estadoCivil')} opciones={ESTADO_CIVIL} vacio="Sin indicar" />
          <Campo etiqueta="Profesión" valor={v.profesion} onCambiar={a.campo('profesion')} />
          <Campo etiqueta="Natural de" valor={v.lugarNacimiento} onCambiar={a.campo('lugarNacimiento')} ayuda="Dónde nació" />
          {aCargo && (
            <TextField select label="Qué es para ti" value={v.parentesco} onChange={(e) => a.campo('parentesco')(e.target.value as Parentesco)} fullWidth sx={{ gridColumn: '1 / -1' }}>
              {PARENTESCOS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </TextField>
          )}
        </Rejilla>
      }
    />
  )
}

// --------------------------------------------------------------- Contacto y domicilio

export function Contacto({ ficha, onGuardada }: PropsApartado) {
  const a = useApartado(
    ficha,
    (f) => ({
      email: f.email ?? '', email2: f.email2 ?? '', telefono: f.telefono ?? '', telefonoFijo: f.telefonoFijo ?? '',
      direccion: f.direccion ?? '', codigoPostal: f.codigoPostal ?? '', poblacion: f.poblacion ?? '',
      provincia: f.provincia ?? '', comunidadAutonoma: f.comunidadAutonoma ?? '', pais: f.pais ?? '', boletin: f.boletin,
    }),
    (v) => {
      if (!EMAIL.test(v.email.trim())) return 'Revisa el correo electrónico.'
      if (v.email2.trim() && !EMAIL.test(v.email2.trim())) return 'Revisa el segundo correo.'
      if (!esTelefonoValido(v.telefono)) return 'El teléfono móvil tiene que tener 9 cifras.'
      if (v.telefonoFijo.trim() && !esTelefonoValido(v.telefonoFijo)) return 'El teléfono fijo tiene que tener 9 cifras.'
      if (!esTextoValido(v.direccion)) return 'Escribe la dirección.'
      if (!esCodigoPostalValido(v.codigoPostal)) return 'El código postal tiene que tener 5 cifras.'
      if (!esTextoValido(v.poblacion)) return 'Escribe la localidad.'
      if ([v.provincia, v.comunidadAutonoma, v.pais].some((t) => /[<>]/.test(t))) return 'Los textos no pueden llevar «<» ni «>».'
      return null
    },
    (v) => ({
      email: v.email.trim(), email2: opcional(v.email2),
      telefono: normalizarTelefono(v.telefono), telefonoFijo: v.telefonoFijo.trim() ? normalizarTelefono(v.telefonoFijo) : null,
      direccion: v.direccion.trim(), codigoPostal: v.codigoPostal.trim(), poblacion: v.poblacion.trim(),
      provincia: opcional(v.provincia), comunidadAutonoma: opcional(v.comunidadAutonoma), pais: opcional(v.pais),
      boletin: v.boletin,
    }),
    onGuardada,
  )
  const v = a.valores
  const localidad = [ficha.codigoPostal, ficha.poblacion].filter(Boolean).join(' ')

  return (
    <Apartado
      titulo="Contacto y domicilio"
      editando={a.editando} onEditar={a.editar} onCancelar={a.cancelar} onGuardar={() => void a.guardar()}
      guardando={a.guardando} error={a.error} hecho={a.hecho}
      vista={
        <Rejilla lista>
          <Dato etiqueta="Correo electrónico" valor={ficha.email} />
          <Dato etiqueta="Segundo correo" valor={ficha.email2} />
          <Dato etiqueta="Teléfono móvil" valor={ficha.telefono} />
          <Dato etiqueta="Teléfono fijo" valor={ficha.telefonoFijo} />
          <Dato etiqueta="Dirección" valor={ficha.direccion} completo />
          <Dato etiqueta="Localidad" valor={localidad} />
          <Dato etiqueta="Provincia" valor={ficha.provincia} />
          <Dato etiqueta="Comunidad autónoma" valor={ficha.comunidadAutonoma} />
          <Dato etiqueta="País" valor={ficha.pais} />
          <Dato etiqueta="Boletín de noticias" valor={ficha.boletin ? 'Sí, por correo' : 'No'} />
        </Rejilla>
      }
      formulario={
        <Rejilla>
          <Campo etiqueta="Correo electrónico" valor={v.email} onCambiar={a.campo('email')} tipo="email" obligatorio autoComplete="email" />
          <Campo etiqueta="Segundo correo" valor={v.email2} onCambiar={a.campo('email2')} tipo="email" ayuda="Opcional" />
          <Campo etiqueta="Teléfono móvil" valor={v.telefono} onCambiar={a.campo('telefono')} tipo="tel" obligatorio autoComplete="tel" />
          <Campo etiqueta="Teléfono fijo" valor={v.telefonoFijo} onCambiar={a.campo('telefonoFijo')} tipo="tel" ayuda="Opcional" />
          <Campo etiqueta="Dirección" valor={v.direccion} onCambiar={a.campo('direccion')} obligatorio completo autoComplete="street-address" />
          <Campo etiqueta="Código postal" valor={v.codigoPostal} onCambiar={a.campo('codigoPostal')} obligatorio autoComplete="postal-code" />
          <Campo etiqueta="Localidad" valor={v.poblacion} onCambiar={a.campo('poblacion')} obligatorio autoComplete="address-level2" />
          <Campo etiqueta="Provincia" valor={v.provincia} onCambiar={a.campo('provincia')} autoComplete="address-level1" />
          <Campo etiqueta="Comunidad autónoma" valor={v.comunidadAutonoma} onCambiar={a.campo('comunidadAutonoma')} />
          <Campo etiqueta="País" valor={v.pais} onCambiar={a.campo('pais')} autoComplete="country-name" placeholder="España" completo />
          <FormControlLabel
            control={<Checkbox checked={v.boletin} onChange={(e) => a.campo('boletin')(e.target.checked)} />}
            label="Quiero recibir el boletín de noticias por correo"
            sx={{ gridColumn: '1 / -1' }}
          />
        </Rejilla>
      }
    />
  )
}

// --------------------------------------------------------------- Vida cofrade

export function VidaCofrade({ ficha, onGuardada }: PropsApartado) {
  const a = useApartado(
    ficha,
    (f) => ({ fechaBautismo: aDia(f.fechaBautismo), lugarBautismo: f.lugarBautismo ?? '', parroquiaBautismo: f.parroquiaBautismo ?? '' }),
    (v) => ([v.lugarBautismo, v.parroquiaBautismo].some((t) => /[<>]/.test(t)) ? 'Los textos no pueden llevar «<» ni «>».' : null),
    (v) => ({ fechaBautismo: v.fechaBautismo || null, lugarBautismo: opcional(v.lugarBautismo), parroquiaBautismo: opcional(v.parroquiaBautismo) }),
    onGuardada,
  )
  const v = a.valores
  const presentado = [ficha.presentadoPor, ficha.presentadoPor2].filter(Boolean).join(' y ')
  const tunica = ficha.tieneTunicaPropia ? `Propia${ficha.tunica ? ` · talla ${ficha.tunica}` : ''}` : ficha.tunica ? `Talla ${ficha.tunica}` : null

  return (
    <Apartado
      titulo="Vida cofrade"
      editando={a.editando} onEditar={a.editar} onCancelar={a.cancelar} onGuardar={() => void a.guardar()}
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
            Son datos opcionales. Solo los ves tú y la Secretaría del Grupo Parroquial.
          </Typography>
          <Rejilla>
            <Campo etiqueta="Fecha de bautismo" valor={v.fechaBautismo} onCambiar={a.campo('fechaBautismo')} tipo="date" />
            <Campo etiqueta="Bautizado/a en" valor={v.lugarBautismo} onCambiar={a.campo('lugarBautismo')} ayuda="La localidad" />
            <Campo etiqueta="Parroquia de bautismo" valor={v.parroquiaBautismo} onCambiar={a.campo('parroquiaBautismo')} completo />
          </Rejilla>
        </>
      }
    />
  )
}

// --------------------------------------------------------------- Cuota y pago

export function CuotaYPago({ ficha, onGuardada }: PropsApartado) {
  const a = useApartado(
    ficha,
    (f) => ({ formaPagoPref: f.formaPagoPref, iban: '', titularidadCuenta: (f.titularidadCuenta ?? '') as TitularidadCuenta | '', titularCuenta: f.titularCuenta ?? '' }),
    (v) => {
      if (v.iban.trim() && !esIbanValido(v.iban)) return 'Revisa el IBAN: los dígitos de control no cuadran.'
      if (v.formaPagoPref === 'DOMICILIACION' && !v.iban.trim() && !ficha.ibanEnmascarado) return 'Para domiciliar los recibos hace falta el IBAN de la cuenta.'
      if (/[<>]/.test(v.titularCuenta)) return 'El titular no puede llevar «<» ni «>».'
      if (v.titularidadCuenta && v.titularidadCuenta !== 'PROPIA' && !v.titularCuenta.trim()) return 'Escribe el nombre del titular de la cuenta.'
      return null
    },
    // El IBAN solo va si se ha escrito uno nuevo: en blanco se queda el que había.
    // Si la cuenta es del propio hermano, el nombre del titular sobra.
    (v) => ({
      formaPagoPref: v.formaPagoPref, ...(v.iban.trim() ? { iban: normalizarIban(v.iban) } : {}),
      titularidadCuenta: v.titularidadCuenta || null,
      titularCuenta: v.titularidadCuenta === 'PROPIA' ? null : opcional(v.titularCuenta),
    }),
    onGuardada,
  )
  const v = a.valores

  return (
    <Apartado
      titulo="Cuota y pago"
      editando={a.editando} onEditar={a.editar} onCancelar={a.cancelar} onGuardar={() => void a.guardar()}
      guardando={a.guardando} error={a.error} hecho={a.hecho}
      vista={
        <Rejilla lista>
          <Dato etiqueta="Forma de pago" valor={FORMA_DE_PAGO[ficha.formaPagoPref]} />
          <Dato etiqueta="Titular de la cuenta" valor={[ficha.titularidadCuenta ? TITULARIDAD_CUENTA[ficha.titularidadCuenta] : null, ficha.titularCuenta].filter(Boolean).join(': ') || null} />
          <Dato etiqueta="IBAN" valor={ficha.ibanEnmascarado} completo />
        </Rejilla>
      }
      formulario={
        <Rejilla>
          <TextField select label="Forma de pago" value={v.formaPagoPref} onChange={(e) => a.campo('formaPagoPref')(e.target.value as FormaDePago)} fullWidth sx={{ gridColumn: '1 / -1' }}>
            {FORMAS_DE_PAGO.map((forma) => <MenuItem key={forma} value={forma}>{FORMA_DE_PAGO[forma]}</MenuItem>)}
          </TextField>
          <Campo
            etiqueta={ficha.ibanEnmascarado ? 'IBAN nuevo' : 'IBAN'}
            valor={v.iban}
            onCambiar={a.campo('iban')}
            completo
            autoComplete="off"
            placeholder="ES00 0000 0000 0000 0000 0000"
            ayuda={ficha.ibanEnmascarado ? `Ahora: ${ficha.ibanEnmascarado}. Déjalo en blanco para no cambiarla.` : undefined}
          />
          <Opciones etiqueta="¿De quién es la cuenta?" valor={v.titularidadCuenta} onCambiar={a.campo('titularidadCuenta')} opciones={TITULARIDAD_CUENTA} vacio="Sin indicar" />
          {v.titularidadCuenta !== 'PROPIA' && (
            <Campo etiqueta="Nombre del titular" valor={v.titularCuenta} onCambiar={a.campo('titularCuenta')} ayuda="Si no es el propio hermano" />
          )}
        </Rejilla>
      }
    />
  )
}
