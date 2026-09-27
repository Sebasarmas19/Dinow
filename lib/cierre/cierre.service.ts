import { obtenerHogarActual } from "@/lib/hogar/hogar.service";
import {
  otorgarPenalizacionColectiva,
  otorgarPenalizacionFallo,
} from "@/lib/puntos/puntos.service";
import {
  idsAusentesEnFecha,
  listarParticipantesActivos,
} from "@/lib/rotacion/rotacion.repo";
import { formatearFechaISO } from "@/lib/shared/date";
import {
  contarPenalizacionesDelDia,
  listarAsignacionesConDeber,
  listarRegistrosDelDia,
} from "./cierre.repo";

/**
 * Motor de cierre del día.
 *
 * Es el "lado negativo" de los puntos: corre cuando el día ya terminó (a las
 * 3 AM de Caracas, disparado por el cron) y revisa lo que quedó SIN hacer.
 *
 * Reglas que aplica (Art. 5 del reglamento):
 * 1. Si el responsable no hizo su deber rotativo y no tiene ausencia válida →
 *    penalización por fallo (−penalizacion_fallo). Afecta General y Confiable.
 * 2. Si un deber NO NEGOCIABLE no lo hizo nadie (ni el responsable ni alguien
 *    cubriéndolo) → penalización colectiva (−penalizacion_colectiva) a los tres.
 *
 * Es IDEMPOTENTE a nivel de día: si ya se aplicaron penalizaciones para esa
 * fecha, no se vuelve a cerrar (salvo `{ forzar: true }`).
 */

export type ResultadoCierre = {
  fecha: string;
  yaCerrado: boolean;
  penalizacionesAplicadas: number;
};

export async function cerrarDia(
  fecha: Date,
  opciones?: { forzar?: boolean },
): Promise<ResultadoCierre> {
  const hogar = await obtenerHogarActual();
  if (!hogar) throw new Error("No hay un hogar configurado.");
  const hogarId = hogar.id;
  const fechaStr = formatearFechaISO(fecha);

  // Candado de idempotencia.
  if (!opciones?.forzar) {
    const yaHay = await contarPenalizacionesDelDia(hogarId, fechaStr);
    if (yaHay > 0) {
      return { fecha: fechaStr, yaCerrado: true, penalizacionesAplicadas: 0 };
    }
  }

  const [planDelDia, registrosDelDia, participantesActivos] = await Promise.all([
    listarAsignacionesConDeber(hogarId, fechaStr),
    listarRegistrosDelDia(hogarId, fechaStr),
    listarParticipantesActivos(hogarId),
  ]);

  const ausentes = await idsAusentesEnFecha(
    participantesActivos.map((p) => p.id),
    fechaStr,
  );

  const penalizacionFallo = Number(hogar.penalizacionFallo);
  const penalizacionColectiva = Number(hogar.penalizacionColectiva);

  let aplicadas = 0;

  for (const { asignacion, deber } of planDelDia) {
    // ¿El responsable lo hizo él mismo?
    const hechoPorDueño = registrosDelDia.some(
      (r) =>
        r.deberId === deber.id &&
        r.participanteId === asignacion.participanteId &&
        r.estado === "cumplido_propio",
    );
    if (hechoPorDueño) continue; // todo en orden, no hay penalización

    // ¿Alguien lo cubrió?
    const fueCubierto = registrosDelDia.some(
      (r) =>
        r.deberId === deber.id &&
        r.estado === "cubrio_a_otro" &&
        r.cubiertoA === asignacion.participanteId,
    );

    // (1) El responsable falló su deber → penalización individual, salvo que
    // tenga una ausencia válida ese día (queda inmune, Art. 4).
    if (!ausentes.has(asignacion.participanteId)) {
      await otorgarPenalizacionFallo(
        hogarId,
        asignacion.participanteId,
        fechaStr,
        penalizacionFallo,
      );
      aplicadas++;
    }

    // (2) Nadie lo hizo y es no negociable → penalización colectiva a los tres.
    if (deber.esObligatorio && !fueCubierto) {
      for (const p of participantesActivos) {
        if (ausentes.has(p.id)) continue; // Los ausentes con razón válida están protegidos
        await otorgarPenalizacionColectiva(
          hogarId,
          p.id,
          fechaStr,
          penalizacionColectiva,
        );
        aplicadas++;
      }
    }
  }

  return { fecha: fechaStr, yaCerrado: false, penalizacionesAplicadas: aplicadas };
}
