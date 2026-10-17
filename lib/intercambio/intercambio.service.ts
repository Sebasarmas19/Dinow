import { and, eq, inArray, or } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/lib/db";
import {
  asignaciones,
  criteriosDeber,
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

export type CriterioEfectivo = {
  id: string;
  descripcion: string;
  deberOriginalId: string;
  orden: number;
  puntos: string;
  esRecibidoPorIntercambio: boolean;
  intercambiadoConNombre?: string;
};

/**
 * Calcula la lista efectiva de criterios que un participante debe cumplir hoy
 * para su deber asignado, aplicando el "Principio de Equivalencia del Trueque":
 * - Quita los criterios propios que cedió a un hermano en un intercambio aceptado hoy.
 * - Agrega los criterios del deber del hermano que asumió en ese intercambio aceptado.
 */
export async function obtenerCriteriosEfectivosDeDeber(
  hogarId: string,
  fechaStr: string,
  deberId: string,
  participanteId: string,
): Promise<{
  efectivos: CriterioEfectivo[];
  cedidos: { id: string; descripcion: string; cedidoANombre?: string }[];
}> {
  const [todosCriterios, intercambiosAceptados, participantesHogar] =
    await Promise.all([
      db.select().from(criteriosDeber).orderBy(criteriosDeber.orden),
      db
        .select()
        .from(solicitudesIntercambio)
        .where(
          and(
            eq(solicitudesIntercambio.hogarId, hogarId),
            eq(solicitudesIntercambio.fecha, fechaStr),
            eq(solicitudesIntercambio.estado, "aceptada"),
          ),
        ),
      db
        .select()
        .from(participantes)
        .where(eq(participantes.hogarId, hogarId)),
    ]);

  const mapaNombres = new Map(participantesHogar.map((p) => [p.id, p.nombre]));
  const mapaCriterios = new Map(todosCriterios.map((c) => [c.id, c]));

  const criteriosOriginales = todosCriterios.filter(
    (c) => c.deberId === deberId,
  );

  const cedidosMap = new Map<string, string>(); // criterioId -> nombreHermano
  const recibidosList: CriterioEfectivo[] = [];

  for (const sol of intercambiosAceptados) {
    // Solo aplican los intercambios parciales de criterios (los totales ya cambiaron asignaciones.participanteId)
    if (!sol.criteriosSolicitanteIds || !sol.criteriosDestinatarioIds) continue;

    if (
      sol.solicitanteId === participanteId &&
      sol.deberSolicitanteId === deberId
    ) {
      const otroNombre = mapaNombres.get(sol.destinatarioId) || "Hermano";
      for (const cId of sol.criteriosSolicitanteIds) {
        cedidosMap.set(cId, otroNombre);
      }
      for (const cId of sol.criteriosDestinatarioIds) {
        const crit = mapaCriterios.get(cId);
        if (crit) {
          recibidosList.push({
            id: crit.id,
            descripcion: crit.descripcion,
            deberOriginalId: crit.deberId,
            orden: 100 + crit.orden,
            puntos: crit.puntos,
            esRecibidoPorIntercambio: true,
            intercambiadoConNombre: otroNombre,
          });
        }
      }
    } else if (
      sol.destinatarioId === participanteId &&
      sol.deberDestinatarioId === deberId
    ) {
      const otroNombre = mapaNombres.get(sol.solicitanteId) || "Hermano";
      for (const cId of sol.criteriosDestinatarioIds) {
        cedidosMap.set(cId, otroNombre);
      }
      for (const cId of sol.criteriosSolicitanteIds) {
        const crit = mapaCriterios.get(cId);
        if (crit) {
          recibidosList.push({
            id: crit.id,
            descripcion: crit.descripcion,
            deberOriginalId: crit.deberId,
            orden: 100 + crit.orden,
            puntos: crit.puntos,
            esRecibidoPorIntercambio: true,
            intercambiadoConNombre: otroNombre,
          });
        }
      }
    }
  }

  const efectivos: CriterioEfectivo[] = [];
  const cedidos: { id: string; descripcion: string; cedidoANombre?: string }[] =
    [];

  for (const c of criteriosOriginales) {
    if (cedidosMap.has(c.id)) {
      cedidos.push({
        id: c.id,
        descripcion: c.descripcion,
        cedidoANombre: cedidosMap.get(c.id),
      });
    } else {
      efectivos.push({
        id: c.id,
        descripcion: c.descripcion,
        deberOriginalId: c.deberId,
        orden: c.orden,
        puntos: c.puntos,
        esRecibidoPorIntercambio: false,
      });
    }
  }

  for (const rec of recibidosList) {
    if (!efectivos.some((e) => e.id === rec.id)) {
      efectivos.push(rec);
    }
  }

  return { efectivos, cedidos };
}

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
 * Envía una petición de intercambio 1 a 1 para hoy entre el solicitante y un hermano:
 * - Si no se pasan arrays de criterios (null/undefined), solicita intercambiar TODO el deber.
 * - Si se pasan `criteriosSolicitanteIds` y `criteriosDestinatarioIds`, solicita intercambiar
 *   esos criterios específicos (trueque parcial con equivalencia de 10 pts).
 */
export async function solicitarIntercambio(input: {
  solicitanteId: string;
  destinatarioId: string;
  criteriosSolicitanteIds?: string[] | null;
  criteriosDestinatarioIds?: string[] | null;
}): Promise<SolicitudIntercambio> {
  if (input.solicitanteId === input.destinatarioId) {
    throw new Error("No puedes intercambiar un deber contigo mismo.");
  }

  const hogarId = await obtenerHogarActualId();
  const fechaStr = formatearFechaISO(obtenerFechaDeNegocio());

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

  const esParcial =
    Array.isArray(input.criteriosSolicitanteIds) &&
    input.criteriosSolicitanteIds.length > 0 &&
    Array.isArray(input.criteriosDestinatarioIds) &&
    input.criteriosDestinatarioIds.length > 0;

  if (!esParcial) {
    // Intercambio del deber completo: requiere que ninguno haya empezado hoy
    if (registrosDeAmbos.length > 0) {
      throw new Error(
        "Ya hay avance en uno de los deberes. Elige qué criterios pendientes desean intercambiar.",
      );
    }
  } else {
    // Intercambio de criterios específicos: validar que ninguno de esos criterios esté ya hecho
    const criteriosYaHechos = new Set<string>();
    for (const r of registrosDeAmbos) {
      if (r.criteriosIds === null) {
        throw new Error(
          "Uno de los deberes ya fue marcado al 100% hoy y no admite intercambios.",
        );
      }
      r.criteriosIds.forEach((id) => criteriosYaHechos.add(id));
    }

    for (const id of [
      ...input.criteriosSolicitanteIds!,
      ...input.criteriosDestinatarioIds!,
    ]) {
      if (criteriosYaHechos.has(id)) {
        throw new Error(
          "Uno de los criterios seleccionados ya fue marcado como cumplido hoy.",
        );
      }
    }
  }

  // Cancelar cualquier solicitud pendiente anterior enviada hoy por el solicitante
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

  const [nueva] = await db
    .insert(solicitudesIntercambio)
    .values({
      hogarId,
      fecha: fechaStr,
      solicitanteId: input.solicitanteId,
      destinatarioId: input.destinatarioId,
      deberSolicitanteId: asigSolicitante.deber.id,
      deberDestinatarioId: asigDestinatario.deber.id,
      criteriosSolicitanteIds: esParcial ? input.criteriosSolicitanteIds : null,
      criteriosDestinatarioIds: esParcial ? input.criteriosDestinatarioIds : null,
      estado: "pendiente",
    })
    .returning();

  const [solicitante] = await db
    .select()
    .from(participantes)
    .where(eq(participantes.id, input.solicitanteId))
    .limit(1);

  if (solicitante) {
    const msg = esParcial
      ? `${solicitante.nombre} te propone intercambiar criterios entre ${asigSolicitante.deber.nombre} y ${asigDestinatario.deber.nombre} por hoy.`
      : `Te propone cambiar ${asigSolicitante.deber.nombre} por tu deber (${asigDestinatario.deber.nombre}) solo por hoy.`;

    await notificarPushParticipante(
      input.destinatarioId,
      `🔄 ${solicitante.nombre} quiere intercambiar hoy`,
      msg,
    );
  }

  return nueva;
}

/**
 * El destinatario acepta o rechaza una petición de intercambio pendiente.
 * - Si es intercambio total, intercambia participanteId en las asignaciones de HOY.
 * - Si es intercambio de criterios, queda registrado como 'aceptada' y transfiere
 *   esos criterios entre las listas efectivas del día de ambos hermanos.
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

  const esParcial =
    Array.isArray(solicitud.criteriosSolicitanteIds) &&
    solicitud.criteriosSolicitanteIds.length > 0 &&
    Array.isArray(solicitud.criteriosDestinatarioIds) &&
    solicitud.criteriosDestinatarioIds.length > 0;

  if (!esParcial) {
    // Intercambio total del deber
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
        "Uno de los deberes ya tiene avance hoy. Solicita un intercambio de los criterios restantes.",
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

    await db
      .update(asignaciones)
      .set({ participanteId: solicitud.destinatarioId })
      .where(eq(asignaciones.id, asigSolicitante.id));

    await db
      .update(asignaciones)
      .set({ participanteId: solicitud.solicitanteId })
      .where(eq(asignaciones.id, asigDestinatario.id));
  }

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

  if (destinatario) {
    await notificarPushParticipante(
      solicitud.solicitanteId,
      `✅ ¡${destinatario.nombre} aceptó el intercambio!`,
      esParcial
        ? `Quedaron intercambiados los criterios acordados por hoy. Cada uno gana sus +10 pts al completar su lista.`
        : `Se intercambiaron los deberes de hoy.`,
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
