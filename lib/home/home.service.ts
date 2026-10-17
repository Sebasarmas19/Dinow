import { and, eq, gte, lt, or } from "drizzle-orm";
import { db } from "../db";
import {
  asignaciones,
  criteriosDeber,
  deberes,
  hogar,
  participantes,
  planSemanal as planSemanalTable,
  registros,
  solicitudesIntercambio,
  transaccionesPuntos,
} from "../db/schema";
import {
  formatearFechaISO,
  formatearFechaLabel,
  obtenerFechaDeNegocio,
  sumarDias,
} from "../shared/date";
import type {
  CriterioEstado,
  DeberHoy,
  ExtraSemana,
  HermanoEstado,
  HomeScreenProps,
  SolicitudIntercambioUI,
} from "../../app/_components/home-screen";

/**
 * Obtiene todos los datos consolidados necesarios para renderizar el HomeScreen.
 */
export async function getHomeScreenData(usuarioId?: string): Promise<HomeScreenProps> {
  // 1. Obtener el hogar
  const [hogarActual] = await db.select().from(hogar).limit(1);
  if (!hogarActual) throw new Error("No hay un hogar configurado. Corre el seed.");
  const bonoAyudaNum = Number(hogarActual.bonoAyuda);

  // 2. Obtener la fecha de negocio (Cierre a las 3:00 AM)
  const fechaActual = obtenerFechaDeNegocio();
  const fechaHoyStr = formatearFechaISO(fechaActual);
  const dateLabel = formatearFechaLabel(fechaActual);

  const diasSemana = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
  ];
  const diaActualStr = diasSemana[fechaActual.getDay()];

  // 3. Obtener participantes activos
  const participantesActivos = await db
    .select()
    .from(participantes)
    .where(
      and(
        eq(participantes.hogarId, hogarActual.id),
        eq(participantes.activo, true),
      ),
    )
    .orderBy(participantes.ordenRotacion);

  if (participantesActivos.length === 0) throw new Error("No hay participantes.");

  let yo = participantesActivos.find((p) => p.id === usuarioId);
  if (!yo) yo = participantesActivos[0];

  const mapaNombres = new Map<string, string>(
    participantesActivos.map((p) => [p.id, p.nombre]),
  );

  // 4. Obtener asignaciones de HOY con sus criterios ordenados
  const asignacionesHoy = await db
    .select({
      asignacion: asignaciones,
      deber: deberes,
      criterio: criteriosDeber,
    })
    .from(asignaciones)
    .innerJoin(deberes, eq(asignaciones.deberId, deberes.id))
    .leftJoin(criteriosDeber, eq(criteriosDeber.deberId, deberes.id))
    .where(
      and(
        eq(asignaciones.hogarId, hogarActual.id),
        eq(asignaciones.fecha, fechaHoyStr),
        eq(deberes.activo, true),
      ),
    );

  // Agrupar criterios con ID y orden por asignación
  const deberesAgrupados = new Map<
    string,
    {
      asignacion: typeof asignaciones.$inferSelect;
      deber: typeof deberes.$inferSelect;
      criterios: { id: string; descripcion: string; orden: number }[];
    }
  >();

  for (const fila of asignacionesHoy) {
    const key = fila.asignacion.id;
    if (!deberesAgrupados.has(key)) {
      deberesAgrupados.set(key, {
        asignacion: fila.asignacion,
        deber: fila.deber,
        criterios: [],
      });
    }
    if (fila.criterio) {
      deberesAgrupados.get(key)!.criterios.push({
        id: fila.criterio.id,
        descripcion: fila.criterio.descripcion,
        orden: fila.criterio.orden,
      });
    }
  }

  // Ordenar los criterios de cada deber
  for (const item of deberesAgrupados.values()) {
    item.criterios.sort((a, b) => a.orden - b.orden);
  }

  // 5. Obtener los registros de hoy
  const registrosHoy = await db
    .select()
    .from(registros)
    .where(
      and(
        eq(registros.hogarId, hogarActual.id),
        eq(registros.fecha, fechaHoyStr),
      ),
    );

  const extrasReclamadosPorMi = new Set(
    registrosHoy
      .filter((r) => r.estado === "reclamado" && r.participanteId === yo.id)
      .map((r) => r.deberId),
  );

  // Helper para calcular el estado detallado de cada criterio de un deber hoy
  function evaluarEstadoDeber(
    deberObj: typeof deberes.$inferSelect,
    duenoId: string,
    criteriosRaw: { id: string; descripcion: string }[],
  ) {
    const regsDeber = registrosHoy.filter(
      (r) =>
        r.deberId === deberObj.id &&
        (r.estado === "cumplido_propio" || r.estado === "cubrio_a_otro"),
    );

    const criteriosDetalle: CriterioEstado[] = criteriosRaw.map((c) => {
      let completadoPorId: string | undefined;
      let esPropio = false;

      for (const r of regsDeber) {
        const incluyeEste =
          r.criteriosIds === null || r.criteriosIds.includes(c.id);
        if (incluyeEste) {
          completadoPorId = r.participanteId;
          esPropio = r.estado === "cumplido_propio" && r.participanteId === duenoId;
          break;
        }
      }

      return {
        id: c.id,
        descripcion: c.descripcion,
        completado: Boolean(completadoPorId),
        completadoPorNombre: completadoPorId
          ? mapaNombres.get(completadoPorId) || "Alguien"
          : undefined,
        esPropio,
      };
    });

    const totalCriterios = criteriosDetalle.length;
    const completadosCount = criteriosDetalle.filter((c) => c.completado).length;
    const propiosCount = criteriosDetalle.filter(
      (c) => c.completado && c.esPropio,
    ).length;

    let cumplidoAlCien = false;
    let tieneAlgunAvance = false;

    if (totalCriterios === 0) {
      cumplidoAlCien = regsDeber.length > 0;
      tieneAlgunAvance = regsDeber.length > 0;
    } else {
      cumplidoAlCien = completadosCount === totalCriterios;
      tieneAlgunAvance = completadosCount > 0;
    }

    const fraccionPropia =
      totalCriterios > 0
        ? propiosCount / totalCriterios
        : regsDeber.some(
              (r) =>
                r.estado === "cumplido_propio" && r.participanteId === duenoId,
            )
          ? 1
          : 0;

    const puntosGanadosDueno =
      Math.round(Number(deberObj.puntos) * fraccionPropia * 100) / 100;

    return {
      criteriosDetalle,
      totalCriterios,
      completadosCount,
      propiosCount,
      cumplidoAlCien,
      tieneAlgunAvance,
      puntosGanadosDueno,
      regsDeber,
    };
  }

  const misDeberes: DeberHoy[] = [];
  const hermanosData: HermanoEstado[] = [];

  const estilosHermanos: Record<string, { card: string; ring: string }> = {
    Sebastián: {
      card: "background:#FFFDF9;border:1px solid #F0E6D5;",
      ring: "background:#F4E4CE;border:2px solid #E9CBA0;",
    },
    Samuel: {
      card: "background:#FFF4EC;border:2px solid #E2733F;box-shadow:0 10px 22px -14px rgba(210,96,47,.6);",
      ring: "background:#FBD9C4;border:2px solid #E2733F;",
    },
    Silvana: {
      card: "background:#FFFDF9;border:1px solid #F0E6D5;",
      ring: "background:#EFE0D0;border:2px solid #DFC9AE;",
    },
  };

  const misPersonalesList: {
    asignacion: typeof asignaciones.$inferSelect;
    deber: typeof deberes.$inferSelect;
    criterios: { id: string; descripcion: string; orden: number }[];
  }[] = [];

  // ¿Mi deber principal tiene algún avance hoy? (para saber si puedo pedir intercambio)
  const miAsignacionRotativa = Array.from(deberesAgrupados.values()).find(
    (a) =>
      a.asignacion.participanteId === yo.id &&
      a.deber.tipoAsignacion === "rotativo" &&
      !a.deber.esPersonal,
  );
  const miEvaluacion = miAsignacionRotativa
    ? evaluarEstadoDeber(
        miAsignacionRotativa.deber,
        yo.id,
        miAsignacionRotativa.criterios,
      )
    : null;

  // ¿Yo ya cumplí al 100% mi propio deber hoy? (para saber si mis coberturas ya dan bono o están en espera)
  const yoCumpliTodoLoMio = miEvaluacion ? miEvaluacion.cumplidoAlCien && miEvaluacion.propiosCount > 0 : true;

  // 6. Construir lista de hermanos y extraer mis deberes
  for (const part of participantesActivos) {
    const esYo = part.id === yo.id;

    const misAsignaciones = Array.from(deberesAgrupados.values()).filter(
      (a) =>
        a.asignacion.participanteId === part.id &&
        a.deber.tipoAsignacion === "rotativo",
    );
    const misRotativos = misAsignaciones.filter((a) => !a.deber.esPersonal);
    const misPersonales = misAsignaciones.filter((a) => a.deber.esPersonal);

    const asignacionPrincipal = misRotativos[0];
    const evalPrincipal = asignacionPrincipal
      ? evaluarEstadoDeber(
          asignacionPrincipal.deber,
          part.id,
          asignacionPrincipal.criterios,
        )
      : null;

    if (esYo) {
      for (const item of misRotativos) {
        const ev = evaluarEstadoDeber(item.deber, part.id, item.criterios);
        const itemCobertura = ev.regsDeber.find(
          (r) => r.estado === "cubrio_a_otro" && r.cubiertoA === part.id,
        );

        // Solo mostramos la pantalla completa "¡Te cubrieron!" si un hermano cubrió el 100% y el dueño hizo 0
        const cubiertoTotalmentePorOtro =
          ev.cumplidoAlCien && ev.propiosCount === 0 && itemCobertura;

        misDeberes.push({
          id: item.deber.id,
          nombre: item.deber.nombre,
          icono: item.deber.icono || "✨",
          puntos: Number(item.deber.puntos),
          puntosGanadosHoy: ev.puntosGanadosDueno,
          criterios: item.criterios.map((c) => c.descripcion),
          criteriosDetalle: ev.criteriosDetalle,
          cumplido: ev.cumplidoAlCien,
          cubiertoPor: cubiertoTotalmentePorOtro
            ? {
                registroId: itemCobertura.id,
                nombreId: itemCobertura.participanteId,
                nombre:
                  mapaNombres.get(itemCobertura.participanteId) || "Alguien",
              }
            : undefined,
        });
      }
      for (const item of misPersonales) {
        misPersonalesList.push(item);
      }
    }

    let rolLabel = asignacionPrincipal
      ? asignacionPrincipal.deber.nombre
      : "Día libre";
    if (esYo && asignacionPrincipal) {
      rolLabel = `Tú · ${asignacionPrincipal.deber.nombre.split(" ")[0]}`;
    }

    const estilo = estilosHermanos[part.nombre] || estilosHermanos["Sebastián"];

    // Verificar si YO cubrí total o parcialmente a este hermano hoy
    const miCoberturaAEl = evalPrincipal?.regsDeber.find(
      (r) => r.estado === "cubrio_a_otro" && r.participanteId === yo.id,
    );
    const otraCoberturaHaciaEl = evalPrincipal?.regsDeber.find(
      (r) => r.estado === "cubrio_a_otro" && r.cubiertoA === part.id,
    );

    let coberturaStatus:
      | "bonus"
      | "nobonus"
      | "cubierto_por_otro"
      | undefined = undefined;
    let coberturaPuntosGanados: number | undefined = undefined;

    if (miCoberturaAEl && asignacionPrincipal && evalPrincipal) {
      const kCubiertos =
        miCoberturaAEl.criteriosIds === null
          ? evalPrincipal.totalCriterios || 1
          : miCoberturaAEl.criteriosIds.length;
      const denom = evalPrincipal.totalCriterios || 1;
      coberturaPuntosGanados =
        Math.round(
          ((Number(asignacionPrincipal.deber.puntos) + bonoAyudaNum) *
            kCubiertos) /
            denom *
            100,
        ) / 100;
      coberturaStatus = yoCumpliTodoLoMio ? "bonus" : "nobonus";
    } else if (
      esYo &&
      otraCoberturaHaciaEl &&
      evalPrincipal?.cumplidoAlCien &&
      evalPrincipal.propiosCount === 0
    ) {
      coberturaStatus = "cubierto_por_otro";
    }

    const puedeIntercambiar =
      !esYo &&
      Boolean(miAsignacionRotativa) &&
      Boolean(asignacionPrincipal) &&
      !miEvaluacion?.tieneAlgunAvance &&
      !evalPrincipal?.tieneAlgunAvance;

    hermanosData.push({
      participanteId: part.id,
      cobertura: coberturaStatus,
      coberturaPuntosGanados,
      nombre: part.nombre,
      rol: rolLabel,
      emoji: asignacionPrincipal?.deber.icono || "✨",
      fotoUrl: part.fotoUrl,
      esYo,
      cumplido: evalPrincipal?.cumplidoAlCien ?? false,
      deberId: asignacionPrincipal?.deber.id || "",
      deberNombre: asignacionPrincipal?.deber.nombre || "Ninguno",
      deberPuntos: asignacionPrincipal
        ? Number(asignacionPrincipal.deber.puntos)
        : 0,
      deberCriterios:
        asignacionPrincipal?.criterios.map((c) => c.descripcion) || [],
      deberCriteriosDetalle: evalPrincipal?.criteriosDetalle || [],
      criteriosCompletados: evalPrincipal?.completadosCount ?? 0,
      criteriosTotales: evalPrincipal?.totalCriterios ?? 0,
      puedeIntercambiar,
      cardStyle: esYo ? estilosHermanos["Samuel"].card : estilo.card,
      ringStyle: esYo ? estilosHermanos["Samuel"].ring : estilo.ring,
    });
  }

  // 6.5. Obtener solicitudes de intercambio pendientes de hoy que me involucren
  const solicitudesRaw = await db
    .select()
    .from(solicitudesIntercambio)
    .where(
      and(
        eq(solicitudesIntercambio.hogarId, hogarActual.id),
        eq(solicitudesIntercambio.fecha, fechaHoyStr),
        eq(solicitudesIntercambio.estado, "pendiente"),
        or(
          eq(solicitudesIntercambio.solicitanteId, yo.id),
          eq(solicitudesIntercambio.destinatarioId, yo.id),
        ),
      ),
    );

  const todosDeberesMap = new Map<
    string,
    { nombre: string; icono: string }
  >();
  for (const item of deberesAgrupados.values()) {
    todosDeberesMap.set(item.deber.id, {
      nombre: item.deber.nombre,
      icono: item.deber.icono || "✨",
    });
  }

  const intercambiosPendientes: SolicitudIntercambioUI[] = solicitudesRaw.map(
    (s) => {
      const dSol = todosDeberesMap.get(s.deberSolicitanteId);
      const dDest = todosDeberesMap.get(s.deberDestinatarioId);
      return {
        id: s.id,
        solicitanteId: s.solicitanteId,
        solicitanteNombre: mapaNombres.get(s.solicitanteId) || "Hermano",
        destinatarioId: s.destinatarioId,
        destinatarioNombre: mapaNombres.get(s.destinatarioId) || "Hermano",
        deberSolicitanteNombre: dSol?.nombre || "Deber",
        deberSolicitanteIcono: dSol?.icono || "✨",
        deberDestinatarioNombre: dDest?.nombre || "Deber",
        deberDestinatarioIcono: dDest?.icono || "✨",
        esRecibida: s.destinatarioId === yo.id,
      };
    },
  );

  // 7. Obtener extras de la semana (reclamables) disponibles HOY
  const deberesExtras = await db
    .select({
      deber: deberes,
      criterio: criteriosDeber,
    })
    .from(deberes)
    .leftJoin(criteriosDeber, eq(criteriosDeber.deberId, deberes.id))
    .where(
      and(
        eq(deberes.hogarId, hogarActual.id),
        eq(deberes.tipoAsignacion, "reclamable"),
        eq(deberes.activo, true),
      ),
    );

  const extrasAgrupados = new Map<string, { deber: any; criterios: string[] }>();
  for (const fila of deberesExtras) {
    if (
      !fila.deber.diasDisponibles ||
      !fila.deber.diasDisponibles.includes(diaActualStr)
    ) {
      continue;
    }

    const key = fila.deber.id;
    if (!extrasAgrupados.has(key)) {
      extrasAgrupados.set(key, { deber: fila.deber, criterios: [] });
    }
    if (fila.criterio) {
      extrasAgrupados.get(key)!.criterios.push(fila.criterio.descripcion);
    }
  }

  const extrasFormateados: ExtraSemana[] = Array.from(
    extrasAgrupados.values(),
  ).map((e) => ({
    reclamadoHoy: extrasReclamadosPorMi.has(e.deber.id),
    clave: e.deber.id,
    icono: e.deber.icono || "✨",
    label: e.deber.nombre,
    meta: e.deber.requiereFoto
      ? `${e.deber.puntos} pts · pide foto 📷`
      : `${e.deber.puntos} pts`,
    puntos: Number(e.deber.puntos),
    criterios: e.criterios,
    esPersonal: false,
    requiereFoto: e.deber.requiereFoto,
  }));

  for (const p of misPersonalesList) {
    const estaCumplido = registrosHoy.some(
      (r) =>
        r.estado === "cumplido_propio" &&
        r.participanteId === yo.id &&
        r.deberId === p.deber.id,
    );
    extrasFormateados.push({
      reclamadoHoy: estaCumplido,
      clave: p.deber.id,
      icono: p.deber.icono || "✨",
      label: p.deber.nombre,
      meta: p.deber.requiereFoto
        ? `${p.deber.puntos} pts · personal · pide foto 📷`
        : `${p.deber.puntos} pts · personal`,
      puntos: Number(p.deber.puntos),
      criterios: p.criterios.map((c) => c.descripcion),
      esPersonal: true,
      requiereFoto: p.deber.requiereFoto,
    });
  }

  // 8. Calcular Puntos del mes y Ranking
  const inicioMes = new Date(
    fechaActual.getFullYear(),
    fechaActual.getMonth(),
    1,
  );
  const finMes = new Date(
    fechaActual.getFullYear(),
    fechaActual.getMonth() + 1,
    0,
  );

  const transacciones = await db
    .select()
    .from(transaccionesPuntos)
    .where(
      and(
        eq(transaccionesPuntos.hogarId, hogarActual.id),
        gte(transaccionesPuntos.fecha, formatearFechaISO(inicioMes)),
        lt(
          transaccionesPuntos.fecha,
          formatearFechaISO(
            new Date(
              finMes.getFullYear(),
              finMes.getMonth(),
              finMes.getDate() + 1,
            ),
          ),
        ),
      ),
    );

  const puntosPorParticipante: Record<string, number> = {};
  for (const p of participantesActivos) {
    puntosPorParticipante[p.id] = 0;
  }

  for (const t of transacciones) {
    if (puntosPorParticipante[t.participanteId] !== undefined) {
      puntosPorParticipante[t.participanteId] += Number(t.cantidad);
    }
  }

  const misPuntosBase =
    Math.round((puntosPorParticipante[yo.id] || 0) * 100) / 100;

  const ranking = Object.entries(puntosPorParticipante)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id);

  const miPosicion = ranking.indexOf(yo.id) + 1;
  const medalla =
    miPosicion === 1
      ? "🥇"
      : miPosicion === 2
        ? "🥈"
        : miPosicion === 3
          ? "🥉"
          : "";
  const posicionLabel = `${miPosicion}º general ${medalla}`;

  // 9. Deber obligatorio de mañana
  const manana = sumarDias(fechaActual, 1);
  const fechaMananaStr = formatearFechaISO(manana);

  let [asigManana] = await db
    .select({
      nombre: deberes.nombre,
      icono: deberes.icono,
      puntos: deberes.puntos,
    })
    .from(asignaciones)
    .innerJoin(deberes, eq(asignaciones.deberId, deberes.id))
    .where(
      and(
        eq(asignaciones.hogarId, hogarActual.id),
        eq(asignaciones.participanteId, yo.id),
        eq(asignaciones.fecha, fechaMananaStr),
        eq(deberes.esObligatorio, true),
        eq(deberes.activo, true),
      ),
    );

  if (!asigManana) {
    const diaMananaInt = manana.getDay();
    const [planManana] = await db
      .select({
        nombre: deberes.nombre,
        icono: deberes.icono,
        puntos: deberes.puntos,
      })
      .from(planSemanalTable)
      .innerJoin(deberes, eq(planSemanalTable.deberId, deberes.id))
      .where(
        and(
          eq(planSemanalTable.hogarId, hogarActual.id),
          eq(planSemanalTable.participanteId, yo.id),
          eq(planSemanalTable.diaSemana, diaMananaInt),
          eq(deberes.activo, true),
        ),
      );
    if (planManana) {
      asigManana = {
        nombre: planManana.nombre,
        icono: planManana.icono || "✨",
        puntos: planManana.puntos,
      };
    }
  }

  const deberManana = asigManana
    ? {
        nombre: asigManana.nombre,
        icono: asigManana.icono || "✨",
        puntos: Number(asigManana.puntos),
      }
    : null;

  return {
    miId: yo.id,
    userName: yo.nombre,
    dateLabel,
    deberesHoy: misDeberes,
    hermanos: hermanosData,
    extras: extrasFormateados,
    puntosBase: misPuntosBase,
    posicionLabel,
    deberManana,
    intercambiosPendientes,
    bonoAyuda: bonoAyudaNum,
  };
}
