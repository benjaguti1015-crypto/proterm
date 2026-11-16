import { supabase } from "@/lib/supabase";

// Revisión rápida de la configuración. Sirve para saber por qué falla un deploy:
// dice qué variables faltan y si la base de datos responde.
// No muestra ningún valor secreto, solo si existe y de qué tipo es.
export const dynamic = "force-dynamic";

function tipoDeClave(clave: string): string {
  if (clave.startsWith("sb_secret_")) return "secret (correcta)";
  if (clave.startsWith("sb_publishable_")) return "publishable (incorrecta: usa la secret o la service_role)";
  try {
    const rol = JSON.parse(Buffer.from(clave.split(".")[1], "base64url").toString("utf8")).role;
    if (rol === "service_role") return "service_role (correcta)";
    if (rol === "anon") return "anon (incorrecta: usa la service_role)";
    return `rol desconocido: ${String(rol)}`;
  } catch {
    return "no parece una clave de Supabase: revisa que esté copiada completa";
  }
}

function pista(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("es_admin") || m.includes("fecha_vencimiento")) {
    return "Falta correr supabase/migrations/0002_calibracion.sql en el SQL Editor de Supabase.";
  }
  if (m.includes("could not find the table") || m.includes("does not exist") || m.includes("schema cache")) {
    return "Falta correr supabase/migrations/0001_inicial.sql en el SQL Editor de Supabase.";
  }
  if (m.includes("permission denied")) {
    return "La clave no tiene permisos. Usa la service_role (o la secret key), no la anon ni la publishable.";
  }
  if (m.includes("invalid api key") || m.includes("jwt") || m.includes("unauthorized")) {
    return "La clave no corresponde a este proyecto de Supabase o está mal copiada.";
  }
  if (m.includes("fetch failed") || m.includes("enotfound") || m.includes("invalid url")) {
    return "SUPABASE_URL está mal. Debe ser la Project URL, con la forma https://xxxx.supabase.co, sin nada después.";
  }
  return "Revisa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel, y vuelve a desplegar.";
}

export async function GET() {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  const variables = {
    SUPABASE_URL: url
      ? /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)
        ? "ok"
        : "tiene un formato raro: debe ser https://xxxx.supabase.co"
      : "FALTA",
    SUPABASE_SERVICE_ROLE_KEY: clave ? tipoDeClave(clave) : "FALTA",
    SESSION_SECRET: process.env.SESSION_SECRET ? "ok" : "FALTA",
  };

  let baseDeDatos: Record<string, unknown>;

  if (!url || !clave) {
    baseDeDatos = {
      ok: false,
      pista: "Agrega las variables que faltan en Vercel (Settings > Environment Variables) y haz Redeploy.",
    };
  } else {
    try {
      const [furgones, equipos, usuarios] = await Promise.all([
        supabase().from("furgones").select("id"),
        supabase().from("equipos_estado").select("id"),
        supabase().from("usuarios").select("id, es_admin"),
      ]);
      const error = furgones.error ?? equipos.error ?? usuarios.error;
      const cantidad = {
        furgones: furgones.data?.length ?? 0,
        equipos: equipos.data?.length ?? 0,
        usuarios: usuarios.data?.length ?? 0,
      };

      if (error) {
        baseDeDatos = { ok: false, error: error.message, pista: pista(error.message) };
      } else if (cantidad.furgones === 0 || cantidad.equipos === 0) {
        baseDeDatos = {
          ok: false,
          ...cantidad,
          pista: "Las tablas existen pero están vacías. Falta correr supabase/seed.sql en el SQL Editor.",
        };
      } else {
        baseDeDatos = { ok: true, ...cantidad };
      }
    } catch (e) {
      const mensaje = e instanceof Error ? `${e.message} ${String(e.cause ?? "")}` : String(e);
      baseDeDatos = { ok: false, error: mensaje.trim(), pista: pista(mensaje) };
    }
  }

  const todoBien =
    baseDeDatos.ok === true && variables.SESSION_SECRET === "ok" && variables.SUPABASE_URL === "ok";

  return Response.json(
    { todo_bien: todoBien, variables, base_de_datos: baseDeDatos },
    { headers: { "Cache-Control": "no-store" } },
  );
}
