"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { confirmarSalida, type Reemplazo } from "@/lib/acciones";
import { fechaCorta, sumarDias } from "@/lib/fechas";
import { obligatoriosFaltantes, preseleccion, puedeSalir } from "@/lib/obligatorios";
import { reemplazoPara } from "@/lib/reemplazo";
import {
  CATEGORIAS,
  type Categoria,
  type Conflicto,
  type EquipoKit,
  type VencidoRechazado,
} from "@/lib/tipos";
import { Check, Estado } from "./Estado";

type Filtro = "Todos" | Categoria;
const FILTROS: Filtro[] = ["Todos", ...CATEGORIAS];

type Rechazo =
  | { tipo: "conflicto"; conflictos: Conflicto[]; reemplazos: Reemplazo[] }
  | { tipo: "vencidos"; vencidos: VencidoRechazado[]; reemplazos: Reemplazo[] };

/** Quita tildes y mayúsculas para buscar. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function porCodigo(a: EquipoKit, b: EquipoKit) {
  return a.codigo.localeCompare(b.codigo);
}

export function SelectorEquipos({
  servicioId,
  kit: kitInicial,
  hoy,
  fechaInicial,
}: {
  servicioId: number;
  kit: EquipoKit[];
  hoy: string;
  fechaInicial: string;
}) {
  // Si el servidor rechaza la salida, manda el kit actualizado y se usa ese.
  const [kitServidor, setKitServidor] = useState<EquipoKit[] | null>(null);
  const kit = kitServidor ?? kitInicial;

  const [marcados, setMarcados] = useState<Set<number>>(() => new Set(preseleccion(kitInicial, hoy)));
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [faltantes, setFaltantes] = useState<string[] | null>(null);
  const [rechazo, setRechazo] = useState<Rechazo | null>(null);
  const [error, setError] = useState("");
  const [enviando, iniciar] = useTransition();
  const avisoRechazo = useRef<HTMLDivElement>(null);

  // Solo cuenta lo que de verdad puede salir.
  const seleccion = useMemo(
    () => kit.filter((e) => marcados.has(e.id) && puedeSalir(e, hoy)).map((e) => e.id),
    [kit, marcados, hoy],
  );

  const coincide = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    return (e: EquipoKit) =>
      (filtro === "Todos" || e.categoria === filtro) &&
      (!termino || normalizar(e.nombre).includes(termino) || normalizar(e.codigo).includes(termino));
  }, [filtro, busqueda]);

  // Obligatorios agrupados por tipo de equipo (todas sus unidades juntas).
  const tiposObligatorios = useMemo(() => {
    const grupos = new Map<string, EquipoKit[]>();
    for (const e of [...kit].sort(porCodigo)) {
      if (!e.obligatorio) continue;
      grupos.set(e.nombre, [...(grupos.get(e.nombre) ?? []), e]);
    }
    return [...grupos.entries()].map(([nombre, unidades]) => ({ nombre, unidades }));
  }, [kit]);

  const recomendados = useMemo(
    () =>
      kit
        .filter((e) => !e.obligatorio)
        .sort(
          (a, b) =>
            CATEGORIAS.indexOf(a.categoria) - CATEGORIAS.indexOf(b.categoria) || porCodigo(a, b),
        ),
    [kit],
  );

  const tiposListos = tiposObligatorios.filter((t) =>
    t.unidades.some((u) => seleccion.includes(u.id)),
  ).length;

  const gruposVisibles = tiposObligatorios
    .map((t) => ({ ...t, unidades: t.unidades.filter(coincide) }))
    .filter((t) => t.unidades.length > 0);
  const recomendadosVisibles = recomendados.filter(coincide);
  const recomendadosLibres = recomendados.filter((e) => puedeSalir(e, hoy));
  const todosRecomendadosMarcados =
    recomendadosLibres.length > 0 && recomendadosLibres.every((e) => marcados.has(e.id));

  useEffect(() => {
    if (rechazo) avisoRechazo.current?.scrollIntoView({ block: "center" });
  }, [rechazo]);

  useEffect(() => {
    if (!faltantes) return;
    const cerrar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFaltantes(null);
    };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [faltantes]);

  function alternar(equipo: EquipoKit) {
    if (!puedeSalir(equipo, hoy)) return;
    setMarcados((previos) => {
      const siguiente = new Set(previos);
      if (siguiente.has(equipo.id)) siguiente.delete(equipo.id);
      else siguiente.add(equipo.id);
      return siguiente;
    });
  }

  function marcar(ids: number[], valor: boolean) {
    setMarcados((previos) => {
      const siguiente = new Set(previos);
      for (const id of ids) {
        if (valor) siguiente.add(id);
        else siguiente.delete(id);
      }
      return siguiente;
    });
  }

  function enviar(confirmaFaltantes: boolean) {
    setError("");
    setRechazo(null);

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
      } else if (resultado.tipo === "conflicto" || resultado.tipo === "vencidos") {
        // Se marca la siguiente unidad disponible de cada equipo rechazado.
        setKitServidor(resultado.kit);
        marcar(
          resultado.reemplazos.flatMap((r) => (r.reemplazo ? [r.reemplazo.id] : [])),
          true,
        );
        setRechazo(resultado);
      } else {
        setError(resultado.mensaje);
      }
    });
  }

  const cantidad = seleccion.length;
  const atajos = [
    { texto: "Mañana", valor: sumarDias(hoy, 1) },
    { texto: "En 2 días", valor: sumarDias(hoy, 2) },
    { texto: "En una semana", valor: sumarDias(hoy, 7) },
  ];

  return (
    <>
      {rechazo ? (
        <AvisoRechazo ref={avisoRechazo} rechazo={rechazo} kit={kit} />
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

      {gruposVisibles.length === 0 && recomendadosVisibles.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-papel px-5 py-6 text-tinta-2">
          {busqueda.trim()
            ? `Ningún equipo del kit coincide con "${busqueda.trim()}". Prueba con otro nombre o código.`
            : `Este kit no tiene equipos de ${filtro}.`}
        </p>
      ) : null}

      {/* 1. Obligatorios */}
      {gruposVisibles.length > 0 ? (
        <section className="mt-7" aria-labelledby="titulo-obligatorios">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="titulo-obligatorios" className="text-xl font-bold">
              1. Obligatorios
            </h2>
            <span
              className={`flex-none rounded-full px-3 py-0.5 font-semibold ${
                tiposListos === tiposObligatorios.length
                  ? "bg-tinta text-white"
                  : "bg-aviso-fondo text-aviso"
              }`}
            >
              {tiposListos} de {tiposObligatorios.length} listos
            </span>
          </div>
          <p className="mt-1 text-tinta-2">Sin estos no se puede hacer el servicio. Basta una unidad de cada uno.</p>

          <ul className="mt-3 grid gap-3">
            {gruposVisibles.map((grupo) => {
              const todas = tiposObligatorios.find((t) => t.nombre === grupo.nombre)!.unidades;
              const elegida = todas.find((u) => seleccion.includes(u.id));
              const hayLibre = todas.some((u) => puedeSalir(u, hoy));
              return (
                <li key={grupo.nombre} className="overflow-hidden rounded-2xl bg-papel">
                  <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
                    <h3 className="text-lg font-bold leading-snug">{grupo.nombre}</h3>
                    {elegida ? (
                      <span className="mt-0.5 inline-flex flex-none items-center gap-1.5 font-semibold">
                        <span className="grid size-5 place-items-center rounded-full bg-tinta text-white">
                          <svg aria-hidden width="12" height="12" viewBox="0 0 20 20" fill="none">
                            <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        Listo
                      </span>
                    ) : (
                      <span className="mt-0.5 flex-none rounded-md bg-aviso-fondo px-2 font-semibold text-aviso">
                        {hayLibre ? "Elige uno" : "Sin unidades"}
                      </span>
                    )}
                  </div>
                  {!hayLibre ? (
                    <p className="mx-4 mb-2 font-medium text-uso">
                      No queda ninguna unidad disponible. Puedes salir igual, pero el servicio puede quedar incompleto.
                    </p>
                  ) : null}
                  <ul className="divide-y divide-linea border-t border-linea">
                    {grupo.unidades.map((unidad) => (
                      <FilaEquipo
                        key={unidad.id}
                        equipo={unidad}
                        kit={kit}
                        hoy={hoy}
                        marcados={marcados}
                        alternar={alternar}
                        usar={(id) => marcar([id], true)}
                        soloCodigo
                      />
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* 2. Recomendados */}
      {recomendadosVisibles.length > 0 ? (
        <section className="mt-8" aria-labelledby="titulo-recomendados">
          <div className="flex items-center justify-between gap-3">
            <h2 id="titulo-recomendados" className="text-xl font-bold">
              2. Recomendados
            </h2>
            {recomendadosLibres.length > 0 ? (
              <button
                type="button"
                className="chip flex-none"
                aria-pressed={todosRecomendadosMarcados}
                onClick={() =>
                  marcar(
                    recomendadosLibres.map((e) => e.id),
                    !todosRecomendadosMarcados,
                  )
                }
              >
                {todosRecomendadosMarcados ? "Quitar todos" : "Marcar todos"}
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-tinta-2">Lo que normalmente se lleva para este servicio. Marca lo que vas a usar.</p>
          <ul className="mt-3 divide-y divide-linea overflow-hidden rounded-2xl bg-papel">
            {recomendadosVisibles.map((equipo) => (
              <FilaEquipo
                key={equipo.id}
                equipo={equipo}
                kit={kit}
                hoy={hoy}
                marcados={marcados}
                alternar={alternar}
                usar={(id) => marcar([id], true)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {/* 3. Fecha de retorno */}
      <section className="mt-8" aria-labelledby="titulo-fecha">
        <h2 id="titulo-fecha" className="text-xl font-bold">
          3. ¿Cuándo vuelven los equipos?
        </h2>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Fechas rápidas">
          {atajos.map((a) => (
            <button
              key={a.texto}
              type="button"
              className="chip"
              aria-pressed={fecha === a.valor}
              onClick={() => setFecha(a.valor)}
            >
              {a.texto}
            </button>
          ))}
        </div>
        <label className="mt-3 grid gap-2">
          <span className="font-semibold">Fecha estimada de retorno</span>
          <input
            className="campo"
            type="date"
            min={hoy}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </label>
      </section>

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
                const libre = unidades.find((e) => puedeSalir(e, hoy));
                const algunaVencida = unidades.some((e) => !e.en_uso && !puedeSalir(e, hoy));
                return (
                  <li key={nombre} className="leading-snug">
                    <span className="font-bold">{nombre}</span>
                    <br />
                    {libre
                      ? `${libre.codigo} está disponible, pero no lo marcaste.`
                      : unidades.length === 1
                        ? algunaVencida
                          ? "Tiene la calibración vencida."
                          : "Está en uso en otro furgón."
                        : algunaVencida
                          ? "No queda ninguna unidad disponible: están en uso o con la calibración vencida."
                          : "Todas las unidades están en uso."}
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

/** Una fila de equipo con su casilla, su estado y, si aplica, el reemplazo y el certificado. */
function FilaEquipo({
  equipo,
  kit,
  hoy,
  marcados,
  alternar,
  usar,
  soloCodigo = false,
}: {
  equipo: EquipoKit;
  kit: EquipoKit[];
  hoy: string;
  marcados: Set<number>;
  alternar: (e: EquipoKit) => void;
  usar: (id: number) => void;
  soloCodigo?: boolean;
}) {
  const bloqueado = !puedeSalir(equipo, hoy);
  const activo = !bloqueado && marcados.has(equipo.id);
  // Si esta unidad no puede salir, se sugiere la siguiente del mismo tipo (si aún no está marcada).
  const otro = bloqueado ? reemplazoPara(equipo, kit, hoy) : null;
  const sugerir = otro !== null && !marcados.has(otro.id);

  return (
    <li className={activo ? "bg-marcado" : undefined}>
      <button
        type="button"
        role="checkbox"
        aria-checked={activo}
        aria-disabled={bloqueado}
        onClick={() => alternar(equipo)}
        className={`flex w-full items-start gap-4 px-4 py-4 text-left ${
          bloqueado ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <span className="casilla mt-0.5" data-marcada={activo} data-bloqueada={bloqueado}>
          <Check />
        </span>
        <span className="grid min-w-0 flex-1 gap-1.5">
          {soloCodigo ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`placa ${bloqueado ? "border-tinta-2 text-tinta-2" : ""}`}>{equipo.codigo}</span>
            </span>
          ) : (
            <>
              <span className={`text-lg font-semibold leading-snug ${bloqueado ? "text-tinta-2" : ""}`}>
                {equipo.nombre}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-tinta-2">
                <span className="placa text-tinta">{equipo.codigo}</span>
                <span>{equipo.categoria}</span>
              </span>
            </>
          )}
          <Estado equipo={equipo} hoy={hoy} />
        </span>
      </button>

      {sugerir || equipo.tiene_certificado ? (
        <div className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pb-4 pl-16 pr-4">
          {sugerir && otro ? (
            <button
              type="button"
              className="btn btn-secundario btn-chico"
              onClick={() => usar(otro.id)}
            >
              Usar {otro.codigo} en su lugar
            </button>
          ) : null}
          {equipo.tiene_certificado ? (
            <a
              href={`/certificados/${encodeURIComponent(equipo.codigo)}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
            >
              Ver certificado{equipo.certificado_numero ? ` ${equipo.certificado_numero}` : ""}
            </a>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function AvisoRechazo({
  ref,
  rechazo,
  kit,
}: {
  ref: React.Ref<HTMLDivElement>;
  rechazo: Rechazo;
  kit: EquipoKit[];
}) {
  const items =
    rechazo.tipo === "conflicto"
      ? rechazo.conflictos.map((c) => ({
          codigo: c.codigo,
          nombre: c.nombre,
          motivo: `Se lo llevó ${c.responsable} en el ${c.furgon_nombre}, vuelve ${fechaCorta(c.fecha_retorno_estimada)}.`,
        }))
      : rechazo.vencidos.map((v) => ({
          codigo: v.codigo,
          nombre: v.nombre,
          motivo: `Su calibración venció el ${fechaCorta(v.fecha_vencimiento)}.`,
        }));

  return (
    <div ref={ref} role="alert" className="mt-4 rounded-2xl bg-uso-fondo p-4 text-uso">
      <p className="text-lg font-bold">No se guardó la salida</p>
      <p className="mt-1 font-medium">
        {rechazo.tipo === "conflicto"
          ? items.length === 1
            ? "Mientras elegías, este equipo salió en otro furgón:"
            : "Mientras elegías, estos equipos salieron en otro furgón:"
          : items.length === 1
            ? "Este equipo tiene la calibración vencida y no puede salir a terreno:"
            : "Estos equipos tienen la calibración vencida y no pueden salir a terreno:"}
      </p>
      <ul className="mt-3 grid gap-3">
        {items.map((item) => {
          const r = rechazo.reemplazos.find((x) => x.codigo === item.codigo)?.reemplazo;
          const enKit = r ? kit.some((e) => e.id === r.id) : false;
          return (
            <li key={item.codigo} className="leading-snug">
              <span className="placa mr-2 border-uso">{item.codigo}</span>
              <span className="font-semibold">{item.nombre}</span>
              <br />
              {item.motivo}
              <br />
              <span className="font-semibold text-tinta">
                {r && enKit
                  ? `En su lugar marcamos ${r.codigo}.`
                  : "No queda otra unidad disponible de este equipo."}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 font-medium">Revisa la lista y confirma de nuevo.</p>
    </div>
  );
}
