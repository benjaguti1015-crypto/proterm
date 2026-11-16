import { fechaCorta } from "./fechas";

// Estado de calibración de un equipo, según su fecha de vencimiento.
// La calibración es válida hasta el día de vencimiento, inclusive.

/** Días de anticipación para avisar que una calibración está por vencer. */
export const DIAS_AVISO = 30;

export type EstadoCalibracion =
  | { tipo: "sin_registro" }
  | { tipo: "vigente"; vence: string; dias: number }
  | { tipo: "por_vencer"; vence: string; dias: number }
  | { tipo: "vencida"; vence: string; dias: number };

function diasEntre(desde: string, hasta: string): number {
  return Math.round(
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000,
  );
}

export function estadoCalibracion(
  fechaVencimiento: string | null,
  hoy: string,
): EstadoCalibracion {
  if (!fechaVencimiento) return { tipo: "sin_registro" };
  const dias = diasEntre(hoy, fechaVencimiento);
  if (dias < 0) return { tipo: "vencida", vence: fechaVencimiento, dias };
  if (dias <= DIAS_AVISO) return { tipo: "por_vencer", vence: fechaVencimiento, dias };
  return { tipo: "vigente", vence: fechaVencimiento, dias };
}

export function estaVencida(fechaVencimiento: string | null, hoy: string): boolean {
  return estadoCalibracion(fechaVencimiento, hoy).tipo === "vencida";
}

/** "Calibración vencida el lun 11 nov", "Calibración vence en 12 días", etc. */
export function textoCalibracion(estado: EstadoCalibracion): string {
  switch (estado.tipo) {
    case "sin_registro":
      return "Sin registro de calibración";
    case "vencida":
      return `Calibración vencida el ${fechaCorta(estado.vence)}`;
    case "por_vencer":
      if (estado.dias === 0) return "Calibración vence hoy";
      if (estado.dias === 1) return "Calibración vence mañana";
      return `Calibración vence en ${estado.dias} días`;
    case "vigente":
      return `Calibración al día hasta el ${fechaLarga(estado.vence)}`;
  }
}

const fmtLarga = new Intl.DateTimeFormat("es-CL", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "2027-06-18" → "18 jun 2027". */
export function fechaLarga(fecha: string): string {
  return fmtLarga
    .format(new Date(`${fecha}T00:00:00Z`))
    .replace(/[.,]/g, "")
    .replace(/ de /g, " ")
    .replace(/-/g, " ");
}
