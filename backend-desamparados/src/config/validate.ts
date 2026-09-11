import { Request, Response, NextFunction } from 'express';
import { Type, ArkErrors } from 'arktype';
import { mensajeValidacion } from './mensajes-validacion.js';

export const validate = (schema: Type<any>) => {
  // SEGURIDAD (anti mass-assignment): ArkType, por defecto, CONSERVA las claves no
  // declaradas en el esquema. Eso permitía colar `{"user":{"update":{"role":"ADMIN"}}}`
  // en un body y que llegara intacto a Prisma. Con 'delete' en profundidad, cualquier
  // clave que no esté declarada explícitamente se descarta en body, query y params.
  const strictSchema = schema.onDeepUndeclaredKey('delete');

  return (req: Request, res: Response, next: NextFunction) => {
    // ArkType valida de forma síncrona y devuelve:
    //  - Los datos validados (con la misma estructura de entrada) si todo va bien
    //  - Una instancia de ArkErrors si algo falla
    const result = strictSchema({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (result instanceof ArkErrors) {
      return res.status(400).json({
        status: 'error',
        message: 'Error de validación',
        errors: [...result].map((problem) => ({
          field: problem.path.join('.').replace(/^(body\.|query\.|params\.)/, ''),
          message: mensajeValidacion(problem)
        }))
      });
    }

    // Reemplazamos los datos con la versión validada y tipada
    const validData = result as unknown as Record<string, any>;
    if (validData?.body) req.body = validData.body;
    // OJO: En Express 5, 'query' y 'params' son getters de solo lectura en el prototype,
    // por lo que hay que redefinirlos a nivel de instancia con defineProperty.
    if (validData?.query) Object.defineProperty(req, 'query', { value: validData.query });
    if (validData?.params) Object.defineProperty(req, 'params', { value: validData.params });

    next();
  };
};
