import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import {
  actualizarDeber,
  type Deber,
  insertarDeber,
  listarDeberes as listarDeberesRepo,
  obtenerDeber,
} from "./deberes.repo";
import { reemplazarCriterios } from "./criterios.repo";
import { db } from "@/lib/db";
import { asignaciones } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Logica de negocio de deberes. Un deber tiene dos ejes independientes:
 *  - tipo_asignacion: como se reparte  ('rotativo' | 'reclamable')
 *  - es_obligatorio:  que tan critico es (obligatorio o no)
 * Ambos los configura libremente el admin.
 */

// Valores permitidos, derivados del tipo de la columna en el esquema.
type TipoAsignacion = Deber["tipoAsignacion"];
type Cadencia = Deber["cadencia"];

const TIPOS_ASIGNACION: readonly TipoAsignacion[] = ["rotativo", "reclamable"];
const CADENCIAS: readonly Cadencia[] = [
  "diaria",
  "dia_por_medio",
  "semanal",
  "mensual",
];

// Dias validos para `diasDisponibles`. "Toda la semana" = los 7; "fin de
// semana" = viernes, sabado, domingo.
const DIAS_SEMANA: readonly string[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

export type CrearDeberInput = {
  nombre: string;
  tipoAsignacion: TipoAsignacion;
  esObligatorio: boolean;
  esPersonal?: boolean;
  puntos: number;
  cadencia: Cadencia;
  // Dias en que el deber se muestra. Si se omite, se asume toda la semana.
  diasDisponibles?: string[];
  // Cupo total de reclamos por periodo (solo reclamables). Null = sin limite.
  maxReclamos?: number | null;
  requiereFoto?: boolean;
  asignadoA?: string | null;
  limitePorPersona?: boolean;
  // Lista de descripciones de los criterios
  criterios?: string[];
};

export type EditarDeberInput = Partial<CrearDeberInput>;

/** Lista los deberes del hogar actual (por defecto solo activos). */
export async function listarDeberes(opciones?: {
  incluirInactivos?: boolean;
}): Promise<Deber[]> {
  const hogarId = await obtenerHogarActualId();
  return listarDeberesRepo(hogarId, opciones);
}

// ── Validaciones compartidas ────────────────────────────────────────────────

function validarNombre(nombre: string): string {
  const limpio = nombre?.trim();
  if (!limpio) throw new Error("El nombre del deber es obligatorio.");
  return limpio;
}

function validarPuntos(puntos: number): void {
  if (!Number.isFinite(puntos) || puntos < 0) {
    throw new Error("Los puntos deben ser un numero mayor o igual a cero.");
  }
}

function validarTipoAsignacion(valor: TipoAsignacion): void {
  if (!TIPOS_ASIGNACION.includes(valor)) {
    throw new Error("El tipo de asignacion no es valido.");
  }
}

function validarCadencia(valor: Cadencia): void {
  if (!CADENCIAS.includes(valor)) {
    throw new Error("La cadencia no es valida.");
  }
}

/** Limpia y valida la lista de dias en que el deber se muestra. */
function validarDiasDisponibles(dias: string[]): string[] {
  const limpios = dias.map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (limpios.length === 0) {
    throw new Error("Debe indicar al menos un dia de disponibilidad.");
  }
  for (const dia of limpios) {
    if (!DIAS_SEMANA.includes(dia)) {
      throw new Error(`Dia de disponibilidad no valido: "${dia}".`);
    }
  }
  // Sin duplicados y en orden de la semana.
  return DIAS_SEMANA.filter((d) => limpios.includes(d));
}

/**
 * Valida el cupo de reclamos. Solo aplica a reclamables; si se envia para un
 * deber no reclamable es un error. Null = sin limite.
 */
function validarMaxReclamos(
  maxReclamos: number | null | undefined,
  tipoAsignacion: TipoAsignacion,
): number | null {
  if (maxReclamos === null || maxReclamos === undefined) return null;
  if (tipoAsignacion !== "reclamable") {
    throw new Error("El cupo de reclamos solo aplica a deberes reclamables.");
  }
  if (!Number.isInteger(maxReclamos) || maxReclamos < 1) {
    throw new Error("El cupo de reclamos debe ser un entero mayor o igual a 1.");
  }
  return maxReclamos;
}

/**
 * Crea un deber en el hogar actual. `puntos` se guarda como texto porque la
 * columna es numeric (soporta decimales como 2.5 sin errores de redondeo).
 */
export async function crearDeber(input: CrearDeberInput): Promise<Deber> {
  const nombre = validarNombre(input.nombre);
  validarPuntos(input.puntos);
  validarTipoAsignacion(input.tipoAsignacion);
  validarCadencia(input.cadencia);
  const maxReclamos = validarMaxReclamos(
    input.maxReclamos,
    input.tipoAsignacion,
  );
  // Si no se envian dias, el deber se muestra toda la semana (los 7 dias).
  const diasDisponibles =
    input.diasDisponibles === undefined
      ? DIAS_SEMANA.slice()
      : validarDiasDisponibles(input.diasDisponibles);

  const hogarId = await obtenerHogarActualId();

  const deber = await insertarDeber({
    hogarId,
    nombre,
    tipoAsignacion: input.tipoAsignacion,
    esObligatorio: input.esObligatorio,
    esPersonal: input.esPersonal ?? false,
    puntos: String(input.puntos),
    cadencia: input.cadencia,
    diasDisponibles,
    maxReclamos,
    requiereFoto: input.requiereFoto ?? false,
    asignadoA: input.asignadoA ?? null,
    limitePorPersona: input.limitePorPersona ?? false,
  });

  if (input.criterios) {
    const nuevosCriterios = input.criterios.map((desc, idx) => ({
      descripcion: desc,
      orden: idx,
    }));
    await reemplazarCriterios(deber.id, nuevosCriterios);
  }

  return deber;
}

/** Edita un deber existente. Solo toca los campos que se envien. */
export async function editarDeber(
  id: string,
  input: EditarDeberInput,
): Promise<Deber> {
  const existente = await obtenerDeber(id);
  if (!existente) throw new Error("El deber no existe.");

  const cambios: Partial<{
    nombre: string;
    tipoAsignacion: TipoAsignacion;
    esObligatorio: boolean;
    esPersonal: boolean;
    puntos: string;
    cadencia: Cadencia;
    diasDisponibles: string[];
    maxReclamos: number | null;
    requiereFoto: boolean;
    asignadoA: string | null;
    limitePorPersona: boolean;
  }> = {};

  if (input.nombre !== undefined) cambios.nombre = validarNombre(input.nombre);
  if (input.puntos !== undefined) {
    validarPuntos(input.puntos);
    cambios.puntos = String(input.puntos);
  }
  if (input.tipoAsignacion !== undefined) {
    validarTipoAsignacion(input.tipoAsignacion);
    cambios.tipoAsignacion = input.tipoAsignacion;
  }
  if (input.cadencia !== undefined) {
    validarCadencia(input.cadencia);
    cambios.cadencia = input.cadencia;
  }
  if (input.diasDisponibles !== undefined) {
    cambios.diasDisponibles = validarDiasDisponibles(input.diasDisponibles);
  }
  if (input.maxReclamos !== undefined) {
    cambios.maxReclamos = validarMaxReclamos(
      input.maxReclamos,
      input.tipoAsignacion ??
        (existente.tipoAsignacion as unknown as TipoAsignacion),
    );
  }
  if (input.esObligatorio !== undefined) cambios.esObligatorio = input.esObligatorio;
  if (input.esPersonal !== undefined) cambios.esPersonal = input.esPersonal;
  if (input.requiereFoto !== undefined)
    cambios.requiereFoto = input.requiereFoto;
  if (input.asignadoA !== undefined) {
    cambios.asignadoA = input.asignadoA;
  }
  if (input.limitePorPersona !== undefined) {
    cambios.limitePorPersona = input.limitePorPersona;
  }

  const actualizado = await actualizarDeber(id, cambios);
  if (!actualizado) throw new Error("No se pudo actualizar el deber.");

  if (input.criterios !== undefined) {
    const nuevosCriterios = input.criterios.map((desc, idx) => ({
      descripcion: desc,
      orden: idx,
    }));
    await reemplazarCriterios(id, nuevosCriterios);
  }

  return actualizado;
}

/**
 * Baja logica: marca el deber como inactivo en vez de borrarlo, para conservar
 * el historial de registros y puntos ya asociados a el.
 */
export async function desactivarDeber(id: string): Promise<Deber> {
  const existente = await obtenerDeber(id);
  if (!existente) throw new Error("El deber no existe.");

  const actualizado = await actualizarDeber(id, { activo: false });
  if (!actualizado) throw new Error("No se pudo desactivar el deber.");

  // Limpiar asignaciones pendientes del deber desactivado para que no aparezca en el plan ni en la vista diaria
  await db.delete(asignaciones).where(eq(asignaciones.deberId, id));

  return actualizado;
}


/** Reactiva un deber que estaba inactivo. */
export async function reactivarDeber(id: string): Promise<Deber> {
  const existente = await obtenerDeber(id);
  if (!existente) throw new Error("El deber no existe.");

  const actualizado = await actualizarDeber(id, { activo: true });
  if (!actualizado) throw new Error("No se pudo reactivar el deber.");
  return actualizado;
}
