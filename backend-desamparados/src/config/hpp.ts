import hpp from 'hpp';

const hppConfig = hpp({
  // Whitelist: Lista de parámetros que SÍ permitimos que lleguen duplicados (como arrays).
  // Por defecto, HPP se queda con el último valor para evitar errores de tipo y ataques.
  // Si en el futuro necesitas filtros múltiples (ej: ?tags=cultos&tags=formacion), añádelo aquí:
  whitelist: [] 
});

export default hppConfig;