"use server";

import { revalidatePath } from "next/cache";
import {
  exito,
  fallo,
  mensajeDeError,
  type Resultado,
} from "@/lib/shared/resultado";
import { type Hogar } from "./hogar.repo";
import { crearHogar } from "./hogar.service";

/**
 * Server actions del hogar: el punto de entrada desde la UI (como controllers).
 * Reciben datos del formulario, delegan en el service y devuelven un Resultado.
 *
 * NOTA DE SEGURIDAD: las server actions son accesibles por POST directo, no
 * solo desde la UI. Crear/editar el hogar es accion de admin; cuando exista el
 * sistema de login habra que verificar aqui que quien llama es admin.
 * TODO(auth): añadir verificacion de admin cuando se implemente la autenticacion.
 */

export async function crearHogarAction(
  formData: FormData,
): Promise<Resultado<Hogar>> {
  try {
    const nombre = String(formData.get("nombre") ?? "");
    const hogar = await crearHogar({ nombre });

    // Refresca las pantallas que dependen del hogar. Se afinara cuando existan
    // las rutas concretas del panel de admin.
    revalidatePath("/");

    return exito(hogar);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}
