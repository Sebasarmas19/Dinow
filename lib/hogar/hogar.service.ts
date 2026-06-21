import {
  type Hogar,
  insertarHogar,
  obtenerPrimerHogar,
  actualizarHogar,
} from "./hogar.repo";

/**
 * Logica de negocio del hogar. Aqui van validaciones y reglas; no se habla
 * directo con la base de datos (eso es trabajo del repo).
 */

/** Datos que el admin proporciona para crear el hogar. */
export type CrearHogarInput = {
  nombre: string;
  claveAdmin: string;
};

export type EditarHogarInput = {
  nombre?: string;
  horaCierreDia?: string;
  claveAdmin?: string;
  bonoAyuda?: string;
  penalizacionFallo?: string;
  penalizacionColectiva?: string;
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

  return insertarHogar({ nombre, claveAdmin: input.claveAdmin });
}

export async function editarHogar(id: string, input: EditarHogarInput): Promise<Hogar> {
  const existente = await obtenerPrimerHogar();
  if (!existente || existente.id !== id) {
    throw new Error("El hogar especificado no existe.");
  }

  const cambios: Partial<Hogar> = {};

  if (input.nombre !== undefined) {
    const n = input.nombre.trim();
    if (!n) throw new Error("El nombre no puede quedar vacío.");
    cambios.nombre = n;
  }
  if (input.horaCierreDia !== undefined) {
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(input.horaCierreDia)) {
      throw new Error("La hora de cierre debe tener el formato HH:MM.");
    }
    cambios.horaCierreDia = input.horaCierreDia;
  }
  if (input.claveAdmin !== undefined) {
    const c = input.claveAdmin.trim();
    if (!c) throw new Error("La clave del admin no puede estar vacía.");
    cambios.claveAdmin = c;
  }
  if (input.bonoAyuda !== undefined) {
    const b = Number(input.bonoAyuda);
    if (isNaN(b) || b < 0) throw new Error("El bono de ayuda debe ser un número positivo.");
    cambios.bonoAyuda = String(b);
  }
  if (input.penalizacionFallo !== undefined) {
    const p = Number(input.penalizacionFallo);
    if (isNaN(p) || p < 0) throw new Error("La penalización por fallo debe ser un número positivo.");
    cambios.penalizacionFallo = String(p);
  }
  if (input.penalizacionColectiva !== undefined) {
    const p = Number(input.penalizacionColectiva);
    if (isNaN(p) || p < 0) throw new Error("La penalización colectiva debe ser un número positivo.");
    cambios.penalizacionColectiva = String(p);
  }

  const actualizado = await actualizarHogar(id, cambios);
  if (!actualizado) throw new Error("No se pudo actualizar el hogar.");
  return actualizado;
}
