import type { Metadata } from "next";
import { Archivo, Atkinson_Hyperlegible } from "next/font/google";
import Link from "next/link";
import { NavLinks } from "../components/ui/nav-links";
import { ThemeProvider } from "../components/ui/theme-provider";
import { MotionFlag } from "../components/ui/motion-flag";
import { Starfield } from "../components/ui/starfield";
import "./globals.css";
import "./motion.css";
import "./presentation.css";
import "./refinement.css";
import "./interaction-motion.css";
import "./entrance-motion.css";
import "./workspace.css";
import "./starfield.css";
import "./climate-fx.css";

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
          <MotionFlag />
          <Starfield />
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
              <svg className="orbital-signature" viewBox="0 0 360 150" fill="none" aria-hidden="true">
                <ellipse cx="230" cy="75" rx="118" ry="43" transform="rotate(-22 230 75)" />
                <ellipse cx="230" cy="75" rx="118" ry="43" transform="rotate(22 230 75)" />
                <circle cx="230" cy="75" r="55" />
                <path d="M175 75h110M230 20v110M0 75h135" />
                <circle className="orbital-core" cx="230" cy="75" r="7" />
                <circle className="orbital-satellite" cx="328" cy="27" r="4" />
              </svg>
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
