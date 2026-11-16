import type { NextConfig } from "next";

// Todas las pantallas leen el estado de los equipos en cada visita, así que
// no se usa caché de componentes: cada request consulta la base de datos.
const nextConfig: NextConfig = {
  experimental: {
    // Los certificados en PDF se suben por una Server Action: hasta 4 MB por archivo,
    // más el margen del formulario. Vercel no acepta cuerpos de más de 4,5 MB.
    serverActions: {
      bodySizeLimit: "4.4mb",
    },
  },
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
