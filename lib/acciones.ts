"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  obtenerFurgonPorCodigo,
  obtenerKit,
  obtenerSalidaAbierta,
} from "./datos";
import { esFechaValida, hoyChile } from "./fechas";
import { obligatoriosFaltantes } from "./obligatorios";
import {
  borrarSesion,
  guardarCodigoFurgon,
  guardarSesion,
  leerCodigoFurgon,
  leerSesion,
} from "./sesion";
import { supabase } from "./supabase";
import { reemplazoPara } from "./reemplazo";
import type { Conflicto, EquipoKit, VencidoRechazado } from "./tipos";

// ---------------------------------------------------------------
// Login
// ---------------------------------------------------------------

export type EstadoLogin = { error: string; nombre: string };

type UsuarioFila = { id: number; nombre: string; pin_hash: string };

async function buscarUsuario(nombre: string): Promise<UsuarioFila | null> {
  const { data, error } = await supabase()
    .from("usuarios")
    .select("id, nombre, pin_hash")
    .ilike("nombre", nombre)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function iniciarSesion(
  _previo: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const nombre = String(formData.get("nombre") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const pin = String(formData.get("pin") ?? "").trim();

  if (!/^\p{L}[\p{L} .'-]{1,39}$/u.test(nombre)) {
    return { error: "Escribe tu nombre: solo letras, entre 2 y 40 caracteres.", nombre };
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return { error: "El PIN debe tener entre 4 y 8 números.", nombre };
  }

  let usuario = await buscarUsuario(nombre);

  if (!usuario) {
    // Primera vez: se crea el usuario con este PIN.
    const { data, error } = await supabase()
      .from("usuarios")
      .insert({ nombre, pin_hash: await bcrypt.hash(pin, 10) })
      .select("id, nombre, pin_hash")
      .single();

    if (error?.code === "23505") {
      // Otra persona creó el mismo nombre al mismo tiempo.
      usuario = await buscarUsuario(nombre);
    } else if (error) {
      throw new Error(error.message);
    } else {
      usuario = data;
    }
  }

  if (!usuario || !(await bcrypt.compare(pin, usuario.pin_hash))) {
    return {
      error: `El PIN no coincide con el de ${usuario?.nombre ?? nombre}. Si es otra persona, entra con un nombre distinto.`,
      nombre,
    };
  }

  await guardarSesion({ id: usuario.id, nombre: usuario.nombre });
  redirect("/");
}

export async function salir(): Promise<void> {
  await borrarSesion();
  redirect("/login");
}

// ---------------------------------------------------------------
// Furgón
// ---------------------------------------------------------------

export async function elegirFurgon(formData: FormData): Promise<void> {
  const codigo = String(formData.get("codigo") ?? "");
  const furgon = await obtenerFurgonPorCodigo(codigo);
  if (furgon) await guardarCodigoFurgon(furgon.codigo);
  redirect("/");
}

// ---------------------------------------------------------------
// Salida
// ---------------------------------------------------------------

/** Equipo rechazado al confirmar y la unidad que se marcó en su lugar, si había. */
export type Reemplazo = { codigo: string; reemplazo: { id: number; codigo: string } | null };

export type ResultadoSalida =
  | { tipo: "faltantes"; faltantes: string[] }
  | { tipo: "conflicto"; conflictos: Conflicto[]; reemplazos: Reemplazo[]; kit: EquipoKit[] }
  | { tipo: "vencidos"; vencidos: VencidoRechazado[]; reemplazos: Reemplazo[]; kit: EquipoKit[] }
  | { tipo: "error"; mensaje: string };

/** Busca la siguiente unidad disponible del mismo tipo para cada equipo rechazado. */
async function buscarReemplazos(servicioId: number, rechazados: string[], elegidos: number[]) {
  const kit = await obtenerKit(servicioId);
  const hoy = hoyChile();
  const ocupados = new Set(elegidos);
  const reemplazos: Reemplazo[] = rechazados.map((codigo) => {
    const equipo = kit.find((e) => e.codigo === codigo);
    const otro = equipo ? reemplazoPara(equipo, kit, hoy, ocupados) : null;
    if (otro) ocupados.add(otro.id);
    return { codigo, reemplazo: otro ? { id: otro.id, codigo: otro.codigo } : null };
  });
  return { kit, reemplazos };
}

export async function confirmarSalida(entrada: {
  servicioId: number;
  equipoIds: number[];
  fechaRetorno: string;
  confirmaFaltantes: boolean;
}): Promise<ResultadoSalida> {
  const sesion = await leerSesion();
  if (!sesion) return { tipo: "error", mensaje: "Tu sesión se cerró. Vuelve a entrar." };

  const codigo = await leerCodigoFurgon();
  const furgon = codigo ? await obtenerFurgonPorCodigo(codigo) : null;
  if (!furgon) return { tipo: "error", mensaje: "Elige un furgón antes de registrar la salida." };

  const equipoIds = [...new Set(entrada.equipoIds)].filter(Number.isInteger);
  if (equipoIds.length === 0) {
    return { tipo: "error", mensaje: "Elige al menos un equipo." };
  }

  if (!esFechaValida(entrada.fechaRetorno) || entrada.fechaRetorno < hoyChile()) {
    return { tipo: "error", mensaje: "La fecha de retorno debe ser hoy o un día posterior." };
  }

  const kit = await obtenerKit(entrada.servicioId);
  const faltantes = obligatoriosFaltantes(kit, equipoIds);
  if (faltantes.length > 0 && !entrada.confirmaFaltantes) {
    return { tipo: "faltantes", faltantes };
  }

  // La función revalida en la base de datos, dentro de una transacción,
  // que nadie haya reservado estos equipos mientras tanto.
  const { data, error } = await supabase().rpc("crear_salida", {
    p_furgon_id: furgon.id,
    p_servicio_id: entrada.servicioId,
    p_usuario_id: sesion.id,
    p_fecha_retorno: entrada.fechaRetorno,
    p_equipo_ids: equipoIds,
  });
  if (error) throw new Error(error.message);

  if (!data.ok) {
    switch (data.error) {
      case "conflicto": {
        const conflictos = data.conflictos as Conflicto[];
        const extra = await buscarReemplazos(
          entrada.servicioId,
          conflictos.map((c) => c.codigo),
          equipoIds,
        );
        return { tipo: "conflicto", conflictos, ...extra };
      }
      case "vencidos": {
        const vencidos = data.vencidos as VencidoRechazado[];
        const extra = await buscarReemplazos(
          entrada.servicioId,
          vencidos.map((v) => v.codigo),
          equipoIds,
        );
        return { tipo: "vencidos", vencidos, ...extra };
      }
      case "furgon_ocupado":
        return {
          tipo: "error",
          mensaje: `${furgon.nombre} ya tiene una salida en curso. Devuelve esos equipos antes de registrar otra.`,
        };
      case "fuera_de_kit":
        return { tipo: "error", mensaje: "Hay equipos que no son del kit de este servicio." };
      default:
        return { tipo: "error", mensaje: "No se pudo registrar la salida. Inténtalo de nuevo." };
    }
  }

  redirect("/?aviso=salida-registrada");
}

// ---------------------------------------------------------------
// Devolución
// ---------------------------------------------------------------

export type ResultadoDevolucion =
  | { tipo: "parcial"; devueltos: number; pendientes: number }
  | { tipo: "error"; mensaje: string };

export async function devolverEquipos(entrada: {
  salidaId: number;
  equipoIds: number[];
}): Promise<ResultadoDevolucion> {
  const sesion = await leerSesion();
  if (!sesion) return { tipo: "error", mensaje: "Tu sesión se cerró. Vuelve a entrar." };

  const codigo = await leerCodigoFurgon();
  const furgon = codigo ? await obtenerFurgonPorCodigo(codigo) : null;
  const salida = furgon ? await obtenerSalidaAbierta(furgon.id) : null;
  if (!salida || salida.id !== entrada.salidaId) {
    return { tipo: "error", mensaje: "Esta salida ya no está abierta. Vuelve al inicio." };
  }

  const equipoIds = [...new Set(entrada.equipoIds)].filter(Number.isInteger);
  if (equipoIds.length === 0) {
    return { tipo: "error", mensaje: "Marca al menos un equipo para devolver." };
  }

  const { data, error } = await supabase().rpc("devolver_equipos", {
    p_salida_id: salida.id,
    p_equipo_ids: equipoIds,
  });
  if (error) throw new Error(error.message);

  if (!data.ok) {
    return { tipo: "error", mensaje: "Esta salida ya no está abierta. Vuelve al inicio." };
  }

  if (data.cerrada) redirect("/?aviso=salida-cerrada");

  revalidatePath("/devolver");
  return { tipo: "parcial", devueltos: equipoIds.length, pendientes: data.pendientes };
}

// ---------------------------------------------------------------
// Calibración (por ahora abierta a cualquiera)
// ---------------------------------------------------------------

export type ResultadoCalibracion = { ok: true } | { ok: false; mensaje: string };

const MAX_PDF = 4 * 1024 * 1024;

/**
 * Guarda las fechas de calibración y los datos del certificado de un equipo.
 * Si viene un PDF, lo sube a Storage y reemplaza al anterior.
 */
export async function guardarCalibracion(formData: FormData): Promise<ResultadoCalibracion> {
  const equipoId = Number(formData.get("equipoId"));
  const calibracion = String(formData.get("fechaCalibracion") ?? "").trim();
  const vencimiento = String(formData.get("fechaVencimiento") ?? "").trim();
  const numero = String(formData.get("numero") ?? "").trim().slice(0, 80);
  const laboratorio = String(formData.get("laboratorio") ?? "").trim().slice(0, 120);
  const archivo = formData.get("archivo");

  if (!Number.isInteger(equipoId)) return { ok: false, mensaje: "Equipo no válido." };

  if (calibracion && !esFechaValida(calibracion)) {
    return { ok: false, mensaje: "La fecha de calibración no es válida." };
  }
  if (vencimiento && !esFechaValida(vencimiento)) {
    return { ok: false, mensaje: "La fecha de vencimiento no es válida." };
  }
  if (calibracion && calibracion > hoyChile()) {
    return { ok: false, mensaje: "La última calibración no puede ser una fecha futura." };
  }
  if (calibracion && vencimiento && vencimiento < calibracion) {
    return { ok: false, mensaje: "El vencimiento tiene que ser posterior a la calibración." };
  }

  const { data: equipo, error: errorEquipo } = await supabase()
    .from("equipos")
    .select("codigo")
    .eq("id", equipoId)
    .maybeSingle();
  if (errorEquipo) throw new Error(errorEquipo.message);
  if (!equipo) return { ok: false, mensaje: "Ese equipo ya no existe." };

  const cambios: Record<string, string | null> = {
    fecha_calibracion: calibracion || null,
    fecha_vencimiento: vencimiento || null,
    certificado_numero: numero || null,
    certificado_laboratorio: laboratorio || null,
  };

  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > MAX_PDF) {
      return { ok: false, mensaje: "El PDF pesa más de 4 MB. Comprímelo o escanéalo con menos resolución." };
    }
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    // Un PDF siempre empieza con "%PDF".
    if (String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") {
      return { ok: false, mensaje: "El archivo no es un PDF. Sube el certificado en PDF." };
    }

    // Cada subida queda con su propio nombre: los certificados anteriores no se borran.
    const ruta = `${equipo.codigo}/${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
    const { error: errorSubida } = await supabase()
      .storage.from("certificados")
      .upload(ruta, bytes, { contentType: "application/pdf", upsert: false });
    if (errorSubida) {
      return { ok: false, mensaje: `No se pudo subir el PDF: ${errorSubida.message}` };
    }
    cambios.certificado_path = ruta;
    cambios.certificado_subido_at = new Date().toISOString();
  }

  const { error } = await supabase().from("equipos").update(cambios).eq("id", equipoId);
  if (error) throw new Error(error.message);

  revalidatePath("/equipos");
  revalidatePath("/panel");
  return { ok: true };
}
