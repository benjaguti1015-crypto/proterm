import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase se usa solo desde el servidor, con la service role key.
// Esta clave nunca llega al navegador: no lleva el prefijo NEXT_PUBLIC_.

let cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (cliente) return cliente;

  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !clave) {
    throw new Error(
      "Faltan las variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  cliente = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cliente;
}
