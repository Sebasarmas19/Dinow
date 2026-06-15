import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { hogar } from "@/lib/db/schema";

/**
 * Acceso a datos del hogar. Capa mas baja: solo habla con la base de datos
 * (via Drizzle). No tiene logica de negocio ni validaciones.
 */

// Tipos derivados del esquema: lo que se lee y lo que se inserta.
export type Hogar = typeof hogar.$inferSelect;
export type NuevoHogar = typeof hogar.$inferInsert;

/**
 * Devuelve el unico hogar existente (o undefined si todavia no hay ninguno).
 * Por ahora la app es de un solo hogar, asi que tomamos el primero.
 */
export async function obtenerPrimerHogar(): Promise<Hogar | undefined> {
  return db.query.hogar.findFirst();
}

/** Inserta un hogar nuevo y devuelve la fila creada. */
export async function insertarHogar(valores: NuevoHogar): Promise<Hogar> {
  const [fila] = await db.insert(hogar).values(valores).returning();
  return fila;
}

/** Actualiza la configuracion de un hogar por id y devuelve la fila nueva. */
export async function actualizarHogar(
  id: string,
  cambios: Partial<NuevoHogar>,
): Promise<Hogar | undefined> {
  const [fila] = await db
    .update(hogar)
    .set(cambios)
    .where(eq(hogar.id, id))
    .returning();
  return fila;
}
