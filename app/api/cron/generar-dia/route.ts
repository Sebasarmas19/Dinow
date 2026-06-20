import { cerrarDia } from "@/lib/cierre/cierre.service";
import {
  evaluarLogrosTodos,
  otorgarTitulosDelMes,
} from "@/lib/logros/logros.service";
import { generarAsignacionesPorFecha } from "@/lib/rotacion/rotacion.service";
import {
  formatearFechaISO,
  obtenerFechaDeNegocio,
  sumarDias,
} from "@/lib/shared/date";

/**
 * Endpoint del cron diario.
 *
 * Vercel Cron lo llama cada día a las 3:00 AM de Caracas (07:00 UTC, ver
 * vercel.json). En ese momento el día anterior ya cerró, así que hace dos cosas
 * en orden:
 *   1. CIERRA el día que acaba de terminar (ayer): aplica las penalizaciones
 *      por lo que quedó sin hacer.
 *   2. GENERA las asignaciones rotativas del día nuevo (hoy), para que al abrir
 *      la app cada quien vea el deber que le toca.
 *
 * Usa Node.js (no Edge) porque el cliente de Postgres/Drizzle necesita el
 * runtime de Node.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Seguridad: solo se ejecuta con el secreto correcto. Vercel adjunta
  // automáticamente "Authorization: Bearer <CRON_SECRET>" si esa variable de
  // entorno está configurada. Así nadie de afuera puede dispararlo.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("No autorizado", { status: 401 });
  }

  try {
    const hoy = obtenerFechaDeNegocio();
    const ayer = sumarDias(hoy, -1);

    // 1. Cerrar ayer (aplicar penalizaciones de lo no hecho).
    const cierre = await cerrarDia(ayer);

    // 2. Evaluar medallas de todos (las rachas se actualizan a diario).
    const logros = await evaluarLogrosTodos();

    // 3. Si arrancó un mes nuevo, otorgar los títulos del mes que terminó (el
    //    mes de "ayer"). Solo el día 1 del mes.
    let titulos: unknown = null;
    if (hoy.getDate() === 1) {
      titulos = await otorgarTitulosDelMes(formatearFechaISO(ayer).slice(0, 7));
    }

    // 4. Generar las asignaciones de hoy.
    const asignaciones = await generarAsignacionesPorFecha(hoy);

    return Response.json({
      ok: true,
      hoy: formatearFechaISO(hoy),
      cierreAyer: cierre,
      logrosNuevos: logros.length,
      titulosOtorgados: titulos,
      asignacionesGeneradas: asignaciones.length,
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error inesperado";
    return Response.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
