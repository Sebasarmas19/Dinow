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

async function crearYGuardarSesion(datos: SesionUsuario): Promise<void> {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiraEn = new Date(Date.now() + SESSION_MAX_AGE);

  // Guardar en base de datos
  await db.insert(sesiones).values({
    id: sessionId,
    rol: datos.rol,
    participanteId: datos.participanteId,
    expiraEn,
  });

  // Guardar cookie
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE / 1000,
  });
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
  if (!participante || !participante.pinHash) return false;

  const esValida = compararClave(pinIngresado, participante.pinHash);
  if (esValida) {
    await crearYGuardarSesion({ rol: "usuario", participanteId });
    return true;
  }
  return false;
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
