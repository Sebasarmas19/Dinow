"use server";

import { verificarSesionActual } from "./auth.service";
import {
  generarOpcionesRegistroService,
  verificarRegistroService,
  generarOpcionesLoginService,
  verificarLoginService,
  listarBiometriasDeParticipante,
  eliminarBiometria,
} from "./webauthn.service";
import { exito, fallo, mensajeDeError, type Resultado } from "@/lib/shared/resultado";
import { revalidatePath } from "next/cache";

export async function generarOpcionesRegistroAction(participanteId: string): Promise<Resultado<any>> {
  try {
    const sesion = await verificarSesionActual();
    if (!sesion || (sesion.rol !== "admin" && sesion.participanteId !== participanteId)) {
      return fallo("Debes iniciar sesión para activar Face ID en este dispositivo.");
    }

    const options = await generarOpcionesRegistroService(participanteId);
    return exito(options);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function verificarRegistroAction(
  participanteId: string,
  response: any,
  dispositivoNombre?: string
): Promise<Resultado<void>> {
  try {
    const sesion = await verificarSesionActual();
    if (!sesion || (sesion.rol !== "admin" && sesion.participanteId !== participanteId)) {
      return fallo("No autorizado");
    }

    await verificarRegistroService(participanteId, response, dispositivoNombre);
    revalidatePath("/", "layout");
    return exito(undefined);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function generarOpcionesLoginAction(participanteId?: string): Promise<Resultado<any>> {
  try {
    const options = await generarOpcionesLoginService(participanteId);
    return exito(options);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function verificarLoginAction(response: any): Promise<Resultado<{ participanteId: string }>> {
  try {
    const res = await verificarLoginService(response);
    revalidatePath("/", "layout");
    return exito({ participanteId: res.participanteId });
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function listarBiometriasAction(participanteId: string): Promise<Resultado<any[]>> {
  try {
    const sesion = await verificarSesionActual();
    if (!sesion || (sesion.rol !== "admin" && sesion.participanteId !== participanteId)) {
      return fallo("No autorizado");
    }

    const creds = await listarBiometriasDeParticipante(participanteId);
    return exito(creds);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function eliminarBiometriaAction(
  credentialId: string,
  participanteId: string
): Promise<Resultado<void>> {
  try {
    const sesion = await verificarSesionActual();
    if (!sesion || (sesion.rol !== "admin" && sesion.participanteId !== participanteId)) {
      return fallo("No autorizado");
    }

    await eliminarBiometria(credentialId, participanteId);
    revalidatePath("/", "layout");
    return exito(undefined);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function tieneBiometriaRegistradaAction(participanteId: string): Promise<Resultado<boolean>> {
  try {
    const creds = await listarBiometriasDeParticipante(participanteId);
    return exito(creds.length > 0);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}
