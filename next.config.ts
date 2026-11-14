import type { NextConfig } from "next";

// Todas las pantallas leen el estado de los equipos en cada visita, así que
// no se usa caché de componentes: cada request consulta la base de datos.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
