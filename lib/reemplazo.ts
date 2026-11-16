import { puedeSalir } from "./obligatorios";
import type { EquipoEstado } from "./tipos";

// Si una unidad no puede salir (en uso o con la calibración vencida),
// se sugiere la siguiente del mismo tipo. Las unidades del mismo tipo
// comparten nombre, por ejemplo RU-SON-001 y RU-SON-002.

/** Primera unidad del mismo tipo que sí puede salir, sin contar las de `excluir`. */
export function reemplazoPara<T extends EquipoEstado>(
  equipo: EquipoEstado,
  todos: T[],
  hoy: string,
  excluir: Set<number> = new Set(),
): T | null {
  return (
    [...todos]
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
      .find(
        (otro) =>
          otro.id !== equipo.id &&
          otro.nombre === equipo.nombre &&
          !excluir.has(otro.id) &&
          puedeSalir(otro, hoy),
      ) ?? null
  );
}
