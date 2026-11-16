import type { Metadata } from "next";
import Link from "next/link";
import { EditorCalibraciones } from "@/components/EditorCalibraciones";
import { Encabezado } from "@/components/Encabezado";
import { obtenerEquiposEstado } from "@/lib/datos";
import { hoyChile } from "@/lib/fechas";
import { leerSesion } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "ProTerm: calibraciones",
};

// Por ahora es abierta: cualquiera puede ver y editar las fechas, sin login.
// La columna usuarios.es_admin queda lista para restringirla más adelante.
export default async function Calibraciones() {
  const [sesion, equipos] = await Promise.all([leerSesion(), obtenerEquiposEstado()]);

  return (
    <>
      <Encabezado usuario={sesion?.nombre} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-4">
        <Link href={sesion ? "/" : "/panel"} className="font-medium underline underline-offset-4">
          {sesion ? "Volver al inicio" : "Ver dónde está cada equipo"}
        </Link>
        <h1 className="mt-3 text-[1.75rem] font-bold leading-tight">Calibraciones</h1>
        <p className="mt-1 text-tinta-2">
          Un equipo con la calibración vencida no puede salir a terreno. Actualiza las fechas
          cuando vuelva del laboratorio.
        </p>
        <EditorCalibraciones equipos={equipos} hoy={hoyChile()} />
      </main>
    </>
  );
}
