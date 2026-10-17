import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transaccionesPuntos } from "@/lib/db/schema";

/**
 * Acceso a datos del libro mayor de puntos (`transacciones_puntos`).
 * Solo consultas; las reglas de cuánto sumar viven en puntos.service.ts.
 */

export type Transaccion = typeof transaccionesPuntos.$inferSelect;
export type NuevaTransaccion = typeof transaccionesPuntos.$inferInsert;

/**
 * Busca una transacción existente para un registro y un tipo dados.
 */
export async function buscarTransaccion(
  registroId: string,
  tipo: NuevaTransaccion["tipo"],
): Promise<Transaccion | undefined> {
  const [fila] = await db
    .select()
    .from(transaccionesPuntos)
    .where(
      and(
        eq(transaccionesPuntos.registroId, registroId),
        eq(transaccionesPuntos.tipo, tipo),
      ),
    )
    .limit(1);
  return fila;
}

/**
 * Cuenta cuántas transacciones existen ya para un registro y un tipo dados.
 * Se usa para no duplicar puntos: cada registro genera su transacción una sola
 * vez (idempotencia).
 */
export async function contarTransacciones(
  registroId: string,
  tipo: NuevaTransaccion["tipo"],
): Promise<number> {
  const filas = await db
    .select({ id: transaccionesPuntos.id })
    .from(transaccionesPuntos)
    .where(
      and(
        eq(transaccionesPuntos.registroId, registroId),
        eq(transaccionesPuntos.tipo, tipo),
      ),
    );
  return filas.length;
}

/** Inserta una fila en el libro mayor y la devuelve. */
export async function insertarTransaccion(
  valores: NuevaTransaccion,
): Promise<Transaccion> {
  const [fila] = await db
    .insert(transaccionesPuntos)
    .values(valores)
    .returning();
  return fila;
}

/** Actualiza la cantidad de una transacción existente vinculada a un registro (al completar más criterios en el mismo día). */
export async function actualizarCantidadTransaccion(
  id: string,
  cantidad: string,
): Promise<Transaccion> {
  const [fila] = await db
    .update(transaccionesPuntos)
    .set({ cantidad })
    .where(eq(transaccionesPuntos.id, id))
    .returning();
  return fila;
}
