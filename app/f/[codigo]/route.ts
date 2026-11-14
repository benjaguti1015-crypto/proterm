import { NextResponse, type NextRequest } from "next/server";
import { obtenerFurgonPorCodigo } from "@/lib/datos";
import { NOMBRE_COOKIE_FURGON, OPCIONES_COOKIE } from "@/lib/sesion";

// Destino del QR pegado en cada furgón: guarda el furgón y pasa al login.
export async function GET(request: NextRequest, ctx: RouteContext<"/f/[codigo]">) {
  const { codigo } = await ctx.params;
  const furgon = await obtenerFurgonPorCodigo(codigo);

  if (!furgon) {
    return NextResponse.redirect(new URL("/furgon", request.url));
  }

  const respuesta = NextResponse.redirect(new URL("/login", request.url));
  respuesta.cookies.set(NOMBRE_COOKIE_FURGON, furgon.codigo, OPCIONES_COOKIE);
  return respuesta;
}
