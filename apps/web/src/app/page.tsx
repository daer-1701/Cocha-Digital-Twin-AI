import { getApiHealth } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const health = await getApiHealth();
  return (
    <main>
      <p className="eyebrow">COCHABAMBA · EVIDENCIA AMBIENTAL</p>
      <h1>Cocha Digital Twin AI</h1>
      <p className="intro">Una base para investigar cómo cambian la temperatura superficial y la vegetación de nuestra ciudad.</p>
      <section aria-labelledby="status-title">
        <h2 id="status-title">Estado del proyecto</h2>
        <p role="status">API: <strong>{health ? "disponible" : "sin conexión"}</strong></p>
        <p>Arquitectura inicial. Los datos satelitales, estaciones y límites distritales aún no están integrados.</p>
        <p>Los indicadores se publicarán con su fuente, período, cobertura e incertidumbre.</p>
      </section>
    </main>
  );
}
