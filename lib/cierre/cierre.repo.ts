import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  asignaciones,
  criteriosDeber,
  deberes,
  registros,
  transaccionesPuntos,
} from "@/lib/db/schema";

/**
 * Acceso a datos del motor de cierre del día. Solo consultas; las reglas de
 * penalización viven en cierre.service.ts.
 */

/**
 * Asignaciones de un día junto con el deber al que apuntan (necesitamos saber
 * si el deber es obligatorio y cuántos puntos vale).
 */
export async function listarAsignacionesConDeber(hogarId: string, fechaStr: string) {
  return db
    .select({ asignacion: asignaciones, deber: deberes })
    .from(asignaciones)
    .innerJoin(deberes, eq(asignaciones.deberId, deberes.id))
    .where(
      and(
        eq(asignaciones.hogarId, hogarId),
        eq(asignaciones.fecha, fechaStr),
        eq(deberes.activo, true)
      ),
    );
}

/** Lista los criterios de aceptación de un conjunto de deberes. */
export async function listarCriteriosDeDeberes(deberIds: string[]) {
  if (deberIds.length === 0) return [];
  return db
    .select()
    .from(criteriosDeber)
    .where(inArray(criteriosDeber.deberId, deberIds));
}

/** Todos los registros (cumplimientos, coberturas, reclamos) de un día. */
export async function listarRegistrosDelDia(hogarId: string, fechaStr: string) {
  return db
    .select()
    .from(registros)
    .where(and(eq(registros.hogarId, hogarId), eq(registros.fecha, fechaStr)));
}

/**
 * ¿Cuántas penalizaciones ya se aplicaron ese día? Sirve de candado de
 * idempotencia: si ya hay penalizaciones, el día ya se cerró y no se repite.
 */
export async function contarPenalizacionesDelDia(
  hogarId: string,
  fechaStr: string,
): Promise<number> {
  const filas = await db
    .select({ id: transaccionesPuntos.id })
    .from(transaccionesPuntos)
    .where(
      and(
        eq(transaccionesPuntos.hogarId, hogarId),
        eq(transaccionesPuntos.fecha, fechaStr),
        inArray(transaccionesPuntos.tipo, ["penalizacion", "penalizacion_colectiva"]),
      ),
    );
  return filas.length;
}
