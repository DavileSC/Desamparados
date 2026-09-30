import { type } from 'arktype';

// Solo se comprueba que sean coordenadas; si caen lejos del recorrido lo
// decide el mapa, que es quien lo tiene dibujado.
export const posicionSchema = type({
    body: {
        lng: type("-180 <= number <= 180").describe("una longitud"),
        lat: type("-90 <= number <= 90").describe("una latitud"),
        precision: type("0 <= number.integer <= 100000").or("null").describe("los metros de margen del GPS"),
    }
});
