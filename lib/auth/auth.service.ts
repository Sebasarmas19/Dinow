import { db } from "../db";
import { hogar, participantes, sesiones } from "../db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import crypto from "crypto";

// Clave secreta para cookies (usaremos CRON_SECRET como base si está disponible)
const SECRET_KEY = process.env.CRON_SECRET || "secreto_desarrollo_inseguro";

// Configuración de la cookie
const COOKIE_NAME = "auth_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 días

export type SesionUsuario = {
  rol: "admin" | "usuario";
  participanteId?: string;
};

// ── UTILIDADES DE ENCRIPTACIÓN ──────────────────────────────────────────────

/**
 * Hashea un texto en plano (contraseña o PIN) usando scrypt.
 */
export function hashClave(textoPlano: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(textoPlano, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

/**
 * Compara un texto en plano contra un hash previamente guardado.
 */
export function compararClave(textoPlano: string, hashGuardado: string): boolean {
  if (!hashGuardado || !hashGuardado.includes(":")) return false;
  const [salt, key] = hashGuardado.split(":");
  const derivedKey = crypto.scryptSync(textoPlano, salt, 64).toString("hex");
  const keyBuf = Buffer.from(key, "hex");
  const derivedBuf = Buffer.from(derivedKey, "hex");
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

// ── MANEJO DE SESIONES ──────────────────────────────────────────────────────

export async function crearYGuardarSesion(datos: SesionUsuario): Promise<void> {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiraEn = new Date(Date.now() + SESSION_MAX_AGE);

  // Guardar en base de datos
  await db.insert(sesiones).values({
    id: sessionId,
    rol: datos.rol,
    participanteId: datos.participanteId,
    expiraEn,
  });

  // Guardar cookie de sesión
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE / 1000,
    expires: expiraEn,
  });

  // Garantizar que este dispositivo también tenga la autorización del hogar
  await garantizarHogarCookie();
}

export async function loginAdmin(claveIngresada: string): Promise<boolean> {
  const [hogarActual] = await db.select().from(hogar).limit(1);
  if (!hogarActual) return false;

  // Si la clave guardada no tiene el formato de hash (ej. antigua en plano), migrarla al vuelo (temporalmente)
  let esValida = false;
  if (!hogarActual.claveAdmin.includes(":")) {
    esValida = hogarActual.claveAdmin === claveIngresada;
    if (esValida) {
      // Migrarla a hash
      await db.update(hogar).set({ claveAdmin: hashClave(claveIngresada) }).where(eq(hogar.id, hogarActual.id));
    }
  } else {
    esValida = compararClave(claveIngresada, hogarActual.claveAdmin);
  }

  if (esValida) {
    await crearYGuardarSesion({ rol: "admin" });
    return true;
  }
  return false;
}

export async function loginParticipante(participanteId: string, pinIngresado: string): Promise<boolean> {
  const [participante] = await db.select().from(participantes).where(eq(participantes.id, participanteId));
  if (!participante || !participante.pinHash) throw new Error("Perfil no configurado");

  // 1. Verificar si está bloqueado por demasiados intentos erróneos
  if (participante.bloqueadoHasta && participante.bloqueadoHasta.getTime() > Date.now()) {
    const minutosRestantes = Math.ceil((participante.bloqueadoHasta.getTime() - Date.now()) / 60000);
    throw new Error(`Perfil bloqueado por seguridad. Intenta de nuevo en ${minutosRestantes} minutos.`);
  }

  // 2. Comparar PIN
  const esValida = compararClave(pinIngresado, participante.pinHash);

  if (!esValida) {
    const fallosActuales = (participante.intentosFallidos || 0) + 1;
    let bloqueo: Date | null = null;

    if (fallosActuales >= 5) {
      bloqueo = new Date(Date.now() + 15 * 60 * 1000); // Bloqueo de 15 minutos
      await db
        .update(participantes)
        .set({ intentosFallidos: 0, bloqueadoHasta: bloqueo })
        .where(eq(participantes.id, participanteId));
      throw new Error("Has superado 5 intentos fallidos. Perfil bloqueado por 15 minutos.");
    } else {
      await db
        .update(participantes)
        .set({ intentosFallidos: fallosActuales })
        .where(eq(participantes.id, participanteId));
      throw new Error(`PIN incorrecto. Te quedan ${5 - fallosActuales} intentos.`);
    }
  }

  // 3. PIN correcto: reiniciar contador de fallos y desbloquear
  await db
    .update(participantes)
    .set({ intentosFallidos: 0, bloqueadoHasta: null })
    .where(eq(participantes.id, participanteId));

  await crearYGuardarSesion({ rol: "usuario", participanteId });
  return true;
}

/**
 * Lee la cookie, busca la sesión en DB y verifica que no esté expirada.
 * Si todo es correcto, devuelve la sesión. Si no, retorna null.
 */
export async function verificarSesionActual(): Promise<SesionUsuario | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const [sesionActiva] = await db.select().from(sesiones).where(eq(sesiones.id, sessionId));
  if (!sesionActiva) return null;

  // Verificar expiración
  if (sesionActiva.expiraEn.getTime() < Date.now()) {
    await cerrarSesion();
    return null;
  }

  return {
    rol: sesionActiva.rol as "admin" | "usuario",
    participanteId: sesionActiva.participanteId || undefined,
  };
}

export async function cerrarSesion(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (sessionId) {
    await db.delete(sesiones).where(eq(sesiones.id, sessionId));
  }
  cookieStore.delete(COOKIE_NAME);
}

// ── PUERTA DE ACCESO AL HOGAR (HOUSEHOLD GATE) ──────────────────────────────
const HOGAR_COOKIE_NAME = "dinow_hogar_autorizado";
const HOGAR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 año

export async function verificarHogarAutorizado(): Promise<boolean> {
  const cookieStore = await cookies();
  const hogarIdCookie = cookieStore.get(HOGAR_COOKIE_NAME)?.value;
  if (!hogarIdCookie) return false;

  const [h] = await db.select({ id: hogar.id }).from(hogar).where(eq(hogar.id, hogarIdCookie)).limit(1);
  return !!h;
}

export async function garantizarHogarCookie(): Promise<void> {
  const [hogarActual] = await db.select({ id: hogar.id }).from(hogar).limit(1);
  if (!hogarActual) return;
  const cookieStore = await cookies();
  const actual = cookieStore.get(HOGAR_COOKIE_NAME)?.value;
  if (!actual) {
    const expiraEn = new Date(Date.now() + HOGAR_COOKIE_MAX_AGE * 1000);
    cookieStore.set(HOGAR_COOKIE_NAME, hogarActual.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: HOGAR_COOKIE_MAX_AGE,
      expires: expiraEn,
    });
  }
}

export async function autorizarHogar(codigoIngresado: string): Promise<boolean> {
  const [hogarActual] = await db.select().from(hogar).limit(1);
  if (!hogarActual) return false;

  const codigoGuardado = hogarActual.codigoAcceso || "armas2026";
  if (codigoIngresado.trim().toLowerCase() === codigoGuardado.trim().toLowerCase()) {
    const cookieStore = await cookies();
    const expiraEn = new Date(Date.now() + HOGAR_COOKIE_MAX_AGE * 1000);
    cookieStore.set(HOGAR_COOKIE_NAME, hogarActual.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: HOGAR_COOKIE_MAX_AGE,
      expires: expiraEn,
    });
    return true;
  }
  return false;
}

export async function desautorizarHogar(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(HOGAR_COOKIE_NAME);
}

