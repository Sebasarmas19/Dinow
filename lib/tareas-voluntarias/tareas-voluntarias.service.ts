import { registrarAccion } from "@/lib/auditoria/auditoria.service";
import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { insertarTransaccion } from "@/lib/puntos/puntos.repo";
import { formatearFechaISO, obtenerFechaDeNegocio } from "@/lib/shared/date";
import {
  actualizarTareaVoluntaria,
  contarTareasVoluntariasPendientes,
  insertarTareaVoluntaria,
  listarTareasVoluntariasDeParticipante,
  listarTareasVoluntariasPorHogar,
  obtenerTareaVoluntariaPorId,
  type TareaVoluntaria,
  type TareaVoluntariaConParticipante,
} from "./tareas-voluntarias.repo";

/**
 * Propone una nueva tarea voluntaria realizada por un integrante del hogar.
 */
export async function proponerTareaVoluntaria(input: {
  participanteId: string;
  titulo: string;
  descripcion: string;
  fotoUrl?: string | null;
  puntosSugeridos?: number | null;
}): Promise<TareaVoluntaria> {
  const hogarId = await obtenerHogarActualId();
  const fecha = formatearFechaISO(obtenerFechaDeNegocio());

  const titulo = input.titulo.trim();
  const descripcion = input.descripcion.trim();

  if (!titulo) throw new Error("Debes indicar qué tarea voluntaria realizaste.");
  if (!descripcion) throw new Error("Debes incluir una justificación o detalle de lo realizado.");

  return insertarTareaVoluntaria({
    hogarId,
    participanteId: input.participanteId,
    titulo,
    descripcion,
    fotoUrl: input.fotoUrl || null,
    puntosSugeridos: input.puntosSugeridos ? String(input.puntosSugeridos) : null,
    estado: "pendiente",
    fecha,
  });
}

/**
 * Aprueba una tarea voluntaria y otorga los puntos al participante.
 *
 * REGLAS:
 * 1. Los puntos se asientan en el libro mayor (`transacciones_puntos`) con tipo `reclamable`,
 *    de modo que suman tanto al ranking General como al ranking Responsable.
 * 2. Queda registrado en el libro de auditoría pública (`registro_auditoria`), visible para todos.
 */
export async function aprobarTareaVoluntaria(input: {
  tareaId: string;
  adminId: string;
  puntosOtorgados: number;
}): Promise<TareaVoluntaria> {
  const tarea = await obtenerTareaVoluntariaPorId(input.tareaId);
  if (!tarea) throw new Error("La tarea voluntaria no existe.");
  if (tarea.estado !== "pendiente") {
    throw new Error(`La tarea ya fue ${tarea.estado} previamente.`);
  }

  const puntos = Number(input.puntosOtorgados);
  if (!Number.isFinite(puntos) || puntos <= 0) {
    throw new Error("Los puntos otorgados deben ser un número mayor a cero.");
  }

  // 1. Actualizar el estado de la tarea voluntaria
  const tareaAprobada = await actualizarTareaVoluntaria(tarea.id, {
    estado: "aprobada",
    puntosOtorgados: String(puntos),
    revisadoPor: input.adminId,
    revisadoEn: new Date(),
  });

  // 2. Registrar los puntos en el libro mayor como 'reclamable' (afecta General y Responsable)
  await insertarTransaccion({
    hogarId: tarea.hogarId,
    participanteId: tarea.participanteId,
    registroId: null,
    cantidad: String(puntos),
    tipo: "reclamable",
    fecha: tarea.fecha,
  });

  // 3. Registrar en auditoría pública
  await registrarAccion({
    adminId: input.adminId,
    accion: "aprobar_tarea_voluntaria",
    detalle: {
      tareaId: tarea.id,
      titulo: tarea.titulo,
      participanteId: tarea.participanteId,
      puntosOtorgados: puntos,
    },
  });

  return tareaAprobada;
}

/**
 * Rechaza una tarea voluntaria con un motivo explicativo.
 */
export async function rechazarTareaVoluntaria(input: {
  tareaId: string;
  adminId: string;
  motivoRechazo?: string;
}): Promise<TareaVoluntaria> {
  const tarea = await obtenerTareaVoluntariaPorId(input.tareaId);
  if (!tarea) throw new Error("La tarea voluntaria no existe.");
  if (tarea.estado !== "pendiente") {
    throw new Error(`La tarea ya fue ${tarea.estado} previamente.`);
  }

  const motivo = input.motivoRechazo?.trim() || null;

  // 1. Actualizar estado
  const tareaRechazada = await actualizarTareaVoluntaria(tarea.id, {
    estado: "rechazada",
    motivoRechazo: motivo,
    revisadoPor: input.adminId,
    revisadoEn: new Date(),
  });

  // 2. Registrar en auditoría
  await registrarAccion({
    adminId: input.adminId,
    accion: "rechazar_tarea_voluntaria",
    detalle: {
      tareaId: tarea.id,
      titulo: tarea.titulo,
      participanteId: tarea.participanteId,
      motivoRechazo: motivo,
    },
  });

  return tareaRechazada;
}

/**
 * Consulta las tareas voluntarias del hogar para el panel de administración.
 */
export async function obtenerTareasVoluntariasAdmin(
  filtro?: "pendiente" | "aprobada" | "rechazada",
): Promise<TareaVoluntariaConParticipante[]> {
  const hogarId = await obtenerHogarActualId();
  return listarTareasVoluntariasPorHogar(hogarId, filtro);
}

/**
 * Consulta las tareas voluntarias enviadas por un participante específico.
 */
export async function obtenerMisTareasVoluntarias(
  participanteId: string,
): Promise<TareaVoluntaria[]> {
  return listarTareasVoluntariasDeParticipante(participanteId);
}

/**
 * Obtiene el conteo de tareas voluntarias pendientes para alertas o insignias.
 */
export async function obtenerTotalTareasVoluntariasPendientes(): Promise<number> {
  const hogarId = await obtenerHogarActualId();
  return contarTareasVoluntariasPendientes(hogarId);
}
