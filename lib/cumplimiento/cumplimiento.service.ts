import { obtenerCriteriosDeDeber, obtenerDeber } from "@/lib/deberes/deberes.repo";
import { obtenerHogarActual } from "@/lib/hogar/hogar.service";
import {
  otorgarBonoAyuda,
  otorgarCumplimiento,
  otorgarReclamable,
} from "@/lib/puntos/puntos.service";
import {
  formatearFechaISO,
  nombreDiaSemana,
  obtenerFechaDeNegocio,
  rangoPeriodo,
} from "@/lib/shared/date";
import {
  actualizarRegistro,
  buscarRegistro,
  buscarRegistroCobertura,
  contarReclamos,
  insertarRegistro,
  listarAsignacionesDeParticipante,
  listarCoberturasDelDia,
  listarRegistrosDeDeberEnFecha,
  obtenerAsignacion,
  obtenerAsignacionDeDeber,
  obtenerRegistroPorId,
  type Registro,
} from "./cumplimiento.repo";

/**
 * Motor de cumplimiento.
 *
 * Es el corazón del día a día: traduce las acciones de los participantes
 * ("ya cociné", "cubrí un criterio de mi hermano", "reclamo el extra") en
 * filas del historial (`registros`) y dispara los puntos correspondientes a
 * través del motor de puntos.
 */

/**
 * Verifica si el participante ya completó el 100% de sus propios deberes
 * rotativos del día (incluyendo todos los criterios que no hayan sido cubiertos
 * por un hermano). Requisito para que su bono_ayuda se desbloquee.
 */
export async function cumplioDeberPropioDelDia(
  participanteId: string,
  fechaStr: string,
): Promise<boolean> {
  const misAsignaciones = await listarAsignacionesDeParticipante(
    participanteId,
    fechaStr,
  );
  if (misAsignaciones.length === 0) return true; // Día libre

  for (const asig of misAsignaciones) {
    const deber = await obtenerDeber(asig.deberId);
    if (!deber || !deber.activo || deber.esPersonal) continue;

    const [criterios, registrosHoy] = await Promise.all([
      obtenerCriteriosDeDeber(deber.id),
      listarRegistrosDeDeberEnFecha(deber.id, fechaStr),
    ]);

    const miRegistroPropio = registrosHoy.find(
      (r) =>
        r.estado === "cumplido_propio" && r.participanteId === participanteId,
    );

    // Debe haber participado en su propio deber (al menos un criterio propio o todo el deber si no tiene criterios)
    if (!miRegistroPropio) return false;

    if (criterios.length > 0 && miRegistroPropio.criteriosIds !== null) {
      // Todos los criterios del deber deben estar cubiertos entre él y posibles ayudas
      const criteriosCompletados = new Set<string>();
      for (const r of registrosHoy) {
        if (r.estado !== "cumplido_propio" && r.estado !== "cubrio_a_otro") continue;
        if (r.criteriosIds === null) {
          criterios.forEach((c) => criteriosCompletados.add(c.id));
        } else {
          r.criteriosIds.forEach((id) => criteriosCompletados.add(id));
        }
      }
      const todosHechos = criterios.every((c) => criteriosCompletados.has(c.id));
      if (!todosHechos) return false;
    }
  }

  return true;
}

/**
 * Marca el deber propio (rotativo, asignado hoy) como cumplido, ya sea completo
 * o seleccionando criterios específicos de aceptación.
 */
