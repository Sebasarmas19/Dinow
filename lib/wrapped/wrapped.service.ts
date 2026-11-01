import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import {
  listarAsignacionesEnRango,
  listarAusenciasEnRango,
  listarRegistrosEnRango,
  listarTransaccionesEnRango,
} from "@/lib/rankings/rankings.repo";
import { calcularRankings, type FilaRanking } from "@/lib/rankings/rankings.service";
import { listarParticipantesActivos } from "@/lib/rotacion/rotacion.repo";
import {
  formatearFechaISO,
  obtenerFechaDeNegocio,
  parsearFechaISO,
  rangoPeriodo,
} from "@/lib/shared/date";
import {
  listarIntercambiosEnRango,
  listarTitulosGuardadosDelMes,
  listarTodosLosDeberesDelHogar,
  obtenerHogarWrapped,
} from "./wrapped.repo";

/**
 * Servicio de negocio del "Deberes Wrapped" (Resumen Mensual Interactivo).
 *
 * Construye toda la narrativa basada en datos reales para cualquier mes ('YYYY-MM'):
 *  - Pulso colectivo del hogar (puntos, cumplimientos, día récord, deber estrella).
 *  - Los 4 Títulos Oficiales con respaldo estadístico ("¿Por qué ganó el que ganó?").
 *  - Radiografía individual y podio completo de los participantes.
 *  - Hitos curiosos del mes (dupla solidaria, especialista de tarea, trueques, notas).
 */

export type ClaveRankingOficial =
  | "confiable"
  | "solidario"
  | "responsable"
  | "general";

export type BulletStorytelling = {
  icono: string;
  etiqueta: string;
  valor: string;
  detalle?: string;
};

export type TituloOficialWrapped = {
  clave: ClaveRankingOficial;
  tituloOficial: string;
  subtitulo: string;
  descripcionCorta: string;
  icono: string;
  temaColor: "esmeralda" | "ambar" | "violeta" | "oro";
  ganador: FilaRanking | null;
  empatados: FilaRanking[];
  segundoLugar: FilaRanking | null;
  tercerLugar: FilaRanking | null;
  tablaCompleta: FilaRanking[];
  valorFormateado: string;
  diferenciaConSegundo: string;
  porQueGano: {
    headline: string;
    bullets: BulletStorytelling[];
  };
};

export type PerfilParticipanteWrapped = {
  participanteId: string;
  nombre: string;
  fotoUrl: string | null;
  posicionGeneral: number;
  puntosTotales: number;
  desglosePuntos: {
    propios: number;
    solidario: number;
    extras: number;
    penalizaciones: number;
    ajustes: number;
  };
  porcentajeConfiable: number;
  cumplidosPropios: number;
  asignadosValidos: number;
  rachaMaximaMes: number;
  coberturasHechas: number;
  coberturasRecibidas: number;
  extrasHechos: number;
  intercambiosHechos: number;
  deberFavorito: {
    nombre: string;
    icono: string;
    veces: number;
  } | null;
  titulosGanados: {
    clave: ClaveRankingOficial;
    nombre: string;
    icono: string;
  }[];
  arquetipoMes: {
    titulo: string;
    icono: string;
    motivo: string;
  };
};

export type WrappedMensualData = {
  mes: string; // 'YYYY-MM'
  mesNombre: string; // 'Octubre'
  anio: number; // 2026
  labelMes: string; // 'Octubre 2026'
  hogarNombre: string;
  esMesCerrado: boolean;
  hayActividad: boolean;
  viewerId: string;
  viewerNombre: string;
  pulsoHogar: {
    puntosTotalesGenerados: number;
    balanceNetoHogar: number;
    totalCumplimientos: number;
    propiosCumplidos: number;
    coberturasRealizadas: number;
    extrasReclamados: number;
    intercambiosPactados: number;
    diasActivos: number;
    diasTotalesMes: number;
    penalizacionesColectivas: number;
    diaRecord: {
      fecha: string;
      fechaLabel: string;
      puntos: number;
      tareas: number;
    } | null;
    deberEstrella: {
      nombre: string;
      icono: string;
      veces: number;
      puntosTotales: number;
    } | null;
  };
  titulosOficiales: {
    confiable: TituloOficialWrapped;
    solidario: TituloOficialWrapped;
    responsable: TituloOficialWrapped;
    general: TituloOficialWrapped;
  };
  hitosCuriosos: {
    duplaSolidaria: {
      ayudanteNombre: string;
      ayudadoNombre: string;
      veces: number;
      puntosBono: number;
    } | null;
    especialistaMes: {
      participanteNombre: string;
      deberNombre: string;
      deberIcono: string;
      veces: number;
    } | null;
    reyDelTrueque: {
      nombre: string;
      intercambios: number;
    } | null;
    notaDestacada: {
      autorNombre: string;
      ayudadoNombre?: string;
      deberNombre: string;
      deberIcono: string;
      nota: string;
      fechaLabel: string;
    } | null;
    obligatoriosCumplidosTotal: number;
  };
  podioFinal: PerfilParticipanteWrapped[];
  miResumen: PerfilParticipanteWrapped | null;
};

