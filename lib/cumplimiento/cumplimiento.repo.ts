import { and, between, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { asignaciones, registros } from "@/lib/db/schema";

/**
 * Acceso a datos del motor de cumplimiento: asignaciones del día y el historial
 * de `registros`. Solo consultas; las reglas viven en cumplimiento.service.ts.
 */

export type Registro = typeof registros.$inferSelect;
export type NuevoRegistro = typeof registros.$inferInsert;

/**
 * Busca la asignación de un deber rotativo para una persona en una fecha.
 * Sirve para saber si "este deber le toca hoy" a quien lo marca.
 */
export async function obtenerAsignacion(
  hogarId: string,
  deberId: string,
  participanteId: string,
  fechaStr: string,
) {
  const [fila] = await db
    .select()
    .from(asignaciones)
    .where(
      and(
        eq(asignaciones.hogarId, hogarId),
        eq(asignaciones.deberId, deberId),
        eq(asignaciones.participanteId, participanteId),
        eq(asignaciones.fecha, fechaStr),
      ),
    )
    .limit(1);
  return fila;
}

/** A quién le tocaba un deber concreto en una fecha (para validar coberturas). */
export async function obtenerAsignacionDeDeber(
  hogarId: string,
  deberId: string,
  fechaStr: string,
) {
  const [fila] = await db
    .select()
    .from(asignaciones)
    .where(
      and(
        eq(asignaciones.hogarId, hogarId),
        eq(asignaciones.deberId, deberId),
        eq(asignaciones.fecha, fechaStr),
      ),
    )
    .limit(1);
  return fila;
}

/** Busca un registro existente (para no duplicar la misma marca el mismo día). */
export async function buscarRegistro(
  deberId: string,
  participanteId: string,
  fechaStr: string,
  estado: Registro["estado"],
): Promise<Registro | undefined> {
  const [fila] = await db
    .select()
    .from(registros)
    .where(
      and(
        eq(registros.deberId, deberId),
        eq(registros.participanteId, participanteId),
        eq(registros.fecha, fechaStr),
        eq(registros.estado, estado),
      ),
    )
    .limit(1);
  return fila;
}

/** Busca una cobertura existente de un participante hacia otro para un deber y fecha. */
export async function buscarRegistroCobertura(
  deberId: string,
  participanteId: string,
  cubiertoA: string,
  fechaStr: string,
): Promise<Registro | undefined> {
  const [fila] = await db
    .select()
    .from(registros)
    .where(
      and(
        eq(registros.deberId, deberId),
        eq(registros.participanteId, participanteId),
        eq(registros.cubiertoA, cubiertoA),
        eq(registros.fecha, fechaStr),
        eq(registros.estado, "cubrio_a_otro"),
      ),
    )
    .limit(1);
  return fila;
}

/** Lista todos los registros de un deber en una fecha (cumplido_propio y cubrio_a_otro). */
export async function listarRegistrosDeDeberEnFecha(
  deberId: string,
  fechaStr: string,
): Promise<Registro[]> {
  return db
    .select()
    .from(registros)
    .where(and(eq(registros.deberId, deberId), eq(registros.fecha, fechaStr)));
}

/** Lista las asignaciones de un participante en una fecha. */
export async function listarAsignacionesDeParticipante(
  participanteId: string,
  fechaStr: string,
) {
  return db
    .select()
    .from(asignaciones)
    .where(
      and(
        eq(asignaciones.participanteId, participanteId),
        eq(asignaciones.fecha, fechaStr),
      ),
    );
}

/** Devuelve un registro por id (o undefined). */
export async function obtenerRegistroPorId(
  id: string,
): Promise<Registro | undefined> {
  const [fila] = await db
    .select()
    .from(registros)
    .where(eq(registros.id, id))
    .limit(1);
  return fila;
}

/**
 * ¿La persona ya tiene un registro propio ese día?
 */
export async function existeCumplidoPropio(
  participanteId: string,
  fechaStr: string,
): Promise<boolean> {
  const [fila] = await db
    .select({ id: registros.id })
    .from(registros)
    .where(
      and(
        eq(registros.participanteId, participanteId),
        eq(registros.fecha, fechaStr),
        eq(registros.estado, "cumplido_propio"),
      ),
    )
    .limit(1);
  return Boolean(fila);
}

/** Coberturas que hizo una persona en un día (para reintentar otorgar el bono). */
export async function listarCoberturasDelDia(
  participanteId: string,
  fechaStr: string,
  opciones?: { soloConfirmadas?: boolean },
): Promise<Registro[]> {
  const condiciones = [
    eq(registros.participanteId, participanteId),
    eq(registros.fecha, fechaStr),
    eq(registros.estado, "cubrio_a_otro"),
  ];
  if (opciones?.soloConfirmadas) {
    condiciones.push(eq(registros.confirmado, true));
  }
  return db
    .select()
    .from(registros)
    .where(and(...condiciones));
}

/**
 * Cuenta los reclamos (`estado = 'reclamado'`) de un deber dentro de un rango de
 * fechas. Si se pasa `participanteId`, cuenta solo los de esa persona (cupo
 * personal); si no, cuenta los de todo el hogar (cupo comunitario).
 */
export async function contarReclamos(
  deberId: string,
  desdeStr: string,
  hastaStr: string,
  participanteId?: string,
): Promise<number> {
  const condiciones = [
    eq(registros.deberId, deberId),
    eq(registros.estado, "reclamado"),
    between(registros.fecha, desdeStr, hastaStr),
  ];
  if (participanteId) {
    condiciones.push(eq(registros.participanteId, participanteId));
  }
  const filas = await db
    .select({ id: registros.id })
    .from(registros)
    .where(and(...condiciones));
  return filas.length;
}

/** Inserta un registro en el historial y lo devuelve. */
export async function insertarRegistro(
  valores: NuevoRegistro,
): Promise<Registro> {
  const [fila] = await db.insert(registros).values(valores).returning();
  return fila;
}

/** Actualiza un registro (ej. confirmar una cobertura) y lo devuelve. */
export async function actualizarRegistro(
  id: string,
  cambios: Partial<NuevoRegistro>,
): Promise<Registro | undefined> {
  const [fila] = await db
    .update(registros)
    .set(cambios)
    .where(eq(registros.id, id))
    .returning();
  return fila;
}
