"use client";

import { useActionState } from "react";
import { iniciarSesion, type EstadoLogin } from "@/lib/acciones";

const inicial: EstadoLogin = { error: "", nombre: "" };

export function FormularioLogin() {
  const [estado, accion, enviando] = useActionState(iniciarSesion, inicial);

  return (
    <form action={accion} className="mt-6 grid gap-5">
      <label className="grid gap-2">
        <span className="text-lg font-semibold">Nombre</span>
        <input
          className="campo"
          name="nombre"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          defaultValue={estado.nombre}
          placeholder="Por ejemplo, Pedro"
          maxLength={40}
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-lg font-semibold">PIN</span>
        <input
          className="campo tracking-[0.3em]"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4,8}"
          autoComplete="off"
          placeholder="4 a 8 números"
          minLength={4}
          maxLength={8}
          required
        />
      </label>

      {estado.error ? (
        <p role="alert" className="rounded-xl bg-aviso-fondo px-4 py-3 font-medium text-aviso">
          {estado.error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primario w-full" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
