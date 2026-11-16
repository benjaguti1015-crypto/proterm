"use client";

import { useMemo, useState, useTransition } from "react";
import { actualizarCalibracion } from "@/lib/acciones";
import { estadoCalibracion, textoCalibracion, type EstadoCalibracion } from "@/lib/calibracion";
import type { EquipoEstado } from "@/lib/tipos";

type Filtro = "Todos" | "Por calibrar" | "Sin registro";
const FILTROS: Filtro[] = ["Todos", "Por calibrar", "Sin registro"];

// Orden: primero lo urgente.
const PRIORIDAD: Record<EstadoCalibracion["tipo"], number> = {
  vencida: 0,
  por_vencer: 1,
  vigente: 2,
  sin_registro: 3,
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function EditorCalibraciones({ equipos, hoy }: { equipos: EquipoEstado[]; hoy: string }) {
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [busqueda, setBusqueda] = useState("");

  const porCalibrar = equipos.filter((e) => {
    const tipo = estadoCalibracion(e.fecha_vencimiento, hoy).tipo;
    return tipo === "vencida" || tipo === "por_vencer";
  }).length;

  const visibles = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    return equipos
      .map((e) => ({ equipo: e, estado: estadoCalibracion(e.fecha_vencimiento, hoy) }))
      .filter(({ estado }) => {
        if (filtro === "Por calibrar") return estado.tipo === "vencida" || estado.tipo === "por_vencer";
        if (filtro === "Sin registro") return estado.tipo === "sin_registro";
        return true;
      })
      .filter(
        ({ equipo }) =>
          !termino ||
          normalizar(equipo.nombre).includes(termino) ||
          normalizar(equipo.codigo).includes(termino),
      )
      .sort(
        (a, b) =>
          PRIORIDAD[a.estado.tipo] - PRIORIDAD[b.estado.tipo] ||
          a.equipo.codigo.localeCompare(b.equipo.codigo),
      );
  }, [equipos, filtro, busqueda, hoy]);

  return (
    <>
      <p className="mt-4 font-medium">
        {porCalibrar === 0
          ? "Todas las calibraciones registradas están al día."
          : porCalibrar === 1
            ? "1 equipo necesita calibración pronto o ya venció."
            : `${porCalibrar} equipos necesitan calibración pronto o ya vencieron.`}
      </p>

      <div className="mt-4 grid gap-3">
        <input
          className="campo"
          type="search"
          enterKeyHint="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o código"
          aria-label="Buscar por nombre o código"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar equipos">
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
          Ningún equipo cumple con este filtro.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {visibles.map(({ equipo, estado }) => (
            <FilaCalibracion key={equipo.id} equipo={equipo} estado={estado} hoy={hoy} />
          ))}
        </ul>
      )}
    </>
  );
}

function FilaCalibracion({
  equipo,
  estado,
  hoy,
}: {
  equipo: EquipoEstado;
  estado: EstadoCalibracion;
  hoy: string;
}) {
  const [calibracion, setCalibracion] = useState(equipo.fecha_calibracion ?? "");
  const [vencimiento, setVencimiento] = useState(equipo.fecha_vencimiento ?? "");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, iniciar] = useTransition();

  const cambio =
    calibracion !== (equipo.fecha_calibracion ?? "") ||
    vencimiento !== (equipo.fecha_vencimiento ?? "");

  // Al cargar una calibración nueva, propone un año de validez si no hay vencimiento posterior.
  function alCambiarCalibracion(valor: string) {
    setCalibracion(valor);
    setMensaje(null);
    if (valor && (!vencimiento || vencimiento < valor)) {
      const d = new Date(`${valor}T00:00:00Z`);
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      d.setUTCDate(d.getUTCDate() - 1);
      setVencimiento(d.toISOString().slice(0, 10));
    }
  }

  function guardar() {
    setMensaje(null);
    iniciar(async () => {
      const resultado = await actualizarCalibracion({
        equipoId: equipo.id,
        fechaCalibracion: calibracion,
        fechaVencimiento: vencimiento,
      });
      setMensaje(
        resultado.ok
          ? { ok: true, texto: "Fechas guardadas." }
          : { ok: false, texto: resultado.mensaje },
      );
    });
  }

  const colorEstado =
    estado.tipo === "vencida"
      ? "font-semibold text-uso"
      : estado.tipo === "por_vencer"
        ? "w-fit rounded-md bg-aviso-fondo px-2 py-0.5 font-medium text-aviso"
        : "text-tinta-2";

  return (
    <li className="rounded-2xl bg-papel p-4">
      <p className="text-lg font-semibold leading-snug">{equipo.nombre}</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-tinta-2">
        <span className="placa text-tinta">{equipo.codigo}</span>
        <span>{equipo.categoria}</span>
      </p>
      <p className={`mt-2 ${colorEstado}`}>{textoCalibracion(estado)}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="grid gap-1.5">
          <span className="font-semibold">Última calibración</span>
          <input
            className="campo px-3 text-base"
            type="date"
            max={hoy}
            value={calibracion}
            onChange={(e) => alCambiarCalibracion(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="font-semibold">Válida hasta</span>
          <input
            className="campo px-3 text-base"
            type="date"
            min={calibracion || undefined}
            value={vencimiento}
            onChange={(e) => {
              setVencimiento(e.target.value);
              setMensaje(null);
            }}
          />
        </label>
      </div>

      {mensaje ? (
        <p
          role={mensaje.ok ? "status" : "alert"}
          className={`mt-3 rounded-xl px-4 py-2.5 font-medium ${
            mensaje.ok ? "bg-tinta text-white" : "bg-aviso-fondo text-aviso"
          }`}
        >
          {mensaje.texto}
        </p>
      ) : null}

      {cambio ? (
        <button
          type="button"
          className="btn btn-primario btn-chico mt-3 w-full"
          disabled={guardando}
          onClick={guardar}
        >
          {guardando ? "Guardando…" : `Guardar ${equipo.codigo}`}
        </button>
      ) : null}
    </li>
  );
}
