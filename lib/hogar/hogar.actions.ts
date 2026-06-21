"use server";

import { revalidatePath } from "next/cache";
import {
  exito,
  fallo,
  mensajeDeError,
  type Resultado,
} from "@/lib/shared/resultado";
import { type Hogar } from "./hogar.repo";
import { crearHogar, editarHogar } from "./hogar.service";
import { registrarAccion } from "@/lib/auditoria/auditoria.service";

/**
 * Server actions del hogar: el punto de entrada desde la UI (como controllers).
 * Reciben datos del formulario, delegan en el service y devuelven un Resultado.
 *
 * NOTA DE SEGURIDAD: las server actions son accesibles por POST directo, no
 * solo desde la UI. Crear/editar el hogar es accion de admin; cuando exista el
 * sistema de login habra que verificar aqui que quien llama es admin.
 * TODO(auth): añadir verificacion de admin cuando se implemente la autenticacion.
 */

export async function setupInicialAction(
  formData: FormData,
): Promise<Resultado<void>> {
  try {
    const data = {
      nombre: String(formData.get("nombre") ?? ""),
      zonaHoraria: String(formData.get("zonaHoraria") ?? "America/Caracas"),
      horaCierreDia: String(formData.get("horaCierreDia") ?? "03:00"),
      bonoAyuda: String(formData.get("bonoAyuda") ?? "5"),
      penalizacionFallo: String(formData.get("penalizacionFallo") ?? "15"),
      penalizacionColectiva: String(formData.get("penalizacionColectiva") ?? "10"),
      claveAdmin: String(formData.get("claveAdmin") ?? ""),
      // Nombres de participantes, separados por coma
      nombresParticipantes: String(formData.get("participantes") ?? "")
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    };

    if (!data.nombre || !data.claveAdmin) {
      throw new Error("El nombre y la contraseña son obligatorios.");
    }

    // Importamos dinámicamente para no ensuciar la importación principal
    const { setupInicialHogar } = await import("./setup.service");
    await setupInicialHogar(data);

    // Refrescar toda la app porque cambió el estado global
    revalidatePath("/", "layout");

    return exito(undefined);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function actualizarConfiguracionHogarAction(
  formData: FormData,
): Promise<Resultado<Hogar>> {
  try {
    const hogarId = String(formData.get("hogarId") ?? "").trim();
    const adminId = String(formData.get("adminId") ?? "").trim();

    if (!hogarId || !adminId) {
      throw new Error("Faltan parámetros de seguridad (hogarId, adminId).");
    }

    const input = {
      nombre: String(formData.get("nombre") ?? "").trim(),
      horaCierreDia: String(formData.get("horaCierreDia") ?? "").trim(),
      claveAdmin: String(formData.get("claveAdmin") ?? "").trim(),
      bonoAyuda: String(formData.get("bonoAyuda") ?? "").trim(),
      penalizacionFallo: String(formData.get("penalizacionFallo") ?? "").trim(),
      penalizacionColectiva: String(formData.get("penalizacionColectiva") ?? "").trim(),
    };

    const actualizado = await editarHogar(hogarId, input);

    // Guardar en la auditoría
    await registrarAccion({
      adminId,
      accion: "editar_configuracion",
      detalle: { ...input },
    });

    revalidatePath("/", "layout");
    return exito(actualizado);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}
