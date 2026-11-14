import Link from "next/link";
import { getEvidence } from "../lib/api";
import { Explorer } from "../components/explorer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data, error } = await getEvidence();
  return (
    <main>
      <header className="topbar">
        <Link href="/" className="brand">
          COCHA<span> / DIGITAL TWIN AI</span>
        </Link>
        <span className="badge">MVP · OBSERVACIÓN TERRESTRE</span>
      </header>
      <div className="heading">
        <div>
          <p className="eyebrow">COCHABAMBA, BOLIVIA · 17.39° S / 66.16° O</p>
          <h1>La ciudad, bajo otra mirada.</h1>
          <p className="intro">
            Explora temperatura superficial y vegetación a partir de
            observaciones Landsat. Cada cifra tiene una fuente y un límite.
          </p>
        </div>
        <div className="mission">
          01 / EXPLORADOR
          <br />
          <strong>Evidencia antes que predicción.</strong>
        </div>
      </div>
      {data ? (
        <Explorer evidence={data} />
      ) : (
        <section className="empty" role="status">
          <p className="eyebrow">
            {error ? "CONEXIÓN PENDIENTE" : "SIN OBSERVACIONES PUBLICADAS"}
          </p>
          <h2>
            {error
              ? "No pudimos consultar la evidencia."
              : "El explorador está listo para recibir datos."}
          </h2>
          <p>
            {error
              ? "Comprueba que la API esté disponible y vuelve a cargar la página."
              : "Ejecuta la ingesta Landsat documentada en el README. No se muestran valores de ejemplo."}
          </p>
          <Link href="/">Volver a intentar →</Link>
        </section>
      )}
      <footer>
        COCHA DIGITAL TWIN AI{" "}
        <span>
          Datos Landsat · USGS / NASA · Exploración científica reproducible
        </span>
      </footer>
    </main>
  );
}
