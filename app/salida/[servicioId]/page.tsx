import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/Encabezado";
import { SelectorEquipos } from "@/components/SelectorEquipos";
import { exigirContexto } from "@/lib/contexto";
import { obtenerKit, obtenerSalidaAbierta, obtenerServicio } from "@/lib/datos";
import { hoyChile, sumarDias } from "@/lib/fechas";

export default async function NuevaSalida({ params }: PageProps<"/salida/[servicioId]">) {
  const { sesion, furgon } = await exigirContexto();
  const { servicioId } = await params;

  const id = Number(servicioId);
  if (!Number.isInteger(id)) notFound();

  const [servicio, salida] = await Promise.all([
    obtenerServicio(id),
    obtenerSalidaAbierta(furgon.id),
  ]);
  if (!servicio) notFound();
  // Un furgón con salida en curso primero devuelve sus equipos.
  if (salida) redirect("/");

  const kit = await obtenerKit(id);
  const hoy = hoyChile();

  return (
    <>
      <Encabezado usuario={sesion.nombre} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-44 pt-4">
        <Link href="/" className="font-medium underline underline-offset-4">
          Volver al inicio
        </Link>
        <h1 className="mt-3 text-[1.75rem] font-bold leading-tight">{servicio.nombre}</h1>
        <p className="mt-1 text-tinta-2">
          Este es el kit recomendado para el {furgon.nombre}. Los obligatorios ya vienen marcados.
        </p>
        <SelectorEquipos
          servicioId={servicio.id}
          kit={kit}
          hoy={hoy}
          fechaInicial={sumarDias(hoy, 1)}
        />
      </main>
    </>
  );
}