export async function marcarCumplido(input: {
  deberId: string;
  participanteId: string;
  criteriosIds?: string[];
  fotoUrl?: string | null;
  nota?: string | null;
}): Promise<Registro> {
  const deber = await obtenerDeber(input.deberId);
  if (!deber || !deber.activo) throw new Error("El deber no existe o está inactivo.");
  if (deber.tipoAsignacion === "reclamable") {
    throw new Error("Este deber es reclamable; usa la opción de reclamar extra.");
  }

  const fecha = obtenerFechaDeNegocio();
  const fechaStr = formatearFechaISO(fecha);

  // Debe estar asignado a esta persona hoy.
  const asignacion = await obtenerAsignacion(
    deber.hogarId,
    deber.id,
    input.participanteId,
    fechaStr,
  );
  if (!asignacion) throw new Error("Este deber no te toca hoy.");

  const [criterios, registrosDeberHoy] = await Promise.all([
    obtenerCriteriosDeDeber(deber.id),
    listarRegistrosDeDeberEnFecha(deber.id, fechaStr),
  ]);

  const yaMarcado = registrosDeberHoy.find(
    (r) =>
      r.estado === "cumplido_propio" &&
      r.participanteId === input.participanteId,
  );

  // Si el deber NO tiene criterios configurados (ej. extra personal simple), flujo 100% clásico
  if (criterios.length === 0) {
    if (yaMarcado) throw new Error("Ya marcaste este deber como cumplido hoy.");
    const registro = await insertarRegistro({
      hogarId: deber.hogarId,
      deberId: deber.id,
      participanteId: input.participanteId,
      fecha: fechaStr,
      estado: "cumplido_propio",
      confirmado: true,
      criteriosIds: null,
      fotoUrl: input.fotoUrl,
      nota: input.nota,
    });

    if (deber.esPersonal) {
      await otorgarReclamable(registro, deber.puntos, 1);
    } else {
      await otorgarCumplimiento(registro, deber.puntos, 1);
    }

    const coberturas = await listarCoberturasDelDia(input.participanteId, fechaStr, {
      soloConfirmadas: true,
    });
    for (const cobertura of coberturas) {
      await intentarOtorgarBono(cobertura);
    }

    return registro;
  }

  // El deber SÍ tiene criterios de aceptación configurados.
  // 1. Identificar qué criterios ya fueron cubiertos por otros hermanos hoy.
  const idsValidos = new Set(criterios.map((c) => c.id));
  const cubiertosPorOtros = new Set<string>();
  for (const r of registrosDeberHoy) {
    if (r.estado === "cubrio_a_otro" && r.cubiertoA === input.participanteId) {
      if (r.criteriosIds === null) {
        criterios.forEach((c) => cubiertosPorOtros.add(c.id));
      } else {
        r.criteriosIds.forEach((id) => cubiertosPorOtros.add(id));
      }
    }
  }

  const yaMarcadosPorMi = new Set<string>(
    yaMarcado
      ? yaMarcado.criteriosIds === null
        ? criterios.map((c) => c.id)
        : yaMarcado.criteriosIds
      : [],
  );

  // 2. Determinar qué criterios está marcando ahora el dueño
  const solicitados =
    input.criteriosIds && input.criteriosIds.length > 0
      ? input.criteriosIds.filter(
          (id) => idsValidos.has(id) && !cubiertosPorOtros.has(id),
        )
      : criterios
          .map((c) => c.id)
          .filter((id) => !cubiertosPorOtros.has(id));

  if (solicitados.length === 0) {
    throw new Error("Esos criterios ya fueron cubiertos por un hermano hoy.");
  }

  const nuevosTotales = Array.from(new Set([...yaMarcadosPorMi, ...solicitados]));
  if (yaMarcado && nuevosTotales.length === yaMarcadosPorMi.size) {
    throw new Error("Ya marcaste estos criterios como cumplidos hoy.");
  }

  let registro: Registro;
  if (yaMarcado) {
    const actualizado = await actualizarRegistro(yaMarcado.id, {
      criteriosIds: nuevosTotales,
      fotoUrl: input.fotoUrl ?? yaMarcado.fotoUrl,
      nota: input.nota ?? yaMarcado.nota,
    });
    if (!actualizado) throw new Error("No se pudo actualizar el progreso del deber.");
    registro = actualizado;
  } else {
    registro = await insertarRegistro({
      hogarId: deber.hogarId,
      deberId: deber.id,
      participanteId: input.participanteId,
      fecha: fechaStr,
      estado: "cumplido_propio",
      confirmado: true,
      criteriosIds: nuevosTotales,
      fotoUrl: input.fotoUrl,
      nota: input.nota,
    });
  }

  const fraccion = nuevosTotales.length / criterios.length;
  if (deber.esPersonal) {
    await otorgarReclamable(registro, deber.puntos, fraccion);
  } else {
    await otorgarCumplimiento(registro, deber.puntos, fraccion);
  }

  // Si ahora completó el 100% de su deber del día, desbloquear bonos pendientes de coberturas que haya hecho hoy
  const coberturas = await listarCoberturasDelDia(input.participanteId, fechaStr, {
    soloConfirmadas: true,
  });
  for (const cobertura of coberturas) {
    await intentarOtorgarBono(cobertura);
  }

  return registro;
}

/**
 * Registra que una persona cubrió el deber (o ciertos criterios de aceptación)
 * de su hermano.
 */
