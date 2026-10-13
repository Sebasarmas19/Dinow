/**
 * Utilidades para manejar fechas en la zona horaria de Caracas,
 * considerando que el día cierra a las 3:00 AM.
 */

/**
 * Retorna la "fecha de negocio" (logical date) actual.
 * Si en Caracas son antes de las 3:00 AM, todavía se considera el día anterior.
 * 
 * @param fecha Referencia (por defecto new Date())
 * @returns Date representando la medianoche (00:00:00) del día de negocio en UTC,
 * que se usa para consultar la BD.
 */
export function obtenerFechaDeNegocio(fecha: Date = new Date()): Date {
  // 1. Convertimos la fecha a la zona horaria de Caracas
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(fecha);
  
  const map = new Map(parts.map((p) => [p.type, p.value]));
  const year = parseInt(map.get("year")!, 10);
  const month = parseInt(map.get("month")!, 10) - 1; // 0-indexed
  const day = parseInt(map.get("day")!, 10);
  const hour = parseInt(map.get("hour")!, 10);

  // 2. Creamos un objeto Date local con los valores de Caracas
  const fechaCaracas = new Date(year, month, day);

  // 3. Si es antes de las 3 AM, restamos un día
  if (hour < 3) {
    fechaCaracas.setDate(fechaCaracas.getDate() - 1);
  }

  return fechaCaracas;
}

/**
 * Convierte una fecha a string "YYYY-MM-DD" usando sus componentes LOCALES
 * (año/mes/día tal cual los devuelve el Date), no UTC.
 *
 * Por qué no usar `.toISOString()`: ese método pasa la fecha a UTC primero, así
 * que en un servidor con zona horaria distinta puede devolver el día anterior o
 * el siguiente. Como `obtenerFechaDeNegocio()` ya nos da la medianoche del día
 * correcto, aquí solo necesitamos leer sus partes locales y formatearlas.
 */
export function formatearFechaISO(fecha: Date): string {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${año}-${mes}-${dia}`;
}

/**
 * Convierte un string "YYYY-MM-DD" a un Date local (medianoche de ese día).
 * Es la operación inversa de `formatearFechaISO`. Útil para recorrer rangos de
 * fechas guardadas como texto en la base de datos.
 */
export function parsearFechaISO(fechaStr: string): Date {
  const [año, mes, dia] = fechaStr.split("-").map((n) => parseInt(n, 10));
  return new Date(año, mes - 1, dia);
}

/**
 * Devuelve el nombre del día de la semana en minúscula y sin acentos
 * (ej. "lunes", "miercoles"), igual que se guardan en `deberes.diasDisponibles`.
 */
export function nombreDiaSemana(fecha: Date): string {
  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
  ];
  return dias[fecha.getDay()];
}

/**
 * Cantidad de días enteros entre dos fechas (b - a). Ignora horas/minutos:
 * compara solo el día. Sirve para calcular el "desfase" de la rotación.
 */
export function diasEntre(a: Date, b: Date): number {
  const ma = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const mb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((mb - ma) / 86_400_000);
}

/**
 * Suma (o resta, con negativos) días a una fecha y devuelve una fecha nueva.
 */
export function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  copia.setDate(copia.getDate() + dias);
  return copia;
}

/**
 * Rango de fechas (en strings "YYYY-MM-DD") que cubre el período de un deber
 * reclamable, según su cadencia. Sirve para contar cuántas veces se reclamó un
 * extra dentro del período actual y respetar el cupo (`max_reclamos`).
 *
 * - "mensual" → del día 1 al último día del mes de `fecha`.
 * - "semanal" → de lunes a domingo de la semana de `fecha`.
 * - cualquier otra ("diaria" / "dia_por_medio") → solo ese día.
 */
export function rangoPeriodo(
  cadencia: string,
  fecha: Date,
): { inicio: string; fin: string } {
  if (cadencia === "mensual") {
    const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    const fin = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
    return { inicio: formatearFechaISO(inicio), fin: formatearFechaISO(fin) };
  }

  if (cadencia === "semanal") {
    // getDay(): 0=domingo..6=sábado. Retrocedemos hasta el lunes.
    const diasDesdeLunes = (fecha.getDay() + 6) % 7;
    const inicio = sumarDias(fecha, -diasDesdeLunes);
    const fin = sumarDias(inicio, 6);
    return { inicio: formatearFechaISO(inicio), fin: formatearFechaISO(fin) };
  }

  const dia = formatearFechaISO(fecha);
  return { inicio: dia, fin: dia };
}

/**
 * Formatea una fecha a string en español (ej. "Lunes 15 de junio").
 */
export function formatearFechaLabel(fecha?: Date): string {
  const fechaFinal = fecha ? fecha : obtenerFechaDeNegocio();
  const texto = new Intl.DateTimeFormat("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Caracas",
  }).format(fechaFinal);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
