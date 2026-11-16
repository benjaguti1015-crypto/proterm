import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// Abre el certificado de calibración de un equipo.
// El PDF está en un bucket privado: se entrega con un enlace temporal de 10 minutos.
export async function GET(_request: NextRequest, ctx: RouteContext<"/certificados/[codigo]">) {
  const { codigo } = await ctx.params;

  const { data: equipo, error } = await supabase()
    .from("equipos")
    .select("certificado_path")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!equipo?.certificado_path) {
    return new NextResponse(
      `El equipo ${codigo} no tiene un certificado cargado. Súbelo en la pantalla de calibraciones.`,
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const { data, error: errorFirma } = await supabase()
    .storage.from("certificados")
    .createSignedUrl(equipo.certificado_path, 600);
  if (errorFirma || !data) {
    throw new Error(`No se pudo abrir el certificado: ${errorFirma?.message ?? "sin respuesta"}`);
  }

  return NextResponse.redirect(data.signedUrl);
}
