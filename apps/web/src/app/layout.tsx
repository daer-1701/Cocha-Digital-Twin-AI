import type { Metadata } from "next";
import { Archivo, Atkinson_Hyperlegible } from "next/font/google";
import Link from "next/link";
import { NavLinks } from "../components/ui/nav-links";
import { ThemeProvider } from "../components/ui/theme-provider";
import "./globals.css";
import "./motion.css";
import "./presentation.css";
import "./refinement.css";
import "./interaction-motion.css";
import "./entrance-motion.css";
import "./workspace.css";

const font = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-brand",
});
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: { default: "Cocha Digital Twin AI", template: "%s | Cocha Digital Twin AI" },
  description: "Evidencia ambiental reproducible para Cochabamba.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${font.variable} ${display.variable}`} suppressHydrationWarning>
      <body className="mission-shell">
        <ThemeProvider>
          <a className="skip-link" href="#contenido">
            Saltar al contenido
          </a>
          <header className="topbar presentation-header">
            <div className="identity-row">
              <div>
                <Link href="/" className="brand">
                  <span className="brand-name">Cocha</span>
                  <span className="brand-system">Digital Twin AI</span>
                </Link>
                <p className="brand-purpose">Evidencia ambiental de Cochabamba</p>
              </div>
            </div>
            <NavLinks />
          </header>
          <main id="contenido">{children}</main>
          <footer>
            <span>Cocha Digital Twin AI, prototipo de evidencia ambiental.</span>
            <span>
              Observaciones Landsat de USGS y NASA. Cada cifra indica su fuente y sus
              límites. Día / Noche solo ilumina el mapa 3D; no cambia la página ni es
              una adquisición nocturna.
            </span>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
