"use server";
import { verificarSesionActual } from "@/lib/auth/auth.service";

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
  const sesion = await verificarSesionActual();
  if (!sesion || sesion.rol !== 'admin') {
    return { ok: false, error: 'No autorizado. Requiere permisos de administrador.' } as any;
  }
  try {
    const participante = await crearParticipante({
      nombre: String(formData.get("nombre") ?? ""),
      fotoUrl: formData.get("fotoUrl") ? String(formData.get("fotoUrl")) : null,
      esAdmin: formData.get("esAdmin") === "on",
    });
    revalidatePath("/", "layout");
    return exito(participante);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function editarParticipanteAction(
  formData: FormData,
): Promise<Resultado<Participante>> {
  const sesion = await verificarSesionActual();
  if (!sesion || sesion.rol !== 'admin') {
    return { ok: false, error: 'No autorizado. Requiere permisos de administrador.' } as any;
  }
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el id del participante.");

    const participante = await editarParticipante(id, {
      nombre: String(formData.get("nombre") ?? ""),
      fotoUrl: formData.get("fotoUrl") ? String(formData.get("fotoUrl")) : null,
      esAdmin: formData.get("esAdmin") === "on",
    });
    revalidatePath("/", "layout");
    return exito(participante);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function updateFotoPerfilAction(id: string, fotoUrl: string | null): Promise<Resultado<Participante>> {
  try {
    if (!id) throw new Error("Falta el id del participante.");

    const sesion = await verificarSesionActual();
    if (!sesion || (sesion.rol !== "admin" && sesion.participanteId !== id)) {
      return fallo("No autorizado para modificar esta foto de perfil.");
    }
    
    // We only update the fotoUrl, keeping everything else the same.
    // However, `editarParticipante` requires `nombre` and `esAdmin`.
    // Since we don't want to fetch it here, let's use a specialized service or just a raw db update.
    // Actually, `editarParticipante` takes `Partial<InsertParticipante>`. Let's check `participantes.service.ts`.
    // Assuming we can just do a direct DB update for efficiency.
    const { db } = await import("@/lib/db");
    const { participantes } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const [actualizado] = await db.update(participantes).set({ fotoUrl }).where(eq(participantes.id, id)).returning();
    if (!actualizado) throw new Error("Participante no encontrado.");
    
    revalidatePath("/", "layout");
    return exito(actualizado);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function desactivarParticipanteAction(
  formData: FormData,
): Promise<Resultado<Participante>> {
  const sesion = await verificarSesionActual();
  if (!sesion || sesion.rol !== 'admin') {
    return { ok: false, error: 'No autorizado. Requiere permisos de administrador.' } as any;
  }
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el id del participante.");
    const participante = await desactivarParticipante(id);
    revalidatePath("/", "layout");
    return exito(participante);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function reactivarParticipanteAction(
  formData: FormData,
): Promise<Resultado<Participante>> {
  const sesion = await verificarSesionActual();
  if (!sesion || sesion.rol !== 'admin') {
    return { ok: false, error: 'No autorizado. Requiere permisos de administrador.' } as any;
  }
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el id del participante.");
    const participante = await reactivarParticipante(id);
    revalidatePath("/", "layout");
    return exito(participante);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function cambiarPinAction(
  formData: FormData,
): Promise<Resultado<void>> {
  "use server";
  try {
    const sesion = await verificarSesionActual();
    const participanteId = String(formData.get("participanteId") ?? "");
    
    if (!sesion || (sesion.rol !== "admin" && sesion.participanteId !== participanteId)) {
      return { ok: false, error: "No autorizado para cambiar este PIN." } as any;
    }

    const pinActual = String(formData.get("pinActual") ?? "");
    const pinNuevo = String(formData.get("pinNuevo") ?? "");

    if (!pinActual || !pinNuevo) {
      throw new Error("Debe proporcionar el PIN actual y el PIN nuevo.");
    }

    if (pinNuevo.length !== 4) {
      throw new Error("El nuevo PIN debe tener exactamente 4 dígitos.");
    }

    const { db } = await import("@/lib/db");
    const { participantes } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { compararClave, hashClave } = await import("@/lib/auth/auth.service");

    const [participante] = await db
      .select()
      .from(participantes)
      .where(eq(participantes.id, participanteId));

    if (!participante) {
      throw new Error("Participante no encontrado.");
    }

    if (!participante.pinHash) {
      throw new Error("El participante no tiene un PIN configurado. Contacte al administrador.");
    }

    if (!compararClave(pinActual, participante.pinHash)) {
      throw new Error("El PIN actual es incorrecto.");
    }

    const nuevoPinHash = hashClave(pinNuevo);

    await db
      .update(participantes)
      .set({ pinHash: nuevoPinHash })
      .where(eq(participantes.id, participanteId));

    revalidatePath("/", "layout");
    return exito(undefined);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}
