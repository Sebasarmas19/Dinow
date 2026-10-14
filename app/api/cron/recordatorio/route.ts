import { db } from "@/lib/db";
import {
  asignaciones,
  deberes,
  participantes,
  suscripcionesPush,
  registros,
  planSemanal,
} from "@/lib/db/schema";
import {
  obtenerFechaDeNegocio,
  formatearFechaISO,
  sumarDias,
} from "@/lib/shared/date";
import { eq, and, sql } from "drizzle-orm";
import webpush from "web-push";

// Configurar web-push
webpush.setVapidDetails(
  "mailto:soporte@dinow.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint de recordatorios y notificaciones automáticas.
 *
 * Soporta 5 franjas horarias optimizadas para la Familia Armas:
 * 1. manana        (6:30 AM Caracas / 10:30 UTC): Buenos días + Misión asignada hoy
 * 2. almuerzo      (1:30 PM Caracas / 17:30 UTC): Fregado/Cocina del almuerzo
 * 3. tarde         (6:00 PM Caracas / 22:00 UTC): Tarde en casa (Paseo de Sofi / Pendientes)
 * 4. anticipacion  (8:30 PM Caracas / 00:30 UTC): Plan de mañana (para preparar viandas/descongelar)
 * 5. alerta_cierre (9:30 PM Caracas / 01:30 UTC): ⚠️ Alerta de penalización colectiva si faltan deberes
 *
 * Puede llamarse con ?slot=manana | almuerzo | tarde | anticipacion | alerta_cierre
 * o dejar que detecte automáticamente el horario UTC actual.
 */
export async function GET(request: Request) {
  // Verificar secreto de autenticación
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("No autorizado", { status: 401 });
  }

  try {
    const hoy = obtenerFechaDeNegocio();
    const fechaHoyStr = formatearFechaISO(hoy);

    const url = new URL(request.url);
    const paramSlot = url.searchParams.get("slot");

    // Detectar franja horaria (slot)
    let slot = paramSlot;
    const utcHour = new Date().getUTCHours();

    if (!slot) {
      if (utcHour >= 9 && utcHour <= 12) {
        slot = "manana";
      } else if (utcHour >= 16 && utcHour <= 18) {
        slot = "almuerzo";
      } else if (utcHour >= 21 && utcHour <= 23) {
        slot = "tarde";
      } else if (utcHour === 0) {
        slot = "anticipacion";
      } else if (utcHour >= 1 && utcHour <= 3) {
        slot = "alerta_cierre";
      } else {
        slot = "anticipacion"; // Fallback por defecto
      }
    }

    // Obtener suscripciones push únicas por participante y endpoint
    const todasLasSuscripciones = await db.select().from(suscripcionesPush);
    const subsUnicas = new Map<string, (typeof todasLasSuscripciones)[0]>();
    for (const sub of todasLasSuscripciones) {
      const key = `${sub.participanteId}-${sub.endpoint}`;
      subsUnicas.set(key, sub);
    }
    const suscripcionesValidas = Array.from(subsUnicas.values());

    const envios: Promise<any>[] = [];

    // ──────────────────────────────────────────────────────────────────────────
    // 1. SLOT MAÑANA (6:30 AM Caracas) - Buenos días + Misión asignada
    // ──────────────────────────────────────────────────────────────────────────
    if (slot === "manana") {
      const asignacionesHoy = await db
        .select({
          participanteNombre: participantes.nombre,
          participanteId: participantes.id,
          deberNombre: deberes.nombre,
          esPersonal: deberes.esPersonal,
        })
        .from(asignaciones)
        .innerJoin(deberes, eq(asignaciones.deberId, deberes.id))
        .innerJoin(
          participantes,
          eq(asignaciones.participanteId, participantes.id)
        )
        .where(
          and(
            eq(asignaciones.fecha, fechaHoyStr),
            eq(deberes.tipoAsignacion, "rotativo"),
            eq(deberes.activo, true)
          )
        );

      for (const sub of suscripcionesValidas) {
        const suAsignacion = asignacionesHoy.find(
          (a) => a.participanteId === sub.participanteId && !a.esPersonal
        );
        if (suAsignacion) {
          envios.push(
            enviarPush(
              sub,
              `¡Buenos días, ${suAsignacion.participanteNombre}! ☀️`,
              `Hoy tu misión principal es: ${suAsignacion.deberNombre}. ¡Que tengas un excelente día!`,
              `/${sub.participanteId}`
            )
          );
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. SLOT ALMUERZO (1:30 PM Caracas) - Fregado / Cocina de mediodía
    // ──────────────────────────────────────────────────────────────────────────
    if (slot === "almuerzo") {
      const asignacionesHoy = await db
        .select({
          participanteNombre: participantes.nombre,
          participanteId: participantes.id,
          deberNombre: deberes.nombre,
          deberId: deberes.id,
        })
        .from(asignaciones)
        .innerJoin(deberes, eq(asignaciones.deberId, deberes.id))
        .innerJoin(
          participantes,
          eq(asignaciones.participanteId, participantes.id)
        )
        .where(
          and(
            eq(asignaciones.fecha, fechaHoyStr),
            eq(deberes.activo, true),
            sql`LOWER(${deberes.nombre}) LIKE '%cocin%' OR LOWER(${deberes.nombre}) LIKE '%freg%'`
          )
        );

      const registrosHoy = await db
        .select()
        .from(registros)
        .where(
          and(
            eq(registros.fecha, fechaHoyStr),
            eq(registros.estado, "cumplido_propio")
          )
        );

      for (const asig of asignacionesHoy) {
        const yaCumplido = registrosHoy.some(
          (r) => r.participanteId === asig.participanteId && r.deberId === asig.deberId
        );
        if (!yaCumplido) {
          const subsDeEsteUsuario = suscripcionesValidas.filter(
            (s) => s.participanteId === asig.participanteId
          );
          for (const sub of subsDeEsteUsuario) {
            envios.push(
              enviarPush(
                sub,
                `¡Hola ${asig.participanteNombre}! 🍽️ Cocina de hoy`,
                `Recuerda dejar la cocina y los platos al día después del almuerzo.`,
                `/${asig.participanteId}`
              )
            );
          }
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. SLOT TARDE (6:00 PM Caracas) - Regreso a casa / Paseo de Sofi / Pendientes
    // ──────────────────────────────────────────────────────────────────────────
    if (slot === "tarde") {
      const asignacionesHoy = await db
        .select({
          participanteNombre: participantes.nombre,
          participanteId: participantes.id,
          deberNombre: deberes.nombre,
          deberId: deberes.id,
        })
        .from(asignaciones)
        .innerJoin(deberes, eq(asignaciones.deberId, deberes.id))
        .innerJoin(
          participantes,
          eq(asignaciones.participanteId, participantes.id)
        )
        .where(
          and(
            eq(asignaciones.fecha, fechaHoyStr),
            eq(deberes.esObligatorio, true),
            eq(deberes.activo, true)
          )
        );

      const registrosHoy = await db
        .select()
        .from(registros)
        .where(
          and(
            eq(registros.fecha, fechaHoyStr),
            eq(registros.estado, "cumplido_propio")
          )
        );

      const pendientesPorUsuario = new Map<string, typeof asignacionesHoy>();

      for (const asig of asignacionesHoy) {
        const yaCumplido = registrosHoy.some(
          (r) => r.participanteId === asig.participanteId && r.deberId === asig.deberId
        );
        if (!yaCumplido) {
          const list = pendientesPorUsuario.get(asig.participanteId) || [];
          list.push(asig);
          pendientesPorUsuario.set(asig.participanteId, list);
        }
      }

      for (const sub of suscripcionesValidas) {
        const pendientes = pendientesPorUsuario.get(sub.participanteId);
        if (pendientes && pendientes.length > 0) {
          const partNombre = pendientes[0].participanteNombre;
          const nombres = pendientes.map((p) => p.deberNombre).join(", ");
          envios.push(
            enviarPush(
              sub,
              `¡Hola ${partNombre}! 🐕 Tarde en casa`,
              `Tienes pendiente hoy: ${nombres}. ¡Aprovecha la tarde para marcarlo!`,
              `/${sub.participanteId}`
            )
          );
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. SLOT ANTICIPACIÓN (8:30 PM Caracas) - Plan de mañana para organizarse
    // ──────────────────────────────────────────────────────────────────────────
    if (slot === "anticipacion") {
      const manana = sumarDias(hoy, 1);
      const fechaMananaStr = formatearFechaISO(manana);
      const diaMananaInt = manana.getDay();

      const asignacionesManana = await db
        .select({
          participanteId: asignaciones.participanteId,
          participanteNombre: participantes.nombre,
          deberNombre: deberes.nombre,
          deberPuntos: deberes.puntos,
        })
        .from(asignaciones)
        .innerJoin(deberes, eq(asignaciones.deberId, deberes.id))
        .innerJoin(
          participantes,
          eq(asignaciones.participanteId, participantes.id)
        )
        .where(
          and(
            eq(asignaciones.fecha, fechaMananaStr),
            eq(deberes.esObligatorio, true),
            eq(deberes.activo, true)
          )
        );

      for (const sub of suscripcionesValidas) {
        let suAsignacion = asignacionesManana.find(
          (a) => a.participanteId === sub.participanteId
        );

        // Fallback a matriz de plan_semanal si aún no se han persistido las asignaciones de mañana
        if (!suAsignacion) {
          const [desdePlan] = await db
            .select({
              participanteId: planSemanal.participanteId,
              participanteNombre: participantes.nombre,
              deberNombre: deberes.nombre,
              deberPuntos: deberes.puntos,
            })
            .from(planSemanal)
            .innerJoin(deberes, eq(planSemanal.deberId, deberes.id))
            .innerJoin(
              participantes,
              eq(planSemanal.participanteId, participantes.id)
            )
            .where(
              and(
                eq(planSemanal.participanteId, sub.participanteId),
                eq(planSemanal.diaSemana, diaMananaInt),
                eq(deberes.activo, true)
              )
            );
          if (desdePlan) {
            suAsignacion = desdePlan;
          }
        }

        if (suAsignacion) {
          envios.push(
            enviarPush(
              sub,
              `¡Hola ${suAsignacion.participanteNombre}! 🔮 Plan de mañana`,
              `Mañana te toca: ${suAsignacion.deberNombre} (+${suAsignacion.deberPuntos} pts). ¡Tenlo en cuenta para organizarte!`,
              `/${sub.participanteId}`
            )
          );
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. SLOT ALERTA DE CIERRE (9:30 PM Caracas) - ⚠️ Advertencia penalización
    // ──────────────────────────────────────────────────────────────────────────
    if (slot === "alerta_cierre") {
      const deberesObligatoriosHoy = await db
        .select({
          deberId: deberes.id,
          deberNombre: deberes.nombre,
          participanteNombre: participantes.nombre,
        })
        .from(asignaciones)
        .innerJoin(deberes, eq(asignaciones.deberId, deberes.id))
        .innerJoin(
          participantes,
          eq(asignaciones.participanteId, participantes.id)
        )
        .where(
          and(
            eq(asignaciones.fecha, fechaHoyStr),
            eq(deberes.esObligatorio, true),
            eq(deberes.activo, true)
          )
        );

      const registrosHoy = await db
        .select()
        .from(registros)
        .where(
          and(
            eq(registros.fecha, fechaHoyStr),
            eq(registros.estado, "cumplido_propio")
          )
        );

      const noCumplidos = deberesObligatoriosHoy.filter(
        (asig) => !registrosHoy.some((r) => r.deberId === asig.deberId)
      );

      // SOLO si quedan tareas obligatorias sin hacer, alertamos a todos los hermanos
      if (noCumplidos.length > 0) {
        const nombresFaltantes = Array.from(
          new Set(noCumplidos.map((d) => d.deberNombre))
        ).join(", ");

        for (const sub of suscripcionesValidas) {
          envios.push(
            enviarPush(
              sub,
              `⚠️ ¡Atención hogar! Tareas pendientes`,
              `Quedan deberes obligatorios sin hacer hoy (${nombresFaltantes}). ¡Eviten la penalización de -10 pts antes de las 3:00 AM!`,
              `/${sub.participanteId}`
            )
          );
        }
      }
    }

    await Promise.all(envios);

    return Response.json({
      success: true,
      slotEjecutado: slot,
      notificacionesEnviadas: envios.length,
      horaUtc: utcHour,
    });
  } catch (error) {
    console.error("Error en recordatorio cron:", error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}

function enviarPush(sub: any, title: string, body: string, url: string) {
  const payload = JSON.stringify({ title, body, url });
  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };
  return webpush.sendNotification(pushSubscription, payload).catch((err) => {
    console.error("Fallo enviando push a", sub.endpoint, err.message);
  });
}
