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
import type { Conflicto, VencidoRechazado } from "./tipos";

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

export type ResultadoSalida =
  | { tipo: "faltantes"; faltantes: string[] }
  | { tipo: "conflicto"; conflictos: Conflicto[] }
  | { tipo: "vencidos"; vencidos: VencidoRechazado[] }
  | { tipo: "error"; mensaje: string };

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
      case "conflicto":
        revalidatePath("/salida/[servicioId]", "page");
        return { tipo: "conflicto", conflictos: data.conflictos as Conflicto[] };
      case "vencidos":
        revalidatePath("/salida/[servicioId]", "page");
        return { tipo: "vencidos", vencidos: data.vencidos as VencidoRechazado[] };
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

export async function actualizarCalibracion(entrada: {
  equipoId: number;
  fechaCalibracion: string;
  fechaVencimiento: string;
}): Promise<ResultadoCalibracion> {
  const calibracion = entrada.fechaCalibracion.trim();
  const vencimiento = entrada.fechaVencimiento.trim();

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

  const { error } = await supabase()
    .from("equipos")
    .update({
      fecha_calibracion: calibracion || null,
      fecha_vencimiento: vencimiento || null,
    })
    .eq("id", entrada.equipoId);
  if (error) throw new Error(error.message);

  revalidatePath("/equipos");
  return { ok: true };
}
