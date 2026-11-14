import Link from "next/link";
import { redirect } from "next/navigation";
import { ChecklistDevolucion } from "@/components/ChecklistDevolucion";
import { Encabezado } from "@/components/Encabezado";
import { exigirContexto } from "@/lib/contexto";
import { obtenerItemsSalida, obtenerSalidaAbierta } from "@/lib/datos";
import { fechaCorta, fechaDeMarca } from "@/lib/fechas";

export default async function Devolver() {
  const { sesion, furgon } = await exigirContexto();
  const salida = await obtenerSalidaAbierta(furgon.id);
  if (!salida) redirect("/");

  const items = await obtenerItemsSalida(salida.id);

  return (
    <>
      <Encabezado usuario={sesion.nombre} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-40 pt-4">
        <Link href="/" className="font-medium underline underline-offset-4">
          Volver al inicio
        </Link>
        <h1 className="mt-3 text-[1.75rem] font-bold leading-tight">Devolver equipos</h1>
        <p className="mt-1 text-tinta-2">
          {furgon.nombre}, {salida.servicio_nombre}. Salió{" "}
          {fechaCorta(fechaDeMarca(salida.fecha_salida))} con {salida.responsable}.
        </p>
        <ChecklistDevolucion salidaId={salida.id} items={items} />
      </main>
    </>
  );
}
