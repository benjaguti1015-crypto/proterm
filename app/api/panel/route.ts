import { obtenerEquiposEstado } from "@/lib/datos";

// Datos del panel público. Se consulta en cada llamada, sin caché.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const equipos = await obtenerEquiposEstado();
    return Response.json({ equipos }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "No se pudo leer el estado de los equipos." }, { status: 500 });
  }
}
