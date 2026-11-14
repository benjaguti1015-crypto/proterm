export const CATEGORIAS = ["Muestreo", "Medición", "Accesorios"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export type Furgon = {
  id: number;
  codigo: string;
  nombre: string;
};

export type Servicio = {
  id: number;
  nombre: string;
};

/** Fila de la vista equipos_estado. */
export type EquipoEstado = {
  id: number;
  codigo: string;
  nombre: string;
  categoria: Categoria;
  en_uso: boolean;
  salida_id: number | null;
  furgon_id: number | null;
  furgon_nombre: string | null;
  responsable: string | null;
  fecha_retorno_estimada: string | null;
};

export type EquipoKit = EquipoEstado & { obligatorio: boolean };

/** Fila de la vista salidas_detalle. */
export type Salida = {
  id: number;
  furgon_id: number;
  furgon_nombre: string;
  servicio_id: number;
  servicio_nombre: string;
  usuario_id: number;
  responsable: string;
  fecha_salida: string;
  fecha_retorno_estimada: string;
  estado: "abierta" | "cerrada";
  closed_at: string | null;
};

export type ItemSalida = {
  equipo_id: number;
  codigo: string;
  nombre: string;
  categoria: Categoria;
  devuelto_at: string | null;
};

export type Conflicto = {
  codigo: string;
  nombre: string;
  furgon_nombre: string;
  responsable: string;
  fecha_retorno_estimada: string;
};

export type Sesion = {
  id: number;
  nombre: string;
};
