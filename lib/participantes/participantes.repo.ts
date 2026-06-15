import { and, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { participantes } from "@/lib/db/schema";

/**
 * Acceso a datos de participantes. Solo consultas a la base de datos.
 */

export type Participante = typeof participantes.$inferSelect;
export type NuevoParticipante = typeof participantes.$inferInsert;

/**
 * Lista los participantes de un hogar, ordenados por su posicion en la
 * rotacion. Por defecto solo los activos; pasar `incluirInactivos` para todos.
 */
export async function listarParticipantes(
  hogarId: string,
  opciones?: { incluirInactivos?: boolean },
): Promise<Participante[]> {
  const filtro = opciones?.incluirInactivos
    ? eq(participantes.hogarId, hogarId)
    : and(
        eq(participantes.hogarId, hogarId),
        eq(participantes.activo, true),
      );

  return db.query.participantes.findMany({
    where: filtro,
    orderBy: (p, { asc }) => [asc(p.ordenRotacion)],
  });
}

/** Devuelve un participante por id (o undefined si no existe). */
export async function obtenerParticipante(
  id: string,
): Promise<Participante | undefined> {
  return db.query.participantes.findFirst({
    where: eq(participantes.id, id),
  });
}

/**
 * Mayor `orden_rotacion` usado en un hogar (para asignar el siguiente).
 * Devuelve null si el hogar aun no tiene participantes con posicion.
 */
export async function obtenerMaxOrdenRotacion(
  hogarId: string,
): Promise<number | null> {
  const [fila] = await db
    .select({ maximo: max(participantes.ordenRotacion) })
    .from(participantes)
    .where(eq(participantes.hogarId, hogarId));
  return fila?.maximo ?? null;
}

/** Inserta un participante y devuelve la fila creada. */
export async function insertarParticipante(
  valores: NuevoParticipante,
): Promise<Participante> {
  const [fila] = await db.insert(participantes).values(valores).returning();
  return fila;
}

/** Actualiza un participante por id y devuelve la fila nueva. */
export async function actualizarParticipante(
  id: string,
  cambios: Partial<NuevoParticipante>,
): Promise<Participante | undefined> {
  const [fila] = await db
    .update(participantes)
    .set(cambios)
    .where(eq(participantes.id, id))
    .returning();
  return fila;
}
