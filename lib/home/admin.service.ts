import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import {
  asignaciones,
  deberes,
  hogar,
  participantes,
  planSemanal as planSemanalTable,
} from "../db/schema";
import {
  formatearFechaISO,
  obtenerFechaDeNegocio,
  sumarDias,
} from "../shared/date";

/**
 * Datos consolidados para el Dashboard del Admin.
 */

export type ParticipanteResumen = {
  id: string;
  nombre: string;
};

export type PlanSemanalFila = {
  participanteNombre: string;
  /** Mapa de día ("lun", "mar", ...) → array de nombres de deberes asignados. */
  dias: Record<string, string[]>;
};

export type AdminDashboardData = {
  nombreHogar: string;
  participantes: ParticipanteResumen[];
  planSemanal: PlanSemanalFila[];
  diasLabels: { clave: string; label: string; idx: number }[];
};

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  // 1. Obtener hogar
  const [hogarActual] = await db.select().from(hogar).limit(1);
  if (!hogarActual) throw new Error("No hay un hogar configurado.");

  // 2. Obtener participantes activos
  const activos = await db
    .select({ id: participantes.id, nombre: participantes.nombre })
    .from(participantes)
    .where(
      and(
        eq(participantes.hogarId, hogarActual.id),
        eq(participantes.activo, true),
      ),
    )
    .orderBy(asc(participantes.ordenRotacion));

  // 3. Obtener la plantilla (plan semanal)
  const plantillaSemana = await db
    .select({
      diaSemana: planSemanalTable.diaSemana,
      participanteId: planSemanalTable.participanteId,
      deberNombre: deberes.nombre,
    })
    .from(planSemanalTable)
    .innerJoin(deberes, eq(planSemanalTable.deberId, deberes.id))
    .where(eq(planSemanalTable.hogarId, hogarActual.id));

  // 4. Construir las etiquetas de los 7 días (0 = Domingo)
  const diasLabels = [
    { clave: "lun", label: "Lun", idx: 1 },
    { clave: "mar", label: "Mar", idx: 2 },
    { clave: "mie", label: "Mié", idx: 3 },
    { clave: "jue", label: "Jue", idx: 4 },
    { clave: "vie", label: "Vie", idx: 5 },
    { clave: "sab", label: "Sáb", idx: 6 },
    { clave: "dom", label: "Dom", idx: 0 },
  ];

  // 5. Armar la tabla: una fila por participante
  const planSemanal: PlanSemanalFila[] = activos.map((p) => {
    const dias: Record<string, string[]> = {};
    for (const d of diasLabels) {
      dias[d.clave] = [];
    }

    for (const a of plantillaSemana) {
      if (a.participanteId === p.id) {
        const diaTarget = diasLabels.find(d => d.idx === a.diaSemana);
        if (diaTarget) {
          dias[diaTarget.clave].push(a.deberNombre);
        }
      }
    }

    return {
      participanteNombre: p.nombre,
      dias,
    };
  });

  return {
    nombreHogar: hogarActual.nombre,
    participantes: activos,
    planSemanal,
    diasLabels,
  };
}
