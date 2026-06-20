import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { obtenerParticipante } from "@/lib/participantes/participantes.repo";
import { generarAsignacionesPorFecha } from "@/lib/rotacion/rotacion.service";
import {
  formatearFechaISO,
  obtenerFechaDeNegocio,
  parsearFechaISO,
  sumarDias,
} from "@/lib/shared/date";
import {
  type Ausencia,
  actualizarAusencia,
  eliminarAusencia as eliminarAusenciaRepo,
  insertarAusencia,
  listarAusenciasDeHogar,
  obtenerAusencia,
} from "./ausencias.repo";

/**
 * Motor de ausencias.
 *
 * Una ausencia válida hace que los deberes no apliquen a la persona esos días:
 * el motor de cierre la deja inmune a la penalización y el ranking Confiable no
 * la cuenta. Además, al declarar una ausencia regeneramos el plan de los días
 * afectados (hoy en adelante) para que la rotación reparta los deberes entre
 * quienes sí están.
 */

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function validarFecha(fecha: string, campo: string) {
  if (!FORMATO_FECHA.test(fecha)) {
    throw new Error(`La ${campo} debe tener formato YYYY-MM-DD.`);
  }
}

/**
 * Regenera (sobrescribiendo) las asignaciones de un rango de fechas, pero solo
 * de hoy en adelante: el pasado no se reescribe. Se usa cuando una ausencia
 * cambia quién está disponible.
 */
async function regenerarPlan(inicioStr: string, finStr: string): Promise<void> {
  const hoyStr = formatearFechaISO(obtenerFechaDeNegocio());
  const desdeStr = inicioStr > hoyStr ? inicioStr : hoyStr; // máx(inicio, hoy)
  if (desdeStr > finStr) return; // la ausencia ya pasó: nada que regenerar

  let fecha = parsearFechaISO(desdeStr);
  const fin = parsearFechaISO(finStr);
  while (fecha <= fin) {
    await generarAsignacionesPorFecha(fecha, { sobrescribir: true });
    fecha = sumarDias(fecha, 1);
  }
}

/** Lista las ausencias del hogar actual (visibles para los tres). */
export async function listarAusencias() {
  const hogarId = await obtenerHogarActualId();
  return listarAusenciasDeHogar(hogarId);
}

/** Declara una ausencia para un participante y ajusta el plan afectado. */
export async function crearAusencia(input: {
  participanteId: string;
  fechaInicio: string;
  fechaFin: string;
  motivo?: string | null;
}): Promise<Ausencia> {
  const participante = await obtenerParticipante(input.participanteId);
  if (!participante) throw new Error("El participante no existe.");

  validarFecha(input.fechaInicio, "fecha de inicio");
  validarFecha(input.fechaFin, "fecha de fin");
  if (input.fechaInicio > input.fechaFin) {
    throw new Error("La fecha de inicio no puede ser posterior a la de fin.");
  }

  const ausencia = await insertarAusencia({
    participanteId: input.participanteId,
    fechaInicio: input.fechaInicio,
    fechaFin: input.fechaFin,
    motivo: input.motivo?.trim() || null,
  });

  await regenerarPlan(input.fechaInicio, input.fechaFin);
  return ausencia;
}

/** El admin aprueba una ausencia (queda registrado quién la aprobó). */
export async function aprobarAusencia(input: {
  ausenciaId: string;
  adminId: string;
}): Promise<Ausencia> {
  const ausencia = await obtenerAusencia(input.ausenciaId);
  if (!ausencia) throw new Error("La ausencia no existe.");

  const actualizada = await actualizarAusencia(input.ausenciaId, {
    aprobadaPor: input.adminId,
  });
  if (!actualizada) throw new Error("No se pudo aprobar la ausencia.");
  return actualizada;
}

/** Elimina una ausencia y regenera el plan (la persona vuelve a la rotación). */
export async function eliminarAusencia(id: string): Promise<void> {
  const ausencia = await obtenerAusencia(id);
  if (!ausencia) throw new Error("La ausencia no existe.");

  await eliminarAusenciaRepo(id);
  await regenerarPlan(ausencia.fechaInicio, ausencia.fechaFin);
}
