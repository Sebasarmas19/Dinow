"use server";

import { loginAdmin, loginParticipante, cerrarSesion, autorizarHogar, desautorizarHogar, verificarSesionActual } from "./auth.service";
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
  revalidatePath("/", "layout");
  redirect("/");
}

export async function loginAdminAction(formData: FormData): Promise<Resultado<void>> {
  try {
    const clave = String(formData.get("clave") ?? "").trim();
    if (!clave) throw new Error("La contraseña no puede estar vacía");
    
    const esValido = await loginAdmin(clave);
    if (!esValido) throw new Error("Contraseña incorrecta");
    
    revalidatePath("/", "layout");
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
    
    revalidatePath("/", "layout");
    return exito(undefined);
  } catch (e) {
    return fallo(mensajeDeError(e));
  }
}

export async function logoutAction(): Promise<void> {
  await cerrarSesion();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Cierra la sesión actual sin redirigir desde el servidor, permitiendo al
 * cliente ejecutar `window.location.replace("/")` para limpiar por completo
 * el historial de navegación (evita volver atrás con el gesto de swipe).
 */
export async function cerrarSesionClienteAction(): Promise<{ ok: boolean }> {
  await cerrarSesion();
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Verifica desde el cliente (por ejemplo al detectar el gesto de deslizar
 * hacia atrás o volver del BFCache en iOS) si la sesión sigue siendo válida
 * para este participante.
 */
export async function verificarSesionActivaAction(participanteId: string): Promise<boolean> {
  const sesion = await verificarSesionActual();
  if (!sesion) return false;
  if (sesion.rol === "admin") return true;
  return sesion.participanteId === participanteId;
}

