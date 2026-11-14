import "server-only";
import { supabase } from "./supabase";
import type { EquipoEstado, EquipoKit, Furgon, ItemSalida, Salida, Servicio } from "./tipos";

// Consultas de lectura. Todas corren en el servidor.

function revisar<T>(resultado: { data: T | null; error: { message: string } | null }): T {
  if (resultado.error) {
    throw new Error(`Error al consultar la base de datos: ${resultado.error.message}`);
  }
  return resultado.data as T;
}

export async function obtenerFurgones(): Promise<Furgon[]> {
  return revisar(
    await supabase().from("furgones").select("id, codigo, nombre").order("codigo"),
  );
}

export async function obtenerFurgonPorCodigo(codigo: string): Promise<Furgon | null> {
  return revisar(
    await supabase()
      .from("furgones")
      .select("id, codigo, nombre")
      .eq("codigo", codigo)
      .maybeSingle(),
  );
}

export async function obtenerServicios(): Promise<Servicio[]> {
  return revisar(await supabase().from("servicios").select("id, nombre").order("id"));
}

export async function obtenerServicio(id: number): Promise<Servicio | null> {
  return revisar(
    await supabase().from("servicios").select("id, nombre").eq("id", id).maybeSingle(),
  );
}

/** Cantidad de equipos del kit de cada servicio. */
export async function contarKits(): Promise<Map<number, number>> {
  const filas: { servicio_id: number }[] = revisar(
    await supabase().from("kit_servicio").select("servicio_id"),
  );
  const conteo = new Map<number, number>();
  for (const fila of filas) {
    conteo.set(fila.servicio_id, (conteo.get(fila.servicio_id) ?? 0) + 1);
  }
  return conteo;
}

export async function obtenerEquiposEstado(): Promise<EquipoEstado[]> {
  return revisar(await supabase().from("equipos_estado").select("*").order("codigo"));
}

/** Kit de un servicio, con el estado actual de cada equipo. */
export async function obtenerKit(servicioId: number): Promise<EquipoKit[]> {
  const kit: { equipo_id: number; obligatorio: boolean }[] = revisar(
    await supabase()
      .from("kit_servicio")
      .select("equipo_id, obligatorio")
      .eq("servicio_id", servicioId),
  );
  if (kit.length === 0) return [];

  const equipos: EquipoEstado[] = revisar(
    await supabase()
      .from("equipos_estado")
      .select("*")
      .in(
        "id",
        kit.map((k) => k.equipo_id),
      )
      .order("codigo"),
  );

  const obligatorio = new Map(kit.map((k) => [k.equipo_id, k.obligatorio]));
  return equipos.map((e) => ({ ...e, obligatorio: obligatorio.get(e.id) ?? false }));
}

/** Salidas abiertas de todos los furgones. */
export async function obtenerSalidasAbiertas(): Promise<Salida[]> {
  return revisar(
    await supabase().from("salidas_detalle").select("*").eq("estado", "abierta"),
  );
}

/** Salida abierta de un furgón, si tiene. */
export async function obtenerSalidaAbierta(furgonId: number): Promise<Salida | null> {
  return revisar(
    await supabase()
      .from("salidas_detalle")
      .select("*")
      .eq("furgon_id", furgonId)
      .eq("estado", "abierta")
      .maybeSingle(),
  );
}

/** Equipos de una salida, devueltos y pendientes. */
export async function obtenerItemsSalida(salidaId: number): Promise<ItemSalida[]> {
  const items: { equipo_id: number; devuelto_at: string | null }[] = revisar(
    await supabase()
      .from("salida_items")
      .select("equipo_id, devuelto_at")
      .eq("salida_id", salidaId),
  );
  if (items.length === 0) return [];

  const equipos: (Pick<ItemSalida, "codigo" | "nombre" | "categoria"> & { id: number })[] = revisar(
    await supabase()
      .from("equipos")
      .select("id, codigo, nombre, categoria")
      .in(
        "id",
        items.map((i) => i.equipo_id),
      )
      .order("codigo"),
  );

  const devuelto = new Map(items.map((i) => [i.equipo_id, i.devuelto_at]));
  return equipos.map((e) => ({
    equipo_id: e.id,
    codigo: e.codigo,
    nombre: e.nombre,
    categoria: e.categoria,
    devuelto_at: devuelto.get(e.id) ?? null,
  }));
}
