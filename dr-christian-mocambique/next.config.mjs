/** @type {import('next').NextConfig} */

// Mesma escolha do site brasileiro: sem nada de servidor nesta pagina, o build
// estatico (STATIC_EXPORT=1) sai pronto pro nginx. BASE_PATH existe porque a
// pagina pode ser servida sob um subcaminho (ex.: /mz) no mesmo dominio.
const basePath = process.env.BASE_PATH || "";

const nextConfig = process.env.STATIC_EXPORT
  ? {
      output: "export",
      trailingSlash: true,
      basePath,
      assetPrefix: basePath || undefined,
      images: { unoptimized: true },
      env: { NEXT_PUBLIC_BASE_PATH: basePath },
    }
  : {
      output: "standalone",
      images: { unoptimized: true },
      env: { NEXT_PUBLIC_BASE_PATH: "" },
    };

export default nextConfig;
