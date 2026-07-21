/** @type {import('next').NextConfig} */

// Este mesmo código serve as duas unidades. O que muda entre elas vem por
// variável de ambiente (link do WhatsApp e Meta Pixel) — ver app/unidade.ts.
//
// BASE_PATH ligado => exportação estática, para o nginx servir sob um
// subcaminho (ex.: /link-sp). Sem ele, mantém o build "standalone" original,
// que é o que o Dockerfile daqui usa.
const basePath = process.env.BASE_PATH || "";

const nextConfig = basePath
  ? {
      output: "export",
      basePath,
      assetPrefix: basePath,
      trailingSlash: true,
      // No export estático não há servidor para otimizar imagem sob demanda.
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
