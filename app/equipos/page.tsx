import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EditorCalibraciones } from "@/components/EditorCalibraciones";
import { Encabezado } from "@/components/Encabezado";
import { esAdmin, obtenerEquiposEstado } from "@/lib/datos";
import { hoyChile } from "@/lib/fechas";
import { leerSesion } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "ProTerm: calibraciones",
};

export default async function Calibraciones() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  if (!(await esAdmin(sesion.id))) {
    return (
      <>
        <Encabezado usuario={sesion.nombre} />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-6">
          <h1 className="text-3xl font-bold leading-tight">Calibraciones</h1>
          <p className="mt-2 text-tinta-2">
            Solo un administrador puede editar las fechas de calibración. Pide en la oficina que
            te den acceso.
          </p>
          <Link href="/" className="btn btn-secundario mt-6 w-full">
            Volver al inicio
          </Link>
        </main>
      </>
    );
  }

  const equipos = await obtenerEquiposEstado();

  return (
    <>
      <Encabezado usuario={sesion.nombre} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-4">
        <Link href="/" className="font-medium underline underline-offset-4">
          Volver al inicio
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
