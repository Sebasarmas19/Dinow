import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db";
import {
  asignaciones,
  criteriosDeber,
  deberes,
  hogar,
  participantes,
  registros,
  transaccionesPuntos,
} from "../db/schema";
import { formatearFechaISO, formatearFechaLabel, obtenerFechaDeNegocio } from "../shared/date";
import type { DeberHoy, ExtraSemana, HermanoEstado, HomeScreenProps } from "../../app/_components/home-screen";

/**
 * Obtiene todos los datos consolidados necesarios para renderizar el HomeScreen.
 */
export async function getHomeScreenData(usuarioNombre?: string): Promise<HomeScreenProps> {
  // 1. Obtener el hogar (como es single-tenant por ahora, sacamos el primero)
  const [hogarActual] = await db.select().from(hogar).limit(1);
  if (!hogarActual) throw new Error("No hay un hogar configurado. Corre el seed.");

  // 2. Obtener la fecha de negocio (Cierre a las 3:00 AM)
  const fechaActual = obtenerFechaDeNegocio();
  const fechaHoyStr = formatearFechaISO(fechaActual);
  const dateLabel = formatearFechaLabel(fechaActual);
  
  // Mapa de días de la semana
  const diasSemana = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const diaActualStr = diasSemana[fechaActual.getDay()];

  // 3. Obtener participantes activos
  const participantesActivos = await db
    .select()
    .from(participantes)
    .where(and(eq(participantes.hogarId, hogarActual.id), eq(participantes.activo, true)))
    .orderBy(participantes.ordenRotacion);

  if (participantesActivos.length === 0) throw new Error("No hay participantes.");

  // Determinar quién es "Yo"
  let yo = participantesActivos.find((p) => p.nombre.toLowerCase() === usuarioNombre?.toLowerCase());
  if (!yo) yo = participantesActivos[0];

  // 4. Obtener asignaciones de HOY (deberes obligatorios) con sus criterios
  const asignacionesHoy = await db
    .select({
      asignacion: asignaciones,
      deber: deberes,
      criterio: criteriosDeber,
    })
    .from(asignaciones)
    .innerJoin(deberes, eq(asignaciones.deberId, deberes.id))
    .leftJoin(criteriosDeber, eq(criteriosDeber.deberId, deberes.id))
    .where(and(eq(asignaciones.hogarId, hogarActual.id), eq(asignaciones.fecha, fechaHoyStr)));

  // Agrupar criterios por deber
  const deberesAgrupados = new Map<string, { asignacion: any; deber: any; criterios: string[] }>();
  for (const fila of asignacionesHoy) {
    const key = fila.asignacion.id;
    if (!deberesAgrupados.has(key)) {
      deberesAgrupados.set(key, { asignacion: fila.asignacion, deber: fila.deber, criterios: [] });
    }
    if (fila.criterio) {
      deberesAgrupados.get(key)!.criterios.push(fila.criterio.descripcion);
    }
  }

  // 5. Obtener los registros de hoy (para saber qué está cumplido)
  const registrosHoy = await db
    .select()
    .from(registros)
    .where(and(eq(registros.hogarId, hogarActual.id), eq(registros.fecha, fechaHoyStr)));

  // Determinar qué deberes de asignación ya fueron cumplidos
  const deberesCumplidosPor = new Set(registrosHoy.filter(r => r.estado === "cumplido_propio").map(r => r.participanteId));
  const coberturasAConfirmar = new Set(registrosHoy.filter(r => r.estado === "cubrio_a_otro" && r.participanteId === yo.id).map(r => r.cubiertoA));
  const extrasReclamadosPorMi = new Set(registrosHoy.filter(r => r.estado === "reclamado" && r.participanteId === yo.id).map(r => r.deberId));

  // Preparar deberes del usuario actual (`deberesHoy`)
  const misDeberes: DeberHoy[] = [];
  const hermanosData: HermanoEstado[] = [];

  // Mapeo manual de colores predefinidos (siguiendo tu diseño original)
  const estilosHermanos: Record<string, { card: string; ring: string }> = {
    Sebastián: { card: "background:#FFFDF9;border:1px solid #F0E6D5;", ring: "background:#F4E4CE;border:2px solid #E9CBA0;" },
    Samuel: { card: "background:#FFF4EC;border:2px solid #E2733F;box-shadow:0 10px 22px -14px rgba(210,96,47,.6);", ring: "background:#FBD9C4;border:2px solid #E2733F;" },
    Silvana: { card: "background:#FFFDF9;border:1px solid #F0E6D5;", ring: "background:#EFE0D0;border:2px solid #DFC9AE;" },
  };

  const misPersonalesList: any[] = [];

  // 6. Construir lista de hermanos y extraer mis deberes
  for (const part of participantesActivos) {
    const esYo = part.id === yo.id;
    
    const misAsignaciones = Array.from(deberesAgrupados.values()).filter((a) => a.asignacion.participanteId === part.id && a.deber.tipoAsignacion === "rotativo");
    const misRotativos = misAsignaciones.filter(a => !a.deber.esPersonal);
    const misPersonales = misAsignaciones.filter(a => a.deber.esPersonal);
    
    // Asumimos que la primera o la más pesada es la principal para mostrar a los hermanos
    const asignacionPrincipal = misRotativos[0];
    
    // Determinar si cumplió su deber principal
    const estaCumplido = asignacionPrincipal ? registrosHoy.some(r => r.estado === "cumplido_propio" && r.participanteId === part.id && r.deberId === asignacionPrincipal.deber.id) : false;

    // Determinar si hay alguien que cubrió este deber hacia mí
    const coberturaHaciaMi = asignacionPrincipal
      ? registrosHoy.find(
          (r) =>
            r.estado === "cubrio_a_otro" &&
            r.cubiertoA === part.id &&
            r.deberId === asignacionPrincipal.deber.id
        )
      : undefined;
      
    // Si es "Yo", armar Mis Deberes
    if (esYo) {
      for (const item of misRotativos) {
        misDeberes.push({
          id: item.deber.id,
          nombre: item.deber.nombre,
          icono: item.deber.icono || "✨",
          puntos: Number(item.deber.puntos),
          criterios: item.criterios,
          cumplido: estaCumplido, // Warning: if there are multiple chores, this boolean needs to be per chore!
          cubiertoPor: coberturaHaciaMi
            ? {
                registroId: coberturaHaciaMi.id,
                nombreId: coberturaHaciaMi.participanteId,
                nombre:
                  participantesActivos.find(
                    (p) => p.id === coberturaHaciaMi.participanteId
                  )?.nombre || "Alguien",
              }
            : undefined,
        });
      }
      for (const item of misPersonales) {
        misPersonalesList.push(item);
      }
    }

    // Armar el estado del hermano
    // Nota: El rol en el frontend mostraba cosas como "Tú · Sofi" o "Cocina hoy"
    let rolLabel = asignacionPrincipal ? asignacionPrincipal.deber.nombre : "Día libre";
    if (esYo && asignacionPrincipal) {
      rolLabel = `Tú · ${asignacionPrincipal.deber.nombre.split(" ")[0]}`;
    }

    // Configurar emoticonos fijos de prueba por nombre
    const emojiHermano = part.nombre === "Sebastián" ? "🍳" : part.nombre === "Samuel" ? "🐾" : "🍽️";

    const estilo = estilosHermanos[part.nombre] || estilosHermanos["Sebastián"];
    let coberturaStatus: any = coberturasAConfirmar.has(part.id) ? "bonus" : undefined;
    
    if (!coberturaStatus && coberturaHaciaMi) {
      coberturaStatus = "cubierto_por_otro";
    }

    // TODO: estaCumplido assumes 1 chore! If they have multiple, we need a different check for "has completed ALL their chores".
    // For now, let's keep the existing logic for the "brother" view.
    const asignacion = asignacionPrincipal;

    hermanosData.push({
      participanteId: part.id,
      cobertura: coberturaStatus as any,
      nombre: part.nombre,
      rol: rolLabel,
      emoji: asignacion?.deber.icono || "✨", // Using the chore's icon as the emoji fallback
      fotoUrl: part.fotoUrl,
      esYo,
      cumplido: estaCumplido,
      deberId: asignacion?.deber.id || "",
      deberNombre: asignacion?.deber.nombre || "Ninguno",
      deberPuntos: asignacion ? Number(asignacion.deber.puntos) : 0,
      deberCriterios: asignacion?.criterios || [],
      cardStyle: esYo ? estilosHermanos["Samuel"].card : estilo.card, // Forzamos estilo resaltado si esYo
      ringStyle: esYo ? estilosHermanos["Samuel"].ring : estilo.ring,
    });
  }

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
        eq(deberes.activo, true)
      )
    );

  // Filtrar los que están disponibles hoy (diasDisponibles)
  const extrasAgrupados = new Map<string, { deber: any; criterios: string[] }>();
  for (const fila of deberesExtras) {
    // Verificar si está disponible hoy
    if (!fila.deber.diasDisponibles || !fila.deber.diasDisponibles.includes(diaActualStr)) {
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

  const extrasFormateados: ExtraSemana[] = Array.from(extrasAgrupados.values()).map((e) => ({
    reclamadoHoy: extrasReclamadosPorMi.has(e.deber.id),
    clave: e.deber.id,
    icono: e.deber.icono || "✨",
    label: e.deber.nombre,
    meta: e.deber.requiereFoto ? `${e.deber.puntos} pts · pide foto 📷` : `${e.deber.puntos} pts`,
    puntos: Number(e.deber.puntos),
    criterios: e.criterios,
    esPersonal: false,
    requiereFoto: e.deber.requiereFoto,
  }));

  // Agregar mis personales a los extras (para que aparezcan ahí pero con botón de marcar)
  for (const p of misPersonalesList) {
    const estaCumplido = registrosHoy.some(r => r.estado === "cumplido_propio" && r.participanteId === yo.id && r.deberId === p.deber.id);
    extrasFormateados.push({
      reclamadoHoy: estaCumplido, // Si ya lo cumplió, deshabilitar
      clave: p.deber.id,
      icono: p.deber.icono || "✨",
      label: p.deber.nombre,
      meta: p.deber.requiereFoto ? `${p.deber.puntos} pts · personal · pide foto 📷` : `${p.deber.puntos} pts · personal`,
      puntos: Number(p.deber.puntos),
      criterios: p.criterios,
      esPersonal: true,
      requiereFoto: p.deber.requiereFoto,
    });
  }

  // 8. Calcular Puntos del mes y Ranking
  // Obtener primer y último día del mes actual (según fecha de negocio)
  const inicioMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
  const finMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0); // Ultimo dia del mes
  
  const transacciones = await db
    .select()
    .from(transaccionesPuntos)
    .where(
      and(
        eq(transaccionesPuntos.hogarId, hogarActual.id),
        gte(transaccionesPuntos.fecha, formatearFechaISO(inicioMes)),
        lt(transaccionesPuntos.fecha, formatearFechaISO(new Date(finMes.getFullYear(), finMes.getMonth(), finMes.getDate() + 1))) // < primer dia prox mes
      )
    );

  // Calcular totales por participante
  const puntosPorParticipante: Record<string, number> = {};
  for (const p of participantesActivos) {
    puntosPorParticipante[p.id] = 0;
  }

  for (const t of transacciones) {
    if (puntosPorParticipante[t.participanteId] !== undefined) {
      puntosPorParticipante[t.participanteId] += Number(t.cantidad);
    }
  }

  const misPuntosBase = puntosPorParticipante[yo.id];

  // Calcular ranking
  const ranking = Object.entries(puntosPorParticipante)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id);

  const miPosicion = ranking.indexOf(yo.id) + 1;
  const medalla = miPosicion === 1 ? "🥇" : miPosicion === 2 ? "🥈" : miPosicion === 3 ? "🥉" : "";
  const posicionLabel = `${miPosicion}º general ${medalla}`;

  // 9. Retornar los props listos para renderizar
  return {
    miId: yo.id,
    userName: yo.nombre,
    dateLabel,
    deberesHoy: misDeberes,
    hermanos: hermanosData,
    extras: extrasFormateados,
    puntosBase: misPuntosBase,
    posicionLabel,
  };
}
