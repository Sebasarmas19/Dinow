/**
 * Resultado uniforme para las server actions.
 *
 * Las server actions NO deben lanzar errores crudos al navegador: en su lugar
 * devuelven este objeto, que la UI puede leer para mostrar exito o un mensaje
 * de error claro. `ok` distingue los dos casos (es un "discriminated union":
 * si ok es true hay `data`, si es false hay `error`).
 */
export type Resultado<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Helper para devolver un resultado exitoso. */
export function exito<T>(data: T): Resultado<T> {
  return { ok: true, data };
}

/** Helper para devolver un resultado fallido con un mensaje legible. */
export function fallo(error: string): Resultado<never> {
  return { ok: false, error };
}

/**
 * Convierte un error capturado (catch) en un mensaje legible.
 * Los errores de validacion del service son `Error` con mensaje en espanol;
 * cualquier otra cosa se reporta como error generico.
 */
export function mensajeDeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Ocurrio un error inesperado.";
}
