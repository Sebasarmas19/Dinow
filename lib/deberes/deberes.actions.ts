"use server";

import { revalidatePath } from "next/cache";
import {
  exito,
  fallo,
  mensajeDeError,
  type Resultado,
} from "@/lib/shared/resultado";
import { type Deber } from "./deberes.repo";
import {
  crearDeber,
  type CrearDeberInput,
  desactivarDeber,
  editarDeber,
  type EditarDeberInput,
  reactivarDeber,
} from "./deberes.service";

/**
 * Server actions de deberes (gestion del admin). Leen el FormData, delegan en
 * el service y devuelven un Resultado.
 *
 * NOTA DE SEGURIDAD: accesibles por POST directo; gestionar deberes es accion
 * de admin. TODO(auth): verificar admin cuando exista el login.
 */

/** Lee un checkbox del formulario: marcado = "on" o "true". */
function leerBooleano(formData: FormData, campo: string): boolean {
  const valor = formData.get(campo);
  return valor === "on" || valor === "true";
}

export async function crearDeberAction(
  formData: FormData,
): Promise<Resultado<Deber>> {
  try {
    const input: CrearDeberInput = {
      nombre: String(formData.get("nombre") ?? ""),
      // El service valida estos valores en tiempo de ejecucion.
      tipoAsignacion: String(
        formData.get("tipoAsignacion") ?? "",
      ) as CrearDeberInput["tipoAsignacion"],
      esObligatorio: leerBooleano(formData, "esObligatorio"),
      esPersonal: leerBooleano(formData, "esPersonal"),
      puntos: Number(formData.get("puntos") ?? NaN),
      cadencia: String(
        formData.get("cadencia") ?? "",
      ) as CrearDeberInput["cadencia"],
      requiereFoto: leerBooleano(formData, "requiereFoto"),
    };
    const deber = await crearDeber(input);
    revalidatePath("/");
    return exito(deber);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function editarDeberAction(
  formData: FormData,
): Promise<Resultado<Deber>> {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el id del deber.");

    const input: EditarDeberInput = {
      nombre: String(formData.get("nombre") ?? ""),
      tipoAsignacion: String(
        formData.get("tipoAsignacion") ?? "",
      ) as EditarDeberInput["tipoAsignacion"],
      esObligatorio: leerBooleano(formData, "esObligatorio"),
      esPersonal: leerBooleano(formData, "esPersonal"),
      puntos: Number(formData.get("puntos") ?? NaN),
      cadencia: String(
        formData.get("cadencia") ?? "",
      ) as EditarDeberInput["cadencia"],
      requiereFoto: leerBooleano(formData, "requiereFoto"),
    };
    const deber = await editarDeber(id, input);
    revalidatePath("/");
    return exito(deber);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function desactivarDeberAction(
  formData: FormData,
): Promise<Resultado<Deber>> {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el id del deber.");
    const deber = await desactivarDeber(id);
    revalidatePath("/");
    return exito(deber);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function reactivarDeberAction(
  formData: FormData,
): Promise<Resultado<Deber>> {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el id del deber.");
    const deber = await reactivarDeber(id);
    revalidatePath("/");
    return exito(deber);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}
