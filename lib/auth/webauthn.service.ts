import { headers, cookies } from "next/headers";
import { db } from "@/lib/db";
import { credencialesBiometricas, participantes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { crearYGuardarSesion } from "./auth.service";

const CHALLENGE_COOKIE = "dinow_webauthn_challenge";

export async function getWebAuthnConfig() {
  const headerStore = await headers();
  const host = headerStore.get("host") || "dinow-ashy.vercel.app";
  const rpID = host.split(":")[0];
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const origin = `${proto}://${host}`;
  return { rpID, origin, rpName: "Dinow" };
}

async function guardarChallenge(challenge: string, accion: "registro" | "login", participanteId?: string) {
  const cookieStore = await cookies();
  const data = JSON.stringify({
    challenge,
    accion,
    participanteId,
    expiraEn: Date.now() + 5 * 60 * 1000,
  });
  cookieStore.set(CHALLENGE_COOKIE, data, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
}

async function obtenerChallenge(): Promise<{ challenge: string; accion: string; participanteId?: string } | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CHALLENGE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data.expiraEn < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

async function borrarChallenge() {
  const cookieStore = await cookies();
  cookieStore.delete(CHALLENGE_COOKIE);
}

// ── REGISTRO (ENROLLMENT) DE FACE ID ────────────────────────────────────────

export async function generarOpcionesRegistroService(participanteId: string) {
  const [part] = await db.select().from(participantes).where(eq(participantes.id, participanteId));
  if (!part) throw new Error("Participante no encontrado");

  const { rpID, rpName } = await getWebAuthnConfig();

  // Obtener credenciales existentes del participante para excluirlas y no registrar dos veces el mismo hardware
  const creds = await db
    .select({ id: credencialesBiometricas.id })
    .from(credencialesBiometricas)
    .where(eq(credencialesBiometricas.participanteId, participanteId));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(part.id),
    userName: part.nombre,
    userDisplayName: part.nombre,
    attestationType: "none",
    excludeCredentials: creds.map((c) => ({
      id: c.id,
      transports: ["internal", "hybrid"] as any,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
      authenticatorAttachment: "platform", // Fuerza Face ID / Touch ID / Windows Hello nativo
    },
  });

  await guardarChallenge(options.challenge, "registro", participanteId);
  return options;
}

export async function verificarRegistroService(
  participanteId: string,
  response: RegistrationResponseJSON,
  dispositivoNombre?: string
) {
  const challengeData = await obtenerChallenge();
  if (!challengeData || challengeData.accion !== "registro" || challengeData.participanteId !== participanteId) {
    throw new Error("El desafío de autenticación expiró. Intenta de nuevo.");
  }

  const { rpID, origin } = await getWebAuthnConfig();

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeData.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("No se pudo verificar la huella o Face ID.");
  }

  const { credential } = verification.registrationInfo;

  // Guardar en la base de datos
  const publicKeyStr = Buffer.from(credential.publicKey).toString("base64url");
  const transports = response.response.transports || ["internal"];

  await db.insert(credencialesBiometricas).values({
    id: credential.id,
    participanteId,
    publicKey: publicKeyStr,
    counter: credential.counter,
    transports: transports as any,
    dispositivoNombre: dispositivoNombre || "Face ID / Dispositivo",
  });

  await borrarChallenge();
  return { ok: true };
}

// ── AUTENTICACIÓN (LOGIN) CON FACE ID ───────────────────────────────────────

export async function generarOpcionesLoginService(participanteId?: string) {
  const { rpID } = await getWebAuthnConfig();

  let allowCredentials: any[] | undefined = undefined;

  if (participanteId) {
    const creds = await db
      .select({ id: credencialesBiometricas.id, transports: credencialesBiometricas.transports })
      .from(credencialesBiometricas)
      .where(eq(credencialesBiometricas.participanteId, participanteId));

    if (creds.length > 0) {
      allowCredentials = creds.map((c) => ({
        id: c.id,
        transports: (c.transports as any) || ["internal"],
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "required",
  });

  await guardarChallenge(options.challenge, "login", participanteId);
  return options;
}

export async function verificarLoginService(response: AuthenticationResponseJSON) {
  const challengeData = await obtenerChallenge();
  if (!challengeData || challengeData.accion !== "login") {
    throw new Error("El intento de acceso expiró. Intenta de nuevo.");
  }

  const [cred] = await db
    .select()
    .from(credencialesBiometricas)
    .where(eq(credencialesBiometricas.id, response.id));

  if (!cred) {
    throw new Error("Dispositivo o Face ID no reconocido en este hogar.");
  }

  const { rpID, origin } = await getWebAuthnConfig();
  const publicKeyUint8 = new Uint8Array(Buffer.from(cred.publicKey, "base64url"));

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeData.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: cred.id,
      publicKey: publicKeyUint8,
      counter: cred.counter,
      transports: (cred.transports as any) || ["internal"],
    },
  });

  if (!verification.verified) {
    throw new Error("Verificación biométrica fallida.");
  }

  // Actualizar contador
  await db
    .update(credencialesBiometricas)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(credencialesBiometricas.id, cred.id));

  await borrarChallenge();

  // Iniciar sesión
  await crearYGuardarSesion({
    rol: "usuario",
    participanteId: cred.participanteId,
  });

  return { ok: true, participanteId: cred.participanteId };
}

// ── CONSULTAS AUXILIARES ────────────────────────────────────────────────────

export async function listarBiometriasDeParticipante(participanteId: string) {
  return db
    .select({
      id: credencialesBiometricas.id,
      dispositivoNombre: credencialesBiometricas.dispositivoNombre,
      creadoEn: credencialesBiometricas.creadoEn,
    })
    .from(credencialesBiometricas)
    .where(eq(credencialesBiometricas.participanteId, participanteId));
}

export async function eliminarBiometria(credentialId: string, participanteId: string) {
  await db
    .delete(credencialesBiometricas)
    .where(
      and(
        eq(credencialesBiometricas.id, credentialId),
        eq(credencialesBiometricas.participanteId, participanteId)
      )
    );
  return { ok: true };
}