export async function cubrirDeber(input: {
  deberId: string;
  participanteId: string; // quien cubre
  cubiertoA: string; // a quién cubre
  criteriosIds?: string[]; // criterios específicos que cubrió
  nota?: string | null;
  fotoUrl?: string | null;
}): Promise<Registro> {
  const deber = await obtenerDeber(input.deberId);
  if (!deber || !deber.activo) throw new Error("El deber no existe o está inactivo.");
  if (input.cubiertoA === input.participanteId) {
    throw new Error("No puedes cubrirte a ti mismo.");
  }

  // Cubrir requiere justificación: una nota o una foto (Art. 3.4).
  const nota = input.nota?.trim() || null;
  const fotoUrl = input.fotoUrl?.trim() || null;
  if (!nota && !fotoUrl) {
    throw new Error("Cubrir a otro requiere una justificación (nota o foto).");
  }

  const fecha = obtenerFechaDeNegocio();
  const fechaStr = formatearFechaISO(fecha);

  // El deber tiene que tocarle hoy a la persona cubierta.
  const asignacionDelOtro = await obtenerAsignacionDeDeber(
    deber.hogarId,
    deber.id,
    fechaStr,
  );
  if (!asignacionDelOtro || asignacionDelOtro.participanteId !== input.cubiertoA) {
    throw new Error("Ese deber no le tocaba a esa persona hoy.");
  }

  const [criterios, registrosDeberHoy, yaCubiertoPorMi] = await Promise.all([
    obtenerCriteriosDeDeber(deber.id),
    listarRegistrosDeDeberEnFecha(deber.id, fechaStr),
    buscarRegistroCobertura(
      deber.id,
      input.participanteId,
      input.cubiertoA,
      fechaStr,
    ),
  ]);

  if (criterios.length === 0) {
    if (yaCubiertoPorMi) throw new Error("Ya registraste esta cobertura hoy.");
    const registro = await insertarRegistro({
      hogarId: deber.hogarId,
      deberId: deber.id,
      participanteId: input.participanteId,
      fecha: fechaStr,
      estado: "cubrio_a_otro",
      cubiertoA: input.cubiertoA,
      criteriosIds: null,
      nota,
      fotoUrl,
      confirmado: true,
    });
    await intentarOtorgarBono(registro);
    return registro;
  }

  // Identificar qué criterios ya fueron cumplidos por el dueño o cubiertos por OTRO hermano distinto a mí
  const idsValidos = new Set(criterios.map((c) => c.id));
  const ocupadosPorOtros = new Set<string>();
  for (const r of registrosDeberHoy) {
    if (r.id === yaCubiertoPorMi?.id) continue;
    if (r.estado === "cumplido_propio" || r.estado === "cubrio_a_otro") {
      if (r.criteriosIds === null) {
        criterios.forEach((c) => ocupadosPorOtros.add(c.id));
      } else {
        r.criteriosIds.forEach((id) => ocupadosPorOtros.add(id));
      }
    }
  }

  const yaCubiertosPorMiSet = new Set<string>(
    yaCubiertoPorMi
      ? yaCubiertoPorMi.criteriosIds === null
        ? criterios.map((c) => c.id)
        : yaCubiertoPorMi.criteriosIds
      : [],
  );

  const solicitados =
    input.criteriosIds && input.criteriosIds.length > 0
      ? input.criteriosIds.filter(
          (id) => idsValidos.has(id) && !ocupadosPorOtros.has(id),
        )
      : criterios
          .map((c) => c.id)
          .filter((id) => !ocupadosPorOtros.has(id));

  if (solicitados.length === 0) {
    throw new Error(
      "Los criterios seleccionados ya fueron cumplidos o cubiertos hoy.",
    );
  }

  const nuevosCriteriosMios = Array.from(
    new Set([...yaCubiertosPorMiSet, ...solicitados]),
  );

  if (yaCubiertoPorMi && nuevosCriteriosMios.length === yaCubiertosPorMiSet.size) {
    throw new Error("Ya registraste la cobertura de esos criterios hoy.");
  }

  let registro: Registro;
  if (yaCubiertoPorMi) {
    const notaCombinada =
      yaCubiertoPorMi.nota && nota && yaCubiertoPorMi.nota !== nota
        ? `${yaCubiertoPorMi.nota} | ${nota}`
        : nota || yaCubiertoPorMi.nota;
    const actualizado = await actualizarRegistro(yaCubiertoPorMi.id, {
      criteriosIds: nuevosCriteriosMios,
      nota: notaCombinada,
      fotoUrl: fotoUrl || yaCubiertoPorMi.fotoUrl,
    });
    if (!actualizado) throw new Error("No se pudo actualizar la cobertura.");
    registro = actualizado;
  } else {
    registro = await insertarRegistro({
      hogarId: deber.hogarId,
      deberId: deber.id,
      participanteId: input.participanteId,
      fecha: fechaStr,
      estado: "cubrio_a_otro",
      cubiertoA: input.cubiertoA,
      criteriosIds: nuevosCriteriosMios,
      nota,
      fotoUrl,
      confirmado: true,
    });
  }

  await intentarOtorgarBono(registro);

  // Además, si al cubrir estos criterios el dueño YA había hecho el resto de los criterios de su deber,
  // verificamos si el dueño tenía coberturas propias esperando a que su deber quedara al 100%
  const coberturasDelAyudado = await listarCoberturasDelDia(
    input.cubiertoA,
    fechaStr,
    { soloConfirmadas: true },
  );
  for (const cob of coberturasDelAyudado) {
    await intentarOtorgarBono(cob);
  }

  return registro;
}

