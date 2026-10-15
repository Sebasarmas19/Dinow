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
 * Soporta 4 franjas horarias optimizadas para la Familia Armas:
 * 1. manana        (6:30 AM Caracas): Buenos días + Misión asignada hoy
 * 2. tarde         (6:30 PM Caracas): Tarde en casa (Paseo de Sofi / Pendientes)
 * 3. anticipacion  (8:30 PM Caracas): Plan de mañana (para preparar viandas/descongelar)
 * 4. alerta_cierre (9:30 PM Caracas): ⚠️ Alerta de penalización preventiva si faltan deberes
 *
 * Puede llamarse con ?slot=manana | tarde | anticipacion | alerta_cierre
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
    
    // Calcular hora exacta en Caracas (UTC - 4 horas)
    const ahoraUtc = new Date();
    const utcHour = ahoraUtc.getUTCHours();
    const utcMinutes = ahoraUtc.getUTCMinutes();
    const minutosUtc = utcHour * 60 + utcMinutes;
    const minutosCaracas = (minutosUtc - 4 * 60 + 24 * 60) % (24 * 60);
    const horaCaracas = Math.floor(minutosCaracas / 60);
    const minCaracas = minutosCaracas % 60;
    const horaCaracasStr = `${horaCaracas.toString().padStart(2, "0")}:${minCaracas.toString().padStart(2, "0")}`;

    if (!slot) {
      if (horaCaracas >= 6 && horaCaracas < 10) {
        slot = "manana"; // 6:00 AM a 9:59 AM Caracas
      } else if (horaCaracas >= 17 && horaCaracas < 20) {
        slot = "tarde"; // 5:00 PM a 7:59 PM Caracas
      } else if (horaCaracas === 20 || (horaCaracas === 21 && minCaracas < 15)) {
        slot = "anticipacion"; // 8:00 PM a 9:14 PM Caracas
      } else if ((horaCaracas === 21 && minCaracas >= 15) || horaCaracas === 22 || horaCaracas === 23) {
        slot = "alerta_cierre"; // 9:15 PM a 11:59 PM Caracas
      } else {
        // Fuera de cualquier ventana programada: NO enviar nada
        return Response.json({
          success: true,
          mensaje: "Sin recordatorios programados en este horario.",
          horaCaracas: horaCaracasStr,
          horaUtc: utcHour,
          notificacionesEnviadas: 0,
        });
      }
    }

    // Protección contra ejecuciones desfasadas
    if (slot === "manana" && horaCaracas >= 11) {
      return Response.json({
        success: true,
        descartado: true,
        motivo: "Recordatorio de mañana descartado por retraso de ejecución.",
        horaCaracas: horaCaracasStr,
        notificacionesEnviadas: 0,
      });
    }
    if (slot === "anticipacion" && (horaCaracas < 19 && horaCaracas >= 4)) {
      return Response.json({
        success: true,
        descartado: true,
        motivo: "Plan de mañana descartado porque no es hora de la noche.",
        horaCaracas: horaCaracasStr,
        notificacionesEnviadas: 0,
      });
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
    // ──────────────────────────────────────────────────────────────────────────
    // 2. SLOT TARDE (6:30 PM Caracas) - Regreso a casa / Paseo de Sofi / Pendientes
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
    // 3. SLOT ANTICIPACIÓN (8:30 PM Caracas) - Plan de mañana para organizarse
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
    // 4. SLOT ALERTA DE CIERRE (9:30 PM Caracas) - ⚠️ Advertencia penalización
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
      horaCaracas: horaCaracasStr,
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
