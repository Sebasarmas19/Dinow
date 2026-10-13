import { config } from "dotenv";
config({ path: ".env.local" });

import { formatearFechaISO, obtenerFechaDeNegocio } from "../lib/shared/date";

async function main() {
  const { hashClave } = await import("../lib/auth/auth.service");
  const { db } = await import("../lib/db");
  const {
    criteriosDeber,
    deberes,
    hogar,
    participantes,
    planSemanal,
    transaccionesPuntos,
  } = await import("../lib/db/schema");
  const { generarAsignacionesRango } = await import("../lib/rotacion/rotacion.service");
  console.log("🚀 Iniciando seed de producción para Familia Armas...");

  // 1. Limpieza total previa (CASCADE borra dependencias)
  await db.delete(hogar);
  console.log("✔ Tablas limpiadas correctamente.");

  // 2. Crear el hogar
  const [nuevoHogar] = await db
    .insert(hogar)
    .values({
      nombre: "Familia Armas",
      zonaHoraria: "America/Caracas",
      horaCierreDia: "03:00",
      claveAdmin: hashClave("0000"),
      bonoAyuda: "5",
      penalizacionFallo: "15",
      penalizacionColectiva: "10",
    })
    .returning();

  console.log(`✔ Hogar creado: ${nuevoHogar.nombre} (ID: ${nuevoHogar.id})`);

  // 3. Crear participantes con PIN "0000" hasheado con scrypt
  const pin0000Hash = hashClave("0000");

  const [sebastian, samuel, silvana] = await db
    .insert(participantes)
    .values([
      {
        hogarId: nuevoHogar.id,
        nombre: "Sebastián",
        esAdmin: true,
        ordenRotacion: 1,
        pinHash: pin0000Hash,
      },
      {
        hogarId: nuevoHogar.id,
        nombre: "Samuel",
        esAdmin: false,
        ordenRotacion: 2,
        pinHash: pin0000Hash,
      },
      {
        hogarId: nuevoHogar.id,
        nombre: "Silvana",
        esAdmin: false,
        ordenRotacion: 3,
        pinHash: pin0000Hash,
      },
    ])
    .returning();

  console.log(
    `✔ Participantes creados con PIN 0000: ${sebastian.nombre} (Admin), ${samuel.nombre}, ${silvana.nombre}`
  );

  // 4. Crear los deberes obligatorios del hogar
  const [sofi, cocina, lavar] = await db
    .insert(deberes)
    .values([
      {
        hogarId: nuevoHogar.id,
        nombre: "Sofi",
        icono: "🐾",
        tipoAsignacion: "rotativo",
        esObligatorio: true,
        puntos: "10",
        cadencia: "diaria",
      },
      {
        hogarId: nuevoHogar.id,
        nombre: "Cocina",
        icono: "🍳",
        tipoAsignacion: "rotativo",
        esObligatorio: true,
        puntos: "10",
        cadencia: "diaria",
      },
      {
        hogarId: nuevoHogar.id,
        nombre: "Lavar",
        icono: "🍽️",
        tipoAsignacion: "rotativo",
        esObligatorio: true,
        puntos: "10",
        cadencia: "diaria",
      },
    ])
    .returning();

  console.log("✔ Deberes principales creados: Sofi, Cocina, Lavar");

  // Criterios de cumplimiento detallados
  await db.insert(criteriosDeber).values([
    // Sofi
    { deberId: sofi.id, descripcion: "Sacar en la mañana + servir comida y agua fresca", orden: 1 },
    { deberId: sofi.id, descripcion: "Sacar en la tarde/noche (5:30 a 6:30 PM)", orden: 2 },
    { deberId: sofi.id, descripcion: "Servir comida y agua en la noche", orden: 3 },
    { deberId: sofi.id, descripcion: "Limpiar y desinfectar cualquier accidente dentro de casa", orden: 4 },
    // Cocina
    { deberId: cocina.id, descripcion: "Cocinar almuerzo del día (la noche anterior o en la mañana)", orden: 1 },
    { deberId: cocina.id, descripcion: "Cocinar cena caliente del día para todos", orden: 2 },
    { deberId: cocina.id, descripcion: "Dejar la cocina limpia y todo lo sucio al lavaplatos", orden: 3 },
    // Lavar
    { deberId: lavar.id, descripcion: "Lavar todos los platos, vasos y potes traídos de la uni/trabajo", orden: 1 },
    { deberId: lavar.id, descripcion: "Lavar ollas, sartenes y utensilios usados al cocinar", orden: 2 },
    { deberId: lavar.id, descripcion: "Dejar fregadero y mesón limpios y secos antes de dormir", orden: 3 },
  ]);

  // Deberes opcionales / personales / extras
  const [cama, ropa, limpieza] = await db
    .insert(deberes)
    .values([
      {
        hogarId: nuevoHogar.id,
        nombre: "Cama tendida",
        icono: "🛏️",
        tipoAsignacion: "rotativo",
        esObligatorio: false,
        esPersonal: true,
        puntos: "2.5",
        cadencia: "diaria",
      },
      {
        hogarId: nuevoHogar.id,
        nombre: "Lavar ropa",
        icono: "🧺",
        tipoAsignacion: "reclamable",
        esObligatorio: false,
        puntos: "15",
        cadencia: "semanal",
        diasDisponibles: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"],
        maxReclamos: 2,
        requiereFoto: true,
      },
      {
        hogarId: nuevoHogar.id,
        nombre: "Limpieza profunda",
        icono: "🧽",
        tipoAsignacion: "reclamable",
        esObligatorio: false,
        puntos: "20",
        cadencia: "semanal",
        diasDisponibles: ["viernes", "sabado", "domingo"],
        maxReclamos: 1,
        requiereFoto: true,
      },
    ])
    .returning();

  await db.insert(criteriosDeber).values([
    { deberId: cama.id, descripcion: "Tender la cama al levantarse", orden: 1 },
    { deberId: ropa.id, descripcion: "Meter a lavar mínimo 3 tandas, secar y doblar", orden: 1 },
    { deberId: limpieza.id, descripcion: "Barrer, pasar coleto y vaciar papeleras de los baños", orden: 1 },
  ]);

  console.log("✔ Deberes extras y personales configurados.");

  // 5. Configurar el PLAN SEMANAL FIJO (Matriz acordada 7-7-7)
  // 0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado
  const planMatriz = [
    // Domingo (0)
    { diaSemana: 0, deberId: sofi.id, participanteId: samuel.id },
    { diaSemana: 0, deberId: cocina.id, participanteId: sebastian.id },
    { diaSemana: 0, deberId: lavar.id, participanteId: silvana.id },

    // Lunes (1)
    { diaSemana: 1, deberId: sofi.id, participanteId: silvana.id },
    { diaSemana: 1, deberId: cocina.id, participanteId: samuel.id },
    { diaSemana: 1, deberId: lavar.id, participanteId: sebastian.id },

    // Martes (2)
    { diaSemana: 2, deberId: sofi.id, participanteId: sebastian.id },
    { diaSemana: 2, deberId: cocina.id, participanteId: silvana.id },
    { diaSemana: 2, deberId: lavar.id, participanteId: samuel.id },

    // Miércoles (3)
    { diaSemana: 3, deberId: sofi.id, participanteId: sebastian.id },
    { diaSemana: 3, deberId: cocina.id, participanteId: samuel.id },
    { diaSemana: 3, deberId: lavar.id, participanteId: silvana.id },

    // Jueves (4)
    { diaSemana: 4, deberId: sofi.id, participanteId: silvana.id },
    { diaSemana: 4, deberId: cocina.id, participanteId: sebastian.id },
    { diaSemana: 4, deberId: lavar.id, participanteId: samuel.id },

    // Viernes (5) - Protocolo especial
    { diaSemana: 5, deberId: sofi.id, participanteId: samuel.id },
    { diaSemana: 5, deberId: cocina.id, participanteId: silvana.id },
    { diaSemana: 5, deberId: lavar.id, participanteId: sebastian.id },

    // Sábado (6)
    { diaSemana: 6, deberId: sofi.id, participanteId: sebastian.id },
    { diaSemana: 6, deberId: cocina.id, participanteId: samuel.id },
    { diaSemana: 6, deberId: lavar.id, participanteId: silvana.id },
  ];

  await db.insert(planSemanal).values(
    planMatriz.map((p) => ({
      hogarId: nuevoHogar.id,
      deberId: p.deberId,
      participanteId: p.participanteId,
      diaSemana: p.diaSemana,
    }))
  );

  console.log("✔ Plan semanal de 21 asignaciones fijas (7-7-7) insertado con éxito.");

  // 6. Generar asignaciones automáticas para los próximos 14 días
  const fechaHoy = obtenerFechaDeNegocio();
  const creadas = await generarAsignacionesRango(fechaHoy, 14, { sobrescribir: true });
  console.log(`✔ Asignaciones generadas para los próximos 14 días: ${creadas} asignaciones.`);

  // 7. Transacciones iniciales para que el marcador empiece limpio
  const hoyStr = formatearFechaISO(fechaHoy);
  await db.insert(transaccionesPuntos).values([
    {
      hogarId: nuevoHogar.id,
      participanteId: sebastian.id,
      cantidad: "50",
      tipo: "ajuste_admin",
      fecha: hoyStr,
    },
    {
      hogarId: nuevoHogar.id,
      participanteId: silvana.id,
      cantidad: "50",
      tipo: "ajuste_admin",
      fecha: hoyStr,
    },
    {
      hogarId: nuevoHogar.id,
      participanteId: samuel.id,
      cantidad: "50",
      tipo: "ajuste_admin",
      fecha: hoyStr,
    },
  ]);

  console.log("✔ Puntos iniciales otorgados (50 pts de bienvenida a cada hermano).");
  console.log("🎉 ¡Seed de producción completado al 100%!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error ejecutando el seed:", err);
  process.exit(1);
});
