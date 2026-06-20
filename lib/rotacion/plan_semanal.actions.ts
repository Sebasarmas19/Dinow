"use server";

import { revalidatePath } from "next/cache";
import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { reemplazarPlanSemanal } from "./plan_semanal.repo";

export async function guardarPlanSemanalAction(
  planAsignaciones: { deberId: string; participanteId: string; diaSemana: number }[]
) {
  try {
    const hogarId = await obtenerHogarActualId();

    const entradas = planAsignaciones.map((a) => ({
      hogarId,
      deberId: a.deberId,
      participanteId: a.participanteId,
      diaSemana: a.diaSemana,
    }));

    await reemplazarPlanSemanal(hogarId, entradas);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error: any) {
    console.error("Error al guardar plan semanal:", error);
    return { ok: false, error: "Ocurrió un error al guardar el plan semanal." };
  }
}
