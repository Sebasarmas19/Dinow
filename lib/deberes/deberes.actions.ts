"use server";
import { verificarSesionActual } from "@/lib/auth/auth.service";
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
  type CriterioFormInput,
  desactivarDeber,
  editarDeber,
  type EditarDeberInput,
  reactivarDeber,
} from "./deberes.service";

/**
 * Server actions de deberes (gestion del admin). Leen el FormData, delegan en
 * el service y devuelven un Resultado.
 */

/** Lee un checkbox del formulario: marcado = "on" o "true". */
function leerBooleano(formData: FormData, campo: string): boolean {
  const valor = formData.get(campo);
  return valor === "on" || valor === "true";
}

/**
 * Lee una lista de dias del formulario (varios checkboxes con el mismo nombre).
 * Devuelve `undefined` si no se envio ninguno, para que el service aplique su
 * valor por defecto (toda la semana) en vez de pisar con una lista vacia.
 */
function leerDias(formData: FormData, campo: string): string[] | undefined {
  const valores = formData.getAll(campo).map(String);
  return valores.length > 0 ? valores : undefined;
}

/**
 * Lee el cupo de reclamos. Vacio o ausente = null (sin limite); cualquier otro
 * valor se pasa como numero para que el service lo valide.
 */
function leerMaxReclamos(formData: FormData, campo: string): number | null {
  const valor = formData.get(campo);
  if (valor === null || String(valor).trim() === "") return null;
  return Number(valor);
}

function leerCriterios(formData: FormData): CriterioFormInput[] {
  const jsonRaw = formData.get("criteriosJson");
  if (jsonRaw && typeof jsonRaw === "string" && jsonRaw.trim() !== "") {
    try {
      const parsed = JSON.parse(jsonRaw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          id: item.id ? String(item.id) : undefined,
          descripcion: String(item.descripcion ?? ""),
          puntos:
            item.puntos !== undefined && item.puntos !== ""
              ? Number(item.puntos)
              : undefined,
        }));
      }
    } catch {
      // Fallback a lista de strings
    }
  }
  return formData
    .getAll("criterios")
    .map(String)
    .filter((c) => c.trim() !== "");
}

export async function crearDeberAction(
  formData: FormData,
): Promise<Resultado<Deber>> {
  const sesion = await verificarSesionActual();
  if (!sesion || sesion.rol !== "admin") {
    return {
      ok: false,
      error: "No autorizado. Requiere permisos de administrador.",
    } as any;
  }

  try {
    const input: CrearDeberInput = {
      nombre: String(formData.get("nombre") ?? ""),
      tipoAsignacion: String(
        formData.get("tipoAsignacion") ?? "",
      ) as CrearDeberInput["tipoAsignacion"],
      esObligatorio: leerBooleano(formData, "esObligatorio"),
      esPersonal: leerBooleano(formData, "esPersonal"),
      puntos: Number(formData.get("puntos") ?? NaN),
      cadencia: String(
        formData.get("cadencia") ?? "",
      ) as CrearDeberInput["cadencia"],
      diasDisponibles: leerDias(formData, "diasDisponibles"),
      maxReclamos: leerMaxReclamos(formData, "maxReclamos"),
      requiereFoto: leerBooleano(formData, "requiereFoto"),
      asignadoA: formData.get("asignadoA")
        ? String(formData.get("asignadoA"))
        : null,
      limitePorPersona: leerBooleano(formData, "limitePorPersona"),
      criterios: leerCriterios(formData),
    };
    const deber = await crearDeber(input);
    revalidatePath("/", "layout");
    return exito(deber);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function editarDeberAction(
  formData: FormData,
): Promise<Resultado<Deber>> {
  const sesion = await verificarSesionActual();
  if (!sesion || sesion.rol !== "admin") {
    return {
      ok: false,
      error: "No autorizado. Requiere permisos de administrador.",
    } as any;
  }

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
      diasDisponibles: leerDias(formData, "diasDisponibles"),
      maxReclamos: leerMaxReclamos(formData, "maxReclamos"),
      requiereFoto: leerBooleano(formData, "requiereFoto"),
      asignadoA: formData.get("asignadoA")
        ? String(formData.get("asignadoA"))
        : null,
      limitePorPersona: leerBooleano(formData, "limitePorPersona"),
      criterios: leerCriterios(formData),
    };
    const deber = await editarDeber(id, input);
    revalidatePath("/", "layout");
    return exito(deber);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function desactivarDeberAction(
  formData: FormData,
): Promise<Resultado<Deber>> {
  const sesion = await verificarSesionActual();
  if (!sesion || sesion.rol !== "admin") {
    return {
      ok: false,
      error: "No autorizado. Requiere permisos de administrador.",
    } as any;
  }

  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el id del deber.");
    const deber = await desactivarDeber(id);
    revalidatePath("/", "layout");
    return exito(deber);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function reactivarDeberAction(
  formData: FormData,
): Promise<Resultado<Deber>> {
  const sesion = await verificarSesionActual();
  if (!sesion || sesion.rol !== "admin") {
    return {
      ok: false,
      error: "No autorizado. Requiere permisos de administrador.",
    } as any;
  }

  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el id del deber.");
    const deber = await reactivarDeber(id);
    revalidatePath("/", "layout");
    return exito(deber);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}
