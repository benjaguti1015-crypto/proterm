"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { estadoCalibracion, fechaLarga, textoCalibracion } from "@/lib/calibracion";
import { fechaCorta, hoyChile, horaConSegundos } from "@/lib/fechas";
import { puedeSalir } from "@/lib/obligatorios";
import { CATEGORIAS, type Categoria, type EquipoEstado } from "@/lib/tipos";
import { Estado } from "./Estado";

const INTERVALO_MS = 10_000;

type FiltroCategoria = "Todas" | Categoria;
type FiltroEstado = "Todos" | "Disponibles" | "En uso" | "Por calibrar";

const FILTROS_CATEGORIA: FiltroCategoria[] = ["Todas", ...CATEGORIAS];
const FILTROS_ESTADO: FiltroEstado[] = ["Todos", "Disponibles", "En uso", "Por calibrar"];

/** Lo que, si cambia, hace destacar la fila en el panel. */
const huella = (e: EquipoEstado) => `${e.salida_id}|${e.fecha_vencimiento}`;

export function TablaPanel({ inicial, hoyInicial }: { inicial: EquipoEstado[]; hoyInicial: string }) {
  const [equipos, setEquipos] = useState(inicial);
  const [hoy, setHoy] = useState(hoyInicial);
  const [categoria, setCategoria] = useState<FiltroCategoria>("Todas");
  const [estado, setEstado] = useState<FiltroEstado>("Todos");
  const [hora, setHora] = useState("");
  const [sinConexion, setSinConexion] = useState(false);
  const [cambiados, setCambiados] = useState<Set<number>>(() => new Set());
  const previos = useRef(new Map(inicial.map((e) => [e.id, huella(e)])));

  useEffect(() => {
    let vigente = true;
    let limpiar: ReturnType<typeof setTimeout> | undefined;

    async function actualizar() {
      try {
        const respuesta = await fetch("/api/panel", { cache: "no-store" });
        if (!respuesta.ok) throw new Error("respuesta no válida");
        const datos: { equipos: EquipoEstado[] } = await respuesta.json();
        if (!vigente) return;

        // Destaca por un momento las filas que cambiaron de estado.
        const nuevos = new Set<number>();
        for (const equipo of datos.equipos) {
          if (previos.current.get(equipo.id) !== huella(equipo)) nuevos.add(equipo.id);
          previos.current.set(equipo.id, huella(equipo));
        }
        if (nuevos.size > 0) {
          setCambiados(nuevos);
          clearTimeout(limpiar);
          limpiar = setTimeout(() => vigente && setCambiados(new Set()), 2500);
        }

        setEquipos(datos.equipos);
        setHoy(hoyChile());
        setHora(horaConSegundos(new Date()));
        setSinConexion(false);
      } catch {
        if (vigente) setSinConexion(true);
      }
    }

    actualizar();
    const intervalo = setInterval(actualizar, INTERVALO_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") actualizar();
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      vigente = false;
      clearInterval(intervalo);
      clearTimeout(limpiar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  const enUso = equipos.filter((e) => e.en_uso).length;
  const disponibles = equipos.filter((e) => puedeSalir(e, hoy)).length;
  const vencidos = equipos.filter(
    (e) => estadoCalibracion(e.fecha_vencimiento, hoy).tipo === "vencida",
  ).length;
  const porVencer = equipos.filter(
    (e) => estadoCalibracion(e.fecha_vencimiento, hoy).tipo === "por_vencer",
  ).length;

  const visibles = useMemo(
    () =>
      equipos
        .filter((e) => categoria === "Todas" || e.categoria === categoria)
        .filter((e) => {
          if (estado === "Disponibles") return puedeSalir(e, hoy);
          if (estado === "En uso") return e.en_uso;
          if (estado === "Por calibrar") {
            const tipo = estadoCalibracion(e.fecha_vencimiento, hoy).tipo;
            return tipo === "vencida" || tipo === "por_vencer";
          }
          return true;
        }),
    [equipos, categoria, estado, hoy],
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="font-cond text-2xl font-bold tracking-tight">ProTerm</p>
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">Dónde está cada equipo</h1>
        </div>
        <p className="text-right tabular-nums text-tinta-2" aria-live="polite">
          {sinConexion
            ? "Sin conexión. Reintentando…"
            : hora
              ? `Actualizado a las ${hora}. Se refresca cada 10 segundos.`
              : "Se refresca cada 10 segundos."}
        </p>
      </header>

      <p className="mt-5 flex flex-wrap gap-x-8 gap-y-1 text-xl font-semibold">
        <span className="inline-flex items-center gap-2.5 text-libre">
          <span aria-hidden className="size-3 rounded-full bg-libre" />
          {disponibles === 1 ? "1 disponible" : `${disponibles} disponibles`}
        </span>
        <span className="inline-flex items-center gap-2.5 text-uso">
          <span aria-hidden className="size-3 rounded-full bg-uso" />
          {enUso} en uso
        </span>
        {vencidos > 0 ? (
          <span className="text-uso">
            {vencidos === 1 ? "1 con calibración vencida" : `${vencidos} con calibración vencida`}
          </span>
        ) : null}
        {porVencer > 0 ? (
          <span className="rounded-lg bg-aviso-fondo px-2.5 text-aviso">
            {porVencer === 1 ? "1 calibración por vencer" : `${porVencer} calibraciones por vencer`}
          </span>
        ) : null}
      </p>

      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
          {FILTROS_CATEGORIA.map((f) => (
            <button
              key={f}
              type="button"
              className="chip"
              aria-pressed={categoria === f}
              onClick={() => setCategoria(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f}
              type="button"
              className="chip"
              aria-pressed={estado === f}
              onClick={() => setEstado(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-papel px-5 py-8 text-tinta-2">
          Ningún equipo cumple con estos filtros.
        </p>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="mt-5 hidden overflow-hidden rounded-2xl bg-papel md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="whitespace-nowrap border-b-2 border-tinta text-base">
                  <th scope="col" className="py-3 pl-5 pr-4 font-semibold">Código</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Equipo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Categoría</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Dónde está</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Responsable</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Vuelve</th>
                  <th scope="col" className="py-3 pl-4 pr-5 font-semibold">Calibración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {visibles.map((e) => {
                  const calibracion = estadoCalibracion(e.fecha_vencimiento, hoy);
                  const bloqueado = e.en_uso || calibracion.tipo === "vencida";
                  return (
                  <tr key={e.id} className={cambiados.has(e.id) ? "fila-cambio" : undefined}>
                    <td className="py-3 pl-5 pr-4">
                      <span className="placa">{e.codigo}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{e.nombre}</td>
                    <td className="px-4 py-3 text-tinta-2">{e.categoria}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-0.5 font-semibold ${
                          bloqueado ? "bg-uso-fondo text-uso" : "bg-libre-fondo text-libre"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`size-2.5 rounded-full ${bloqueado ? "bg-uso" : "bg-libre"}`}
                        />
                        {e.en_uso ? "En uso" : bloqueado ? "No disponible" : "Disponible"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {e.en_uso ? e.furgon_nombre : <span className="text-tinta-2">Bodega</span>}
                    </td>
                    <td className="px-4 py-3">{e.responsable ?? ""}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {e.fecha_retorno_estimada ? fechaCorta(e.fecha_retorno_estimada) : ""}
                    </td>
                    <td className="py-3 pl-4 pr-5 whitespace-nowrap">
                      <CeldaCalibracion calibracion={calibracion} />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Celular: lista */}
          <ul className="mt-5 divide-y divide-linea overflow-hidden rounded-2xl bg-papel md:hidden">
            {visibles.map((e) => (
              <li
                key={e.id}
                className={`grid gap-1.5 px-4 py-3.5 ${cambiados.has(e.id) ? "fila-cambio" : ""}`}
              >
                <span className="text-lg font-semibold leading-snug">{e.nombre}</span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-tinta-2">
                  <span className="placa text-tinta">{e.codigo}</span>
                  <span>{e.categoria}</span>
                </span>
                <Estado equipo={e} hoy={hoy} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function CeldaCalibracion({ calibracion }: { calibracion: ReturnType<typeof estadoCalibracion> }) {
  switch (calibracion.tipo) {
    case "sin_registro":
      return <span className="text-tinta-2">Sin registro</span>;
    case "vigente":
      return <span className="text-tinta-2">Hasta {fechaLarga(calibracion.vence)}</span>;
    case "por_vencer":
      return (
        <span className="rounded-md bg-aviso-fondo px-2 py-0.5 font-medium text-aviso">
          {textoCalibracion(calibracion).replace("Calibración v", "V")}
        </span>
      );
    case "vencida":
      return (
        <span className="font-semibold text-uso">Venció el {fechaCorta(calibracion.vence)}</span>
      );
  }
}
