import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { calcularRankings } from "@/lib/rankings/rankings.service";
import { listarParticipantesActivos } from "@/lib/rotacion/rotacion.repo";
import { formatearFechaISO, obtenerFechaDeNegocio } from "@/lib/shared/date";
import {
  CATALOGO_LOGROS,
  type EstadisticasParticipante,
  type NivelLogro,
} from "./catalogo";
import {
  contarTransaccionesTipo,
  insertarLogro,
  insertarTitulo,
  listarAsignacionesDe,
  listarAusenciasDe,
  listarLogrosDe,
  listarRegistrosDe,
  listarTitulosDelMes,
} from "./logros.repo";

/**
 * Motor de logros y títulos del mes.
 *
 * - Medallas (logros): se evalúan contra un catálogo FIJO (catalogo.ts) y se
 *   conservan para siempre. El motor otorga cada nivel alcanzado una sola vez.
 * - Títulos del mes: los ganadores (1º) de los cuatro rankings de un mes. Se
 *   reinician cada mes (son por mes) y se guardan en `titulos_mes`.
 *
 * Todo es idempotente: volver a evaluar no duplica medallas ni títulos.
 */

const RANKINGS = ["general", "confiable", "solidario", "responsable"] as const;

// ── Estadísticas ─────────────────────────────────────────────────────────────

/** Calcula las estadísticas de un participante a partir de todo su historial. */
export async function calcularEstadisticas(
  participanteId: string,
): Promise<EstadisticasParticipante> {
  const hoyStr = formatearFechaISO(obtenerFechaDeNegocio());

  const [asignaciones, registros, ausencias] = await Promise.all([
    listarAsignacionesDe(participanteId),
    listarRegistrosDe(participanteId),
    listarAusenciasDe(participanteId),
  ]);

  // Coberturas con bono y extras: se cuentan directo del libro mayor.
  const coberturas = await contarTransaccionesTipo(participanteId, "bono_ayuda");
  const extras = await contarTransaccionesTipo(participanteId, "reclamable");

  // Racha: días seguidos cumpliendo todo lo asignado, sin fallar.
  const rachaDias = calcularRachaMaxima(asignaciones, registros, ausencias, hoyStr);

  return { rachaDias, coberturas, extras };
}

/**
 * Racha máxima de días consecutivos en que la persona cumplió TODOS sus deberes
 * asignados. Los días sin asignación o con ausencia válida son neutros (ni
 * suman ni rompen la racha); un día presente con algo sin cumplir la rompe.
 */
function calcularRachaMaxima(
  asignaciones: { deberId: string; fecha: string }[],
  registros: { deberId: string; fecha: string; estado: string }[],
  ausencias: { fechaInicio: string; fechaFin: string }[],
  hoyStr: string,
): number {
  // Deberes propios cumplidos, indexados por "fecha:deber".
  const cumplidos = new Set(
    registros
      .filter((r) => r.estado === "cumplido_propio")
      .map((r) => `${r.fecha}:${r.deberId}`),
  );

  // Asignaciones por fecha (solo hasta hoy).
  const porFecha = new Map<string, string[]>();
  for (const a of asignaciones) {
    if (a.fecha > hoyStr) continue;
    if (!porFecha.has(a.fecha)) porFecha.set(a.fecha, []);
    porFecha.get(a.fecha)!.push(a.deberId);
  }

  const ausente = (fecha: string) =>
    ausencias.some((au) => au.fechaInicio <= fecha && au.fechaFin >= fecha);

  const fechas = [...porFecha.keys()].sort(); // ascendente
  let actual = 0;
  let maxima = 0;
  for (const fecha of fechas) {
    if (ausente(fecha)) continue; // neutro
    const deberesDelDia = porFecha.get(fecha)!;
    const completo = deberesDelDia.every((d) => cumplidos.has(`${fecha}:${d}`));
    if (completo) {
      actual++;
      maxima = Math.max(maxima, actual);
    } else {
      actual = 0; // falló ese día: se rompe la racha
    }
  }
  return maxima;
}

// ── Medallas ─────────────────────────────────────────────────────────────────

export type LogroNuevo = { participanteId: string; clave: string; nivel: NivelLogro };

/**
 * Evalúa el catálogo para un participante y otorga las medallas nuevas que haya
 * desbloqueado. No re-otorga las que ya tiene. Devuelve las nuevas.
 */
export async function evaluarLogros(participanteId: string): Promise<LogroNuevo[]> {
  const stats = await calcularEstadisticas(participanteId);
  const obtenidos = await listarLogrosDe(participanteId);
  const yaTiene = new Set(obtenidos.map((l) => `${l.logroClave}:${l.nivel}`));
  const hoyStr = formatearFechaISO(obtenerFechaDeNegocio());

  const nuevos: LogroNuevo[] = [];
  for (const def of CATALOGO_LOGROS) {
    const valor = stats[def.metrica];
    for (const { nivel, umbral } of def.niveles) {
      if (valor >= umbral && !yaTiene.has(`${def.clave}:${nivel}`)) {
        await insertarLogro({
          participanteId,
          logroClave: def.clave,
          nivel,
          fechaObtenido: hoyStr,
        });
        nuevos.push({ participanteId, clave: def.clave, nivel });
      }
    }
  }
  return nuevos;
}

/** Evalúa los logros de todos los participantes activos del hogar. */
export async function evaluarLogrosTodos(): Promise<LogroNuevo[]> {
  const hogarId = await obtenerHogarActualId();
  const participantes = await listarParticipantesActivos(hogarId);
  const nuevos: LogroNuevo[] = [];
  for (const p of participantes) {
    nuevos.push(...(await evaluarLogros(p.id)));
  }
  return nuevos;
}

// ── Títulos del mes ──────────────────────────────────────────────────────────

export type TituloNuevo = { participanteId: string; ranking: string };

/**
 * Otorga los títulos del mes: el (o los, si hay empate) 1º de cada uno de los
 * cuatro rankings. Solo cuenta si el valor es mayor que 0 (sin actividad, sin
 * título). Idempotente: no duplica títulos ya otorgados.
 */
export async function otorgarTitulosDelMes(mes: string): Promise<TituloNuevo[]> {
  const rankings = await calcularRankings(mes);
  const existentes = await listarTitulosDelMes(mes);
  const yaHay = new Set(existentes.map((t) => `${t.ranking}:${t.participanteId}`));

  const nuevos: TituloNuevo[] = [];
  for (const ranking of RANKINGS) {
    const ganadores = rankings[ranking].filter(
      (f) => f.posicion === 1 && f.valor > 0,
    );
    for (const g of ganadores) {
      if (!yaHay.has(`${ranking}:${g.participanteId}`)) {
        await insertarTitulo({ participanteId: g.participanteId, ranking, mes });
        nuevos.push({ participanteId: g.participanteId, ranking });
      }
    }
  }
  return nuevos;
}

/**
 * Cierre de mes: otorga los títulos del mes indicado y evalúa las medallas de
 * todos. Pensado para correr cuando arranca un mes nuevo (cierra el anterior).
 */
export async function cerrarMes(mes: string): Promise<{
  titulos: TituloNuevo[];
  logros: LogroNuevo[];
}> {
  const titulos = await otorgarTitulosDelMes(mes);
  const logros = await evaluarLogrosTodos();
  return { titulos, logros };
}
