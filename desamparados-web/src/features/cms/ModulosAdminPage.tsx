import { Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import CabeceraSeccion from './CabeceraSeccion'
import ListaDeModulos from './modulos/ListaDeModulos'
import { site } from '../../config/site'

/**
 * Qué módulos tiene encendidos esta instalación. Solo Administración: encender
 * uno abre pantallas y rutas a toda la junta.
 */
export default function ModulosAdminPage() {
  return (
    <>
      <Helmet><title>{`Módulos | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Módulos" />
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        Lo que esta instalación usa. Apagar un módulo lo quita del CMS, de la web y del área de hermanos y cierra sus rutas; sus datos se conservan y vuelven al encenderlo.
      </Typography>
      <ListaDeModulos />
    </>
  )
}
