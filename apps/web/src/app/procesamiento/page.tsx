import Link from "next/link";
import { getJobs } from "../../lib/api";
import { pageOffset } from "../../lib/pagination";
import { PageHeader } from "../../components/ui/page-header";
import { StatusPanel } from "../../components/ui/status-panel";
import { DemoBanner } from "../../components/ui/demo-banner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Procesamiento y trazabilidad" };
const states: Record<string, string> = {
  running: "En ejecución", completed: "Completado", failed: "Fallido",
  pending: "Pendiente", cancelled: "Cancelado",
};
const kinds: Record<string, string> = {
  monica_pm10_import: "Importación MÓNICA", offline_monica_qa: "Revisión de calidad MÓNICA",
};
const date = (value: string | null | undefined) => value ? `${new Date(value).toISOString().slice(0, 19).replace("T", " ")} UTC` : "Sin registrar";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const offset = pageOffset((await searchParams).offset);
  const { data, demo } = await getJobs(offset);
  return <>
    <DemoBanner state={demo} />
    <PageHeader title="Del archivo a la evidencia">
      <p>Historial de ejecuciones registradas por el servidor. Una ejecución completada acredita el procesamiento técnico; la calidad científica requiere revisión.</p>
    </PageHeader>
    <div className="note">Consulta de solo lectura. No inicia descargas ni trabajos. Una ejecución interrumpida puede permanecer «En ejecución» hasta que el operador la revise.</div>
    {!data ? <StatusPanel status="error" title="No se pudo consultar el procesamiento"
      action={<Link href="/procesamiento">Volver a intentar</Link>} /> : <>
      {!data.items?.length ? <StatusPanel status="empty" title="No hay ejecuciones en esta página" /> :
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de datos desplazable"><table>
          <caption>Ejecuciones recientes, primero las más nuevas</caption>
          <thead><tr><th>Proceso</th><th>Estado</th><th>Inicio</th><th>Fin</th><th>Referencia</th></tr></thead>
          <tbody>{data.items.map((job) => <tr key={job.id}>
            <th scope="row">{kinds[job.kind] ?? job.kind}</th>
            <td><span className={`job-state job-${job.status === "failed" ? "failed" : job.status === "completed" ? "completed" : "pending"}`}>{states[job.status] ?? job.status}</span></td>
            <td>{date(job.started_at)}</td><td>{date(job.finished_at)}</td><td><code>{job.id}</code></td>
          </tr>)}</tbody>
        </table></div>}
      <nav className="pagination" aria-label="Páginas de ejecuciones">
        {offset > 0 && <Link href={`/procesamiento?offset=${Math.max(0, offset - 20)}`}>Más recientes</Link>}
        {data.has_more && <Link href={`/procesamiento?offset=${offset + 20}`}>Anteriores</Link>}
      </nav>
    </>}
  </>;
}
