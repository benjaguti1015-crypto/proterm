import type { EquipoKit } from "./tipos";

// Un requisito obligatorio es un tipo de equipo, no una unidad puntual:
// si el kit tiene dos sonómetros marcados como obligatorios, basta con
// llevar uno. Las unidades del mismo tipo comparten nombre.

/** Equipos obligatorios que conviene dejar marcados al abrir la lista. */
export function preseleccion(kit: EquipoKit[]): number[] {
  const porTipo = new Map<string, EquipoKit>();
  for (const equipo of [...kit].sort((a, b) => a.codigo.localeCompare(b.codigo))) {
    if (equipo.obligatorio && !equipo.en_uso && !porTipo.has(equipo.nombre)) {
      porTipo.set(equipo.nombre, equipo);
    }
  }
  return [...porTipo.values()].map((e) => e.id);
}

/** Tipos de equipo obligatorios que no quedaron cubiertos por la selección. */
export function obligatoriosFaltantes(kit: EquipoKit[], seleccion: number[]): string[] {
  const elegidos = new Set(seleccion);
  const cubiertos = new Set<string>();
  const requeridos: string[] = [];

  for (const equipo of kit) {
    if (!equipo.obligatorio) continue;
    if (!requeridos.includes(equipo.nombre)) requeridos.push(equipo.nombre);
    if (elegidos.has(equipo.id)) cubiertos.add(equipo.nombre);
  }

  return requeridos.filter((nombre) => !cubiertos.has(nombre));
}
