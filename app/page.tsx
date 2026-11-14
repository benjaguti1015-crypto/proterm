import Link from "next/link";
import { Encabezado } from "@/components/Encabezado";
import { exigirContexto } from "@/lib/contexto";
import {
  contarKits,
  obtenerItemsSalida,
  obtenerSalidaAbierta,
  obtenerServicios,
} from "@/lib/datos";
import { fechaCorta, fechaDeMarca } from "@/lib/fechas";
import type { Furgon, Salida } from "@/lib/tipos";

const AVISOS: Record<string, string> = {
  "salida-registrada": "Salida registrada. Los equipos quedaron a tu nombre.",
  "salida-cerrada": "Equipos devueltos. La salida quedó cerrada.",
};

export default async function Inicio({ searchParams }: PageProps<"/">) {
  const { sesion, furgon } = await exigirContexto();
  const { aviso } = await searchParams;
  const salida = await obtenerSalidaAbierta(furgon.id);
  const mensaje = typeof aviso === "string" ? AVISOS[aviso] : undefined;

  return (
    <>
      <Encabezado usuario={sesion.nombre} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10">
        {mensaje ? (
          <p role="status" className="mt-4 rounded-xl bg-tinta px-4 py-3 font-medium text-white">
            {mensaje}
          </p>
        ) : null}

        <section className="mt-4 flex items-end justify-between gap-4 rounded-2xl bg-tinta px-5 pb-4 pt-5 text-white">
          <div>
            <p className="text-base opacity-80">Estás en el</p>
            <p className="font-cond text-[4rem] font-bold leading-[0.95] tracking-tight">
              {furgon.nombre}
            </p>
          </div>
          <Link
            href="/furgon"
            className="btn btn-chico mb-1 flex-none text-white shadow-[inset_0_0_0_2px_rgb(255_255_255/0.7)]"
          >
            Cambiar
          </Link>
        </section>

        {salida ? <SalidaEnCurso salida={salida} /> : <Servicios furgon={furgon} />}

        <p className="mt-10 text-center">
          <Link href="/panel" className="font-medium underline underline-offset-4">
            Ver dónde está cada equipo
          </Link>
        </p>
      </main>
    </>
  );
}

async function SalidaEnCurso({ salida }: { salida: Salida }) {
  const items = await obtenerItemsSalida(salida.id);
  const pendientes = items.filter((i) => !i.devuelto_at);

  return (
    <section className="mt-6">
      <h1 className="text-2xl font-bold">Salida en curso</h1>
      <div className="mt-3 rounded-2xl bg-papel p-5">
        <p className="text-xl font-semibold leading-snug">{salida.servicio_nombre}</p>
        <p className="mt-2 text-tinta-2">
          Salió {fechaCorta(fechaDeMarca(salida.fecha_salida))} con {salida.responsable}. Vuelve{" "}
          {fechaCorta(salida.fecha_retorno_estimada)}.
        </p>

        <ul className="mt-4 divide-y divide-linea border-y border-linea">
          {pendientes.map((item) => (
            <li key={item.equipo_id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="font-medium leading-snug">{item.nombre}</span>
              <span className="placa flex-none">{item.codigo}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-tinta-2">
          {pendientes.length === 1
            ? "Queda 1 equipo por devolver."
            : `Quedan ${pendientes.length} equipos por devolver.`}
        </p>

        <Link href="/devolver" className="btn btn-primario mt-5 w-full">
          Devolver equipos
        </Link>
      </div>
    </section>
  );
}

async function Servicios({ furgon }: { furgon: Furgon }) {
  const [servicios, kits] = await Promise.all([obtenerServicios(), contarKits()]);

  return (
    <section className="mt-6">
      <h1 className="text-2xl font-bold">¿A qué servicio sales?</h1>
      <p className="mt-1 text-tinta-2">
        Elige el servicio para ver su kit y registrar lo que se lleva el {furgon.nombre}.
      </p>
      <ul className="mt-4 grid gap-3">
        {servicios.map((servicio) => (
          <li key={servicio.id}>
            <Link
              href={`/salida/${servicio.id}`}
              className="flex min-h-28 flex-col justify-center rounded-2xl bg-papel px-5 py-4 shadow-[inset_0_0_0_2px_var(--color-tinta)] transition-transform duration-150 ease-salida active:scale-[0.98]"
            >
              <span className="text-[1.375rem] font-bold leading-tight">{servicio.nombre}</span>
              <span className="mt-1 text-tinta-2">
                Kit de {kits.get(servicio.id) ?? 0} equipos
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
