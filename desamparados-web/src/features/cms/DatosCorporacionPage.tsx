import { Button, Stack, Tab, Tabs } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import CabeceraSeccion from './CabeceraSeccion'
import { site } from '../../config/site'
import { useAuthStore } from '../altas/auth/store'
import Contacto from './corporacion/Contacto'
import IdentidadYMarca from './corporacion/IdentidadYMarca'

type Pestana = 'contacto' | 'marca'

/**
 * Sistema › Datos de la corporación. Contacto lo lleva Secretaría; la
 * identidad y la marca (el nombre, los colores, el escudo), solo
 * Administración, y por eso Secretaría no ve las pestañas. La pestaña va en la
 * dirección (`?ver=marca`) para que «Recargar» tras guardar vuelva a ella.
 */
export default function DatosCorporacionPage() {
  const esAdministracion = useAuthStore((state) => state.cms?.role === 'ADMIN')
  const [parametros, setParametros] = useSearchParams()
  const pestana: Pestana = esAdministracion && parametros.get('ver') === 'marca' ? 'marca' : 'contacto'
  return (
    <>
      <Helmet><title>{`Datos de la corporación | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Datos de la corporación"
        subtitulo={esAdministracion
          ? 'Quién sois y cómo se os contacta: lo que enseñan la web, los correos y los PDF.'
          : 'Cómo se os contacta: lo que enseñan el pie de la web, los textos legales, el alta y los correos.'} />
      {esAdministracion && (
        <Stack direction="row" sx={{ mb: 3, borderBottom: 1, borderColor: 'divider', alignItems: 'center', justifyContent: 'space-between', columnGap: 2, flexWrap: 'wrap' }}>
          <Tabs value={pestana} onChange={(_, v: Pestana) => setParametros(v === 'marca' ? { ver: 'marca' } : {})}>
            <Tab value="contacto" label="Contacto" />
            <Tab value="marca" label="Identidad y marca" />
          </Tabs>
          <Button component={Link} to="/cms/bienvenida" variant="text" sx={{ minHeight: 40 }}>Repasar con el asistente</Button>
        </Stack>
      )}
      {pestana === 'marca' ? <IdentidadYMarca /> : <Contacto />}
    </>
  )
}
