import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import {
  actualizarParticipante,
  insertarParticipante,
  listarParticipantes as listarParticipantesRepo,
  obtenerMaxOrdenRotacion,
  obtenerParticipante,
  type Participante,
} from "./participantes.repo";

/**
 * Logica de negocio de participantes. Valida, aplica reglas y coordina el repo.
 * No habla directo con la base de datos.
 */

export type CrearParticipanteInput = {
  nombre: string;
  fotoUrl?: string | null;
  esAdmin?: boolean;
};

export type EditarParticipanteInput = {
  nombre?: string;
  fotoUrl?: string | null;
  esAdmin?: boolean;
};

/** Lista los participantes del hogar actual (por defecto solo activos). */
export async function listarParticipantes(opciones?: {
  incluirInactivos?: boolean;
}): Promise<Participante[]> {
  const hogarId = await obtenerHogarActualId();
  return listarParticipantesRepo(hogarId, opciones);
}

/**
 * Crea un participante en el hogar actual. Le asigna la siguiente posicion
 * libre en la rotacion (el ultimo + 1, o 1 si es el primero).
 */
export async function crearParticipante(
  input: CrearParticipanteInput,
): Promise<Participante> {
  const nombre = input.nombre?.trim();
  if (!nombre) {
    throw new Error("El nombre del participante es obligatorio.");
  }

  const hogarId = await obtenerHogarActualId();
  const maxOrden = await obtenerMaxOrdenRotacion(hogarId);
  const ordenRotacion = (maxOrden ?? 0) + 1;

  return insertarParticipante({
    hogarId,
    nombre,
    fotoUrl: input.fotoUrl?.trim() || null,
    esAdmin: input.esAdmin ?? false,
    ordenRotacion,
  });
}

/** Edita los datos basicos de un participante existente. */
export async function editarParticipante(
  id: string,
  input: EditarParticipanteInput,
): Promise<Participante> {
  const existente = await obtenerParticipante(id);
  if (!existente) {
    throw new Error("El participante no existe.");
  }

  const cambios: EditarParticipanteInput = {};
  if (input.nombre !== undefined) {
    const nombre = input.nombre.trim();
    if (!nombre) throw new Error("El nombre no puede quedar vacio.");
    cambios.nombre = nombre;
  }
  if (input.fotoUrl !== undefined) {
    cambios.fotoUrl = input.fotoUrl?.trim() || null;
  }
  if (input.esAdmin !== undefined) {
    cambios.esAdmin = input.esAdmin;
  }

  const actualizado = await actualizarParticipante(id, cambios);
  if (!actualizado) throw new Error("No se pudo actualizar el participante.");
  return actualizado;
}

/**
 * Baja logica: marca al participante como inactivo en vez de borrarlo, para
 * conservar su historial (registros y transacciones de puntos). Lo saca de la
 * rotacion sin perder lo que ya hizo.
 */
export async function desactivarParticipante(
  id: string,
): Promise<Participante> {
  const existente = await obtenerParticipante(id);
  if (!existente) {
    throw new Error("El participante no existe.");
  }

  const actualizado = await actualizarParticipante(id, { activo: false });
  if (!actualizado) throw new Error("No se pudo desactivar el participante.");
  return actualizado;
}

/** Reactiva a un participante que estaba inactivo. */
export async function reactivarParticipante(
  id: string,
): Promise<Participante> {
  const existente = await obtenerParticipante(id);
  if (!existente) {
    throw new Error("El participante no existe.");
  }

  const actualizado = await actualizarParticipante(id, { activo: true });
  if (!actualizado) throw new Error("No se pudo reactivar el participante.");
  return actualizado;
}
