import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// Abre el certificado de calibración de un equipo.
// - Los certificados reales están en un bucket privado de Supabase Storage y se
//   entregan con un enlace temporal de 10 minutos.
// - Los certificados de ejemplo de la demo (ruta "ejemplo/CODIGO.pdf") vienen
//   dentro de la app, en public/certificados-ejemplo.
export async function GET(request: NextRequest, ctx: RouteContext<"/certificados/[codigo]">) {
  const { codigo } = await ctx.params;

  const { data: equipo, error } = await supabase()
    .from("equipos")
    .select("certificado_path")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const ruta: string | null = equipo?.certificado_path ?? null;

  if (!ruta) {
    return new NextResponse(
      `El equipo ${codigo} no tiene un certificado cargado. Súbelo en la pantalla de calibraciones.`,
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const ejemplo = ruta.match(/^ejemplo\/([A-Z0-9-]+\.pdf)$/);
  if (ejemplo) {
    return NextResponse.redirect(new URL(`/certificados-ejemplo/${ejemplo[1]}`, request.url));
  }

  const { data, error: errorFirma } = await supabase()
    .storage.from("certificados")
    .createSignedUrl(ruta, 600);
  if (errorFirma || !data) {
    throw new Error(`No se pudo abrir el certificado: ${errorFirma?.message ?? "sin respuesta"}`);
  }

  return NextResponse.redirect(data.signedUrl);
}
