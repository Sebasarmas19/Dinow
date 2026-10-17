"use server";

import { revalidatePath } from "next/cache";
import {
  exito,
  fallo,
  mensajeDeError,
  type Resultado,
} from "@/lib/shared/resultado";
import {
  confirmarCobertura,
  cubrirDeber,
  marcarCumplido,
  reclamarExtra,
} from "./cumplimiento.service";
import { type Registro } from "./cumplimiento.repo";
import { verificarSesionActual } from "@/lib/auth/auth.service";

/**
 * Server actions del motor de cumplimiento. Leen el FormData, delegan en el
 * service y devuelven un Resultado uniforme.
 *
 * NOTA DE SEGURIDAD: por ahora `participanteId` llega desde el formulario porque
 * aún no hay login. Cuando exista la sesión, ese id debe salir del usuario
 * autenticado y jamás confiarse del navegador. TODO(auth).
 */

function requerir(formData: FormData, campo: string): string {
  const valor = String(formData.get(campo) ?? "").trim();
  if (!valor) throw new Error(`Falta el campo "${campo}".`);
  return valor;
}

export async function marcarCumplidoAction(
  formData: FormData,
): Promise<Resultado<Registro>> {
  try {
    const pId = requerir(formData, "participanteId");
    const sesion = await verificarSesionActual();
    if (!sesion || (sesion.rol !== "admin" && sesion.participanteId !== pId)) {
      throw new Error("No autorizado. Inicie sesión con su PIN.");
    }

    const criteriosRaw = formData
      .getAll("criteriosIds")
      .map((v) => String(v).trim())
      .filter(Boolean);

    const registro = await marcarCumplido({
      deberId: requerir(formData, "deberId"),
      participanteId: pId,
      criteriosIds: criteriosRaw.length > 0 ? criteriosRaw : undefined,
      fotoUrl: formData.get("fotoUrl") ? String(formData.get("fotoUrl")) : null,
      nota: formData.get("nota") ? String(formData.get("nota")) : null,
    });
    revalidatePath("/", "layout");
    return exito(registro);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function cubrirDeberAction(
  formData: FormData,
): Promise<Resultado<Registro>> {
  try {
    const pId = requerir(formData, "participanteId");
    const sesion = await verificarSesionActual();
    if (!sesion || (sesion.rol !== "admin" && sesion.participanteId !== pId)) {
      throw new Error("No autorizado. Inicie sesión con su PIN.");
    }

    const criteriosRaw = formData
      .getAll("criteriosIds")
      .map((v) => String(v).trim())
      .filter(Boolean);

    const registro = await cubrirDeber({
      deberId: requerir(formData, "deberId"),
      participanteId: pId,
      cubiertoA: requerir(formData, "cubiertoA"),
      criteriosIds: criteriosRaw.length > 0 ? criteriosRaw : undefined,
      nota: formData.get("nota") ? String(formData.get("nota")) : null,
      fotoUrl: formData.get("fotoUrl") ? String(formData.get("fotoUrl")) : null,
    });
    revalidatePath("/", "layout");
    return exito(registro);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function confirmarCoberturaAction(
  formData: FormData,
): Promise<Resultado<Registro>> {
  try {
    const pId = requerir(formData, "participanteId");
    const sesion = await verificarSesionActual();
    if (!sesion || (sesion.rol !== "admin" && sesion.participanteId !== pId)) {
      throw new Error("No autorizado. Inicie sesión con su PIN.");
    }

    const registro = await confirmarCobertura({
      registroId: requerir(formData, "registroId"),
      participanteId: pId,
    });
    revalidatePath("/", "layout");
    return exito(registro);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function reclamarExtraAction(
  formData: FormData,
): Promise<Resultado<Registro>> {
  try {
    const pId = requerir(formData, "participanteId");
    const sesion = await verificarSesionActual();
    if (!sesion || (sesion.rol !== "admin" && sesion.participanteId !== pId)) {
      throw new Error("No autorizado. Inicie sesión con su PIN.");
    }

    const registro = await reclamarExtra({
      deberId: requerir(formData, "deberId"),
      participanteId: pId,
      fotoUrl: formData.get("fotoUrl") ? String(formData.get("fotoUrl")) : null,
      nota: formData.get("nota") ? String(formData.get("nota")) : null,
    });
    revalidatePath("/", "layout");
    return exito(registro);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}
