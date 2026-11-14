import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cocha Digital Twin AI",
  description: "Base de una plataforma de evidencia ambiental para Cochabamba.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
