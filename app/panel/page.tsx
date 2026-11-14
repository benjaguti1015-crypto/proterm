import type { Metadata } from "next";
import { TablaPanel } from "@/components/TablaPanel";
import { obtenerEquiposEstado } from "@/lib/datos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ProTerm: dónde está cada equipo",
};

// Pantalla pública, sin login. Es la que se muestra en la oficina.
export default async function Panel() {
  const equipos = await obtenerEquiposEstado();
  return <TablaPanel inicial={equipos} />;
}
