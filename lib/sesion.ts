import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Sesion } from "./tipos";

// La sesión es una cookie firmada con el nombre del responsable.
// No es seguridad real: solo sirve para saber quién registra la salida.

const COOKIE_SESION = "pt_sesion";
const COOKIE_FURGON = "pt_furgon";
const TREINTA_DIAS = 60 * 60 * 24 * 30;

const opciones = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: TREINTA_DIAS,
};

function firmar(texto: string): string {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto) throw new Error("Falta la variable de entorno SESSION_SECRET.");
  return createHmac("sha256", secreto).update(texto).digest("base64url");
}

export async function leerSesion(): Promise<Sesion | null> {
  const valor = (await cookies()).get(COOKIE_SESION)?.value;
  if (!valor) return null;

  const [datos, firma] = valor.split(".");
  if (!datos || !firma) return null;

  const esperada = Buffer.from(firmar(datos));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) {
    return null;
  }

  try {
    const sesion = JSON.parse(Buffer.from(datos, "base64url").toString("utf8"));
    if (typeof sesion.id !== "number" || typeof sesion.nombre !== "string") return null;
    return { id: sesion.id, nombre: sesion.nombre };
  } catch {
    return null;
  }
}

export async function guardarSesion(sesion: Sesion): Promise<void> {
  const datos = Buffer.from(JSON.stringify(sesion), "utf8").toString("base64url");
  (await cookies()).set(COOKIE_SESION, `${datos}.${firmar(datos)}`, opciones);
}

export async function borrarSesion(): Promise<void> {
  (await cookies()).delete(COOKIE_SESION);
}

/** Código del furgón elegido (por QR o a mano), o null si no hay. */
export async function leerCodigoFurgon(): Promise<string | null> {
  return (await cookies()).get(COOKIE_FURGON)?.value ?? null;
}

export async function guardarCodigoFurgon(codigo: string): Promise<void> {
  (await cookies()).set(COOKIE_FURGON, codigo, opciones);
}

export const NOMBRE_COOKIE_FURGON = COOKIE_FURGON;
export const OPCIONES_COOKIE = opciones;
