import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { deberes } from "@/lib/db/schema";

/**
 * Acceso a datos de deberes. Solo consultas a la base de datos.
 */

export type Deber = typeof deberes.$inferSelect;
export type NuevoDeber = typeof deberes.$inferInsert;

/**
 * Lista los deberes de un hogar. Por defecto solo los activos; pasar
 * `incluirInactivos` para traerlos todos.
 */
export async function listarDeberes(
  hogarId: string,
  opciones?: { incluirInactivos?: boolean },
): Promise<Deber[]> {
  const filtro = opciones?.incluirInactivos
    ? eq(deberes.hogarId, hogarId)
    : and(eq(deberes.hogarId, hogarId), eq(deberes.activo, true));

  return db.query.deberes.findMany({
    where: filtro,
    orderBy: (d, { asc }) => [asc(d.nombre)],
  });
}

/** Devuelve un deber por id (o undefined si no existe). */
export async function obtenerDeber(id: string): Promise<Deber | undefined> {
  return db.query.deberes.findFirst({ where: eq(deberes.id, id) });
}

/** Inserta un deber y devuelve la fila creada. */
export async function insertarDeber(valores: NuevoDeber): Promise<Deber> {
  const [fila] = await db.insert(deberes).values(valores).returning();
  return fila;
}

/** Actualiza un deber por id y devuelve la fila nueva. */
export async function actualizarDeber(
  id: string,
  cambios: Partial<NuevoDeber>,
): Promise<Deber | undefined> {
  const [fila] = await db
    .update(deberes)
    .set(cambios)
    .where(eq(deberes.id, id))
    .returning();
  return fila;
}
