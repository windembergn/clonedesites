import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Christian Ferreira",
  description:
    "Viva o poder da transformação, através da cirurgia plástica.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
