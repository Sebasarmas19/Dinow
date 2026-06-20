import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { formatearFechaISO, obtenerFechaDeNegocio, sumarDias } from "@/lib/shared/date";
import {
  type Asignacion,
  borrarAsignacionesPorFecha,
  insertarAsignaciones,
  listarAsignacionesPorFecha,
} from "./rotacion.repo";
import { listarPlanSemanal } from "./plan_semanal.repo";
import { listarDeberes } from "@/lib/deberes/deberes.repo";
import { listarParticipantes } from "@/lib/participantes/participantes.repo";

const DIAS_MAP = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

export async function generarAsignacionesPorFecha(
  fecha: Date,
  opciones?: { sobrescribir?: boolean }
): Promise<Asignacion[]> {
  const hogarId = await obtenerHogarActualId();
  const fechaStr = formatearFechaISO(fecha);

  const existentes = await listarAsignacionesPorFecha(hogarId, fechaStr);
  if (existentes.length > 0 && !opciones?.sobrescribir) {
    return existentes;
  }

  const plan = await listarPlanSemanal(hogarId);
  const diaSemanaInt = fecha.getDay(); // 0 = Domingo, 1 = Lunes
  const diaStr = DIAS_MAP[diaSemanaInt];

  // A) Asignaciones del plan fijo
  const planDelDia = plan.filter((p) => p.diaSemana === diaSemanaInt);
  const asignacionesManuales = planDelDia.map((p) => ({
    hogarId,
    deberId: p.deberId,
    participanteId: p.participanteId,
    fecha: fechaStr,
  }));

  // B) Asignaciones personales automáticas
  const todosLosDeberes = await listarDeberes(hogarId);
  const participantes = await listarParticipantes(hogarId);

  const deberesPersonales = todosLosDeberes.filter(
    (d) => d.tipoAsignacion === "rotativo" && d.esPersonal
  );

  const asignacionesPersonales: any[] = [];
  for (const d of deberesPersonales) {
    const truncado = diaStr.substring(0, 3).toUpperCase();
    const disponible = d.diasDisponibles.some(
      (dd) => dd.toUpperCase().replace("É","E").replace("Á","A").substring(0, 3) === truncado
    );
    if (disponible) {
      for (const p of participantes) {
        asignacionesPersonales.push({
          hogarId,
          deberId: d.id,
          participanteId: p.id,
          fecha: fechaStr,
        });
      }
    }
  }

  const nuevasAsignaciones = [...asignacionesManuales, ...asignacionesPersonales];

  if (nuevasAsignaciones.length === 0) {
    return [];
  }

  if (opciones?.sobrescribir && existentes.length > 0) {
    await borrarAsignacionesPorFecha(hogarId, fechaStr);
  }

  return insertarAsignaciones(nuevasAsignaciones);
}

export async function generarAsignacionesDeHoy(opciones?: { sobrescribir?: boolean }) {
  const hoy = obtenerFechaDeNegocio();
  return generarAsignacionesPorFecha(hoy, opciones);
}

export async function generarAsignacionesRango(
  fechaInicio: Date,
  dias: number,
  opciones?: { sobrescribir?: boolean }
) {
  let creadas = 0;
  for (let i = 0; i < dias; i++) {
    const f = sumarDias(fechaInicio, i);
    const asignaciones = await generarAsignacionesPorFecha(f, opciones);
    creadas += asignaciones.length;
  }
  return creadas;
}
