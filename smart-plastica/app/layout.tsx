import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumivie",
  description: "O extraordinário começa em você.",
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
