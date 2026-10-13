import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { listarParticipantesActivos } from "@/lib/rotacion/rotacion.repo";
import { formatearFechaISO, obtenerFechaDeNegocio, rangoPeriodo } from "@/lib/shared/date";
import {
  listarAsignacionesEnRango,
  listarAusenciasEnRango,
  listarRegistrosEnRango,
  listarTransaccionesEnRango,
} from "./rankings.repo";

/**
 * Motor de rankings.
 *
 * Calcula los CUATRO rankings mensuales del reglamento. Todo se DERIVA de
 * `transacciones_puntos`, `registros` y `asignaciones`: no hay puntajes
 * guardados que mantener, así que nunca se desincronizan.
 *
 *  1. General      — total de puntos acumulados.
 *  2. Solidario    — puntos ganados ayudando (transacciones tipo bono_ayuda).
 *  3. Responsable  — puntos en extras reclamables (transacciones tipo reclamable).
 */

/** Una fila de un ranking, ya con su posición calculada. */
export type FilaRanking = {
  participanteId: string;
  nombre: string;
  fotoUrl: string | null;
  valor: number; // puntos, o porcentaje (0-100) en el caso de "confiable"
  posicion: number; // 1 = primero. Empates comparten posición.
  detalle?: string; // texto opcional (ej. "8/10 deberes" en confiable)
};
export type Rankings = {
  mes: string; // 'YYYY-MM'
  general: FilaRanking[];
  confiable: FilaRanking[];
  solidario: FilaRanking[];
  responsable: FilaRanking[];
};

/** Ordena de mayor a menor y asigna posiciones (los empates comparten puesto). */
function clasificar(
  filas: Omit<FilaRanking, "posicion">[],
): FilaRanking[] {
  const ordenadas = [...filas].sort((a, b) => b.valor - a.valor);
  let posicion = 0;
  let valorPrevio: number | null = null;
  return ordenadas.map((fila, indice) => {
    if (valorPrevio === null || fila.valor !== valorPrevio) {
      posicion = indice + 1; // salto estilo competición (1,2,2,4...)
      valorPrevio = fila.valor;
    }
    return { ...fila, posicion };
  });
}

/**
 * Calcula los cuatro rankings de un mes. Por defecto, el mes de negocio actual.
 * `mes` opcional en formato 'YYYY-MM' para consultar meses pasados.
 */
export async function calcularRankings(mes?: string): Promise<Rankings> {
  const hogarId = await obtenerHogarActualId();

  // Fecha de referencia → rango del mes (primer y último día).
  const fechaRef = mes
    ? new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1)
    : obtenerFechaDeNegocio();
  const { inicio, fin } = rangoPeriodo("mensual", fechaRef);
  const mesStr = inicio.slice(0, 7);

  const participantes = await listarParticipantesActivos(hogarId);
  const ids = participantes.map((p) => p.id);

  const [transacciones, registros, asignaciones, ausencias] = await Promise.all([
    listarTransaccionesEnRango(hogarId, inicio, fin),
    listarRegistrosEnRango(hogarId, inicio, fin),
    listarAsignacionesEnRango(hogarId, inicio, fin),
    listarAusenciasEnRango(ids, inicio, fin),
  ]);

  // ¿La persona estaba ausente en una fecha? (comparación de strings YYYY-MM-DD)
  const estabaAusente = (participanteId: string, fecha: string) =>
    ausencias.some(
      (a) =>
        a.participanteId === participanteId &&
        a.fechaInicio <= fecha &&
        a.fechaFin >= fecha,
    );

  const general: Omit<FilaRanking, "posicion">[] = [];
  const confiable: Omit<FilaRanking, "posicion">[] = [];
  const solidario: Omit<FilaRanking, "posicion">[] = [];
  const responsable: Omit<FilaRanking, "posicion">[] = [];

  for (const p of participantes) {
    const susTx = transacciones.filter((t) => t.participanteId === p.id);

    // General: suma de TODAS sus transacciones.
    const total = susTx.reduce((s, t) => s + Number(t.cantidad), 0);

    // Confiable: % de cumplimiento en deberes asignados (descontando ausencias).
    const susAsignacionesValidas = asignaciones.filter(
      (a) => a.participanteId === p.id && !estabaAusente(p.id, a.fecha)
    );
    const totalAsignadas = susAsignacionesValidas.length;
    const cumplidas = susAsignacionesValidas.filter((a) =>
      registros.some(
        (r) =>
          r.estado === "cumplido_propio" &&
          r.participanteId === p.id &&
          r.deberId === a.deberId &&
          r.fecha === a.fecha
      )
    ).length;
    const porcentaje = totalAsignadas > 0 ? Math.round((cumplidas / totalAsignadas) * 100) : 100;

    // Solidario: solo lo ganado ayudando.
    const puntosAyuda = susTx
      .filter((t) => t.tipo === "bono_ayuda")
      .reduce((s, t) => s + Number(t.cantidad), 0);

    // Responsable: solo lo ganado en extras reclamables.
    const puntosExtras = susTx
      .filter((t) => t.tipo === "reclamable")
      .reduce((s, t) => s + Number(t.cantidad), 0);

    general.push({ participanteId: p.id, nombre: p.nombre, fotoUrl: p.fotoUrl, valor: total });
    confiable.push({
      participanteId: p.id,
      nombre: p.nombre,
      fotoUrl: p.fotoUrl,
      valor: porcentaje,
      detalle: `${cumplidas}/${totalAsignadas} cumplidos`,
    });
    solidario.push({ participanteId: p.id, nombre: p.nombre, fotoUrl: p.fotoUrl, valor: puntosAyuda });
    responsable.push({ participanteId: p.id, nombre: p.nombre, fotoUrl: p.fotoUrl, valor: puntosExtras });
  }

  return {
    mes: mesStr,
    general: clasificar(general),
    confiable: clasificar(confiable),
    solidario: clasificar(solidario),
    responsable: clasificar(responsable),
  };
}

export type PosicionesParticipante = {
  general: number;
  confiable: number;
  solidario: number;
  responsable: number;
};

export async function obtenerPosiciones(
  participanteId: string,
  mes?: string,
): Promise<PosicionesParticipante> {
  const r = await calcularRankings(mes);
  const buscar = (filas: FilaRanking[]) =>
    filas.find((f) => f.participanteId === participanteId)?.posicion ?? 0;
  return {
    general: buscar(r.general),
    confiable: buscar(r.confiable),
    solidario: buscar(r.solidario),
    responsable: buscar(r.responsable),
  };
}
