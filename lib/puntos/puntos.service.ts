import {
  actualizarCantidadTransaccion,
  buscarTransaccion,
  insertarTransaccion,
  type NuevaTransaccion,
  type Transaccion,
} from "./puntos.repo";

/**
 * Motor de puntos — el libro mayor.
 *
 * Regla inmutable: los puntos NO se guardan sueltos ni se sobrescriben. Cada
 * suma o resta es una fila en `transacciones_puntos`. Los rankings se calculan
 * después sumando estas filas. Las correcciones del admin son filas nuevas de
 * tipo `ajuste_admin`, nunca ediciones.
 *
 * Este servicio traduce un evento del motor de cumplimiento (un `registro`) a la
 * cantidad y el tipo correctos, según la matriz de puntos de docs/03.
 *
 * SEGURIDAD: esta lógica vive solo en el servidor. El navegador nunca calcula
 * puntos; se blindará además con Row-Level Security en Supabase.
 */

/** Datos mínimos de un registro que el motor de puntos necesita. */
type RegistroBase = {
  id: string;
  hogarId: string;
  participanteId: string;
  fecha: string;
};

/** Redondea a máximo 2 decimales limpios (ej. 3.33, 7.5, 10). */
export function redondearPuntos(valor: number): string {
  return String(Math.round(valor * 100) / 100);
}

/**
 * Inserta o sincroniza una transacción de forma IDEMPOTENTE para un registro:
 * si ya existe una del mismo registro y tipo, actualiza su cantidad si cambió
 * (por ejemplo, cuando el participante completa más criterios del mismo deber
 * durante el día) o no hace nada si ya tiene el mismo valor.
 */
async function registrarUnaVez(
  valores: NuevaTransaccion,
): Promise<Transaccion | null> {
  if (valores.registroId) {
    const existente = await buscarTransaccion(valores.registroId, valores.tipo);
    if (existente) {
      if (Number(existente.cantidad) !== Number(valores.cantidad)) {
        return actualizarCantidadTransaccion(existente.id, valores.cantidad);
      }
      return null;
    }
  }
  return insertarTransaccion(valores);
}

/**
 * Cumplir el deber propio: suma los puntos del deber (o fracción proporcional).
 * Afecta General y Confiable.
 */
export async function otorgarCumplimiento(
  registro: RegistroBase,
  puntosDeber: string,
  fraccion: number = 1,
): Promise<Transaccion | null> {
  const cantidad = redondearPuntos(Number(puntosDeber) * fraccion);
  return registrarUnaVez({
    hogarId: registro.hogarId,
    participanteId: registro.participanteId,
    registroId: registro.id,
    cantidad,
    tipo: "cumplimiento",
    fecha: registro.fecha,
  });
}

/**
 * Reclamar un extra: suma los puntos del deber. Afecta General y Responsable.
 */
export async function otorgarReclamable(
  registro: RegistroBase,
  puntosDeber: string,
  fraccion: number = 1,
): Promise<Transaccion | null> {
  const cantidad = redondearPuntos(Number(puntosDeber) * fraccion);
  return registrarUnaVez({
    hogarId: registro.hogarId,
    participanteId: registro.participanteId,
    registroId: registro.id,
    cantidad,
    tipo: "reclamable",
    fecha: registro.fecha,
  });
}

/**
 * Bono por cubrir a otro: suma la fracción proporcional de (puntos del deber MÁS
 * el bono de ayuda del hogar). Afecta General y Solidario. El que llama
 * (cumplimiento.service) ya verificó que el participante hizo su propio deber.
 */
export async function otorgarBonoAyuda(
  registro: RegistroBase,
  puntosDeber: string,
  bonoAyuda: number,
  fraccion: number = 1,
): Promise<Transaccion | null> {
  const totalBase = Number(puntosDeber) + bonoAyuda;
  const cantidad = redondearPuntos(totalBase * fraccion);
  return registrarUnaVez({
    hogarId: registro.hogarId,
    participanteId: registro.participanteId,
    registroId: registro.id,
    cantidad,
    tipo: "bono_ayuda",
    fecha: registro.fecha,
  });
}

/**
 * Penalización por fallar el deber propio sin razón válida (Art. 5.1): resta
 * `penalizacion_fallo`. Afecta General y Confiable. No lleva `registroId`
 * (no hay registro: justamente NO se hizo); la idempotencia la garantiza el
 * motor de cierre, que no cierra dos veces el mismo día.
 */
export async function otorgarPenalizacionFallo(
  hogarId: string,
  participanteId: string,
  fechaStr: string,
  monto: number,
): Promise<Transaccion> {
  return insertarTransaccion({
    hogarId,
    participanteId,
    registroId: null,
    cantidad: redondearPuntos(-Math.abs(monto)),
    tipo: "penalizacion",
    fecha: fechaStr,
  });
}

/**
 * Penalización colectiva (Art. 5.2): cuando un deber no negociable no lo hizo
 * nadie, los tres pierden `penalizacion_colectiva`. Afecta General. Se llama
 * una vez por cada participante.
 */
export async function otorgarPenalizacionColectiva(
  hogarId: string,
  participanteId: string,
  fechaStr: string,
  monto: number,
): Promise<Transaccion> {
  return insertarTransaccion({
    hogarId,
    participanteId,
    registroId: null,
    cantidad: String(-Math.abs(monto)),
    tipo: "penalizacion_colectiva",
    fecha: fechaStr,
  });
}
