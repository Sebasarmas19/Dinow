"use server";

import { revalidatePath } from "next/cache";
import {
  exito,
  fallo,
  mensajeDeError,
  type Resultado,
} from "@/lib/shared/resultado";
import { type Participante } from "./participantes.repo";
import {
  crearParticipante,
  desactivarParticipante,
  editarParticipante,
  reactivarParticipante,
} from "./participantes.service";

/**
 * Server actions de participantes (gestion del admin). Punto de entrada desde
 * la UI: leen el FormData, delegan en el service y devuelven un Resultado.
 *
 * NOTA DE SEGURIDAD: estas acciones modifican datos del hogar y son accesibles
 * por POST directo. Gestionar participantes es accion de admin.
 * TODO(auth): verificar que quien llama es admin cuando exista el login.
 */

export async function crearParticipanteAction(
  formData: FormData,
): Promise<Resultado<Participante>> {
  try {
    const participante = await crearParticipante({
      nombre: String(formData.get("nombre") ?? ""),
      fotoUrl: formData.get("fotoUrl") ? String(formData.get("fotoUrl")) : null,
      esAdmin: formData.get("esAdmin") === "on",
    });
    revalidatePath("/");
    return exito(participante);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function editarParticipanteAction(
  formData: FormData,
): Promise<Resultado<Participante>> {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el id del participante.");

    const participante = await editarParticipante(id, {
      nombre: String(formData.get("nombre") ?? ""),
      fotoUrl: formData.get("fotoUrl") ? String(formData.get("fotoUrl")) : null,
      esAdmin: formData.get("esAdmin") === "on",
    });
    revalidatePath("/");
    return exito(participante);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function desactivarParticipanteAction(
  formData: FormData,
): Promise<Resultado<Participante>> {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el id del participante.");
    const participante = await desactivarParticipante(id);
    revalidatePath("/");
    return exito(participante);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function reactivarParticipanteAction(
  formData: FormData,
): Promise<Resultado<Participante>> {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el id del participante.");
    const participante = await reactivarParticipante(id);
    revalidatePath("/");
    return exito(participante);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}
