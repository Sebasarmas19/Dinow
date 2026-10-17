import { and, eq, inArray, or } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/lib/db";
import {
  asignaciones,
  deberes,
  participantes,
  registros,
  solicitudesIntercambio,
  suscripcionesPush,
} from "@/lib/db/schema";
import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { formatearFechaISO, obtenerFechaDeNegocio } from "@/lib/shared/date";

webpush.setVapidDetails(
  "mailto:soporte@dinow.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || "",
);

export type SolicitudIntercambio = typeof solicitudesIntercambio.$inferSelect;

async function notificarPushParticipante(
  participanteId: string,
  title: string,
  body: string,
) {
  try {
    const subs = await db
      .select()
      .from(suscripcionesPush)
      .where(eq(suscripcionesPush.participanteId, participanteId));

    const envios = subs.map((sub) =>
      webpush
        .sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title, body, url: `/${participanteId}` }),
        )
        .catch(() => null),
    );
    await Promise.all(envios);
  } catch {
    // Ignorar fallos de push para no bloquear la operación principal
  }
}

/**
 * Envía una petición de intercambio 1 a 1 del deber rotativo obligatorio de hoy
 * entre el solicitante y un hermano destinatario.
 */
export async function solicitarIntercambio(input: {
  solicitanteId: string;
  destinatarioId: string;
}): Promise<SolicitudIntercambio> {
  if (input.solicitanteId === input.destinatarioId) {
    throw new Error("No puedes intercambiar un deber contigo mismo.");
  }

  const hogarId = await obtenerHogarActualId();
  const fechaStr = formatearFechaISO(obtenerFechaDeNegocio());

  // 1. Buscar las asignaciones obligatorias rotativas de ambos para hoy
  const asignacionesHoy = await db
    .select({ asignacion: asignaciones, deber: deberes })
    .from(asignaciones)
    .innerJoin(deberes, eq(asignaciones.deberId, deberes.id))
    .where(
      and(
        eq(asignaciones.hogarId, hogarId),
        eq(asignaciones.fecha, fechaStr),
        eq(deberes.tipoAsignacion, "rotativo"),
        eq(deberes.esPersonal, false),
        eq(deberes.activo, true),
      ),
    );

  const asigSolicitante = asignacionesHoy.find(
    (a) => a.asignacion.participanteId === input.solicitanteId,
  );
  const asigDestinatario = asignacionesHoy.find(
    (a) => a.asignacion.participanteId === input.destinatarioId,
  );

  if (!asigSolicitante) {
    throw new Error("No tienes un deber rotativo asignado hoy para intercambiar.");
  }
  if (!asigDestinatario) {
    throw new Error("Tu hermano no tiene un deber rotativo asignado hoy.");
  }

  // 2. Verificar que ninguno de los dos deberes tenga progreso o cobertura hoy
  const registrosDeAmbos = await db
    .select()
    .from(registros)
    .where(
      and(
        eq(registros.hogarId, hogarId),
        eq(registros.fecha, fechaStr),
        inArray(registros.deberId, [
          asigSolicitante.deber.id,
          asigDestinatario.deber.id,
        ]),
      ),
    );

  if (registrosDeAmbos.length > 0) {
    throw new Error(
      "Solo se pueden intercambiar deberes que aún no hayan sido empezados ni cubiertos hoy.",
    );
  }

  // 3. Cancelar cualquier solicitud pendiente anterior enviada hoy por el solicitante
  await db
    .update(solicitudesIntercambio)
    .set({ estado: "cancelada", respondidoEn: new Date() })
    .where(
      and(
        eq(solicitudesIntercambio.hogarId, hogarId),
        eq(solicitudesIntercambio.fecha, fechaStr),
        eq(solicitudesIntercambio.solicitanteId, input.solicitanteId),
        eq(solicitudesIntercambio.estado, "pendiente"),
      ),
    );

  // 4. Crear la nueva solicitud pendiente
  const [nueva] = await db
    .insert(solicitudesIntercambio)
    .values({
      hogarId,
      fecha: fechaStr,
      solicitanteId: input.solicitanteId,
      destinatarioId: input.destinatarioId,
      deberSolicitanteId: asigSolicitante.deber.id,
      deberDestinatarioId: asigDestinatario.deber.id,
      estado: "pendiente",
    })
    .returning();

  // 5. Notificar por Push al hermano destinatario
  const [solicitante] = await db
    .select()
    .from(participantes)
    .where(eq(participantes.id, input.solicitanteId))
    .limit(1);

  if (solicitante) {
    await notificarPushParticipante(
      input.destinatarioId,
      `🔄 ${solicitante.nombre} quiere intercambiar deber hoy`,
      `Te propone cambiar ${asigSolicitante.deber.nombre} por tu deber (${asigDestinatario.deber.nombre}) solo por hoy.`,
    );
  }

  return nueva;
}

/**
 * El destinatario acepta o rechaza una petición de intercambio pendiente.
 * Si acepta, se intercambian los participante_id en las asignaciones de HOY.
 */