const MESES_NOMBRES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function redond(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatearDiaCorto(fechaISO: string): string {
  const fecha = parsearFechaISO(fechaISO);
  const texto = new Intl.DateTimeFormat("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Calcula la racha máxima de días consecutivos cumpliendo todos sus deberes
 * asignados DENTRO del mes consultado.
 */
function calcularRachaEnMes(
  asignacionesParticipante: { deberId: string; fecha: string }[],
  registrosParticipante: { deberId: string; fecha: string; estado: string }[],
  estabaAusente: (fecha: string) => boolean,
  limiteFechaStr: string,
): number {
  const cumplidos = new Set(
    registrosParticipante
      .filter((r) => r.estado === "cumplido_propio")
      .map((r) => `${r.fecha}:${r.deberId}`),
  );

  const porFecha = new Map<string, string[]>();
  for (const a of asignacionesParticipante) {
    if (a.fecha > limiteFechaStr) continue;
    if (!porFecha.has(a.fecha)) porFecha.set(a.fecha, []);
    porFecha.get(a.fecha)!.push(a.deberId);
  }

  const fechas = [...porFecha.keys()].sort();
  let actual = 0;
  let maxima = 0;

  for (const fecha of fechas) {
    if (estabaAusente(fecha)) continue;
    const deberesDia = porFecha.get(fecha)!;
    const cumplioTodos = deberesDia.every((dId) => cumplidos.has(`${fecha}:${dId}`));
    if (cumplioTodos) {
      actual++;
      maxima = Math.max(maxima, actual);
    } else {
      actual = 0;
    }
  }

  return maxima;
}

export async function generarWrappedMensual(
  mesParam?: string,
  viewerIdParam?: string,
): Promise<WrappedMensualData> {
  const hogarId = await obtenerHogarActualId();
  const fechaNegocioHoy = obtenerFechaDeNegocio();
  const hoyStr = formatearFechaISO(fechaNegocioHoy);
  const mesActualNegocio = hoyStr.slice(0, 7);

  const mesValidado =
    mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : mesActualNegocio;
  const [anioStr, mesNumStr] = mesValidado.split("-");
  const anio = parseInt(anioStr, 10);
  const mesNum = parseInt(mesNumStr, 10);
  const mesNombre = MESES_NOMBRES[mesNum - 1] || "Mes";
  const labelMes = `${mesNombre} ${anio}`;

  const fechaRef = new Date(anio, mesNum - 1, 1);
  const { inicio, fin } = rangoPeriodo("mensual", fechaRef);
  const diasTotalesMes = parseInt(fin.slice(8, 10), 10);
  const esMesCerrado = mesValidado < mesActualNegocio;
  const limiteFechaEvaluacion = esMesCerrado ? fin : hoyStr < fin ? hoyStr : fin;

  const [
    hogarObj,
    participantes,
    todosDeberes,
    transacciones,
    registros,
    asignaciones,
    intercambios,
  ] = await Promise.all([
    obtenerHogarWrapped(hogarId),
    listarParticipantesActivos(hogarId),
    listarTodosLosDeberesDelHogar(hogarId),
    listarTransaccionesEnRango(hogarId, inicio, fin),
    listarRegistrosEnRango(hogarId, inicio, fin),
    listarAsignacionesEnRango(hogarId, inicio, fin),
    listarIntercambiosEnRango(hogarId, inicio, fin),
  ]);

  const idsParticipantes = participantes.map((p) => p.id);
  const [ausencias, titulosGuardados] = await Promise.all([
    listarAusenciasEnRango(idsParticipantes, inicio, fin),
    listarTitulosGuardadosDelMes(idsParticipantes, mesValidado),
  ]);

  const mapaParticipantes = new Map(participantes.map((p) => [p.id, p]));
  const mapaDeberes = new Map(todosDeberes.map((d) => [d.id, d]));

  const viewer =
    participantes.find((p) => p.id === viewerIdParam) || participantes[0];

  const estabaAusente = (participanteId: string, fecha: string) =>
    ausencias.some(
      (a) =>
        a.participanteId === participanteId &&
        a.fechaInicio <= fecha &&
        a.fechaFin >= fecha,
    );

  // ── 1. Pulso Colectivo del Hogar ──────────────────────────────────────────
  const puntosTotalesGenerados = redond(
    transacciones
      .filter((t) => Number(t.cantidad) > 0)
      .reduce((acc, t) => acc + Number(t.cantidad), 0),
  );
  const balanceNetoHogar = redond(
    transacciones.reduce((acc, t) => acc + Number(t.cantidad), 0),
  );

  const propiosCumplidos = registros.filter(
    (r) => r.estado === "cumplido_propio",
  ).length;
  const coberturasRealizadas = registros.filter(
    (r) => r.estado === "cubrio_a_otro",
  ).length;
  const extrasReclamados = registros.filter(
    (r) => r.estado === "reclamado",
  ).length;
  const intercambiosAceptados = intercambios.filter(
    (i) => i.estado === "aceptada",
  );

  const diasConActividadSet = new Set<string>([
    ...registros.map((r) => r.fecha),
    ...transacciones.map((t) => t.fecha),
  ]);

  // Día récord del mes (mayor suma de puntos positivos y tareas)
  const puntosPorDia = new Map<string, { puntos: number; tareas: number }>();
  for (const r of registros) {
    const actual = puntosPorDia.get(r.fecha) || { puntos: 0, tareas: 0 };
    actual.tareas += 1;
    puntosPorDia.set(r.fecha, actual);
  }
  for (const t of transacciones) {
    const cant = Number(t.cantidad);
    if (cant > 0) {
      const actual = puntosPorDia.get(t.fecha) || { puntos: 0, tareas: 0 };
      actual.puntos = redond(actual.puntos + cant);
      puntosPorDia.set(t.fecha, actual);
    }
  }

  let diaRecord: WrappedMensualData["pulsoHogar"]["diaRecord"] = null;
  for (const [fecha, datos] of puntosPorDia.entries()) {
    if (
      !diaRecord ||
      datos.puntos > diaRecord.puntos ||
      (datos.puntos === diaRecord.puntos && datos.tareas > diaRecord.tareas)
    ) {
      diaRecord = {
        fecha,
        fechaLabel: formatearDiaCorto(fecha),
        puntos: datos.puntos,
        tareas: datos.tareas,
      };
    }
  }

  // Deber estrella del hogar
  const conteoPorDeber = new Map<string, number>();
  for (const r of registros) {
    conteoPorDeber.set(r.deberId, (conteoPorDeber.get(r.deberId) || 0) + 1);
  }
  let deberEstrella: WrappedMensualData["pulsoHogar"]["deberEstrella"] = null;
  for (const [deberId, veces] of conteoPorDeber.entries()) {
    const d = mapaDeberes.get(deberId);
    if (!d) continue;
    const puntosTotales = redond(veces * Number(d.puntos));
    if (!deberEstrella || veces > deberEstrella.veces) {
      deberEstrella = {
        nombre: d.nombre,
        icono: d.icono || "✨",
        veces,
        puntosTotales,
      };
    }
  }

  const penalizacionesColectivas = Math.ceil(
    transacciones.filter((t) => t.tipo === "penalizacion_colectiva").length /
      Math.max(1, participantes.length),
  );

  // ── 2. Estadísticas detalladas por participante ───────────────────────────
  const statsPorParticipante = new Map<
    string,
    {
      propiosPts: number;
      solidarioPts: number;
      extrasPts: number;
      penalizacionesPts: number;
      ajustesPts: number;
      totalPts: number;
      cumplidosPropios: number;
      asignadosValidos: number;
      porcentajeConfiable: number;
      rachaMaximaMes: number;
      coberturasHechas: number;
      coberturasRecibidas: number;
      extrasHechos: number;
      intercambiosHechos: number;
      conteoDeberes: Map<string, number>;
      conteoExtras: Map<string, number>;
      conteoAyudados: Map<string, number>;
      conteoDeberesCubiertos: Map<string, number>;
    }
  >();

  for (const p of participantes) {
    const susTx = transacciones.filter((t) => t.participanteId === p.id);
    const susReg = registros.filter((r) => r.participanteId === p.id);
    const susAsig = asignaciones.filter(
      (a) => a.participanteId === p.id && !estabaAusente(p.id, a.fecha),
    );

    const propiosPts = redond(
      susTx
        .filter((t) => t.tipo === "cumplimiento")
        .reduce((s, t) => s + Number(t.cantidad), 0),
    );
    const solidarioPts = redond(
      susTx
        .filter((t) => t.tipo === "bono_ayuda")
        .reduce((s, t) => s + Number(t.cantidad), 0),
    );
    const extrasPts = redond(
      susTx
        .filter((t) => t.tipo === "reclamable")
        .reduce((s, t) => s + Number(t.cantidad), 0),
    );
    const penalizacionesPts = redond(
      susTx
        .filter(
          (t) =>
            t.tipo === "penalizacion" || t.tipo === "penalizacion_colectiva",
        )
        .reduce((s, t) => s + Number(t.cantidad), 0),
    );
    const ajustesPts = redond(
      susTx
        .filter((t) => t.tipo === "ajuste_admin")
        .reduce((s, t) => s + Number(t.cantidad), 0),
    );
    const totalPts = redond(
      susTx.reduce((s, t) => s + Number(t.cantidad), 0),
    );

    const cumplidosAsig = susAsig.filter((a) =>
      susReg.some(
        (r) =>
          r.estado === "cumplido_propio" &&
          r.deberId === a.deberId &&
          r.fecha === a.fecha,
      ),
    ).length;

    const porcentajeConfiable =
      susAsig.length > 0
        ? Math.round((cumplidosAsig / susAsig.length) * 100)
        : 100;

    const rachaMaximaMes = calcularRachaEnMes(
      susAsig,
      susReg,
      (f) => estabaAusente(p.id, f),
      limiteFechaEvaluacion,
    );

    const regsCobertura = susReg.filter((r) => r.estado === "cubrio_a_otro");
    const coberturasRecibidas = registros.filter(
      (r) => r.estado === "cubrio_a_otro" && r.cubiertoA === p.id,
    ).length;
    const regsExtras = susReg.filter((r) => r.estado === "reclamado");
    const intercambiosHechos = intercambiosAceptados.filter(
      (i) => i.solicitanteId === p.id || i.destinatarioId === p.id,
    ).length;

    const conteoDeberes = new Map<string, number>();
    for (const r of susReg) {
      conteoDeberes.set(r.deberId, (conteoDeberes.get(r.deberId) || 0) + 1);
    }

    const conteoExtras = new Map<string, number>();
    for (const r of regsExtras) {
      conteoExtras.set(r.deberId, (conteoExtras.get(r.deberId) || 0) + 1);
    }

    const conteoAyudados = new Map<string, number>();
    const conteoDeberesCubiertos = new Map<string, number>();
    for (const r of regsCobertura) {
      if (r.cubiertoA) {
        conteoAyudados.set(
          r.cubiertoA,
          (conteoAyudados.get(r.cubiertoA) || 0) + 1,
        );
      }
      conteoDeberesCubiertos.set(
        r.deberId,
        (conteoDeberesCubiertos.get(r.deberId) || 0) + 1,
      );
    }

    statsPorParticipante.set(p.id, {
      propiosPts,
      solidarioPts,
      extrasPts,
      penalizacionesPts,
      ajustesPts,
      totalPts,
      cumplidosPropios: cumplidosAsig,
      asignadosValidos: susAsig.length,
      porcentajeConfiable,
      rachaMaximaMes,
      coberturasHechas: regsCobertura.length,
      coberturasRecibidas,
      extrasHechos: regsExtras.length,
      intercambiosHechos,
      conteoDeberes,
      conteoExtras,
      conteoAyudados,
      conteoDeberesCubiertos,
    });
  }

  // Clasificador en memoria idéntico a calcularRankings para evitar consultas duplicadas a BD
  function clasificar(filas: Omit<FilaRanking, "posicion">[]): FilaRanking[] {
    const ordenadas = [...filas].sort((a, b) => b.valor - a.valor);
    let posicion = 0;
    let valorPrevio: number | null = null;
    return ordenadas.map((fila, indice) => {
      if (valorPrevio === null || fila.valor !== valorPrevio) {
        posicion = indice + 1;
        valorPrevio = fila.valor;
      }
      return { ...fila, posicion };
    });
  }

  const rankings = {
    mes: mesValidado,
    general: clasificar(
      participantes.map((p) => ({
        participanteId: p.id,
        nombre: p.nombre,
        fotoUrl: p.fotoUrl,
        valor: statsPorParticipante.get(p.id)?.totalPts ?? 0,
      })),
    ),
    confiable: clasificar(
      participantes.map((p) => {
        const st = statsPorParticipante.get(p.id);
        return {
          participanteId: p.id,
          nombre: p.nombre,
          fotoUrl: p.fotoUrl,
          valor: st?.porcentajeConfiable ?? 100,
          detalle: `${st?.cumplidosPropios ?? 0}/${st?.asignadosValidos ?? 0} cumplidos`,
        };
      }),
    ),
    solidario: clasificar(
      participantes.map((p) => ({
        participanteId: p.id,
        nombre: p.nombre,
        fotoUrl: p.fotoUrl,
        valor: statsPorParticipante.get(p.id)?.solidarioPts ?? 0,
      })),
    ),
    responsable: clasificar(
      participantes.map((p) => ({
        participanteId: p.id,
        nombre: p.nombre,
        fotoUrl: p.fotoUrl,
        valor: statsPorParticipante.get(p.id)?.extrasPts ?? 0,
      })),
    ),
  };

  // Helper para obtener el deber más repetido de un mapa de conteos
  function obtenerTopDeber(mapa: Map<string, number>) {
    let topId: string | null = null;
    let maxVeces = 0;
    for (const [deberId, veces] of mapa.entries()) {
      if (veces > maxVeces) {
        maxVeces = veces;
        topId = deberId;
      }
    }
    if (!topId) return null;
    const d = mapaDeberes.get(topId);
    if (!d) return null;
    return {
      nombre: d.nombre,
      icono: d.icono || "✨",
      puntos: Number(d.puntos),
      veces: maxVeces,
    };
  }

  // ── 3. Construcción de los 4 Títulos Oficiales con Storytelling ───────────

  // 3.1 CONFIABLE
  const filasConfiable = rankings.confiable;
  const ganadoresConfiable = filasConfiable.filter(
    (f) =>
      f.posicion === 1 &&
      f.valor > 0 &&
      (statsPorParticipante.get(f.participanteId)?.asignadosValidos ?? 0) > 0,
  );
  const ganadorConfiable = ganadoresConfiable[0] || null;
  const segundoConfiable =
    filasConfiable.find((f) => f.posicion > 1) || filasConfiable[1] || null;
  const terceroConfiable =
    filasConfiable.find((f) => f.posicion > 2) || filasConfiable[2] || null;

  const stConfiable = ganadorConfiable
    ? statsPorParticipante.get(ganadorConfiable.participanteId)
    : null;
  const topDeberConfiable = stConfiable
    ? obtenerTopDeber(stConfiable.conteoDeberes)
    : null;

  const diffConfiable =
    ganadorConfiable && segundoConfiable
      ? ganadoresConfiable.length > 1
        ? `Empate en la cima (${ganadoresConfiable.map((g) => g.nombre).join(" y ")})`
        : `+${ganadorConfiable.valor - segundoConfiable.valor}% sobre ${segundoConfiable.nombre}`
      : "Líder de constancia";

  const tituloConfiable: TituloOficialWrapped = {
    clave: "confiable",
    tituloOficial: "El Más Confiable",
    subtitulo: "Reloj Suizo de la Casa",
    descripcionCorta: "Mayor porcentaje (%) de cumplimiento en sus deberes propios asignados.",
    icono: "🎯",
    temaColor: "esmeralda",
    ganador: ganadorConfiable,
    empatados: ganadoresConfiable,
    segundoLugar: segundoConfiable,
    tercerLugar: terceroConfiable,
    tablaCompleta: filasConfiable,
    valorFormateado: ganadorConfiable ? `${ganadorConfiable.valor}%` : "0%",
    diferenciaConSegundo: diffConfiable,
    porQueGano: ganadorConfiable && stConfiable
      ? {
          headline:
            ganadoresConfiable.length > 1
              ? `${ganadoresConfiable.map((g) => g.nombre).join(" y ")} compartieron la corona de precisión con un ${ganadorConfiable.valor}% de efectividad en sus deberes.`
              : `${ganadorConfiable.nombre} fue sinónimo de garantía: cumplió ${stConfiable.cumplidosPropios} de ${stConfiable.asignadosValidos} deberes asignados sin dejar caer la guardia.`,
          bullets: [
            {
              icono: "✅",
              etiqueta: "Efectividad en deberes propios",
              valor: `${stConfiable.cumplidosPropios}/${stConfiable.asignadosValidos} cumplidos (${ganadorConfiable.valor}%)`,
              detalle: segundoConfiable
                ? `Superó el ${segundoConfiable.valor}% de ${segundoConfiable.nombre}`
                : "Efectividad comprobada",
            },
            {
              icono: "🔥",
              etiqueta: "Mejor racha dentro del mes",
              valor: `${stConfiable.rachaMaximaMes} ${stConfiable.rachaMaximaMes === 1 ? "día impecable" : "días seguidos sin fallar"}`,
              detalle: "Cumpliendo al 100% lo asignado cada día",
            },
            {
              icono: topDeberConfiable?.icono || "🛡️",
              etiqueta: "Deber más cumplido",
              valor: topDeberConfiable
                ? `${topDeberConfiable.nombre} (${topDeberConfiable.veces} veces)`
                : `${stConfiable.propiosPts} pts en deberes propios`,
              detalle: "Su trinchera principal durante el mes",
            },
          ],
        }
      : {
          headline: "Aún no hay asignaciones evaluadas en este período para coronar este título.",
          bullets: [],
        },
  };

  // 3.2 SOLIDARIO
  const filasSolidario = rankings.solidario;
  const ganadoresSolidario = filasSolidario.filter(
    (f) => f.posicion === 1 && f.valor > 0,
  );
  const ganadorSolidario = ganadoresSolidario[0] || null;
  const segundoSolidario =
    filasSolidario.find((f) => f.posicion > 1) || filasSolidario[1] || null;
  const terceroSolidario =
    filasSolidario.find((f) => f.posicion > 2) || filasSolidario[2] || null;

  const stSolidario = ganadorSolidario
    ? statsPorParticipante.get(ganadorSolidario.participanteId)
    : null;

  let hermanoMasAyudadoTexto = "Siempre listo para cubrir al equipo";
  if (stSolidario && stSolidario.conteoAyudados.size > 0) {
    const entradas = [...stSolidario.conteoAyudados.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    const [idAyudado, veces] = entradas[0];
    const nombreAyudado = mapaParticipantes.get(idAyudado)?.nombre || "su hermano";
    hermanoMasAyudadoTexto = `Salvó a ${nombreAyudado} en ${veces} ${veces === 1 ? "ocasión" : "ocasiones"}`;
  }

  const topDeberCubierto = stSolidario
    ? obtenerTopDeber(stSolidario.conteoDeberesCubiertos)
    : null;

  const diffSolidario =
    ganadorSolidario && segundoSolidario
      ? ganadoresSolidario.length > 1
        ? `Empate solidario (${ganadoresSolidario.map((g) => g.nombre).join(" y ")})`
        : `+${redond(ganadorSolidario.valor - segundoSolidario.valor)} pts sobre ${segundoSolidario.nombre}`
      : "Salvavidas oficial de la casa";

  const tituloSolidario: TituloOficialWrapped = {
    clave: "solidario",
    tituloOficial: "El Más Solidario",
    subtitulo: "Héroe Sin Capa",
    descripcionCorta: "Puntos ganados cubriendo los deberes de sus hermanos tras cumplir el propio.",
    icono: "🤝",
    temaColor: "ambar",
    ganador: ganadorSolidario,
    empatados: ganadoresSolidario,
    segundoLugar: segundoSolidario,
    tercerLugar: terceroSolidario,
    tablaCompleta: filasSolidario,
    valorFormateado: ganadorSolidario ? `${redond(ganadorSolidario.valor)} pts` : "0 pts",
    diferenciaConSegundo: diffSolidario,
    porQueGano: ganadorSolidario && stSolidario
      ? {
          headline:
            ganadoresSolidario.length > 1
              ? `${ganadoresSolidario.map((g) => g.nombre).join(" y ")} lideraron los rescates del hogar con ${redond(ganadorSolidario.valor)} pts solidarios.`
              : `Cuando alguien no podía, ${ganadorSolidario.nombre} dio un paso al frente: hizo su propio deber y además salió al rescate ${stSolidario.coberturasHechas} ${stSolidario.coberturasHechas === 1 ? "vez" : "veces"}.`,
          bullets: [
            {
              icono: "🛟",
              etiqueta: "Rescates confirmados",
              valor: `${stSolidario.coberturasHechas} ${stSolidario.coberturasHechas === 1 ? "cobertura" : "coberturas"} (+${redond(ganadorSolidario.valor)} pts)`,
              detalle: "Cumpliendo primero su propio deber del día",
            },
            {
              icono: "🫶",
              etiqueta: "Compañero más respaldado",
              valor: hermanoMasAyudadoTexto,
              detalle: "Evitando penalizaciones para la casa",
            },
            {
              icono: topDeberCubierto?.icono || "⚡",
              etiqueta: "Rescate especialidad",
              valor: topDeberCubierto
                ? `${topDeberCubierto.nombre} (${topDeberCubierto.veces} ${topDeberCubierto.veces === 1 ? "vez" : "veces"})`
                : "Apoyo directo en deberes rotativos",
              detalle: diffSolidario,
            },
          ],
        }
      : {
          headline: "Este mes cada quien sostuvo su trinchera sin registrar coberturas con bono.",
          bullets: [
            {
              icono: "🤝",
              etiqueta: "Regla del Bono Solidario",
              valor: "+15 pts al cubrir a un hermano",
              detalle: "Se activa tras haber cumplido tu propio deber del día",
            },
          ],
        },
  };

  // 3.3 RESPONSABLE
  const filasResponsable = rankings.responsable;
  const ganadoresResponsable = filasResponsable.filter(
    (f) => f.posicion === 1 && f.valor > 0,
  );
  const ganadorResponsable = ganadoresResponsable[0] || null;
  const segundoResponsable =
    filasResponsable.find((f) => f.posicion > 1) || filasResponsable[1] || null;
  const terceroResponsable =
    filasResponsable.find((f) => f.posicion > 2) || filasResponsable[2] || null;

  const stResponsable = ganadorResponsable
    ? statsPorParticipante.get(ganadorResponsable.participanteId)
    : null;
  const topExtra = stResponsable
    ? obtenerTopDeber(stResponsable.conteoExtras)
    : null;

  const shareExtras =
    stResponsable && extrasReclamados > 0
      ? Math.round((stResponsable.extrasHechos / extrasReclamados) * 100)
      : 0;

  const diffResponsable =
    ganadorResponsable && segundoResponsable
      ? ganadoresResponsable.length > 1
        ? `Empate en extras (${ganadoresResponsable.map((g) => g.nombre).join(" y ")})`
        : `+${redond(ganadorResponsable.valor - segundoResponsable.valor)} pts sobre ${segundoResponsable.nombre}`
      : "Líder en tareas reclamables";

  const tituloResponsable: TituloOficialWrapped = {
    clave: "responsable",
    tituloOficial: "Responsable de la Casa",
    subtitulo: "Manos a la Obra",
    descripcionCorta: "Puntos ganados reclamando deberes extras de la casa con evidencia.",
    icono: "🌟",
    temaColor: "violeta",
    ganador: ganadorResponsable,
    empatados: ganadoresResponsable,
    segundoLugar: segundoResponsable,
    tercerLugar: terceroResponsable,
    tablaCompleta: filasResponsable,
    valorFormateado: ganadorResponsable ? `${redond(ganadorResponsable.valor)} pts` : "0 pts",
    diferenciaConSegundo: diffResponsable,
    porQueGano: ganadorResponsable && stResponsable
      ? {
          headline:
            ganadoresResponsable.length > 1
              ? `${ganadoresResponsable.map((g) => g.nombre).join(" y ")} empataron como motores del hogar con ${redond(ganadorResponsable.valor)} pts en extras.`
              : `${ganadorResponsable.nombre} no se conformó con lo mínimo: reclamó ${stResponsable.extrasHechos} ${stResponsable.extrasHechos === 1 ? "tarea extra" : "tareas extra"} y sumó ${redond(ganadorResponsable.valor)} pts adicionales.`,
          bullets: [
            {
              icono: "📸",
              etiqueta: "Extras reclamados y probados",
              valor: `${stResponsable.extrasHechos} ${stResponsable.extrasHechos === 1 ? "extra completado" : "extras completados"}`,
              detalle: `Representó el ${shareExtras}% de todos los extras hechos en la casa`,
            },
            {
              icono: topExtra?.icono || "✨",
              etiqueta: "Extra insignia del mes",
              valor: topExtra
                ? `${topExtra.nombre} (${topExtra.veces} ${topExtra.veces === 1 ? "vez" : "veces"})`
                : "Tareas adicionales del hogar",
              detalle: topExtra
                ? `Aportó +${redond(topExtra.veces * topExtra.puntos)} pts solo en esta tarea`
                : "Iniciativa propia",
            },
            {
              icono: "🚀",
              etiqueta: "Ventaja en la categoría",
              valor: diffResponsable,
              detalle: segundoResponsable
                ? `${segundoResponsable.nombre} quedó 2º con ${redond(segundoResponsable.valor)} pts`
                : "Dominio absoluto",
            },
          ],
        }
      : {
          headline: "Ningún participante reclamó deberes extras durante este período.",
          bullets: [
            {
              icono: "🌟",
              etiqueta: "Oportunidad de puntos",
              valor: "Lavar ropa, Limpieza profunda, Bañar a Sofi",
              detalle: "Reclama extras con foto para liderar esta categoría",
            },
          ],
        },
  };

  // 3.4 GENERAL (CAMPEÓN DEL MES)
  const filasGeneral = rankings.general;
  const ganadoresGeneral = filasGeneral.filter(
    (f) => f.posicion === 1 && f.valor > 0,
  );
  const ganadorGeneral = ganadoresGeneral[0] || null;
  const segundoGeneral =
    filasGeneral.find((f) => f.posicion > 1) || filasGeneral[1] || null;
  const terceroGeneral =
    filasGeneral.find((f) => f.posicion > 2) || filasGeneral[2] || null;

  const stGeneral = ganadorGeneral
    ? statsPorParticipante.get(ganadorGeneral.participanteId)
    : null;
  const stSegundoGeneral = segundoGeneral
    ? statsPorParticipante.get(segundoGeneral.participanteId)
    : null;

  const ventajaGeneral =
    ganadorGeneral && segundoGeneral
      ? redond(ganadorGeneral.valor - segundoGeneral.valor)
      : 0;

  // Determinar matemáticamente cuál fue la llave de la victoria sobre el 2º lugar
  let factorDecisivoValor = "Constancia total en todos los frentes";
  let factorDecisivoDetalle = "Sumó puntos de manera sostenida durante todo el mes";
  if (stGeneral && stSegundoGeneral && segundoGeneral) {
    const diffPropios = redond(stGeneral.propiosPts - stSegundoGeneral.propiosPts);
    const diffExtras = redond(stGeneral.extrasPts - stSegundoGeneral.extrasPts);
    const diffSolidario = redond(
      stGeneral.solidarioPts - stSegundoGeneral.solidarioPts,
    );
    const diffPenal = redond(
      stGeneral.penalizacionesPts - stSegundoGeneral.penalizacionesPts,
    );

    const factores = [
      {
        nombre: "Los deberes extras reclamables",
        diff: diffExtras,
        detalle: `Sacó +${diffExtras} pts de ventaja en extras frente a ${segundoGeneral.nombre}`,
      },
      {
        nombre: "Los bonos por cubrir hermanos",
        diff: diffSolidario,
        detalle: `Sumó +${diffSolidario} pts más en ayudas solidarias que ${segundoGeneral.nombre}`,
      },
      {
        nombre: "El cumplimiento de deberes propios",
        diff: diffPropios,
        detalle: `Acumuló +${diffPropios} pts de ventaja en deberes asignados`,
      },
      {
        nombre: "Cuidado contra penalizaciones",
        diff: diffPenal,
        detalle: `Perdió ${Math.abs(diffPenal)} pts menos en sanciones que ${segundoGeneral.nombre}`,
      },
    ].sort((a, b) => b.diff - a.diff);

    if (factores[0] && factores[0].diff > 0) {
      factorDecisivoValor = factores[0].nombre;
      factorDecisivoDetalle = factores[0].detalle;
    }
  }

  const diffGeneralTexto =
    ganadorGeneral && segundoGeneral
      ? ganadoresGeneral.length > 1
        ? `Empate histórico en el 1º lugar (${redond(ganadorGeneral.valor)} pts)`
        : `+${ventajaGeneral} pts de ventaja sobre ${segundoGeneral.nombre} (${redond(segundoGeneral.valor)} pts)`
      : "1º lugar absoluto de la casa";

  const tituloGeneral: TituloOficialWrapped = {
    clave: "general",
    tituloOficial: "Campeón del Mes",
    subtitulo: "Corona General de la Casa",
    descripcionCorta: "Puntaje máximo absoluto en el libro mayor de la casa al cierre del mes.",
    icono: "👑",
    temaColor: "oro",
    ganador: ganadorGeneral,
    empatados: ganadoresGeneral,
    segundoLugar: segundoGeneral,
    tercerLugar: terceroGeneral,
    tablaCompleta: filasGeneral,
    valorFormateado: ganadorGeneral ? `${redond(ganadorGeneral.valor)} pts` : "0 pts",
    diferenciaConSegundo: diffGeneralTexto,
    porQueGano: ganadorGeneral && stGeneral
      ? {
          headline:
            ganadoresGeneral.length > 1
              ? `¡Final de fotografía! ${ganadoresGeneral.map((g) => g.nombre).join(" y ")} conquistaron la cima del hogar con ${redond(ganadorGeneral.valor)} puntos.`
              : `${ganadorGeneral.nombre} dominó ${labelMes} con ${redond(ganadorGeneral.valor)} puntos totales, superando a ${segundoGeneral?.nombre || "sus hermanos"} por ${ventajaGeneral} puntos.`,
          bullets: [
            {
              icono: "📊",
              etiqueta: "Fórmula de sus puntos",
              valor: `${stGeneral.propiosPts} propios · +${stGeneral.extrasPts} extras · +${stGeneral.solidarioPts} ayuda`,
              detalle:
                stGeneral.penalizacionesPts < 0
                  ? `Incluye ${stGeneral.penalizacionesPts} pts en penalizaciones`
                  : "¡Mes limpio sin perder puntos por penalización!",
            },
            {
              icono: "🔑",
              etiqueta: "¿Qué definió la victoria?",
              valor: factorDecisivoValor,
              detalle: factorDecisivoDetalle,
            },
            {
              icono: "🏁",
              etiqueta: "Margen en la meta",
              valor: diffGeneralTexto,
              detalle: terceroGeneral
                ? `3º lugar: ${terceroGeneral.nombre} con ${redond(terceroGeneral.valor)} pts`
                : "Podio oficial del hogar",
            },
          ],
        }
      : {
          headline: "Aún no se registran puntos en el libro mayor para este mes.",
          bullets: [],
        },
  };

  // ── 4. Hitos Curiosos del Mes ─────────────────────────────────────────────

  // 4.1 Dupla solidaria (quién ayudó más a quién)
  const paresAyuda = new Map<string, number>();
  for (const r of registros) {
    if (r.estado === "cubrio_a_otro" && r.cubiertoA) {
      const clavePar = `${r.participanteId}:${r.cubiertoA}`;
      paresAyuda.set(clavePar, (paresAyuda.get(clavePar) || 0) + 1);
    }
  }
  let duplaSolidaria: WrappedMensualData["hitosCuriosos"]["duplaSolidaria"] = null;
  for (const [clavePar, veces] of paresAyuda.entries()) {
    const [ayudanteId, ayudadoId] = clavePar.split(":");
    const ayudanteNombre = mapaParticipantes.get(ayudanteId)?.nombre;
    const ayudadoNombre = mapaParticipantes.get(ayudadoId)?.nombre;
    if (!ayudanteNombre || !ayudadoNombre) continue;
    if (!duplaSolidaria || veces > duplaSolidaria.veces) {
      duplaSolidaria = {
        ayudanteNombre,
        ayudadoNombre,
        veces,
        puntosBono: redond(veces * Number(hogarObj?.bonoAyuda ?? 5)),
      };
    }
  }

  // 4.2 Especialista del mes (la persona que más veces hizo un mismo deber)
  let especialistaMes: WrappedMensualData["hitosCuriosos"]["especialistaMes"] =
    null;
  for (const p of participantes) {
    const st = statsPorParticipante.get(p.id);
    if (!st) continue;
    for (const [deberId, veces] of st.conteoDeberes.entries()) {
      const d = mapaDeberes.get(deberId);
      if (!d) continue;
      if (!especialistaMes || veces > especialistaMes.veces) {
        especialistaMes = {
          participanteNombre: p.nombre,
          deberNombre: d.nombre,
          deberIcono: d.icono || "✨",
          veces,
        };
      }
    }
  }

  // 4.3 Rey del trueque
  let reyDelTrueque: WrappedMensualData["hitosCuriosos"]["reyDelTrueque"] = null;
  for (const p of participantes) {
    const st = statsPorParticipante.get(p.id);
    if (!st || st.intercambiosHechos === 0) continue;
    if (!reyDelTrueque || st.intercambiosHechos > reyDelTrueque.intercambios) {
      reyDelTrueque = {
        nombre: p.nombre,
        intercambios: st.intercambiosHechos,
      };
    }
  }

  // 4.4 Nota destacada real dejada en registros del mes
  const registroConNota = [...registros]
    .filter((r) => r.nota && r.nota.trim().length > 2)
    .sort((a, b) => (b.fecha > a.fecha ? 1 : -1))[0];

  let notaDestacada: WrappedMensualData["hitosCuriosos"]["notaDestacada"] = null;
  if (registroConNota && registroConNota.nota) {
    const autor = mapaParticipantes.get(registroConNota.participanteId);
    const ayudado = registroConNota.cubiertoA
      ? mapaParticipantes.get(registroConNota.cubiertoA)
      : undefined;
    const deber = mapaDeberes.get(registroConNota.deberId);
    if (autor && deber) {
      notaDestacada = {
        autorNombre: autor.nombre,
        ayudadoNombre: ayudado?.nombre,
        deberNombre: deber.nombre,
        deberIcono: deber.icono || "✨",
        nota: registroConNota.nota.trim(),
        fechaLabel: formatearDiaCorto(registroConNota.fecha),
      };
    }
  }

  const obligatoriosCumplidosTotal = registros.filter((r) => {
    const d = mapaDeberes.get(r.deberId);
    return d?.esObligatorio;
  }).length;

  // ── 5. Podio Final y Títulos de cada Participante ─────────────────────────
  const DEFINICIONES_TITULOS: Record<
    ClaveRankingOficial,
    { nombre: string; icono: string }
  > = {
    general: { nombre: "Campeón General", icono: "👑" },
    confiable: { nombre: "Más Confiable", icono: "🎯" },
    solidario: { nombre: "Más Solidario", icono: "🤝" },
    responsable: { nombre: "Más Responsable", icono: "🌟" },
  };

  const podioFinal: PerfilParticipanteWrapped[] = filasGeneral.map((fila) => {
    const st = statsPorParticipante.get(fila.participanteId)!;
    const topDeber = obtenerTopDeber(st.conteoDeberes);

    // Títulos ganados (de titulos_mes si ya se guardaron, o calculados en vivo del mes)
    const clavesGanadas = new Set<ClaveRankingOficial>();
    for (const tg of titulosGuardados) {
      if (tg.participanteId === fila.participanteId) {
        clavesGanadas.add(tg.ranking as ClaveRankingOficial);
      }
    }
    if (ganadoresGeneral.some((g) => g.participanteId === fila.participanteId)) {
      clavesGanadas.add("general");
    }
    if (
      ganadoresConfiable.some((g) => g.participanteId === fila.participanteId)
    ) {
      clavesGanadas.add("confiable");
    }
    if (
      ganadoresSolidario.some((g) => g.participanteId === fila.participanteId)
    ) {
      clavesGanadas.add("solidario");
    }
    if (
      ganadoresResponsable.some((g) => g.participanteId === fila.participanteId)
    ) {
      clavesGanadas.add("responsable");
    }

    const ordenClaves: ClaveRankingOficial[] = [
      "general",
      "confiable",
      "solidario",
      "responsable",
    ];
    const titulosGanados = ordenClaves
      .filter((c) => clavesGanadas.has(c))
      .map((c) => ({
        clave: c,
        nombre: DEFINICIONES_TITULOS[c].nombre,
        icono: DEFINICIONES_TITULOS[c].icono,
      }));

    // Determinar arquetipo personalizado del participante
    let arquetipoMes = {
      titulo: "Pilar de la Casa",
      icono: "🏠",
      motivo: `${st.cumplidosPropios} deberes propios cumplidos`,
    };
    if (clavesGanadas.has("general") && clavesGanadas.size >= 2) {
      arquetipoMes = {
        titulo: "Multicampeón del Mes",
        icono: "👑",
        motivo: `Conquistó ${clavesGanadas.size} títulos oficiales en ${mesNombre}`,
      };
    } else if (clavesGanadas.has("general")) {
      arquetipoMes = {
        titulo: "MVP del Hogar",
        icono: "🏆",
        motivo: `1º en la tabla general con ${st.totalPts} pts`,
      };
    } else if (clavesGanadas.has("solidario")) {
      arquetipoMes = {
        titulo: "Ángel Guardián",
        icono: "🤝",
        motivo: `${st.coberturasHechas} rescates a sus hermanos`,
      };
    } else if (clavesGanadas.has("responsable")) {
      arquetipoMes = {
        titulo: "Motor Todo-Terreno",
        icono: "🌟",
        motivo: `+${st.extrasPts} pts en tareas extra reclamables`,
      };
    } else if (clavesGanadas.has("confiable")) {
      arquetipoMes = {
        titulo: "Reloj Suizo",
        icono: "🎯",
        motivo: `${st.porcentajeConfiable}% de efectividad en su plan`,
      };
    } else if (st.rachaMaximaMes >= 5) {
      arquetipoMes = {
        titulo: "Racha de Fuego",
        icono: "🔥",
        motivo: `${st.rachaMaximaMes} días seguidos sin fallar`,
      };
    } else if (topDeber) {
      arquetipoMes = {
        titulo: `Especialista en ${topDeber.nombre}`,
        icono: topDeber.icono,
        motivo: `Lo completó ${topDeber.veces} veces este mes`,
      };
    }

    return {
      participanteId: fila.participanteId,
      nombre: fila.nombre,
      fotoUrl: fila.fotoUrl,
      posicionGeneral: fila.posicion,
      puntosTotales: redond(fila.valor),
      desglosePuntos: {
        propios: st.propiosPts,
        solidario: st.solidarioPts,
        extras: st.extrasPts,
        penalizaciones: st.penalizacionesPts,
        ajustes: st.ajustesPts,
      },
      porcentajeConfiable: st.porcentajeConfiable,
      cumplidosPropios: st.cumplidosPropios,
      asignadosValidos: st.asignadosValidos,
      rachaMaximaMes: st.rachaMaximaMes,
      coberturasHechas: st.coberturasHechas,
      coberturasRecibidas: st.coberturasRecibidas,
      extrasHechos: st.extrasHechos,
      intercambiosHechos: st.intercambiosHechos,
      deberFavorito: topDeber
        ? {
            nombre: topDeber.nombre,
            icono: topDeber.icono,
            veces: topDeber.veces,
          }
        : null,
      titulosGanados,
      arquetipoMes,
    };
  });

  const miResumen =
    podioFinal.find((p) => p.participanteId === viewer?.id) ||
    podioFinal[0] ||
    null;

  const hayActividad =
    registros.length > 0 || transacciones.length > 0 || asignaciones.length > 0;

  return {
    mes: mesValidado,
    mesNombre,
    anio,
    labelMes,
    hogarNombre: hogarObj?.nombre || "Nuestro Hogar",
    esMesCerrado,
    hayActividad,
    viewerId: viewer?.id || "",
    viewerNombre: viewer?.nombre || "Familia",
    pulsoHogar: {
      puntosTotalesGenerados,
      balanceNetoHogar,
      totalCumplimientos: registros.length,
      propiosCumplidos,
      coberturasRealizadas,
      extrasReclamados,
      intercambiosPactados: intercambiosAceptados.length,
      diasActivos: diasConActividadSet.size,
      diasTotalesMes,
      penalizacionesColectivas,
      diaRecord,
      deberEstrella,
    },
    titulosOficiales: {
      confiable: tituloConfiable,
      solidario: tituloSolidario,
      responsable: tituloResponsable,
      general: tituloGeneral,
    },
    hitosCuriosos: {
      duplaSolidaria,
      especialistaMes,
      reyDelTrueque,
      notaDestacada,
      obligatoriosCumplidosTotal,
    },
    podioFinal,
    miResumen,
  };
}