/** La persona cubierta confirma que efectivamente la cubrieron. */
export async function confirmarCobertura(input: {
  registroId: string;
  participanteId: string; // quien confirma (el ayudado)
}): Promise<Registro> {
  const registro = await obtenerRegistroPorId(input.registroId);
  if (!registro) throw new Error("El registro no existe.");
  if (registro.estado !== "cubrio_a_otro") {
    throw new Error("Este registro no es una cobertura.");
  }
  if (registro.cubiertoA !== input.participanteId) {
    throw new Error("Solo la persona cubierta puede confirmar esta cobertura.");
  }
  if (registro.confirmado) return registro; // ya estaba confirmada

  const actualizado = await actualizarRegistro(registro.id, {
    confirmado: true,
    confirmadoPor: input.participanteId,
  });
  if (!actualizado) throw new Error("No se pudo confirmar la cobertura.");

  // Con la confirmación lista, intentamos otorgar el bono.
  await intentarOtorgarBono(actualizado);
  return actualizado;
}

/**
 * Otorga el bono proporcional por cubrir SI se cumplen las condiciones del reglamento:
 * la cobertura está confirmada Y quien cubrió ya completó el 100% de su propio deber del día.
 * Es idempotente y actualiza el monto si cubrió más criterios el mismo día.
 */
async function intentarOtorgarBono(cobertura: Registro): Promise<void> {
  if (!cobertura.confirmado) return;

  const hizoLoSuyo = await cumplioDeberPropioDelDia(
    cobertura.participanteId,
    cobertura.fecha,
  );
  if (!hizoLoSuyo) return; // queda pendiente hasta que complete todos los criterios de su propio deber

  const [deber, criterios] = await Promise.all([
    obtenerDeber(cobertura.deberId),
    obtenerCriteriosDeDeber(cobertura.deberId),
  ]);
  if (!deber) return;

  const hogar = await obtenerHogarActual();
  const bono = hogar ? Number(hogar.bonoAyuda) : 0;

  let fraccion = 1;
  if (criterios.length > 0 && cobertura.criteriosIds !== null) {
    fraccion = cobertura.criteriosIds.length / criterios.length;
  }

  await otorgarBonoAyuda(cobertura, deber.puntos, bono, fraccion);
}

/** Reclama un extra (deber reclamable): valida disponibilidad, foto y cupo. */
export async function reclamarExtra(input: {
  deberId: string;
  participanteId: string;
  fotoUrl?: string | null;
  nota?: string | null;
}): Promise<Registro> {
  const deber = await obtenerDeber(input.deberId);
  if (!deber || !deber.activo) throw new Error("El deber no existe o está inactivo.");
  if (deber.tipoAsignacion !== "reclamable") {
    throw new Error("Este deber no es reclamable.");
  }

  const fecha = obtenerFechaDeNegocio();
  const fechaStr = formatearFechaISO(fecha);
  const dia = nombreDiaSemana(fecha);

  if (!deber.diasDisponibles.includes(dia)) {
    throw new Error("Este extra no está disponible hoy.");
  }

  const fotoUrl = input.fotoUrl?.trim() || null;
  if (deber.requiereFoto && !fotoUrl) {
    throw new Error("Este extra requiere una foto de prueba.");
  }

  // No reclamar el mismo extra dos veces el mismo día.
  const yaReclamado = await buscarRegistro(
    deber.id,
    input.participanteId,
    fechaStr,
    "reclamado",
  );
  if (yaReclamado) throw new Error("Ya reclamaste este extra hoy.");

  // Cupo: si hay tope, contar los reclamos del período. El cupo es del hogar,
  // salvo que el deber sea personal (entonces el cupo es por persona).
  if (deber.maxReclamos !== null) {
    const { inicio, fin } = rangoPeriodo(deber.cadencia, fecha);
    const usados = await contarReclamos(
      deber.id,
      inicio,
      fin,
      deber.limitePorPersona ? input.participanteId : undefined,
    );
    if (usados >= deber.maxReclamos) {
      throw new Error("Ya se alcanzó el cupo de este extra para este período.");
    }
  }

  const registro = await insertarRegistro({
    hogarId: deber.hogarId,
    deberId: deber.id,
    participanteId: input.participanteId,
    fecha: fechaStr,
    estado: "reclamado",
    fotoUrl,
    nota: input.nota?.trim() || null,
    confirmado: true,
  });

  await otorgarReclamable(registro, deber.puntos);
  return registro;
}
