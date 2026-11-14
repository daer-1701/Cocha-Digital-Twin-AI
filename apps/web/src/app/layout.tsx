import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import Link from "next/link";
import { NavLinks } from "../components/ui/nav-links";
import "./globals.css";

const font = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-brand",
});

export const metadata: Metadata = {
  title: { default: "Cocha Digital Twin AI", template: "%s | Cocha Digital Twin AI" },
  description: "Evidencia ambiental reproducible para Cochabamba.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={font.variable}>
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <header className="topbar">
          <Link href="/" className="brand">
            Cocha <span>Digital Twin AI</span>
          </Link>
          <NavLinks />
        </header>
        <main id="contenido">{children}</main>
        <footer>
          <span>Cocha Digital Twin AI, prototipo de evidencia ambiental.</span>
          <span>
            Observaciones Landsat de USGS y NASA. Cada cifra indica su fuente y sus
            límites.
          </span>
        </footer>
      </body>
    </html>
  );
}
