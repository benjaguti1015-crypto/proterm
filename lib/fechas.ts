// Fechas siempre en hora de Chile, sin depender de la zona del servidor
// (Vercel corre en UTC) ni de la del celular.

const ZONA = "America/Santiago";

const fmtIso = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const fmtDia = new Intl.DateTimeFormat("es-CL", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const fmtHora = new Intl.DateTimeFormat("es-CL", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fmtHoraSeg = new Intl.DateTimeFormat("es-CL", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Hoy en Chile, como AAAA-MM-DD. */
export function hoyChile(): string {
  return fmtIso.format(new Date());
}

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-15" → "hoy", "mañana" o "sáb 15 nov". */
export function fechaCorta(fecha: string): string {
  const hoy = hoyChile();
  if (fecha === hoy) return "hoy";
  if (fecha === sumarDias(hoy, 1)) return "mañana";
  return fmtDia
    .format(new Date(`${fecha}T00:00:00Z`))
    .replace(/[.,]/g, "")
    .replace(/-/g, " ");
}

/** Marca de tiempo → fecha AAAA-MM-DD en Chile. */
export function fechaDeMarca(marca: string): string {
  return fmtIso.format(new Date(marca));
}

/** Marca de tiempo → "14:32" en Chile. */
export function horaCorta(marca: string | Date): string {
  return fmtHora.format(typeof marca === "string" ? new Date(marca) : marca);
}

/** Marca de tiempo → "14:32:08" en Chile. */
export function horaConSegundos(marca: Date): string {
  return fmtHoraSeg.format(marca);
}

export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}
