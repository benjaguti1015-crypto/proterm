"use client";

// Pantalla de error en español. Los límites de error son componentes de cliente.
export default function ErrorDeCarga({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-10">
      <p className="font-cond text-2xl font-bold tracking-tight">ProTerm</p>
      <h1 className="mt-4 text-3xl font-bold leading-tight">No se pudo cargar esta pantalla</h1>
      <p className="mt-2 text-tinta-2">
        Falló la conexión con la base de datos. Revisa tu señal y vuelve a intentarlo. Si sigue
        igual, avisa en la oficina.
      </p>
      <button type="button" className="btn btn-primario mt-6 w-full" onClick={() => retry()}>
        Reintentar
      </button>
    </main>
  );
}
