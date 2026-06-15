import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import {
  actualizarDeber,
  type Deber,
  insertarDeber,
  listarDeberes as listarDeberesRepo,
  obtenerDeber,
} from "./deberes.repo";

/**
 * Logica de negocio de deberes. Un deber tiene dos ejes independientes:
 *  - tipo_asignacion: como se reparte  ('rotativo' | 'reclamable')
 *  - es_obligatorio:  que tan critico es (no negociable o no)
 * Ambos los configura libremente el admin.
 */

// Valores permitidos, derivados del tipo de la columna en el esquema.
type TipoAsignacion = Deber["tipoAsignacion"];
type Cadencia = Deber["cadencia"];

const TIPOS_ASIGNACION: readonly TipoAsignacion[] = ["rotativo", "reclamable"];
const CADENCIAS: readonly Cadencia[] = [
  "diaria",
  "fin_de_semana",
  "dia_por_medio",
  "mensual",
];

export type CrearDeberInput = {
  nombre: string;
  tipoAsignacion: TipoAsignacion;
  esObligatorio: boolean;
  esPersonal?: boolean;
  puntos: number;
  cadencia: Cadencia;
  requiereFoto?: boolean;
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

/**
 * Crea un deber en el hogar actual. `puntos` se guarda como texto porque la
 * columna es numeric (soporta decimales como 2.5 sin errores de redondeo).
 */
export async function crearDeber(input: CrearDeberInput): Promise<Deber> {
  const nombre = validarNombre(input.nombre);
  validarPuntos(input.puntos);
  validarTipoAsignacion(input.tipoAsignacion);
  validarCadencia(input.cadencia);

  const hogarId = await obtenerHogarActualId();

  return insertarDeber({
    hogarId,
    nombre,
    tipoAsignacion: input.tipoAsignacion,
    esObligatorio: input.esObligatorio,
    esPersonal: input.esPersonal ?? false,
    puntos: String(input.puntos),
    cadencia: input.cadencia,
    requiereFoto: input.requiereFoto ?? false,
  });
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
    requiereFoto: boolean;
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
  if (input.esObligatorio !== undefined) cambios.esObligatorio = input.esObligatorio;
  if (input.esPersonal !== undefined) cambios.esPersonal = input.esPersonal;
  if (input.requiereFoto !== undefined) cambios.requiereFoto = input.requiereFoto;

  const actualizado = await actualizarDeber(id, cambios);
  if (!actualizado) throw new Error("No se pudo actualizar el deber.");
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
