"use server";

import { loginAdmin, loginParticipante, cerrarSesion, autorizarHogar, desautorizarHogar } from "./auth.service";
import { exito, fallo, mensajeDeError, type Resultado } from "@/lib/shared/resultado";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function validarCodigoHogarAction(formData: FormData): Promise<Resultado<void>> {
  try {
    const codigo = String(formData.get("codigo") ?? "").trim();
    if (!codigo) throw new Error("Por favor ingresa el código del hogar");

    const valido = await autorizarHogar(codigo);
    if (!valido) throw new Error("Código del hogar incorrecto. Consulta con el administrador.");

    revalidatePath("/", "layout");
    return exito(undefined);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function salirDelHogarAction(): Promise<void> {
  await cerrarSesion();
  await desautorizarHogar();
  redirect("/");
}

export async function loginAdminAction(formData: FormData): Promise<Resultado<void>> {
  try {
    const clave = String(formData.get("clave") ?? "").trim();
    if (!clave) throw new Error("La contraseña no puede estar vacía");
    
    const esValido = await loginAdmin(clave);
    if (!esValido) throw new Error("Contraseña incorrecta");
    
    return exito(undefined);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function loginParticipanteAction(formData: FormData): Promise<Resultado<void>> {
  try {
    const id = String(formData.get("participanteId") ?? "").trim();
    const pin = String(formData.get("pin") ?? "").trim();
    
    if (!id || !pin) throw new Error("Faltan datos");
    
    const esValido = await loginParticipante(id, pin);
    if (!esValido) throw new Error("PIN incorrecto");
    
    return exito(undefined);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function logoutAction(): Promise<void> {
  await cerrarSesion();
  redirect("/");
}
