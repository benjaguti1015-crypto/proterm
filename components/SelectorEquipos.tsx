"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { confirmarSalida } from "@/lib/acciones";
import { fechaCorta } from "@/lib/fechas";
import { obligatoriosFaltantes, preseleccion } from "@/lib/obligatorios";
import { CATEGORIAS, type Categoria, type Conflicto, type EquipoKit } from "@/lib/tipos";
import { Check, Estado } from "./Estado";

type Filtro = "Todos" | Categoria;
const FILTROS: Filtro[] = ["Todos", ...CATEGORIAS];

/** Quita tildes y mayúsculas para buscar. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function SelectorEquipos({
  servicioId,
  kit,
  hoy,
  fechaInicial,
}: {
  servicioId: number;
  kit: EquipoKit[];
  hoy: string;
  fechaInicial: string;
}) {
  const router = useRouter();
  const [marcados, setMarcados] = useState<Set<number>>(() => new Set(preseleccion(kit)));
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [faltantes, setFaltantes] = useState<string[] | null>(null);
  const [conflictos, setConflictos] = useState<Conflicto[] | null>(null);
  const [error, setError] = useState("");
  const [enviando, iniciar] = useTransition();
  const avisoConflicto = useRef<HTMLDivElement>(null);

  // Si un equipo marcado pasó a estar en uso, deja de contar.
  const seleccion = useMemo(
    () => kit.filter((e) => marcados.has(e.id) && !e.en_uso).map((e) => e.id),
    [kit, marcados],
  );

  const visibles = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    return kit
      .filter((e) => filtro === "Todos" || e.categoria === filtro)
      .filter(
        (e) =>
          !termino ||
          normalizar(e.nombre).includes(termino) ||
          normalizar(e.codigo).includes(termino),
      )
      .sort(
        (a, b) =>
          CATEGORIAS.indexOf(a.categoria) - CATEGORIAS.indexOf(b.categoria) ||
          a.codigo.localeCompare(b.codigo),
      );
  }, [kit, filtro, busqueda]);

  useEffect(() => {
    if (conflictos) avisoConflicto.current?.scrollIntoView({ block: "center" });
  }, [conflictos]);

  useEffect(() => {
    if (!faltantes) return;
    const cerrar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFaltantes(null);
    };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [faltantes]);

  function alternar(equipo: EquipoKit) {
    if (equipo.en_uso) return;
    setMarcados((previos) => {
      const siguiente = new Set(previos);
      if (siguiente.has(equipo.id)) siguiente.delete(equipo.id);
      else siguiente.add(equipo.id);
      return siguiente;
    });
  }

  function enviar(confirmaFaltantes: boolean) {
    setError("");
    setConflictos(null);

    const sinCubrir = obligatoriosFaltantes(kit, seleccion);
    if (sinCubrir.length > 0 && !confirmaFaltantes) {
      setFaltantes(sinCubrir);
      return;
    }
    setFaltantes(null);

    iniciar(async () => {
      const resultado = await confirmarSalida({
        servicioId,
        equipoIds: seleccion,
        fechaRetorno: fecha,
        confirmaFaltantes,
      });
      // Si la salida se guardó, el servidor redirige al inicio y no se llega aquí.
      if (!resultado) return;

      if (resultado.tipo === "faltantes") {
        setFaltantes(resultado.faltantes);
      } else if (resultado.tipo === "conflicto") {
        setConflictos(resultado.conflictos);
        router.refresh();
      } else {
        setError(resultado.mensaje);
      }
    });
  }

  const cantidad = seleccion.length;

  return (
    <>
      {conflictos ? (
        <div
          ref={avisoConflicto}
          role="alert"
          className="mt-4 rounded-2xl bg-uso-fondo p-4 text-uso"
        >
          <p className="text-lg font-bold">No se guardó la salida</p>
          <p className="mt-1 font-medium">
            Mientras elegías, {conflictos.length === 1 ? "este equipo salió" : "estos equipos salieron"} en
            otro furgón:
          </p>
          <ul className="mt-3 grid gap-2">
            {conflictos.map((c) => (
              <li key={c.codigo} className="leading-snug">
                <span className="placa mr-2 border-uso">{c.codigo}</span>
                <span className="font-semibold">{c.nombre}</span>
                <br />
                {c.furgon_nombre}, por {c.responsable}, vuelve {fechaCorta(c.fecha_retorno_estimada)}
              </li>
            ))}
          </ul>
          <p className="mt-3 font-medium">Ya quedaron desmarcados. Revisa la lista y confirma de nuevo.</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        <input
          className="campo"
          type="search"
          enterKeyHint="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o código"
          aria-label="Buscar por nombre o código"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
          {FILTROS.map((f) => (
            <button
              key={f}
              type="button"
              className="chip"
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-papel px-5 py-6 text-tinta-2">
          {busqueda.trim()
            ? `Ningún equipo del kit coincide con "${busqueda.trim()}". Prueba con otro nombre o código.`
            : `Este kit no tiene equipos de ${filtro}.`}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-linea overflow-hidden rounded-2xl bg-papel">
          {visibles.map((equipo) => {
            const marcado = !equipo.en_uso && marcados.has(equipo.id);
            return (
              <li key={equipo.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={marcado}
                  aria-disabled={equipo.en_uso}
                  onClick={() => alternar(equipo)}
                  className={`flex w-full items-start gap-4 px-4 py-4 text-left transition-colors duration-150 ${
                    equipo.en_uso ? "cursor-not-allowed" : "cursor-pointer"
                  } ${marcado ? "bg-marcado" : ""}`}
                >
                  <span
                    className="casilla mt-0.5"
                    data-marcada={marcado}
                    data-bloqueada={equipo.en_uso}
                  >
                    <Check />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1.5">
                    <span
                      className={`text-lg font-semibold leading-snug ${equipo.en_uso ? "text-tinta-2" : ""}`}
                    >
                      {equipo.nombre}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-tinta-2">
                      <span className="placa text-tinta">{equipo.codigo}</span>
                      <span>{equipo.categoria}</span>
                      {equipo.obligatorio ? (
                        <span className="font-semibold text-tinta">Obligatorio</span>
                      ) : null}
                    </span>
                    <Estado equipo={equipo} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <label className="mt-6 grid gap-2">
        <span className="text-lg font-semibold">Fecha estimada de retorno</span>
        <input
          className="campo"
          type="date"
          min={hoy}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
        />
      </label>

      <div className="fixed inset-x-0 bottom-0 border-t border-linea bg-papel pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto w-full max-w-xl px-4">
          {error ? (
            <p role="alert" className="mb-3 rounded-xl bg-aviso-fondo px-4 py-3 font-medium text-aviso">
              {error}
            </p>
          ) : null}
          <p className="mb-2 font-medium" aria-live="polite">
            {cantidad === 0
              ? "No has marcado ningún equipo."
              : `${cantidad === 1 ? "1 equipo marcado" : `${cantidad} equipos marcados`}${
                  fecha ? `, vuelve ${fechaCorta(fecha)}` : ""
                }.`}
          </p>
          <button
            type="button"
            className="btn btn-primario w-full"
            disabled={cantidad === 0 || !fecha || enviando}
            onClick={() => enviar(false)}
          >
            {enviando ? "Guardando…" : "Confirmar salida"}
          </button>
        </div>
      </div>

      {faltantes ? (
        <div
          className="hoja-fondo fixed inset-0 z-10 flex items-end justify-center sm:items-center"
          onClick={() => setFaltantes(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-faltantes"
            className="hoja w-full max-w-xl rounded-t-3xl bg-papel px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="titulo-faltantes" className="text-2xl font-bold leading-tight">
              {faltantes.length === 1
                ? "Falta 1 equipo obligatorio"
                : `Faltan ${faltantes.length} equipos obligatorios`}
            </h2>
            <ul className="mt-4 grid gap-2 rounded-xl bg-aviso-fondo px-4 py-3 text-aviso">
              {faltantes.map((nombre) => {
                const unidades = kit.filter((e) => e.nombre === nombre);
                const sinStock = unidades.every((e) => e.en_uso);
                return (
                  <li key={nombre} className="leading-snug">
                    <span className="font-bold">{nombre}</span>
                    <br />
                    {sinStock
                      ? unidades.length === 1
                        ? "Está en uso en otro furgón."
                        : "Todas las unidades están en uso."
                      : "Está disponible, pero no lo marcaste."}
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-tinta-2">
              Sin estos equipos el servicio puede quedar incompleto. ¿Sales igual?
            </p>
            <div className="mt-5 grid gap-3">
              <button
                type="button"
                className="btn btn-secundario w-full"
                onClick={() => setFaltantes(null)}
                autoFocus
              >
                Volver a la lista
              </button>
              <button type="button" className="btn btn-primario w-full" onClick={() => enviar(true)}>
                Confirmar salida sin ellos
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
