"use server";
import { verificarSesionActual } from "@/lib/auth/auth.service";


import { revalidatePath } from "next/cache";
import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { reemplazarPlanSemanal } from "./plan_semanal.repo";

export async function guardarPlanSemanalAction(
  planAsignaciones: { deberId: string; participanteId: string; diaSemana: number }[]
) {
  const sesion = await verificarSesionActual();
  if (!sesion || sesion.rol !== "admin") {
    return { ok: false, error: "No autorizado. Requiere permisos de administrador." } as any;
  }

  try {
    const hogarId = await obtenerHogarActualId();

    const entradas = planAsignaciones.map((a) => ({
      hogarId,
      deberId: a.deberId,
      participanteId: a.participanteId,
      diaSemana: a.diaSemana,
    }));

    await reemplazarPlanSemanal(hogarId, entradas);

    const { generarAsignacionesPorFecha } = await import("./rotacion.service");
    const { obtenerFechaDeNegocio } = await import("@/lib/shared/date");
    await generarAsignacionesPorFecha(obtenerFechaDeNegocio(), { sobrescribir: true });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error: any) {
    console.error("Error al guardar plan semanal:", error);
    return { ok: false, error: "Ocurrió un error al guardar el plan semanal." };
  }
}
