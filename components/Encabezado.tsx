import Link from "next/link";
import { salir } from "@/lib/acciones";

export function Encabezado({ usuario }: { usuario?: string }) {
  return (
    <header className="border-b border-linea bg-papel">
      <div className="mx-auto flex min-h-14 w-full max-w-xl items-center justify-between gap-3 px-4">
        <Link href="/" className="font-cond text-2xl font-bold tracking-tight">
          ProTerm
        </Link>
        {usuario ? (
          <form action={salir} className="flex items-center gap-3">
            <span className="max-w-36 truncate font-medium">{usuario}</span>
            <button type="submit" className="btn btn-secundario btn-chico">
              Salir
            </button>
          </form>
        ) : null}
      </div>
    </header>
  );
}
