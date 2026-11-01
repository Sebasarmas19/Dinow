import { and, between, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  deberes,
  hogar,
  solicitudesIntercambio,
  titulosMes,
} from "@/lib/db/schema";

/**
 * Repositorio para el motor de "Deberes Wrapped" (Resumen Mensual Interactivo).
 * Consulta los metadatos del hogar, el catálogo completo de deberes (activos e
 * inactivos para preservar nombres históricos), intercambios del período y
 * títulos oficiales otorgados.
 */

export async function obtenerHogarWrapped(hogarId: string) {
  const [fila] = await db.select().from(hogar).where(eq(hogar.id, hogarId)).limit(1);
  return fila;
}

export async function listarTodosLosDeberesDelHogar(hogarId: string) {
  return db.select().from(deberes).where(eq(deberes.hogarId, hogarId));
}

export async function listarIntercambiosEnRango(
  hogarId: string,
  desde: string,
  hasta: string,
) {
  return db
    .select()
    .from(solicitudesIntercambio)
    .where(
      and(
        eq(solicitudesIntercambio.hogarId, hogarId),
        between(solicitudesIntercambio.fecha, desde, hasta),
      ),
    );
}

export async function listarTitulosGuardadosDelMes(
  participanteIds: string[],
  mes: string,
) {
  if (participanteIds.length === 0) return [];
  return db
    .select()
    .from(titulosMes)
    .where(
      and(
        inArray(titulosMes.participanteId, participanteIds),
        eq(titulosMes.mes, mes),
      ),
    );
}
