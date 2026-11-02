"use server";

import { revalidatePath } from "next/cache";
import { verificarSesionActual } from "@/lib/auth/auth.service";
import {
  exito,
  fallo,
  mensajeDeError,
  type Resultado,
} from "@/lib/shared/resultado";
import {
  aprobarTareaVoluntaria,
  proponerTareaVoluntaria,
  rechazarTareaVoluntaria,
} from "./tareas-voluntarias.service";
import type { TareaVoluntaria } from "./tareas-voluntarias.repo";

function requerir(formData: FormData, campo: string): string {
  const valor = String(formData.get(campo) ?? "").trim();
  if (!valor) throw new Error(`Falta el campo "${campo}".`);
  return valor;
}

/**
 * Server action: un integrante propone una tarea voluntaria que realizó.
 */
export async function proponerTareaVoluntariaAction(
  formData: FormData,
): Promise<Resultado<TareaVoluntaria>> {
  try {
    const participanteId = requerir(formData, "participanteId");
    const sesion = await verificarSesionActual();
    if (
      !sesion ||
      (sesion.rol !== "admin" && sesion.participanteId !== participanteId)
    ) {
      throw new Error("No autorizado. Inicie sesión con su perfil.");
    }

    const titulo = requerir(formData, "titulo");
    const descripcion = requerir(formData, "descripcion");
    const fotoUrl = String(formData.get("fotoUrl") ?? "").trim() || null;
    const puntosRaw = formData.get("puntosSugeridos");
    const puntosSugeridos =
      puntosRaw !== null && puntosRaw !== "" ? Number(puntosRaw) : null;

    const tarea = await proponerTareaVoluntaria({
      participanteId,
      titulo,
      descripcion,
      fotoUrl,
      puntosSugeridos,
    });

    revalidatePath(`/${participanteId}`);
    revalidatePath("/admin");
    revalidatePath("/admin/tareas-voluntarias");

    return exito(tarea);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

/**
 * Server action: el administrador aprueba una tarea voluntaria y otorga puntos.
 */
export async function aprobarTareaVoluntariaAction(
  formData: FormData,
): Promise<Resultado<TareaVoluntaria>> {
  try {
    const sesion = await verificarSesionActual();
    if (!sesion || sesion.rol !== "admin") {
      throw new Error("No autorizado. Requiere permisos de administrador.");
    }

    const tareaId = requerir(formData, "tareaId");
    const adminId = sesion.participanteId || requerir(formData, "adminId");
    const puntosOtorgados = Number(formData.get("puntosOtorgados"));

    if (!Number.isFinite(puntosOtorgados) || puntosOtorgados <= 0) {
      throw new Error("Debes especificar una cantidad de puntos válida mayor a 0.");
    }

    const tarea = await aprobarTareaVoluntaria({
      tareaId,
      adminId,
      puntosOtorgados,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/tareas-voluntarias");
    revalidatePath("/admin/auditoria");
    revalidatePath(`/${tarea.participanteId}`);
    revalidatePath("/", "layout");

    return exito(tarea);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

/**
 * Server action: el administrador rechaza una tarea voluntaria con motivo.
 */
export async function rechazarTareaVoluntariaAction(
  formData: FormData,
): Promise<Resultado<TareaVoluntaria>> {
  try {
    const sesion = await verificarSesionActual();
    if (!sesion || sesion.rol !== "admin") {
      throw new Error("No autorizado. Requiere permisos de administrador.");
    }

    const tareaId = requerir(formData, "tareaId");
    const adminId = sesion.participanteId || requerir(formData, "adminId");
    const motivoRechazo = String(formData.get("motivoRechazo") ?? "").trim();

    const tarea = await rechazarTareaVoluntaria({
      tareaId,
      adminId,
      motivoRechazo,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/tareas-voluntarias");
    revalidatePath("/admin/auditoria");
    revalidatePath(`/${tarea.participanteId}`);
    revalidatePath("/", "layout");

    return exito(tarea);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}
