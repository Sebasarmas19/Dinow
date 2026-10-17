import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { criteriosDeber } from "@/lib/db/schema";

export type CriterioDeber = typeof criteriosDeber.$inferSelect;
export type NuevoCriterio = typeof criteriosDeber.$inferInsert;

export type CriterioEditableInput = {
  id?: string;
  descripcion: string;
  orden: number;
  puntos: string;
};

/**
 * Lista los criterios de un deber específico, ordenados por su campo 'orden'.
 */
export async function listarCriteriosPorDeber(deberId: string): Promise<CriterioDeber[]> {
  return db.query.criteriosDeber.findMany({
    where: eq(criteriosDeber.deberId, deberId),
    orderBy: (c, { asc }) => [asc(c.orden)],
  });
}

/**
 * Sincroniza los criterios de un deber preservando los IDs de los criterios
 * existentes (para no romper referencias en `registros.criterios_ids` ni
 * `solicitudes_intercambio`) y guardando el peso en `puntos` de cada uno.
 */
export async function reemplazarCriterios(
  deberId: string,
  criterios: CriterioEditableInput[],
): Promise<void> {
  await db.transaction(async (tx) => {
    if (criterios.length === 0) {
      await tx.delete(criteriosDeber).where(eq(criteriosDeber.deberId, deberId));
      return;
    }

    const idsConservar = criterios
      .map((c) => c.id)
      .filter((id): id is string => Boolean(id && id.trim() !== ""));

    if (idsConservar.length > 0) {
      await tx
        .delete(criteriosDeber)
        .where(
          and(
            eq(criteriosDeber.deberId, deberId),
            notInArray(criteriosDeber.id, idsConservar),
          ),
        );
    } else {
      await tx.delete(criteriosDeber).where(eq(criteriosDeber.deberId, deberId));
    }

    for (const c of criterios) {
      if (c.id && c.id.trim() !== "") {
        await tx
          .update(criteriosDeber)
          .set({
            descripcion: c.descripcion,
            orden: c.orden,
            puntos: c.puntos,
          })
          .where(
            and(
              eq(criteriosDeber.id, c.id),
              eq(criteriosDeber.deberId, deberId),
            ),
          );
      } else {
        await tx.insert(criteriosDeber).values({
          deberId,
          descripcion: c.descripcion,
          orden: c.orden,
          puntos: c.puntos,
        });
      }
    }
  });
}
