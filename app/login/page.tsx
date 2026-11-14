import { redirect } from "next/navigation";
import { Encabezado } from "@/components/Encabezado";
import { FormularioLogin } from "@/components/FormularioLogin";
import { obtenerFurgonPorCodigo } from "@/lib/datos";
import { leerCodigoFurgon, leerSesion } from "@/lib/sesion";

export default async function Login() {
  if (await leerSesion()) redirect("/");

  const codigo = await leerCodigoFurgon();
  const furgon = codigo ? await obtenerFurgonPorCodigo(codigo) : null;

  return (
    <>
      <Encabezado />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-6">
        {furgon ? (
          <p className="mb-5 inline-block rounded-lg bg-tinta px-3 pb-0.5 pt-1 font-cond text-2xl font-bold text-white">
            {furgon.nombre}
          </p>
        ) : null}
        <h1 className="text-3xl font-bold leading-tight">¿Quién se lleva los equipos?</h1>
        <p className="mt-2 text-tinta-2">
          Entra con tu nombre y tu PIN. Si es tu primera vez, tu usuario se crea con el PIN que
          escribas ahora.
        </p>
        <FormularioLogin />
      </main>
    </>
  );
}
