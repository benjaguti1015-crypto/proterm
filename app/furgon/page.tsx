import { redirect } from "next/navigation";
import { Encabezado } from "@/components/Encabezado";
import { elegirFurgon } from "@/lib/acciones";
import { obtenerFurgones, obtenerSalidasAbiertas } from "@/lib/datos";
import { leerCodigoFurgon, leerSesion } from "@/lib/sesion";

export default async function ElegirFurgon() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  const [furgones, abiertas, actual] = await Promise.all([
    obtenerFurgones(),
    obtenerSalidasAbiertas(),
    leerCodigoFurgon(),
  ]);

  return (
    <>
      <Encabezado usuario={sesion.nombre} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-6">
        <h1 className="text-3xl font-bold leading-tight">¿En qué furgón estás?</h1>
        <p className="mt-2 text-tinta-2">
          También puedes escanear el QR pegado en el furgón.
        </p>

        <form action={elegirFurgon} className="mt-6 grid gap-3">
          {furgones.map((furgon) => {
            const salida = abiertas.find((s) => s.furgon_id === furgon.id);
            const esActual = furgon.codigo === actual;
            return (
              <button
                key={furgon.id}
                type="submit"
                name="codigo"
                value={furgon.codigo}
                className={`flex min-h-24 cursor-pointer items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left transition-transform duration-150 ease-salida active:scale-[0.98] ${
                  esActual
                    ? "bg-tinta text-white"
                    : "bg-papel shadow-[inset_0_0_0_2px_var(--color-tinta)]"
                }`}
              >
                <span className="font-cond text-[2.5rem] font-bold leading-none tracking-tight">
                  {furgon.nombre}
                </span>
                <span className={`text-right leading-snug ${esActual ? "opacity-85" : "text-tinta-2"}`}>
                  {salida ? (
                    <>
                      Salida en curso
                      <br />
                      con {salida.responsable}
                    </>
                  ) : (
                    "Sin salida"
                  )}
                </span>
              </button>
            );
          })}
        </form>
      </main>
    </>
  );
}
