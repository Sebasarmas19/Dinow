import { obtenerHogarActual } from "@/lib/hogar/hogar.service";
import { obtenerCriteriosEfectivosDeDeber } from "@/lib/intercambio/intercambio.service";
import {
  otorgarPenalizacionColectiva,
  otorgarPenalizacionFallo,
} from "@/lib/puntos/puntos.service";
import {
  idsAusentesEnFecha,
  listarParticipantesActivos,
} from "@/lib/rotacion/rotacion.repo";
import { formatearFechaISO } from "@/lib/shared/date";
import {
  contarPenalizacionesDelDia,
  listarAsignacionesConDeber,
  listarRegistrosDelDia,
} from "./cierre.repo";

/**
 * Motor de cierre del día.
 *
 * Es el "lado negativo" de los puntos: corre cuando el día ya terminó (a las
 * 3 AM de Caracas, disparado por el cron) y revisa lo que quedó SIN hacer.
 *
 * Reglas que aplica (Art. 5 del reglamento + criterios proporcionales + intercambios):
 * 1. Si el responsable no hizo NADA de su lista efectiva del día (K_propio === 0) y no
 *    tiene ausencia válida → penalización completa (−penalizacion_fallo), incluso
 *    si otro hermano lo cubrió por completo.
 * 2. Si el responsable hizo parte de sus criterios efectivos (K_propio > 0) pero quedaron
 *    F criterios sin hacer por nadie → penalización proporcional −(F / N) * penalizacion_fallo.
 * 3. Si el responsable hizo parte (K_propio > 0) y un hermano cubrió el resto
 *    (F === 0) → 0 penalización (deber compartido 100% cumplido).
 * 4. Si en un deber NO NEGOCIABLE quedaron F > 0 criterios sin hacer por nadie →
 *    penalización colectiva proporcional a los tres hermanos.
 */

export type ResultadoCierre = {
  fecha: string;
  yaCerrado: boolean;
  penalizacionesAplicadas: number;
};

