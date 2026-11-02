import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tareasVoluntarias, participantes } from "@/lib/db/schema";

export type TareaVoluntaria = typeof tareasVoluntarias.$inferSelect;
export type NuevaTareaVoluntaria = typeof tareasVoluntarias.$inferInsert;

export type TareaVoluntariaConParticipante = TareaVoluntaria & {
  participanteNombre: string;
  participanteFotoUrl: string | null;
  revisorNombre?: string | null;
};

/**
 * Inserta una nueva tarea voluntaria propuesta por un participante.
 */
export async function insertarTareaVoluntaria(
  valores: NuevaTareaVoluntaria,
): Promise<TareaVoluntaria> {
  const [fila] = await db.insert(tareasVoluntarias).values(valores).returning();
  return fila;
}

/**
 * Obtiene una tarea voluntaria por su ID.
 */
export async function obtenerTareaVoluntariaPorId(
  id: string,
): Promise<TareaVoluntaria | undefined> {
  const [fila] = await db
    .select()
    .from(tareasVoluntarias)
    .where(eq(tareasVoluntarias.id, id))
    .limit(1);
  return fila;
}

/**
 * Lista las tareas voluntarias del hogar, con los datos del participante que la hizo.
 */
export async function listarTareasVoluntariasPorHogar(
  hogarId: string,
  filtroEstado?: "pendiente" | "aprobada" | "rechazada",
): Promise<TareaVoluntariaConParticipante[]> {
  const condiciones = [eq(tareasVoluntarias.hogarId, hogarId)];
  if (filtroEstado) {
    condiciones.push(eq(tareasVoluntarias.estado, filtroEstado));
  }

  const filas = await db
    .select({
      tarea: tareasVoluntarias,
      participanteNombre: participantes.nombre,
      participanteFotoUrl: participantes.fotoUrl,
    })
    .from(tareasVoluntarias)
    .innerJoin(
      participantes,
      eq(tareasVoluntarias.participanteId, participantes.id),
    )
    .where(and(...condiciones))
    .orderBy(desc(tareasVoluntarias.creadoEn));

  return filas.map((f) => ({
    ...f.tarea,
    participanteNombre: f.participanteNombre,
    participanteFotoUrl: f.participanteFotoUrl,
  }));
}

/**
 * Lista las tareas voluntarias realizadas por un participante específico.
 */
export async function listarTareasVoluntariasDeParticipante(
  participanteId: string,
  limite = 20,
): Promise<TareaVoluntaria[]> {
  return db
    .select()
    .from(tareasVoluntarias)
    .where(eq(tareasVoluntarias.participanteId, participanteId))
    .orderBy(desc(tareasVoluntarias.creadoEn))
    .limit(limite);
}

/**
 * Cuenta cuántas tareas voluntarias están en estado 'pendiente' en el hogar.
 */
export async function contarTareasVoluntariasPendientes(
  hogarId: string,
): Promise<number> {
  const filas = await db
    .select({ id: tareasVoluntarias.id })
    .from(tareasVoluntarias)
    .where(
      and(
        eq(tareasVoluntarias.hogarId, hogarId),
        eq(tareasVoluntarias.estado, "pendiente"),
      ),
    );
  return filas.length;
}

/**
 * Actualiza el estado y resolución de una tarea voluntaria (aprobar o rechazar).
 */
export async function actualizarTareaVoluntaria(
  id: string,
  cambios: Partial<TareaVoluntaria>,
): Promise<TareaVoluntaria> {
  const [fila] = await db
    .update(tareasVoluntarias)
    .set(cambios)
    .where(eq(tareasVoluntarias.id, id))
    .returning();
  return fila;
}
