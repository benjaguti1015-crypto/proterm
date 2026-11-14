import { fechaCorta } from "@/lib/fechas";
import type { EquipoEstado } from "@/lib/tipos";

/** Texto de un equipo en uso: "Furgón 2, por Pedro, vuelve mañana". */
export function detalleUso(equipo: EquipoEstado): string {
  const partes = [equipo.furgon_nombre, `por ${equipo.responsable}`];
  if (equipo.fecha_retorno_estimada) {
    partes.push(`vuelve ${fechaCorta(equipo.fecha_retorno_estimada)}`);
  }
  return partes.join(", ");
}

/** Estado de un equipo: verde si está disponible, rojo si está en uso. */
export function Estado({ equipo }: { equipo: EquipoEstado }) {
  if (!equipo.en_uso) {
    return (
      <span className="inline-flex items-center gap-2 font-semibold text-libre">
        <span aria-hidden className="size-2.5 flex-none rounded-full bg-libre" />
        Disponible
      </span>
    );
  }

  return (
    <span className="inline-flex items-baseline gap-2 font-semibold text-uso">
      <span aria-hidden className="size-2.5 flex-none translate-y-[-1px] rounded-full bg-uso" />
      <span>En uso: {detalleUso(equipo)}</span>
    </span>
  );
}

export function Check() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M4.5 10.5l3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
