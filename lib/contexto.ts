import "server-only";
import { redirect } from "next/navigation";
import { obtenerFurgonPorCodigo } from "./datos";
import { leerCodigoFurgon, leerSesion } from "./sesion";
import type { Furgon, Sesion } from "./tipos";

/**
 * Responsable y furgón de quien está usando la app.
 * Si falta alguno, manda a la pantalla que corresponde.
 */
export async function exigirContexto(): Promise<{ sesion: Sesion; furgon: Furgon }> {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  const codigo = await leerCodigoFurgon();
  const furgon = codigo ? await obtenerFurgonPorCodigo(codigo) : null;
  if (!furgon) redirect("/furgon");

  return { sesion, furgon };
}