export async function responderIntercambio(input: {
  solicitudId: string;
  participanteId: string;
  aceptar: boolean;
}): Promise<SolicitudIntercambio> {
  const fechaStr = formatearFechaISO(obtenerFechaDeNegocio());

  const [solicitud] = await db
    .select()
    .from(solicitudesIntercambio)
    .where(eq(solicitudesIntercambio.id, input.solicitudId))
    .limit(1);

  if (!solicitud) throw new Error("La solicitud de intercambio no existe.");
  if (solicitud.estado !== "pendiente") {
    throw new Error("Esta solicitud ya fue respondida o cancelada.");
  }
  if (solicitud.fecha !== fechaStr) {
    throw new Error("Esta solicitud corresponde a un día anterior.");
  }
  if (solicitud.destinatarioId !== input.participanteId) {
    throw new Error("Solo el destinatario puede responder esta solicitud.");
  }

  const [destinatario] = await db
    .select()
    .from(participantes)
    .where(eq(participantes.id, input.participanteId))
    .limit(1);

  if (!input.aceptar) {
    const [rechazada] = await db
      .update(solicitudesIntercambio)
      .set({ estado: "rechazada", respondidoEn: new Date() })
      .where(eq(solicitudesIntercambio.id, solicitud.id))
      .returning();

    if (destinatario) {
      await notificarPushParticipante(
        solicitud.solicitanteId,
        "Intercambio no realizado",
        `${destinatario.nombre} prefirió mantener su deber de hoy.`,
      );
    }

    return rechazada;
  }

  // Si acepta, validar que ninguno de los dos deberes haya tenido avance mientras tanto
  const registrosDeAmbos = await db
    .select()
    .from(registros)
    .where(
      and(
        eq(registros.hogarId, solicitud.hogarId),
        eq(registros.fecha, fechaStr),
        inArray(registros.deberId, [
          solicitud.deberSolicitanteId,
          solicitud.deberDestinatarioId,
        ]),
      ),
    );

  if (registrosDeAmbos.length > 0) {
    throw new Error(
      "No se puede completar el intercambio porque uno de los deberes ya tiene criterios cumplidos hoy.",
    );
  }

  const asignacionesAmbos = await db
    .select()
    .from(asignaciones)
    .where(
      and(
        eq(asignaciones.hogarId, solicitud.hogarId),
        eq(asignaciones.fecha, fechaStr),
        inArray(asignaciones.deberId, [
          solicitud.deberSolicitanteId,
          solicitud.deberDestinatarioId,
        ]),
      ),
    );

  const asigSolicitante = asignacionesAmbos.find(
    (a) =>
      a.deberId === solicitud.deberSolicitanteId &&
      a.participanteId === solicitud.solicitanteId,
  );
  const asigDestinatario = asignacionesAmbos.find(
    (a) =>
      a.deberId === solicitud.deberDestinatarioId &&
      a.participanteId === solicitud.destinatarioId,
  );

  if (!asigSolicitante || !asigDestinatario) {
    throw new Error("Las asignaciones de hoy cambiaron y ya no coinciden.");
  }

  // Intercambiar participanteId en ambas asignaciones de HOY
  await db
    .update(asignaciones)
    .set({ participanteId: solicitud.destinatarioId })
    .where(eq(asignaciones.id, asigSolicitante.id));

  await db
    .update(asignaciones)
    .set({ participanteId: solicitud.solicitanteId })
    .where(eq(asignaciones.id, asigDestinatario.id));

  const [aceptada] = await db
    .update(solicitudesIntercambio)
    .set({ estado: "aceptada", respondidoEn: new Date() })
    .where(eq(solicitudesIntercambio.id, solicitud.id))
    .returning();

  // Cancelar otras solicitudes pendientes de hoy que involucren a cualquiera de los dos
  await db
    .update(solicitudesIntercambio)
    .set({ estado: "cancelada", respondidoEn: new Date() })
    .where(
      and(
        eq(solicitudesIntercambio.hogarId, solicitud.hogarId),
        eq(solicitudesIntercambio.fecha, fechaStr),
        eq(solicitudesIntercambio.estado, "pendiente"),
        or(
          eq(solicitudesIntercambio.solicitanteId, solicitud.solicitanteId),
          eq(solicitudesIntercambio.destinatarioId, solicitud.solicitanteId),
          eq(solicitudesIntercambio.solicitanteId, solicitud.destinatarioId),
          eq(solicitudesIntercambio.destinatarioId, solicitud.destinatarioId),
        ),
      ),
    );

  const [deberNuevoSolicitante] = await db
    .select()
    .from(deberes)
    .where(eq(deberes.id, solicitud.deberDestinatarioId))
    .limit(1);

  if (destinatario && deberNuevoSolicitante) {
    await notificarPushParticipante(
      solicitud.solicitanteId,
      `✅ ¡${destinatario.nombre} aceptó el intercambio!`,
      `Hoy te encargas de ${deberNuevoSolicitante.nombre} y ${destinatario.nombre} hace el tuyo.`,
    );
  }

  return aceptada;
}

/** Cancela una solicitud pendiente enviada por el propio solicitante. */
export async function cancelarIntercambio(input: {
  solicitudId: string;
  solicitanteId: string;
}): Promise<SolicitudIntercambio> {
  const [solicitud] = await db
    .select()
    .from(solicitudesIntercambio)
    .where(eq(solicitudesIntercambio.id, input.solicitudId))
    .limit(1);

  if (!solicitud) throw new Error("La solicitud no existe.");
  if (solicitud.solicitanteId !== input.solicitanteId) {
    throw new Error("Solo quien envió la solicitud puede cancelarla.");
  }
  if (solicitud.estado !== "pendiente") {
    throw new Error("La solicitud ya no está pendiente.");
  }

  const [cancelada] = await db
    .update(solicitudesIntercambio)
    .set({ estado: "cancelada", respondidoEn: new Date() })
    .where(eq(solicitudesIntercambio.id, solicitud.id))
    .returning();

  return cancelada;
}
