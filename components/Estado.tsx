import { estadoCalibracion, textoCalibracion } from "@/lib/calibracion";
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

function Punto({ color }: { color: "libre" | "uso" }) {
  return (
    <span
      aria-hidden
      className={`size-2.5 flex-none translate-y-[-1px] rounded-full ${color === "libre" ? "bg-libre" : "bg-uso"}`}
    />
  );
}

/**
 * Estado de un equipo: verde si puede salir, rojo si está en uso o tiene
 * la calibración vencida. Si la calibración está por vencer, lo avisa debajo.
 */
export function Estado({ equipo, hoy }: { equipo: EquipoEstado; hoy: string }) {
  const calibracion = estadoCalibracion(equipo.fecha_vencimiento, hoy);
  const vencida = calibracion.tipo === "vencida";

  let principal;
  if (equipo.en_uso) {
    principal = (
      <span className="inline-flex items-baseline gap-2 font-semibold text-uso">
        <Punto color="uso" />
        <span>En uso: {detalleUso(equipo)}</span>
      </span>
    );
  } else if (vencida) {
    principal = (
      <span className="inline-flex items-baseline gap-2 font-semibold text-uso">
        <Punto color="uso" />
        <span>No disponible: {textoCalibracion(calibracion).toLowerCase()}</span>
      </span>
    );
  } else {
    principal = (
      <span className="inline-flex items-baseline gap-2 font-semibold text-libre">
        <Punto color="libre" />
        Disponible
      </span>
    );
  }

  // Segunda línea: solo si hay algo que avisar sobre la calibración.
  let aviso = null;
  if (calibracion.tipo === "por_vencer") {
    aviso = (
      <span className="w-fit rounded-md bg-aviso-fondo px-2 py-0.5 font-medium text-aviso">
        {textoCalibracion(calibracion)}
      </span>
    );
  } else if (vencida && equipo.en_uso) {
    aviso = <span className="font-medium text-uso">{textoCalibracion(calibracion)}</span>;
  }

  return (
    <span className="grid gap-1">
      {principal}
      {aviso}
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
