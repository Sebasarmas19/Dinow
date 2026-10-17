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
  cancelarIntercambio,
  responderIntercambio,
  solicitarIntercambio,
  type SolicitudIntercambio,
} from "./intercambio.service";

export async function solicitarIntercambioAction(
  solicitanteId: string,
  destinatarioId: string,
  criteriosSolicitanteIds?: string[] | null,
  criteriosDestinatarioIds?: string[] | null,
): Promise<Resultado<SolicitudIntercambio>> {
  try {
    const sesion = await verificarSesionActual();
    if (
      !sesion ||
      (sesion.rol !== "admin" && sesion.participanteId !== solicitanteId)
    ) {
      throw new Error("No autorizado. Inicie sesión con su PIN.");
    }

    const solicitud = await solicitarIntercambio({
      solicitanteId,
      destinatarioId,
      criteriosSolicitanteIds,
      criteriosDestinatarioIds,
    });
    revalidatePath("/", "layout");
    return exito(solicitud);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function responderIntercambioAction(
  solicitudId: string,
  participanteId: string,
  aceptar: boolean,
): Promise<Resultado<SolicitudIntercambio>> {
  try {
    const sesion = await verificarSesionActual();
    if (
      !sesion ||
      (sesion.rol !== "admin" && sesion.participanteId !== participanteId)
    ) {
      throw new Error("No autorizado. Inicie sesión con su PIN.");
    }

    const solicitud = await responderIntercambio({
      solicitudId,
      participanteId,
      aceptar,
    });
    revalidatePath("/", "layout");
    return exito(solicitud);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function cancelarIntercambioAction(
  solicitudId: string,
  solicitanteId: string,
): Promise<Resultado<SolicitudIntercambio>> {
  try {
    const sesion = await verificarSesionActual();
    if (
      !sesion ||
      (sesion.rol !== "admin" && sesion.participanteId !== solicitanteId)
    ) {
      throw new Error("No autorizado. Inicie sesión con su PIN.");
    }

    const solicitud = await cancelarIntercambio({
      solicitudId,
      solicitanteId,
    });
    revalidatePath("/", "layout");
    return exito(solicitud);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}
