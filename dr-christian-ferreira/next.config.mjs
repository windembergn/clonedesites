/** @type {import('next').NextConfig} */

// STATIC_EXPORT=1 gera arquivos estáticos para o nginx servir direto — não há
// nada de servidor nesta página, então um processo Node por site seria peso
// sem retorno. Sem a variável, mantém o build standalone que o Dockerfile usa.
const nextConfig = process.env.STATIC_EXPORT
  ? {
      output: "export",
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {
      output: "standalone",
      images: {
        remotePatterns: [
          { protocol: "https", hostname: "framerusercontent.com" },
        ],
      },
    };

export default nextConfig;
