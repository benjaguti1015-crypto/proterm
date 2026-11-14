"use client";

import { useMemo, useState, useTransition } from "react";
import { devolverEquipos } from "@/lib/acciones";
import { horaCorta } from "@/lib/fechas";
import type { ItemSalida } from "@/lib/tipos";
import { Check } from "./Estado";

export function ChecklistDevolucion({
  salidaId,
  items,
}: {
  salidaId: number;
  items: ItemSalida[];
}) {
  const [marcados, setMarcados] = useState<Set<number>>(() => new Set());
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [enviando, iniciar] = useTransition();

  const pendientes = useMemo(() => items.filter((i) => !i.devuelto_at), [items]);
  const devueltos = useMemo(() => items.filter((i) => i.devuelto_at), [items]);
  const seleccion = pendientes.filter((i) => marcados.has(i.equipo_id)).map((i) => i.equipo_id);
  const todos = pendientes.length > 0 && seleccion.length === pendientes.length;

  function alternar(id: number) {
    setAviso("");
    setMarcados((previos) => {
      const siguiente = new Set(previos);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function enviar() {
    setError("");
    setAviso("");
    iniciar(async () => {
      const resultado = await devolverEquipos({ salidaId, equipoIds: seleccion });
      // Si se devolvió todo, el servidor cierra la salida y redirige al inicio.
      if (!resultado) return;

      if (resultado.tipo === "error") {
        setError(resultado.mensaje);
        return;
      }
      setMarcados(new Set());
      setAviso(
        `${resultado.devueltos === 1 ? "Devolviste 1 equipo" : `Devolviste ${resultado.devueltos} equipos`}. ${
          resultado.pendientes === 1 ? "Queda 1 por devolver" : `Quedan ${resultado.pendientes} por devolver`
        }.`,
      );
    });
  }

  return (
    <>
      {aviso ? (
        <p role="status" className="mt-4 rounded-xl bg-tinta px-4 py-3 font-medium text-white">
          {aviso}
        </p>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {pendientes.length === 1 ? "1 equipo por devolver" : `${pendientes.length} equipos por devolver`}
        </h2>
        <button
          type="button"
          className="chip"
          aria-pressed={todos}
          onClick={() =>
            setMarcados(todos ? new Set() : new Set(pendientes.map((i) => i.equipo_id)))
          }
        >
          Marcar todos
        </button>
      </div>

      <ul className="mt-3 divide-y divide-linea overflow-hidden rounded-2xl bg-papel">
        {pendientes.map((item) => {
          const marcado = marcados.has(item.equipo_id);
          return (
            <li key={item.equipo_id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={marcado}
                onClick={() => alternar(item.equipo_id)}
                className={`flex w-full cursor-pointer items-center gap-4 px-4 py-4 text-left transition-colors duration-150 ${
                  marcado ? "bg-marcado" : ""
                }`}
              >
                <span className="casilla" data-marcada={marcado}>
                  <Check />
                </span>
                <span className="grid min-w-0 flex-1 gap-1.5">
                  <span className="text-lg font-semibold leading-snug">{item.nombre}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-tinta-2">
                    <span className="placa text-tinta">{item.codigo}</span>
                    <span>{item.categoria}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {devueltos.length > 0 ? (
        <>
          <h2 className="mt-7 text-lg font-semibold">Ya devueltos</h2>
          <ul className="mt-3 divide-y divide-linea overflow-hidden rounded-2xl bg-papel">
            {devueltos.map((item) => (
              <li key={item.equipo_id} className="flex items-center gap-4 px-4 py-3.5 text-tinta-2">
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="font-semibold leading-snug">{item.nombre}</span>
                  <span className="placa w-fit border-tinta-2">{item.codigo}</span>
                </span>
                <span className="flex-none text-right font-medium text-libre">
                  Devuelto
                  <br />
                  {horaCorta(item.devuelto_at!)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t border-linea bg-papel pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto w-full max-w-xl px-4">
          {error ? (
            <p role="alert" className="mb-3 rounded-xl bg-aviso-fondo px-4 py-3 font-medium text-aviso">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primario w-full"
            disabled={seleccion.length === 0 || enviando}
            onClick={enviar}
          >
            {enviando
              ? "Guardando…"
              : seleccion.length === 0
                ? "Marca lo que devuelves"
                : seleccion.length === 1
                  ? "Devolver 1 equipo"
                  : `Devolver ${seleccion.length} equipos`}
          </button>
        </div>
      </div>
    </>
  );
}