export async function cerrarDia(
  fecha: Date,
  opciones?: { forzar?: boolean },
): Promise<ResultadoCierre> {
  const hogar = await obtenerHogarActual();
  if (!hogar) throw new Error("No hay un hogar configurado.");
  const hogarId = hogar.id;
  const fechaStr = formatearFechaISO(fecha);

  // Candado de idempotencia.
  if (!opciones?.forzar) {
    const yaHay = await contarPenalizacionesDelDia(hogarId, fechaStr);
    if (yaHay > 0) {
      return { fecha: fechaStr, yaCerrado: true, penalizacionesAplicadas: 0 };
    }
  }

  const [planDelDia, registrosDelDia, participantesActivos] = await Promise.all([
    listarAsignacionesConDeber(hogarId, fechaStr),
    listarRegistrosDelDia(hogarId, fechaStr),
    listarParticipantesActivos(hogarId),
  ]);

  const ausentes = await idsAusentesEnFecha(
    participantesActivos.map((p) => p.id),
    fechaStr,
  );

  const penalizacionFallo = Number(hogar.penalizacionFallo);
  const penalizacionColectiva = Number(hogar.penalizacionColectiva);

  let aplicadas = 0;

  for (const { asignacion, deber } of planDelDia) {
    // Los deberes personales son extras individuales sin penalización
    if (deber.esPersonal) continue;

    const { efectivos: criteriosDeberActual } =
      await obtenerCriteriosEfectivosDeDeber(
        hogarId,
        fechaStr,
        deber.id,
        asignacion.participanteId,
      );
    const totalCriterios = criteriosDeberActual.length;

    const registrosDeEsteDeber = registrosDelDia.filter(
      (r) => r.deberId === deber.id,
    );

    if (totalCriterios === 0) {
      const hechoPorDueño = registrosDeEsteDeber.some(
        (r) =>
          r.participanteId === asignacion.participanteId &&
          r.estado === "cumplido_propio",
      );
      if (hechoPorDueño) continue;

      const fueCubierto = registrosDeEsteDeber.some(
        (r) =>
          r.estado === "cubrio_a_otro" &&
          r.cubiertoA === asignacion.participanteId,
      );

      if (!ausentes.has(asignacion.participanteId)) {
        await otorgarPenalizacionFallo(
          hogarId,
          asignacion.participanteId,
          fechaStr,
          penalizacionFallo,
        );
        aplicadas++;
      }

      if (deber.esObligatorio && !fueCubierto) {
        for (const p of participantesActivos) {
          if (ausentes.has(p.id)) continue;
          await otorgarPenalizacionColectiva(
            hogarId,
            p.id,
            fechaStr,
            penalizacionColectiva,
          );
          aplicadas++;
        }
      }
      continue;
    }

    // Caso con N criterios efectivos de aceptación
    const idsEfectivos = new Set(criteriosDeberActual.map((c) => c.id));
    const criteriosHechosPorDueno = new Set<string>();
    const criteriosCubiertosPorOtros = new Set<string>();

    for (const r of registrosDeEsteDeber) {
      if (
        r.estado === "cumplido_propio" &&
        r.participanteId === asignacion.participanteId
      ) {
        if (r.criteriosIds === null) {
          criteriosDeberActual.forEach((c) => criteriosHechosPorDueno.add(c.id));
        } else {
          r.criteriosIds
            .filter((id) => idsEfectivos.has(id))
            .forEach((id) => criteriosHechosPorDueno.add(id));
        }
      } else if (
        r.estado === "cubrio_a_otro" &&
        r.cubiertoA === asignacion.participanteId
      ) {
        if (r.criteriosIds === null) {
          criteriosDeberActual.forEach((c) =>
            criteriosCubiertosPorOtros.add(c.id),
          );
        } else {
          r.criteriosIds
            .filter((id) => idsEfectivos.has(id))
            .forEach((id) => criteriosCubiertosPorOtros.add(id));
        }
      }
    }

    const criteriosTotalesCumplidos = new Set<string>([
      ...criteriosHechosPorDueno,
      ...criteriosCubiertosPorOtros,
    ]);

    const pesoDe = (pts: string | number | null | undefined) => {
      const n = Number(pts ?? 0);
      return Number.isFinite(n) && n > 0 ? n : 1;
    };
    const pesoTotal = criteriosDeberActual.reduce(
      (acc, c) => acc + pesoDe(c.puntos),
      0,
    );
    const pesoFaltante = criteriosDeberActual
      .filter((c) => !criteriosTotalesCumplidos.has(c.id))
      .reduce((acc, c) => acc + pesoDe(c.puntos), 0);

    const kPropio = criteriosHechosPorDueno.size;
    const faltantes = Math.max(0, totalCriterios - criteriosTotalesCumplidos.size);

    // Si el dueño hizo al menos 1 criterio y entre él y sus hermanos completaron el 100% (faltantes === 0):
    // ¡Deber compartido 100% cumplido! Sin penalización.
    if (kPropio > 0 && faltantes === 0) {
      continue;
    }

    const fraccionFaltante =
      pesoTotal > 0 ? pesoFaltante / pesoTotal : faltantes / totalCriterios;

    // Penalización individual al responsable (salvo ausencia válida):
    // - Si el dueño no hizo NADA (kPropio === 0), recibe la penalización completa (-15 pts),
    //   incluso si un hermano tuvo que cubrirle el 100% del deber (Art. 5.1).
    // - Si el dueño hizo parte (kPropio > 0) pero dejó criterios sin hacer,
    //   recibe la penalización proporcional al peso de los criterios faltantes.
    if (!ausentes.has(asignacion.participanteId)) {
      const fraccionFallo = kPropio === 0 ? 1 : fraccionFaltante;
      const montoPenalizacion = Math.round(penalizacionFallo * fraccionFallo * 100) / 100;
      if (montoPenalizacion > 0) {
        await otorgarPenalizacionFallo(
          hogarId,
          asignacion.participanteId,
          fechaStr,
          montoPenalizacion,
        );
        aplicadas++;
      }
    }

    // Penalización colectiva (Art. 5.2): si es obligatorio y quedan criterios sin hacer por nadie
    if (deber.esObligatorio && faltantes > 0) {
      const montoColectivo =
        Math.round(penalizacionColectiva * fraccionFaltante * 100) / 100;
      for (const p of participantesActivos) {
        if (ausentes.has(p.id)) continue;
        await otorgarPenalizacionColectiva(
          hogarId,
          p.id,
          fechaStr,
          montoColectivo,
        );
        aplicadas++;
      }
    }
  }

  return { fecha: fechaStr, yaCerrado: false, penalizacionesAplicadas: aplicadas };
}
