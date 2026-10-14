import { db } from "@/lib/db";
import { asignaciones, deberes, participantes, suscripcionesPush, registros } from "@/lib/db/schema";
import { obtenerFechaDeNegocio, formatearFechaISO } from "@/lib/shared/date";
import { eq, and, sql } from "drizzle-orm";
import webpush from "web-push";

// Configurar web-push
webpush.setVapidDetails(
  "mailto:test@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verificar secreto
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("No autorizado", { status: 401 });
  }

  try {
    const hoy = obtenerFechaDeNegocio();
    const fechaHoyStr = formatearFechaISO(hoy);
    const diasSemana = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const diaActualStr = diasSemana[hoy.getDay()];

    const hour = new Date().getUTCHours();
    // 10 UTC = 6 AM Caracas
    // 18 UTC = 2 PM Caracas
    // 23 UTC = 7 PM Caracas
    
    // Para depuración local, permitimos pasar la hora por URL (ej: ?forceHour=10)
    const url = new URL(request.url);
    const forceHour = url.searchParams.get("forceHour");
    const activeHour = forceHour ? parseInt(forceHour, 10) : hour;

    const isMorning = activeHour >= 9 && activeHour <= 11;
    const isAfternoon = activeHour >= 17 && activeHour <= 19;
    const isEvening = activeHour >= 22 || activeHour <= 0;

    // Obtener suscripciones y agruparlas por participante para evitar duplicados (mismo endpoint)
    const todasLasSuscripciones = await db.select().from(suscripcionesPush);
    const subsUnicas = new Map<string, typeof todasLasSuscripciones[0]>();
    for (const sub of todasLasSuscripciones) {
      const key = `${sub.participanteId}-${sub.endpoint}`;
      subsUnicas.set(key, sub);
    }
    const suscripcionesValidas = Array.from(subsUnicas.values());

    const envios: Promise<any>[] = [];

    // --- LÓGICA DE LA MAÑANA (6 AM) ---
    if (isMorning) {
      const asignacionesHoy = await db
        .select({
          participanteNombre: participantes.nombre,
          participanteId: participantes.id,
          deberNombre: deberes.nombre,
          esPersonal: deberes.esPersonal
        })
        .from(asignaciones)
        .innerJoin(deberes, eq(asignaciones.deberId, deberes.id))
        .innerJoin(participantes, eq(asignaciones.participanteId, participantes.id))
        .where(and(eq(asignaciones.fecha, fechaHoyStr), eq(deberes.tipoAsignacion, "rotativo"), eq(deberes.activo, true)));

      for (const sub of suscripcionesValidas) {
        // Buscar el deber principal (no personal)
        const suAsignacion = asignacionesHoy.find(a => a.participanteId === sub.participanteId && !a.esPersonal);
        if (suAsignacion) {
          envios.push(
            enviarPush(sub, 
              `¡Buenos días, ${suAsignacion.participanteNombre}! ☀️`, 
              `Hoy te toca la misión principal: ${suAsignacion.deberNombre}. ¡Que tengas un excelente día!`,
              `/${encodeURIComponent(suAsignacion.participanteNombre.toLowerCase())}`
            )
          );
        }
      }
    }

    // --- LÓGICA DE LA TARDE (2 PM) ---
    if (isAfternoon) {
      const asignacionesHoy = await db
        .select({
          participanteNombre: participantes.nombre,
          participanteId: participantes.id,
          deberNombre: deberes.nombre,
          deberId: deberes.id
        })
        .from(asignaciones)
        .innerJoin(deberes, eq(asignaciones.deberId, deberes.id))
        .innerJoin(participantes, eq(asignaciones.participanteId, participantes.id))
        .where(and(eq(asignaciones.fecha, fechaHoyStr), eq(deberes.esObligatorio, true), eq(deberes.activo, true)));

      const registrosHoy = await db
        .select()
        .from(registros)
        .where(and(eq(registros.fecha, fechaHoyStr), eq(registros.estado, "cumplido_propio")));

      const pendientesPorUsuario = new Map<string, typeof asignacionesHoy>();

      for (const asig of asignacionesHoy) {
        const yaCumplido = registrosHoy.some(r => r.participanteId === asig.participanteId && r.deberId === asig.deberId);
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
          const deberMuestra = pendientes[0].deberNombre;
          const body = pendientes.length === 1 
            ? `Recuerda que tienes 1 deber obligatorio pendiente hoy: ${deberMuestra}.`
            : `Recuerda que tienes ${pendientes.length} deberes pendientes hoy, incluyendo: ${deberMuestra}.`;
          
          envios.push(
            enviarPush(sub, 
              `¡Hola ${partNombre}! 👋`, 
              body,
              `/${encodeURIComponent(partNombre.toLowerCase())}`
            )
          );
        }
      }
    }

    // --- LÓGICA DE LA NOCHE (7 PM) ---
    if (isEvening) {
      // Buscar deberes extras (reclamables) activos hoy
      const extrasDisponibles = await db
        .select()
        .from(deberes)
        .where(and(
          eq(deberes.esObligatorio, false),
          eq(deberes.activo, true)
        ));
      
      const extrasDeHoy = extrasDisponibles.filter(d => d.diasDisponibles.includes(diaActualStr));

      if (extrasDeHoy.length > 0) {
        // Filtramos los que no hayan sido reclamados hoy
        const registrosHoy = await db
          .select()
          .from(registros)
          .where(and(eq(registros.fecha, fechaHoyStr), eq(registros.estado, "reclamado")));
          
        const extrasSinReclamar = extrasDeHoy.filter(ext => !registrosHoy.some(r => r.deberId === ext.id));

        if (extrasSinReclamar.length > 0) {
          const randomExtra = extrasSinReclamar[Math.floor(Math.random() * extrasSinReclamar.length)];

          for (const sub of suscripcionesValidas) {
            // Obtenemos el nombre del participante (solo necesitamos buscarlo para armar la url)
            const [part] = await db.select({ nombre: participantes.nombre }).from(participantes).where(eq(participantes.id, sub.participanteId));
            if (part) {
              envios.push(
                enviarPush(sub, 
                  `¡Oye ${part.nombre}! 🚀`, 
                  `Aún puedes ganar +${randomExtra.puntos} pts extra hoy si haces esta tarea: ${randomExtra.nombre}. ¡Aprovecha!`,
                  `/${encodeURIComponent(part.nombre.toLowerCase())}`
                )
              );
            }
          }
        }
      }
    }

    await Promise.all(envios);

    return Response.json({ success: true, notificacionesEnviadas: envios.length, horaInterpretada: activeHour });
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
    }
  };
  return webpush.sendNotification(pushSubscription, payload).catch(err => {
    console.error("Fallo enviando push a", sub.endpoint, err.message);
  });
}
