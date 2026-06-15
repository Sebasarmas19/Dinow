import {
  type Hogar,
  insertarHogar,
  obtenerPrimerHogar,
} from "./hogar.repo";

/**
 * Logica de negocio del hogar. Aqui van validaciones y reglas; no se habla
 * directo con la base de datos (eso es trabajo del repo).
 */

/** Datos que el admin proporciona para crear el hogar. */
export type CrearHogarInput = {
  nombre: string;
};

/**
 * Devuelve el hogar actual, o null si todavia no existe.
 * Lo usan las lecturas que toleran que aun no haya hogar configurado.
 */
export async function obtenerHogarActual(): Promise<Hogar | null> {
  const hogar = await obtenerPrimerHogar();
  return hogar ?? null;
}

/**
 * Devuelve el id del hogar actual. Si no hay hogar, lanza error: muchas
 * operaciones (crear participantes, deberes) no tienen sentido sin un hogar.
 */
export async function obtenerHogarActualId(): Promise<string> {
  const hogar = await obtenerPrimerHogar();
  if (!hogar) {
    throw new Error(
      "Todavia no hay un hogar configurado. Crea el hogar antes de continuar.",
    );
  }
  return hogar.id;
}

/**
 * Crea el hogar. Por ahora la app es de un solo hogar, asi que no se permite
 * crear un segundo. Los valores de puntos (bono, penalizaciones), zona horaria
 * y hora de cierre quedan en sus defaults del esquema (Caracas, 03:00, etc.).
 */
export async function crearHogar(input: CrearHogarInput): Promise<Hogar> {
  const nombre = input.nombre?.trim();
  if (!nombre) {
    throw new Error("El nombre del hogar es obligatorio.");
  }

  const existente = await obtenerPrimerHogar();
  if (existente) {
    throw new Error("Ya existe un hogar. Esta app maneja un solo hogar.");
  }

  return insertarHogar({ nombre });
}
