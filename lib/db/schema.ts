import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Esquema de la base de datos — Sistema de Deberes de la Casa.
 *
 * Fiel a docs/03_Modelo_de_Datos.md. Principio de escalabilidad:
 * todo cuelga de `hogar` para poder pasar a multihogar filtrando por hogar_id.
 *
 * Las listas de valores (tipo_asignacion, cadencia, estado, etc.) se modelan
 * como columnas `text` con un enum a nivel de TypeScript: la columna sigue
 * siendo text en Postgres (como en el doc) pero el tipo en codigo es estricto.
 */

// ─────────────────────────────────────────────────────────────────────────────
// hogar — la configuracion global del hogar y la raiz de todo.
// ─────────────────────────────────────────────────────────────────────────────
export const hogar = pgTable("hogar", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  zonaHoraria: text("zona_horaria").notNull().default("America/Caracas"),
  // El dia cuenta hasta esta hora (cierre a las 3:00 AM).
  horaCierreDia: time("hora_cierre_dia").notNull().default("03:00"),
  // Puntos extra al cubrir a otro.
  bonoAyuda: numeric("bono_ayuda").notNull().default("5"),
  // Se resta al fallar sin razon valida.
  penalizacionFallo: numeric("penalizacion_fallo").notNull().default("15"),
  // Se resta a los tres si un no negociable no lo hace nadie.
  penalizacionColectiva: numeric("penalizacion_colectiva")
    .notNull()
    .default("10"),
  // Contraseña del perfil Admin
  claveAdmin: text("clave_admin").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// participantes — las personas que participan en los deberes.
// ─────────────────────────────────────────────────────────────────────────────
export const participantes = pgTable("participantes", {
  id: uuid("id").primaryKey().defaultRandom(),
  hogarId: uuid("hogar_id")
    .notNull()
    .references(() => hogar.id, { onDelete: "cascade" }),
  // FK a auth.users (schema gestionado por Supabase). Se deja como uuid simple
  // por ahora: el login real es trabajo futuro. Nullable.
  authUserId: uuid("auth_user_id"),
  nombre: text("nombre").notNull(),
  fotoUrl: text("foto_url"),
  esAdmin: boolean("es_admin").notNull().default(false),
  // Permite sacar a alguien de la rotacion sin borrar su historial.
  activo: boolean("activo").notNull().default(true),
  // Posicion en el circulo de rotacion.
  ordenRotacion: integer("orden_rotacion"),
  // PIN encriptado para acceso al perfil. Nullable por si es una casa sin PIN
  pinHash: text("pin_hash"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// sesiones — tokens de acceso (cookies) para usuarios y administrador
// ─────────────────────────────────────────────────────────────────────────────
export const sesiones = pgTable("sesiones", {
  id: text("id").primaryKey(), // Token generado criptográficamente
  rol: text("rol", { enum: ["admin", "usuario"] }).notNull(),
  participanteId: uuid("participante_id").references(() => participantes.id, {
    onDelete: "cascade",
  }),
  expiraEn: timestamp("expira_en", { withTimezone: true }).notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// credenciales_biometricas — credenciales WebAuthn (Passkeys / Face ID)
// ─────────────────────────────────────────────────────────────────────────────
export const credencialesBiometricas = pgTable("credenciales_biometricas", {
  id: text("id").primaryKey(), // Credential ID (base64url)
  participanteId: uuid("participante_id")
    .notNull()
    .references(() => participantes.id, { onDelete: "cascade" }),
  publicKey: text("public_key").notNull(),
  counter: bigint("counter", { mode: "number" }).notNull().default(0),
  transports: text("transports").array(),
  dispositivoNombre: text("dispositivo_nombre").default("Face ID / Dispositivo"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// suscripciones_push — para enviar notificaciones web push
// ─────────────────────────────────────────────────────────────────────────────
export const suscripcionesPush = pgTable("suscripciones_push", {
  id: uuid("id").primaryKey().defaultRandom(),
  participanteId: uuid("participante_id")
    .notNull()
    .references(() => participantes.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// deberes — totalmente configurables por el admin. Dos ejes independientes:
// tipo_asignacion (como se asigna) y es_obligatorio (que tan critico es).
// ─────────────────────────────────────────────────────────────────────────────
export const deberes = pgTable("deberes", {
  id: uuid("id").primaryKey().defaultRandom(),
  hogarId: uuid("hogar_id")
    .notNull()
    .references(() => hogar.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  icono: text("icono").notNull().default("✨"),
  tipoAsignacion: text("tipo_asignacion", {
    enum: ["rotativo", "reclamable"],
  }).notNull(),
  // No negociable: hay penalizacion si nadie lo hace.
  esObligatorio: boolean("es_obligatorio").notNull(),
  // Cada quien hace el suyo (ej. cuarto, closet) vs comunitario.
  esPersonal: boolean("es_personal").notNull().default(false),
  // Soporta decimales (ej. 2.5).
  puntos: numeric("puntos").notNull(),
  // Para reclamables, la cadencia indica el periodo de reinicio del cupo
  // ('semanal' o 'mensual'). Para rotativos/opcionales, su frecuencia.
  cadencia: text("cadencia", {
    enum: ["diaria", "dia_por_medio", "semanal", "mensual"],
  }).notNull(),
  // Dias de la semana en que el deber se muestra a los usuarios.
  // "Toda la semana" = los 7 dias; "fin de semana" = viernes, sabado, domingo.
  diasDisponibles: text("dias_disponibles")
    .array()
    .notNull()
    .default([
      "lunes",
      "martes",
      "miercoles",
      "jueves",
      "viernes",
      "sabado",
      "domingo",
    ]),
  // Tope total de reclamos por periodo (cupo del hogar, NO por persona).
  // Null = sin limite. Solo aplica a reclamables.
  maxReclamos: integer("max_reclamos"),
  // Los obligatorios = false (check); reclamables/opcionales = true.
  requiereFoto: boolean("requiere_foto").notNull().default(false),
  // [NUEVO] Para asignar un deber fijo a alguien (ej. Obligatorio fijo o Extra exclusivo)
  asignadoA: uuid("asignado_a").references(() => participantes.id, {
    onDelete: "set null",
  }),
  // [NUEVO] Define si el max_reclamos es un pozo común o un cupo por participante
  limitePorPersona: boolean("limite_por_persona").notNull().default(false),
  activo: boolean("activo").notNull().default(true),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// criterios_deber — sub-tareas que definen "cumplido" para cada deber.
// ─────────────────────────────────────────────────────────────────────────────
export const criteriosDeber = pgTable("criterios_deber", {
  id: uuid("id").primaryKey().defaultRandom(),
  deberId: uuid("deber_id")
    .notNull()
    .references(() => deberes.id, { onDelete: "cascade" }),
  descripcion: text("descripcion").notNull(),
  orden: integer("orden").notNull().default(0),
});

// ─────────────────────────────────────────────────────────────────────────────
// plan_semanal — la plantilla fija de deberes obligatorios de la semana.
// ─────────────────────────────────────────────────────────────────────────────
export const planSemanal = pgTable("plan_semanal", {
  id: uuid("id").primaryKey().defaultRandom(),
  hogarId: uuid("hogar_id")
    .notNull()
    .references(() => hogar.id, { onDelete: "cascade" }),
  deberId: uuid("deber_id")
    .notNull()
    .references(() => deberes.id, { onDelete: "cascade" }),
  participanteId: uuid("participante_id")
    .notNull()
    .references(() => participantes.id, { onDelete: "cascade" }),
  // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  diaSemana: integer("dia_semana").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// asignaciones — la realidad del día. Se genera copiando del plan_semanal.
// ─────────────────────────────────────────────────────────────────────────────
export const asignaciones = pgTable("asignaciones", {
  id: uuid("id").primaryKey().defaultRandom(),
  hogarId: uuid("hogar_id")
    .notNull()
    .references(() => hogar.id, { onDelete: "cascade" }),
  deberId: uuid("deber_id")
    .notNull()
    .references(() => deberes.id, { onDelete: "cascade" }),
  participanteId: uuid("participante_id")
    .notNull()
    .references(() => participantes.id, { onDelete: "cascade" }),
  fecha: date("fecha").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ausencias — dias fuera. El plan y el ranking de porcentaje las respetan.
// ─────────────────────────────────────────────────────────────────────────────
export const ausencias = pgTable("ausencias", {
  id: uuid("id").primaryKey().defaultRandom(),
  participanteId: uuid("participante_id")
    .notNull()
    .references(() => participantes.id, { onDelete: "cascade" }),
  fechaInicio: date("fecha_inicio").notNull(),
  fechaFin: date("fecha_fin").notNull(),
  motivo: text("motivo"),
  // El admin que la aprueba.
  aprobadaPor: uuid("aprobada_por").references(() => participantes.id, {
    onDelete: "set null",
  }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// registros — el historial permanente. Cada vez que alguien marca un deber.
// ─────────────────────────────────────────────────────────────────────────────
export const registros = pgTable("registros", {
  id: uuid("id").primaryKey().defaultRandom(),
  hogarId: uuid("hogar_id")
    .notNull()
    .references(() => hogar.id, { onDelete: "cascade" }),
  deberId: uuid("deber_id")
    .notNull()
    .references(() => deberes.id, { onDelete: "cascade" }),
  // Quien lo hizo.
  participanteId: uuid("participante_id")
    .notNull()
    .references(() => participantes.id, { onDelete: "cascade" }),
  // Dia que cuenta (respeta el cierre de las 3 AM).
  fecha: date("fecha").notNull(),
  estado: text("estado", {
    enum: ["cumplido_propio", "cubrio_a_otro", "reclamado"],
  }).notNull(),
  // A quien cubrio (nullable).
  cubiertoA: uuid("cubierto_a").references(() => participantes.id, {
    onDelete: "set null",
  }),
  // Para coberturas, lo confirma el ayudado.
  confirmado: boolean("confirmado").notNull().default(false),
  confirmadoPor: uuid("confirmado_por").references(() => participantes.id, {
    onDelete: "set null",
  }),
  // Prueba para reclamables/opcionales y coberturas.
  fotoUrl: text("foto_url"),
  // Justificacion.
  nota: text("nota"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// transacciones_puntos — el libro mayor. Los puntos NO se guardan sueltos:
// cada suma/resta es una fila. Los rankings se calculan sumando estas filas.
// ─────────────────────────────────────────────────────────────────────────────
export const transaccionesPuntos = pgTable("transacciones_puntos", {
  id: uuid("id").primaryKey().defaultRandom(),
  hogarId: uuid("hogar_id")
    .notNull()
    .references(() => hogar.id, { onDelete: "cascade" }),
  participanteId: uuid("participante_id")
    .notNull()
    .references(() => participantes.id, { onDelete: "cascade" }),
  // Que cumplimiento lo genero; null si es ajuste de admin.
  registroId: uuid("registro_id").references(() => registros.id, {
    onDelete: "set null",
  }),
  // Negativo para penalizaciones, soporta decimales.
  cantidad: numeric("cantidad").notNull(),
  tipo: text("tipo", {
    enum: [
      "cumplimiento",
      "bono_ayuda",
      "reclamable",
      "penalizacion",
      "penalizacion_colectiva",
      "ajuste_admin",
    ],
  }).notNull(),
  fecha: date("fecha").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// logros_obtenidos — medallas coleccionables. Se quedan para siempre.
// Las definiciones de logros son fijas (en codigo); aqui solo las instancias.
// ─────────────────────────────────────────────────────────────────────────────
export const logrosObtenidos = pgTable("logros_obtenidos", {
  id: uuid("id").primaryKey().defaultRandom(),
  participanteId: uuid("participante_id")
    .notNull()
    .references(() => participantes.id, { onDelete: "cascade" }),
  // Referencia al catalogo fijo de logros (en codigo).
  logroClave: text("logro_clave").notNull(),
  nivel: text("nivel", { enum: ["bronce", "plata", "oro"] }),
  fechaObtenido: date("fecha_obtenido").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// titulos_mes — los ganadores de los cuatro rankings cada mes.
// ─────────────────────────────────────────────────────────────────────────────
export const titulosMes = pgTable("titulos_mes", {
  id: uuid("id").primaryKey().defaultRandom(),
  participanteId: uuid("participante_id")
    .notNull()
    .references(() => participantes.id, { onDelete: "cascade" }),
  ranking: text("ranking", {
    enum: ["general", "confiable", "solidario", "responsable"],
  }).notNull(),
  // ej. '2026-06'.
  mes: text("mes").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// registro_auditoria — cada accion del admin, visible para los tres.
// ─────────────────────────────────────────────────────────────────────────────
export const registroAuditoria = pgTable("registro_auditoria", {
  id: uuid("id").primaryKey().defaultRandom(),
  hogarId: uuid("hogar_id")
    .notNull()
    .references(() => hogar.id, { onDelete: "cascade" }),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => participantes.id, { onDelete: "cascade" }),
  // ej. 'anular_puntos', 'editar_plan', 'ajuste_puntos'.
  accion: text("accion").notNull(),
  // Que cambio exactamente.
  detalle: jsonb("detalle"),
  fecha: timestamp("fecha", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// fotos_motivacionales — fotos que se muestran en recordatorios para motivar.
// NO son pruebas, son motivacion.
// ─────────────────────────────────────────────────────────────────────────────
export const fotosMotivacionales = pgTable("fotos_motivacionales", {
  id: uuid("id").primaryKey().defaultRandom(),
  hogarId: uuid("hogar_id")
    .notNull()
    .references(() => hogar.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  // ej. 'sofi', 'mama'.
  contexto: text("contexto").notNull(),
  // Si se ata a un deber especifico (nullable).
  deberId: uuid("deber_id").references(() => deberes.id, {
    onDelete: "set null",
  }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Relaciones (para el query API tipado de Drizzle).
// ─────────────────────────────────────────────────────────────────────────────
export const hogarRelations = relations(hogar, ({ many }) => ({
  participantes: many(participantes),
  deberes: many(deberes),
  asignaciones: many(asignaciones),
  registros: many(registros),
  transaccionesPuntos: many(transaccionesPuntos),
  registroAuditoria: many(registroAuditoria),
  fotosMotivacionales: many(fotosMotivacionales),
}));

export const participantesRelations = relations(
  participantes,
  ({ one, many }) => ({
    hogar: one(hogar, {
      fields: [participantes.hogarId],
      references: [hogar.id],
    }),
    suscripcionesPush: many(suscripcionesPush),
    asignaciones: many(asignaciones),
    ausencias: many(ausencias),
    registros: many(registros),
    transaccionesPuntos: many(transaccionesPuntos),
    logrosObtenidos: many(logrosObtenidos),
    titulosMes: many(titulosMes),
  }),
);

export const suscripcionesPushRelations = relations(suscripcionesPush, ({ one }) => ({
  participante: one(participantes, {
    fields: [suscripcionesPush.participanteId],
    references: [participantes.id],
  }),
}));

export const deberesRelations = relations(deberes, ({ one, many }) => ({
  hogar: one(hogar, { fields: [deberes.hogarId], references: [hogar.id] }),
  asignadoA: one(participantes, {
    fields: [deberes.asignadoA],
    references: [participantes.id],
  }),
  criterios: many(criteriosDeber),
  asignaciones: many(asignaciones),
  registros: many(registros),
  fotosMotivacionales: many(fotosMotivacionales),
}));

export const criteriosDeberRelations = relations(criteriosDeber, ({ one }) => ({
  deber: one(deberes, {
    fields: [criteriosDeber.deberId],
    references: [deberes.id],
  }),
}));

export const asignacionesRelations = relations(asignaciones, ({ one }) => ({
  hogar: one(hogar, { fields: [asignaciones.hogarId], references: [hogar.id] }),
  deber: one(deberes, {
    fields: [asignaciones.deberId],
    references: [deberes.id],
  }),
  participante: one(participantes, {
    fields: [asignaciones.participanteId],
    references: [participantes.id],
  }),
}));

export const ausenciasRelations = relations(ausencias, ({ one }) => ({
  participante: one(participantes, {
    fields: [ausencias.participanteId],
    references: [participantes.id],
  }),
}));

export const registrosRelations = relations(registros, ({ one, many }) => ({
  hogar: one(hogar, { fields: [registros.hogarId], references: [hogar.id] }),
  deber: one(deberes, {
    fields: [registros.deberId],
    references: [deberes.id],
  }),
  participante: one(participantes, {
    fields: [registros.participanteId],
    references: [participantes.id],
  }),
  transaccionesPuntos: many(transaccionesPuntos),
}));

export const transaccionesPuntosRelations = relations(
  transaccionesPuntos,
  ({ one }) => ({
    hogar: one(hogar, {
      fields: [transaccionesPuntos.hogarId],
      references: [hogar.id],
    }),
    participante: one(participantes, {
      fields: [transaccionesPuntos.participanteId],
      references: [participantes.id],
    }),
    registro: one(registros, {
      fields: [transaccionesPuntos.registroId],
      references: [registros.id],
    }),
  }),
);

export const logrosObtenidosRelations = relations(
  logrosObtenidos,
  ({ one }) => ({
    participante: one(participantes, {
      fields: [logrosObtenidos.participanteId],
      references: [participantes.id],
    }),
  }),
);

export const titulosMesRelations = relations(titulosMes, ({ one }) => ({
  participante: one(participantes, {
    fields: [titulosMes.participanteId],
    references: [participantes.id],
  }),
}));

export const registroAuditoriaRelations = relations(
  registroAuditoria,
  ({ one }) => ({
    hogar: one(hogar, {
      fields: [registroAuditoria.hogarId],
      references: [hogar.id],
    }),
    admin: one(participantes, {
      fields: [registroAuditoria.adminId],
      references: [participantes.id],
    }),
  }),
);

export const fotosMotivacionalesRelations = relations(
  fotosMotivacionales,
  ({ one }) => ({
    hogar: one(hogar, {
      fields: [fotosMotivacionales.hogarId],
      references: [hogar.id],
    }),
    deber: one(deberes, {
      fields: [fotosMotivacionales.deberId],
      references: [deberes.id],
    }),
  }),
);
