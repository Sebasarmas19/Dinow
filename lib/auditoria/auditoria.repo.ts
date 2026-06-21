import { desc, eq, and, gte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { deberes, participantes, registroAuditoria, registros, transaccionesPuntos } from "@/lib/db/schema";

/**
 * Acceso a datos del registro de auditoría: el historial de acciones del admin,
 * visible para los tres (transparencia).
 */

export type EntradaAuditoria = typeof registroAuditoria.$inferSelect;
export type NuevaEntradaAuditoria = typeof registroAuditoria.$inferInsert;

export async function insertarAuditoria(
  valores: NuevaEntradaAuditoria,
): Promise<EntradaAuditoria> {
  const [fila] = await db.insert(registroAuditoria).values(valores).returning();
  return fila;
}

/** Acciones del hogar (con el nombre del admin), más recientes primero. */
export async function listarAuditoriaDeHogar(hogarId: string, desde: Date) {
  return db
    .select({
      entrada: registroAuditoria,
      adminNombre: participantes.nombre,
    })
    .from(registroAuditoria)
    .innerJoin(participantes, eq(registroAuditoria.adminId, participantes.id))
    .where(
      and(
        eq(registroAuditoria.hogarId, hogarId),
        gte(registroAuditoria.fecha, desde)
      )
    )
    .orderBy(desc(registroAuditoria.fecha));
}

/** Historial de todos los usuarios (basado en transacciones de puntos). */
export async function listarHistorialUsuarios(hogarId: string, desde: Date) {
  const ayudadoAlias = alias(participantes, "ayudadoAlias");
  // Nota: Drizzle maneja mejor los left joins encadenados así:
  const filas = await db
    .select({
      transaccion: transaccionesPuntos,
      participante: participantes,
      registro: registros,
      deber: deberes,
      ayudado: {
        id: ayudadoAlias.id,
        nombre: ayudadoAlias.nombre,
      }
    })
    .from(transaccionesPuntos)
    .innerJoin(participantes, eq(transaccionesPuntos.participanteId, participantes.id))
    .leftJoin(registros, eq(transaccionesPuntos.registroId, registros.id))
    .leftJoin(deberes, eq(registros.deberId, deberes.id))
    // Hacemos join consigo misma usando alias para sacar el nombre del que fue ayudado (si aplica)
    .leftJoin(ayudadoAlias, eq(registros.cubiertoA, ayudadoAlias.id))
    .where(
      and(
        eq(transaccionesPuntos.hogarId, hogarId),
        gte(transaccionesPuntos.fecha, desde.toISOString().split("T")[0])
      )
    )
    .orderBy(desc(transaccionesPuntos.fecha), desc(transaccionesPuntos.id));
  
  // Drizzle retorna el alias "participantes" para el último join. Es más seguro mapearlo así:
  // Como usamos dos veces participantes, Drizzle sobrescribe el alias si no tenemos cuidado,
  // pero usando la sintaxis de objeto arriba con alias { ayudado: { id: ... } } evitamos conflictos.
  return filas;
}
