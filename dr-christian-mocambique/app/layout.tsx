import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

const base = process.env.BASE_PATH || "";

/* Pixel próprio desta campanha, diferente do que está no link-in-bio dele
   (1728746434993942) e dos das unidades da Lumivie. */
const META_PIXEL_ID = "1065431646110897";

export const metadata: Metadata = {
  metadataBase: new URL("https://drchristianferreira.com.br"),
  title: "Dr. Christian Ferreira | Cirurgia plástica em São Paulo para pacientes de Moçambique",
  description:
    "Cirurgia plástica de alto padrão em São Paulo, com consulta online, hospital de referência e uma equipa que acompanha cada passo — do primeiro contacto ao regresso a Moçambique.",
  openGraph: {
    title: "Dr. Christian Ferreira | Cirurgia plástica em São Paulo",
    description:
      "Para pacientes de Moçambique: consulta online, hospital de referência em São Paulo e acompanhamento em cada etapa.",
    locale: "pt_MZ",
    type: "website",
  },
  icons: { icon: `${base}/favicon.svg` },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#202223",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-MZ">
      <body>
        {/* Meta Pixel */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
        </Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            alt=""
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          />
        </noscript>

        {children}
      </body>
    </html>
  );
}
